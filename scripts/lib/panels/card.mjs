// Project card: a raised plate that is also a stop. A short route stub drops in from the top
// edge to a sodium station dot, the title sits beside the stop, two lines hang below it.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, panelBase, panelFrame } from '../svg.mjs';

const W = 430;
const H = 172;
const STOP_X = 30;
const TITLE_X = 50;
const TEXT_X = 22;
const RIGHT = W - 18;
const GUTTER = 12; // each card carries half the gap between two cards, as transparent space

// side: 'left' or 'right', the column the card sits in, so the pair lines up with the
// full-width panels above and below it.
export function card(p, theme, side) {
  const pal = palettes[theme];
  const doc = new Doc({ w: W, h: H, pal, title: p.title, desc: p.alt, vw: W + GUTTER, ox: side === 'right' ? GUTTER : 0 });
  panelBase(doc, { bg: 'deck' });

  const titleY = 52;
  const stopY = titleY - (type.cardTitle * 0.511) / 2; // centre of the lowercase letters
  const title = doc.text(fonts.display, p.title, { x: TITLE_X, y: titleY, size: type.cardTitle });
  const tag = doc.text(fonts.mono, p.tagline, { x: TEXT_X, y: 102, size: type.cardLine });
  const meta = doc.text(fonts.mono, p.meta, { x: TEXT_X, y: 146, size: type.cardLine });
  for (const [what, run] of [['title', title], ['tagline', tag], ['meta', meta]]) {
    if (run.end > RIGHT) throw new Error(`card ${p.slug}: ${what} is too wide (${Math.round(run.end)} > ${RIGHT})`);
  }

  doc.add(
    el('path', { d: `M${STOP_X} 0V${stopY - 6}`, stroke: pal.traceLit, 'stroke-width': 3, fill: 'none' }),
    el('circle', { cx: STOP_X, cy: stopY, r: 9.5, fill: pal.deck }),
    el('circle', { cx: STOP_X, cy: stopY, r: 6.5, fill: pal.sodiumStroke }),
    el('g', { fill: pal.ink }, title.markup + tag.markup),
    el('g', { fill: pal.dim }, meta.markup),
  );
  panelFrame(doc);
  return doc.render();
}
