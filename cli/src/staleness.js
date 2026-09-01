/**
 * Staleness for the prototype index.
 *
 * Retiring work is part of the job, so the state is a computed property of a
 * date rather than a label somebody remembers to set. Three states: active
 * under fourteen days, quiet from fourteen to twenty, stale at twenty one.
 *
 * The label always carries the real number. "quiet" on its own invites a
 * reader to supply their own scale; "quiet 16 days" does not.
 */

const MS_PER_DAY = 86400000;

export const QUIET_AFTER_DAYS = 14;
export const STALE_AFTER_DAYS = 21;

function utcMidnight(isoDate) {
  const ms = Date.parse(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Not an ISO date (YYYY-MM-DD): ${isoDate}`);
  return ms;
}

/** Whole UTC days between a commit date and the reference date. Never negative. */
export function daysBetween(lastCommit, asOf) {
  return Math.max(0, Math.round((utcMidnight(asOf) - utcMidnight(lastCommit)) / MS_PER_DAY));
}

/** The sentence a card carries: the state and the count that earned it. */
export function stalenessLabel(state, days) {
  if (days === 0) return `${state} today`;
  return `${state} ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function stalenessOf(lastCommit, asOf) {
  const days = daysBetween(lastCommit, asOf);
  const state = days >= STALE_AFTER_DAYS ? 'stale' : days >= QUIET_AFTER_DAYS ? 'quiet' : 'active';
  return { state, days, label: stalenessLabel(state, days) };
}
