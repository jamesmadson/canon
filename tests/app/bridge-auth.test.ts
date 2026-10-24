import { describe, it, expect } from 'vitest';
import { sign, verify, newNonce } from '../../src/app/bridge/auth';
import * as cli from '../../cli/src/mcp/auth.js';

const fields = () => ({
  secret: cli.newSecret() as string,
  role: 'tab' as const,
  agentId: 'agent-1',
  ts: 1_700_000_000_000,
  nonce: newNonce(),
  payload: '{"op":"list","name":"café"}',
});

describe('tab auth', () => {
  it('makes a 16 byte hex nonce', () => {
    expect(newNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('a tab MAC verifies with the cli, and a cli MAC with the tab', async () => {
    const m = fields();
    const tabMac = await sign(m);
    expect(tabMac).toMatch(/^[0-9a-f]{64}$/);
    expect(cli.verify({ ...m, mac: tabMac })).toBe(true);
    expect(tabMac).toBe(cli.sign(m));
    expect(await verify({ ...m, mac: cli.sign(m) })).toBe(true);
  });

  it('agrees for the mcp role too', async () => {
    const m = { ...fields(), role: 'mcp' as const };
    expect(await sign(m)).toBe(cli.sign(m));
  });

  it.each([
    ['role', { role: 'mcp' as const }],
    ['agentId', { agentId: 'x' }],
    ['ts', { ts: 1 }],
    ['nonce', { nonce: 'f'.repeat(32) }],
    ['payload', { payload: '{}' }],
  ])('rejects a changed %s', async (_n, change) => {
    const m = fields();
    const mac = await sign(m);
    expect(await verify({ ...m, ...change, mac })).toBe(false);
  });

  it('returns false, never throws, on malformed input', async () => {
    const m = fields();
    const mac = await sign(m);
    for (const bad of ['', 'zz', mac.slice(2), mac + '00']) {
      expect(await verify({ ...m, mac: bad })).toBe(false);
    }
    for (const secret of ['', 'xyz', 'abc']) {
      expect(await verify({ ...m, secret, mac })).toBe(false);
    }
    expect(await verify({ ...m, agentId: 'a\nb', mac })).toBe(false);
  });
});
