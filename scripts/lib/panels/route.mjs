// Route: his roles on one glass sheet as a vertical timeline, earliest at the top. A spine runs
// through every stop and fades out past the last one. Current stops are solid accent beads with
// a soft halo and their dates in accent; past stops are hollow. Colour is never the only signal:
// the dates say "to now".
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { field, drawField, glass, panelEdge } from '../glass.mjs';

const W = 880;
const SPINE_X = 84;
const TEXT_X = 120;
const RIGHT = 830;
const TOP = 82; // first org baseline
const STEP = 86;
const ROLE_DY = 35;
const DOT_DY = -11; // org baseline to bead centre

export function routeAlt(profile) {
  return `Route: ${profile.route.map((s) => `${s.say}.`).join(' ')}`;
}

export function route(profile, theme) {
  const pal = palettes[theme];
  const stops = profile.route;
  const lastY = TOP + (stops.length - 1) * STEP;
  const H = lastY + ROLE_DY + 62;
  const doc = new Doc({ w: W, h: H, pal, title: 'Route', desc: routeAlt(profile) });

  field(doc, {
    w: W,
    h: H,
    theme,
    blobs: [
      { c: 'sky', x: 80, y: 90, r: 300 },
      { c: 'lilac', x: 820, y: 60, r: 300 },
      { c: 'peach', x: 660, y: 300, r: 280 },
      { c: 'butter', x: 150, y: 380, r: 260, k: 0.85 },
      { c: 'rose', x: 470, y: H + 20, r: 280 },
    ],
  });
  doc.add(drawField(doc, { w: W, h: H, r: frame.radius }));
  const i = frame.inset;
  doc.add(
    glass(doc, {
      id: 's', x: i, y: i, w: W - 2 * i, h: H - 2 * i, r: frame.inner, kind: 'sheet', theme,
      scrims: [{ x: SPINE_X - 30, y: 30, w: RIGHT - SPINE_X + 50, h: H - 60 }],
    }).markup,
  );

  // the spine: solid through every stop, then fading out, onto what's next
  const firstDot = TOP + DOT_DY;
  const lastDot = lastY + DOT_DY;
  doc.defs.push(
    el('linearGradient', { id: doc.id('fade'), gradientUnits: 'userSpaceOnUse', x1: 0, y1: lastDot, x2: 0, y2: H - 22 },
      el('stop', { offset: 0, 'stop-color': pal.ink3, 'stop-opacity': 0.55 }) + el('stop', { offset: 1, 'stop-color': pal.ink3, 'stop-opacity': 0 })),
  );
  doc.add(
    el('path', { d: `M${SPINE_X} ${firstDot - 26}V${lastDot}`, stroke: pal.ink3, 'stroke-opacity': 0.55, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }),
    el('path', { d: `M${SPINE_X} ${lastDot}V${H - 22}`, stroke: 'url(#fade)', 'stroke-width': 2.5, fill: 'none' }),
  );

  const ink = [];
  const ink2 = [];
  const ink3 = [];
  const accent = [];
  stops.forEach((s, k) => {
    const y = TOP + k * STEP;
    const cy = y + DOT_DY;
    const live = s.state === 'now';
    if (live) {
      doc.add(
        el('circle', { cx: SPINE_X, cy, r: 16, fill: pal.accent, 'fill-opacity': 0.16 }),
        el('circle', { cx: SPINE_X, cy, r: 8, fill: pal.accent }),
        el('circle', { cx: SPINE_X - 2.4, cy: cy - 2.6, r: 2.4, fill: '#fff', 'fill-opacity': 0.7 }),
      );
    } else {
      // punched through the spine: a ring with the glass showing inside
      doc.add(el('circle', { cx: SPINE_X, cy, r: 7.5, fill: theme === 'light' ? '#FFFFFF' : pal.base, 'fill-opacity': 0.9, stroke: pal.ink3, 'stroke-width': 2.5 }));
    }
    const org = doc.text(fonts.sans, s.org, { x: TEXT_X, y, size: type.routeOrg, tracking: -0.01 });
    const role = doc.text(fonts.text, s.role, { x: TEXT_X, y: y + ROLE_DY, size: type.routeLine });
    if (role.end > RIGHT) throw new Error(`route: "${s.role}" is too wide`);
    // the date sits right of the org; a long org pushes it down to the role line, never smaller
    let date = doc.text(fonts.text, s.date, { x: RIGHT, y, size: type.routeLine, anchor: 'end' });
    if (org.end + 24 > date.x) {
      date = doc.text(fonts.text, s.date, { x: RIGHT, y: y + ROLE_DY, size: type.routeLine, anchor: 'end' });
      if (role.end + 24 > date.x) throw new Error(`route: "${s.org}" runs into its date`);
    }
    ink.push(org.markup);
    ink2.push(role.markup);
    (live ? accent : ink3).push(date.markup);
  });
  doc.add(
    el('g', { fill: pal.ink }, ink.join('')),
    el('g', { fill: pal.ink2 }, ink2.join('')),
    el('g', { fill: pal.ink3 }, ink3.join('')),
    el('g', { fill: pal.accent }, accent.join('')),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
