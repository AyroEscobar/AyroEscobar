// Venture plate: one per entry in profile.ventures. A glass sheet with the name, the role, the
// product's own words and its domain. Under the glass sit three status lamps in viaere.com's
// own words (green, amber, red); their light is part of the field, so the glass diffuses it,
// and each lamp keeps a crisp bead on top so it reads at phone size. A fourth lamp is drawn dim,
// unlabeled and set apart (the fourth tier is not named publicly). The plate grows to fit its
// entry, so adding a venture to profile.json needs no code change.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { field, drawField, glass, panelEdge } from '../glass.mjs';
import { measure, wrap } from '../text.mjs';

const W = 880;
const LEFT = 56;
const RIGHT = 824;
const NAME_Y = 100;
const LAMPS = ['green', 'amber', 'red'];
const curly = (s) => s.replace(/(\w)'(\w)/g, '$1’$2');

export function venture(v, theme) {
  const pal = palettes[theme];
  const width = RIGHT - LEFT;
  const nameW = measure(fonts.sans, v.name, type.ventureName);
  const besideX = LEFT + nameW + 26;
  const domain = measure(fonts.text, v.domain, type.label);
  const beside = besideX + measure(fonts.text, v.role, type.ventureLine) <= RIGHT - domain - 32;
  const roleLines = beside ? [v.role] : wrap(fonts.text, v.role, type.ventureLine, width);
  const roleYs = roleLines.map((_, i) => (beside ? NAME_Y : NAME_Y + 42 + i * 40));
  const tag = wrap(fonts.display, curly(v.tagline), type.ventureTag, width);
  const tagYs = tag.map((_, i) => roleYs[roleYs.length - 1] + 64 + i * 46);
  const desc = wrap(fonts.text, v.line, type.ventureLine, width);
  const descYs = desc.map((_, i) => tagYs[tagYs.length - 1] + 46 + i * 40);
  const lampY = descYs[descYs.length - 1] + 62; // lamp centres
  const H = Math.ceil(lampY + 36 + frame.inset + 8);
  const doc = new Doc({ w: W, h: H, pal, title: v.name, desc: v.alt });

  // the lamp row: bead, label, bead, label, bead, label, then the unnamed fourth set apart
  const lamps = [];
  let x = LEFT + 12;
  for (const name of LAMPS) {
    const label = doc.text(fonts.text, name, { x: x + 24, y: lampY + 10, size: type.label });
    lamps.push({ name, cx: x, label });
    x = label.end + 44;
  }
  const fourth = x + 28;
  if (fourth > RIGHT) throw new Error('venture: the lamp row does not fit');

  const glow = { green: 'mint', amber: 'butter', red: 'rose' };
  field(doc, {
    w: W,
    h: H,
    theme,
    blobs: [
      { c: 'butter', x: 520, y: -20, r: 300, k: 0.8 },
      { c: 'sky', x: 860, y: 120, r: 280 },
      { c: 'peach', x: 80, y: 40, r: 240, k: 0.8 },
      // the lamps' light, under the glass
      ...lamps.map((l) => ({ c: glow[l.name], x: l.cx, y: lampY, r: 150, k: 1.1 })),
    ],
  });
  doc.add(drawField(doc, { w: W, h: H, r: frame.radius }));

  const i = frame.inset;
  const sheet = glass(doc, {
    id: 's', x: i, y: i, w: W - 2 * i, h: H - 2 * i, r: frame.inner, kind: 'sheet', theme,
    scrims: [{ x: LEFT - 20, y: 36, w: width + 40, h: lampY + 24 - 36 }],
  });
  doc.add(sheet.markup);

  const run = (font, str, x0, y, size, opts = {}) => doc.text(font, str, { x: x0, y, size, ...opts }).markup;
  const dom = doc.text(fonts.text, v.domain, { x: RIGHT, y: 66, size: type.label, anchor: 'end' });
  doc.add(
    el('g', { fill: pal.ink },
      run(fonts.sans, v.name, LEFT, NAME_Y, type.ventureName, { tracking: -0.015 }) +
        tag.map((l, k) => run(fonts.display, l, LEFT, tagYs[k], type.ventureTag)).join('')),
    el('g', { fill: pal.ink2 },
      roleLines.map((l, k) => run(fonts.text, l, beside ? besideX : LEFT, roleYs[k], type.ventureLine)).join('') +
        desc.map((l, k) => run(fonts.text, l, LEFT, descYs[k], type.ventureLine)).join('') +
        lamps.map((l) => l.label.markup).join('')),
    el('g', { fill: pal.accent }, dom.markup),
  );

  // crisp beads on the glass: a lit core with a bright rim and a pinpoint highlight
  for (const l of lamps) {
    const c = pal.lamp[l.name];
    doc.add(
      el('circle', { cx: l.cx, cy: lampY, r: 13, fill: c, 'fill-opacity': 0.22 }),
      el('circle', { cx: l.cx, cy: lampY, r: 8.5, fill: c }),
      el('circle', { cx: l.cx - 2.6, cy: lampY - 2.8, r: 2.6, fill: '#fff', 'fill-opacity': 0.75 }),
    );
  }
  doc.add(
    el('circle', { cx: fourth, cy: lampY, r: 8.5, fill: 'none', stroke: pal.lamp.off, 'stroke-width': 2 }),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
