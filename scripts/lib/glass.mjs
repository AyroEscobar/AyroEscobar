// The world and the glass that floats in it, drawn inside a standalone SVG.
//
// GitHub shows each panel through <img>: no page CSS, no backdrop-filter, no script. So the
// world is drawn once as the panel's background and once more inside each glass shape,
// through a blur, saturate and brightness filter (the site's backdrop-filter, done by hand),
// with the site's glass layers on top: the light fill, the void scrim under copy, the inner
// top line, the rock's cyan leaking in at the bottom, a sheen, a diagonal streak, faint grain,
// and a rim lit cyan-white on the side facing the rock. Every panel calls world() and
// glass(); no panel writes its own filter.
//
// The world is the boulder scene reduced to what survives at 308 px: a sky with its horizon
// band, a far ridge, the wet slope with a few hairline contours, and the glass rock itself
// with its neon core (the helix cyan, the ring magenta, a white heart). Under a panel's glass
// the rock blurs into neon bent through frosted glass, which is the brief's liquid glass.
import { palettes } from './tokens.mjs';
import { el, fmt, polyD } from './svg.mjs';
import { prng } from './prng.mjs';

const blurFilter = (id, sd, region = '-50%') =>
  el('filter', { id, x: region, y: region, width: '200%', height: '200%' }, el('feGaussianBlur', { stdDeviation: sd }));

// A linear gradient across a box at a CSS angle (0 is up, 90 is right), in user space.
function angled(id, { x, y, w, h }, deg, stops) {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.sin(a), -Math.cos(a)];
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const [cx, cy] = [x + w / 2, y + h / 2];
  return el(
    'linearGradient',
    { id, gradientUnits: 'userSpaceOnUse', x1: cx - (dx * len) / 2, y1: cy - (dy * len) / 2, x2: cx + (dx * len) / 2, y2: cy + (dy * len) / 2 },
    stops.map(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op })).join(''),
  );
}

// the CSS angle (0 up, clockwise) from a point toward another
export const angleTo = (x0, y0, x1, y1) => (Math.atan2(x1 - x0, -(y1 - y0)) * 180) / Math.PI;

// A smooth ridge profile: a few sines with seeded phases, so every panel's skyline differs
// and every build is identical.
function profile(w, seed, base, amp) {
  const r = prng(`ridge-${seed}`).next;
  const waves = [0.004, 0.009, 0.021, 0.047].map((f, i) => ({ f, ph: r() * 6.283, a: amp / (1 + i * 1.6) }));
  const pts = [];
  for (let x = -20; x <= w + 20; x += 10) pts.push([x, base - waves.reduce((s, v) => s + v.a * Math.sin(x * v.f + v.ph), 0)]);
  return pts;
}

// The glass boulder: a clear sphere, its rim lit cyan toward the light and magenta on the far
// side, and the neon core inside (the site's calmed colours: the helix cyan with a white centre
// line, the ring magenta, the heart white).
function rock(doc, { x, y, r, tilt = -14 }) {
  doc.shared('rk-body', el('radialGradient', { id: 'rk-body', cx: 0.42, cy: 0.38, r: 0.62 },
    [[0, '#E6FCFF', 0.1], [0.6, '#BFEFFF', 0.06], [0.88, '#DFF8FF', 0.18], [1, '#FFFFFF', 0.42]].map(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })).join('')));
  doc.shared('rk-glow', blurFilter('rk-glow', 7));
  doc.shared('rk-soft', blurFilter('rk-soft', 2.2));
  doc.shared('rk-core', el('radialGradient', { id: 'rk-core' },
    [[0, '#BFF8FF', 0.32], [0.35, '#19E6FF', 0.16], [1, '#19E6FF', 0]].map(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })).join('')));
  doc.shared('rk-halo', el('radialGradient', { id: 'rk-halo' },
    [[0, '#19E6FF', 0.34], [0.45, '#19E6FF', 0.14], [1, '#19E6FF', 0]].map(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })).join('')));
  // the helix: a spiral around the vertical axis, foreshortened; the half behind the axis is
  // drawn dimmer than the half in front, so it reads as a coil inside the glass
  const turns = 2.1;
  const seg = (front) => {
    let d = '';
    let run = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 2 * turns + 0.6 + tilt * 0.05;
      const pt = [x + Math.sin(a) * r * 0.34, y - r * 0.6 + t * r * 1.2 + Math.cos(a) * r * 0.05];
      if (Math.cos(a) > 0 === front) run.push(pt);
      else if (run.length) {
        if (run.length > 1) d += polyD(run);
        run = [];
      }
    }
    if (run.length > 1) d += polyD(run);
    return d;
  };
  const back = seg(false);
  const front = seg(true);
  const ringBox = { cx: x, cy: y + r * 0.04, rx: r * 0.72, ry: r * 0.16 };
  const rot = `rotate(${tilt} ${fmt(x)} ${fmt(y)})`;
  const half = (top) => `M${fmt(ringBox.cx - ringBox.rx)} ${fmt(ringBox.cy)}A${fmt(ringBox.rx)} ${fmt(ringBox.ry)} 0 0 ${top ? 1 : 0} ${fmt(ringBox.cx + ringBox.rx)} ${fmt(ringBox.cy)}`;
  const arcPath = (a0, a1, rr) => {
    const p = (a) => [x + rr * Math.cos((a * Math.PI) / 180), y + rr * Math.sin((a * Math.PI) / 180)];
    const [[x0, y0], [x1, y1]] = [p(a0), p(a1)];
    return `M${fmt(x0)} ${fmt(y0)}A${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(x1)} ${fmt(y1)}`;
  };
  // droplets seated on the glass, dark beads with a pinpoint highlight
  const dr = prng(`drops-${Math.round(x)}-${Math.round(y)}`).next;
  let drops = '';
  for (let k = 0; k < 14; k++) {
    const ang = dr() * Math.PI * 2;
    const rad = Math.sqrt(dr()) * r * 0.9;
    const dx = x + Math.cos(ang) * rad;
    const dy = y + Math.sin(ang) * rad;
    const s = 1.4 + dr() * 2.2;
    drops += el('ellipse', { cx: dx, cy: dy, rx: s, ry: s * 0.8, fill: '#0B1118', 'fill-opacity': 0.55 }) + el('circle', { cx: dx - s * 0.3, cy: dy - s * 0.3, r: s * 0.35, fill: '#FFFFFF', 'fill-opacity': 0.6 });
  }
  const tube = (d, color, w, op, extra = {}) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-opacity': op, 'stroke-linecap': 'round', ...extra });
  return (
    el('circle', { cx: x, cy: y + r * 0.9, r: r * 1.5, fill: 'url(#rk-halo)' }) +
    el('circle', { cx: x, cy: y, r, fill: 'url(#rk-body)' }) +
    el('circle', { cx: x, cy: y, r: r * 0.8, fill: 'url(#rk-core)' }) +
    // behind the heart: the far half of the ring and the coil, dim
    el('g', { transform: rot }, tube(half(true), '#FF3DBB', r * 0.016, 0.45)) +
    tube(back, '#19E6FF', r * 0.016, 0.42) +
    el('circle', { cx: x, cy: y, r: r * 0.075, fill: '#FFFFFF', filter: 'url(#rk-soft)' }) +
    // the glow, then the near halves sharp, each with a white centre line
    tube(front, '#19E6FF', r * 0.075, 0.45, { filter: 'url(#rk-glow)' }) +
    el('g', { transform: rot }, tube(half(false), '#FF3DBB', r * 0.06, 0.4, { filter: 'url(#rk-glow)' })) +
    tube(front, '#5FF0FF', r * 0.026, 1) +
    tube(front, '#FFFFFF', r * 0.009, 0.85) +
    el('g', { transform: rot }, tube(half(false), '#FF6ACF', r * 0.02, 1) + tube(half(false), '#FFE3F6', r * 0.007, 0.8)) +
    drops +
    // the rim: cyan-white toward the top left, a calm magenta on the far side
    el('path', { d: arcPath(165, 290, r - 1.5), fill: 'none', stroke: '#C8FAFF', 'stroke-width': 2.4, 'stroke-opacity': 0.8, 'stroke-linecap': 'round', filter: 'url(#rk-soft)' }) +
    el('path', { d: arcPath(-35, 55, r - 2), fill: 'none', stroke: '#FF3DBB', 'stroke-width': 3.2, 'stroke-opacity': 0.55, 'stroke-linecap': 'round', filter: 'url(#rk-soft)' }) +
    el('ellipse', { cx: x - r * 0.36, cy: y - r * 0.55, rx: r * 0.12, ry: r * 0.06, transform: `rotate(-35 ${fmt(x - r * 0.36)} ${fmt(y - r * 0.55)})`, fill: '#FFFFFF', 'fill-opacity': 0.55, filter: 'url(#rk-soft)' })
  );
}

// ---------------------------------------------------------------------------------------------
// The world, defined once in <defs> as <g id>. Draw it with drawWorld(); glass() draws it again.
//   horizon: y of the horizon band        ridge: { base, amp, seed }
//   slope:   { y0, y1 } the slope's top edge at x = 0 and x = w (it rises to the right, uphill)
//   rock:    { x, y, r, tilt } or null    contours: number of hairlines under the slope edge
export function world(doc, { id = 'f', w, h, theme, horizon, ridge, slope, rock: rk = null, contours = 4, seed = 1 }) {
  const W = palettes[theme].world;
  const parts = [];
  doc.shared(`${id}-sky`, el('linearGradient', { id: `${id}-sky`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: horizon },
    el('stop', { offset: 0, 'stop-color': W.zenith }) + el('stop', { offset: 1, 'stop-color': W.horizon })));
  doc.shared(`${id}-glow`, el('radialGradient', { id: `${id}-glow` },
    el('stop', { offset: 0, 'stop-color': W.glowA, 'stop-opacity': 0.7 }) + el('stop', { offset: 1, 'stop-color': W.glowA, 'stop-opacity': 0 })));
  parts.push(el('rect', { width: w, height: h, fill: W.horizon }), el('rect', { width: w, height: horizon, fill: `url(#${id}-sky)` }));
  parts.push(el('ellipse', { cx: w * 0.18, cy: horizon, rx: w * 0.5, ry: horizon * 0.7, fill: `url(#${id}-glow)` }));
  // a few sharp stars high in the sky
  const r = prng(`stars-${seed}`).next;
  let stars = '';
  for (let i = 0; i < 9; i++) {
    const sx = r() * w;
    const sy = 8 + r() * horizon * 0.45;
    stars += el('circle', { cx: sx, cy: sy, r: 0.8 + r() * 0.7 });
  }
  parts.push(el('g', { fill: '#FFFFFF', 'fill-opacity': W.stars }, stars));
  // the far ridge, lighter than the slope, darker than the sky
  const rp = profile(w, seed, ridge.base, ridge.amp);
  parts.push(el('path', { d: `${polyD(rp)}L${fmt(w + 20)} ${fmt(h + 20)}L-20 ${fmt(h + 20)}z`, fill: W.ridge }));
  // the slope: wet stone rising uphill to the right
  const edge = (x) => slope.y0 + ((slope.y1 - slope.y0) * x) / w + Math.sin(x * 0.006 + seed) * 6;
  const sp = [];
  for (let x = -20; x <= w + 20; x += 20) sp.push([x, edge(x)]);
  doc.shared(`${id}-sl`, el('linearGradient', { id: `${id}-sl`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: Math.min(slope.y0, slope.y1), x2: 0, y2: h },
    el('stop', { offset: 0, 'stop-color': W.slope }) + el('stop', { offset: 1, 'stop-color': W.slopeLow })));
  parts.push(el('path', { d: `${polyD(sp)}L${fmt(w + 20)} ${fmt(h + 20)}L-20 ${fmt(h + 20)}z`, fill: `url(#${id}-sl)` }));
  // hairline contours: a family at equal intensity, roughly following the slope, sparser and
  // fainter downhill, never a grid
  let lines = '';
  for (let k = 1; k <= contours; k++) {
    const off = k * k * 9 + k * 14;
    const cp = [];
    for (let x = -20; x <= w + 20; x += 20) cp.push([x, edge(x) + off + Math.sin(x * 0.011 + k * 1.7) * (4 + k * 2)]);
    lines += el('path', { d: polyD(cp), 'stroke-opacity': Math.round(W.contourA * (1 - (k - 1) / (contours + 1)) * 100) / 100 });
  }
  parts.push(el('g', { fill: 'none', stroke: W.contour, 'stroke-width': 1.2 }, lines));
  if (rk) parts.push(rock(doc, rk));
  doc.defs.push(el('g', { id }, parts.join('')));
  return id;
}

// The panel's own background: the world, clipped to the panel's rounded corners.
export function drawWorld(doc, { id = 'f', w, h, r }) {
  doc.shared('panel', el('clipPath', { id: 'panel' }, el('rect', { width: w, height: h, rx: r })));
  return el('use', { href: `#${id}`, 'clip-path': 'url(#panel)' });
}

// A faint inner line on the panel's edge, so it ends cleanly on GitHub's page colour.
export function panelEdge(doc, { w, h, r, theme }) {
  return el('rect', { x: 0.5, y: 0.5, width: w - 1, height: h - 1, rx: r - 0.5, fill: 'none', stroke: theme === 'light' ? '#05060D' : '#FFFFFF', 'stroke-opacity': theme === 'light' ? 0.12 : 0.1 });
}

// ---------------------------------------------------------------------------------------------
// One sheet of thick glass. scrims: boxes of copy; each gets the void scrim at full strength
// (the contrast check assumes exactly that). light: the point the rim faces (the rock).
export function glass(doc, { id, x, y, w, h, r, theme, field: fid = 'f', scrims = [], light = null, pill = false }) {
  const pal = palettes[theme];
  const G = pal.glass;
  const box = { x, y, w, h };
  const rect = { x, y, width: w, height: h, rx: r };
  doc.defs.push(el('clipPath', { id: doc.id(`${id}-c`) }, el('rect', rect)));
  const gb = doc.shared('gb', el('filter', { id: 'gb', x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' },
    el('feGaussianBlur', { stdDeviation: G.blur }) +
      el('feColorMatrix', { type: 'saturate', values: G.saturate }) +
      el('feComponentTransfer', {}, ['R', 'G', 'B'].map((ch) => el(`feFunc${ch}`, { type: 'linear', slope: G.bright })).join(''))));

  // the ink shadow under it, down, 1:2 (the site's --e-raised)
  doc.shared('gs-20', blurFilter('gs-20', 20));
  doc.shared('gs-6', blurFilter('gs-6', 6));
  const shadow = pill
    ? el('rect', { ...rect, y: y + 5, fill: pal.shadow, 'fill-opacity': 0.4, filter: 'url(#gs-6)' })
    : el('rect', { ...rect, x: x + 10, y: y + 26, width: w - 20, fill: pal.shadow, 'fill-opacity': 0.55, filter: 'url(#gs-20)' }) +
      el('rect', { ...rect, y: y + 8, fill: pal.shadow, 'fill-opacity': 0.4, filter: 'url(#gs-6)' });

  const backdrop = el('g', { 'clip-path': `url(#${id}-c)` }, el('use', { href: `#${fid}`, filter: `url(#${gb})` }));

  // fill, scrims, the cyan leak at the bottom, sheen, streak, grain
  const STOPS = [0, 0.38, 0.7, 1];
  doc.defs.push(
    angled(doc.id(`${id}-t`), box, 155, G.fill.map((a, i) => [STOPS[i], '#FFFFFF', a])),
    el('linearGradient', { id: doc.id(`${id}-lk`), gradientUnits: 'userSpaceOnUse', x1: 0, y1: y + h - Math.min(70, h * 0.5), x2: 0, y2: y + h },
      el('stop', { offset: 0, 'stop-color': '#19E6FF', 'stop-opacity': 0 }) + el('stop', { offset: 1, 'stop-color': '#19E6FF', 'stop-opacity': 0.16 })),
    el('radialGradient', { id: doc.id(`${id}-sh`), gradientUnits: 'userSpaceOnUse', cx: x + w / 2, cy: y - h * 0.12, r: Math.max(w * 0.6, h) },
      el('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 0.1 }) + el('stop', { offset: 0.62, 'stop-color': '#FFFFFF', 'stop-opacity': 0 })),
    angled(doc.id(`${id}-st`), box, 118, [[0.3, '#FFFFFF', 0], [0.4, '#FFFFFF', 0.045], [0.42, '#FFFFFF', 0.07], [0.52, '#FFFFFF', 0]]),
  );
  doc.shared('grain', el('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' },
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 7, stitchTiles: 'stitch' }) +
      el('feColorMatrix', { values: '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .05 0' })));
  let layers = el('rect', { ...rect, fill: `url(#${id}-t)` });
  if (scrims.length) {
    layers += el('g', { fill: pal.void, 'fill-opacity': G.scrim },
      scrims.map((s) => el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: s.r ?? Math.max(0, r - 10) })).join(''));
  }
  layers +=
    el('rect', { ...rect, fill: `url(#${id}-lk)` }) +
    el('rect', { ...rect, fill: `url(#${id}-sh)` }) +
    el('rect', { ...rect, fill: `url(#${id}-st)` }) +
    el('g', { 'clip-path': `url(#${id}-c)` }, el('rect', { ...rect, filter: 'url(#grain)' }));

  // the rim: a 2 px ring whose bright side faces the rock, cyan-white there, near nothing
  // elsewhere; then the inner top line (the site's inset 0 1px 0 lit .55)
  const deg = light ? angleTo(x + w / 2, y + h / 2, light.x, light.y) : 70;
  doc.defs.push(
    angled(doc.id(`${id}-r`), box, deg, [[0, '#FFFFFF', 0.05], [0.45, '#FFFFFF', 0.08], [0.72, '#19E6FF', 0.35], [0.9, '#E1FCFF', G.rim], [1, '#FFFFFF', 1]]),
    el('linearGradient', { id: doc.id(`${id}-tl`), gradientUnits: 'userSpaceOnUse', x1: x + r, y1: 0, x2: x + w - r, y2: 0 },
      [[0, 0.1], [0.2, 0.55], [0.8, 0.55], [1, 0.1]].map(([o, k]) => el('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': k })).join('')),
  );
  const rw = pill ? 1.5 : 2;
  const rim =
    el('rect', { x: x + rw / 2, y: y + rw / 2, width: w - rw, height: h - rw, rx: r - rw / 2, fill: 'none', stroke: `url(#${id}-r)`, 'stroke-width': rw }) +
    el('path', { d: `M${fmt(x + r * 0.8)} ${fmt(y + rw + 0.6)}H${fmt(x + w - r * 0.8)}`, stroke: `url(#${id}-tl)`, 'stroke-width': 1, fill: 'none' });
  return { markup: shadow + backdrop + layers + rim };
}
