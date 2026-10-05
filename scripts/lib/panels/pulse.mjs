// Live pulse: the last 52 weeks of GitHub activity drawn as 52 bars of neon light over the
// night slope, the stamp of the last sync on a small glass pill. Redrawn daily by the
// render-profile workflow. Weekly sums, log scaled, no axis and no numbers; the only number on
// the panel is the real time of the last sync.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { world, drawWorld, glass, panelEdge } from '../glass.mjs';
import { utcStamp } from '../dates.mjs';

const W = 880;
const H = 168;
const X0 = 52;
const X1 = 828;
const MID = 62; // bars are centred on this line, like a waveform
const WEEKS = 52;

// weeks: 52 weekly totals, oldest first. stamp: "oct 2, 2026 · 04:09" (utc).
export function pulse(weeks, stamp, theme, alt) {
  if (weeks.length !== WEEKS) throw new Error(`pulse needs ${WEEKS} weeks, got ${weeks.length}`);
  const pal = palettes[theme];
  const doc = new Doc({ w: W, h: H, pal, title: 'Pulse', desc: alt });

  world(doc, {
    w: W, h: H, theme,
    horizon: H * 0.62,
    ridge: { base: H * 0.6, amp: 14, seed: 21 },
    slope: { y0: H * 1.05, y1: H * 0.72 },
    contours: 2,
    seed: 9,
  });
  doc.add(drawWorld(doc, { w: W, h: H, r: frame.radius }));

  const max = Math.max(...weeks);
  const level = (w) => (max > 0 ? Math.log1p(w) / Math.log1p(max) : 0);
  const pitch = (X1 - X0) / WEEKS;
  const bw = 6;
  const bars = weeks
    .map((w, i) => {
      const t = level(w);
      const h = 6 + 70 * t;
      const x = X0 + i * pitch + (pitch - bw) / 2;
      return el('rect', { x, y: MID - h / 2, width: bw, height: h, rx: bw / 2, 'fill-opacity': Math.round((0.35 + 0.65 * t) * 100) / 100 });
    })
    .join('');
  doc.shared('neon', el('filter', { id: 'neon', x: '-10%', y: '-60%', width: '120%', height: '220%' }, el('feGaussianBlur', { stdDeviation: 5 })));
  doc.add(
    el('g', { fill: pal.accent, opacity: 0.7, filter: 'url(#neon)' }, bars),
    el('g', { fill: pal.accent }, bars),
  );

  const line = doc.text(fonts.text, `last sync ${stamp} utc`, { x: X0 + 22, y: 140, size: type.pulseLine });
  if (line.end > W - 60) throw new Error('pulse: stamp line too wide');
  const pill = { x: X0 - 4, y: 110, w: line.width + 52, h: 44 };
  doc.add(
    glass(doc, { id: 'p', ...pill, r: 22, theme, pill: true, scrims: [{ x: pill.x + 3, y: pill.y + 3, w: pill.w - 6, h: pill.h - 6, r: 19 }], light: { x: W, y: 0 } }).markup,
    el('g', { fill: pal.ink3 }, line.markup),
    panelEdge(doc, { w: W, h: H, r: frame.radius, theme }),
  );
  return doc.render();
}

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount date}}}}}}`;

export async function fetchWeeks(login, token) {
  if (!token) throw new Error('GH_TOKEN is not set');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'render-profile' },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status}`);
  const body = await res.json();
  if (body.errors) throw new Error(`GitHub API error: ${JSON.stringify(body.errors).slice(0, 300)}`);
  const weeks = body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks) || weeks.length < WEEKS) throw new Error(`expected at least ${WEEKS} weeks, got ${weeks?.length ?? 0}`);
  return weeks.slice(-WEEKS).map((w) => w.contributionDays.reduce((n, d) => n + d.contributionCount, 0));
}

export async function liveFiles(profile, { token, now }) {
  const weeks = await fetchWeeks(profile.pulse.login, token);
  const stamp = utcStamp(now);
  return Object.keys(palettes).map((theme) => [`pulse-${theme}.svg`, pulse(weeks, stamp, theme, profile.pulse.alt)]);
}
