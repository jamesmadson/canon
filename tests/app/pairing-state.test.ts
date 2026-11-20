// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ agents: [] as any[] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => (n === 'agents' ? structuredClone(db.agents) : []),
  get: async (_n: string, id: string) => db.agents.find((a) => a.id === id),
  put: async (_n: string, v: any) => { db.agents = [...db.agents.filter((a) => a.id !== v.id), v]; },
}));

import { _setLink, bridgeView, saveAgent, setBlockedForTest, waitForConnection } from '../../src/app/bridge/client';

const link = (secret: string) => ({ agentId: 'claude', port: 47801, secret, name: 'Claude' });
const old = 'ab'.repeat(32);
const fresh = 'cd'.repeat(32);

beforeEach(() => {
  db.agents = [];
  _setLink(47801, null);
  setBlockedForTest(false);
});

describe('re-pairing an agent that is already connected', () => {
  it('is not connected until a poll with the new secret succeeds', async () => {
    await saveAgent(link(old));
    _setLink(47801, 'claude', true);
    expect(bridgeView().connected.has('claude')).toBe(true);
    await saveAgent(link(fresh));
    expect(bridgeView().connected.has('claude')).toBe(false);
    const waiting = waitForConnection('claude', 1000);
    _setLink(47801, 'claude', true);
    expect(await waiting).toBe('connected');
  });

  it('clears a stale blocked flag when the pairing starts', async () => {
    setBlockedForTest(true);
    await saveAgent(link(fresh));
    expect(bridgeView().blocked).toBe(false);
  });
});

describe('waitForConnection', () => {
  it('resolves connected when the first poll succeeds', async () => {
    const w = waitForConnection('claude', 1000);
    _setLink(47801, 'claude', true);
    expect(await w).toBe('connected');
  });
  it('resolves blocked when Chrome is seen blocking', async () => {
    const w = waitForConnection('claude', 1000);
    setBlockedForTest(true);
    expect(await w).toBe('blocked');
  });
  it('resolves null when nothing happens in time', async () => {
    expect(await waitForConnection('claude', 20)).toBeNull();
  });
});
