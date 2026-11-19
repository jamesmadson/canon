import { describe, expect, it } from 'vitest';
import { openProjectId, runOp, type OpsDeps } from '../../src/app/bridge/ops';
import type { State } from '../../src/app/store';
import type { Board, Frame, FrameMeta, Placement, Project } from '../../src/app/db';
import type { Address } from '../../src/app/lib/address';
import { SIZES } from '../../src/app/lib/sizes';
import { createStaging } from '../../src/app/lib/stage';

const APP = 'https://example.test/canon/app/';

const project = (id: string, name: string, updatedAt = 0): Project => ({ id, name, createdAt: 0, updatedAt });
const board = (id: string, projectId: string, name: string, updatedAt = 0): Board => ({ id, projectId, name, createdAt: 0, updatedAt, arrangement: 'free' });
const frame = (id: string, projectId: string, name: string, extra: Partial<Frame> = {}): Frame => ({
  id, projectId, name, kind: 'url', url: `https://${id}.test/`, x: 0, y: 0, w: 1280, h: 800, rev: 0, createdAt: 0, updatedAt: 0, ...extra,
});
const place = (id: string, boardId: string, frameId: string): Placement => ({ id, boardId, frameId, x: 0, y: 0 });

interface Seed { projects?: Project[]; boards?: Board[]; frames?: Frame[]; placements?: Placement[]; route?: Address; agentName?: string }

/** An in-memory stand-in for the store, with the same action shapes. Every write is logged. */
function fake(seed: Seed = {}) {
  let state: State = {
    projects: seed.projects ?? [], boards: seed.boards ?? [], frames: seed.frames ?? [], placements: seed.placements ?? [],
    notes: [], ready: true, toast: null, vault: { status: 'none' },
  };
  let n = 0;
  let clock = 1000;
  const writes: string[] = [];
  const toasts: string[] = [];
  const navigated: string[] = [];
  const addUrlCalls: unknown[][] = [];
  const versionCalls: unknown[][] = [];
  const set = (patch: Partial<State>) => (state = { ...state, ...patch });
  const key = (f: Frame) => f.stackId ?? f.id;
  const stackOf = (id: string) => {
    const f = state.frames.find((x) => x.id === id)!;
    return state.frames.filter((x) => key(x) === key(f)).sort((a, b) => a.createdAt - b.createdAt);
  };
  const currentOf = (s: Frame[]) => s.find((f) => f.current) ?? s[s.length - 1];
  const placeOnBoard = async (boardId: string, frameId: string) => {
    writes.push(`place ${boardId} ${frameId}`);
    if (state.placements.some((p) => p.boardId === boardId && p.frameId === frameId)) return;
    set({ placements: [...state.placements, place(`np${++n}`, boardId, frameId)] });
  };
  const addUrl = async (projectId: string, url: string, opts: { boardId?: string; name?: string; size?: { w: number; h: number }; stack?: boolean; meta?: FrameMeta } = {}) => {
    addUrlCalls.push([projectId, url, opts]);
    writes.push(`addUrl ${url}`);
    const f = frame(`nf${++n}`, projectId, opts.name || new URL(url).host, { url, w: opts.size?.w ?? 1280, h: opts.size?.h ?? 800, createdAt: clock++, ...opts.meta });
    set({ frames: [...state.frames, f] });
    if (opts.boardId) await placeOnBoard(opts.boardId, f.id);
    return f;
  };
  const deps: OpsDeps = {
    state: () => state,
    route: () => seed.route ?? { name: 'home' },
    async createProject(name: string) {
      writes.push(`createProject ${name}`);
      const p = project(`P${++n}`, name);
      set({ projects: [...state.projects, p] });
      return p;
    },
    async createBoard(projectId: string, name: string) {
      writes.push(`createBoard ${name}`);
      const b = board(`B${++n}`, projectId, name);
      set({ boards: [...state.boards, b] });
      return b;
    },
    addUrl: addUrl as OpsDeps['addUrl'],
    async addUrlVersion(frameId: string, url: string, opts: { force?: boolean } = {}) {
      versionCalls.push(opts.force ? [frameId, url, 'force'] : [frameId, url]);
      const current = currentOf(stackOf(frameId));
      if (current.url === url && !opts.force) return { frame: current, added: false };
      const meta: FrameMeta = {};
      for (const k of ['summary', 'repo', 'branch', 'tool', 'tags', 'removedTags', 'starred', 'note', 'archived'] as const) if (current[k] !== undefined) (meta as any)[k] = current[k];
      const made = await addUrl(current.projectId, url, { name: current.name, size: { w: current.w, h: current.h }, stack: false, meta });
      const k = key(current);
      set({
        frames: state.frames.map((f) => (key(f) === k || f.id === made.id ? { ...f, stackId: k, current: f.id === made.id } : f)),
        placements: state.placements.map((p) => (p.frameId === current.id ? { ...p, frameId: made.id } : p)),
      });
      return { frame: state.frames.find((f) => f.id === made.id)!, added: true };
    },
    staging: createStaging(),
    addBuild: (async () => { throw new Error('This fake takes no builds.'); }) as OpsDeps['addBuild'],
    addBuildVersion: (async () => { throw new Error('This fake takes no builds.'); }) as OpsDeps['addBuildVersion'],
    async updateFrame(id: string, patch: Partial<Frame>) {
      writes.push(`updateFrame ${id}`);
      set({ frames: state.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    },
    async updateMeta(frameId: string, patch: FrameMeta) {
      writes.push(`updateMeta ${frameId}`);
      const ids = new Set(stackOf(frameId).map((f) => f.id));
      set({ frames: state.frames.map((f) => (ids.has(f.id) ? { ...f, ...patch } : f)) });
    },
    placeOnBoard,
    async moveToBoard(placementId: string, boardId: string) {
      writes.push(`move ${placementId} ${boardId}`);
      set({ placements: state.placements.map((p) => (p.id === placementId ? { ...p, boardId } : p)) });
    },
    navigate: (hash: string) => navigated.push(hash),
    appBase: APP,
    agentName: seed.agentName ?? 'Claude',
    toast: (m: string) => toasts.push(m),
  };
  return { deps, writes, toasts, navigated, addUrlCalls, versionCalls, state: () => state };
}

/** Two projects, each with a board, and a two-version stack on Alpha's Checkout board. */
function twoProjects(route: Address = { name: 'home' }) {
  return fake({
    projects: [project('a', 'Alpha'), project('z', 'Zeta')],
    boards: [board('b1', 'a', 'Checkout', 5), board('b2', 'a', 'Archive', 1), board('b3', 'z', 'Launch')],
    frames: [
      frame('f0', 'a', 'Cart v1', { stackId: 'f0', createdAt: 1, url: 'https://cart.test/1' }),
      frame('f1', 'a', 'Cart v2', { stackId: 'f0', current: true, createdAt: 2, url: 'https://cart.test/2' }),
      frame('g1', 'z', 'Hero', { createdAt: 3 }),
    ],
    placements: [place('p1', 'b1', 'f1'), place('p3', 'b3', 'g1')],
    route,
  });
}

describe('runOp add', () => {
  it('makes a missing project and board, and names and sizes the prototype', async () => {
    const t = twoProjects();
    const r = await runOp('add', { url: 'https://proto.test/x', name: 'Sheet', project: 'Gamma', board: 'Onboarding', width: 'phone' }, t.deps);
    const s = t.state();
    const p = s.projects.find((x) => x.name === 'Gamma')!;
    const b = s.boards.find((x) => x.name === 'Onboarding')!;
    expect(b.projectId).toBe(p.id);
    const f = s.frames[s.frames.length - 1];
    const phone = SIZES.find((x) => x.name === 'Phone')!;
    expect(f).toMatchObject({ projectId: p.id, name: 'Sheet', url: 'https://proto.test/x', w: phone.w, h: phone.h });
    expect(s.placements.some((x) => x.boardId === b.id && x.frameId === f.id)).toBe(true);
    expect(r).toEqual({
      ok: true,
      result: { frameId: f.id, frame: 'Sheet', projectId: p.id, project: 'Gamma', boardId: b.id, board: 'Onboarding', version: 1, versions: 1, link: `${APP}#/f/${f.id}/full`, tags: ['claude'], names: [] },
    });
    expect(t.toasts).toEqual(['Claude added Sheet']);
  });

  it('with no project uses the open project and its open board', async () => {
    const t = twoProjects({ name: 'board', board: 'b3', frame: null });
    const r = await runOp('add', { url: 'https://proto.test/' }, t.deps);
    expect(r).toMatchObject({ ok: true, result: { projectId: 'z', project: 'Zeta', boardId: 'b3', board: 'Launch' } });
    expect(t.state().projects).toHaveLength(2);
  });

  it('with several projects and nothing open asks which project and adds nothing', async () => {
    const t = twoProjects();
    const r = await runOp('add', { url: 'https://proto.test/' }, t.deps);
    expect(r).toEqual({ ok: true, result: { status: 'many', candidates: ['Alpha', 'Zeta'], what: 'project' } });
    expect(t.writes).toEqual([]);
  });

  it('with no projects makes My prototypes', async () => {
    const t = fake();
    const r = await runOp('add', { url: 'https://proto.test/' }, t.deps);
    expect(t.state().projects.map((p) => p.name)).toEqual(['My prototypes']);
    expect(r).toMatchObject({ ok: true, result: { project: 'My prototypes', board: null, boardId: null } });
  });

  it('an exact board name in one project is used from any route', async () => {
    const t = twoProjects({ name: 'board', board: 'b3', frame: null });
    const r = await runOp('add', { url: 'https://proto.test/', board: 'archive' }, t.deps);
    expect(r).toMatchObject({ ok: true, result: { projectId: 'a', boardId: 'b2', board: 'Archive' } });
    expect(t.state().boards).toHaveLength(3);
  });

  it('a board name in two projects lists both with their projects and adds nothing', async () => {
    const t = fake({
      projects: [project('a', 'Alpha'), project('z', 'Zeta')],
      boards: [board('b1', 'a', 'Onboarding'), board('b2', 'z', 'Onboarding')],
    });
    const r = await runOp('add', { url: 'https://proto.test/', board: 'Onboarding' }, t.deps);
    expect(r).toEqual({ ok: true, result: { status: 'many', candidates: ['Onboarding (Alpha)', 'Onboarding (Zeta)'], what: 'board', query: 'Onboarding' } });
    expect(t.writes).toEqual([]);
  });

  it('a near board name makes a new board', async () => {
    const t = twoProjects({ name: 'project', project: 'a', tab: 'prototypes' });
    const r = await runOp('add', { url: 'https://proto.test/', board: 'Check' }, t.deps);
    const made = t.state().boards.find((b) => b.name === 'Check')!;
    expect(made).toMatchObject({ projectId: 'a' });
    expect(r).toMatchObject({ ok: true, result: { boardId: made.id, board: 'Check' } });
  });

  it('with no board and none open leaves it in the library, linked full screen', async () => {
    const t = twoProjects({ name: 'project', project: 'a', tab: 'prototypes' });
    const before = t.state().placements.length;
    const r = await runOp('add', { url: 'https://proto.test/' }, t.deps);
    const f = t.state().frames[t.state().frames.length - 1];
    expect(t.state().placements).toHaveLength(before);
    expect(r).toMatchObject({ ok: true, result: { frameId: f.id, projectId: 'a', boardId: null, board: null, link: `${APP}#/f/${f.id}/full` } });
  });

  it('never auto-stacks', async () => {
    const t = twoProjects({ name: 'board', board: 'b1', frame: null });
    await runOp('add', { url: 'https://cart.test/3' }, t.deps);
    expect(t.addUrlCalls).toHaveLength(1);
    expect(t.addUrlCalls[0][2]).toMatchObject({ stack: false, boardId: 'b1' });
  });

  it('refuses a data: URL', async () => {
    const t = twoProjects({ name: 'board', board: 'b1', frame: null });
    const r = await runOp('add', { url: 'data:text/html,<script>alert(1)</script>' }, t.deps);
    expect(r).toEqual({ ok: false, error: 'Only http and https URLs can go on a board.' });
    expect(t.writes).toEqual([]);
  });

  it("refuses a URL on Canon's own origin, which would run with Canon's storage", async () => {
    const t = twoProjects({ name: 'board', board: 'b1', frame: null });
    const r = await runOp('add', { url: 'https://example.test/canon/app/' }, t.deps);
    expect(r).toEqual({ ok: false, error: "That address is Canon itself. Add the prototype's own address." });
    expect(t.writes).toEqual([]);
    expect(t.addUrlCalls).toEqual([]);
  });

  it('caps names at 200 and widths at 3840', async () => {
    const t = twoProjects({ name: 'board', board: 'b1', frame: null });
    const r = await runOp('add', { url: 'https://proto.test/', name: 'x'.repeat(5000), width: 100_000 }, t.deps);
    const f = t.state().frames[t.state().frames.length - 1];
    expect(f.name).toHaveLength(200);
    expect(f.w).toBe(3840);
    expect(r.ok).toBe(true);
    await runOp('update', { frame: f.id, name: 'y'.repeat(300) }, t.deps);
    expect(t.state().frames.find((x) => x.id === f.id)!.name).toBe('y'.repeat(200));
    const l = await runOp('link', { frame: f.id, width: 99_999 }, t.deps);
    expect(l).toMatchObject({ ok: true, result: { link: expect.stringContaining('w=3840') } });
  });
});

describe('runOp update', () => {
  it('a new URL becomes the next version and the old one stays', async () => {
    const t = fake({
      projects: [project('a', 'Alpha')],
      boards: [board('b1', 'a', 'Checkout')],
      frames: [frame('f0', 'a', 'Cart', { url: 'https://cart.test/1', createdAt: 1 })],
      placements: [place('p1', 'b1', 'f0')],
    });
    const r = await runOp('update', { frame: 'Cart', url: 'https://cart.test/2' }, t.deps);
    expect(t.versionCalls).toEqual([['f0', 'https://cart.test/2']]);
    const made = t.state().frames.find((f) => f.url === 'https://cart.test/2')!;
    expect(t.state().frames.find((f) => f.id === 'f0')).toBeTruthy();
    expect(r).toEqual({
      ok: true,
      result: { frameId: made.id, frame: 'Cart', projectId: 'a', project: 'Alpha', boardId: 'b1', board: 'Checkout', version: 2, versions: 2, newVersion: true, tags: [], link: `${APP}#/f/${made.id}/full` },
    });
    expect(t.toasts).toEqual(['Claude updated Cart']);
  });

  it('newVersion adds the same URL again as the next version', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', url: 'https://cart.test/2', newVersion: true }, t.deps);
    expect(t.versionCalls).toEqual([['f1', 'https://cart.test/2', 'force']]);
    expect(t.state().frames).toHaveLength(4);
    expect(r).toMatchObject({ ok: true, result: { version: 3, versions: 3, newVersion: true } });
  });

  it('newVersion needs a url or a build, and must be true or false, and writes nothing otherwise', async () => {
    const t = twoProjects();
    expect(await runOp('update', { frame: 'Cart', newVersion: true }, t.deps)).toEqual({ ok: false, error: 'newVersion needs url. Pass the address of the new version, or pass folder to add a build.' });
    expect(await runOp('update', { frame: 'Cart', url: 'https://cart.test/3', newVersion: 'yes' }, t.deps)).toEqual({ ok: false, error: 'newVersion must be true or false.' });
    expect(t.writes).toEqual([]);
  });

  it('the same URL adds nothing', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', url: 'https://cart.test/2' }, t.deps);
    expect(t.state().frames).toHaveLength(3);
    expect(r).toMatchObject({ ok: true, result: { frameId: 'f1', version: 2, versions: 2, newVersion: false } });
    expect(t.toasts).toEqual([]);
  });

  it('versions of one stack resolve as one prototype; two stacks are ambiguous', async () => {
    const t = twoProjects();
    expect(await runOp('update', { frame: 'cart', name: 'Basket' }, t.deps)).toMatchObject({ ok: true, result: { frameId: 'f1', frame: 'Basket' } });
    const u = fake({
      projects: [project('a', 'Alpha')],
      frames: [frame('c1', 'a', 'Cart sheet'), frame('c2', 'a', 'Cart page')],
    });
    const r = await runOp('update', { frame: 'cart', name: 'Basket' }, u.deps);
    expect(r).toEqual({ ok: true, result: { status: 'many', candidates: ['Cart sheet', 'Cart page'], what: 'frame', query: 'cart' } });
    expect(u.writes).toEqual([]);
  });

  it("an old version's id still finds its stack", async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'f0', url: 'https://cart.test/3' }, t.deps);
    expect(t.versionCalls).toEqual([['f1', 'https://cart.test/3']]);
    expect(r).toMatchObject({ ok: true, result: { version: 3, versions: 3, newVersion: true } });
  });

  it('rename touches the current version only', async () => {
    const t = twoProjects();
    await runOp('update', { frame: 'Cart', name: 'Basket' }, t.deps);
    const names = Object.fromEntries(t.state().frames.map((f) => [f.id, f.name]));
    expect(names).toMatchObject({ f0: 'Cart v1', f1: 'Basket' });
  });

  it('moveTo moves the one placement; with two boards and no board it asks which', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', moveTo: 'Archive' }, t.deps);
    expect(t.writes).toEqual(['move p1 b2']);
    expect(r).toMatchObject({ ok: true, result: { boardId: 'b2', board: 'Archive', link: `${APP}#/f/f1/full` } });

    const u = twoProjects();
    u.state().placements.push(place('p2', 'b2', 'f0'));
    const many = await runOp('update', { frame: 'Cart', moveTo: 'Checkout', url: 'https://cart.test/9' }, u.deps);
    expect(many).toEqual({ ok: true, result: { status: 'many', candidates: ['Checkout', 'Archive'], what: 'board' } });
    expect(u.writes).toEqual([]);
    const one = await runOp('update', { frame: 'Cart', board: 'Archive', moveTo: 'Checkout' }, u.deps);
    expect(u.writes).toEqual(['move p2 b1']);
    expect(one).toMatchObject({ ok: true, result: { boardId: 'b1' } });
  });

  it('moveTo onto a board from no board places it there', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Hero', moveTo: 'Launch' }, t.deps);
    expect(r).toMatchObject({ ok: true, result: { boardId: 'b3' } });
    const v = fake({ projects: [project('a', 'Alpha')], boards: [board('b1', 'a', 'Checkout')], frames: [frame('f0', 'a', 'Loose')] });
    await runOp('update', { frame: 'Loose', moveTo: 'Checkout' }, v.deps);
    expect(v.writes).toEqual(['place b1 f0']);
  });

  it("moveTo another project's board is refused and nothing changes", async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', moveTo: 'Launch', name: 'Basket' }, t.deps);
    expect(r).toEqual({ ok: false, error: 'That board is in another project.' });
    expect(t.writes).toEqual([]);
  });

  it('says which lookup failed: project, board, moveTo, frame', async () => {
    const t = twoProjects();
    expect(await runOp('update', { project: 'Nope', frame: 'Cart' }, t.deps)).toEqual({ ok: true, result: { status: 'none', candidates: [], what: 'project', query: 'Nope' } });
    expect(await runOp('update', { frame: 'Cart', board: 'Nope' }, t.deps)).toMatchObject({ ok: true, result: { status: 'none', what: 'board', query: 'Nope' } });
    expect(await runOp('update', { frame: 'Cart', moveTo: 'Nowhere' }, t.deps)).toMatchObject({ ok: true, result: { status: 'none', what: 'moveTo', query: 'Nowhere' } });
    expect(await runOp('update', { frame: 'zzz' }, t.deps)).toMatchObject({ ok: true, result: { status: 'none', what: 'frame', query: 'zzz' } });
    expect(await runOp('update', { project: 'Zeta', frame: 'Cart' }, t.deps)).toMatchObject({ ok: true, result: { status: 'none', what: 'frame' } });
    expect(t.writes).toEqual([]);
  });

  it('a bad moveTo with a new URL writes nothing', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', url: 'https://cart.test/9', moveTo: 'Nowhere' }, t.deps);
    expect(r).toMatchObject({ ok: true, result: { status: 'none', what: 'moveTo' } });
    expect(t.versionCalls).toEqual([]);
    expect(t.writes).toEqual([]);
  });

  it("refuses a new URL on Canon's own origin", async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', url: 'https://example.test/canon/app/#/' }, t.deps);
    expect(r).toEqual({ ok: false, error: "That address is Canon itself. Add the prototype's own address." });
    expect(t.writes).toEqual([]);
  });

  it('refuses a javascript: URL', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', url: 'javascript:alert(1)', name: 'Basket' }, t.deps);
    expect(r).toEqual({ ok: false, error: 'Only http and https URLs can go on a board.' });
    expect(t.writes).toEqual([]);
  });
});

describe('runOp open and link', () => {
  it('open navigates and replies with the absolute link', async () => {
    const t = twoProjects();
    const r = await runOp('open', { frame: 'Cart' }, t.deps);
    expect(t.navigated).toEqual(['#/f/f1/full']);
    expect(r).toEqual({ ok: true, result: { link: `${APP}#/f/f1/full` } });
  });

  it('full at phone width with a path builds #/f/f1/full?w=390&path=%2Fcheckout', async () => {
    const t = twoProjects();
    const r = await runOp('link', { frame: 'Cart', full: true, width: 'phone', path: '/checkout' }, t.deps);
    expect(r).toEqual({ ok: true, result: { link: `${APP}#/f/f1/full?w=390&path=%2Fcheckout` } });
  });

  it('version picks that member, oldest first; past the end is refused', async () => {
    const t = twoProjects();
    expect(await runOp('link', { frame: 'Cart', version: 1 }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/f/f0/full` } });
    expect(await runOp('link', { frame: 'Cart', version: 2 }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/f/f1/full` } });
    expect(await runOp('open', { frame: 'Cart', version: 3 }, t.deps)).toEqual({ ok: false, error: 'That prototype has 2 versions, so there is no version 3.' });
    expect(await runOp('link', { frame: 'Hero', version: 2 }, t.deps)).toEqual({ ok: false, error: 'That prototype has only 1 version, so there is no version 2.' });
    expect(t.navigated).toEqual([]);
  });

  it('a prototype on no board links to #/f/<id>/full', async () => {
    const t = fake({ projects: [project('a', 'Alpha')], frames: [frame('f0', 'a', 'Loose')] });
    expect(await runOp('link', { frame: 'Loose' }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/f/f0/full` } });
  });

  it('links the prototype view even when the prototype sits on boards', async () => {
    const t = twoProjects({ name: 'board', board: 'b2', frame: null });
    t.state().placements.push(place('p2', 'b2', 'f0'));
    expect(await runOp('link', { frame: 'Cart' }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/f/f1/full` } });
    const u = twoProjects({ name: 'board', board: 'b3', frame: null });
    u.state().placements.push(place('p2', 'b2', 'f0'));
    expect(await runOp('link', { frame: 'Cart' }, u.deps)).toEqual({ ok: true, result: { link: `${APP}#/f/f1/full` } });
  });

  it('a path leaving the prototype is refused', async () => {
    const t = twoProjects();
    for (const path of ['//evil.test/', 'https://evil.test/', '/\\evil']) {
      expect(await runOp('link', { frame: 'Cart', path }, t.deps)).toEqual({ ok: false, error: 'That path points off the prototype.' });
    }
  });

  it('a path on a files prototype is refused', async () => {
    const t = fake({ projects: [project('a', 'Alpha')], frames: [frame('f0', 'a', 'Bundle', { kind: 'files', url: undefined })] });
    expect(await runOp('link', { frame: 'Bundle', path: '/about' }, t.deps)).toEqual({ ok: false, error: 'Paths only work on URL prototypes.' });
  });

  it('link does not navigate', async () => {
    const t = twoProjects();
    expect(await runOp('link', { board: 'Checkout' }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/b/b1` } });
    expect(await runOp('link', { project: 'Zeta' }, t.deps)).toEqual({ ok: true, result: { link: `${APP}#/p/z` } });
    expect(await runOp('link', {}, t.deps)).toEqual({ ok: false, error: 'Say which project, board or prototype.' });
    expect(t.navigated).toEqual([]);
  });
});

describe('runOp find and status', () => {
  it('find lists projects, boards and one row per stack', async () => {
    const t = twoProjects();
    const r = await runOp('find', {}, t.deps);
    expect(r).toEqual({
      ok: true,
      result: {
        projects: [
          {
            id: 'a', name: 'Alpha',
            boards: [{ id: 'b1', name: 'Checkout' }, { id: 'b2', name: 'Archive' }],
            prototypes: [{ id: 'f1', name: 'Cart v2', kind: 'url', url: 'https://cart.test/2', boards: ['Checkout'], version: 2, versions: 2, created: expect.any(String), updated: expect.any(String) }],
          },
          {
            id: 'z', name: 'Zeta',
            boards: [{ id: 'b3', name: 'Launch' }],
            prototypes: [{ id: 'g1', name: 'Hero', kind: 'url', url: 'https://g1.test/', boards: ['Launch'], version: 1, versions: 1, created: expect.any(String), updated: expect.any(String) }],
          },
        ],
      },
    });
  });

  it("find matches project, board, any version's name and URL, case-insensitively", async () => {
    const t = twoProjects();
    const names = async (args: object) => {
      const r = await runOp('find', args, t.deps);
      return r.ok ? r.result.projects.map((p: any) => [p.name, p.boards.map((b: any) => b.name), p.prototypes.map((f: any) => f.name)]) : r;
    };
    expect(await names({ query: 'ZETA' })).toEqual([['Zeta', ['Launch'], ['Hero']]]);
    expect(await names({ query: 'archive' })).toEqual([['Alpha', ['Archive'], []]]);
    expect(await names({ query: 'CART V1' })).toEqual([['Alpha', [], ['Cart v2']]]);
    expect(await names({ query: 'G1.TEST' })).toEqual([['Zeta', [], ['Hero']]]);
    expect(await names({ project: 'alpha' })).toEqual([['Alpha', ['Checkout', 'Archive'], ['Cart v2']]]);
    expect(await runOp('find', { project: 'Nope' }, t.deps)).toMatchObject({ ok: true, result: { status: 'none', what: 'project' } });
  });

  it('find stops at 200 and says truncated', async () => {
    const frames = Array.from({ length: 205 }, (_, i) => frame(`f${i}`, 'a', `Proto ${i}`, { createdAt: i }));
    const t = fake({ projects: [project('a', 'Alpha')], frames });
    const r = await runOp('find', {}, t.deps);
    expect(r.ok && r.result.projects[0].prototypes).toHaveLength(200);
    expect(r.ok && r.result.truncated).toBe(true);
    const small = await runOp('find', { query: 'Proto 1' }, t.deps);
    expect(small.ok && small.result.truncated).toBeUndefined();
  });

  it('status names the open project and board', async () => {
    const t = twoProjects({ name: 'full', frame: 'f1', board: 'b1', width: null, path: null });
    expect(await runOp('status', {}, t.deps)).toEqual({ ok: true, result: { projects: 2, boards: 3, prototypes: 2, openProject: 'Alpha', openBoard: 'Checkout' } });
    const home = twoProjects();
    expect(await runOp('status', {}, home.deps)).toEqual({ ok: true, result: { projects: 2, boards: 3, prototypes: 2 } });
  });

  it('openProjectId follows the route to its project', () => {
    const s = twoProjects().state();
    expect(openProjectId({ name: 'home' }, s)).toBeNull();
    expect(openProjectId({ name: 'project', project: 'z', tab: 'boards' }, s)).toBe('z');
    expect(openProjectId({ name: 'project', project: 'gone', tab: 'boards' }, s)).toBeNull();
    expect(openProjectId({ name: 'board', board: 'b3', frame: null }, s)).toBe('z');
    expect(openProjectId({ name: 'bundle', frame: 'f0', from: null, page: null }, s)).toBe('a');
    expect(openProjectId({ name: 'full', frame: 'g1', board: null, width: null, path: null }, s)).toBe('z');
  });

  it('an unknown op fails plainly', async () => {
    const t = fake();
    expect(await runOp('delete', {}, t.deps)).toEqual({ ok: false, error: 'Canon does not know how to delete.' });
    expect(await runOp('__proto__', {}, t.deps)).toMatchObject({ ok: false });
  });
});


describe('names, summaries, tags, star, note and archive', () => {
  const proj = () => [project('a', 'Alpha')];
  const rows = (r: any) => (r.ok ? r.result.projects.flatMap((p: any) => p.prototypes) : r);

  it('find with the query pricing returns a prototype whose summary mentions pricing and whose name does not', async () => {
    const t = fake({
      projects: proj(),
      frames: [
        frame('f1', 'a', 'Plans, annual toggle', { summary: 'The pricing page with yearly billing on by default.' }),
        frame('f2', 'a', 'Hero'),
      ],
    });
    const r = rows(await runOp('find', { query: 'pricing' }, t.deps));
    expect(r.map((x: any) => x.name)).toEqual(['Plans, annual toggle']);
    expect(r[0].summary).toBe('The pricing page with yearly billing on by default.');
  });

  it('find searches tags', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'One', { tags: ['onboarding'] }), frame('f2', 'a', 'Two')] });
    expect(rows(await runOp('find', { query: 'onboard' }, t.deps)).map((x: any) => x.name)).toEqual(['One']);
  });

  it("find filters by tag, and a near tag finds the project's own tag", async () => {
    const t = fake({
      projects: proj(),
      frames: [frame('f1', 'a', 'One', { tags: ['pricing'], createdAt: 1 }), frame('f2', 'a', 'Two', { tags: ['hero'], createdAt: 2 }), frame('f3', 'a', 'Three', { createdAt: 3 })],
    });
    expect(rows(await runOp('find', { tag: 'pricing' }, t.deps)).map((x: any) => x.name)).toEqual(['One']);
    expect(rows(await runOp('find', { tag: ' Pricing! ' }, t.deps)).map((x: any) => x.name)).toEqual(['One']);
    expect(rows(await runOp('find', { tag: 'Pricing page' }, t.deps)).map((x: any) => x.name)).toEqual(['One']);
    // A project name match no longer pulls in prototypes that fail the filter, or ones that only share the project.
    const a = await runOp('find', { tag: 'pricing', query: 'alpha' }, t.deps);
    expect(rows(a)).toEqual([]);
    const b = await runOp('find', { tag: 'pricing', project: 'Alpha' }, t.deps);
    expect(rows(b).map((x: any) => x.name)).toEqual(['One']);
  });

  it('find filters by starred', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'One', { starred: true, createdAt: 1 }), frame('f2', 'a', 'Two', { createdAt: 2 })] });
    const yes = rows(await runOp('find', { starred: true }, t.deps));
    expect(yes.map((x: any) => x.name)).toEqual(['One']);
    expect(yes[0].starred).toBe(true);
    expect(rows(await runOp('find', { starred: false }, t.deps)).map((x: any) => x.name)).toEqual(['Two']);
    expect(rows(await runOp('find', {}, t.deps))[0]).not.toHaveProperty('starred');
  });

  it('find leaves archived prototypes out, and archived: true shows only them', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'Old', { archived: true, createdAt: 1 }), frame('f2', 'a', 'New', { createdAt: 2 })] });
    expect(rows(await runOp('find', {}, t.deps)).map((x: any) => x.name)).toEqual(['New']);
    const only = rows(await runOp('find', { archived: true }, t.deps));
    expect(only.map((x: any) => x.name)).toEqual(['Old']);
    expect(only[0].archived).toBe(true);
  });

  it('add stores summary, source, star and note, and returns the names already in the project', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'Older', { createdAt: 1 }), frame('f2', 'a', 'Newer', { createdAt: 2 })] });
    const r = await runOp('add', { url: 'https://proto.test/', project: 'Alpha', name: 'Fresh', summary: 'A fresh one.', repo: 'shop', branch: 'cart', starred: true, note: 'Look at this.' }, t.deps);
    const f = t.state().frames[t.state().frames.length - 1];
    expect(f).toMatchObject({ summary: 'A fresh one.', repo: 'shop', branch: 'cart', tool: 'Claude', starred: true, note: 'Look at this.' });
    expect(r).toMatchObject({ ok: true, result: { summary: 'A fresh one.', names: ['Newer', 'Older'] } });
  });

  it("add merges the agent's tags with automatic ones from the page, the agent, the repo and the branch", async () => {
    const t = fake({ projects: proj() });
    const r = await runOp('add', {
      url: 'https://proto.test/', project: 'Alpha', tags: ['Mobile'], repo: 'shop', branch: 'cart-redo',
      page: { title: 'Checkout flow | Shop', headings: ['Payment', 'Review order'] },
    }, t.deps);
    expect(r.ok && r.result.tags).toEqual(expect.arrayContaining(['mobile', 'claude', 'shop', 'cart-redo', 'checkout flow', 'payment']));
    expect(r.ok && r.result.tags[0]).toBe('mobile');
    expect(t.state().frames[0].tags).toEqual(r.ok && r.result.tags);
  });

  it('add with no page gets only the source tag', async () => {
    const t = fake({ projects: proj(), agentName: 'Agent' });
    const r = await runOp('add', { url: 'https://proto.test/', project: 'Alpha' }, t.deps);
    expect(r.ok && r.result.tags).toEqual(['agent']);
  });

  it('add reuses a tag the project already has', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'Plans', { tags: ['pricing'] })] });
    const r = await runOp('add', { url: 'https://proto.test/', project: 'Alpha', page: { title: 'Pricing page', headings: [] } }, t.deps);
    const tags: string[] = r.ok ? r.result.tags : [];
    expect(tags.filter((x) => x === 'pricing')).toHaveLength(1);
    expect(tags).not.toContain('pricing page');
  });

  it('add refuses tags that are not a list of text, before writing', async () => {
    const t = fake({ projects: proj() });
    for (const tags of ['pricing', [1, 2], { a: 1 }, Array.from({ length: 500 }, (_, i) => `t${i}`)]) {
      const r = await runOp('add', { url: 'https://proto.test/', project: 'Gamma', board: 'New', tags }, t.deps);
      expect(r.ok).toBe(false);
      expect(t.writes).toEqual([]);
    }
    const r = await runOp('add', { url: 'https://proto.test/', project: 'Gamma', tags: 'x' }, t.deps);
    expect(r).toEqual({ ok: false, error: 'tags must be a list of text.' });
    const s = await runOp('add', { url: 'https://proto.test/', project: 'Gamma', starred: 'yes' }, t.deps);
    expect(s).toEqual({ ok: false, error: 'starred must be true or false.' });
    expect(t.writes).toEqual([]);
  });

  it('add records that a linked page refuses to be framed, and says nothing for one that allows it', async () => {
    const t = fake({ projects: proj() });
    await runOp('add', { url: 'https://membership-one.webflow.io/', project: 'Alpha', page: { title: 'Members', headings: [], frameBlocked: true } }, t.deps);
    await runOp('add', { url: 'https://open.test/', project: 'Alpha', page: { title: 'Open', headings: [] } }, t.deps);
    const [blocked, open] = t.state().frames;
    expect(blocked.frameBlocked).toBe(true);
    expect(open.frameBlocked).toBeUndefined();
  });

  it('update records and clears the finding on the version it adds, and ignores anything but true', async () => {
    const t = fake({ projects: proj(), frames: [frame('f1', 'a', 'Cart', { url: 'https://cart.test/1', createdAt: 1 })] });
    await runOp('update', { frame: 'Cart', url: 'https://cart.test/2', page: { title: 'Cart', headings: [], frameBlocked: true } }, t.deps);
    const v2 = () => t.state().frames.find((f) => f.url === 'https://cart.test/2')!;
    expect(v2().frameBlocked).toBe(true);
    await runOp('update', { frame: 'Cart', url: 'https://cart.test/2', page: { title: 'Cart', headings: [] } }, t.deps);
    expect(v2().frameBlocked).toBeFalsy();
    await runOp('update', { frame: 'Cart', url: 'https://cart.test/2', page: { title: 'Cart', headings: [], frameBlocked: 'yes' } }, t.deps);
    expect(v2().frameBlocked).toBeFalsy();
  });

  it('add ignores a malformed page and cuts long text', async () => {
    const t = fake({ projects: proj(), agentName: 'Agent' });
    const r = await runOp('add', { url: 'https://proto.test/', project: 'Alpha', page: 'nope', summary: 'x'.repeat(900), note: 'n'.repeat(5000) }, t.deps);
    expect(r.ok && r.result.tags).toEqual(['agent']);
    const f = t.state().frames[0];
    expect(f.summary).toHaveLength(300);
    expect(f.note).toHaveLength(2000);
  });

  it('update removes a tag and it stays removed when a new URL brings it back', async () => {
    const t = fake({
      projects: proj(),
      frames: [frame('f1', 'a', 'Cart', { url: 'https://cart.test/1', tags: ['claude', 'payment'], createdAt: 1 })],
    });
    const r = await runOp('update', { frame: 'Cart', removeTags: ['Payment'] }, t.deps);
    expect(r.ok && r.result.tags).toEqual(['claude']);
    expect(t.state().frames[0].removedTags).toEqual(['payment']);
    const u = await runOp('update', { frame: 'Cart', url: 'https://cart.test/2', page: { title: 'Payment', headings: ['Payment', 'Totals'] } }, t.deps);
    expect(u.ok && u.result.tags).toEqual(['claude', 'totals']);
    const cur = t.state().frames.find((f) => f.url === 'https://cart.test/2')!;
    expect(cur.tags).toEqual(['claude', 'totals']);
    expect(cur.removedTags).toEqual(['payment']);
  });

  it('update sets star, note and archive across every version', async () => {
    const t = twoProjects();
    const r = await runOp('update', { frame: 'Cart', starred: true, note: 'Ship this', archived: true, summary: 'The cart.' }, t.deps);
    expect(r.ok).toBe(true);
    for (const id of ['f0', 'f1']) {
      expect(t.state().frames.find((f) => f.id === id)).toMatchObject({ starred: true, note: 'Ship this', archived: true, summary: 'The cart.' });
    }
    expect(t.state().frames.find((f) => f.id === 'g1')).not.toHaveProperty('starred');
    expect(t.writes.filter((w) => w.startsWith('updateMeta'))).toHaveLength(1);
    expect(t.toasts).toEqual(['Claude updated Cart v2']);
  });

  it('update refuses bad fields before writing', async () => {
    const t = twoProjects();
    expect(await runOp('update', { frame: 'Cart', name: 'X', removeTags: [1] }, t.deps)).toEqual({ ok: false, error: 'removeTags must be a list of text.' });
    expect(await runOp('update', { frame: 'Cart', name: 'X', archived: 1 }, t.deps)).toEqual({ ok: false, error: 'archived must be true or false.' });
    expect(t.writes).toEqual([]);
  });

  it('a prototype saved before these fields can be found, updated and opened, and gains no fields it was not given', async () => {
    const t = twoProjects({ name: 'board', board: 'b1', frame: null });
    const before = JSON.stringify(t.state().frames);
    const found = await runOp('find', {}, t.deps);
    expect(rows(found)[0]).toEqual(expect.not.objectContaining({ tags: expect.anything() }));
    expect(JSON.stringify(t.state().frames)).toBe(before);
    expect(await runOp('open', { frame: 'Cart' }, t.deps)).toMatchObject({ ok: true });
    expect(JSON.stringify(t.state().frames)).toBe(before);
    const r = await runOp('update', { frame: 'Cart', name: 'Basket' }, t.deps);
    expect(r).toMatchObject({ ok: true, result: { tags: [] } });
    expect(t.writes).toEqual(['updateFrame f1']);
    for (const f of t.state().frames) {
      for (const k of ['tags', 'removedTags', 'summary', 'starred', 'note', 'archived', 'repo', 'branch', 'tool']) expect(f).not.toHaveProperty(k);
    }
    const v = await runOp('update', { frame: 'Basket', url: 'https://cart.test/3' }, t.deps);
    expect(v).toMatchObject({ ok: true, result: { newVersion: true, tags: [] } });
    for (const f of t.state().frames) expect(f).not.toHaveProperty('tags');
  });
});
