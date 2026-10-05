// Project card: a glass tile with the title, one line in the italic serif and the meta line.
// The six cards are windows onto one light field: each card draws its own part of a field laid
// out under the whole two-by-three grid, so side by side in the README they read as one
// surface seen through six panes.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el, fmt } from '../svg.mjs';
import { field, drawField, glass, panelEdge } from '../glass.mjs';

const W = 430;
const H = 220;
const GUTTER = 12; // each card carries half the gap between two cards, as transparent space
const ROW = H + 6; // a row of cards in the README, image plus the line gap under it
const TEXT_X = 40;
const RIGHT = W - 36;

// The field under the whole grid, in grid coordinates (884 wide, three rows).
const GRID_FIELD = [
  { c: 'peach', x: 110, y: 70, r: 300 },
  { c: 'butter', x: 520, y: 30, r: 270 },
  { c: 'sky', x: 860, y: 230, r: 320 },
  { c: 'lilac', x: 330, y: 380, r: 300 },
  { c: 'rose', x: 700, y: 520, r: 280 },
  { c: 'mint', x: 70, y: 600, r: 240, k: 0.85 },
  { c: 'butter', x: 430, y: 690, r: 220, k: 0.7 },
];

const curly = (s) => s.replace(/(\w)'(\w)/g, '$1’$2');

// index: the card's place in profile.projects (two per row, left then right)
export function card(p, theme, index) {
  const pal = palettes[theme];
  const side = index % 2 ? 'right' : 'left';
  const ox = side === 'right' ? GUTTER : 0;
  const doc = new Doc({ w: W, h: H, pal, title: p.title, desc: p.alt, vw: W + GUTTER, ox });

  // where this card's panel sits in the grid
  const gx = side === 'right' ? W + 2 * GUTTER : 0;
  const gy = Math.floor(index / 2) * ROW;
  field(doc, { w: W, h: H, theme, blobs: GRID_FIELD, dx: -gx, dy: -gy });
  doc.add(drawField(doc, { w: W, h: H, r: frame.radius }));

  const i = frame.inset;
  const title = doc.text(fonts.sans, p.title, { x: TEXT_X, y: 78, size: type.cardTitle, tracking: -0.01 });
  const tag = doc.text(fonts.display, curly(p.tagline), { x: TEXT_X, y: 128, size: type.cardLine });
  const meta = doc.text(fonts.text, p.meta, { x: TEXT_X, y: 180, size: type.cardMeta });
  for (const [what, run, limit] of [['title', title, RIGHT], ['tagline', tag, RIGHT], ['meta', meta, RIGHT - 40]]) {
    if (run.end > limit) throw new Error(`card ${p.slug}: ${what} is too wide (${Math.round(run.end)} > ${limit})`);
  }
  const sheet = glass(doc, {
    id: 's', x: i, y: i, w: W - 2 * i, h: H - 2 * i, r: frame.inner, kind: 'sheet', theme,
    scrims: [{ x: TEXT_X - 18, y: 34, w: Math.max(title.end, tag.end, meta.end) - TEXT_X + 36, h: 166 }],
  });

  // a small arrow on the meta line, bottom right: the card is a link
  const ax = RIGHT - 6;
  const ay = 180 - 10;
  const arrow = `M${fmt(ax - 7)} ${fmt(ay + 7)}L${fmt(ax + 7)} ${fmt(ay - 7)}M${fmt(ax - 4)} ${fmt(ay - 7)}H${fmt(ax + 7)}V${fmt(ay + 4)}`;

  doc.add(
    sheet.markup,
    el('g', { fill: pal.ink }, title.markup + tag.markup),
    el('g', { fill: pal.ink3 }, meta.markup),
    el('path', { d: arrow, stroke: pal.ink3, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
