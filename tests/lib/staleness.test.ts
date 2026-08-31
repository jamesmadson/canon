import { describe, it, expect } from 'vitest';
import {
  daysIdle,
  idleLabel,
  isStale,
  staleLabel,
  STALE_AFTER_DAYS,
  updatedLabel,
} from '../../src/lib/staleness';
import { PREVIEW_AS_OF, PROTOTYPES } from '../../src/data/v2Preview';

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
    expect(STALE_AFTER_DAYS).toBe(21);
    expect(isStale('2026-08-06', asOf)).toBe(true);
    expect(isStale('2026-08-07', asOf)).toBe(false);
  });

  it('flags at least one of the scripted prototypes', () => {
    expect(PROTOTYPES.filter((p) => isStale(p.lastActivity, PREVIEW_AS_OF)).length).toBeGreaterThan(
      0,
    );
  });
});

describe('idleLabel', () => {
  it('uses words for the near dates and a count beyond them', () => {
    expect(idleLabel('2026-08-27', '2026-08-27')).toBe('Today');
    expect(idleLabel('2026-08-26', '2026-08-27')).toBe('Yesterday');
    expect(idleLabel('2026-08-18', '2026-08-27')).toBe('9 days ago');
  });
});

describe('updatedLabel', () => {
  it('says when, in the card’s own words', () => {
    expect(updatedLabel('2026-08-27', '2026-08-27')).toBe('Updated today');
    expect(updatedLabel('2026-08-26', '2026-08-27')).toBe('Updated yesterday');
    expect(updatedLabel('2026-08-01', '2026-08-27')).toBe('Updated 26 days ago');
  });
});

describe('staleLabel', () => {
  it('carries the count that earned the flag', () => {
    expect(staleLabel('2026-08-01', '2026-08-27')).toBe('Stale · 26 days');
  });
});
