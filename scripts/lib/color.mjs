// Colour math for the contrast checks: hex parsing, alpha compositing in sRGB (what a browser
// does when it paints one layer over another), the SVG saturate matrix, and WCAG ratios.

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

// paint `top` at alpha a over `bottom`
export const over = (bottom, top, a) => bottom.map((v, i) => v + (top[i] - v) * a);

export const mix = (a, b, t) => hex(over(rgb(a), rgb(b), t));

// feColorMatrix type="saturate", as the SVG spec defines it
export function saturate([r, g, b], s) {
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  return m.map((row) => Math.min(255, Math.max(0, row[0] * r + row[1] * g + row[2] * b)));
}

export const brighten = (c, k) => c.map((v) => Math.min(255, v * k));

export function luminance(c) {
  const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a, b) {
  const [x, y] = [luminance(typeof a === 'string' ? rgb(a) : a), luminance(typeof b === 'string' ? rgb(b) : b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// The colour under a piece of text, worst case, for one blob of the field at full strength:
// the base, the blob at its centre alpha, and for glass the backdrop filter (saturate and
// brightness) and then the least tint that ever sits under text.
export function composite(pal, blob, surface) {
  let c = over(rgb(pal.base), rgb(blob.c), blob.a);
  const onField = ['field', 'display', 'clear'].includes(surface);
  if (onField) c = over(c, rgb(pal.scrim.c), pal.scrim.a);
  if (surface === 'field' || surface === 'display') return c;
  const g = pal.glass[surface];
  c = brighten(saturate(c, g.saturate), g.bright);
  return over(c, rgb(g.tint ?? pal.glass.tint), g.floor);
}
