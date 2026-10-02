// Hero: his name set over an abstract night grid. The roads near one focal node are lit in
// sodium with streetlights along them, a red obstruction beacon cycles at the node, and one
// LED packet travels the main spine. The grid is procedural and seeded: it depicts no real
// place. Text gets a cartographic halo (the grid is masked out around every glyph).
import { palettes, type, motion, fonts, frame } from '../tokens.mjs';
import { Doc, el, fmt, panelBase, panelFrame, polyD } from '../svg.mjs';
import { prng } from '../prng.mjs';
import { catmull, dist, arcLengths, runs } from '../geom.mjs';

const W = 880;
const H = 280;
const FOCAL = [800, 118];
const LIT_RADIUS = 220;
const SEED = 'sodium';

// The grid is the same for both themes; only the palette changes.
function grid() {
  const r = prng(SEED);
  const [fx, fy] = FOCAL;
  const roads = [];

  // Two long near-vertical spines. Spine A runs through the focal node.
  const spineA = catmull([
    [fx + r.range(18, 34), -24],
    [fx + r.range(4, 14), 46],
    [fx, fy],
    [fx - r.range(10, 22), 196],
    [fx - r.range(26, 44), H + 24],
  ]);
  const bx = r.range(300, 360);
  const spineB = catmull([
    [bx - r.range(10, 30), -24],
    [bx + r.range(-8, 8), 90],
    [bx + r.range(6, 20), 190],
    [bx + r.range(18, 40), H + 24],
  ]);
  roads.push(spineA, spineB);

  // Six curved cross traces. One passes through the focal node.
  const levels = [34, 82, fy, 168, 214, 258];
  levels.forEach((y0, i) => {
    const slope = r.range(-0.12, 0.12);
    const ctrl = [];
    for (const x of [-24, 200, 440, 680, W + 24]) ctrl.push([x, y0 + slope * (x - 440) + r.range(-16, 16)]);
    if (i === 2) {
      // bend this one through the node
      ctrl.splice(3, 1, [fx - 120, fy + r.range(-14, 4)], [fx, fy]);
      ctrl[ctrl.length - 1] = [W + 24, fy - r.range(10, 30)];
    }
    roads.push(catmull(ctrl, 10));
  });

  // One loop around the focal node, a beltway.
  const loop = [];
  const n = 40;
  const tilt = r.range(-0.25, 0.1);
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rad = 1 + r.range(-0.05, 0.05) * (k % n ? 1 : 0);
    const ex = Math.cos(a) * 128 * rad;
    const ey = Math.sin(a) * 74 * rad;
    loop.push([fx - 40 + ex * Math.cos(tilt) - ey * Math.sin(tilt), fy + 18 + ex * Math.sin(tilt) + ey * Math.cos(tilt)]);
  }
  loop[n] = loop[0];
  roads.push(loop);

  // Fifteen spurs, denser near the node, the way a downtown is.
  const anchors = [spineA, loop, roads[4], roads[3], roads[5], spineB];
  for (let s = 0; s < 15; s++) {
    const src = s < 10 ? anchors[s % 3] : r.pick(anchors);
    const p = src[r.int(2, src.length - 3)];
    const ang = r.range(0, Math.PI * 2);
    const len = r.range(36, 120);
    const bend = r.range(-0.5, 0.5);
    const mid = [p[0] + Math.cos(ang) * len * 0.5, p[1] + Math.sin(ang) * len * 0.5];
    const end = [p[0] + Math.cos(ang + bend) * len, p[1] + Math.sin(ang + bend) * len];
    roads.push(catmull([p, mid, end], 5));
  }
  return { roads, spineA };
}

export function hero(profile, theme) {
  const pal = palettes[theme];
  const { name, line, site, alt } = profile.identity;
  const doc = new Doc({ w: W, h: H, pal, title: name, desc: alt });
  const [fx, fy] = FOCAL;
  const { roads, spineA } = grid();

  // Type, defined once and used twice: as ink, and as a halo inside the grid's mask.
  const runs_ = [
    { id: 'tn', font: fonts.display, str: name, x: 48, y: 152, size: type.heroName, tracking: -0.02, fill: pal.ink, halo: 12 },
    { id: 'tl', font: fonts.mono, str: line, x: 48, y: 206, size: type.heroLine, tracking: -0.02, fill: pal.dim, halo: 14 },
    { id: 'tc', font: fonts.mono, str: site, x: W - 36, y: 46, size: type.label, anchor: 'end', fill: pal.sodium, halo: 10 },
  ];
  for (const t of runs_) {
    const run = doc.text(t.font, t.str, { ...t, id: t.id });
    if (run.x < 40 || run.end > W - 34) throw new Error(`hero text out of bounds: ${t.str} (${run.x}..${run.end})`);
    doc.defs.push(run.markup);
  }

  const near = (p) => dist(p, FOCAL) < LIT_RADIUS;
  const allD = roads.map((p) => polyD(p, false)).join('');
  const litD = roads.flatMap((p) => runs(p, near)).map((p) => polyD(p)).join('');

  // Packet geometry: one dash on spine A. Parked (no motion) just short of the beacon.
  const s = arcLengths(spineA);
  const total = s[s.length - 1];
  const iF = spineA.findIndex((p) => p[0] === fx && p[1] === fy);
  const sF = s[iF];
  const P = motion.packetLength;
  const parked = -(sF - 10 - P);

  doc.defs.push(
    el('path', { id: 'lit', d: litD }),
    el('clipPath', { id: 'cp' }, el('rect', { width: W, height: H, rx: frame.radius })),
    el(
      'radialGradient',
      { id: 'lg', gradientUnits: 'userSpaceOnUse', cx: fx, cy: fy, r: LIT_RADIUS },
      el('stop', { offset: 0, 'stop-color': pal.sodiumStroke }) +
        el('stop', { offset: 0.45, 'stop-color': pal.sodiumStroke, 'stop-opacity': 0.8 }) +
        el('stop', { offset: 1, 'stop-color': pal.sodiumStroke, 'stop-opacity': 0 }),
    ),
    // the sodium haze a lit district throws up into the night air
    el(
      'radialGradient',
      { id: 'hz', gradientUnits: 'userSpaceOnUse', cx: fx, cy: fy, r: LIT_RADIUS * 1.1 },
      el('stop', { offset: 0, 'stop-color': pal.sodiumStroke, 'stop-opacity': pal.haze }) +
        el('stop', { offset: 1, 'stop-color': pal.sodiumStroke, 'stop-opacity': 0 }),
    ),
    // mask luminance: white keeps the grid, black (each glyph plus its halo) knocks it out
    el(
      'mask',
      { id: 'hm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      el('rect', { width: W, height: H, fill: '#fff' }) +
        runs_
          .map((t) =>
            el('use', {
              href: `#${t.id}`,
              fill: '#000',
              stroke: '#000',
              'stroke-width': (2 * t.halo * 1000) / t.size, // halo extends t.halo units past each glyph edge
              'stroke-linejoin': 'round',
            }),
          )
          .join(''),
    ),
  );

  doc.style =
    `.pk{stroke-dashoffset:${fmt(parked)}}` +
    `@media (prefers-reduced-motion:no-preference){` +
    `.bc{animation:bc ${motion.beaconSeconds}s ease-in-out infinite}` +
    `.pk{animation:pk ${motion.packetSeconds}s linear infinite}` +
    `@keyframes bc{50%{opacity:${motion.beaconLow}}}` +
    `@keyframes pk{from{stroke-dashoffset:${fmt(P)}}to{stroke-dashoffset:${fmt(-total)}}}}`;

  panelBase(doc);
  doc.add(el('rect', { width: W, height: H, rx: frame.radius, fill: 'url(#hz)' }));
  const packetD = polyD(spineA);
  doc.add(
    el(
      'g',
      { 'clip-path': 'url(#cp)', mask: 'url(#hm)', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      el('path', { d: allD, stroke: pal.trace, 'stroke-width': 1.2 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 5, 'stroke-opacity': 0.16 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 1.3 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 2.6, 'stroke-dasharray': '0 11' }) +
        el('path', {
          class: 'pk',
          d: packetD,
          stroke: pal.led,
          'stroke-width': 2.4,
          'stroke-dasharray': `${fmt(P)} ${fmt(total + P)}`,
        }),
    ),
  );

  // The beacon: a red obstruction light with a night ring, cycling slowly.
  doc.add(
    el('circle', { cx: fx, cy: fy, r: 9, fill: pal.night }),
    el(
      'g',
      { class: 'bc' },
      el('circle', { cx: fx, cy: fy, r: 13, fill: pal.beacon, 'fill-opacity': 0.14 }) +
        el('circle', { cx: fx, cy: fy, r: 5, fill: pal.beacon }),
    ),
  );

  for (const t of runs_) doc.add(el('use', { href: `#${t.id}`, fill: t.fill }));
  panelFrame(doc);
  return doc.render();
}
