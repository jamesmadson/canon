import { zipSync, strToU8 } from 'fflate';
import * as db from './db';
import type { Board, Frame, Note, Placement, Project, Reply, Share } from './db';
import type { Prepared } from './intake';
import { walkHandle, prepare } from './intake';
import { entryFileName, noteToEntry } from './lib/strata';
import type { LibraryItem } from './lib/library';
import { SAMPLES, SAMPLE_SITE } from './samples';

export interface State {
  projects: Project[];
  boards: Board[];
  frames: Frame[];
  placements: Placement[];
  notes: Note[];
  ready: boolean;
  toast: string | null;
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
const today = () => new Date().toISOString().slice(0, 10);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string) {
  set({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 3200);
}

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
    createdAt: f.createdAt, updatedAt: f.updatedAt, frame: f,
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
export const setShare = (id: string, share: Share) => patchBoard(id, { share });

export async function deleteBoard(id: string) {
  for (const pl of placementsOf(id)) await db.remove('placements', pl.id);
  await db.remove('boards', id);
  set({ boards: state.boards.filter((b) => b.id !== id), placements: state.placements.filter((p) => p.boardId !== id) });
}

/* ── Prototypes and placements ─────────────────────────────────────────── */
/** Where the next prototype goes on a board: to the right of everything there. */
function nextSlot(boardId: string) {
  const frames = framesOf(boardId);
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
  projectId: string, p: Prepared, opts: { boardId?: string; at?: { x: number; y: number }; size?: { w: number; h: number } } = {}
) {
  const id = uid();
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
    createdAt: now(), updatedAt: now(),
  };
  await insertFrame(frame, opts.boardId, opts.at);
  return frame;
}

export async function addUrl(projectId: string, url: string, opts: { boardId?: string; at?: { x: number; y: number } } = {}) {
  const frame: Frame = {
    id: uid(), projectId, name: new URL(url).host || url, kind: 'url', url, x: 0, y: 0, w: 1280, h: 800,
    rev: 0, createdAt: now(), updatedAt: now(),
  };
  await insertFrame(frame, opts.boardId, opts.at);
  return frame;
}

export async function updateFrame(id: string, patch: Partial<Frame>, persist = true) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame) return;
  const next = { ...frame, ...patch, updatedAt: now() };
  set({ frames: state.frames.map((f) => (f.id === id ? next : f)) });
  if (persist) await db.put('frames', next);
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

/** Research notes as .strata entries, zipped, for the repo. Team comments stay out of the record. */
export function exportStrata(notes: Note[]) {
  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const n of notes.filter((x) => x.kind !== 'comment')) {
    const frame = state.frames.find((f) => f.id === n.frameId);
    const board = state.boards.find((b) => b.id === n.boardId);
    const page = frame && n.page && n.page !== frame.entry ? ` ${n.page.replace(/\.html?$/i, '')}` : '';
    const about = frame ? `${frame.name}${page}` : (board?.name ?? 'board');
    const date = new Date(n.createdAt).toISOString().slice(0, 10);
    const key = `${date}-${about}`;
    const name = entryFileName(date, about, counts[key] ?? 0);
    counts[key] = (counts[key] ?? 0) + 1;
    files[`.strata/${name}`] = strToU8(noteToEntry(n, { date, about }));
  }
  if (!Object.keys(files).length) return toast('No research notes to export. Comments are discussion, so they stay out of the record.');
  const blob = new Blob([zipSync(files)], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `canon-strata-${today()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  // Not on any board yet: shows up in the library under "Not on a board".
  await addPrepared(project.id, {
    name: 'Onboarding, short',
    entry: 'index.html',
    files: [{ path: 'index.html', blob: new Blob([SAMPLES[0].html.replace('Today ring', 'Onboarding, short').replace('<h1>Today</h1>', '<h1>Welcome</h1>')], { type: 'text/html' }), type: 'text/html' }],
  }, { size: { w: 390, h: 844 } });
  return { project, board };
}
