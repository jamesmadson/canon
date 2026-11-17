import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTools, checkPrototypeUrl, TOOL_DEFS } from '../src/mcp/tools.js';
import { ensurePairing, claimPairing } from '../src/mcp/pairing.js';
import { NAMING_RULE } from '../src/mcp/naming.js';

function setup(reply, { claimed = false, readPage = async () => null, readSource = () => ({}) } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'canon-tools-')), 'mcp.json');
  const { secret } = ensurePairing(file, 'agent', 'Agent');
  if (claimed) claimPairing(file, 'agent', '0123456789abcdef');
  const calls = [];
  const bridge = { port: 47800, send: async (op, args) => (calls.push([op, args]), reply ?? { ok: true, result: 'ok' }) };
  const tools = makeTools({ bridge, appBase: 'https://app/', pairing: { file, agentId: 'agent', name: 'Agent' }, readPage, readSource });
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
  it('says Canon closed before answering when the command was lost', async () => {
    const lost = await setup({ ok: false, error: 'lost' }).tools.call('canon_status', {});
    expect(lost).toMatchObject({ isError: true });
    expect(lost.content[0].text).toBe('Canon closed before it answered. It may have done it anyway, so check with canon_find.');
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

  describe('names, summary, tags and source', () => {
    const added = (frame) => ({ ok: true, result: { frameId: 'f1', frame, boardId: 'b1', board: 'Main', project: 'Shop', link: 'L', tags: [] } });

    it('the canon_add description states the naming rule with its example', () => {
      const add = TOOL_DEFS.find((d) => d.name === 'canon_add');
      expect(add.description).toContain(NAMING_RULE);
      expect(add.description.startsWith(
        `Put a prototype on a board so it can be found again. ${NAMING_RULE} The reply lists the names already in the project: match their style. Add a one-sentence summary. Canon tags the prototype from its page, this agent, the repo and the branch; pass tags only to add your own.`,
      )).toBe(true);
    });
    it('no tool description or argument description has an em or en dash', () => {
      const texts = [];
      const walk = (v) => {
        if (typeof v === 'string') texts.push(v);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      for (const d of TOOL_DEFS) {
        texts.push(d.description);
        for (const prop of Object.values(d.inputSchema.properties)) walk(prop.description);
      }
      expect(texts.length).toBeGreaterThan(20);
      for (const t of texts) expect(t).not.toMatch(/[\u2013\u2014]/);
    });
    it("add sends the page it read, and the repo and branch of the working directory", async () => {
      const page = { title: 'Pricing', headings: ['Plans'] };
      const { tools, calls } = setup(undefined, { readPage: async () => page, readSource: () => ({ repo: 'acme-web', branch: 'pricing' }) });
      await tools.call('canon_add', { url: 'http://a.b', summary: 'S.', tags: ['x'], starred: true, note: 'n' });
      expect(calls[0][1]).toMatchObject({ url: 'http://a.b/', page, repo: 'acme-web', branch: 'pricing', summary: 'S.', tags: ['x'], starred: true, note: 'n' });
    });
    it("add keeps the agent's repo and branch over the working directory's", async () => {
      for (const given of [{ repo: 'mine' }, { branch: 'mine' }, { repo: 'r', branch: 'b' }]) {
        const { tools, calls } = setup(undefined, { readSource: () => ({ repo: 'acme-web', branch: 'pricing' }) });
        await tools.call('canon_add', { url: 'http://a.b', ...given });
        expect(calls[0][1].repo).toBe(given.repo);
        expect(calls[0][1].branch).toBe(given.branch);
      }
    });
    it('add still adds when the page cannot be read, and sends no page', async () => {
      const { tools, calls } = setup(added('Cart'), { readPage: async () => null });
      const r = await tools.call('canon_add', { url: 'http://a.b' });
      expect(r.isError).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect('page' in calls[0][1]).toBe(false);
    });
    it('add still adds when a reader throws', async () => {
      const boom = () => {
        throw new Error('boom');
      };
      const { tools, calls } = setup(added('Cart'), { readPage: async () => boom(), readSource: boom });
      const r = await tools.call('canon_add', { url: 'http://a.b' });
      expect(r.isError).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect('page' in calls[0][1]).toBe(false);
      expect('repo' in calls[0][1]).toBe(false);
    });
    it('add warns on a bare URL name, a file name and test 2, and still adds', async () => {
      for (const name of ['http://localhost:3000/pricing', 'index.html', 'test 2']) {
        const { tools, calls } = setup(added(name));
        const r = await tools.call('canon_add', { url: 'http://a.b', name });
        expect(r.isError).toBeUndefined();
        expect(calls).toHaveLength(1);
        const lines = r.content[0].text.split('\n');
        expect(lines[0]).toBe(`Added ${name} to board Main in project Shop.`);
        expect(lines[1]).toBe(`Warning: "${name}" reads like ${name.startsWith('http') ? 'a web address' : name === 'index.html' ? 'a file name' : 'a placeholder'}. ${NAMING_RULE} Rename it with canon_update.`);
      }
    });
    it('add with no name warns about the host name Canon gave it', async () => {
      const { tools } = setup(added('localhost:3000'));
      const r = await tools.call('canon_add', { url: 'http://localhost:3000' });
      expect(r.content[0].text.split('\n')[1]).toContain('Warning: "localhost:3000" reads like a web address.');
    });
    it('add lists the names already in the project', async () => {
      const reply = { ok: true, result: { ...added('Pricing page, annual toggle').result, names: ['Home', 'Checkout, guest'] } };
      const { tools } = setup(reply);
      const r = await tools.call('canon_add', { url: 'http://a.b', name: 'Pricing page, annual toggle' });
      const lines = r.content[0].text.split('\n');
      expect(lines[1]).toBe('Names already in this project: "Home", "Checkout, guest".');
      expect(r.content[0].text).not.toContain('Warning');
      expect(r.content[0].text).not.toContain('"names"');
      expect(r.content[0].text).toContain('"frameId": "f1"');
    });
    it('add refuses tags that are not a list of text without calling the bridge', async () => {
      const cases = [
        [{ tags: 'a' }, 'tags must be a list of text.'],
        [{ tags: [1] }, 'tags must be a list of text.'],
        [{ tags: Array.from({ length: 500 }, (_, i) => `t${i}`) }, 'tags can hold at most 20.'],
        [{ starred: 'yes' }, 'starred must be true or false.'],
        [{ page: { title: 'x', headings: [] } }, 'page is not an option for canon_add.'],
        [{ newVersion: true }, 'newVersion is not an option for canon_add.'],
      ];
      for (const [extra, message] of cases) {
        const { tools, calls } = setup();
        const r = await tools.call('canon_add', { url: 'http://a.b', ...extra });
        expect(r.isError).toBe(true);
        expect(r.content[0].text).toBe(message);
        expect(calls).toHaveLength(0);
      }
    });
    it('update reads the page only when the URL changes', async () => {
      const reads = [];
      const page = { title: 'T', headings: [] };
      const readPage = async (url) => (reads.push(url), page);
      const a = setup(undefined, { readPage });
      await a.tools.call('canon_update', { frame: 'x', starred: true, removeTags: ['y'], archived: false });
      expect(reads).toHaveLength(0);
      expect('page' in a.calls[0][1]).toBe(false);
      expect(a.calls[0][1]).toMatchObject({ starred: true, removeTags: ['y'], archived: false });
      await a.tools.call('canon_update', { frame: 'x', url: 'http://c.d' });
      expect(reads).toEqual(['http://c.d/']);
      expect(a.calls[1][1].page).toEqual(page);
    });
    it('find passes tag, starred and archived through', async () => {
      const { tools, calls } = setup();
      await tools.call('canon_find', { query: 'q', tag: 'pricing', starred: true, archived: true });
      expect(calls[0]).toEqual(['find', { query: 'q', tag: 'pricing', starred: true, archived: true }]);
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
