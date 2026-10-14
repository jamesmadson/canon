/**
 * The library as plain data: one canon.json plus the prototype files beside
 * it. The same shape is a backup zip and a Canon folder on disk, so either
 * one can rebuild the app after the browser's storage is cleared.
 */
import type { Board, Frame, Note, Placement, Project } from '../db';

export const LIBRARY_FORMAT = 'canon-library';
export const LIBRARY_VERSION = 1;
export const LIBRARY_FILE = 'canon.json';
export const PROTOTYPES_DIR = 'prototypes';

/** A stored prototype file, without its bytes. key is `${frameId}/${path}`. */
export interface FileMeta { key: string; frameId: string; type: string }

export interface Library {
  format: typeof LIBRARY_FORMAT;
  version: number;
  savedAt: number;
  projects: Project[];
  boards: Board[];
  frames: Frame[];
  placements: Placement[];
  notes: Note[];
  files: FileMeta[];
}

export interface LibraryData {
  projects: Project[];
  boards: Board[];
  frames: Frame[];
  placements: Placement[];
  notes: Note[];
}

export function toLibrary(data: LibraryData, files: FileMeta[], savedAt: number): Library {
  return {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    savedAt,
    projects: data.projects,
    boards: data.boards,
    frames: data.frames,
    placements: data.placements,
    notes: data.notes,
    // Only files whose prototype still exists; a half-deleted frame leaves nothing behind.
    files: files.filter((f) => data.frames.some((fr) => fr.id === f.frameId)),
  };
}

/**
 * A file key split into folder-safe segments, or null when it could climb out
 * of the library folder. Keys are written by Canon, but a backup is a file a
 * person can hand-edit, so it is checked like input.
 */
export function safeSegments(key: string): string[] | null {
  const parts = key.split('/');
  if (parts.length < 2) return null;
  if (parts.some((p) => p === '' || p === '.' || p === '..' || p.includes('\\'))) return null;
  return parts;
}

export const filePath = (key: string) => `${PROTOTYPES_DIR}/${key}`;

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const hasId = (v: unknown) => !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string';

export type Parsed = { ok: true; library: Library } | { ok: false; reason: string };

export function parseLibrary(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not a Canon library: it is not valid JSON.' };
  }
  const lib = raw as Partial<Library>;
  if (!lib || lib.format !== LIBRARY_FORMAT) return { ok: false, reason: 'That file is not a Canon library.' };
  if (typeof lib.version !== 'number' || lib.version > LIBRARY_VERSION) {
    return { ok: false, reason: 'That library was saved by a newer Canon. Update Canon, then try again.' };
  }
  for (const key of ['projects', 'boards', 'frames', 'placements', 'notes'] as const) {
    const list = lib[key];
    if (!isArray(list) || !list.every(hasId)) return { ok: false, reason: `That library is damaged: its ${key} list is unreadable.` };
  }
  const files = isArray(lib.files) ? lib.files : [];
  const cleanFiles = files.filter(
    (f): f is FileMeta =>
      !!f && typeof (f as FileMeta).key === 'string' && typeof (f as FileMeta).frameId === 'string' && safeSegments((f as FileMeta).key) !== null,
  );
  return {
    ok: true,
    library: {
      format: LIBRARY_FORMAT,
      version: lib.version,
      savedAt: typeof lib.savedAt === 'number' ? lib.savedAt : 0,
      projects: lib.projects as Project[],
      boards: lib.boards as Board[],
      frames: lib.frames as Frame[],
      placements: lib.placements as Placement[],
      notes: lib.notes as Note[],
      files: cleanFiles.map((f) => ({ key: f.key, frameId: f.frameId, type: typeof f.type === 'string' ? f.type : '' })),
    },
  };
}

/** What a restore adds or updates, for the confirmation line. */
export function summarize(lib: Library) {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  return `${n(lib.projects.length, 'project')}, ${n(lib.frames.length, 'prototype')}, ${n(lib.notes.length, 'note')}`;
}

/** A dated file name for a backup download. */
export const backupName = (at: Date) => `canon-backup-${at.toISOString().slice(0, 10)}.canon`;
