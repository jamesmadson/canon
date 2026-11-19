import * as db from './db';
import type { Board, Frame, FrameMeta, Note, Placement, Project, Reply } from './db';
import { addTag, hostTag, mergeTags, removeTag } from './lib/tags';
import { dropTags } from './lib/page';
import type { Prepared } from './intake';
import { walkHandle, prepare } from './intake';
import type { LibraryItem } from './lib/library';
import { inheritedMeta, metaOf } from './lib/meta';
import { SAMPLES, SAMPLE_SITE } from './samples';
import { nameFromUrl } from './lib/linkname';
import { stackFor, stackKey, swapsFor, versionOf, currentOf } from './lib/versions';

export interface State {
  projects: Project[];
  boards: Board[];
  frames: Frame[];
  placements: Placement[];
  notes: Note[];
  ready: boolean;
  toast: string | null;
  /** A button on the toast, such as Undo. */
  toastAction?: { label: string; run: () => void } | null;
  vault: Vault;
}

/**
 * Where the library is kept beyond this browser. A Canon folder on disk is the
 * durable copy; the browser's storage is the fast one.
 */
export type Vault =
  | { status: 'unsupported' }
  | { status: 'none' }
  | { status: 'needs-permission'; name: string }
  | { status: 'connected'; name: string; savedAt: number | null; saving: boolean; error?: string };

let state: State = { projects: [], boards: [], frames: [], placements: [], notes: [], ready: false, toast: null, vault: { status: 'none' } };
const listeners = new Set<() => void>();

export const getState = () => state;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const setVault = (vault: Vault) => set({ vault });
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => Date.now();

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string, action?: { label: string; run: () => void }, ms = action ? 8000 : 3200) {
  set({ toast: message, toastAction: action ?? null });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), ms);
}
export function dismissToast() {
  clearTimeout(toastTimer);
  set({ toast: null, toastAction: null });
}

db.onStaleConnection(() => toast('Canon was updated in another tab. Reload this one.'));

/* ── Installing as an app ──────────────────────────────────────────────── */
export interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installPrompt: InstallPromptEvent | null = null;
export const canInstall = () => !!installPrompt;
export const isInstalled = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
export function setInstallPrompt(e: InstallPromptEvent | null) {
  installPrompt = e;
  set({});
}
export async function install() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === 'accepted') toast('Installed. Canon is in your Dock or Start menu now.');
  setInstallPrompt(null);
}

/* ── Who you are, for comments. Kept in this browser. ──────────────────── */
const NAME_KEY = 'canon-name';
export function myName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}
export function setMyName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    /* private mode: the name lasts this session only */
  }
  set({});
}

export async function load() {
  const [projects, boards, frames, placements, notes] = await Promise.all([
    db.getAll<Project>('projects'),
    db.getAll<Board>('boards'),
    db.getAll<Frame>('frames'),
    db.getAll<Placement>('placements'),
    db.getAll<Note>('notes'),
  ]);
  set({ projects, boards, frames, placements, notes, ready: true });
}

/** Notes filed from a preview tab land in IndexedDB directly; pick them up. */
export async function reloadNotes() {
  set({ notes: await db.getAll<Note>('notes') });
}

/* ── Reading ───────────────────────────────────────────────────────────── */
export const boardsOf = (projectId: string) =>
  state.boards.filter((b) => b.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt);
export const prototypesOf = (projectId: string) =>
  state.frames.filter((f) => f.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
export const placementsOf = (boardId: string) => state.placements.filter((p) => p.boardId === boardId);
export const boardsHolding = (frameId: string) =>
  state.placements.filter((p) => p.frameId === frameId).map((p) => state.boards.find((b) => b.id === p.boardId)).filter(Boolean) as Board[];

/** A prototype as it sits on one board: the library entry, at that board's position. */
export type BoardFrame = Frame & { placementId: string };
export function framesOf(boardId: string): BoardFrame[] {
  const out: BoardFrame[] = [];
  for (const pl of placementsOf(boardId)) {
    const f = state.frames.find((x) => x.id === pl.frameId);
    if (f) out.push({ ...f, x: pl.x, y: pl.y, placementId: pl.id });
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/** Notes on one page of a prototype. With no page, the notes on its entry page. */
export function notesOf(frameId: string, page?: string) {
  const frame = state.frames.find((f) => f.id === frameId);
  const target = page ?? frame?.entry;
  return state.notes
    .filter((n) => n.frameId === frameId && n.wx === undefined && (n.page ?? frame?.entry) === target)
    .sort((a, b) => a.createdAt - b.createdAt);
}
export const allNotesOf = (frameId: string) => state.notes.filter((n) => n.frameId === frameId);
export const canvasNotesOf = (boardId: string) => state.notes.filter((n) => n.boardId === boardId && !n.frameId);
/** Notes dropped on the open canvas inside a bundle, in that bundle's own space. */
export const bundleCanvasNotesOf = (frameId: string) => state.notes.filter((n) => n.frameId === frameId && n.wx !== undefined);
/** Every thread you would see on a board: on its prototypes' entry pages, and on its canvas. */
export function threadsOnBoard(boardId: string) {
  const ids = new Set(placementsOf(boardId).map((p) => p.frameId));
  return state.notes.filter((n) => (n.frameId ? ids.has(n.frameId) && n.wx === undefined && (!n.page || n.page === state.frames.find((f) => f.id === n.frameId)?.entry) : n.boardId === boardId));
}
export function notesInProject(projectId: string) {
  const frames = new Set(prototypesOf(projectId).map((f) => f.id));
  const boards = new Set(boardsOf(projectId).map((b) => b.id));
  return state.notes.filter((n) => (n.frameId ? frames.has(n.frameId) : boards.has(n.boardId)));
}
/** Where a note sits down a page, in CSS px, whichever way it was stored. */
export const noteY = (n: Note, frameH: number) => n.py ?? (n.fy ?? 0) * frameH;

export function libraryItems(projectId: string): (LibraryItem & { frame: Frame })[] {
  return prototypesOf(projectId).map((f) => ({
    id: f.id, name: f.name, kind: f.kind, pages: f.pages?.length ?? 1,
    boards: state.placements.filter((p) => p.frameId === f.id).length,
    comments: allNotesOf(f.id).filter((n) => !n.resolved).length,
    createdAt: f.createdAt, updatedAt: f.updatedAt, summary: f.summary, tags: f.tags, starred: f.starred, archived: f.archived, frame: f,
  }));
}

/* ── Projects and boards ───────────────────────────────────────────────── */
async function touchProject(projectId: string) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;
  const next = { ...p, updatedAt: now() };
  await db.put('projects', next);
  set({ projects: state.projects.map((x) => (x.id === projectId ? next : x)) });
}
async function touchBoard(boardId: string) {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return;
  const next = { ...board, updatedAt: now() };
  await db.put('boards', next);
  set({ boards: state.boards.map((b) => (b.id === boardId ? next : b)) });
  await touchProject(board.projectId);
}

export async function createProject(name = 'Untitled project'): Promise<Project> {
  const project: Project = { id: uid(), name, createdAt: now(), updatedAt: now() };
  await db.put('projects', project);
  set({ projects: [...state.projects, project] });
  return project;
}
export async function renameProject(id: string, name: string) {
  const p = state.projects.find((x) => x.id === id);
  if (!p || !name.trim()) return;
  const next = { ...p, name: name.trim(), updatedAt: now() };
  await db.put('projects', next);
  set({ projects: state.projects.map((x) => (x.id === id ? next : x)) });
}

export async function createBoard(projectId: string, name = 'Untitled board'): Promise<Board> {
  const board: Board = { id: uid(), projectId, name, createdAt: now(), updatedAt: now(), arrangement: 'free' };
  await db.put('boards', board);
  set({ boards: [...state.boards, board] });
  await touchProject(projectId);
  return board;
}
async function patchBoard(id: string, patch: Partial<Board>) {
  const board = state.boards.find((b) => b.id === id);
  if (!board) return;
  const next = { ...board, ...patch };
  // State first, then disk: two quick edits must not race each other.
  set({ boards: state.boards.map((b) => (b.id === id ? next : b)) });
  await db.put('boards', next);
}
export const renameBoard = (id: string, name: string) => name.trim() && patchBoard(id, { name: name.trim(), updatedAt: now() });
export const setArrangement = (id: string, arrangement: Board['arrangement']) => patchBoard(id, { arrangement });

export async function deleteBoard(id: string) {
  for (const pl of placementsOf(id)) await db.remove('placements', pl.id);
  await db.remove('boards', id);
  set({ boards: state.boards.filter((b) => b.id !== id), placements: state.placements.filter((p) => p.boardId !== id) });
}

/* ── Prototypes and placements ─────────────────────────────────────────── */
/** Where the next prototype goes on a board: to the right of everything there. */
function nextSlot(boardId: string, pending: Placement[] = []) {
  const frames = [...framesOf(boardId), ...pending.flatMap((p) => state.frames.filter((f) => f.id === p.frameId).map((f) => ({ ...f, x: p.x, y: p.y })))];
  if (!frames.length) return { x: 0, y: 0 };
  return { x: Math.max(...frames.map((f) => f.x + f.w)) + 120, y: Math.min(...frames.map((f) => f.y)) };
}

export async function placeOnBoard(boardId: string, frameId: string, at?: { x: number; y: number }) {
  if (state.placements.some((p) => p.boardId === boardId && p.frameId === frameId)) return;
  const pos = at ?? nextSlot(boardId);
  const pl: Placement = { id: uid(), boardId, frameId, x: Math.round(pos.x), y: Math.round(pos.y) };
  await db.put('placements', pl);
  set({ placements: [...state.placements, pl] });
  await touchBoard(boardId);
}
export async function movePlacement(id: string, x: number, y: number, persist = true) {
  const pl = state.placements.find((p) => p.id === id);
  if (!pl) return;
  const next = { ...pl, x, y };
  set({ placements: state.placements.map((p) => (p.id === id ? next : p)) });
  if (persist) await db.put('placements', next);
}
export async function removeFromBoard(placementId: string) {
  await db.remove('placements', placementId);
  set({ placements: state.placements.filter((p) => p.id !== placementId) });
}

async function insertFrame(frame: Frame, boardId?: string, at?: { x: number; y: number }) {
  await db.put('frames', frame);
  set({ frames: [...state.frames, frame] });
  if (boardId) await placeOnBoard(boardId, frame.id, at);
  await touchProject(frame.projectId);
}

export async function addPrepared(
  projectId: string, p: Prepared,
  opts: { boardId?: string; at?: { x: number; y: number }; size?: { w: number; h: number }; stack?: boolean; meta?: FrameMeta; liveUrl?: string; autoTag?: boolean } = {}
) {
  const id = uid();
  // A drop is tagged from its entry page and its source, unless the caller already gave tags.
  const meta = opts.autoTag && p.html !== undefined && opts.meta?.tags === undefined
    ? { ...opts.meta, tags: dropTags(p.html, p.handle ? 'folder' : 'files', projectTagsOf(projectId)) }
    : opts.meta;
  await db.replaceFiles(id, p.files);
  let handleId: string | undefined;
  if (p.handle) {
    handleId = uid();
    await db.put('handles', { id: handleId, handle: p.handle });
  }
  const size = opts.size ?? { w: 1280, h: 800 };
  const frame: Frame = {
    id, projectId, name: p.name, kind: p.handle ? 'linked' : 'files', entry: p.entry, fileCount: p.files.length,
    pages: p.pages ?? [p.entry], links: p.links ?? [], handleId, x: 0, y: 0, w: size.w, h: size.h, rev: 0,
    createdAt: now(), updatedAt: now(), ...meta, ...(opts.liveUrl ? { liveUrl: opts.liveUrl } : {}),
  };
  await insertFrame(frame, opts.boardId, opts.at);
  if (opts.stack !== false) await autoStack(frame);
  return frame;
}

/** The files of a build an agent sent, as a prototype made from code: stored like a dropped folder, with its live address kept beside them. */
export interface BuildOpts {
  boardId?: string; name?: string; size?: { w: number; h: number }; meta?: FrameMeta; liveUrl?: string;
  /** The name when neither the agent nor the page's title gives one. */
  fallbackName: string;
  /** The page to open, when the build holds one page of a site rather than an index.html at its top. */
  entry?: string;
}
export async function addBuild(projectId: string, files: { path: string; bytes: Uint8Array }[], opts: BuildOpts) {
  const prepared = await prepare({ name: opts.name || opts.fallbackName, files: files.map((f) => ({ path: f.path, blob: new Blob([f.bytes]) })) }, opts.entry);
  if (!prepared) throw new Error('The build has no HTML file, so there is nothing to show.');
  if (opts.name) prepared.name = opts.name;
  return addPrepared(projectId, prepared, { boardId: opts.boardId, size: opts.size, stack: false, meta: opts.meta, liveUrl: opts.liveUrl });
}

/**
 * Add a build as the next version of a prototype's stack, the way a URL
 * version is added: it takes the stack's name, size and metadata, becomes
 * current, and board spots showing the previous current version move to it.
 * Older versions and their files stay. The live address carries forward; a
 * prototype that was only a link keeps that link as its live address.
 */
export async function addBuildVersion(frameId: string, files: { path: string; bytes: Uint8Array }[], liveUrl?: string, entry?: string): Promise<{ frame: Frame; added: boolean }> {
  if (!state.frames.some((f) => f.id === frameId)) throw new Error('That prototype is not in the library.');
  const current = currentOf(stackOf(frameId));
  const frame = await addBuild(current.projectId, files, {
    name: current.name, fallbackName: current.name, size: { w: current.w, h: current.h }, meta: inheritedMeta(current), entry,
    liveUrl: liveUrl ?? current.liveUrl ?? (current.kind === 'url' ? current.url : undefined),
  });
  const spots = swapsFor(state.placements, current.id);
  await joinStack(frame.id, current.id);
  for (const pl of spots) await swapOnBoard(pl.id, frame.id);
  return { frame: state.frames.find((f) => f.id === frame.id) ?? frame, added: true };
}

const projectTagsOf = (projectId: string) => state.frames.filter((f) => f.projectId === projectId).flatMap((f) => f.tags ?? []);

async function makeUrlFrame(
  projectId: string, url: string,
  opts: { boardId?: string; at?: { x: number; y: number }; name?: string; size?: { w: number; h: number }; stack?: boolean; meta?: FrameMeta },
  sourceTag: boolean,
) {
  const meta: FrameMeta = { ...opts.meta };
  if (sourceTag && meta.tags === undefined) {
    // A link added by hand gets its source as a tag.
    const { tags } = mergeTags({ auto: [hostTag(url)], projectTags: projectTagsOf(projectId) });
    if (tags.length) meta.tags = tags;
  }
  const frame: Frame = {
    id: uid(), projectId, name: opts.name || nameFromUrl(url), kind: 'url', url, x: 0, y: 0,
    w: opts.size?.w ?? 1280, h: opts.size?.h ?? 800, rev: 0, createdAt: now(), updatedAt: now(), ...meta,
  };
  await insertFrame(frame, opts.boardId, opts.at);
  if (opts.stack !== false) await autoStack(frame);
  return frame;
}

export async function addUrl(
  projectId: string, url: string,
  opts: { boardId?: string; at?: { x: number; y: number }; name?: string; size?: { w: number; h: number }; stack?: boolean; meta?: FrameMeta } = {}
) {
  return makeUrlFrame(projectId, url, opts, true);
}

function sameUrl(a: string, b: string) {
  try { return new URL(a).href === new URL(b).href; } catch { return a === b; }
}

/**
 * Add a URL as the next version of a prototype's stack. It takes the stack's
 * current name and size, becomes current, and every board spot showing the
 * previous current version moves to it. Spots showing an older version stay.
 * The same address as the current version adds nothing, unless force is set.
 */
export async function addUrlVersion(frameId: string, url: string, opts: { force?: boolean } = {}): Promise<{ frame: Frame; added: boolean }> {
  const base = state.frames.find((f) => f.id === frameId);
  if (!base) throw new Error('That prototype is not in the library.');
  const current = currentOf(stackOf(frameId));
  if (!opts.force && current.kind === 'url' && current.url && sameUrl(current.url, url)) return { frame: current, added: false };
  const frame = await makeUrlFrame(current.projectId, url, { name: current.name, size: { w: current.w, h: current.h }, stack: false, meta: inheritedMeta(current) }, false);
  const spots = swapsFor(state.placements, current.id);
  await joinStack(frame.id, current.id);
  for (const pl of spots) await swapOnBoard(pl.id, frame.id);
  return { frame: state.frames.find((f) => f.id === frame.id) ?? frame, added: true };
}

/** Move a prototype's spot to another board. A board in another project moves the whole prototype to that project, onto that board. */
export async function moveToBoard(placementId: string, boardId: string) {
  const pl = state.placements.find((p) => p.id === placementId);
  if (!pl || pl.boardId === boardId) return;
  const from = state.boards.find((b) => b.id === pl.boardId);
  const to = state.boards.find((b) => b.id === boardId);
  if (!from || !to) return;
  if (from.projectId !== to.projectId) {
    await moveToProject([pl.frameId], { id: to.projectId }, { boardId: to.id });
    return;
  }
  const key = (() => {
    const f = state.frames.find((x) => x.id === pl.frameId);
    return f ? stackKey(f) : pl.frameId;
  })();
  const shows = placementsOf(boardId).some((p) => {
    const f = state.frames.find((x) => x.id === p.frameId);
    return f && stackKey(f) === key;
  });
  if (!shows) await placeOnBoard(boardId, pl.frameId, nextSlot(boardId));
  await removeFromBoard(placementId);
  await touchBoard(from.id);
  if (shows) await touchBoard(to.id);
}

/* ── Moving prototypes between projects ────────────────────────────────── */
/** Everything a move changed, so it can be put back exactly. */
interface MoveRecord {
  frames: { id: string; projectId: string }[];
  notes: { id: string; boardId: string }[];
  removed: Placement[];
  added: string[];
  boards: Board[];
  projects: Project[];
  created: string | null;
}
export interface MoveResult {
  /** The project the prototypes are in now. */
  project: Project;
  /** How many prototypes moved. Prototypes already in that project are left alone. */
  moved: number;
  undo(): Promise<void>;
}

/**
 * Move whole prototypes, every version of each, to another project. Nothing is
 * copied: the versions keep their ids, files, note, star, tags, comments and
 * cover, and only the project they belong to changes. They leave every board
 * of the old project and land on the target project's first board, if it has
 * one, in the next free spot. Comments written on a prototype follow it and
 * point at the landing board; comments on a board's own canvas stay with that
 * board.
 *
 * Writes go new side first: the new spots, then the prototypes' project, then
 * the old spots, so an interrupted move leaves a prototype in a project, never
 * in none. `target` is an existing project, or `{ name }` for a new one made in
 * the same step. `boardId` picks the board to land on instead of the first.
 */
export async function moveToProject(
  frameIds: string[], target: { id: string } | { name: string }, opts: { boardId?: string; quiet?: boolean; message?: string } = {},
): Promise<MoveResult | null> {
  const seen = new Set<string>();
  const stacksToMove: Frame[][] = [];
  for (const id of frameIds) {
    const f = state.frames.find((x) => x.id === id);
    if (!f || seen.has(stackKey(f))) continue;
    seen.add(stackKey(f));
    stacksToMove.push(stackOf(id));
  }
  if (!stacksToMove.length) return null;
  let created: string | null = null;
  let targetId: string;
  if ('id' in target) {
    if (!state.projects.some((p) => p.id === target.id)) throw new Error('That project is not in the library.');
    targetId = target.id;
  } else {
    const name = target.name.trim();
    if (!name) throw new Error('Give the new project a name.');
    targetId = (await createProject(name)).id;
    created = targetId;
  }
  const todo = stacksToMove.filter((st) => st.some((f) => f.projectId !== targetId));
  if (!todo.length) return null;

  const landing = (opts.boardId ? state.boards.find((b) => b.id === opts.boardId && b.projectId === targetId) : undefined) ?? boardsOf(targetId)[0];
  const memberIds = new Set(todo.flatMap((st) => st.map((f) => f.id)));
  const oldProjects = new Set(todo.flatMap((st) => st.map((f) => f.projectId)));
  const oldBoards = state.boards.filter((b) => oldProjects.has(b.projectId));
  const record: MoveRecord = {
    frames: todo.flatMap((st) => st.map((f) => ({ id: f.id, projectId: f.projectId }))),
    notes: [],
    removed: state.placements.filter((p) => memberIds.has(p.frameId) && oldBoards.some((b) => b.id === p.boardId)),
    added: [],
    boards: [],
    projects: state.projects.filter((p) => p.id === targetId || oldProjects.has(p.id)).map((p) => ({ ...p })),
    created,
  };
  record.boards = [...oldBoards.filter((b) => record.removed.some((p) => p.boardId === b.id)), ...(landing ? [landing] : [])].map((b) => ({ ...b }));

  // 1. The new spots, one per prototype, each after the last.
  if (landing) {
    const adds: Placement[] = [];
    for (const st of todo) {
      if (state.placements.some((p) => st.some((f) => f.id === p.frameId) && state.boards.some((b) => b.id === p.boardId && b.projectId === targetId))) continue;
      const spot = nextSlot(landing.id, adds);
      adds.push({ id: uid(), boardId: landing.id, frameId: currentOf(st).id, x: Math.round(spot.x), y: Math.round(spot.y) });
    }
    await db.putMany('placements', adds);
    record.added = adds.map((p) => p.id);
    set({ placements: [...state.placements, ...adds] });
  }
  // 2. The prototypes, and the comments written on them.
  const movedFrames = state.frames.filter((f) => memberIds.has(f.id)).map((f) => ({ ...f, projectId: targetId }));
  await db.putMany('frames', movedFrames);
  set({ frames: state.frames.map((f) => movedFrames.find((m) => m.id === f.id) ?? f) });
  const targetBoards = new Set(state.boards.filter((b) => b.projectId === targetId).map((b) => b.id));
  const movedNotes = state.notes.filter((n) => n.frameId && memberIds.has(n.frameId) && !targetBoards.has(n.boardId)).map((n) => ({ ...n, boardId: landing?.id ?? '' }));
  if (movedNotes.length) {
    record.notes = state.notes.filter((n) => movedNotes.some((m) => m.id === n.id)).map((n) => ({ id: n.id, boardId: n.boardId }));
    await db.putMany('notes', movedNotes);
    set({ notes: state.notes.map((n) => movedNotes.find((m) => m.id === n.id) ?? n) });
  }
  // 3. The old spots.
  for (const pl of record.removed) await db.remove('placements', pl.id);
  set({ placements: state.placements.filter((p) => !record.removed.some((r) => r.id === p.id)) });
  // 4. Both sides count as just used.
  const stamp = now();
  const boards = record.boards.map((b) => ({ ...state.boards.find((x) => x.id === b.id)!, updatedAt: stamp }));
  if (boards.length) {
    await db.putMany('boards', boards);
    set({ boards: state.boards.map((b) => boards.find((x) => x.id === b.id) ?? b) });
  }
  const projects = record.projects.map((p) => ({ ...state.projects.find((x) => x.id === p.id)!, updatedAt: stamp }));
  await db.putMany('projects', projects);
  set({ projects: state.projects.map((p) => projects.find((x) => x.id === p.id) ?? p) });

  const project = state.projects.find((p) => p.id === targetId)!;
  const result: MoveResult = { project, moved: todo.length, undo: () => undoMove(record) };
  if (!opts.quiet) toast(opts.message ?? `Moved to ${project.name}.`, { label: 'Undo', run: () => { void result.undo(); } });
  return result;
}

/** Put a move back: the old spots and project first, then take away what the move added. */
async function undoMove(r: MoveRecord) {
  dismissToast();
  const back = r.removed.filter((p) => state.frames.some((f) => f.id === p.frameId) && state.boards.some((b) => b.id === p.boardId));
  await db.putMany('placements', back);
  set({ placements: [...state.placements.filter((p) => !back.some((b) => b.id === p.id)), ...back] });
  const frames = r.frames.flatMap((o) => { const f = state.frames.find((x) => x.id === o.id); return f ? [{ ...f, projectId: o.projectId }] : []; });
  await db.putMany('frames', frames);
  set({ frames: state.frames.map((f) => frames.find((m) => m.id === f.id) ?? f) });
  const notes = r.notes.flatMap((o) => { const n = state.notes.find((x) => x.id === o.id); return n ? [{ ...n, boardId: o.boardId }] : []; });
  if (notes.length) {
    await db.putMany('notes', notes);
    set({ notes: state.notes.map((n) => notes.find((m) => m.id === n.id) ?? n) });
  }
  for (const id of r.added) await db.remove('placements', id);
  set({ placements: state.placements.filter((p) => !r.added.includes(p.id)) });
  const boards = r.boards.filter((b) => state.boards.some((x) => x.id === b.id));
  if (boards.length) {
    await db.putMany('boards', boards);
    set({ boards: state.boards.map((b) => boards.find((x) => x.id === b.id) ?? b) });
  }
  const projects = r.projects.filter((p) => state.projects.some((x) => x.id === p.id));
  await db.putMany('projects', projects);
  set({ projects: state.projects.map((p) => projects.find((x) => x.id === p.id) ?? p) });
  if (r.created) {
    await db.remove('projects', r.created);
    set({ projects: state.projects.filter((p) => p.id !== r.created) });
  }
}

/* ── Other tabs ────────────────────────────────────────────────────────── */
let staleTimer: ReturnType<typeof setTimeout> | undefined;
let reloading: Promise<void> | null = null;
let watching = false;

/**
 * Re-read the database for a change another tab made, without ever applying a
 * snapshot that raced a local write: wait for local writes to settle, read,
 * and read again if any started or finished meanwhile.
 */
async function reloadFromRemote() {
  for (;;) {
    await db.whenIdle();
    const before = db.writeState().seq;
    const [projects, boards, frames, placements, notes] = await Promise.all([
      db.getAll<Project>('projects'), db.getAll<Board>('boards'), db.getAll<Frame>('frames'),
      db.getAll<Placement>('placements'), db.getAll<Note>('notes'),
    ]);
    if (db.writeState().seq !== before) continue;
    set({ projects, boards, frames, placements, notes, ready: true });
    return;
  }
}
function startReload() {
  staleTimer = undefined;
  // A failed reload must not cancel the one queued behind it.
  const run = (reloading ?? Promise.resolve()).catch(() => {}).then(reloadFromRemote);
  const mine = run.finally(() => { if (reloading === mine) reloading = null; });
  reloading = mine;
  return mine;
}
/** Reload from the database shortly after another tab writes to it. */
export function watchOtherTabs() {
  if (watching) return;
  const ch = db.appChannel();
  if (!ch) return;
  watching = true;
  ch.onmessage = () => {
    clearTimeout(staleTimer);
    staleTimer = setTimeout(() => { void startReload().catch(() => {}); }, 150);
  };
}
/** Finish any pending or in-flight reload now, so a caller about to act sees what other tabs wrote. */
export async function refreshIfStale() {
  if (staleTimer !== undefined) {
    clearTimeout(staleTimer);
    await startReload();
  } else if (reloading) {
    await reloading;
  }
}

/* ── Versions ──────────────────────────────────────────────────────────── */
export const stackOf = (frameId: string) => {
  const f = state.frames.find((x) => x.id === frameId);
  if (!f) return [];
  const key = stackKey(f);
  return state.frames.filter((x) => stackKey(x) === key).sort((a, b) => a.createdAt - b.createdAt);
};

/** Put a prototype into another's stack. By default it becomes the current version. */
export async function joinStack(frameId: string, targetId: string, makeItCurrent = true) {
  const target = state.frames.find((f) => f.id === targetId);
  const frame = state.frames.find((f) => f.id === frameId);
  if (!target || !frame || frameId === targetId) return;
  const key = stackKey(target);
  if (!target.stackId) await updateFrame(target.id, { stackId: key }, true, false);
  await updateFrame(frame.id, { stackId: key }, true, false);
  if (makeItCurrent) await makeCurrent(frame.id);
}

export async function makeCurrent(frameId: string) {
  for (const f of stackOf(frameId)) {
    const want = f.id === frameId;
    if (!!f.current !== want) await updateFrame(f.id, { current: want }, true, false);
  }
}

/** Take a prototype out of its stack; it stands alone again. */
export async function unstack(frameId: string) {
  const f = state.frames.find((x) => x.id === frameId);
  if (!f) return;
  await updateFrame(frameId, { stackId: undefined, current: undefined }, true, false);
  toast(`${f.name} stands on its own now.`);
}

/** Show a different version in the same spot on a board. */
export async function swapOnBoard(placementId: string, frameId: string) {
  const pl = state.placements.find((p) => p.id === placementId);
  if (!pl) return;
  const next = { ...pl, frameId };
  set({ placements: state.placements.map((p) => (p.id === placementId ? next : p)) });
  await db.put('placements', next);
}

/** A new prototype that looks like a version of one already here joins its stack. */
async function autoStack(frame: Frame) {
  const peers = state.frames.filter((f) => f.projectId === frame.projectId);
  const match = stackFor(peers, frame);
  if (!match) return;
  // The prototype's star, note, tags and archive flag carry onto the version that now shows.
  const kept = inheritedMeta(currentOf(stackOf(match.id)));
  await joinStack(frame.id, match.id);
  if (Object.keys(kept).length) await updateFrame(frame.id, kept, true, false);
  const stack = stackOf(frame.id);
  const first = stack[0];
  toast(`Stacked as version ${versionOf(stack, frame.id)} of ${first.name}. Unstack it from its panel if it is something else.`);
}

export async function updateFrame(id: string, patch: Partial<Frame>, persist = true, touch = true) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame) return;
  const next = { ...frame, ...patch, updatedAt: touch ? now() : frame.updatedAt };
  set({ frames: state.frames.map((f) => (f.id === id ? next : f)) });
  if (persist) await db.put('frames', next);
}

/** Applies metadata to every version of a prototype, so the stack always agrees. */
export async function updateMeta(frameId: string, patch: FrameMeta, touch = true) {
  for (const f of stackOf(frameId)) await updateFrame(f.id, patch, true, touch);
}

const metaNow = (frameId: string): FrameMeta => {
  const st = stackOf(frameId);
  return st.length ? metaOf(currentOf(st)) : {};
};
const projectOf = (frameId: string) => state.frames.find((f) => f.id === frameId)?.projectId ?? '';

export const setStarred = (id: string, starred: boolean) => updateMeta(id, { starred }, false);
export const setNote = (id: string, note: string) => updateMeta(id, { note }, false);
export const setArchived = (id: string, archived: boolean) => updateMeta(id, { archived }, false);

/** The person adds a tag to a prototype. It reuses a near tag the project already has. */
export async function tagPrototype(id: string, tag: string) {
  const meta = metaNow(id);
  const next = addTag(meta, tag, projectTagsOf(projectOf(id)));
  await updateMeta(id, { tags: next.tags, ...(next.removedTags.length || meta.removedTags ? { removedTags: next.removedTags } : {}) });
}

/** The person removes a tag. It is remembered so automatic tagging does not bring it back. */
export async function untagPrototype(id: string, tag: string) {
  const next = removeTag(metaNow(id), tag);
  await updateMeta(id, { tags: next.tags, removedTags: next.removedTags });
}

/** Deletes a prototype from the library, every board, and its notes. */
export async function deleteFrame(id: string) {
  const noteIds = allNotesOf(id).map((n) => n.id);
  for (const pl of state.placements.filter((p) => p.frameId === id)) await db.remove('placements', pl.id);
  await db.removeFrameDeep(id, noteIds);
  set({
    frames: state.frames.filter((f) => f.id !== id),
    notes: state.notes.filter((n) => n.frameId !== id),
    placements: state.placements.filter((p) => p.frameId !== id),
  });
}

/** Re-read a linked folder from disk. The browser asks for permission again when it needs to. */
export async function refreshLinked(id: string) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame?.handleId) return;
  const rec = await db.get<{ id: string; handle: FileSystemDirectoryHandle }>('handles', frame.handleId);
  if (!rec) return toast('Canon lost track of that folder. Use Relocate to find it again.');
  // @ts-expect-error: Chromium only
  const perm = await rec.handle.requestPermission?.({ mode: 'read' });
  if (perm && perm !== 'granted') return toast('Canon needs read access to refresh that folder.');
  let files;
  try {
    files = await walkHandle(rec.handle);
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return toast('That folder moved or was renamed. Use Relocate to find it.');
    throw err;
  }
  await takeFolder(frame, rec.handle, files, `Refreshed from disk`);
}

async function takeFolder(frame: Frame, handle: FileSystemDirectoryHandle, files: Awaited<ReturnType<typeof walkHandle>>, said: string) {
  const prepared = await prepare({ name: frame.name, files });
  if (!prepared) return toast('That folder has no HTML file in it.');
  const handleId = frame.handleId ?? uid();
  await db.put('handles', { id: handleId, handle });
  // Keep a screenshot the person added; the rest is the folder's.
  const cover = frame.cover ? (await db.filesOf(frame.id)).find((f) => f.key === `${frame.id}/${frame.cover}`) : undefined;
  await db.replaceFiles(frame.id, [...prepared.files, ...(cover ? [{ path: frame.cover!, blob: cover.blob, type: cover.type }] : [])]);
  await updateFrame(frame.id, {
    kind: 'linked', handleId, rev: frame.rev + 1, fileCount: prepared.files.length,
    entry: prepared.entry, pages: prepared.pages, links: prepared.links,
  });
  toast(`${said}: ${prepared.files.length} files.`);
}

/**
 * Point a prototype at its folder again after it was moved or renamed, or link
 * a dropped-in prototype to its folder so it can refresh. Notes and board
 * spots stay; only the files are re-read.
 */
export async function relocate(id: string) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame || frame.kind === 'url') return;
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'canon-relocate', mode: 'read' });
  } catch {
    return; // Cancelled.
  }
  await takeFolder(frame, handle, await walkHandle(handle), frame.kind === 'linked' ? `Relocated to “${handle.name}”` : `Linked to “${handle.name}”`);
}

/* ── Links that need a screenshot ──────────────────────────────────────── */
export async function setCover(id: string, file: File) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame) return;
  if (!file.type.startsWith('image/')) return toast('That is not an image. Use a PNG, JPG or WebP screenshot.');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const name = `cover.${ext}`;
  if (frame.cover && frame.cover !== name) await db.remove('files', `${id}/${frame.cover}`);
  await db.put('files', { key: `${id}/${name}`, frameId: id, blob: file, type: file.type });
  await updateFrame(id, { cover: name, display: 'cover', rev: frame.rev + 1 });
}
export const setDisplay = (id: string, display: 'live' | 'cover') => updateFrame(id, { display });

/* ── Comments and notes ────────────────────────────────────────────────── */
async function putNote(note: Note) {
  await db.put('notes', note);
  set({ notes: state.notes.some((n) => n.id === note.id) ? state.notes.map((n) => (n.id === note.id ? note : n)) : [...state.notes, note] });
}
export async function addNote(n: Omit<Note, 'id' | 'createdAt'>) {
  const note: Note = { ...n, id: uid(), createdAt: now() };
  await putNote(note);
  if (n.boardId) await touchBoard(n.boardId);
  return note;
}
export async function reply(noteId: string, body: string) {
  const note = state.notes.find((n) => n.id === noteId);
  if (!note || !body.trim()) return;
  const r: Reply = { id: uid(), author: myName() || 'You', body: body.trim(), createdAt: now() };
  await putNote({ ...note, replies: [...(note.replies ?? []), r] });
}
export async function setResolved(noteId: string, resolved: boolean) {
  const note = state.notes.find((n) => n.id === noteId);
  if (note) await putNote({ ...note, resolved });
}
export async function deleteNote(id: string) {
  await db.remove('notes', id);
  set({ notes: state.notes.filter((n) => n.id !== id) });
}

/* ── The sample project ────────────────────────────────────────────────── */
export async function createSampleProject() {
  const project = await createProject('Fernwell');
  const board = await createBoard(project.id, 'Explorations');
  let x = 0;
  const made: Frame[] = [];
  for (const s of SAMPLES) {
    const p: Prepared = { name: s.name, entry: 'index.html', files: [{ path: 'index.html', blob: new Blob([s.html], { type: 'text/html' }), type: 'text/html' }] };
    made.push(await addPrepared(project.id, p, { boardId: board.id, at: { x, y: 0 }, size: { w: s.w, h: s.h } }));
    x += s.w + 120;
  }
  const site = await prepare({
    name: SAMPLE_SITE.name,
    files: Object.entries(SAMPLE_SITE.files).map(([path, html]) => ({ path, blob: new Blob([html], { type: 'text/html' }) })),
  });
  if (site) {
    const f = await addPrepared(project.id, site, { boardId: board.id, at: { x: 0, y: 1000 } });
    const review = await createBoard(project.id, 'Site review');
    await placeOnBoard(review.id, f.id, { x: 0, y: 0 });
    await placeOnBoard(review.id, made[3].id, { x: 1400, y: 0 });
  }
  const lane = made[2];
  await addNote({ boardId: board.id, frameId: lane.id, page: lane.entry, kind: 'comment', author: myName() || 'You', fx: 0.5, py: 356, said: 'Held and booked look the same. Try a dashed outline for held.' });
  const c = await addNote({ boardId: board.id, frameId: made[0].id, page: made[0].entry, kind: 'comment', author: myName() || 'You', fx: 0.5, py: 300, said: 'Should the ring start empty in the morning, or show yesterday?' });
  await setResolved(c.id, false);
  const withReply = state.notes.find((n) => n.id === c.id)!;
  await putNote({ ...withReply, replies: [{ id: uid(), author: myName() || 'You', body: 'Empty. Yesterday goes on the streak screen. This one is current.', createdAt: now() }] });
  // Two earlier rounds of the ring, stacked under the one on the board.
  const ring = SAMPLES[0];
  const rounds = [
    { name: 'Today ring v1', html: ring.html.replace('#3f6b4f', '#8a8577').replace('of 60 minutes', 'minutes outside') },
    { name: 'Today ring v2', html: ring.html.replace('stroke-linecap="round"', 'stroke-linecap="butt"') },
  ];
  for (const [i, r] of rounds.entries()) {
    const old = await addPrepared(project.id, { name: r.name, entry: 'index.html', files: [{ path: 'index.html', blob: new Blob([r.html], { type: 'text/html' }), type: 'text/html' }] }, { size: { w: ring.w, h: ring.h }, stack: false });
    await updateFrame(old.id, { createdAt: made[0].createdAt - (rounds.length - i) * 86_400_000 }, true, false);
    await joinStack(old.id, made[0].id, false);
  }
  await makeCurrent(made[0].id);
  // Not on any board yet: shows up in the library under "Not on a board".
  await addPrepared(project.id, {
    name: 'Onboarding, short',
    entry: 'index.html',
    files: [{ path: 'index.html', blob: new Blob([SAMPLES[0].html.replace('Today ring', 'Onboarding, short').replace('<h1>Today</h1>', '<h1>Welcome</h1>')], { type: 'text/html' }), type: 'text/html' }],
  }, { size: { w: 390, h: 844 } });
  return { project, board };
}
