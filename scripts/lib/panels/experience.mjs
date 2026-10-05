// Experience: the five roles from profile.experience, newest first, as a route up the slope. A
// hairline climbs the left edge with one bead per role (lit cyan where the role is current,
// hollow where it is done); each row carries the org, the dates and the role. One sheet of
// thick glass over the night slope, the copy on the void scrim.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { world, drawWorld, glass, panelEdge } from '../glass.mjs';

const W = 880;
const BEAD_X = 64;
const LEFT = 100;
const RIGHT = 820;
const TOP = 88;
const PITCH = 98;

export function experience(exp, theme) {
  const pal = palettes[theme];
  const rows = exp.lines;
  const last = TOP + (rows.length - 1) * PITCH;
  const H = last + 38 + 52;
  const doc = new Doc({ w: W, h: H, pal, title: 'Experience', desc: exp.alt });

  const rock = { x: W - 70, y: -40, r: 150, tilt: -12 }; // above the frame: only its light reaches in
  world(doc, {
    w: W, h: H, theme,
    horizon: H * 0.3,
    ridge: { base: H * 0.3, amp: 26, seed: 11 },
    slope: { y0: H * 0.9, y1: H * 0.36 },
    rock,
    contours: 6,
    seed: 5,
  });
  doc.add(drawWorld(doc, { w: W, h: H, r: frame.radius }));
  const i = frame.inset;
  doc.add(glass(doc, {
    id: 's', x: i, y: i, w: W - 2 * i, h: H - 2 * i, r: frame.inner, theme,
    scrims: [{ x: i, y: i, w: W - 2 * i, h: H - 2 * i, r: frame.inner }],
    light: rock,
  }).markup);

  // the route: a hairline through the beads, then the beads
  const beadY = (k) => TOP + k * PITCH - 11;
  doc.add(el('path', { d: `M${BEAD_X} ${beadY(0)}V${beadY(rows.length - 1)}`, stroke: pal.ink3, 'stroke-opacity': 0.55, 'stroke-width': 1.5, fill: 'none' }));
  doc.shared('bead-glow', el('filter', { id: 'bead-glow', x: '-100%', y: '-100%', width: '300%', height: '300%' }, el('feGaussianBlur', { stdDeviation: 4 })));
  rows.forEach((row, k) => {
    const y = beadY(k);
    doc.add(row.now
      ? el('circle', { cx: BEAD_X, cy: y, r: 10, fill: pal.accent, 'fill-opacity': 0.55, filter: 'url(#bead-glow)' }) +
          el('circle', { cx: BEAD_X, cy: y, r: 7, fill: pal.accent }) +
          el('circle', { cx: BEAD_X - 2, cy: y - 2, r: 2.2, fill: '#FFFFFF', 'fill-opacity': 0.85 })
      : el('circle', { cx: BEAD_X, cy: y, r: 7, fill: pal.void, stroke: pal.ink3, 'stroke-width': 2 }));
  });

  const orgs = [];
  const dates = [];
  const past = [];
  const roles = [];
  rows.forEach((row, k) => {
    const y = TOP + k * PITCH;
    const org = doc.text(fonts.sans, row.org, { x: LEFT, y, size: type.rowOrg, tracking: -0.01 });
    const date = doc.text(fonts.text, row.date, { x: RIGHT, y, size: type.rowLine, anchor: 'end' });
    if (org.end > date.x - 24) throw new Error(`experience: ${row.org} runs into its dates`);
    const role = doc.text(fonts.text, row.role, { x: LEFT, y: y + 38, size: type.rowLine });
    if (role.end > RIGHT) throw new Error(`experience: ${row.role} is too wide`);
    orgs.push(org.markup);
    (row.now ? dates : past).push(date.markup);
    roles.push(role.markup);
  });
  doc.add(
    el('g', { fill: pal.ink }, orgs.join('')),
    el('g', { fill: pal.accent }, dates.join('')),
    el('g', { fill: pal.ink3 }, past.join('')),
    el('g', { fill: pal.ink2 }, roles.join('')),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
