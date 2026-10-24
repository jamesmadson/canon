import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTools, checkPrototypeUrl } from '../src/mcp/tools.js';
import { ensurePairing, claimPairing } from '../src/mcp/pairing.js';

function setup(reply, { claimed = false } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'canon-tools-')), 'mcp.json');
  const { secret } = ensurePairing(file, 'agent', 'Agent');
  if (claimed) claimPairing(file, 'agent', '0123456789abcdef');
  const calls = [];
  const bridge = { port: 47800, send: async (op, args) => (calls.push([op, args]), reply ?? { ok: true, result: 'ok' }) };
  const tools = makeTools({ bridge, appBase: 'https://app/', pairing: { file, agentId: 'agent', name: 'Agent' } });
  return { tools, calls, file, secret };
}

describe('canon tools', () => {
  it('refuses a javascript: url without calling the bridge', async () => {
    const { tools, calls } = setup();
    const r = await tools.call('canon_add', { url: 'javascript:alert(1)' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('Only http and https URLs can go on a board.');
    expect(calls).toHaveLength(0);
  });
  it('adds http:// to a bare host', async () => {
    const { tools, calls } = setup();
    await tools.call('canon_add', { url: 'localhost:3000/x' });
    expect(calls[0][0]).toBe('add');
    expect(calls[0][1].url).toBe('http://localhost:3000/x');
    expect(checkPrototypeUrl('ftp://a.b').ok).toBe(false);
  });
  it('gives both links when not connected and unclaimed', async () => {
    const { tools, secret } = setup({ ok: false, error: 'not-connected' });
    const r = await tools.call('canon_status', {});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Canon isn't connected. Open it: https://app/");
    expect(r.content[0].text).toContain(`Then approve this agent: https://app/#pair=agent.47800.${secret}`);
  });
  it('tells a claimed agent to try again first, and mentions canon_pair only second', async () => {
    const { tools, secret } = setup({ ok: false, error: 'not-connected' }, { claimed: true });
    const r = await tools.call('canon_status', {});
    expect(r.content[0].text).toBe(
      "Canon isn't connected. If it's open, try again in a few seconds. Otherwise open it: https://app/\nIf you disconnected this agent in Canon, run canon_pair to connect again.",
    );
    expect(r.content[0].text.split('\n')[0]).not.toContain('canon_pair');
    expect(r.content[0].text).not.toContain(secret);
  });
  it('says plainly when Canon took too long or the connection closed', async () => {
    const late = await setup({ ok: false, error: 'timeout' }).tools.call('canon_status', {});
    expect(late).toMatchObject({ isError: true });
    expect(late.content[0].text).toBe("Canon didn't answer in time. It may have done it anyway, so check with canon_find before trying again.");
    const shut = await setup({ ok: false, error: 'closed' }).tools.call('canon_status', {});
    expect(shut.content[0].text).toBe('The Canon connection closed. Try again.');
  });
  it('says which lookup matched nothing, with the query', async () => {
    const reply = (what, query) => ({ ok: true, result: { status: 'none', candidates: [], what, query } });
    const say = async (what, query) => (await setup(reply(what, query)).tools.call('canon_update', { frame: 'x' })).content[0].text;
    expect(await say('frame', 'zzz')).toBe('Nothing matched frame "zzz".');
    expect(await say('board', 'Archve')).toBe('Nothing matched board "Archve".');
    expect(await say('moveTo', 'Old')).toBe('Nothing matched moveTo board "Old".');
  });
  it('names the board an add or update landed on', async () => {
    const added = await setup({ ok: true, result: { frameId: 'f1', frame: 'Checkout', boardId: 'b1', board: 'Checkout redesign', link: 'L' } }).tools.call('canon_add', { url: 'http://a.b' });
    expect(added.content[0].text.split('\n')[0]).toBe('Added Checkout to board Checkout redesign.');
    expect(added.content[0].text).toContain('"frameId": "f1"');
    const updated = await setup({ ok: true, result: { frameId: 'f1', frame: 'Cart', boardId: 'b2', board: 'Archive', link: 'L' } }).tools.call('canon_update', { frame: 'Cart' });
    expect(updated.content[0].text.split('\n')[0]).toBe('Updated Cart on board Archive.');
  });
  it('accepts project on add, update, find, open and link', async () => {
    for (const [tool, args, op] of [
      ['canon_add', { url: 'http://a.b', project: 'Acme' }, 'add'],
      ['canon_update', { frame: 'x', project: 'Acme' }, 'update'],
      ['canon_find', { project: 'Acme' }, 'find'],
      ['canon_open', { project: 'Acme' }, 'open'],
      ['canon_link', { project: 'Acme' }, 'link'],
    ]) {
      const { tools, calls } = setup();
      await tools.call(tool, args);
      expect(calls[0][0]).toBe(op);
      expect(calls[0][1].project).toBe('Acme');
    }
  });
  it('refuses project on canon_status', async () => {
    const r = await setup().tools.call('canon_status', { project: 'Acme' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('project is not an option for canon_status.');
  });
  it('says which project matched nothing', async () => {
    const { tools } = setup({ ok: true, result: { status: 'none', candidates: [], what: 'project', query: 'Zed' } });
    const r = await tools.call('canon_find', { project: 'Zed' });
    expect(r.content[0].text).toBe('Nothing matched project "Zed".');
  });
  it('names the project an add or update landed on', async () => {
    const first = async (tool, args, result) => (await setup({ ok: true, result }).tools.call(tool, args)).content[0].text.split('\n')[0];
    const base = { frameId: 'f1', frame: 'Cart', project: 'Shop' };
    expect(await first('canon_add', { url: 'http://a.b' }, { ...base, board: 'Main' })).toBe('Added Cart to board Main in project Shop.');
    expect(await first('canon_add', { url: 'http://a.b' }, { ...base, board: null })).toBe("Added Cart to project Shop. It isn't on a board.");
    expect(await first('canon_update', { frame: 'Cart' }, { ...base, board: 'Main' })).toBe('Updated Cart on board Main in project Shop.');
    expect(await first('canon_update', { frame: 'Cart' }, { ...base, board: null })).toBe('Updated Cart in project Shop.');
    expect(await first('canon_update', { frame: 'Cart' }, { ...base, board: 'Main', newVersion: true, version: 3 })).toBe('Updated Cart on board Main in project Shop. It is version 3 now.');
  });
  it('canon_pair returns a link with a new secret', async () => {
    const { tools, secret } = setup();
    const r = await tools.call('canon_pair', {});
    expect(r.content[0].text).toContain('#pair=agent.47800.');
    expect(r.content[0].text).not.toContain(secret);
  });
  it('turns many into an error with candidates', async () => {
    const { tools } = setup({ ok: true, result: { status: 'many', candidates: ['A', 'B'] } });
    const r = await tools.call('canon_update', { frame: 'x' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('A, B');
  });

  describe('input validation', () => {
    const bad = [
      ['string arguments', 'canon_add', 'url=http://a.b'],
      ['array arguments', 'canon_find', ['x']],
      ['unknown key', 'canon_find', { query: 'x', extra: 1 }],
      ['missing frame', 'canon_update', { name: 'n' }],
      ['missing url', 'canon_add', {}],
      ['long name', 'canon_add', { url: 'http://a.b', name: 'x'.repeat(3000) }],
      ['bad width', 'canon_open', { width: 'huge' }],
      ['fractional width', 'canon_open', { width: 1.5 }],
      ['bad full', 'canon_open', { full: 'yes' }],
      ['bad version', 'canon_open', { version: 0 }],
      ['non-text board', 'canon_open', { board: 5 }],
    ];
    for (const [label, tool, args] of bad) {
      it(`refuses ${label}`, async () => {
        const { tools, calls } = setup();
        const r = await tools.call(tool, args);
        expect(r.isError).toBe(true);
        expect(calls).toHaveLength(0);
      });
    }
    it('lets good arguments through', async () => {
      const { tools, calls } = setup();
      await tools.call('canon_open', { board: 'b', width: 'phone', full: true, version: 2 });
      expect(calls).toHaveLength(1);
    });
  });

  it('returns a tool failure as an error result', async () => {
    const { tools } = setup();
    const r = await tools.call('canon_pair', {}).catch(() => 'threw');
    expect(r).not.toBe('threw');
    const broken = makeTools({
      bridge: { port: 1, send: async () => ({ ok: true }) },
      appBase: 'https://app/',
      pairing: { file: '/dev/null/x/mcp.json', agentId: 'agent', name: 'Agent' },
    });
    const out = await broken.call('canon_pair', {});
    expect(out.isError).toBe(true);
  });
});
