// Small geometry helpers for the procedural grid and the routes.

// Uniform Catmull-Rom through control points, sampled `per` points per span.
export function catmull(ctrl, per = 8) {
  const p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Cumulative arc length along a polyline.
export function arcLengths(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i]));
  return s;
}

// Split a polyline into runs of consecutive segments whose midpoint passes `keep`.
export function runs(pts, keep) {
  const out = [];
  let cur = null;
  for (let i = 1; i < pts.length; i++) {
    const mid = [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2];
    if (keep(mid)) {
      if (!cur) {
        cur = [pts[i - 1]];
        out.push(cur);
      }
      cur.push(pts[i]);
    } else cur = null;
  }
  return out;
}
