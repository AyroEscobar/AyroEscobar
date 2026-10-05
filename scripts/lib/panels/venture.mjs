// Venture card: one per entry in profile.ventures (Esvo Technologies, then Viaere), the two
// "check out" cards. The night slope with the glass boulder on the right, its left edge behind
// a sheet of thick glass, so the neon bends through the frosted edge; the copy sits on the
// void scrim inside the sheet: his title as the eyebrow, the name, the company's own headline, the
// first line of its own description, and its domain. The card grows to fit its entry.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { world, drawWorld, glass, panelEdge } from '../glass.mjs';
import { measure, wrap } from '../text.mjs';

const W = 880;
const LEFT = 60;
const TEXT_W = 560; // the copy column; the rock owns the rest
const EYEBROW_TRACK = 0.08;

export function venture(v, theme, index) {
  const pal = palettes[theme];
  const eyebrow = v.role.toUpperCase();
  const eyebrowW = measure(fonts.sans, eyebrow, type.eyebrow, EYEBROW_TRACK);
  const nameW = measure(fonts.display, v.name, type.cardName, -0.02);
  if (nameW > TEXT_W) throw new Error(`venture: ${v.name} does not fit the copy column`);
  const tag = wrap(fonts.sans, v.tagline, type.cardTag, TEXT_W, -0.01);
  const blurb = wrap(fonts.text, v.blurb, type.cardBlurb, TEXT_W);
  const domain = `${v.domain} ↗`;

  const eyebrowY = 92;
  const nameY = eyebrowY + 74;
  const tagYs = tag.map((_, k) => nameY + 62 + k * 48);
  const blurbYs = blurb.map((_, k) => tagYs[tagYs.length - 1] + 56 + k * 42);
  const domainY = blurbYs[blurbYs.length - 1] + 60;
  const H = Math.ceil(domainY + 56);
  const doc = new Doc({ w: W, h: H, pal, title: v.name, desc: v.alt });

  const i = frame.inset;
  const scrimW = Math.max(TEXT_W, eyebrowW, nameW) + 2 * (LEFT - i - 12);
  const sheetW = scrimW + 24;
  // the rock sits in the open world right of the sheet, its left edge behind the glass
  const rockR = Math.min(132, H * 0.36);
  const rock = { x: W - 26 - rockR, y: H * 0.5, r: rockR, tilt: index % 2 ? -8 : -16 };
  world(doc, {
    w: W, h: H, theme,
    horizon: H * 0.46,
    ridge: { base: H * 0.44, amp: 20, seed: index + 3 },
    slope: { y0: H * 1.02, y1: H * 0.6 },
    rock,
    contours: 4,
    seed: index + 1,
  });
  doc.add(drawWorld(doc, { w: W, h: H, r: frame.radius }));
  const sheet = glass(doc, {
    id: 's', x: i, y: i, w: sheetW, h: H - 2 * i, r: frame.inner, theme,
    scrims: [{ x: i + 12, y: i + 12, w: scrimW, h: H - 2 * i - 24, r: 12 }],
    light: rock,
  });
  doc.add(sheet.markup);

  const run = (font, str, y, size, opts = {}) => doc.text(font, str, { x: LEFT, y, size, ...opts }).markup;
  doc.add(
    el('g', { fill: pal.accent },
      run(fonts.sans, eyebrow, eyebrowY, type.eyebrow, { tracking: EYEBROW_TRACK }) +
        run(fonts.sans, domain, domainY, type.domain)),
    el('g', { fill: pal.ink },
      run(fonts.display, v.name, nameY, type.cardName, { tracking: -0.02 }) +
        tag.map((l, k) => run(fonts.sans, l, tagYs[k], type.cardTag, { tracking: -0.01 })).join('')),
    el('g', { fill: pal.ink2 }, blurb.map((l, k) => run(fonts.text, l, blurbYs[k], type.cardBlurb)).join('')),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
