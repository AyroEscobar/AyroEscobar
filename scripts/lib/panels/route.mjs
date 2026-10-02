// Route rail: his roles as a transit line, earliest stop at the top. Stops that are done glow
// sodium, stops that are current glow LED. The line keeps going past the last stop.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, fmt, panelBase, panelFrame } from '../svg.mjs';

const W = 880;
const LINE_X = 80;
const TEXT_X = 116;
const RIGHT = 840;
const TOP = 74; // first org baseline
const STEP = 80; // between stops
const ROLE_DY = 37; // org baseline to role baseline
const DOT_DY = -12; // org baseline to dot centre (middle of the capitals)

export function routeAlt(profile) {
  return `Route: ${profile.route.map((s) => `${s.say}.`).join(' ')}`;
}

export function route(profile, theme) {
  const pal = palettes[theme];
  const stops = profile.route;
  const lastY = TOP + (stops.length - 1) * STEP;
  const H = lastY + ROLE_DY + 66;
  const doc = new Doc({ w: W, h: H, pal, title: 'Route', desc: routeAlt(profile) });

  panelBase(doc);
  const firstDot = TOP + DOT_DY;
  const lastDot = lastY + DOT_DY;
  // the line: solid through every stop, dashed past the last one
  doc.add(
    el('path', { d: `M${LINE_X} 22V${lastDot}`, stroke: pal.traceLit, 'stroke-width': 3, fill: 'none' }),
    el('path', {
      d: `M${LINE_X} ${lastDot + 16}V${H - 22}`,
      stroke: pal.traceLit,
      'stroke-width': 3,
      'stroke-dasharray': '3 7',
      fill: 'none',
    }),
  );

  const ink = [];
  const dim = [];
  stops.forEach((s, k) => {
    const y = TOP + k * STEP;
    const cy = y + DOT_DY;
    const color = s.state === 'now' ? pal.led : pal.sodiumStroke;
    if (s.state === 'now') doc.add(el('circle', { cx: LINE_X, cy, r: 14, fill: pal.led, 'fill-opacity': 0.14 }));
    if (s.branches) {
      // the desks, as short branches off the stop
      const n = s.branches;
      const spread = Math.PI * 0.62;
      let d = '';
      let ends = '';
      for (let i = 0; i < n; i++) {
        const a = -spread / 2 + (spread * i) / (n - 1);
        const [c, sn] = [Math.cos(a), Math.sin(a)];
        const x1 = LINE_X + c * 10;
        const y1 = cy + sn * 10;
        const x2 = LINE_X + c * 24;
        const y2 = cy + sn * 24;
        d += `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
        ends += el('circle', { cx: x2, cy: y2, r: 1.8 });
      }
      doc.add(el('path', { d, stroke: color, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }));
      doc.add(el('g', { fill: color }, ends));
    }
    doc.add(el('circle', { cx: LINE_X, cy, r: 10, fill: pal.night }), el('circle', { cx: LINE_X, cy, r: 7, fill: color }));

    const org = doc.text(fonts.display, s.org, { x: TEXT_X, y, size: type.routeOrg });
    const date = doc.text(fonts.mono, s.date, { x: RIGHT, y, size: type.routeLine, anchor: 'end' });
    const role = doc.text(fonts.mono, s.role, { x: TEXT_X, y: y + ROLE_DY, size: type.routeLine });
    if (org.end + 24 > date.x) throw new Error(`route: "${s.org}" runs into its date`);
    if (role.end > RIGHT) throw new Error(`route: "${s.role}" is too wide`);
    ink.push(org.markup);
    dim.push(date.markup, role.markup);
  });
  doc.add(el('g', { fill: pal.ink }, ink.join('')), el('g', { fill: pal.dim }, dim.join('')));

  // legend, bottom right: colour is never the only signal (the dates say "to now")
  const ly = H - 26;
  const nowTxt = doc.text(fonts.mono, 'led = now', { x: RIGHT, y: ly, size: type.label, anchor: 'end' });
  const nowDot = nowTxt.x - 14;
  const doneTxt = doc.text(fonts.mono, 'sodium = done', { x: nowDot - 26, y: ly, size: type.label, anchor: 'end' });
  const doneDot = doneTxt.x - 14;
  doc.add(
    el('circle', { cx: doneDot, cy: ly - 7, r: 5, fill: pal.sodiumStroke }),
    el('circle', { cx: nowDot, cy: ly - 7, r: 5, fill: pal.led }),
    el('g', { fill: pal.dim }, doneTxt.markup + nowTxt.markup),
  );
  panelFrame(doc);
  return doc.render();
}
