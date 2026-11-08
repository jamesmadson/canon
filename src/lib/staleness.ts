/**
 * Staleness for the v2 prototype index.
 *
 * Retiring work is a feature, so this is a first-class rule rather than a
 * display detail: a prototype with no activity for three weeks gets flagged,
 * and the flag says how long it has been quiet rather than shouting a colour.
 *
 * Three weeks rather than two: a fortnight catches anything anyone took a
 * holiday over, and a flag that fires on ordinary quiet is a flag people learn
 * to ignore.
 *
 * Everything is computed against an explicit "as of" date. The preview is
 * scripted, so its dates must not drift into "everything is stale" a month
 * from now.
 */
export const STALE_AFTER_DAYS = 21;

const MS_PER_DAY = 86_400_000;

function utcMidnight(isoDate: string): number {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Not an ISO date (YYYY-MM-DD): ${isoDate}`);
  return ms;
}

/** Whole days between a last-activity date and the reference date. Never negative. */
export function daysIdle(lastActivity: string, asOf: string): number {
  return Math.max(0, Math.round((utcMidnight(asOf) - utcMidnight(lastActivity)) / MS_PER_DAY));
}

export function isStale(lastActivity: string, asOf: string): boolean {
  return daysIdle(lastActivity, asOf) >= STALE_AFTER_DAYS;
}

/** Relative wording holds for a week; after that a date is easier to place. */
export const RELATIVE_UNTIL_DAYS = 7;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct" in the reference year, "12 Oct 2024" in an earlier one. */
function plainDate(lastActivity: string, asOf: string): string {
  const then = new Date(utcMidnight(lastActivity));
  const day = `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
  return then.getUTCFullYear() === new Date(utcMidnight(asOf)).getUTCFullYear()
    ? day
    : `${day} ${then.getUTCFullYear()}`;
}

/** "Today" / "2 days ago" up to a week, then "12 Oct" or "12 Oct 2024". */
export function idleLabel(lastActivity: string, asOf: string): string {
  const days = daysIdle(lastActivity, asOf);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= RELATIVE_UNTIL_DAYS) return `${days} days ago`;
  return plainDate(lastActivity, asOf);
}

/**
 * The line a card carries: "Updated 2 days ago", or "Updated 12 Oct" once it
 * is older than a week. Derived on every card from the same two dates, so no
 * card can be caught holding a sentence the data stopped agreeing with.
 */
export function updatedLabel(lastActivity: string, asOf: string): string {
  const days = daysIdle(lastActivity, asOf);
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days <= RELATIVE_UNTIL_DAYS) return `Updated ${days} days ago`;
  return `Updated ${plainDate(lastActivity, asOf)}`;
}

/** The flag itself: the word, and the count that earned it. */
export function staleLabel(lastActivity: string, asOf: string): string {
  return `Stale · ${daysIdle(lastActivity, asOf)} days`;
}
