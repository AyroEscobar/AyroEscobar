// Outlined type: glyph atlases, measurement with kerning, line wrapping, and placement.
// Each glyph a document uses is defined once as a <path> in <defs> and placed with <use>,
// so text renders the same on every OS with no font file and no @font-face.
import { readFileSync } from 'node:fs';

const atlases = new Map();
const PREFIX = { 'overpass-900': 'o', 'overpass-mono-500': 'm' };

export function atlas(font) {
  if (!atlases.has(font)) {
    if (!PREFIX[font]) throw new Error(`unknown font ${font}`);
    const url = new URL(`../fonts/${font}.json`, import.meta.url);
    atlases.set(font, JSON.parse(readFileSync(url, 'utf8')));
  }
  return atlases.get(font);
}

function glyph(a, ch, str) {
  const g = a.glyphs[ch];
  if (!g) {
    const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    throw new Error(`no glyph for U+${cp} in ${a.family} (text: ${JSON.stringify(str)})`);
  }
  return g;
}

// Pen positions in font units (1000 per em) for each character.
export function layout(font, str, tracking = 0) {
  const a = atlas(font);
  const chars = [...str];
  const out = [];
  let x = 0;
  chars.forEach((ch, i) => {
    const g = glyph(a, ch, str);
    out.push({ ch, x });
    x += g.adv;
    if (i < chars.length - 1) x += (a.kern[ch]?.[chars[i + 1]] ?? 0) + tracking * 1000;
  });
  return { pens: out, width: x };
}

export function measure(font, str, size, tracking = 0) {
  return (layout(font, str, tracking).width * size) / 1000;
}

// Greedy word wrap to a width in SVG units.
export function wrap(font, str, size, maxWidth, tracking = 0) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(font, next, size, tracking) > maxWidth) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  // Two lines: the most even break that still leaves the first line the longer one, so no
  // word is left alone and the rag stays top heavy.
  if (lines.length === 2) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const [a, b] = pair.map((l) => measure(font, l, size, tracking));
      if (a <= maxWidth && a >= b && (!best || a < best.wide)) best = { pair, wide: a };
    }
    if (best) lines.splice(0, 2, ...best.pair);
  }
  for (const l of lines) {
    if (measure(font, l, size, tracking) > maxWidth) throw new Error(`cannot fit "${l}" in ${maxWidth}`);
  }
  return lines;
}

export class GlyphSet {
  constructor() {
    this.used = new Map();
  }

  ref(font, ch) {
    const id = PREFIX[font] + ch.codePointAt(0).toString(16);
    if (!this.used.has(id)) this.used.set(id, atlas(font).glyphs[ch].d);
    return id;
  }

  defs() {
    return [...this.used.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .filter(([, d]) => d)
      .map(([id, d]) => `<path id="${id}" d="${d}"/>`)
      .join('');
  }
}

const num = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return String(r === 0 ? 0 : r).replace(/^(-?)0\./, '$1.');
};

// A run of outlined text. anchor: start | middle | end. Returns a <g> with no fill, so the
// caller decides colour (and can reuse the run, for example as a halo in a mask).
export function textRun(glyphs, font, str, { x, y, size, tracking = 0, anchor = 'start', id = null, attrs = '' }) {
  const { pens, width } = layout(font, str, tracking);
  const s = size / 1000;
  const w = width * s;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const uses = pens
    .filter((p) => atlas(font).glyphs[p.ch].d)
    .map((p) => `<use href="#${glyphs.ref(font, p.ch)}"${p.x ? ` x="${Math.round(p.x)}"` : ''}/>`)
    .join('');
  const idAttr = id ? ` id="${id}"` : '';
  return {
    markup: `<g${idAttr} transform="translate(${num(x0)} ${num(y)}) scale(${num(s)})"${attrs}>${uses}</g>`,
    x: x0,
    width: w,
    end: x0 + w,
  };
}
