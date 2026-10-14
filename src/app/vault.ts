/**
 * Keeping the library safe beyond this browser.
 *
 * The browser's storage is fast but fragile: clearing site data wipes it, and
 * Safari can drop a site's storage after a week away. So Canon keeps a second,
 * durable copy as plain files:
 *
 *   - A Canon folder (Chrome, Edge, Arc): canon.json plus every prototype's
 *     files, rewritten a moment after each change. Point a fresh Canon at the
 *     folder and everything comes back.
 *   - A backup file (every browser): the same thing zipped into one .canon
 *     file, made and restored by hand.
 *
 * Restoring merges by id. It adds and updates; it never deletes what is here.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import * as db from './db';
import type { StoredFile } from './db';
import * as store from './store';
import {
  LIBRARY_FILE,
  PROTOTYPES_DIR,
  backupName,
  filePath,
  parseLibrary,
  safeSegments,
  summarize,
  toLibrary,
  type FileMeta,
  type Library,
  type LibraryData,
  type Parsed,
} from './lib/backup';

const VAULT_ID = 'canon-folder';
const STAMP_FILE = '.canon-rev';
const SAVE_DELAY = 1200;
const README = `This folder is a Canon library.

canon.json holds your projects, boards, prototypes and notes.
prototypes/ holds a copy of every prototype's files.

If Canon's browser storage is ever cleared, open Canon and choose
"Open a Canon folder", then pick this folder. Everything comes back.

Canon rewrites these files as you work. Back the folder up like any other.
`;

type Dir = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const dataOf = (s: LibraryData): LibraryData => ({
  projects: s.projects,
  boards: s.boards,
  frames: s.frames,
  placements: s.placements,
  notes: s.notes,
});
const metaOf = (f: StoredFile): FileMeta => ({ key: f.key, frameId: f.frameId, type: f.type });
const pathInFrame = (key: string) => key.slice(key.indexOf('/') + 1);

/* ── Asking the browser to keep our storage ────────────────────────────── */

/**
 * Without this, Chromium may evict the library under storage pressure. It is
 * granted quietly for installed apps and sites people use; Firefox may ask.
 */
export async function askPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/* ── Restoring, from either source ─────────────────────────────────────── */

async function apply(lib: Library, read: (key: string) => Promise<Uint8Array | undefined>) {
  await db.putMany('projects', lib.projects);
  await db.putMany('boards', lib.boards);
  await db.putMany('frames', lib.frames);
  await db.putMany('placements', lib.placements);
  await db.putMany('notes', lib.notes);
  const byFrame = new Map<string, FileMeta[]>();
  for (const f of lib.files) byFrame.set(f.frameId, [...(byFrame.get(f.frameId) ?? []), f]);
  let missing = 0;
  for (const [frameId, metas] of byFrame) {
    const files: { path: string; blob: Blob; type: string }[] = [];
    for (const m of metas) {
      const bytes = await read(m.key);
      if (!bytes) {
        missing++;
        continue;
      }
      files.push({ path: pathInFrame(m.key), blob: new Blob([bytes as BlobPart], { type: m.type }), type: m.type });
    }
    if (files.length) await db.replaceFiles(frameId, files);
  }
  await store.load();
  return missing;
}

export async function restoreFromFile(file: File) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return store.toast('That file is not a Canon backup.');
  }
  const json = entries[LIBRARY_FILE];
  if (!json) return store.toast('That file is not a Canon backup: there is no canon.json inside.');
  const parsed = parseLibrary(strFromU8(json));
  if (!parsed.ok) return store.toast(parsed.reason);
  const missing = await apply(parsed.library, async (key) => entries[filePath(key)]);
  store.toast(`Restored ${summarize(parsed.library)}.${missing ? ` ${missing} files were missing from the backup.` : ''}`);
  schedule();
}

/* ── The backup file ───────────────────────────────────────────────────── */

export async function downloadBackup() {
  const s = store.getState();
  const stored = await db.getAll<StoredFile>('files');
  const library = toLibrary(dataOf(s), stored.map(metaOf), Date.now());
  const keep = new Set(library.files.map((f) => f.key));
  const zip: Zippable = { [LIBRARY_FILE]: strToU8(JSON.stringify(library, null, 2)), 'README.txt': strToU8(README) };
  for (const f of stored) {
    // Prototype files are mostly already compressed or small; storing them is faster.
    if (keep.has(f.key)) zip[filePath(f.key)] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  }
  const url = URL.createObjectURL(new Blob([zipSync(zip) as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupName(new Date());
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  store.toast(`Backed up ${summarize(library)}.`);
}

/* ── The Canon folder ──────────────────────────────────────────────────── */

let dir: Dir | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;
let seen: LibraryData | null = null;

async function readText(parent: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    return await (await (await parent.getFileHandle(name)).getFile()).text();
  } catch {
    return null;
  }
}

async function writeFile(parent: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const handle = await parent.getFileHandle(name, { create: true });
  const out = await handle.createWritable();
  await out.write(data);
  await out.close();
}

async function readFromFolder(root: FileSystemDirectoryHandle, key: string): Promise<Uint8Array | undefined> {
  const segs = safeSegments(key);
  if (!segs) return undefined;
  try {
    let at = await root.getDirectoryHandle(PROTOTYPES_DIR);
    for (const seg of segs.slice(0, -1)) at = await at.getDirectoryHandle(seg);
    const file = await (await at.getFileHandle(segs[segs.length - 1])).getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function readFolderLibrary(root: FileSystemDirectoryHandle): Promise<Parsed | null> {
  const text = await readText(root, LIBRARY_FILE);
  return text === null ? null : parseLibrary(text);
}

const connected = (patch: { savedAt?: number | null; saving?: boolean; error?: string } = {}) => {
  if (!dir) return;
  const prev = store.getState().vault;
  store.setVault({
    status: 'connected',
    name: dir.name,
    savedAt: patch.savedAt !== undefined ? patch.savedAt : prev.status === 'connected' ? prev.savedAt : null,
    saving: patch.saving ?? false,
    error: patch.error,
  });
};

async function sync() {
  if (!dir) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  connected({ saving: true });
  try {
    const s = store.getState();
    const protos = await dir.getDirectoryHandle(PROTOTYPES_DIR, { create: true });
    const metas: FileMeta[] = [];
    const keep = new Set<string>();
    for (const frame of s.frames) {
      const files = await db.filesOf(frame.id);
      if (!files.length) continue;
      keep.add(frame.id);
      metas.push(...files.map(metaOf));
      const stamp = `${frame.rev}:${files.length}`;
      const existing = await protos.getDirectoryHandle(frame.id).catch(() => null);
      if (existing && (await readText(existing, STAMP_FILE)) === stamp) continue;
      // Changed or new: rewrite the whole prototype so removed files do not linger.
      if (existing) await protos.removeEntry(frame.id, { recursive: true });
      for (const file of files) {
        const segs = safeSegments(file.key);
        if (!segs) continue;
        let at = protos;
        for (const seg of segs.slice(0, -1)) at = await at.getDirectoryHandle(seg, { create: true });
        await writeFile(at, segs[segs.length - 1], file.blob);
      }
      await writeFile(await protos.getDirectoryHandle(frame.id), STAMP_FILE, stamp);
    }
    for await (const entry of protos.values()) {
      if (!keep.has(entry.name)) await protos.removeEntry(entry.name, { recursive: true });
    }
    // The index goes last, so it never points at files that are not there yet.
    await writeFile(dir, LIBRARY_FILE, JSON.stringify(toLibrary(dataOf(s), metas, Date.now()), null, 2));
    if ((await readText(dir, 'README.txt')) === null) await writeFile(dir, 'README.txt', README);
    connected({ savedAt: Date.now(), saving: false });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      store.setVault({ status: 'needs-permission', name: dir.name });
      dir = null;
    } else {
      connected({ saving: false, error: 'Could not save to the folder. Your work is still in this browser.' });
    }
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule();
    }
  }
}

function schedule() {
  if (!dir) return;
  clearTimeout(timer);
  timer = setTimeout(sync, SAVE_DELAY);
}

function onChange() {
  const s = store.getState();
  const changed =
    !seen ||
    seen.projects !== s.projects ||
    seen.boards !== s.boards ||
    seen.frames !== s.frames ||
    seen.placements !== s.placements ||
    seen.notes !== s.notes;
  if (!changed) return;
  seen = dataOf(s);
  schedule();
}

/** On boot: find the folder from last time and pick up saving if the browser still allows it. */
export async function initVault() {
  store.subscribe(onChange);
  if (!folderSupported()) return store.setVault({ status: 'unsupported' });
  const rec = await db.get<{ id: string; handle: Dir }>('handles', VAULT_ID).catch(() => undefined);
  if (!rec) return store.setVault({ status: 'none' });
  const perm = await rec.handle.queryPermission?.({ mode: 'readwrite' }).catch(() => undefined);
  if (perm === 'granted') {
    dir = rec.handle;
    connected();
    schedule();
  } else {
    store.setVault({ status: 'needs-permission', name: rec.handle.name });
  }
}

/**
 * Pick a folder to keep the library in. If it already holds a Canon library,
 * that library is brought in first, so choosing a folder never overwrites it.
 */
export async function chooseFolder() {
  let handle: Dir;
  try {
    handle = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker({
      id: 'canon-library',
      mode: 'readwrite',
    });
  } catch {
    return; // Cancelled.
  }
  const existing = await readFolderLibrary(handle);
  if (existing && !existing.ok) {
    return store.toast(`${existing.reason} Choose an empty folder, or one Canon saved to.`);
  }
  if (existing?.ok) {
    const missing = await apply(existing.library, (key) => readFromFolder(handle, key));
    store.toast(`Opened “${handle.name}”: ${summarize(existing.library)}.${missing ? ` ${missing} files were missing.` : ''}`);
  } else {
    store.toast(`Saving to “${handle.name}” from now on.`);
  }
  await db.put('handles', { id: VAULT_ID, handle });
  dir = handle;
  seen = null;
  connected();
  await sync();
}

/** The browser forgets folder permission between visits; one click restores it. */
export async function reconnect() {
  const rec = await db.get<{ id: string; handle: Dir }>('handles', VAULT_ID);
  if (!rec) return store.setVault({ status: 'none' });
  const perm = await rec.handle.requestPermission?.({ mode: 'readwrite' }).catch(() => undefined);
  if (perm !== 'granted') return store.toast('Canon needs permission to save to that folder.');
  dir = rec.handle;
  connected();
  await sync();
}

/** Stop saving to the folder. The folder and its files stay where they are. */
export async function forgetFolder() {
  await db.remove('handles', VAULT_ID);
  dir = null;
  clearTimeout(timer);
  store.setVault({ status: 'none' });
  store.toast('Stopped saving to the folder. Its files are still on your disk.');
}
