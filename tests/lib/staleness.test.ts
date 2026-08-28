import { describe, it, expect } from 'vitest';
import { daysIdle, idleLabel, isStale, STALE_AFTER_DAYS } from '../../src/lib/staleness';

describe('daysIdle', () => {
  it('counts whole days between the two dates', () => {
    expect(daysIdle('2026-08-25', '2026-08-27')).toBe(2);
    expect(daysIdle('2026-08-01', '2026-08-27')).toBe(26);
  });

  it('returns 0 for same-day activity', () => {
    expect(daysIdle('2026-08-27', '2026-08-27')).toBe(0);
  });

  it('never returns a negative count for a future date', () => {
    expect(daysIdle('2026-09-04', '2026-08-27')).toBe(0);
  });

  it('rejects anything that is not an ISO date', () => {
    expect(() => daysIdle('yesterday', '2026-08-27')).toThrow();
  });
});

describe('isStale', () => {
  it('flags at the threshold, not one day after it', () => {
    const asOf = '2026-08-27';
    expect(STALE_AFTER_DAYS).toBe(14);
    expect(isStale('2026-08-13', asOf)).toBe(true);
    expect(isStale('2026-08-14', asOf)).toBe(false);
  });
});

describe('idleLabel', () => {
  it('uses words for the near dates and a count beyond them', () => {
    expect(idleLabel('2026-08-27', '2026-08-27')).toBe('Today');
    expect(idleLabel('2026-08-26', '2026-08-27')).toBe('Yesterday');
    expect(idleLabel('2026-08-18', '2026-08-27')).toBe('9 days ago');
  });
});
