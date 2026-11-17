import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The real store, over an in-memory database: put, getAll and replaceFiles are recorded.
const db = vi.hoisted(() => ({
  lists: {} as Record<string, any[]>,
  stored: new Map<string, { path: string; blob: Blob; type: string }[]>(),
  puts: [] as [string, any][],
}));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: any) => { db.puts.push([name, value]); },
  remove: async () => {},
  replaceFiles: async (id: string, files: { path: string; blob: Blob; type: string }[]) => { db.stored.set(id, files); },
}));

import * as store from '../../src/app/store';
import { runOp, type OpsDeps } from '../../src/app/bridge/ops';
import { createStaging } from '../../src/app/lib/stage';
import { currentOf, stacks } from '../../src/app/lib/versions';
// @ts-expect-error: plain JavaScript, no declarations
import { makeTools } from '../../cli/src/mcp/tools.js';
// @ts-expect-error: plain JavaScript, no declarations
import { ensurePairing } from '../../cli/src/mcp/pairing.js';
import { project } from './helpers/dom';

const APP = 'https://example.test/canon/app/';

function build(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'canon-stored-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

/** An agent's tools, wired to the real ops and the real store the way the bridge wires them, with every command sent as JSON. */
function agent() {
  const file = join(mkdtempSync(join(tmpdir(), 'canon-pair-')), 'mcp.json');
  ensurePairing(file, 'agent', 'Claude');
  const staging = createStaging();
  const deps: OpsDeps = {
    state: store.getState,
    route: () => ({ name: 'home' }),
    createProject: (n) => store.createProject(n),
    createBoard: (p, n) => store.createBoard(p, n),
    addUrl: store.addUrl,
    addUrlVersion: store.addUrlVersion,
    staging,
    addBuild: store.addBuild,
    addBuildVersion: store.addBuildVersion,
    updateFrame: (id, patch) => store.updateFrame(id, patch),
    updateMeta: (id, patch) => store.updateMeta(id, patch),
    placeOnBoard: (b, f) => store.placeOnBoard(b, f),
    moveToBoard: store.moveToBoard,
    navigate: () => {},
    appBase: APP,
    agentName: 'Claude',
    toast: () => {},
  };
  const sent: string[] = [];
  const bridge = {
    port: 47800,
    send: async (op: string, args: unknown) => {
      sent.push(op);
      return runOp(op, JSON.parse(JSON.stringify(args)), deps);
    },
  };
  const tools = makeTools({ bridge, appBase: APP, pairing: { file, agentId: 'agent', name: 'Claude' }, readPage: async () => null, readSource: () => ({}) });
  return { tools, sent };
}

const files = (id: string) => db.stored.get(id) ?? [];
const textOf = async (id: string, path: string) => files(id).find((f) => f.path === path)!.blob.text();

beforeEach(async () => {
  db.puts = [];
  db.stored = new Map();
  db.lists = { projects: [project('p1', 'Shop')], boards: [], placements: [], notes: [], frames: [] };
  await store.load();
});

describe('a build folder through the tools into what the tab stores', () => {
  it('stores the files the way a dropped folder is stored and keeps the url as the live address', async () => {
    const dir = build({ 'index.html': '<title>Cart page</title><h1>Cart</h1><script src="assets/app.js"></script>', 'assets/app.js': 'console.log(1)', 'style.css': 'a{}', 'logo.svg': '<svg/>' });
    const { tools, sent } = agent();
    const r = await tools.call('canon_add', { folder: dir, url: 'http://localhost:5173/', board: 'Checkout' });
    expect(r.isError).toBeUndefined();
    expect(sent[sent.length - 1]).toBe('add');

    const frames = store.getState().frames;
    expect(frames).toHaveLength(1);
    const f = frames[0];
    expect(f).toMatchObject({ kind: 'files', name: 'Cart page', entry: 'index.html', fileCount: 4, liveUrl: 'http://localhost:5173/', projectId: 'p1', tool: 'Claude' });
    expect(f.pages).toEqual(['index.html']);
    expect(f.url).toBeUndefined();
    expect(files(f.id).map((x) => [x.path, x.type]).sort()).toEqual([
      ['assets/app.js', 'text/javascript'], ['index.html', 'text/html'], ['logo.svg', 'image/svg+xml'], ['style.css', 'text/css'],
    ]);
    expect(await textOf(f.id, 'assets/app.js')).toBe('console.log(1)');
    // It is on the board the agent named, and the result says what was kept.
    expect(store.getState().placements).toHaveLength(1);
    expect(r.content[0].text).toContain('"storedFiles": 4');
    expect(r.content[0].text).toContain('"liveUrl": "http://localhost:5173/"');
    // The page is shown from the stored copy, not the address.
    const src = (await import('../../src/app/shared')).frameSrc(f);
    expect(src).toContain(`app/p/${f.id}/index.html`);
  });

  it('the agent name wins over the page title, and a folder alone has no live address', async () => {
    const dir = build({ 'index.html': '<title>Cart page</title>' });
    const { tools } = agent();
    await tools.call('canon_add', { folder: dir, name: 'Cart, two columns' });
    const f = store.getState().frames[0];
    expect(f.name).toBe('Cart, two columns');
    expect(f).not.toHaveProperty('liveUrl');
  });

  it('adding again with canon_update makes a new version and the older copy stays', async () => {
    const { tools } = agent();
    await tools.call('canon_add', { folder: build({ 'index.html': '<title>Cart</title><p>one</p>' }), url: 'http://localhost:5173/', board: 'Checkout', starred: true, summary: 'First round.' });
    const first = store.getState().frames[0];
    const r = await tools.call('canon_update', { frame: 'Cart', folder: build({ 'index.html': '<title>Cart</title><p>two</p>', 'extra.js': 'x' }) });
    expect(r.isError).toBeUndefined();
    expect(r.content[0].text).toContain('It is version 2 now.');

    const st = stacks(store.getState().frames);
    expect(st).toHaveLength(1);
    expect(st[0]).toHaveLength(2);
    const cur = currentOf(st[0]);
    expect(cur.id).not.toBe(first.id);
    expect(cur).toMatchObject({ kind: 'files', name: 'Cart', liveUrl: 'http://localhost:5173/', starred: true, summary: 'First round.', fileCount: 2 });
    expect(await textOf(cur.id, 'index.html')).toContain('two');
    // The first version keeps its own files, so the two can be compared.
    expect(await textOf(first.id, 'index.html')).toContain('one');
    // The board spot moved to the new version.
    expect(store.getState().placements.map((p) => p.frameId)).toEqual([cur.id]);
  });

  it('a link-only prototype that gets a build keeps its link as the live address', async () => {
    const { tools } = agent();
    await tools.call('canon_add', { url: 'http://localhost:4000/', name: 'Pricing' });
    expect(store.getState().frames[0].kind).toBe('url');
    await tools.call('canon_update', { frame: 'Pricing', folder: build({ 'index.html': '<p>built</p>' }) });
    const cur = currentOf(stacks(store.getState().frames)[0]);
    expect(cur).toMatchObject({ kind: 'files', liveUrl: 'http://localhost:4000/' });
  });

  it('a link version can be added with newVersion, and a stack can mix links and stored copies', async () => {
    const { tools } = agent();
    await tools.call('canon_add', { url: 'https://proto.test/a', name: 'Pricing', board: 'Checkout' });
    const r2 = await tools.call('canon_update', { frame: 'Pricing', url: 'https://proto.test/a', newVersion: true });
    expect(r2.content[0].text).toContain('It is version 2 now.');
    expect(r2.isError).toBeUndefined();
    const r3 = await tools.call('canon_update', { frame: 'Pricing', folder: build({ 'index.html': '<p>stored</p>' }) });
    expect(r3.content[0].text).toContain('It is version 3 now.');
    const r4 = await tools.call('canon_update', { frame: 'Pricing', url: 'https://proto.test/b', newVersion: true });
    expect(r4.content[0].text).toContain('It is version 4 now.');
    const st = stacks(store.getState().frames);
    expect(st).toHaveLength(1);
    expect(st[0].map((f) => f.kind)).toEqual(['url', 'url', 'files', 'url']);
    expect(currentOf(st[0]).url).toBe('https://proto.test/b');
    expect(store.getState().placements.map((p) => p.frameId)).toEqual([currentOf(st[0]).id]);
  });

  it('writes nothing when the pieces are missing', async () => {
    const { tools } = agent();
    const bad = await runOpDirect({ build: { upload: '0123456789abcdef', count: 1, bytes: 1 } });
    expect(bad).toEqual({ ok: false, error: 'Canon no longer has those files. Add the build again.' });
    expect(store.getState().frames).toHaveLength(0);
    expect(db.puts.filter(([n]) => n === 'frames')).toHaveLength(0);
    void tools;
  });
});

async function runOpDirect(args: Record<string, unknown>) {
  const deps = { state: store.getState, route: () => ({ name: 'home' }), staging: createStaging(), appBase: APP, agentName: 'Claude', toast: () => {} } as unknown as OpsDeps;
  return runOp('add', args, deps);
}
