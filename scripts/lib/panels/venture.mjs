// Venture plate: one per entry in profile.ventures. Name and role on the left, the product's
// own line on the right, and the three position lights an aircraft flies with. The plate
// grows to fit its entry, so adding a venture to profile.json needs no code change.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, panelBase, panelFrame } from '../svg.mjs';
import { measure, wrap } from '../text.mjs';

const W = 880;
const LEFT = 48;
const SPLIT = 316; // the plate seam
const RIGHT_X = 344;
const RIGHT = 844;
const TOP = 59; // capital top shared by the name and the first line on the right
const LH = 38; // line height on the right
const ROLE_LH = 36;
const GAP = 10; // between the tagline and the description
const cap = (size) => size * 0.7; // Overpass and Overpass Mono capitals are 700/1000

// One line at full size when it fits the left column, otherwise two lines at the largest
// size that fits.
function fitName(name) {
  const width = SPLIT - LEFT - 24;
  if (measure(fonts.display, name, type.ventureName) <= width) return { lines: [name], size: type.ventureName };
  const words = name.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const wide = Math.max(...pair.map((l) => measure(fonts.display, l, 1)));
    if (!best || wide < best.wide) best = { pair, wide };
  }
  const size = best ? Math.min(type.ventureName, Math.floor(width / best.wide)) : 0;
  if (size < 32) throw new Error(`venture: name "${name}" does not fit the plate`);
  return { lines: best.pair, size };
}

export function venture(v, theme) {
  const pal = palettes[theme];
  const rightW = RIGHT - RIGHT_X;
  const tag = wrap(fonts.mono, v.tagline, type.ventureLine, rightW);
  const desc = wrap(fonts.mono, v.line, type.ventureLine, rightW);
  const role = wrap(fonts.mono, v.role, type.ventureLine, SPLIT - LEFT - 24);
  const name = fitName(v.name);

  const tagYs = tag.map((_, i) => TOP + cap(type.ventureLine) + i * LH);
  const descYs = desc.map((_, i) => tagYs[tagYs.length - 1] + LH + GAP + i * LH);
  const nameYs = name.lines.map((_, i) => TOP + cap(name.size) + i * name.size * 1.05);
  const leftNeeds = nameYs[nameYs.length - 1] + 18 + cap(type.ventureLine) + (role.length - 1) * ROLE_LH;
  const lastY = Math.max(descYs[descYs.length - 1], leftNeeds);
  const roleYs = role.map((_, i) => lastY - (role.length - 1 - i) * ROLE_LH);
  const H = Math.ceil(lastY + 30);

  const doc = new Doc({ w: W, h: H, pal, title: v.name, desc: v.alt });
  panelBase(doc, { bg: 'deck' });
  const run = (font, str, x, y, size) => doc.text(font, str, { x, y, size }).markup;

  doc.add(
    el('path', { d: `M${SPLIT} ${TOP - 4}V${lastY + 8}`, stroke: pal.traceLit, 'stroke-opacity': 0.7, fill: 'none' }),
    el(
      'g',
      { fill: pal.ink },
      name.lines.map((l, i) => run(fonts.display, l, LEFT, nameYs[i], name.size)).join('') +
        tag.map((l, i) => run(fonts.mono, l, RIGHT_X, tagYs[i], type.ventureLine)).join(''),
    ),
    el(
      'g',
      { fill: pal.dim },
      role.map((l, i) => run(fonts.mono, l, LEFT, roleYs[i], type.ventureLine)).join('') +
        desc.map((l, i) => run(fonts.mono, l, RIGHT_X, descYs[i], type.ventureLine)).join(''),
    ),
  );

  // domain, top right, with port (red), starboard (green) and strobe (white) lights
  const dom = doc.text(fonts.mono, v.domain, { x: RIGHT, y: 38, size: type.label, anchor: 'end' });
  const lights = [pal.beacon, pal.green, pal.led];
  doc.add(
    el('g', { fill: pal.sodium }, dom.markup),
    ...lights.map((fill, i) => el('circle', { cx: dom.x - 16 - (lights.length - 1 - i) * 14, cy: 31, r: 3.5, fill })),
  );
  panelFrame(doc);
  return doc.render();
}
