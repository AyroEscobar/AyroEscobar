// Live pulse: the last 52 weeks of GitHub activity drawn as one lit route, redrawn daily by
// the render-profile workflow. Weekly sums, log scaled, no axis and no numbers; the only
// number on the panel is the real time of the last sync.
import { palettes, type, fonts } from '../tokens.mjs';
import { Doc, el, panelBase, panelFrame } from '../svg.mjs';

const W = 880;
const H = 120;
const X0 = 46;
const SEG = 15;
const Y = 44;
const WEEKS = 52;

function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// weeks: 52 weekly totals, oldest first. stamp: "YYYY-MM-DD HH:MM".
export function pulse(weeks, stamp, theme, alt) {
  if (weeks.length !== WEEKS) throw new Error(`pulse needs ${WEEKS} weeks, got ${weeks.length}`);
  const pal = palettes[theme];
  const doc = new Doc({ w: W, h: H, pal, title: 'Pulse', desc: alt });
  panelBase(doc);

  const max = Math.max(...weeks);
  const level = (w) => (max > 0 ? Math.log1p(w) / Math.log1p(max) : 0);
  const end = X0 + WEEKS * SEG;
  let glow = '';
  const segs = weeks
    .map((w, i) => {
      const t = level(w);
      const x1 = X0 + i * SEG + 1;
      const x2 = X0 + (i + 1) * SEG - 1;
      if (t > 0.55) glow += `M${x1} ${Y}H${x2}`;
      return el('path', {
        d: `M${x1} ${Y}H${x2}`,
        stroke: mix(pal.trace, pal.sodiumStroke, t),
        'stroke-width': 2.5 + 2.5 * t,
      });
    })
    .join('');

  const line = doc.text(fonts.mono, `last sync ${stamp} utc · rebuilt daily`, { x: X0, y: 96, size: type.pulseLine });
  if (line.end > W - 38) throw new Error('pulse: stamp line too wide');

  doc.add(
    el('path', { d: `M${X0 - 26} ${Y}H${X0}`, stroke: pal.trace, 'stroke-width': 2, 'stroke-dasharray': '2 5', fill: 'none' }),
    glow ? el('path', { d: glow, stroke: pal.sodiumStroke, 'stroke-width': 10, 'stroke-opacity': 0.13, fill: 'none' }) : '',
    el('g', { fill: 'none' }, segs),
    el('circle', { cx: end + 2, cy: Y, r: 10, fill: pal.night }),
    el('circle', { cx: end + 2, cy: Y, r: 6.5, fill: pal.led }),
    el('g', { fill: pal.dim }, line.markup),
  );
  panelFrame(doc);
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
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
  return Object.keys(palettes).map((theme) => [`pulse-${theme}.svg`, pulse(weeks, stamp, theme, profile.pulse.alt)]);
}
