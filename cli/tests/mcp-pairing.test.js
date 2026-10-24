import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pairingPath,
  readPairings,
  ensurePairing,
  rotatePairing,
  claimPairing,
  agentIdFor,
  pairLink,
} from '../src/mcp/pairing.js';

function scratch() {
  return mkdtempSync(join(tmpdir(), 'canon-pairing-'));
}

describe('pairingPath', () => {
  it('lives in .canon under the given home', () => {
    expect(pairingPath('/h')).toBe(join('/h', '.canon', 'mcp.json'));
  });
});

describe('ensurePairing', () => {
  it('creates a private file and keeps the same secret on the next call', () => {
    const home = scratch();
    const p = pairingPath(home);
    const first = ensurePairing(p, 'claude-code', 'Claude Code');
    expect(first.fresh).toBe(true);
    expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(statSync(p).mode & 0o777).toBe(0o600);
    expect(statSync(join(home, '.canon')).mode & 0o777).toBe(0o700);
    const second = ensurePairing(p, 'claude-code', 'Claude Code');
    expect(second).toEqual({ secret: first.secret, fresh: false });
    expect(readPairings(p).agents['claude-code']).toMatchObject({
      name: 'Claude Code',
      claimedBy: null,
    });
  });
});

describe('rotatePairing', () => {
  it('changes the secret and clears the claim', () => {
    const p = pairingPath(scratch());
    const { secret } = ensurePairing(p, 'a', 'A');
    claimPairing(p, 'a', 't1');
    const rotated = rotatePairing(p, 'a', 'A');
    expect(rotated.secret).not.toBe(secret);
    expect(readPairings(p).agents.a.claimedBy).toBeNull();
    expect(statSync(p).mode & 0o777).toBe(0o600);
  });
});

describe('claimPairing', () => {
  it('lets one tab hold a pairing', () => {
    const p = pairingPath(scratch());
    ensurePairing(p, 'a', 'A');
    expect(claimPairing(p, 'a', 't1')).toBe(true);
    expect(claimPairing(p, 'a', 't2')).toBe(false);
    expect(claimPairing(p, 'a', 't1')).toBe(true);
  });
  it('refuses an agent that does not exist', () => {
    expect(claimPairing(pairingPath(scratch()), 'nope', 't1')).toBe(false);
  });
});

describe('readPairings', () => {
  it('reads a missing or corrupt file as empty', () => {
    const home = scratch();
    const p = pairingPath(home);
    expect(readPairings(p)).toEqual({ agents: {} });
    mkdirSync(join(home, '.canon'));
    writeFileSync(p, '{not json');
    expect(readPairings(p)).toEqual({ agents: {} });
    writeFileSync(p, '[]');
    expect(readPairings(p)).toEqual({ agents: {} });
  });
});

describe('agentIdFor', () => {
  it('makes a slug', () => {
    expect(agentIdFor('Claude Code')).toBe('claude-code');
    expect(agentIdFor('claude-code')).toBe('claude-code');
    expect(agentIdFor('')).toBe('agent');
    expect(agentIdFor(undefined)).toBe('agent');
    expect(agentIdFor('  !!  ')).toBe('agent');
  });
});

describe('pairLink', () => {
  it('puts the pairing in the fragment', () => {
    expect(
      pairLink('https://x.test/app', { agentId: 'a', name: 'My Agent', port: 4000, secret: 'abc' }),
    ).toBe('https://x.test/app#pair=a.4000.abc&name=My%20Agent');
  });
});

describe('hostile agent ids and entries', () => {
  it('never treats inherited names as agents', () => {
    const p = pairingPath(scratch());
    ensurePairing(p, 'a', 'A');
    expect(() => ensurePairing(p, '__proto__', 'x')).toThrow();
    expect(() => rotatePairing(p, '__proto__', 'x')).toThrow();
    for (const id of ['__proto__', 'constructor', 'toString']) {
      expect(claimPairing(p, id, 't9')).toBe(false);
    }
    // a valid slug that happens to be an inherited name is an ordinary new agent
    expect(ensurePairing(p, 'constructor', 'C').fresh).toBe(true);
    expect(ensurePairing(p, 'constructor', 'C').fresh).toBe(false);
    expect(({}).claimedBy).toBeUndefined();
    expect(agentIdFor('x'.repeat(100)).length).toBe(64);
  });
  it('drops entries without a string secret', () => {
    const home = scratch();
    const p = pairingPath(home);
    mkdirSync(join(home, '.canon'));
    writeFileSync(p, JSON.stringify({ agents: { a: 'str', b: { secret: 5 }, c: { secret: 'a'.repeat(64) }, __proto__: { secret: 's' } } }));
    expect(Object.keys(readPairings(p).agents)).toEqual(['c']);
    expect(claimPairing(p, 'a', 't1')).toBe(false);
  });
});
