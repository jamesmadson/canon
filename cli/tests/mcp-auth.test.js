import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { sign, verify, newSecret, newNonce, createReplayGuard } from '../src/mcp/auth.js';

const base = () => ({
  secret: newSecret(),
  role: 'tab',
  agentId: 'agent-1',
  ts: 1_700_000_000_000,
  nonce: newNonce(),
  payload: '{"op":"list"}',
});

describe('mcp auth', () => {
  it('makes a 32 byte secret and a 16 byte nonce, in hex', () => {
    expect(newSecret()).toMatch(/^[0-9a-f]{64}$/);
    expect(newNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSecret()).not.toBe(newSecret());
  });

  it('signs to 64 hex chars and round-trips', () => {
    const m = base();
    const mac = sign(m);
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
    expect(verify({ ...m, mac })).toBe(true);
  });

  it('matches an independently built HMAC of the documented string', () => {
    const secret = '0f'.repeat(32);
    const expected = createHmac('sha256', Buffer.from(secret, 'hex'))
      .update('tab\nagent-1\n1\nn\nline1\nline2')
      .digest('hex');
    expect(sign({ secret, role: 'tab', agentId: 'agent-1', ts: 1, nonce: 'n', payload: 'line1\nline2' })).toBe(expected);
  });

  it.each([
    ['role', { role: 'mcp' }],
    ['agentId', { agentId: 'agent-2' }],
    ['ts', { ts: 1_700_000_000_001 }],
    ['nonce', { nonce: 'f'.repeat(32) }],
    ['payload', { payload: '{"op":"lisu"}' }],
    ['secret', { secret: newSecret() }],
  ])('rejects a changed %s', (_n, change) => {
    const m = base();
    const mac = sign(m);
    expect(verify({ ...m, ...change, mac })).toBe(false);
  });

  it('returns false, never throws, on malformed input', () => {
    const m = base();
    const mac = sign(m);
    for (const bad of ['', 'zz', mac.slice(2), mac + '00', mac.toUpperCase().slice(0, 63), null, undefined, 5]) {
      expect(verify({ ...m, mac: bad })).toBe(false);
    }
    for (const secret of ['', 'xyz', 'abc', null, undefined]) {
      expect(verify({ ...m, secret, mac })).toBe(false);
    }
    expect(verify({ ...m, role: 'admin', mac })).toBe(false);
    expect(verify({ ...m, agentId: 'a\nb', mac })).toBe(false);
  });

  it('refuses to sign with a malformed secret or a newline in a header field', () => {
    expect(() => sign({ ...base(), secret: 'nothex' })).toThrow();
    expect(() => sign({ ...base(), agentId: 'a\nb' })).toThrow();
    expect(() => sign({ ...base(), role: 'root' })).toThrow();
  });
});

describe('replay guard', () => {
  it('accepts a fresh nonce once and rejects a repeat', () => {
    const g = createReplayGuard({});
    expect(g.accept(1000, 'n1', 1000)).toBe(true);
    expect(g.accept(1000, 'n1', 1001)).toBe(false);
    expect(g.accept(1000, 'n2', 1001)).toBe(true);
  });

  it('rejects a timestamp 31 s old or 31 s ahead, accepts 30 s', () => {
    const g = createReplayGuard({});
    const now = 100_000;
    expect(g.accept(now - 31_000, 'a', now)).toBe(false);
    expect(g.accept(now + 31_000, 'b', now)).toBe(false);
    expect(g.accept(now - 30_000, 'c', now)).toBe(true);
  });

  it('rejects non-finite timestamps and empty nonces', () => {
    const g = createReplayGuard({});
    expect(g.accept(NaN, 'x', 0)).toBe(false);
    expect(g.accept(0, '', 0)).toBe(false);
  });

  it('forgets a nonce once it has left the window', () => {
    const g = createReplayGuard({ windowMs: 1000 });
    expect(g.accept(0, 'n', 0)).toBe(true);
    // the same nonce with a fresh ts is allowed after the window passes
    expect(g.accept(5000, 'n', 5000)).toBe(true);
  });
});
