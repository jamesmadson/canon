/**
 * Everything the app keeps, in this browser's IndexedDB. Nothing is uploaded.
 * The service worker opens the same database to serve prototype files.
 */

export const DB_NAME = 'canon-app';
export const DB_VERSION = 2;

export type Arrangement = 'free' | 'tidy';
export type Role = 'view' | 'comment' | 'edit';
/** Sharing is a concept here: settings are kept, but links only open in this browser until Canon is hosted. */
export interface Share { link: 'off' | Role; invites: { email: string; role: Role }[] }
/** A project holds the prototype library and the boards that arrange it. */
export interface Project { id: string; name: string; createdAt: number; updatedAt: number }
export interface Board { id: string; projectId: string; name: string; createdAt: number; updatedAt: number; arrangement: Arrangement; share?: Share }
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
  /** A comment is team discussion, Figma style. A note is research: Said, Meant, a P code. */
  kind?: 'comment' | 'note'; author?: string; replies?: Reply[]; resolved?: boolean;
  fx?: number; fy?: number; py?: number; wx?: number; wy?: number;
  source?: 'canvas' | 'preview';
  said: string; meant?: string; participant?: string; createdAt: number;
}
export interface StoredFile { key: string; frameId: string; blob: Blob; type: string }

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction!;
      // Created if missing rather than by version: the service worker can open
      // the database first, which makes an empty version 1 with no stores.
      const had = (name: string) => db.objectStoreNames.contains(name);
      const hadFrames = had('frames');
      if (!had('boards')) db.createObjectStore('boards', { keyPath: 'id' });
      if (!hadFrames) db.createObjectStore('frames', { keyPath: 'id' }).createIndex('boardId', 'boardId');
      if (!had('notes')) db.createObjectStore('notes', { keyPath: 'id' }).createIndex('frameId', 'frameId');
      if (!had('files')) db.createObjectStore('files', { keyPath: 'key' }).createIndex('frameId', 'frameId');
      if (!had('handles')) db.createObjectStore('handles', { keyPath: 'id' });
      if (!had('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!had('placements')) db.createObjectStore('placements', { keyPath: 'id' }).createIndex('boardId', 'boardId');
      if (hadFrames && event.oldVersion < 2) migrateToProjects(tx);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
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

export async function put(store: string, value: unknown) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
}

export async function remove(store: string, key: string) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

/** Replace every file a frame owns in one transaction. */
export async function replaceFiles(frameId: string, files: { path: string; blob: Blob; type: string }[]) {
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
}

export async function removeFrameDeep(frameId: string, noteIds: string[]) {
  await replaceFiles(frameId, []);
  for (const id of noteIds) await remove('notes', id);
  await remove('frames', frameId);
}

/** Write many records into one store in a single transaction. */
export async function putMany(store: string, values: unknown[]) {
  if (!values.length) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
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
