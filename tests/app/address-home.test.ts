import { describe, expect, it } from 'vitest';
import { buildAddress, parseAddress, type Address } from '../../src/app/lib/address';

describe('the home screen addresses', () => {
  it('round-trips starred, archive and a tag, including one with spaces or slashes', () => {
    const shapes: Address[] = [
      { name: 'starred' }, { name: 'archive' }, { name: 'tag', tag: 'pricing' }, { name: 'tag', tag: 'annual toggle' }, { name: 'tag', tag: 'a/b' },
    ];
    for (const a of shapes) expect(parseAddress(buildAddress(a))).toEqual(a);
    expect(buildAddress({ name: 'starred' })).toBe('#/starred');
    expect(buildAddress({ name: 'tag', tag: 'annual toggle' })).toBe('#/t/annual%20toggle');
  });
  it('treats a malformed one as home', () => {
    expect(parseAddress('#/starred/x')).toEqual({ name: 'home' });
    expect(parseAddress('#/t')).toEqual({ name: 'home' });
    expect(parseAddress('#/t/a/b')).toEqual({ name: 'home' });
  });
});
