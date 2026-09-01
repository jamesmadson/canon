import { describe, it, expect } from 'vitest';
import { daysBetween, stalenessOf, stalenessLabel } from '../src/staleness.js';

/**
 * Retiring work is a feature, so the state is computed from a date rather than
 * decorated onto one. The boundaries are the whole rule, so they are pinned
 * exactly rather than sampled.
 */

describe('daysBetween', () => {
  it('counts whole UTC days', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(daysBetween('2026-08-25', '2026-09-01')).toBe(7);
  });

  it('never goes negative when a commit is dated ahead of the run', () => {
    expect(daysBetween('2026-09-10', '2026-09-01')).toBe(0);
  });

  it('refuses a date it cannot read rather than guessing', () => {
    expect(() => daysBetween('yesterday', '2026-09-01')).toThrow(/YYYY-MM-DD/);
  });
});

describe('stalenessOf', () => {
  it('is active under fourteen days', () => {
    expect(stalenessOf('2026-09-01', '2026-09-01').state).toBe('active');
    expect(stalenessOf('2026-08-19', '2026-09-01').state).toBe('active');
  });

  it('turns quiet exactly on day fourteen', () => {
    expect(stalenessOf('2026-08-19', '2026-09-01').days).toBe(13);
    expect(stalenessOf('2026-08-18', '2026-09-01').days).toBe(14);
    expect(stalenessOf('2026-08-18', '2026-09-01').state).toBe('quiet');
  });

  it('stays quiet through day twenty', () => {
    expect(stalenessOf('2026-08-12', '2026-09-01').days).toBe(20);
    expect(stalenessOf('2026-08-12', '2026-09-01').state).toBe('quiet');
  });

  it('turns stale exactly on day twenty one', () => {
    expect(stalenessOf('2026-08-11', '2026-09-01').days).toBe(21);
    expect(stalenessOf('2026-08-11', '2026-09-01').state).toBe('stale');
    expect(stalenessOf('2026-01-01', '2026-09-01').state).toBe('stale');
  });

  it('carries the day count beside the state', () => {
    expect(stalenessOf('2026-08-16', '2026-09-01')).toEqual({
      state: 'quiet',
      days: 16,
      label: 'quiet 16 days',
    });
  });
});

describe('stalenessLabel', () => {
  it('always says the real number, never the adjective alone', () => {
    expect(stalenessLabel('active', 3)).toBe('active 3 days');
    expect(stalenessLabel('stale', 44)).toBe('stale 44 days');
  });

  it('says today rather than zero days', () => {
    expect(stalenessLabel('active', 0)).toBe('active today');
  });

  it('keeps the singular day', () => {
    expect(stalenessLabel('active', 1)).toBe('active 1 day');
  });
});
