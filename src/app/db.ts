/**
 * Everything the app keeps, in this browser's IndexedDB. Nothing is uploaded.
 * The service worker opens the same database to serve prototype files.
 */

export const DB_NAME = 'canon-app';
export const DB_VERSION = 3;

export type Arrangement = 'free' | 'tidy';
export type Role = 'view' | 'comment' | 'edit';
/** Legacy: sharing was removed. Only the shape is kept so old stored boards still type-check. */
export interface Share { link: 'off' | Role; invites: { email: string; role: Role }[] }
/** A project holds the prototype library and the boards that arrange it. */
export interface Project { id: string; name: string; createdAt: number; updatedAt: number }
export interface Board { id: string; projectId: string; name: string; createdAt: number; updatedAt: number; arrangement: Arrangement; /** Legacy, no longer read or written. */ share?: Share }
/** Where a prototype sits on one board. A prototype can sit on many boards, or none. */
export interface Placement { id: string; boardId: string; frameId: string; x: number; y: number }
export type FrameKind = 'files' | 'linked' | 'url';
/** A prototype in a project's library. x and y are legacy; placements hold positions now. */
export interface Frame {
  id: string; projectId: string; boardId?: string; name: string; kind: FrameKind;
  entry?: string; url?: string; fileCount?: number; handleId?: string;
  /** Every HTML page in a multi-page prototype, entry first, and the links between them. */
  pages?: string[]; links?: [string, string][];
  /**
   * A link that can't show inside Canon (a work sign-in, a site that refuses
   * framing) can show a screenshot instead. cover is its file name in this
   * prototype's stored files.
   */
  cover?: string; display?: 'live' | 'cover';
  /** Versions of one prototype share a stackId. current marks the one to show; else the newest shows. */
  stackId?: string; current?: boolean;
  x: number; y: number; w: number; h: number; rev: number; createdAt: number; updatedAt: number;
}
/**
 * A note sits on a page of a prototype (frameId, page, fx across, py down in
 * CSS px from the top of the page), or on the open canvas (wx, wy). Older
 * notes carry fy, a fraction of the frame height, instead of py.
 */
export interface Reply { id: string; author: string; body: string; createdAt: number }
export interface Note {
  id: string; boardId: string; frameId?: string; page?: string;
  /** Notes are saved with kind 'comment'. 'note' and meant/participant come from older research-note data and are kept only so it still loads; they display as a plain note. */
  kind?: 'comment' | 'note'; author?: string; replies?: Reply[]; resolved?: boolean;
  fx?: number; fy?: number; py?: number; wx?: number; wy?: number;
  source?: 'canvas' | 'preview';
  said: string; meant?: string; participant?: string; createdAt: number;
}
/** A paired agent. The secret signs its requests and never leaves this store: not in backups, not in the Canon folder. */
export interface Agent { id: string; name: string; secret: string; tabId: string; pairedAt: number }
export interface StoredFile { key: string; frameId: string; blob: Blob; type: string }

export const STORES: Record<string, { keyPath: string; index?: string }> = {
  boards: { keyPath: 'id' },
  frames: { keyPath: 'id', index: 'boardId' },
  notes: { keyPath: 'id', index: 'frameId' },
  files: { keyPath: 'key', index: 'frameId' },
  handles: { keyPath: 'id' },
  projects: { keyPath: 'id' },
  placements: { keyPath: 'id', index: 'boardId' },
  agents: { keyPath: 'id' },
};

/**
 * What an upgrade must do, from the stores that exist. Not from oldVersion:
 * the service worker can create an empty database first, and a canon-mcp dev
 * database is already at version 2 with no projects.
 */
export function upgradePlan(existing: string[]): { create: string[]; migrateToProjects: boolean } {
  const has = new Set(existing);
  return {
    create: Object.keys(STORES).filter((n) => !has.has(n)),
    migrateToProjects: has.has('frames') && !has.has('projects'),
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;
let onStale: () => void = () => {};
/** The app registers what to show when another tab upgrades the database; db does not import store. */
export function onStaleConnection(fn: () => void) { onStale = fn; }
let writeListener: (store: string) => void = () => {};
export function onWrite(fn: (store: string) => void) { writeListener = fn; }

let channel: BroadcastChannel | null = null;
/** One 'canon-app' channel per tab, made when first needed, for posting and receiving. A channel never delivers to its own instance. */
export function appChannel(): BroadcastChannel | null {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('canon-app');
  return channel;
}
/** After a committed write: tell other tabs, and the registered listener. Never throws, so a committed write never rejects. Paired agents stay private. */
/** Local writes in flight, and a counter that moves whenever one starts or ends, so a reader can tell its snapshot raced a write. */
let inflight = 0;
let writeSeq = 0;
let idleWaiters: (() => void)[] = [];
export const writeState = () => ({ inflight, seq: writeSeq });
/** Resolves once no local write is in flight. */
export function whenIdle(): Promise<void> {
  return inflight ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve();
}
function tracked<T>(run: () => Promise<T>): Promise<T> {
  inflight++; writeSeq++;
  return run().finally(() => {
    inflight--; writeSeq++;
    if (!inflight) { const w = idleWaiters; idleWaiters = []; w.forEach((r) => r()); }
  });
}
function wrote(store: string) {
  if (store === 'agents') return;
  try { appChannel()?.postMessage('changed'); } catch { /* no channel: other tabs refresh on focus */ }
  try { writeListener(store); } catch { /* a listener must not undo a committed write */ }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction!;
      const plan = upgradePlan(Array.from(db.objectStoreNames));
      for (const name of plan.create) {
        const { keyPath, index } = STORES[name];
        const store = db.createObjectStore(name, { keyPath });
        if (index) store.createIndex(index, index);
      }
      if (plan.migrateToProjects) migrateToProjects(tx);
    };
    req.onblocked = () => {
      console.warn('Canon: another tab is holding the old database open.');
      const root = typeof document !== 'undefined' ? document.getElementById('app') : null;
      if (root && !root.hasChildNodes()) root.textContent = 'Close other Canon tabs to finish updating.';
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        onStale();
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/**
 * Version 1 kept prototypes on boards. Version 2 gathers everything into one
 * project, gives each prototype a library entry, and keeps its old spot as a
 * placement on the board it lived on. Nothing is dropped.
 */
function migrateToProjects(tx: IDBTransaction) {
  const projectId = 'local';
  const stamp = Date.now();
  tx.objectStore('projects').put({ id: projectId, name: 'My prototypes', createdAt: stamp, updatedAt: stamp });
  const boards = tx.objectStore('boards');
  boards.openCursor().onsuccess = (e) => {
    const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (!cursor) return;
    cursor.update({ ...cursor.value, projectId });
    cursor.continue();
  };
  const frames = tx.objectStore('frames');
  const placements = tx.objectStore('placements');
  frames.openCursor().onsuccess = (e) => {
    const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (!cursor) return;
    const f = cursor.value;
    cursor.update({ ...f, projectId });
    if (f.boardId) placements.put({ id: `m-${f.id}`, boardId: f.boardId, frameId: f.id, x: f.x ?? 0, y: f.y ?? 0 });
    cursor.continue();
  };
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function get<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export const put = (store: string, value: unknown) => tracked(() => putRaw(store, value));
async function putRaw(store: string, value: unknown) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
  wrote(store);
}

export const remove = (store: string, key: string) => tracked(() => removeRaw(store, key));
async function removeRaw(store: string, key: string) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
  wrote(store);
}

/** Replace every file a frame owns in one transaction. */
export const replaceFiles = (frameId: string, files: { path: string; blob: Blob; type: string }[]) => tracked(() => replaceFilesRaw(frameId, files));
async function replaceFilesRaw(frameId: string, files: { path: string; blob: Blob; type: string }[]) {
  const db = await openDb();
  const tx = db.transaction('files', 'readwrite');
  const store = tx.objectStore('files');
  const range = IDBKeyRange.only(frameId);
  const cursorReq = store.index('frameId').openKeyCursor(range);
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (cursor) {
      store.delete(cursor.primaryKey);
      cursor.continue();
    } else {
      for (const f of files) store.put({ key: `${frameId}/${f.path}`, frameId, blob: f.blob, type: f.type });
    }
  };
  await done(tx);
  wrote('files');
}

export async function removeFrameDeep(frameId: string, noteIds: string[]) {
  await replaceFiles(frameId, []);
  for (const id of noteIds) await remove('notes', id);
  await remove('frames', frameId);
}

/** Write many records into one store in a single transaction. */
export const putMany = (store: string, values: unknown[]) => tracked(() => putManyRaw(store, values));
async function putManyRaw(store: string, values: unknown[]) {
  if (!values.length) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
  wrote(store);
}

/** Every stored file one prototype owns. */
export async function filesOf(frameId: string): Promise<StoredFile[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('files').objectStore('files').index('frameId').getAll(IDBKeyRange.only(frameId));
    req.onsuccess = () => resolve(req.result as StoredFile[]);
    req.onerror = () => reject(req.error);
  });
}
