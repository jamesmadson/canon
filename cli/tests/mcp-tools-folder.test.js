import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTools, TOOL_DEFS } from '../src/mcp/tools.js';
import { ensurePairing } from '../src/mcp/pairing.js';

const BRIDGE_LIMIT = 64 * 1024; // MAX_ARGS in bridge.js

function setup({ reply = { ok: true, result: { frame: 'Cart', board: null, project: 'P' } }, onSend } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'canon-tools-')), 'mcp.json');
  ensurePairing(file, 'agent', 'Agent');
  const calls = [];
  const bridge = {
    port: 47800,
    send: async (op, args) => {
      calls.push([op, args]);
      return (onSend ? onSend(op, args) : null) ?? reply;
    },
  };
  const tools = makeTools({ bridge, appBase: 'https://app/', pairing: { file, agentId: 'agent', name: 'Agent' }, readPage: async () => null, readSource: () => ({}) });
  return { tools, calls };
}

function build(files) {
  const dir = mkdtempSync(join(tmpdir(), 'canon-build-'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

/** What the tab gets: every staged piece put back together, by offset. */
function reassemble(calls) {
  const files = new Map();
  for (const [op, args] of calls) {
    if (op !== 'stage') continue;
    for (const p of args.parts) {
      const entry = files.get(p.path) ?? { size: p.size, bytes: Buffer.alloc(p.size) };
      Buffer.from(p.data, 'base64').copy(entry.bytes, p.at);
      files.set(p.path, entry);
    }
  }
  return new Map([...files].map(([path, e]) => [path, e.bytes]));
}

describe('canon_add with a build folder', () => {
  it('stages the files in pieces the bridge accepts, then adds with a build reference and no path', async () => {
    const big = Buffer.alloc(300_000);
    for (let i = 0; i < big.length; i++) big[i] = (i * 7) % 251;
    const small = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`img/tiny-${i}.svg`, `<svg id="${i}"/>`]));
    const dir = build({ 'index.html': '<title>Cart</title><h1>Cart</h1>', 'assets/app.js': big, 'empty.txt': '', ...small });
    const { tools, calls } = setup();
    const r = await tools.call('canon_add', { folder: dir, url: 'http://localhost:5173/', name: 'Cart' });
    expect(r.isError).toBeUndefined();

    const stage = calls.filter(([op]) => op === 'stage');
    expect(stage.length).toBeGreaterThan(5);
    for (const [, args] of stage) expect(JSON.stringify(args).length).toBeLessThan(BRIDGE_LIMIT);
    const got = reassemble(calls);
    expect(got.size).toBe(403);
    expect(got.get('assets/app.js').equals(big)).toBe(true);
    expect(got.get('index.html').toString()).toBe('<title>Cart</title><h1>Cart</h1>');
    expect(got.get('empty.txt').length).toBe(0);

    const last = calls[calls.length - 1];
    expect(last[0]).toBe('add');
    expect(last[1]).not.toHaveProperty('folder');
    expect(JSON.stringify(last[1])).not.toContain(dir);
    expect(last[1].url).toBe('http://localhost:5173/');
    expect(last[1].build).toEqual({ upload: stage[0][1].upload, count: 403, bytes: [...got.values()].reduce((n, b) => n + b.length, 0) });
    expect(new Set(stage.map(([, a]) => a.upload)).size).toBe(1);
    expect(last[1].build.upload).toMatch(/^[0-9a-f]{16}$/);
  });

  it('works with a folder and no url, and passes the page title and headings read from index.html', async () => {
    const dir = build({ 'index.html': '<title>Pricing</title><h1>Plans</h1>' });
    const { tools, calls } = setup();
    const r = await tools.call('canon_add', { folder: dir });
    expect(r.isError).toBeUndefined();
    const add = calls[calls.length - 1];
    expect(add[1]).not.toHaveProperty('url');
    expect(add[1].page).toEqual({ title: 'Pricing', headings: ['Plans'] });
  });

  it('needs a url or a folder', async () => {
    const { tools, calls } = setup();
    const r = await tools.call('canon_add', { name: 'x' });
    expect(r).toMatchObject({ isError: true });
    expect(r.content[0].text).toBe('url or folder is required.');
    expect(calls).toHaveLength(0);
  });

  it('refuses a folder that is not usable without calling the bridge', async () => {
    const { tools, calls } = setup();
    const rel = await tools.call('canon_add', { folder: 'dist' });
    expect(rel.isError).toBe(true);
    expect(rel.content[0].text).toContain('absolute path');
    const empty = await tools.call('canon_add', { folder: build({ 'a.css': 'a{}' }) });
    expect(empty.content[0].text).toContain('no index.html at its top');
    expect(calls).toHaveLength(0);
  });

  it('stops before adding when Canon is not connected, and says so', async () => {
    const { tools, calls } = setup({ reply: { ok: false, error: 'not-connected' } });
    const r = await tools.call('canon_add', { folder: build({ 'index.html': '<p/>' }) });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Canon isn't connected");
    expect(calls.map(([op]) => op)).not.toContain('add');
  });

  it('stops before adding when a piece is refused, passing the tab words on', async () => {
    const { tools, calls } = setup({ onSend: (op) => (op === 'stage' ? { ok: false, error: 'The build is too large for Canon.' } : null) });
    const r = await tools.call('canon_add', { folder: build({ 'index.html': '<p/>' }) });
    expect(r).toMatchObject({ isError: true });
    expect(r.content[0].text).toBe('The build is too large for Canon.');
    expect(calls.map(([op]) => op)).not.toContain('add');
  });
});

describe('canon_update with a build folder', () => {
  it('stages the files and sends the build with the update', async () => {
    const dir = build({ 'index.html': '<p>v2</p>' });
    const { tools, calls } = setup();
    const r = await tools.call('canon_update', { frame: 'Cart', folder: dir });
    expect(r.isError).toBeUndefined();
    const last = calls[calls.length - 1];
    expect(last[0]).toBe('update');
    expect(last[1]).toMatchObject({ frame: 'Cart', build: { count: 1 } });
    expect(last[1]).not.toHaveProperty('folder');
    expect(reassemble(calls).get('index.html').toString()).toBe('<p>v2</p>');
  });
});

describe('a localhost address with no folder', () => {
  const WARNING = /Warning: This prototype will only show while the server at (.+) is running\. Build the project and pass the build folder as folder, in canon_add or canon_update, so Canon keeps a copy that shows without the server\./;
  for (const url of ['http://localhost:5173/', 'localhost:3000', 'http://127.0.0.1:8080/x', 'http://[::1]:5173/']) {
    it(`still adds ${url} and returns a warning that asks for a built copy`, async () => {
      const { tools, calls } = setup();
      const r = await tools.call('canon_add', { url });
      expect(r.isError).toBeUndefined();
      expect(calls[0][0]).toBe('add');
      expect(r.content[0].text).toMatch(WARNING);
    });
  }
  it('names the host and port from the address', async () => {
    const { tools } = setup();
    const r = await tools.call('canon_add', { url: 'http://localhost:5173/' });
    expect(r.content[0].text).toContain('the server at localhost:5173 is running');
  });
  it('warns on update with only a localhost address too', async () => {
    const { tools } = setup();
    const r = await tools.call('canon_update', { frame: 'Cart', url: 'http://localhost:5173/' });
    expect(r.content[0].text).toMatch(WARNING);
  });
  it('does not warn with a folder, for a hosted address, or when the add failed', async () => {
    const { tools } = setup();
    const withFolder = await tools.call('canon_add', { url: 'http://localhost:5173/', folder: build({ 'index.html': '<p/>' }) });
    expect(withFolder.content[0].text).not.toContain('Warning');
    const hosted = await tools.call('canon_add', { url: 'https://proto.example.com/' });
    expect(hosted.content[0].text).not.toContain('Warning');
    const down = setup({ reply: { ok: false, error: 'timeout' } });
    const failed = await down.tools.call('canon_add', { url: 'http://localhost:5173/' });
    expect(failed.content[0].text).not.toContain('Warning');
  });
});

describe('canon_add description', () => {
  const add = TOOL_DEFS.find((d) => d.name === 'canon_add');
  it('tells an agent to build the project, pass the build folder, and pass the localhost address as the live address', () => {
    expect(add.description).toContain('build the project');
    expect(add.description).toContain('folder');
    expect(add.description).toContain('live address');
    expect(add.inputSchema.properties.folder.description).toContain('Absolute path');
    expect(add.inputSchema.required).toEqual([]);
  });
  it('has no dashes in any description', () => {
    for (const d of TOOL_DEFS) {
      expect(JSON.stringify(d)).not.toMatch(/[–—]/);
    }
  });
});
