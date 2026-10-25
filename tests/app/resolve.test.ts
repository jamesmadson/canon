import { describe, expect, it } from 'vitest';
import { checkPrototypeUrl, parseWidth, resolveByName, resolveStack, safeFrameUrl } from '../../src/app/lib/resolve';
import { SIZES } from '../../src/app/lib/sizes';

const items = [{ id: 'a', name: 'Onboarding' }, { id: 'b', name: 'Onboarding v2' }, { id: 'c', name: 'Checkout' }];

describe('resolveByName', () => {
  it('exact name beats substring', () => expect(resolveByName(items, 'onboarding')).toEqual({ ok: true, item: items[0] }));
  it('ambiguous substring lists matches', () =>
    expect(resolveByName(items, 'board')).toEqual({ ok: false, reason: 'many', matches: [items[0], items[1]] }));
  it('id wins', () => expect(resolveByName(items, 'c')).toMatchObject({ ok: true, item: { id: 'c' } }));
  it('an empty query matches nothing', () => expect(resolveByName([items[0]], '  ')).toEqual({ ok: false, reason: 'none', matches: [] }));
  it('nothing', () => expect(resolveByName(items, 'zzz')).toEqual({ ok: false, reason: 'none', matches: [] }));
  it('several exact names are ambiguous', () => {
    const twins = [{ id: 'x', name: 'Cart' }, { id: 'y', name: 'cart' }];
    expect(resolveByName(twins, 'Cart')).toEqual({ ok: false, reason: 'many', matches: twins });
  });
});

describe('resolveByName exact', () => {
  it('takes an exact name or id, never a substring', () => {
    expect(resolveByName(items, 'checkout', { exact: true })).toEqual({ ok: true, item: items[2] });
    expect(resolveByName(items, 'b', { exact: true })).toEqual({ ok: true, item: items[1] });
    expect(resolveByName(items, 'Check', { exact: true })).toEqual({ ok: false, reason: 'none', matches: [] });
  });
});

describe('resolveStack', () => {
  const ring = [{ id: 'r1', name: 'Today ring v1' }, { id: 'r2', name: 'Today ring v2' }];
  const cart = [{ id: 'c1', name: 'Cart sheet' }];
  const cartTwo = [{ id: 'c2', name: 'Cart page' }];
  it('an exact name of any version finds its stack', () => {
    expect(resolveStack([ring, cart], 'today ring v1')).toEqual({ ok: true, item: ring });
    expect(resolveStack([ring, cart], 'Cart sheet')).toEqual({ ok: true, item: cart });
  });
  it('versions of one stack never count as two matches', () => expect(resolveStack([ring, cart], 'today ring')).toEqual({ ok: true, item: ring }));
  it('an id of an old version finds its stack', () => expect(resolveStack([ring, cart], 'r1')).toEqual({ ok: true, item: ring }));
  it('two stacks sharing a substring are ambiguous', () =>
    expect(resolveStack([cart, cartTwo], 'cart')).toEqual({ ok: false, reason: 'many', matches: [cart, cartTwo] }));
  it('nothing and empty', () => {
    expect(resolveStack([ring], 'zzz')).toEqual({ ok: false, reason: 'none', matches: [] });
    expect(resolveStack([ring], ' ')).toEqual({ ok: false, reason: 'none', matches: [] });
  });
});

describe('checkPrototypeUrl', () => {
  const refused = { ok: false, message: 'Only http and https URLs can go on a board.' };
  it('bare localhost gets http', () => expect(checkPrototypeUrl('localhost:5173')).toEqual({ ok: true, url: 'http://localhost:5173/' }));
  it('bare hosts and IPs get http', () => {
    expect(checkPrototypeUrl('127.0.0.1:3000/app')).toEqual({ ok: true, url: 'http://127.0.0.1:3000/app' });
    expect(checkPrototypeUrl('[::1]:8080')).toEqual({ ok: true, url: 'http://[::1]:8080/' });
    expect(checkPrototypeUrl('example.com/x')).toEqual({ ok: true, url: 'http://example.com/x' });
  });
  it('keeps an explicit https', () => expect(checkPrototypeUrl('https://example.com')).toEqual({ ok: true, url: 'https://example.com/' }));
  it('dangerous schemes refused', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'blob:https://x/y'])
      expect(checkPrototypeUrl(u)).toEqual(refused);
  });
  it("refuses Canon's own origin, and only that origin", () => {
    const own = 'https://example.test';
    const itself = { ok: false, message: "That address is Canon itself. Add the prototype's own address." };
    expect(checkPrototypeUrl('https://example.test/canon/app/#/', own)).toEqual(itself);
    expect(checkPrototypeUrl('https://example.test/other', own)).toEqual(itself);
    expect(checkPrototypeUrl('https://example.test:8443/', own)).toEqual({ ok: true, url: 'https://example.test:8443/' });
    expect(checkPrototypeUrl('http://example.test/', own)).toEqual({ ok: true, url: 'http://example.test/' });
    expect(checkPrototypeUrl('https://example.test/')).toEqual({ ok: true, url: 'https://example.test/' });
  });
});

describe('safeFrameUrl', () => {
  it('blanks anything but http and https', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', '', undefined]) expect(safeFrameUrl(u)).toBe('about:blank');
    expect(safeFrameUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeFrameUrl('http://localhost:5173/')).toBe('http://localhost:5173/');
  });
});

describe('parseWidth', () => {
  it('widths', () => expect(['phone', 'tablet', 'desktop', 'fill', 500, -1, 'huge'].map(parseWidth)).toEqual([390, 834, 1280, 'fill', 500, null, null]));
  it('inherited names are not widths', () => expect(['toString', '__proto__', 'constructor', 'hasOwnProperty'].map(parseWidth)).toEqual([null, null, null, null]));
  it('named widths match SIZES', () => {
    for (const s of SIZES) expect(parseWidth(s.name.toLowerCase())).toBe(s.w);
  });
});
