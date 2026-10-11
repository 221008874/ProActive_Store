// Day boundaries for the nightly rollup and the stuck-order sweep.
//
// The store is Egyptian (UTC+2 year-round, no DST), so "yesterday" for a
// business day is not the UTC day. Both jobs share this so a rollup row and
// a reminder sweep agree on what "today" means.

export const EGYPT_OFFSET_HOURS = 2;

// The bounds of the most recently COMPLETED Egypt day, plus its yyyy-mm-dd
// key. At 01:00 Cairo time that is the day before yesterday's remainder;
// at 23:00 it is the day that just ended.
export function egyptPreviousDay(now = new Date()) {
  const shifted = new Date(now.getTime() + EGYPT_OFFSET_HOURS * 60 * 60 * 1000);
  const endLocalMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(endLocalMidnight - 24 * 60 * 60 * 1000);
  const end = new Date(endLocalMidnight);

  return { key: start.toISOString().slice(0, 10), start, end };
}
