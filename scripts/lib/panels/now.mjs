// Now board: an LED message sign, the kind that hangs over a highway. The unlit matrix is one
// <rect> filled with a <pattern>; every lit dot is one arc in a single <path>.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, panelBase, panelFrame } from '../svg.mjs';
import { CELL_W, CELL_H, litDots, dotsPath } from '../dotmatrix.mjs';

const W = 880;
const H = 280;
const PITCH = 7;
const R = 2.6;
const COLS = 115; // 19 characters plus a one-dot margin each side
const ROW_GAP = 2; // dark rows between lines of text
const ROLE_COL = 9; // the role column starts at the tenth character cell
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function nowAlt(profile) {
  const [y, m] = profile.asOf.split('-').map(Number);
  const items = profile.now.map((n) => `${n.say}.`).join(' ');
  return `Now board: ${items} As of ${MONTHS[m - 1]} ${y}.`;
}

export function now(profile, theme) {
  const pal = palettes[theme];
  const doc = new Doc({ w: W, h: H, pal, title: 'Now board', desc: nowAlt(profile) });

  const lines = profile.now.map((n) => {
    if (n.org.length >= ROLE_COL) throw new Error(`now board: ${n.org} is longer than the org column`);
    return n.org.padEnd(ROLE_COL, ' ') + n.role;
  });
  const maxChars = Math.floor((COLS - 2 + 1) / (CELL_W + 1));
  for (const l of lines) if (l.length > maxChars) throw new Error(`now board: "${l}" is longer than ${maxChars} cells`);

  const rows = 1 + lines.length * CELL_H + (lines.length - 1) * ROW_GAP + 1;
  const faceW = COLS * PITCH;
  const faceH = rows * PITCH;
  const faceX = (W - faceW) / 2;
  const faceY = 60;
  const pad = 10;
  const housing = { x: faceX - pad, y: faceY - pad, width: faceW + 2 * pad, height: faceH + 2 * pad };
  if (housing.y + housing.height > H - 18) throw new Error('now board: housing does not fit');

  const dots = lines.flatMap((l, k) => litDots(l, 1, 1 + k * (CELL_H + ROW_GAP)));
  const d = dotsPath(dots, { x0: faceX + PITCH / 2, y0: faceY + PITCH / 2, pitch: PITCH, r: R });

  doc.defs.push(
    el(
      'pattern',
      { id: 'mx', width: PITCH, height: PITCH, patternUnits: 'userSpaceOnUse', x: faceX, y: faceY },
      el('circle', { cx: PITCH / 2, cy: PITCH / 2, r: R, fill: pal.trace }),
    ),
    el('path', { id: 'ld', d }),
  );

  const asOf = profile.asOf.slice(0, 7);
  const label = doc.text(fonts.mono, 'now board', { x: 48, y: 40, size: type.label });
  const stamp = doc.text(fonts.mono, `as of ${asOf}`, { x: W - 48, y: 40, size: type.label, anchor: 'end' });

  panelBase(doc);
  doc.add(
    el('g', { fill: pal.dim }, label.markup + stamp.markup),
    el('rect', { ...housing, rx: 10, fill: pal.deck, stroke: pal.traceLit, 'stroke-opacity': 0.5 }),
    // four mounting bolts, the way a sign is hung
    el(
      'g',
      { fill: pal.traceLit },
      [
        [housing.x + 5, housing.y + 5],
        [housing.x + housing.width - 5, housing.y + 5],
        [housing.x + 5, housing.y + housing.height - 5],
        [housing.x + housing.width - 5, housing.y + housing.height - 5],
      ]
        .map(([cx, cy]) => el('circle', { cx, cy, r: 1.6 }))
        .join(''),
    ),
    el('rect', { x: faceX, y: faceY, width: faceW, height: faceH, fill: 'url(#mx)' }),
    el('use', { href: '#ld', fill: pal.led, stroke: pal.led, 'stroke-width': 3.4, 'stroke-opacity': 0.22 }),
    el('use', { href: '#ld', fill: pal.led }),
  );
  panelFrame(doc);
  return doc.render();
}
