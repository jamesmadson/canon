/**
 * Everything the app keeps, in this browser's IndexedDB. Nothing is uploaded.
 * The service worker opens the same database to serve prototype files.
 */

export const DB_NAME = 'canon-app';
export const DB_VERSION = 1;

export type Arrangement = 'free' | 'tidy';
export interface Board { id: string; name: string; createdAt: number; updatedAt: number; arrangement: Arrangement }
export type FrameKind = 'files' | 'linked' | 'url';
export interface Frame {
  id: string; boardId: string; name: string; kind: FrameKind;
  entry?: string; url?: string; fileCount?: number; handleId?: string;
  x: number; y: number; w: number; h: number; rev: number; createdAt: number; updatedAt: number;
}
export interface Note {
  id: string; boardId: string; frameId: string; fx: number; fy: number;
  said: string; meant?: string; participant?: string; createdAt: number;
}
export interface StoredFile { key: string; frameId: string; blob: Blob; type: string }

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('boards', { keyPath: 'id' });
      db.createObjectStore('frames', { keyPath: 'id' }).createIndex('boardId', 'boardId');
      db.createObjectStore('notes', { keyPath: 'id' }).createIndex('frameId', 'frameId');
      db.createObjectStore('files', { keyPath: 'key' }).createIndex('frameId', 'frameId');
      db.createObjectStore('handles', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
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
