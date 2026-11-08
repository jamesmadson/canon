import { describe, expect, it } from 'vitest';
import { idleLabel, isStale, staleLabel, updatedLabel } from '../../src/lib/staleness';

const asOf = '2026-11-07';

describe('updatedLabel', () => {
  // Mutation: return the old `Updated ${days} days ago` for every age; the date cases fail.
  it('stays relative up to 7 days', () => {
    expect(updatedLabel('2026-11-07', asOf)).toBe('Updated today');
    expect(updatedLabel('2026-11-06', asOf)).toBe('Updated yesterday');
    expect(updatedLabel('2026-11-04', asOf)).toBe('Updated 3 days ago');
    expect(updatedLabel('2026-10-31', asOf)).toBe('Updated 7 days ago');
  });

  // Mutation: move the cut to `days >= 7` or `days > 8`; the 7 and 8 day cases fail.
  it('turns into a plain date after 7 days', () => {
    expect(updatedLabel('2026-10-30', asOf)).toBe('Updated 30 Oct');
    expect(updatedLabel('2026-10-12', asOf)).toBe('Updated 12 Oct');
  });

  // Mutation: drop the year check; the earlier-year cases lose their year.
  it('adds the year for an earlier year', () => {
    expect(updatedLabel('2024-10-12', asOf)).toBe('Updated 12 Oct 2024');
    expect(updatedLabel('2025-12-31', asOf)).toBe('Updated 31 Dec 2025');
  });
});

describe('idleLabel', () => {
  // Mutation: leave idleLabel on `${days} days ago`; the date cases fail.
  it('follows the same rule', () => {
    expect(idleLabel('2026-11-05', asOf)).toBe('2 days ago');
    expect(idleLabel('2026-10-12', asOf)).toBe('12 Oct');
    expect(idleLabel('2024-10-12', asOf)).toBe('12 Oct 2024');
  });
});

describe('staleness meaning', () => {
  // Mutation: tie isStale to the 7 day cut instead of STALE_AFTER_DAYS.
  it('still flags at 21 days, whatever the words say', () => {
    expect(isStale('2026-10-18', asOf)).toBe(false);
    expect(isStale('2026-10-17', asOf)).toBe(true);
    expect(staleLabel('2026-10-17', asOf)).toBe('Stale · 21 days');
  });
});
