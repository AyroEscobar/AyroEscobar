// Hero: his name set over an abstract night grid. The roads near one focal node are lit in
// sodium with streetlights along them, a red obstruction beacon cycles at the node, and one
// LED packet comes in along an arterial and arrives at the node. The grid is procedural and
// seeded: it depicts no real place. Text gets a cartographic halo (the grid is masked out
// around the name's glyphs and under a plate behind each mono label).
import { palettes, type, motion, fonts, frame } from '../tokens.mjs';
import { Doc, el, fmt, panelBase, panelFrame, polyD } from '../svg.mjs';
import { prng } from '../prng.mjs';
import { catmull, dist, arcLengths, runs } from '../geom.mjs';

const W = 880;
const H = 280;
const FOCAL = [726, 212]; // right of the subtitle, under the end of "Escobar", in open ground
const LIT_RADIUS = 300;
const SEED = 'sodium';
const ASCENT = 0.73; // Overpass Mono: tallest ascender and deepest descender, per em
const DESCENT = 0.22;

// The grid is the same for both themes; only the palette changes. About fifty roads: two
// spines, ten loose arterials (some end at a spine, the way real ones do), short collectors
// between them, a beltway around the node and spurs that get denser toward it.
function grid() {
  const r = prng(SEED);
  const [fx, fy] = FOCAL;
  const roads = [];

  // Two near-vertical spines. Spine A runs through the focal node, spine B through the gap
  // between the two words of the name.
  const spineA = catmull([
    [fx + r.range(16, 30), -24],
    [fx + r.range(4, 12), 80],
    [fx, fy],
    [fx - r.range(8, 20), H + 24],
  ]);
  const bx = r.range(304, 316);
  const spineB = catmull([
    [bx - r.range(10, 24), -24],
    [bx + r.range(-6, 6), 100],
    [bx + r.range(6, 16), 200],
    [bx + r.range(14, 30), H + 24],
  ]);
  roads.push(spineA, spineB);
  const xAt = (pts, y) => pts.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a))[0];

  // Ten arterials. Trace 2 bends through the node and runs out to the east edge; the packet
  // comes in along it. The others are loosely parallel and some stop at a spine.
  const levels = [18, 48, fy, 96, 132, 166, 192, 244, 266, 78];
  const traces = levels.map((y0, i) => {
    const slope = r.range(-0.1, 0.1);
    const yAt = (x) => y0 + slope * (x - 440) + r.range(-12, 12);
    let ctrl;
    if (i === 2) {
      ctrl = [[-24, yAt(-24)], [200, yAt(200)], [440, yAt(440)], [fx - 120, fy + r.range(-10, 4)], [fx, fy], [W + 24, fy - r.range(8, 18)]];
    } else {
      const start = i % 3 === 1 ? xAt(spineB, y0) : -24;
      const stop = i % 4 === 3 ? xAt(spineA, y0) : W + 24;
      const xs = [start];
      for (let x = start + r.range(150, 230); x < stop - 80; x += r.range(160, 240)) xs.push(x);
      xs.push(stop);
      ctrl = xs.map((x) => [x, yAt(x)]);
    }
    return catmull(ctrl, 10);
  });
  roads.push(...traces);

  // Collectors: short near-vertical streets from one arterial to the next.
  const order = traces.map((t, i) => [levels[i], t]).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  for (let c = 0; c < 8; c++) {
    const k = r.int(0, order.length - 2);
    const x = r.range(40, W - 40);
    const near = (t) => t.reduce((a, b) => (Math.abs(b[0] - x) < Math.abs(a[0] - x) ? b : a));
    const [a, b] = [near(order[k]), near(order[k + 1])];
    if (Math.abs(a[0] - x) > 30 || Math.abs(b[0] - x) > 30) continue;
    roads.push(catmull([a, [(a[0] + b[0]) / 2 + r.range(-8, 8), (a[1] + b[1]) / 2], b], 4));
  }

  // A beltway around the node, centred just above it so the loop sits under "Escobar".
  const loop = [];
  const n = 40;
  const tilt = r.range(-0.25, 0.1);
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rad = 1 + r.range(-0.05, 0.05) * (k % n ? 1 : 0);
    const ex = Math.cos(a) * 128 * rad;
    const ey = Math.sin(a) * 74 * rad;
    loop.push([fx - 40 + ex * Math.cos(tilt) - ey * Math.sin(tilt), fy - 30 + ex * Math.sin(tilt) + ey * Math.cos(tilt)]);
  }
  loop[n] = loop[0];
  roads.push(loop);

  // Twenty-eight spurs, denser near the node, the way a downtown is.
  const anchors = [spineA, loop, traces[2], traces[6], traces[7], spineB, ...traces];
  for (let s = 0; s < 28; s++) {
    const src = s < 16 ? anchors[s % 5] : r.pick(anchors);
    const p = src[r.int(2, src.length - 3)];
    const ang = r.range(0, Math.PI * 2);
    const len = r.range(30, 110);
    const bend = r.range(-0.5, 0.5);
    const mid = [p[0] + Math.cos(ang) * len * 0.5, p[1] + Math.sin(ang) * len * 0.5];
    const end = [p[0] + Math.cos(ang + bend) * len, p[1] + Math.sin(ang + bend) * len];
    roads.push(catmull([p, mid, end], 5));
  }
  return { roads, inbound: traces[2] };
}

export function hero(profile, theme) {
  const pal = palettes[theme];
  const { name, line, site, alt } = profile.identity;
  const doc = new Doc({ w: W, h: H, pal, title: name, desc: alt });
  const [fx, fy] = FOCAL;
  const { roads, inbound } = grid();

  // Type, defined once and used twice: as ink, and as a halo inside the grid's mask.
  const runs_ = [
    { id: 'tn', font: fonts.display, str: name, x: 48, y: 152, size: type.heroName, tracking: -0.02, fill: pal.ink, halo: 12 },
    { id: 'tl', font: fonts.mono, str: line, x: 48, y: 210, size: type.heroLine, tracking: -0.02, fill: pal.dim, halo: 14, plate: true, plateTop: 150 },
    { id: 'tc', font: fonts.mono, str: site, x: W - 36, y: 46, size: type.label, anchor: 'end', fill: pal.sodium, halo: 10, plate: true },
  ];
  // The name keeps a halo that follows each glyph. The two mono runs get one rounded label
  // plate each, so no stub of road survives between glyphs and reads as punctuation.
  const plates = [];
  for (const t of runs_) {
    const run = doc.text(t.font, t.str, { ...t, id: t.id });
    if (run.x < 40 || run.end > W - 34) throw new Error(`hero text out of bounds: ${t.str} (${run.x}..${run.end})`);
    doc.defs.push(run.markup);
    if (t.plate) {
      // the subtitle's plate reaches up to the name's baseline, so no road survives in the gap
      const top = t.plateTop ?? t.y - ASCENT * t.size - t.halo;
      plates.push({ x: run.x - t.halo, y: top, width: run.width + 2 * t.halo, height: t.y + DESCENT * t.size + t.halo - top, rx: t.halo });
    }
  }
  // the beacon sits in open ground: 40 units clear of every label plate, 150 from the east edge
  for (const b of plates) {
    const dx = Math.max(b.x - fx, 0, fx - b.x - b.width);
    const dy = Math.max(b.y - fy, 0, fy - b.y - b.height);
    if (Math.hypot(dx, dy) < 40) throw new Error('hero: the beacon is too close to a label');
  }
  if (W - fx < 150) throw new Error('hero: the beacon is too close to the east edge');

  const near = (p) => dist(p, FOCAL) < LIT_RADIUS;
  const allD = roads.map((p) => polyD(p, false)).join('');
  const litD = roads.flatMap((p) => runs(p, near)).map((p) => polyD(p)).join('');

  // Packet geometry: one dash that comes in from the east edge along the arterial through the
  // node and arrives at the beacon. Parked (no motion) just short of it.
  const iF = inbound.findIndex((p) => p[0] === fx && p[1] === fy);
  const route = inbound.slice(iF).reverse();
  const s = arcLengths(route);
  const total = s[s.length - 1];
  const P = motion.packetLength;
  const parked = -(total - 10 - P);

  doc.defs.push(
    el('path', { id: 'rd', d: allD }),
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
    // mask luminance: white keeps the grid, black (the name's glyph halos, the label plates)
    // knocks it out
    el(
      'mask',
      { id: 'hm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      el('rect', { width: W, height: H, fill: '#fff' }) +
        runs_
          .filter((t) => !t.plate)
          .map((t) =>
            el('use', {
              href: `#${t.id}`,
              fill: '#000',
              stroke: '#000',
              'stroke-width': (2 * t.halo * 1000) / t.size, // halo extends t.halo units past each glyph edge
              'stroke-linejoin': 'round',
            }),
          )
          .join('') +
        plates.map((b) => el('rect', { ...b, fill: '#000' })).join(''),
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
  const packet = { class: 'pk', d: polyD(route), stroke: pal.led, 'stroke-dasharray': `${fmt(P)} ${fmt(total + P)}` };
  doc.add(
    el(
      'g',
      { 'clip-path': 'url(#cp)', mask: 'url(#hm)', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      el('use', { href: '#rd', stroke: pal.trace, 'stroke-width': 1.2 }) +
        // faint streetlights on every road, so the whole city twinkles and the district is
        // simply the brightest part of it
        el('use', { href: '#rd', stroke: pal.traceLit, 'stroke-width': 2.6, 'stroke-dasharray': '0 11', 'stroke-opacity': 0.35 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 5, 'stroke-opacity': 0.16 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 1.3 }) +
        el('use', { href: '#lit', stroke: 'url(#lg)', 'stroke-width': 2.6, 'stroke-dasharray': '0 11' }) +
        el('path', { ...packet, 'stroke-width': 7, 'stroke-opacity': 0.2 }) +
        el('path', { ...packet, 'stroke-width': 3.5 }),
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
