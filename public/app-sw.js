/*
 * Canon app service worker. Serves dropped prototypes straight out of this
 * browser's IndexedDB, so a zipped prototype's relative CSS, JS and images
 * resolve as if it were on a server. Nothing is fetched from anywhere else.
 *
 * Path shape: <scope>p/<frameId>/<path inside the prototype>
 */
const DB_NAME = 'canon-app';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
    const req = db.transaction('files').objectStore('files').get(`${frameId}/${path}`);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
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
  if (url.origin !== self.location.origin || !url.pathname.startsWith(prefix)) return;
  const rest = url.pathname.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return;
  const frameId = rest.slice(0, slash);
  let path = decodeURIComponent(rest.slice(slash + 1));
  if (path === '' || path.endsWith('/')) path += 'index.html';
  event.respondWith(serve(frameId, path, event.request));
});
