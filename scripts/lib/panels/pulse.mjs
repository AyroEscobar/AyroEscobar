// Live pulse: the last 52 weeks of GitHub activity drawn as 52 bars of light on the field, and a
// clear glass rod (the hero's lens) resting over the latest thirteen weeks, magnifying them.
// Redrawn daily by the render-profile workflow. Weekly sums, log scaled, no axis and no
// numbers; the only number on the panel is the real time of the last sync.
import { palettes, type, fonts, frame } from '../tokens.mjs';
import { Doc, el } from '../svg.mjs';
import { field, drawField, glass, panelEdge } from '../glass.mjs';
import { utcStamp } from '../dates.mjs';

const W = 880;
const H = 150;
const X0 = 52;
const X1 = 828;
const MID = 54; // bars are centred on this line, like a waveform
const WEEKS = 52;
const LENS_WEEKS = 13;

// weeks: 52 weekly totals, oldest first. stamp: "oct 2, 2026 · 04:09" (utc).
export function pulse(weeks, stamp, theme, alt) {
  if (weeks.length !== WEEKS) throw new Error(`pulse needs ${WEEKS} weeks, got ${weeks.length}`);
  const pal = palettes[theme];
  const doc = new Doc({ w: W, h: H, pal, title: 'Pulse', desc: alt });

  const max = Math.max(...weeks);
  const level = (w) => (max > 0 ? Math.log1p(w) / Math.log1p(max) : 0);
  const pitch = (X1 - X0) / WEEKS;
  const bw = 7;
  const bars = weeks
    .map((w, i) => {
      const t = level(w);
      const h = 6 + 52 * t;
      const x = X0 + i * pitch + (pitch - bw) / 2;
      return el('rect', { x, y: MID - h / 2, width: bw, height: h, rx: bw / 2, 'fill-opacity': Math.round((0.32 + 0.68 * t) * 100) / 100 });
    })
    .join('');

  const line = doc.text(fonts.text, `last sync ${stamp} utc`, { x: X0, y: 124, size: type.pulseLine });
  if (line.end > W - 38) throw new Error('pulse: stamp line too wide');

  field(doc, {
    w: W,
    h: H,
    theme,
    blobs: [
      { c: 'sky', x: 140, y: 40, r: 260 },
      { c: 'lilac', x: 470, y: 150, r: 240 },
      { c: 'peach', x: 760, y: 30, r: 240 },
      { c: 'rose', x: 860, y: 150, r: 180, k: 0.8 },
    ],
    pools: [{ x: X0 - 20, y: 92, w: line.width + 40, h: 46 }],
    extra: el('g', { fill: pal.accent }, bars),
  });
  doc.add(drawField(doc, { w: W, h: H, r: frame.radius }));

  const lx = X0 + (WEEKS - LENS_WEEKS) * pitch - 6;
  const lens = glass(doc, { id: 'l', x: lx, y: MID - 38, w: X1 + 14 - lx, h: 76, r: 38, kind: 'clear', theme, magnify: [1.04, 1.18] });
  doc.add(lens.markup, el('g', { fill: pal.ink2 }, line.markup), panelEdge(doc, { w: W, h: H, r: frame.radius, theme }));
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
