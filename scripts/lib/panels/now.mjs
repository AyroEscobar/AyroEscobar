// Now: three glass tiles side by side over one light field, one per thing he is doing right
// now. Each tile opens with a hairline chip (a short accent line entering from the tile's edge
// and the word "now" in the italic serif) facing the start date, then the org and the role.
// Tiles are as wide as their content needs, with the room left over shared equally. The date
// of the board sits on the field under the tiles.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { field, drawField, glass, panelEdge } from '../glass.mjs';
import { measure, wrap } from '../text.mjs';
import { MONTHS, monthShort } from '../dates.mjs';

const W = 880;
const GAP = 12;
const TILE_H = 214;
const CHIP_Y = 52; // baseline of the chip word, from the tile top
const ORG_Y = 116;
const ROLE_Y = 156;
const ROLE_LH = 34;

export function nowAlt(profile) {
  const [y, m] = profile.asOf.split('-').map(Number);
  return `Now: ${profile.now.map((n) => `${n.say}.`).join(' ')} As of ${MONTHS[m - 1]} ${y}.`;
}

// The narrowest a role can be set in at most two lines.
function roleWidth(role) {
  const words = role.split(' ');
  const m = (s) => measure(fonts.text, s, type.label);
  let best = m(role);
  for (let i = 1; i < words.length; i++) best = Math.min(best, Math.max(m(words.slice(0, i).join(' ')), m(words.slice(i).join(' '))));
  return best;
}

// Each tile gets what its content needs, and the room left over is shared equally.
function tileWidths(rows, room) {
  const need = rows.map((r) => {
    const chip = measure(fonts.display, 'now', type.rowRole) + 24 + measure(fonts.text, r.since, type.label);
    return Math.max(chip, measure(fonts.sans, r.org, type.cardTitle), roleWidth(r.role)) + 2 * frame.pad + 2;
  });
  const spare = room - need.reduce((a, b) => a + b, 0);
  if (spare < 0) throw new Error('now: the tiles do not fit the panel');
  return need.map((w) => w + spare / rows.length);
}

export function now(profile, theme) {
  const pal = palettes[theme];
  const n = profile.now.length;
  const x0 = frame.inset;
  const widths = tileWidths(profile.now, W - 2 * x0 - (n - 1) * GAP);
  const H = x0 + TILE_H + 56;
  const doc = new Doc({ w: W, h: H, pal, title: 'Now', desc: nowAlt(profile) });

  const [yr, mo] = profile.asOf.split('-').map(Number);
  const stamp = doc.text(fonts.text, `as of ${monthShort(mo)} ${yr}`, { x: W - x0 - 8, y: H - 22, size: type.label, anchor: 'end' });
  field(doc, {
    w: W,
    h: H,
    theme,
    pools: [{ x: stamp.x - 50, y: H - 70, w: stamp.width + 100, h: 70 }],
    blobs: [
      { c: 'peach', x: 110, y: 70, r: 270 },
      { c: 'butter', x: 430, y: 250, r: 250 },
      { c: 'sky', x: 790, y: 70, r: 290 },
      { c: 'lilac', x: 640, y: 300, r: 220 },
      { c: 'rose', x: 250, y: 290, r: 190, k: 0.8 },
    ],
  });
  doc.add(drawField(doc, { w: W, h: H, r: frame.radius }));

  const ink = [];
  const ink2 = [];
  const ink3 = [];
  const accent = [];
  let x = x0;
  profile.now.forEach((row, i) => {
    const tileW = widths[i];
    const max = tileW - 2 * frame.pad;
    const y = x0;
    const roleLines = wrap(fonts.text, row.role, type.label, max);
    if (roleLines.length > 2) throw new Error(`now: "${row.role}" needs more than two lines`);
    const g = glass(doc, {
      id: `t${i}`, x, y, w: tileW, h: TILE_H, r: frame.inner, kind: 'sheet', theme,
      scrims: [{ x: x + 8, y: y + 20, w: tileW - 16, h: TILE_H - 40 }],
    });
    doc.add(g.markup);

    // the chip: a short accent line entering from the tile's left edge, then the word
    const chip = doc.text(fonts.display, 'now', { x: x + frame.pad, y: y + CHIP_Y, size: type.rowRole });
    doc.add(el('path', { d: `M${x} ${y + CHIP_Y - 8}h${frame.pad - 8}`, stroke: pal.accent, 'stroke-width': 2.5, 'stroke-linecap': 'round', fill: 'none' }));
    accent.push(chip.markup);
    // the start date faces the chip across the tile: "now ... may 2026"
    const since = doc.text(fonts.text, row.since, { x: x + tileW - frame.pad, y: y + CHIP_Y, size: type.label, anchor: 'end' });
    if (chip.end + 24 > since.x) throw new Error(`now: the chip and "${row.since}" collide`);
    ink3.push(since.markup);

    const org = doc.text(fonts.sans, row.org, { x: x + frame.pad, y: y + ORG_Y, size: type.cardTitle, tracking: -0.01 });
    if (org.width > max) throw new Error(`now: ${row.org} is too wide for a tile`);
    ink.push(org.markup);
    roleLines.forEach((l, k) => ink2.push(doc.text(fonts.text, l, { x: x + frame.pad, y: y + ROLE_Y + k * ROLE_LH, size: type.label }).markup));
    x += tileW + GAP;
  });

  doc.add(
    el('g', { fill: pal.ink }, ink.join('')),
    el('g', { fill: pal.ink2 }, ink2.join('') + stamp.markup),
    el('g', { fill: pal.ink3 }, ink3.join('')),
    el('g', { fill: pal.accent }, accent.join('')),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
