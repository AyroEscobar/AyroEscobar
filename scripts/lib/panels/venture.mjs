// Venture plate: one per entry in profile.ventures. The name with the role beside it, a seam,
// then the product's own words at full width, and the position lights an aircraft flies with.
// The plate grows to fit its entry, so adding a venture to profile.json needs no code change.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, panelBase, panelFrame } from '../svg.mjs';
import { measure, wrap } from '../text.mjs';

const W = 880;
const LEFT = 48;
const RIGHT = 844;
const NAME_Y = 104; // name baseline; the role sits on it when there is room
const LH = 44; // line height for the 36-unit lines
const GAP = 8; // between the tagline and the description
const cap = (size) => size * 0.7; // Overpass and Overpass Mono capitals are 700/1000

export function venture(v, theme) {
  const pal = palettes[theme];
  const width = RIGHT - LEFT;
  const nameSize = Math.min(type.ventureName, Math.floor(width / measure(fonts.display, v.name, 1)));
  if (nameSize < 40) throw new Error(`venture: name "${v.name}" does not fit the plate`);
  const nameW = measure(fonts.display, v.name, nameSize);
  // the role rides on the name's baseline when it fits beside it, otherwise it drops under it
  const besideX = LEFT + nameW + 28;
  const beside = besideX + measure(fonts.mono, v.role, type.ventureLine) <= RIGHT;
  const roleLines = beside ? [v.role] : wrap(fonts.mono, v.role, type.ventureLine, width);
  const roleYs = roleLines.map((_, i) => (beside ? NAME_Y : NAME_Y + LH + i * LH));
  const seamY = roleYs[roleYs.length - 1] + 24;
  const tag = wrap(fonts.mono, v.tagline, type.ventureLine, width);
  const desc = wrap(fonts.mono, v.line, type.ventureLine, width);
  const tagYs = tag.map((_, i) => seamY + 24 + cap(type.ventureLine) + i * LH);
  const descYs = desc.map((_, i) => tagYs[tagYs.length - 1] + LH + GAP + i * LH);
  const H = Math.ceil(descYs[descYs.length - 1] + 30);

  const doc = new Doc({ w: W, h: H, pal, title: v.name, desc: v.alt });
  panelBase(doc, { bg: 'deck' });
  const run = (font, str, x, y, size) => doc.text(font, str, { x, y, size }).markup;

  doc.add(
    el('path', { d: `M${LEFT} ${seamY}H${RIGHT}`, stroke: pal.traceLit, 'stroke-opacity': 0.7, fill: 'none' }),
    el(
      'g',
      { fill: pal.ink },
      run(fonts.display, v.name, LEFT, NAME_Y, nameSize) + tag.map((l, i) => run(fonts.mono, l, LEFT, tagYs[i], type.ventureLine)).join(''),
    ),
    el(
      'g',
      { fill: pal.dim },
      roleLines.map((l, i) => run(fonts.mono, l, beside ? besideX : LEFT, roleYs[i], type.ventureLine)).join('') +
        desc.map((l, i) => run(fonts.mono, l, LEFT, descYs[i], type.ventureLine)).join(''),
    ),
  );

  // domain, top right, with port (red), starboard (green) and strobe (white) lights
  const dom = doc.text(fonts.mono, v.domain, { x: RIGHT, y: 40, size: type.label, anchor: 'end' });
  const lights = [pal.beacon, pal.green, pal.led];
  doc.add(
    el('g', { fill: pal.sodium }, dom.markup),
    ...lights.map((fill, i) => el('circle', { cx: dom.x - 16 - (lights.length - 1 - i) * 14, cy: 33, r: 3.5, fill })),
  );
  panelFrame(doc);
  return doc.render();
}
