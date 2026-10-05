// The light field and the glass that sits on it, drawn inside a standalone SVG.
//
// GitHub shows each panel through <img>, so there is no page CSS and no backdrop-filter. The
// trick (research/glass.md section 9) is to draw the field twice: once sharp as the panel's
// background, and once more inside each glass shape, through a blur and saturate filter, with
// the glass layers on top: tint, light leaking at the bottom and right, a bright band inside
// the edge, sheen, a diagonal streak, faint grain, a rim that goes dark on the far side with a
// trace of iridescence, a sharp top line, and a warm shadow under it. Every panel calls these
// two functions; no panel writes its own filter.
import { palettes } from './tokens.mjs';
import { el, fmt } from './svg.mjs';

const STOPS = [0, 0.4, 0.62, 1]; // where the four tint values sit along the 155 degree line

// The rod's edge band magnifies harder across its axis than its middle does.
export const edgeMagnify = ([sx, sy]) => [sx * 1.01, sy * 1.3];

// A linear gradient across a box at a CSS angle (0 is up, 90 is right), in user space, so a
// wide sheet and a thin pill both get the same light direction.
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

// An arc on a circle, angles in degrees clockwise from the +x axis (SVG's y points down).
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [[x0, y0], [x1, y1]] = [p(a0), p(a1)];
  return `M${fmt(x0)} ${fmt(y0)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x1)} ${fmt(y1)}`;
}

const blurFilter = (id, sd, region = '-50%') =>
  el('filter', { id, x: region, y: region, width: '200%', height: '200%' }, el('feGaussianBlur', { stdDeviation: sd }));

// ---------------------------------------------------------------------------------------------
// The field: base, radial blobs, an optional grid (the structure the glass bends), and, at
// night, soft pools under text that stands on it. Defined once in <defs> as <g id>; draw it
// with drawField() and let glass() draw it again.
//
// blobs: [{ c: 'peach', x, y, r, rx?, ry?, k? }]  k scales the token alpha
// grid:  { size, alpha, fade: [y0, y1] }           fades to nothing between y0 and y1
// pools: [{ x, y, w, h }]                          only painted where the theme has a scrim
// extra: markup drawn last, as part of the field (the hero's sentence, so the lens reads it)
// dx, dy shift everything (a card shows its own window of a larger field)
export function field(doc, { id = 'f', w, h, theme, blobs, grid = null, pools = [], extra = '', dx = 0, dy = 0 }) {
  const pal = palettes[theme];
  const parts = [el('rect', { width: w, height: h, fill: pal.base })];
  for (const b of blobs) {
    const tone = pal.field[b.c];
    const a = Math.min(1, tone.a * (b.k ?? 1));
    const gid = doc.shared(
      `fb-${b.c}-${Math.round(a * 100)}`,
      el(
        'radialGradient',
        { id: `fb-${b.c}-${Math.round(a * 100)}` },
        [[0, 1], [0.24, 0.86], [0.5, 0.5], [0.76, 0.15], [1, 0]]
          .map(([o, k]) => el('stop', { offset: o, 'stop-color': tone.c, 'stop-opacity': Math.round(a * k * 1000) / 1000 }))
          .join(''),
      ),
    );
    parts.push(el('ellipse', { cx: b.x + dx, cy: b.y + dy, rx: b.rx ?? b.r, ry: b.ry ?? b.r, fill: `url(#${gid})` }));
  }
  if (grid) {
    const s = grid.size;
    doc.shared(
      `${id}-gp`,
      el(
        'pattern',
        { id: `${id}-gp`, width: s, height: s, patternUnits: 'userSpaceOnUse', x: dx % s, y: dy % s },
        el('path', { d: `M${s} 0H0V${s}`, fill: 'none', stroke: pal.grid, 'stroke-opacity': grid.alpha, 'stroke-width': 1 }),
      ),
    );
    let mask = null;
    if (grid.fade) {
      const [y0, y1] = grid.fade;
      doc.shared(
        `${id}-gf`,
        el('linearGradient', { id: `${id}-gf`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: y0, x2: 0, y2: y1 },
          el('stop', { offset: 0, 'stop-color': '#fff' }) + el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      );
      doc.shared(`${id}-gm`, el('mask', { id: `${id}-gm`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h }, el('rect', { width: w, height: h, fill: `url(#${id}-gf)` })));
      mask = `url(#${id}-gm)`;
    }
    parts.push(el('rect', { width: w, height: h, fill: `url(#${id}-gp)`, mask }));
  }
  if (pal.scrim.a > 0 && pools.length) {
    doc.shared('pool-blur', blurFilter('pool-blur', 26));
    parts.push(
      el('g', { fill: pal.scrim.c, 'fill-opacity': pal.scrim.a, filter: 'url(#pool-blur)' },
        pools.map((p) => el('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: Math.min(p.h / 2, 40) })).join('')),
    );
  }
  parts.push(extra);
  doc.defs.push(el('g', { id }, parts.join('')));
  return id;
}

// The panel's own background: the field, clipped to the panel's rounded corners.
export function drawField(doc, { id = 'f', w, h, r, x = 0, y = 0 }) {
  doc.shared('panel', el('clipPath', { id: 'panel' }, el('rect', { x, y, width: w, height: h, rx: r })));
  return el('use', { href: `#${id}`, 'clip-path': 'url(#panel)' });
}

// A faint inner line on the panel's edge, so the panel ends cleanly on GitHub's own page colour.
export function panelEdge(doc, { w, h, r, theme }) {
  const light = theme === 'light';
  return el('rect', {
    x: 0.5, y: 0.5, width: w - 1, height: h - 1, rx: r - 0.5, fill: 'none',
    stroke: light ? '#15120E' : '#FFFFFF', 'stroke-opacity': light ? 0.07 : 0.1,
  });
}

// ---------------------------------------------------------------------------------------------
// One glass surface. kind: 'sheet' (thick, holds content), 'pill' (thick, a button), 'clear'
// (the lens: almost no blur, a rod's highlights, magnifies). Returns the pieces so a caller can
// move the whole surface while the backdrop counter-moves (the hero's reading lens):
//   { shadow, backdrop, layers, rim, markup }
//
// magnify: [sx, sy] about the surface's centre. A horizontal glass rod magnifies across its
// axis, not along it, so the lens uses a small sx and a larger sy.
// scrims: [{ x, y, w, h }] soft pools of tint under copy, so text keeps its contrast.
export function glass(doc, { id, x, y, w, h, r, kind = 'sheet', theme, field: fid = 'f', magnify = null, scrims = [], backdropClass = null, edgeClass = null }) {
  const pal = palettes[theme];
  const G = pal.glass;
  const spec = G[kind];
  const light = theme === 'light';
  const box = { x, y, w, h };
  const rect = { x, y, width: w, height: h, rx: r };
  const [cx, cy] = [x + w / 2, y + h / 2];

  doc.defs.push(el('clipPath', { id: doc.id(`${id}-c`) }, el('rect', rect)));
  const gb = doc.shared(
    `gb-${kind}`,
    el('filter', { id: `gb-${kind}`, x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' },
      el('feGaussianBlur', { stdDeviation: spec.blur }) +
        el('feColorMatrix', { type: 'saturate', values: spec.saturate }) +
        el('feComponentTransfer', {}, ['R', 'G', 'B'].map((ch) => el(`feFunc${ch}`, { type: 'linear', slope: spec.bright })).join(''))),
  );

  // shadow: warm and down-right in daylight, a deeper violet shadow at night
  const deep = kind === 'clear' ? [8, 18, 16] : kind === 'pill' ? [3, 7, 8] : [6, 14, 18];
  doc.shared(`gs-${deep[2]}`, blurFilter(`gs-${deep[2]}`, deep[2]));
  doc.shared('gs-2', blurFilter('gs-2', 2));
  const shadow =
    el('rect', { ...rect, x: x + deep[0], y: y + deep[1], fill: pal.shadow, 'fill-opacity': G.shadow, filter: `url(#gs-${deep[2]})` }) +
    el('rect', { ...rect, y: y + 2, fill: pal.shadow, 'fill-opacity': light ? 0.08 : 0.3, filter: 'url(#gs-2)' });

  // backdrop: the field again, through the filter, optionally magnified. A caller that moves
  // the surface passes classes for the two inner wrappers so they can counter-move.
  const wrap = (cls, inner) => (cls ? el('g', { class: cls }, inner) : inner);
  const mag = magnify ? `matrix(${fmt(magnify[0])} 0 0 ${fmt(magnify[1])} ${fmt(cx * (1 - magnify[0]))} ${fmt(cy * (1 - magnify[1]))})` : null;
  let back = wrap(backdropClass, el('use', { href: `#${fid}`, filter: `url(#${gb})`, transform: mag }));
  if (kind === 'clear' && magnify) {
    // light bends hardest at a rod's top and bottom edge: a band of stronger vertical
    // magnification, softened, fades in toward each edge
    const edge = edgeMagnify(magnify);
    const em = `matrix(${fmt(edge[0])} 0 0 ${fmt(edge[1])} ${fmt(cx * (1 - edge[0]))} ${fmt(cy * (1 - edge[1]))})`;
    doc.shared('gb-edge', el('filter', { id: 'gb-edge', x: '-10%', y: '-10%', width: '120%', height: '120%' }, el('feGaussianBlur', { stdDeviation: 2.4 })));
    doc.defs.push(
      el('linearGradient', { id: doc.id(`${id}-eg`), gradientUnits: 'userSpaceOnUse', x1: 0, y1: y, x2: 0, y2: y + h },
        [[0, 0.9], [0.14, 0], [0.86, 0], [1, 0.9]].map(([o, k]) => el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': k })).join('')),
      el('mask', { id: doc.id(`${id}-em`), maskUnits: 'userSpaceOnUse', x, y, width: w, height: h }, el('rect', { ...rect, fill: `url(#${id}-eg)` })),
    );
    back += el('g', { mask: `url(#${id}-em)` }, wrap(edgeClass, el('use', { href: `#${fid}`, filter: 'url(#gb-edge)', transform: em })));
  }
  const backdrop = el('g', { 'clip-path': `url(#${id}-c)` }, back);

  // tint, leaks, band, sheen, streak, grain, scrims
  const t = spec.tint ?? G.tint;
  doc.defs.push(
    angled(doc.id(`${id}-t`), box, 155, spec.fill.map((a, i) => [STOPS[i], t, a])),
    el('linearGradient', { id: doc.id(`${id}-lb`), gradientUnits: 'userSpaceOnUse', x1: 0, y1: y + h * 0.55, x2: 0, y2: y + h },
      el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }) + el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': light ? 0.42 : 0.12 })),
    el('linearGradient', { id: doc.id(`${id}-lr`), gradientUnits: 'userSpaceOnUse', x1: x + w - Math.min(90, w * 0.25), y1: 0, x2: x + w, y2: 0 },
      el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }) + el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': light ? 0.28 : 0.08 })),
    kind === 'clear'
      ? // a rod: a bright band along the top that falls off fast, then clear glass
        el('linearGradient', { id: doc.id(`${id}-sh`), gradientUnits: 'userSpaceOnUse', x1: 0, y1: y, x2: 0, y2: y + h },
          [[0, G.sheen], [0.1, G.sheen * 0.8], [0.3, 0], [1, 0]].map(([o, k]) => el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': k })).join(''))
      : el('radialGradient', { id: doc.id(`${id}-sh`), gradientUnits: 'userSpaceOnUse', cx: x + w * 0.3, cy: y - h * 0.2, r: Math.max(w * 0.6, h) },
          el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': G.sheen }) + el('stop', { offset: 0.62, 'stop-color': '#fff', 'stop-opacity': 0 })),
    angled(doc.id(`${id}-st`), box, 118, [[0.3, '#fff', 0], [0.4, '#fff', G.streak], [0.47, '#fff', G.streak * 0.3], [0.52, '#fff', 0]]),
  );
  const bandSd = kind === 'clear' ? 2 : 4;
  doc.shared(`band-${bandSd}`, blurFilter(`band-${bandSd}`, bandSd));
  doc.shared(
    'grain',
    el('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' },
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.85, numOctaves: 2, seed: 7, stitchTiles: 'stitch' }) +
        el('feColorMatrix', { values: '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 .16 0 0' })),
  );
  const bandW = kind === 'clear' ? 6 : kind === 'pill' ? 6 : 12;
  let layers =
    el('rect', { ...rect, fill: `url(#${id}-t)` }) +
    el('rect', { ...rect, fill: `url(#${id}-lb)` }) +
    el('rect', { ...rect, fill: `url(#${id}-lr)` }) +
    el('g', { 'clip-path': `url(#${id}-c)` },
      el('rect', { ...rect, fill: 'none', stroke: '#fff', 'stroke-opacity': kind === 'clear' ? (light ? 0.4 : 0.16) : light ? 0.5 : 0.14, 'stroke-width': bandW, filter: `url(#band-${bandSd})` })) +
    el('rect', { ...rect, fill: `url(#${id}-sh)` });
  if (kind !== 'clear') layers += el('rect', { ...rect, fill: `url(#${id}-st)`, class: 'streak' });
  layers += el('g', { 'clip-path': `url(#${id}-c)`, opacity: light ? 0.5 : 0.35 }, el('rect', { ...rect, filter: 'url(#grain)' }));
  if (scrims.length) {
    doc.shared('scrim-blur', blurFilter('scrim-blur', 22));
    const a = Math.max(0, spec.floor - Math.min(...spec.fill)) * 1.15;
    layers += el('g', { 'clip-path': `url(#${id}-c)` },
      el('g', { fill: t, 'fill-opacity': Math.round(a * 100) / 100, filter: 'url(#scrim-blur)' },
        scrims.map((s) => el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: Math.min(s.h / 2, 30) })).join('')));
  }

  // rim: bright where the light comes from (top left), dark on the far side, with the field's
  // hues at low chroma in between, then a sharp top line
  const [irisA, irisB] = G.iris;
  const R = G.rim;
  doc.defs.push(
    angled(doc.id(`${id}-r`), box, 135, [
      [0, '#fff', R], [0.22, '#fff', R * 0.5], [0.4, irisA, R * 0.55], [0.58, pal.rimDark, light ? 0.22 : 0.5],
      [0.74, irisB, R * 0.6], [0.9, pal.rimDark, light ? 0.3 : 0.6], [1, '#fff', R * 0.7],
    ]),
    el('linearGradient', { id: doc.id(`${id}-tl`), gradientUnits: 'userSpaceOnUse', x1: x + r * 0.5, y1: 0, x2: x + w - r * 0.5, y2: 0 },
      [[0, 0], [0.12, 0.95], [0.6, 0.7], [1, 0]].map(([o, k]) => el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': k })).join('')),
  );
  const top = Math.min(r, h / 2);
  let rim =
    el('rect', { x: x + 0.75, y: y + 0.75, width: w - 1.5, height: h - 1.5, rx: r - 0.75, fill: 'none', stroke: `url(#${id}-r)`, 'stroke-width': 1.5 }) +
    el('rect', { x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: Math.max(0, r - 2), fill: 'none', stroke: '#fff', 'stroke-opacity': light ? 0.35 : 0.08 }) +
    el('path', { d: `M${fmt(x + top * 0.7)} ${fmt(y + 1.6)}H${fmt(x + w - top * 0.7)}`, stroke: `url(#${id}-tl)`, 'stroke-width': 1.3, 'stroke-linecap': 'round', fill: 'none' });
  if (kind === 'clear') {
    // a rod: a caustic line of focused light along the bottom, a glint on each end cap
    doc.shared('caustic', blurFilter('caustic', 0.9));
    rim +=
      el('path', { d: `M${fmt(x + h * 0.55)} ${fmt(y + h - 4)}H${fmt(x + w - h * 0.55)}`, stroke: G.caustic, 'stroke-opacity': light ? 0.95 : 0.6, 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none', filter: 'url(#caustic)' }) +
      el('path', { d: arc(x + h / 2, y + h / 2, h / 2 - 4, 200, 250), stroke: '#fff', 'stroke-opacity': light ? 0.9 : 0.55, 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none', filter: 'url(#caustic)' }) +
      el('path', { d: arc(x + w - h / 2, y + h / 2, h / 2 - 4, 20, 60), stroke: '#fff', 'stroke-opacity': light ? 0.55 : 0.3, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none', filter: 'url(#caustic)' });
  }
  return { shadow, backdrop, layers, rim, markup: shadow + backdrop + layers + rim };
}
