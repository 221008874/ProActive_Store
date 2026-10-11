// Day boundaries for the nightly rollup and the stuck-order sweep.
//
// The store is Egyptian (UTC+2 year-round, no DST), so a business day is not
// the UTC day. Cairo local midnight is 22:00 UTC of the previous UTC day, and
// both jobs share these bounds so a rollup row and a reminder sweep agree on
// what "yesterday" means.

export const EGYPT_OFFSET_HOURS = 2;
const OFFSET_MS = EGYPT_OFFSET_HOURS * 60 * 60 * 1000;

// The bounds of the most recently COMPLETED Egypt day, plus its Cairo-date
// key. At 22:30 UTC (00:30 Cairo) that is the day that just ended.
export function egyptPreviousDay(now = new Date()) {
  const shifted = new Date(now.getTime() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  // The shifted components are the Cairo wall clock; Cairo local midnight for
  // that date is that wall time minus the offset (Date.UTC on the shifted
  // components would double-count it).
  const end = new Date(Date.UTC(y, m, d) - OFFSET_MS);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  // The key is the CAIRO date of the window, not the UTC date of its edges.
  const key = new Date(start.getTime() + OFFSET_MS).toISOString().slice(0, 10);

  return { key, start, end };
}
