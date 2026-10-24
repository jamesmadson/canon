/*
 * Canon app service worker. Serves dropped prototypes straight out of this
 * browser's IndexedDB, so a zipped prototype's relative CSS, JS and images
 * resolve as if it were on a server. Nothing is fetched from anywhere else.
 *
 * Path shape: <scope>p/<frameId>/<path inside the prototype>
 */
const DB_NAME = 'canon-app';
// The installed app's own files, kept so it opens without a connection.
const SHELL = 'canon-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([new URL('./', self.registration.scope).pathname])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('canon-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Network first, so updates land straight away; the cache only answers offline. */
async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    return hit || Response.error();
  }
}

// One shared connection, dropped when another tab upgrades the database so
// the upgrade is never blocked by this worker.
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

/** Top-level tabs get the comment layer; frames inside the app never do. */
async function withComments(blob, frameId, path) {
  const text = await blob.text();
  const src = new URL('../app-comments.js', self.registration.scope).pathname;
  const tag = `<script src="${src}" data-frame="${frameId}" data-page="${path.replace(/"/g, '&quot;')}" defer></script>`;
  return /<\/body>/i.test(text) ? text.replace(/<\/body>/i, `${tag}</body>`) : text + tag;
}

async function serve(frameId, path, request) {
  const db = await openDb();
  const record = await new Promise((resolve) => {
    if (!db.objectStoreNames.contains('files')) return resolve(undefined);
    try {
      const req = db.transaction('files').objectStore('files').get(`${frameId}/${path}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
  if (!record) {
    return new Response(`Not in this prototype: ${path}`, { status: 404, headers: { 'content-type': 'text/plain' } });
  }
  const headers = { 'content-type': record.type, 'cache-control': 'no-store' };
  if (record.type === 'text/html' && request.destination === 'document') {
    return new Response(await withComments(record.blob, frameId, path), { headers });
  }
  return new Response(record.blob, { headers });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const prefix = new URL('p/', self.registration.scope).pathname;
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (!url.pathname.startsWith(prefix)) {
    // The app itself and the files it loads: pages in scope, built assets, fonts, icons.
    const base = new URL('../', self.registration.scope).pathname;
    const appFile = url.pathname.startsWith(self.registration.scope.replace(self.location.origin, ''))
      || ['_astro/', 'fonts/', 'icons/', 'app.webmanifest', 'app-comments.js'].some((p) => url.pathname.startsWith(base + p));
    if (appFile) event.respondWith(networkFirst(event.request));
    return;
  }
  const rest = url.pathname.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return;
  const frameId = rest.slice(0, slash);
  let path = decodeURIComponent(rest.slice(slash + 1));
  if (path === '' || path.endsWith('/')) path += 'index.html';
  event.respondWith(serve(frameId, path, event.request));
});
