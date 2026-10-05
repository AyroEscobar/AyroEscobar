// Hero: his whole-map sentence fills the panel in the italic serif, set over a warm light field
// with a faint grid, and a clear glass lens, one line tall, rests on the second line and
// magnifies the words under it the way a glass rod does (taller, barely wider). Where motion is
// allowed the lens reads the sentence: it steps down one line every four seconds and comes
// back. The masthead (name, role and city) sits above it; a glass pill names the site.
import { palettes, type, motion, fonts, frame } from '../tokens.mjs';
import { Doc, el, fmt } from '../svg.mjs';
import { field, drawField, glass, panelEdge, edgeMagnify } from '../glass.mjs';

const W = 880;
const X = 56; // left edge of the type
const NAME_Y = 76;
const LINE_Y = 116;
const FIRST = 214; // baseline of the sentence's first line
const LENS_LINE = 1; // the lens rests on the second line
const MAG = [1.04, 1.16]; // a horizontal rod: barely wider, clearly taller

// Hand-set breaks (DESIGN.md 8.2). The joined lines must equal the sentence in profile.json.
const BREAKS = ['I am trying to build a life', 'where my family never has to', 'worry about money, and ship a', 'few things that outlast me', 'along the way.'];

// Typographer's apostrophes and quotes for the serif; the source text stays plain ASCII.
const curly = (s) => s.replace(/(\w)'(\w)/g, '$1’$2');

export function hero(profile, theme) {
  const pal = palettes[theme];
  const { name, line, site, sentence, alt } = profile.identity;
  if (BREAKS.join(' ') !== sentence) throw new Error('hero: the hand-set lines no longer match identity.sentence');

  const size = type.sentence;
  const lead = type.sentenceLead;
  const last = FIRST + (BREAKS.length - 1) * lead;
  const H = Math.round(last + size * 0.31 + 44);
  const doc = new Doc({ w: W, h: H, pal, title: name, desc: alt });

  // the sentence is part of the field, so the lens magnifies it
  const lines = BREAKS.map((l, i) => doc.text(fonts.display, curly(l), { x: X, y: FIRST + i * lead, size }));
  for (const l of lines) if (l.end > W - 40) throw new Error('hero: a sentence line runs off the panel');
  const widest = Math.max(...lines.slice(LENS_LINE).map((l) => l.width));

  // the lens: one line and a fifth tall, centred on the line's ink, wide enough for the
  // longest line it will read once magnified
  const lensH = Math.round(lead * 1.2);
  const lensY = FIRST + LENS_LINE * lead - size * 0.3 - lensH / 2;
  const lensX = X - 30;
  const lensW = Math.round(widest * MAG[0] + 64);
  if (lensX + lensW > W - 24) throw new Error('hero: the lens is too wide');

  field(doc, {
    w: W,
    h: H,
    theme,
    blobs: [
      { c: 'peach', x: 150, y: 150, r: 360 },
      { c: 'butter', x: 480, y: 20, r: 300 },
      { c: 'sky', x: 820, y: 250, r: 340 },
      { c: 'lilac', x: 640, y: H + 20, r: 320 },
      { c: 'rose', x: 250, y: 400, r: 280 },
      { c: 'core', x: 300, y: lensY + lensH / 2, rx: 300, ry: 150 },
    ],
    grid: { size: 64, alpha: theme === 'light' ? 0.06 : 0.07, fade: [H - 220, H - 40] },
    pools: [
      { x: X - 30, y: 34, w: 470, h: 108 },
      { x: X - 30, y: FIRST - size * 0.8 - 10, w: Math.max(...lines.map((l) => l.width)) + 70, h: last - FIRST + size * 1.2 + 20 },
    ],
    extra: el('g', { fill: pal.ink }, lines.map((l) => l.markup).join('')),
  });

  // the site, as a glass pill top right
  const pillText = doc.text(fonts.sans, site, { x: 0, y: 0, size: type.label });
  const pillH = 52;
  const pillW = Math.round(pillText.width + 48);
  const pillX = W - 36 - pillW;
  const pillY = 40;
  const pill = glass(doc, { id: 'p', x: pillX, y: pillY, w: pillW, h: pillH, r: pillH / 2, kind: 'pill', theme });
  const pillLabel = doc.text(fonts.sans, site, { x: pillX + pillW / 2, y: pillY + pillH / 2 + type.label * 0.36, size: type.label, anchor: 'middle' });

  const lens = glass(doc, {
    id: 'l', x: lensX, y: lensY, w: lensW, h: lensH, r: lensH / 2, kind: 'clear', theme, magnify: MAG,
    backdropClass: 'lens-in', edgeClass: 'lens-edge',
  });

  const nameRun = doc.text(fonts.sans, name, { x: X, y: NAME_Y, size: type.heroName, tracking: -0.01 });
  const lineRun = doc.text(fonts.text, line, { x: X, y: LINE_Y, size: type.heroLine });
  if (lineRun.end > pillX - 24) throw new Error('hero: the role line runs into the pill');

  // The lens and its backdrop move together; inside the moving lens the backdrop counter-moves
  // by the magnification, so the words under it are always the right words. One @keyframes,
  // three elements, each scaling the step with its own --k.
  const step = lead;
  const edge = edgeMagnify(MAG);
  const at = (n) => `transform:translateY(calc(var(--k)*${n * step}px))`;
  doc.style =
    `.lens{--k:1}.lens-in{--k:${fmt(-MAG[1])}}.lens-edge{--k:${fmt(-edge[1])}}` +
    `@media (prefers-reduced-motion:no-preference){` +
    `.lens,.lens-in,.lens-edge{animation:read ${motion.lensSeconds}s cubic-bezier(.22,1,.36,1) infinite}` +
    `.streak{animation:sk ${motion.streakSeconds}s ease-in-out infinite}` +
    `@keyframes read{0%,19%{${at(0)}}25%,44%{${at(1)}}50%,69%{${at(2)}}75%,90%{${at(3)}}100%{${at(0)}}}` +
    `@keyframes sk{50%{opacity:${motion.streakLow}}}}`;

  doc.add(
    drawField(doc, { w: W, h: H, r: frame.radius }),
    pill.markup,
    el('g', { fill: pal.ink }, pillLabel.markup),
    el('g', { class: 'lens' }, lens.markup),
    el('g', { fill: pal.ink }, nameRun.markup),
    el('g', { fill: pal.ink2 }, lineRun.markup),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}
