import { describe, expect, it } from 'vitest';
import { acceptNavigate, activeHash, checkResponse, reportHash, takeReport, fitReplies, pairNotice, parsePairLink, probeDelay, retryAfter, stalePolls } from '../../src/app/bridge/client';
import * as cli from '../../cli/src/mcp/auth.js';

const secret = cli.newSecret() as string;
const agentId = 'claude-code';
const nonce = 'a'.repeat(32);
const NOW = 1_700_000_000_000;
const commands = [{ id: 'c1', op: 'status', args: {} }];

function response(over: { role?: string; ts?: number; nonce?: string; payload?: string; signedPayload?: string } = {}) {
  const ts = over.ts ?? NOW;
  const n = over.nonce ?? nonce;
  const payload = over.payload ?? JSON.stringify({ commands });
  const mac = cli.sign({ secret, role: over.role ?? 'mcp', agentId, ts, nonce: n, payload: over.signedPayload ?? payload });
  return { ts, nonce: n, mac, payload };
}
const check = (body: unknown) => checkResponse(body, { secret, agentId, nonce, now: NOW });

describe('checkResponse', () => {
  it('a genuine answer passes with its commands', async () => {
    expect(await check(response())).toEqual(commands);
  });
  it('an answer signed as the tab fails', async () => {
    expect(await check(response({ role: 'tab' }))).toBeNull();
  });
  it('an answer to a different poll fails', async () => {
    expect(await check(response({ nonce: 'b'.repeat(32) }))).toBeNull();
  });
  it('a tampered payload fails', async () => {
    const payload = JSON.stringify({ commands: [{ id: 'c1', op: 'open', args: { board: 'x' } }] });
    expect(await check(response({ payload, signedPayload: JSON.stringify({ commands }) }))).toBeNull();
  });
  it('a stale answer fails', async () => {
    expect(await check(response({ ts: NOW - 31_000 }))).toBeNull();
    expect(await check(response({ ts: NOW + 31_000 }))).toBeNull();
  });
  it('a signed answer that is not a command list fails', async () => {
    expect(await check(response({ payload: '{"commands":"rm"}' }))).toBeNull();
    expect(await check(null)).toBeNull();
  });
});

describe('fitReplies', () => {
  const big = (id: string, kb: number) => ({ id, ok: true, result: 'é'.repeat(kb * 512) }); // 2 UTF-8 bytes per é
  it('keeps replies that fit', () => {
    const r = [big('a', 10), big('b', 10)];
    expect(fitReplies(r)).toEqual(r);
  });
  it('counts the whole poll, not each reply: later replies past ~56 KB become an error', () => {
    const out = fitReplies([big('a', 30), big('b', 30), { id: 'c', ok: true, result: 1 }]) as any[];
    expect(out[0].id).toBe('a');
    expect(out[0].ok).toBe(true);
    expect(out[1]).toEqual({ id: 'b', ok: false, error: 'The answer is too large. Narrow it down.' });
    expect(out[2]).toEqual({ id: 'c', ok: true, result: 1 });
  });
  it('counts UTF-8 bytes and JSON escaping', () => {
    expect((fitReplies([big('a', 57)]) as any[])[0].ok).toBe(false);
    expect((fitReplies([{ id: 'q', ok: true, result: '"'.repeat(20_000) }]) as any[])[0].ok).toBe(false); // each " costs 4 bytes in the body
  });
});

describe('pairNotice', () => {
  const link = { agentId: 'claude-code', port: 47800, secret: 'ab'.repeat(32), name: 'Claude Code' };
  it('says nothing for a first pairing or the same secret', () => {
    expect(pairNotice(undefined, link)).toBeNull();
    expect(pairNotice({ name: 'Claude Code', secret: link.secret }, link)).toBeNull();
  });
  it('warns when a different secret would replace an existing pairing', () => {
    expect(pairNotice({ name: 'Claude', secret: 'cd'.repeat(32) }, link)).toBe('This replaces the existing connection for Claude.');
  });
});

describe('parsePairLink', () => {
  const s = 'ab'.repeat(32);
  it('reads agent, port, secret and name', () => {
    expect(parsePairLink(`#pair=claude-code.47801.${s}&name=Claude%20Code`)).toEqual({ agentId: 'claude-code', port: 47801, secret: s, name: 'Claude Code' });
  });
  it('is null when there is no pairing link', () => expect(parsePairLink('#b/x')).toBeNull());
  it('is "bad" for malformed links', () => {
    for (const h of [
      `#pair=Claude.47801.${s}&name=x`,
      `#pair=claude.48000.${s}&name=x`,
      `#pair=claude.47801.${s.toUpperCase()}&name=x`,
      `#pair=claude.47801.abcd&name=x`,
      `#pair=claude.47801&name=x`,
      `#pair=a.b.47801.${s}`,
    ]) expect(parsePairLink(h)).toBe('bad');
  });
});

describe('probeDelay', () => {
  it('knocks on an empty port every 2 s in view and every 10 s in the background', () => {
    expect(probeDelay(false)).toBe(2_000);
    expect(probeDelay(true)).toBe(10_000);
  });
});

describe('retryAfter', () => {
  it('knocks again 30 s after the MCP turns the tab away, sooner if the pairings change', () => {
    expect(retryAfter('unauthorized', false)).toBe(30_000);
    expect(retryAfter('unauthorized', true)).toBe(30_000);
  });
  it('a refused or bad port waits one probe, and a changed pairing goes again at once', () => {
    expect(retryAfter('refused', false)).toBe(2_000);
    expect(retryAfter('bad', true)).toBe(10_000);
    expect(retryAfter('changed', false)).toBe(0);
  });
});

describe('stalePolls', () => {
  const a = { id: 'claude-code', secret: 's1', tabId: 't1' };
  it('ends every poll of a removed agent, one per port, so two sessions both stop', () => {
    const polls = new Map([[47800, { agent: a }], [47801, { agent: a }], [47802, { agent: { ...a, id: 'cursor' } }]]);
    expect(stalePolls(polls, [{ ...a, id: 'cursor' }])).toEqual([47800, 47801]);
  });
  it('ends the polls of a re-paired agent and keeps current ones', () => {
    const polls = new Map([[47800, { agent: a }], [47801, { agent: a }]]);
    expect(stalePolls(polls, [{ ...a, secret: 's2' }])).toEqual([47800, 47801]);
    expect(stalePolls(polls, [a])).toEqual([]);
  });
});

describe('activeHash', () => {
  it('the most recently focused tab is the active one', () => {
    const own = { tab: 'holder', hash: '#/b/old', at: 100 };
    const reports = new Map([
      ['t1', { hash: '#/p/p1', at: 300 }],
      ['t2', { hash: '#/b/b2', at: 200 }],
    ]);
    expect(activeHash(reports, own)).toEqual({ tab: 't1', hash: '#/p/p1' });
    expect(activeHash(reports, { ...own, at: 400 })).toEqual({ tab: 'holder', hash: '#/b/old' });
    expect(activeHash(new Map(), own)).toEqual({ tab: 'holder', hash: '#/b/old' });
  });
});

describe('acceptNavigate', () => {
  it("navigate refuses pair links and anything outside the app's routes", () => {
    for (const h of [`#pair=claude-code.47801.${'ab'.repeat(32)}`, `#/pair=x`, 'javascript:alert(1)', '#x', '#b/b1', '', '#/nope', '#/b/b1/zz']) {
      expect(acceptNavigate(h)).toBe(false);
    }
    for (const h of ['#/b/b1', '#/', '#/p/p1/boards', '#/b/b1/f/f1/full?w=390', '#/f/f1?from=b1']) expect(acceptNavigate(h)).toBe(true);
  });
});

describe('reports between tabs', () => {
  const pair = `#pair=claude-code.47801.${'ab'.repeat(32)}&name=Claude`;
  it('a pair hash is never reported, outgoing or stored', () => {
    expect(reportHash(pair)).toBe('#/');
    expect(reportHash('#/b/b1')).toBe('#/b/b1');
    const reports = new Map();
    takeReport(reports, { tab: 't1', hash: pair, at: 5 }, 'me', 10);
    expect(reports.get('t1')).toEqual({ hash: '#/', at: 5 });
    expect(JSON.stringify([...reports])).not.toContain('ab'.repeat(32));
  });
  it('a report from the far future is clamped, so it cannot win forever', () => {
    const reports = new Map();
    takeReport(reports, { tab: 't1', hash: '#/b/b1', at: 1e300 }, 'me', 1_000);
    expect(reports.get('t1').at).toBe(6_000);
    expect(activeHash(reports, { tab: 'me', hash: '#/p/p1', at: 7_000 }).tab).toBe('me');
  });
  it('ignores malformed reports and its own', () => {
    const reports = new Map();
    takeReport(reports, { tab: 'me', hash: '#/b/b1', at: 1 }, 'me', 10);
    takeReport(reports, { tab: 't1', hash: 3, at: 1 }, 'me', 10);
    takeReport(reports, { tab: 't2', hash: '#/', at: NaN }, 'me', 10);
    expect(reports.size).toBe(0);
  });
});

describe('acceptNavigate limits', () => {
  it('refuses hashes over 2048 characters and any with a second #', () => {
    expect(acceptNavigate('#/b/' + 'x'.repeat(2045))).toBe(false);
    expect(acceptNavigate('#/b/' + 'x'.repeat(2044))).toBe(true);
    expect(acceptNavigate('#/b/b1#pair=x')).toBe(false);
  });
});
