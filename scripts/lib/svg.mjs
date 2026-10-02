// SVG plumbing: deterministic numbers, the document shell, the shared panel frame.
import { frame as F } from './tokens.mjs';
import { GlyphSet, textRun } from './text.mjs';

// Fixed decimal formatting so the same input always yields the same bytes.
export function fmt(n) {
  if (!Number.isFinite(n)) throw new Error(`not a finite number: ${n}`);
  const r = Math.round(n * 100) / 100;
  let s = String(r === 0 ? 0 : r);
  if (s.includes('e')) s = r.toFixed(2);
  return s.replace(/^(-?)0\./, '$1.');
}

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Attribute string from an object, skipping null and undefined, numbers formatted.
export function attrs(o) {
  let s = '';
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === false) continue;
    s += ` ${k}="${typeof v === 'number' ? fmt(v) : esc(v)}"`;
  }
  return s;
}

export const el = (name, o = {}, inner = null) =>
  inner === null ? `<${name}${attrs(o)}/>` : `<${name}${attrs(o)}>${inner}</${name}>`;

// Polyline as a compact path: absolute first point, relative after.
export function polyD(pts, close = false) {
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  let [px, py] = [Math.round(pts[0][0] * 100) / 100, Math.round(pts[0][1] * 100) / 100];
  for (let i = 1; i < pts.length; i++) {
    const x = Math.round(pts[i][0] * 100) / 100;
    const y = Math.round(pts[i][1] * 100) / 100;
    const dx = fmt(x - px);
    const dy = fmt(y - py);
    d += `l${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
    [px, py] = [x, y];
  }
  return close ? d + 'z' : d;
}

// One SVG document. Panels add defs, style and body; glyphs are collected as text is set.
export class Doc {
  // w and h are the panel; vw is the image width when the panel sits in a wider canvas
  // (a card carries its half of the gutter as transparent space), ox is the panel's offset.
  constructor({ w, h, pal, title, desc, vw = w, ox = 0 }) {
    Object.assign(this, { w, h, pal, title, desc, vw, ox });
    this.glyphs = new GlyphSet();
    this.defs = [];
    this.style = '';
    this.body = [];
    this.ids = new Set();
  }

  id(name) {
    if (this.ids.has(name)) throw new Error(`duplicate id ${name}`);
    this.ids.add(name);
    return name;
  }

  add(...parts) {
    this.body.push(...parts);
    return this;
  }

  // Set a line of outlined type. Returns markup; fill is passed through.
  text(font, str, opts) {
    return textRun(this.glyphs, font, str, opts);
  }

  render() {
    const glyphDefs = this.glyphs.defs();
    const defs = glyphDefs + this.defs.join('');
    const body = this.body.join('');
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.vw}" height="${this.h}" viewBox="0 0 ${this.vw} ${this.h}"` +
      ` role="img" aria-labelledby="t d">` +
      `<title id="t">${esc(this.title)}</title><desc id="d">${esc(this.desc)}</desc>` +
      (this.style ? `<style>${this.style}</style>` : '') +
      (defs ? `<defs>${defs}</defs>` : '') +
      (this.ox ? `<g transform="translate(${fmt(this.ox)} 0)">${body}</g>` : body) +
      `</svg>\n`
    );
  }
}

// The shared panel: an opaque rounded screen, a hairline frame, corner ticks.
// ticks: 'all' for the four corners, or a list such as ['tl'].
export function panelBase(doc, { bg = 'night' } = {}) {
  const { w, h, pal } = doc;
  doc.add(el('rect', { width: w, height: h, rx: F.radius, fill: pal[bg] }));
  return doc;
}

export function panelFrame(doc, { ticks = 'all' } = {}) {
  const { w, h, pal } = doc;
  doc.add(
    el('rect', {
      x: 0.5,
      y: 0.5,
      width: w - 1,
      height: h - 1,
      rx: F.radius - 0.5,
      fill: 'none',
      stroke: pal.traceLit,
      'stroke-width': F.hairline,
      'stroke-opacity': F.hairlineOpacity,
    }),
  );
  const i = F.tickInset;
  const t = F.tick;
  const corners = {
    tl: `M${i} ${i + t}V${i}H${i + t}`,
    tr: `M${w - i - t} ${i}H${w - i}V${i + t}`,
    br: `M${w - i} ${h - i - t}V${h - i}H${w - i - t}`,
    bl: `M${i + t} ${h - i}H${i}V${h - i - t}`,
  };
  const which = ticks === 'all' ? Object.keys(corners) : ticks;
  doc.add(
    el('path', {
      d: which.map((k) => corners[k]).join(''),
      fill: 'none',
      stroke: pal.sodiumStroke,
      'stroke-width': 2,
      'stroke-linecap': 'square',
    }),
  );
  return doc;
}
