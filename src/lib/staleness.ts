/**
 * Staleness for the v2 prototype index.
 *
 * Retiring work is a feature, so this is a first-class rule rather than a
 * display detail: a prototype with no activity for two weeks gets flagged,
 * and the flag says how long it has been quiet rather than shouting a colour.
 *
 * Everything is computed against an explicit "as of" date. The preview is
 * scripted, so its dates must not drift into "everything is stale" a month
 * from now.
 */
export const STALE_AFTER_DAYS = 14;

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

/** "Today" / "2 days ago" / "26 days ago" — plain words, no relative-time API. */
export function idleLabel(lastActivity: string, asOf: string): string {
  const days = daysIdle(lastActivity, asOf);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
