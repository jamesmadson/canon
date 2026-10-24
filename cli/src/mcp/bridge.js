/**
 * The loopback bridge between `canon mcp` and the open Canon tab.
 *
 * The tab long-polls POST /poll with its replies; the bridge answers with the
 * commands queued for it. Only a paired tab gets through: every poll carries
 * an HMAC over the pairing secret, and every answer is signed back with role
 * 'mcp' and the poll's nonce, so the tab can tell the answer is genuine.
 *
 * Order on /poll matters: parse, check the agent, verify the MAC, and only
 * then record the nonce (the replay guard stores nonces, so an unverified
 * client must never reach it), then claim the pairing for the tab.
 */

import http from 'node:http';
import { sign, verify, newNonce, createReplayGuard } from './auth.js';
import { readPairings, claimPairing } from './pairing.js';

const DEFAULT_PORTS = [47800, 47801, 47802, 47803, 47804, 47805, 47806, 47807, 47808, 47809];
const PROD_ORIGINS = ['https://jamesmadson.github.io'];
const DEV_ORIGINS = ['http://localhost:4321', 'http://127.0.0.1:4321'];
const TAB_ID = /^[0-9a-f]{16,64}$/;
const MAX_BODY = 64 * 1024;
const MAX_ARGS = 64 * 1024;

export function startBridge({
  agentId,
  name,
  pairingFile,
  dev = false,
  ports = DEFAULT_PORTS,
  holdMs = 25_000, // longest a poll is held waiting for a command
  graceMs = 2_000, // connected() stays true this long after a poll ends; keep it under connectWaitMs so the one check at connectWaitMs sees a gone tab
  connectWaitMs = 2_500, // send() gives up this soon when no tab is connected
} = {}) {
  const origins = new Set(dev ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS);
  const replay = createReplayGuard();
  const queue = []; // commands not yet handed to the tab
  const pending = new Map(); // id -> { resolve, timers }
  const held = new Map(); // tabId -> { res, nonce, secret, timer }
  let lastEnded = -Infinity;
  let port = null;
  let closed = false;

  const connected = () => held.size > 0 || Date.now() - lastEnded < graceMs;

  function settle(id, reply) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    for (const t of p.timers) clearTimeout(t);
    const i = queue.findIndex((c) => c.id === id);
    if (i !== -1) queue.splice(i, 1);
    p.resolve(reply);
  }

  function cors(origin) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }

  function json(res, origin, status, body) {
    res.writeHead(status, {
      ...cors(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  }

  /** Answer a held (or fresh) poll with these commands, signed for the tab. */
  function answer(res, origin, { nonce, secret }, commands) {
    if (res.writableEnded || res.destroyed) return false;
    const ts = Date.now();
    const payload = JSON.stringify({ commands });
    const mac = sign({ secret, role: 'mcp', agentId, ts, nonce, payload });
    json(res, origin, 200, { ts, nonce, mac, payload });
    return true;
  }

  function release(tabId, commands) {
    const h = held.get(tabId);
    if (!h) return false;
    held.delete(tabId);
    clearTimeout(h.timer);
    lastEnded = Date.now();
    return answer(h.res, h.origin, h, commands);
  }

  /** Hand every queued command to a held poll, if there is one. */
  function flush() {
    if (queue.length === 0) return;
    for (const tabId of held.keys()) {
      const commands = queue.slice();
      if (release(tabId, commands)) {
        queue.length = 0;
        return;
      }
    }
  }

  function readBody(req) {
    return new Promise((resolve) => {
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_BODY) {
        req.resume();
        resolve({ tooLarge: true });
        return;
      }
      const chunks = [];
      let size = 0;
      let over = false;
      req.on('data', (c) => {
        if (over) return;
        size += c.length;
        if (size > MAX_BODY) {
          over = true;
          chunks.length = 0;
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(over ? { tooLarge: true } : { text: Buffer.concat(chunks).toString('utf8') }));
      req.on('error', () => resolve({ error: true }));
    });
  }

  async function handlePoll(req, res, origin) {
    const unauthorized = () => json(res, origin, 401);
    const body = await readBody(req);
    if (body.error) return res.destroy();
    if (body.tooLarge) {
      res.setHeader('Connection', 'close');
      return json(res, origin, 413);
    }
    let msg;
    try {
      msg = JSON.parse(body.text);
    } catch {
      return json(res, origin, 400);
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return json(res, origin, 400);

    const { tabId, ts, nonce, mac, payload } = msg;
    if (msg.agentId !== agentId) return unauthorized();
    if (typeof tabId !== 'string' || !TAB_ID.test(tabId)) return unauthorized();
    if (!Number.isInteger(ts)) return unauthorized();
    // Re-read per request: another process may have rotated the pairing.
    const entry = readPairings(pairingFile).agents[agentId];
    if (!entry) return unauthorized();
    const secret = entry.secret;
    if (!verify({ secret, role: 'tab', agentId, ts, nonce, payload, mac })) return unauthorized();
    if (!replay.accept(ts, nonce)) return unauthorized();
    if (!claimPairing(pairingFile, agentId, tabId)) return unauthorized();

    let replies;
    try {
      replies = JSON.parse(payload).replies;
    } catch {
      return json(res, origin, 400);
    }
    if (replies !== undefined && !Array.isArray(replies)) return json(res, origin, 400);
    for (const r of replies ?? []) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string') continue;
      if (r.ok === true) settle(r.id, { ok: true, result: r.result });
      else settle(r.id, { ok: false, error: typeof r.error === 'string' ? r.error : 'error' });
    }

    // A newer poll from the same tab supersedes the one it was holding.
    release(tabId, []);
    if (closed) return answer(res, origin, { nonce, secret }, []);

    if (queue.length > 0) {
      const commands = queue.splice(0, queue.length);
      lastEnded = Date.now();
      answer(res, origin, { nonce, secret }, commands);
      return;
    }
    const h = { res, origin, nonce, secret, timer: null };
    h.timer = setTimeout(() => {
      if (held.get(tabId) === h) release(tabId, []);
    }, holdMs);
    held.set(tabId, h);
    res.on('close', () => {
      if (held.get(tabId) === h) {
        held.delete(tabId);
        clearTimeout(h.timer);
        lastEnded = Date.now();
      }
    });
  }

  function handle(req, res) {
    const origin = req.headers.origin;
    const host = String(req.headers.host ?? '').toLowerCase();
    const hostOk = host === `127.0.0.1:${port}` || host === `localhost:${port}`;
    if (!hostOk || typeof origin !== 'string' || !origins.has(origin)) {
      res.writeHead(403);
      res.end();
      req.resume();
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors(origin),
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Private-Network': 'true',
      });
      res.end();
      req.resume();
      return;
    }
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/who') {
      req.resume();
      return json(res, origin, 200, { agentId, name });
    }
    if (req.method === 'POST' && path === '/poll') {
      handlePoll(req, res, origin).catch(() => {
        if (!res.headersSent) json(res, origin, 500);
        else res.destroy();
      });
      return;
    }
    req.resume();
    json(res, origin, 404);
  }

  function send(op, args, { timeoutMs = 10_000 } = {}) {
    return new Promise((resolve) => {
      if (closed) return resolve({ ok: false, error: 'closed' });
      let size;
      try {
        size = JSON.stringify(args ?? {}).length;
      } catch {
        return resolve({ ok: false, error: 'Arguments are not JSON.' });
      }
      if (size > MAX_ARGS) return resolve({ ok: false, error: 'Arguments are too large.' });

      const id = newNonce();
      const timers = [setTimeout(() => settle(id, { ok: false, error: 'timeout' }), timeoutMs)];
      // Give a tab that is just opening (or between polls) a moment to take
      // the command; if it is still undelivered and no tab is there, say so.
      const check = () => {
        if (!queue.some((c) => c.id === id)) return;
        if (!connected()) settle(id, { ok: false, error: 'not-connected' });
        else timers.push(setTimeout(check, connectWaitMs));
      };
      timers.push(setTimeout(check, connectWaitMs));
      pending.set(id, { resolve, timers });
      queue.push({ id, op, args: args ?? {} });
      flush();
    });
  }

  const server = http.createServer(handle);

  function listenOn(i) {
    return new Promise((resolve, reject) => {
      if (i >= ports.length) {
        reject(new Error(`No free port from ${ports[0]} to ${ports[ports.length - 1]}.`));
        return;
      }
      const onError = (err) => {
        server.off('listening', onListening);
        if (err.code === 'EADDRINUSE') resolve(listenOn(i + 1));
        else reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(ports[i]);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(ports[i], '127.0.0.1');
    });
  }

  async function close() {
    if (closed) return;
    closed = true;
    for (const tabId of [...held.keys()]) release(tabId, []);
    for (const id of [...pending.keys()]) settle(id, { ok: false, error: 'closed' });
    await new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  return listenOn(0).then((p) => {
    port = p;
    return { port, send, connected, close };
  });
}
