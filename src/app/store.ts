import { zipSync, strToU8 } from 'fflate';
import * as db from './db';
import type { Board, Frame, Note } from './db';
import type { Prepared } from './intake';
import { walkHandle, prepare } from './intake';
import { entryFileName, noteToEntry } from './lib/strata';
import { SAMPLES } from './samples';

export interface State {
  boards: Board[];
  frames: Frame[];
  notes: Note[];
  ready: boolean;
  toast: string | null;
}

let state: State = { boards: [], frames: [], notes: [], ready: false, toast: null };
const listeners = new Set<() => void>();

export const getState = () => state;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
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

export async function load() {
  const [boards, frames, notes] = await Promise.all([
    db.getAll<Board>('boards'),
    db.getAll<Frame>('frames'),
    db.getAll<Note>('notes'),
  ]);
  set({ boards, frames, notes, ready: true });
}

export const framesOf = (boardId: string) =>
  state.frames.filter((f) => f.boardId === boardId).sort((a, b) => a.createdAt - b.createdAt);
export const notesOf = (frameId: string) =>
  state.notes.filter((n) => n.frameId === frameId).sort((a, b) => a.createdAt - b.createdAt);

async function touchBoard(boardId: string) {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return;
  const next = { ...board, updatedAt: now() };
  await db.put('boards', next);
  set({ boards: state.boards.map((b) => (b.id === boardId ? next : b)) });
}

export async function createBoard(name = 'Untitled board'): Promise<Board> {
  const board: Board = { id: uid(), name, createdAt: now(), updatedAt: now(), arrangement: 'free' };
  await db.put('boards', board);
  set({ boards: [...state.boards, board] });
  return board;
}

export async function renameBoard(id: string, name: string) {
  const board = state.boards.find((b) => b.id === id);
  if (!board || !name.trim()) return;
  const next = { ...board, name: name.trim(), updatedAt: now() };
  await db.put('boards', next);
  set({ boards: state.boards.map((b) => (b.id === id ? next : b)) });
}

export async function setArrangement(id: string, arrangement: Board['arrangement']) {
  const board = state.boards.find((b) => b.id === id);
  if (!board) return;
  const next = { ...board, arrangement };
  await db.put('boards', next);
  set({ boards: state.boards.map((b) => (b.id === id ? next : b)) });
}

export async function deleteBoard(id: string) {
  for (const f of framesOf(id)) await deleteFrame(f.id);
  await db.remove('boards', id);
  set({ boards: state.boards.filter((b) => b.id !== id) });
}

/** Where the next frame goes: to the right of everything already there. */
function nextSlot(boardId: string, at?: { x: number; y: number }) {
  if (at) return at;
  const frames = framesOf(boardId);
  if (!frames.length) return { x: 0, y: 0 };
  const right = Math.max(...frames.map((f) => f.x + f.w));
  const top = Math.min(...frames.map((f) => f.y));
  return { x: right + 120, y: top };
}

async function insertFrame(frame: Frame) {
  await db.put('frames', frame);
  set({ frames: [...state.frames, frame] });
  await touchBoard(frame.boardId);
}

export async function addPrepared(boardId: string, p: Prepared, at?: { x: number; y: number }, size = { w: 1280, h: 800 }) {
  const id = uid();
  await db.replaceFiles(id, p.files);
  let handleId: string | undefined;
  if (p.handle) {
    handleId = uid();
    await db.put('handles', { id: handleId, handle: p.handle });
  }
  const pos = nextSlot(boardId, at);
  const frame: Frame = {
    id, boardId, name: p.name, kind: p.handle ? 'linked' : 'files', entry: p.entry, fileCount: p.files.length,
    handleId, x: pos.x, y: pos.y, w: size.w, h: size.h, rev: 0, createdAt: now(), updatedAt: now(),
  };
  await insertFrame(frame);
  return frame;
}

export async function addUrl(boardId: string, url: string, at?: { x: number; y: number }) {
  const pos = nextSlot(boardId, at);
  const frame: Frame = {
    id: uid(), boardId, name: new URL(url).host || url, kind: 'url', url, x: pos.x, y: pos.y, w: 1280, h: 800,
    rev: 0, createdAt: now(), updatedAt: now(),
  };
  await insertFrame(frame);
  return frame;
}

export async function updateFrame(id: string, patch: Partial<Frame>, persist = true) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame) return;
  const next = { ...frame, ...patch, updatedAt: now() };
  set({ frames: state.frames.map((f) => (f.id === id ? next : f)) });
  if (persist) await db.put('frames', next);
}

export async function deleteFrame(id: string) {
  const noteIds = notesOf(id).map((n) => n.id);
  await db.removeFrameDeep(id, noteIds);
  set({ frames: state.frames.filter((f) => f.id !== id), notes: state.notes.filter((n) => n.frameId !== id) });
}

/** Re-read a linked folder from disk. The browser asks for permission again when it needs to. */
export async function refreshLinked(id: string) {
  const frame = state.frames.find((f) => f.id === id);
  if (!frame?.handleId) return;
  const rec = await db.get<{ id: string; handle: FileSystemDirectoryHandle }>('handles', frame.handleId);
  if (!rec) return toast('The link to that folder is gone. Link it again.');
  // @ts-expect-error: Chromium only
  const perm = await rec.handle.requestPermission?.({ mode: 'read' });
  if (perm && perm !== 'granted') return toast('Canon needs read access to refresh that folder.');
  const prepared = await prepare({ name: frame.name, files: await walkHandle(rec.handle) });
  if (!prepared) return toast('That folder has no HTML file any more.');
  await db.replaceFiles(id, prepared.files);
  await updateFrame(id, { rev: frame.rev + 1, fileCount: prepared.files.length, entry: prepared.entry });
  toast(`Refreshed from disk: ${prepared.files.length} files.`);
}

export async function addNote(n: Omit<Note, 'id' | 'createdAt'>) {
  const note: Note = { ...n, id: uid(), createdAt: now() };
  await db.put('notes', note);
  set({ notes: [...state.notes, note] });
  await touchBoard(n.boardId);
  return note;
}

export async function deleteNote(id: string) {
  await db.remove('notes', id);
  set({ notes: state.notes.filter((n) => n.id !== id) });
}

/** Every note as a .strata entry, zipped, for the repo. */
export function exportStrata(notes: Note[]) {
  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const n of notes) {
    const frame = state.frames.find((f) => f.id === n.frameId);
    const about = frame?.name ?? 'prototype';
    const date = new Date(n.createdAt).toISOString().slice(0, 10);
    const key = `${date}-${about}`;
    const name = entryFileName(date, about, counts[key] ?? 0);
    counts[key] = (counts[key] ?? 0) + 1;
    files[`.strata/${name}`] = strToU8(noteToEntry(n, { date, about }));
  }
  const blob = new Blob([zipSync(files)], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `canon-strata-${today()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function createSampleBoard() {
  const board = await createBoard('Fernwell, sample');
  let x = 0;
  for (const s of SAMPLES) {
    const p: Prepared = { name: s.name, entry: 'index.html', files: [{ path: 'index.html', blob: new Blob([s.html], { type: 'text/html' }), type: 'text/html' }] };
    await addPrepared(board.id, p, { x, y: 0 }, { w: s.w, h: s.h });
    x += s.w + 120;
  }
  const first = framesOf(board.id)[2];
  if (first) {
    await addNote({ boardId: board.id, frameId: first.id, fx: 0.5, fy: 0.42, said: 'I couldn’t tell if the lane was booked or just held for me.', meant: 'Held and booked read as the same state.', participant: 'P-04' });
  }
  return board;
}
