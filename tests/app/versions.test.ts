import { describe, it, expect } from 'vitest';
import { currentOf, isLocal, swapsFor, nameStem, stackFor, stacks, urlStem, versionOf, type Stackable } from '../../src/app/lib/versions';

const p = (id: string, name: string, createdAt: number, extra: Partial<Stackable> = {}): Stackable => ({
  id, name, kind: 'files', createdAt, ...extra,
});

describe('name stems', () => {
  it('strips the ways people number copies', () => {
    for (const n of ['Onboarding', 'onboarding v2', 'Onboarding-v3', 'onboarding (2)', 'onboarding final', 'onboarding_final_final', 'Onboarding 2026-10-14', 'onboarding.zip', 'Onboarding copy']) {
      expect(nameStem(n)).toBe('onboarding');
    }
  });
  it('keeps names that only differ in real words apart', () => {
    expect(nameStem('Onboarding, short')).not.toBe(nameStem('Onboarding'));
    expect(nameStem('Checkout')).not.toBe(nameStem('Onboarding'));
  });
  it('does not strip a name down to nothing', () => {
    expect(nameStem('v2')).toBe('v2');
    expect(nameStem('2026')).toBe('2026');
  });
});

describe('link stems', () => {
  it('groups Vercel branch and deploy previews by project', () => {
    expect(urlStem('https://fernwell-git-new-nav-jm.vercel.app/')).toBe('fernwell.vercel.app');
    expect(urlStem('https://fernwell-3k2j9x8ab-jm.vercel.app/pricing')).toBe('fernwell.vercel.app');
  });
  it('groups Netlify previews by site', () => {
    expect(urlStem('https://deploy-preview-12--fernwell.netlify.app')).toBe('fernwell.netlify.app');
    expect(urlStem('https://new-nav--fernwell.netlify.app')).toBe('fernwell.netlify.app');
  });
  it('keeps localhost ports apart', () => {
    expect(urlStem('http://localhost:3000/')).toBe('localhost:3000');
    expect(urlStem('http://localhost:5173/x')).toBe('localhost:5173');
  });
  it('uses the first path segment elsewhere', () => {
    expect(urlStem('https://lovable.app/projects/abc')).toBe('lovable.app/projects');
  });
});

describe('stacks', () => {
  const a = p('a', 'Onboarding', 1);
  const b = p('b', 'Onboarding v2', 2, { stackId: 'a' });
  const c = p('c', 'Onboarding v3', 3, { stackId: 'a' });
  const solo = p('s', 'Checkout', 4);

  it('groups by stack, oldest first', () => {
    const all = stacks([c, solo, a, b]);
    expect(all.map((s) => s.map((x) => x.id))).toEqual([['a', 'b', 'c'], ['s']]);
  });
  it('shows the newest unless one is marked current', () => {
    expect(currentOf([a, b, c]).id).toBe('c');
    expect(currentOf([a, { ...b, current: true }, c]).id).toBe('b');
  });
  it('numbers versions by age', () => {
    expect(versionOf([c, a, b], 'b')).toBe(2);
  });
  it('finds the stack a new prototype belongs to', () => {
    expect(stackFor([a, b, solo], p('n', 'onboarding-final', 9))?.id).toBe('b');
    expect(stackFor([a, solo], p('n', 'Settings', 9))).toBeUndefined();
  });
  it('finds the stack for a new preview link', () => {
    const live = p('l', 'fernwell.vercel.app', 1, { kind: 'url', url: 'https://fernwell.vercel.app/' });
    const incoming = { id: 'n', name: 'x', kind: 'url' as const, url: 'https://fernwell-git-new-nav-jm.vercel.app/' };
    expect(stackFor([live], incoming)?.id).toBe('l');
  });
});

describe('local hosts and swaps', () => {
  it('isLocal knows local hosts', () => {
    expect(isLocal('http://localhost:5173')).toBe(true);
    expect(isLocal('http://app.localhost')).toBe(true);
    expect(isLocal('http://[::1]:3000')).toBe(true);
    expect(isLocal('http://127.0.0.1:8080/x')).toBe(true);
    expect(isLocal('https://x.vercel.app')).toBe(false);
    expect(isLocal('not a url')).toBe(false);
  });
  it('swapsFor finds only the spots showing that version', () => {
    const spots = [{ id: 'p1', frameId: 'v2' }, { id: 'p2', frameId: 'v1' }, { id: 'p3', frameId: 'v2' }];
    expect(swapsFor(spots, 'v2').map((s) => s.id)).toEqual(['p1', 'p3']);
  });
});
