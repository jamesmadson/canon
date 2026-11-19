import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real store over an in-memory database that counts every write.
const db = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  log: [] as string[],
  failOn: null as string | null,
}));
const tableOf = (n: string) => (db.tables[n] ??= []);
const upsert = (n: string, v: any) => {
  const t = tableOf(n);
  const i = t.findIndex((x) => x.id === v.id);
  if (i >= 0) t[i] = structuredClone(v); else t.push(structuredClone(v));
};
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(tableOf(n)),
  put: async (n: string, v: any) => { db.log.push(`put ${n}`); upsert(n, v); },
  putMany: async (n: string, vs: any[]) => {
    if (!vs.length) return;
    if (db.failOn === n) throw new Error('disk full');
    db.log.push(`putMany ${n}`);
    vs.forEach((v) => upsert(n, v));
  },
  remove: async (n: string, id: string) => {
    if (db.failOn === `remove ${n}`) throw new Error('disk full');
    db.log.push(`remove ${n}`);
    db.tables[n] = tableOf(n).filter((x) => x.id !== id);
  },
  replaceFiles: async () => {},
}));

import * as store from '../../src/app/store';

const frame = (id: string, projectId: string, extra: object = {}) => ({
  id, projectId, name: id, kind: 'url', url: `https://x.test/${id}`, x: 0, y: 0, w: 400, h: 300, rev: 0, createdAt: 1000, updatedAt: 1000, ...extra,
});

function seed() {
  db.tables = {
    projects: [
      { id: 'A', name: 'Alpha', createdAt: 1, updatedAt: 10 },
      { id: 'B', name: 'Beta', createdAt: 2, updatedAt: 20 },
      { id: 'C', name: 'Empty', createdAt: 3, updatedAt: 30 },
    ],
    boards: [
      { id: 'a1', projectId: 'A', name: 'Main', createdAt: 1, updatedAt: 5, arrangement: 'free' },
      { id: 'a2', projectId: 'A', name: 'Side', createdAt: 1, updatedAt: 4, arrangement: 'free' },
      { id: 'b1', projectId: 'B', name: 'Beta main', createdAt: 1, updatedAt: 9, arrangement: 'free' },
      { id: 'b2', projectId: 'B', name: 'Beta old', createdAt: 1, updatedAt: 3, arrangement: 'free' },
    ],
    frames: [
      // A stack of two versions with every kind of meta.
      frame('p1', 'A', { stackId: 'p1', createdAt: 1000, note: 'Keep', starred: true, tags: ['nav'], removedTags: ['old'], archived: true, summary: 'S', cover: 'cover.png', liveUrl: 'http://localhost:1' }),
      frame('p2', 'A', { stackId: 'p1', current: true, createdAt: 2000, note: 'Keep', starred: true, tags: ['nav'], removedTags: ['old'], archived: true, summary: 'S' }),
      frame('q1', 'A', { createdAt: 3000 }),
      frame('r1', 'B', { createdAt: 500, w: 400 }),
    ],
    placements: [
      { id: 'pl1', boardId: 'a1', frameId: 'p2', x: 40, y: 50 },
      { id: 'pl2', boardId: 'a2', frameId: 'p1', x: 400, y: 0 },
      { id: 'pl3', boardId: 'a1', frameId: 'q1', x: 600, y: 0 },
      { id: 'pl4', boardId: 'b1', frameId: 'r1', x: 0, y: 0 },
    ],
    notes: [
      { id: 'n1', boardId: 'a1', frameId: 'p2', page: undefined, said: 'On the prototype', replies: [{ id: 'rp', author: 'J', body: 'Reply', createdAt: 1 }], createdAt: 1 },
      { id: 'n2', boardId: 'a2', frameId: 'p1', said: 'On an older version', createdAt: 2 },
      { id: 'n3', boardId: 'a1', said: 'On the board canvas', wx: 10, wy: 10, createdAt: 3 },
      { id: 'n4', boardId: 'a1', frameId: 'p2', wx: 5, wy: 5, said: 'In its open canvas', createdAt: 4 },
    ],
  };
  db.log = [];
  db.failOn = null;
}
const snapshot = () => structuredClone({ projects: db.tables.projects, boards: db.tables.boards, frames: db.tables.frames, placements: db.tables.placements, notes: db.tables.notes });
const byId = (xs: any[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
const norm = (s: ReturnType<typeof snapshot>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, byId(v as any[])]));

beforeEach(async () => { seed(); await store.load(); vi.useRealTimers(); });

describe('moving a prototype to another project', () => {
  it('takes every version, keeping ids, meta, cover and files in place', async () => {
    await store.moveToProject(['p2'], { id: 'B' });
    const s = store.getState();
    for (const id of ['p1', 'p2']) {
      const f = s.frames.find((x) => x.id === id)!;
      expect(f.projectId).toBe('B');
      expect(f.stackId).toBe('p1');
    }
    const p1 = s.frames.find((x) => x.id === 'p1')!;
    expect(p1).toMatchObject({ note: 'Keep', starred: true, tags: ['nav'], removedTags: ['old'], archived: true, summary: 'S', cover: 'cover.png', liveUrl: 'http://localhost:1' });
    expect(s.frames.find((x) => x.id === 'p2')!.current).toBe(true);
    expect(s.frames).toHaveLength(4);
    // Stored copy of the data agrees with the screen.
    expect(db.tables.frames.filter((f) => f.projectId === 'B').map((f) => f.id).sort()).toEqual(['p1', 'p2', 'r1']);
  });

  it('leaves every board of the old project and lands on the target project’s first board in the next free spot', async () => {
    await store.moveToProject(['p1'], { id: 'B' });
    const s = store.getState();
    expect(s.placements.filter((p) => ['a1', 'a2'].includes(p.boardId) && ['p1', 'p2'].includes(p.frameId))).toEqual([]);
    const landed = s.placements.filter((p) => ['p1', 'p2'].includes(p.frameId));
    expect(landed).toHaveLength(1);
    // Boards are ordered by use: Beta main (updated 9) comes first. The landing is to the right of r1 (400 wide) by 120.
    expect(landed[0]).toMatchObject({ boardId: 'b1', frameId: 'p2', x: 520, y: 0 });
    expect(s.placements.find((p) => p.id === 'pl3')).toBeTruthy();
  });

  it('puts it on no board when the target project has none, and it still lists in the project', async () => {
    await store.moveToProject(['q1'], { id: 'C' });
    const s = store.getState();
    expect(s.placements.some((p) => p.frameId === 'q1')).toBe(false);
    expect(store.prototypesOf('C').map((f) => f.id)).toEqual(['q1']);
  });

  it('moves comments with the prototype and keeps board canvas comments on their board', async () => {
    await store.moveToProject(['p1'], { id: 'B' });
    const s = store.getState();
    const n = (id: string) => s.notes.find((x) => x.id === id)!;
    expect(n('n1')).toMatchObject({ frameId: 'p2', boardId: 'b1', said: 'On the prototype' });
    expect(n('n1').replies).toHaveLength(1);
    expect(n('n2').boardId).toBe('b1');
    expect(n('n4')).toMatchObject({ frameId: 'p2', wx: 5, boardId: 'b1' });
    expect(n('n3')).toMatchObject({ boardId: 'a1', wx: 10 });
    expect(store.allNotesOf('p2').map((x) => x.id).sort()).toEqual(['n1', 'n4']);
    expect(store.notesInProject('B').map((x) => x.id).sort()).toEqual(['n1', 'n2', 'n4']);
    expect(s.notes).toHaveLength(4);
  });

  it('points comments at no board when the target has none', async () => {
    await store.moveToProject(['p1'], { id: 'C' });
    expect(store.getState().notes.find((x) => x.id === 'n1')!.boardId).toBe('');
    expect(store.getState().notes).toHaveLength(4);
  });

  it('leaves tags alone', async () => {
    const before = JSON.stringify(store.getState().frames.map((f) => [f.id, f.tags, f.removedTags]));
    await store.moveToProject(['p1', 'q1'], { id: 'B' });
    expect(JSON.stringify(store.getState().frames.map((f) => [f.id, f.tags, f.removedTags]))).toBe(before);
  });

  it('makes a new project in the same step, with the name typed', async () => {
    const r = await store.moveToProject(['q1'], { name: '  Gamma  ' });
    const g = store.getState().projects.find((p) => p.name === 'Gamma')!;
    expect(g).toBeTruthy();
    expect(r!.project.id).toBe(g.id);
    expect(store.getState().frames.find((f) => f.id === 'q1')!.projectId).toBe(g.id);
    expect(db.tables.projects.some((p) => p.id === g.id)).toBe(true);
  });

  it('refuses a new project with no name before making anything', async () => {
    await expect(store.moveToProject(['q1'], { name: '  ' })).rejects.toThrow(/name/);
    expect(store.getState().projects).toHaveLength(3);
  });

  it('keeps a project that was left empty', async () => {
    await store.moveToProject(['p1', 'q1'], { id: 'B' });
    expect(store.getState().projects.map((p) => p.id)).toContain('A');
    expect(store.prototypesOf('A')).toEqual([]);
    expect(store.boardsOf('A')).toHaveLength(2);
  });

  it('moves several at once by the same rules, in one step', async () => {
    const r = await store.moveToProject(['p2', 'p1', 'q1'], { id: 'B' });
    expect(r!.moved).toBe(2);
    const s = store.getState();
    const landed = s.placements.filter((p) => p.boardId === 'b1' && ['p2', 'q1'].includes(p.frameId));
    expect(landed.map((p) => p.frameId).sort()).toEqual(['p2', 'q1']);
    expect(landed[0].x).not.toBe(landed[1].x);
    // One write for all the prototypes, one for all the new spots.
    expect(db.log.filter((l) => l === 'putMany frames')).toHaveLength(1);
    expect(db.log.filter((l) => l === 'putMany placements')).toHaveLength(1);
    expect(db.log.filter((l) => l === 'putMany notes')).toHaveLength(1);
    await r!.undo();
    expect(store.getState().frames.filter((f) => f.projectId === 'A').map((f) => f.id).sort()).toEqual(['p1', 'p2', 'q1']);
  });

  it('does nothing for a prototype already in that project', async () => {
    expect(await store.moveToProject(['r1'], { id: 'B' })).toBeNull();
    expect(db.log).toEqual([]);
  });

  it('shows a toast with Undo for eight seconds', async () => {
    vi.useFakeTimers();
    await store.moveToProject(['q1'], { id: 'B' });
    expect(store.getState().toast).toBe('Moved to Beta.');
    expect(store.getState().toastAction?.label).toBe('Undo');
    vi.advanceTimersByTime(7900);
    expect(store.getState().toast).toBe('Moved to Beta.');
    vi.advanceTimersByTime(200);
    expect(store.getState().toast).toBeNull();
    expect(store.getState().toastAction).toBeNull();
  });
});

describe('undoing a move', () => {
  it('puts back the exact previous state, in memory and on disk', async () => {
    const before = norm(snapshot());
    const memBefore = structuredClone(store.getState());
    const r = await store.moveToProject(['p1', 'q1'], { id: 'B' });
    expect(norm(snapshot())).not.toEqual(before);
    await r!.undo();
    expect(norm(snapshot())).toEqual(before);
    const s = store.getState();
    for (const k of ['projects', 'boards', 'frames', 'placements', 'notes'] as const) {
      expect(byId(s[k] as any[])).toEqual(byId(memBefore[k] as any[]));
    }
  });

  it('removes a project made by the move', async () => {
    const before = norm(snapshot());
    const r = await store.moveToProject(['q1'], { name: 'Gamma' });
    await r!.undo();
    expect(norm(snapshot())).toEqual(before);
    expect(store.getState().projects.map((p) => p.name)).not.toContain('Gamma');
  });

  it('restores a move to a project with no boards', async () => {
    const before = norm(snapshot());
    const r = await store.moveToProject(['p1'], { id: 'C' });
    await r!.undo();
    expect(norm(snapshot())).toEqual(before);
  });

  it('runs from the toast button', async () => {
    const before = norm(snapshot());
    await store.moveToProject(['p1'], { id: 'B' });
    store.getState().toastAction!.run();
    await vi.waitFor(() => expect(norm(snapshot())).toEqual(before));
    expect(store.getState().toast).toBeNull();
  });

  it('keeps edits made after the move', async () => {
    const r = await store.moveToProject(['q1'], { id: 'B' });
    await store.setStarred('q1', true);
    await r!.undo();
    expect(store.getState().frames.find((f) => f.id === 'q1')).toMatchObject({ projectId: 'A', starred: true });
  });
});

describe('an interrupted move', () => {
  it('never leaves a prototype in no project or on no board when the old spots cannot be removed', async () => {
    db.failOn = 'remove placements';
    await expect(store.moveToProject(['p1'], { id: 'B' })).rejects.toThrow('disk full');
    // New side was written first: the prototype is in B, on B's board, and still has its old spots.
    const frames = db.tables.frames.filter((f) => ['p1', 'p2'].includes(f.id));
    expect(frames.every((f) => f.projectId === 'B')).toBe(true);
    expect(db.tables.placements.some((p) => p.boardId === 'b1' && p.frameId === 'p2')).toBe(true);
    expect(db.tables.notes).toHaveLength(4);
  });

  it('changes nothing about the prototypes when the new spots cannot be written', async () => {
    db.failOn = 'placements';
    await expect(store.moveToProject(['p1'], { id: 'B' })).rejects.toThrow('disk full');
    expect(db.tables.frames.filter((f) => ['p1', 'p2'].includes(f.id)).every((f) => f.projectId === 'A')).toBe(true);
    expect(db.tables.placements).toHaveLength(4);
  });
});

describe('a board in another project', () => {
  it('moves the whole prototype there, onto that board', async () => {
    await store.moveToBoard('pl3', 'b2');
    const s = store.getState();
    expect(s.frames.find((f) => f.id === 'q1')!.projectId).toBe('B');
    expect(s.placements.filter((p) => p.frameId === 'q1')).toMatchObject([{ boardId: 'b2' }]);
    expect(s.toast).toBeNull();
  });
});
