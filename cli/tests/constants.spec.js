import { describe, it, expect } from 'vitest';

/**
 * The CLI and the site have to agree, and nothing else makes them.
 *
 * Both sides compute staleness and evidence strength, and both were written
 * from the same decisions rather than from each other: the CLI ships as plain
 * JavaScript with no dependency on the site, so it cannot import these at run
 * time. That independence is the point, and it is also how the two quietly
 * drift apart. This file is the only thing holding them together, so it reaches
 * across the boundary deliberately. A test may; the shipped CLI may not, which
 * the git suite enforces separately.
 *
 * The file is named .spec.js rather than .test.js on purpose. It runs only if
 * the root vitest config collects that spelling, so its passing is the proof.
 */

import { QUIET_AFTER_DAYS, STALE_AFTER_DAYS, daysBetween, stalenessOf } from '../src/staleness.js';
import { strengthOf } from '../src/record.js';

import { STALE_AFTER_DAYS as SITE_STALE_AFTER_DAYS, daysIdle, isStale } from '../../src/lib/staleness.ts';
import { strengthOf as siteStrengthOf } from '../../src/lib/evidence.ts';

describe('the staleness threshold, on both sides', () => {
  it('is the same number of days', () => {
    expect(STALE_AFTER_DAYS).toBe(SITE_STALE_AFTER_DAYS);
  });

  it('counts the same days between the same two dates', () => {
    const pairs = [
      ['2026-09-01', '2026-09-01'],
      ['2026-08-31', '2026-09-01'],
      ['2026-08-11', '2026-09-01'],
      ['2026-01-01', '2026-09-01'],
    ];
    for (const [from, to] of pairs) {
      expect(daysBetween(from, to), `${from} to ${to}`).toBe(daysIdle(from, to));
    }
  });

  it('calls the same dates stale', () => {
    for (const days of [0, 13, 14, 20, 21, 22, 60]) {
      const from = new Date(Date.UTC(2026, 8, 1) - days * 86400000).toISOString().slice(0, 10);
      expect(stalenessOf(from, '2026-09-01').state === 'stale', `${days} days`).toBe(
        isStale(from, '2026-09-01'),
      );
    }
  });

  it('puts quiet below stale, which is a middle state only the CLI has', () => {
    expect(QUIET_AFTER_DAYS).toBeLessThan(STALE_AFTER_DAYS);
    expect(stalenessOf('2026-08-18', '2026-09-01').state).toBe('quiet');
  });
});

describe('the evidence scale, on both sides', () => {
  /**
   * D-12: a voice is a person. One is a quote, two is a possible pattern,
   * three or more is a pattern. The two sides word it differently, so the
   * boundaries are checked rather than the strings.
   */
  const SAME_RUNG = {
    0: 'request',
    1: 'quote',
    2: 'possible',
    3: 'pattern',
  };

  it('turns over at the same counts', () => {
    for (const [voices, siteRung] of Object.entries(SAME_RUNG)) {
      expect(siteStrengthOf(Number(voices)), `${voices} voices`).toBe(siteRung);
    }
  });

  it('says the same thing in the words the CLI uses', () => {
    expect(strengthOf(0)).toBe('none');
    expect(strengthOf(1)).toBe('a quote');
    expect(strengthOf(2)).toBe('a possible pattern');
    expect(strengthOf(3)).toBe('a pattern');
  });

  it('treats four voices the same as three, on both sides', () => {
    expect(strengthOf(4)).toBe(strengthOf(3));
    expect(siteStrengthOf(4)).toBe(siteStrengthOf(3));
  });
});
