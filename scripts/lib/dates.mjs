// Dates in words: the panels say "oct 2026", never 2026-10, which reads as a dash range.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "oct" for a 1-based month number
export const monthShort = (m) => MONTHS[m - 1].slice(0, 3).toLowerCase();

// "oct 2, 2026 · 04:09" for a Date, in UTC
export function utcStamp(d) {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${monthShort(d.getUTCMonth() + 1)} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hh}:${mm}`;
}
