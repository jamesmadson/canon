import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sign, verify, newNonce } from '../src/mcp/auth.js';
import { ensurePairing } from '../src/mcp/pairing.js';
import { startBridge } from '../src/mcp/bridge.js';

// Our own range, so a real `canon mcp` on 47800–47809 never clashes.
const PORTS = [47900, 47901, 47902, 47903, 47904, 47905, 47906, 47907, 47908, 47909];
const ORIGIN = 'https://jamesmadson.github.io';
const AGENT = 'claude-code';
const TAB = 'a'.repeat(32);
const OTHER_TAB = 'b'.repeat(32);

const open = [];
afterEach(async () => {
  while (open.length) await open.pop().close();
});

async function bridge(opts = {}) {
  const pairingFile = join(mkdtempSync(join(tmpdir(), 'canon-bridge-')), 'mcp.json');
  const { secret } = ensurePairing(pairingFile, AGENT, 'Claude Code');
  const b = await startBridge({
    agentId: AGENT,
    name: 'Claude Code',
    pairingFile,
    ports: PORTS,
    holdMs: 100,
    ...opts,
  });
  open.push(b);
  return { b, secret, pairingFile };
}

function request(port, { method = 'GET', path = '/who', origin = ORIGIN, host, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host ?? `127.0.0.1:${port}` };
    if (origin) headers.Origin = origin;
    let data;
    if (body !== undefined) {
      data = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ host: '127.0.0.1', port, method, path, headers, agent: false }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

function pollBody(secret, { replies = [], tabId = TAB, agentId = AGENT, ts = Date.now(), nonce = newNonce() } = {}) {
  const payload = JSON.stringify({ replies });
  const mac = sign({ secret, role: 'tab', agentId, ts, nonce, payload });
  return { agentId, tabId, ts, nonce, mac, payload };
}

const poll = (port, body) => request(port, { method: 'POST', path: '/poll', body });

describe('bridge: origin and host', () => {
  it('serves /who to the Canon origin', async () => {
    const { b } = await bridge();
    const r = await request(b.port);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ agentId: AGENT, name: 'Claude Code' });
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('refuses a wrong or missing Origin with an empty 403', async () => {
    const { b } = await bridge();
    const wrong = await request(b.port, { origin: 'https://evil.example' });
    expect(wrong.status).toBe(403);
    expect(wrong.text).toBe('');
    expect(wrong.headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(b.port, { origin: null })).status).toBe(403);
  });

  it('refuses the right Origin with a foreign Host', async () => {
    const { b } = await bridge();
    const r = await request(b.port, { host: 'evil.example' });
    expect(r.status).toBe(403);
    expect(r.text).toBe('');
    expect((await request(b.port, { host: `localhost:${b.port}` })).status).toBe(200);
    expect((await request(b.port, { host: `127.0.0.1:${b.port + 1}` })).status).toBe(403);
  });

  it('answers OPTIONS from an allowed origin with CORS and the PNA header', async () => {
    const { b } = await bridge();
    const r = await request(b.port, { method: 'OPTIONS', path: '/poll' });
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(r.headers['access-control-allow-methods']).toBe('GET, POST');
    expect(r.headers['access-control-allow-headers']).toBe('content-type');
    expect(r.headers['access-control-allow-private-network']).toBe('true');
    expect(r.headers.vary).toBe('Origin');
  });

  it('refuses the dev origins unless dev is on', async () => {
    const { b } = await bridge();
    expect((await request(b.port, { origin: 'http://localhost:4321' })).status).toBe(403);
    expect((await request(b.port, { origin: 'http://127.0.0.1:4321' })).status).toBe(403);
    const { b: dev } = await bridge({ dev: true });
    expect((await request(dev.port, { origin: 'http://localhost:4321' })).status).toBe(200);
    expect((await request(dev.port, { origin: 'http://127.0.0.1:4321' })).status).toBe(200);
    expect((await request(dev.port)).status).toBe(200);
  });
});

describe('bridge: poll authentication', () => {
  it('refuses an unsigned or mis-signed poll', async () => {
    const { b, secret } = await bridge();
    const body = pollBody(secret);
    expect((await poll(b.port, { ...body, mac: undefined })).status).toBe(401);
    expect((await poll(b.port, { ...body, mac: '0'.repeat(64) })).status).toBe(401);
    expect((await poll(b.port, pollBody('1'.repeat(64)))).status).toBe(401);
    expect((await poll(b.port, { ...body, payload: '{"replies":[{"id":"x"}]}' })).status).toBe(401);
    // A signed poll still goes through afterwards: the bad ones did not burn its nonce.
    expect((await poll(b.port, body)).status).toBe(200);
  });

  it('refuses a poll for another agent', async () => {
    const { b, secret } = await bridge();
    expect((await poll(b.port, pollBody(secret, { agentId: 'other-agent' }))).status).toBe(401);
  });

  it('refuses a replayed nonce', async () => {
    const { b, secret } = await bridge();
    const body = pollBody(secret);
    expect((await poll(b.port, body)).status).toBe(200);
    expect((await poll(b.port, body)).status).toBe(401);
  });

  it('refuses a stale or non-integer timestamp', async () => {
    const { b, secret } = await bridge();
    expect((await poll(b.port, pollBody(secret, { ts: Date.now() - 60_000 }))).status).toBe(401);
    expect((await poll(b.port, pollBody(secret, { ts: Date.now() + 0.5 }))).status).toBe(401);
  });

  it('refuses a malformed tabId', async () => {
    const { b, secret } = await bridge();
    expect((await poll(b.port, pollBody(secret, { tabId: 'not hex' }))).status).toBe(401);
    expect((await poll(b.port, pollBody(secret, { tabId: 'abc' }))).status).toBe(401);
  });

  it('refuses a second tab once the first has claimed the pairing', async () => {
    const { b, secret } = await bridge();
    expect((await poll(b.port, pollBody(secret))).status).toBe(200);
    expect((await poll(b.port, pollBody(secret, { tabId: OTHER_TAB }))).status).toBe(401);
    expect((await poll(b.port, pollBody(secret))).status).toBe(200);
  });

  it('uses the secret in the pairing file now, not the one at start', async () => {
    const { b, secret, pairingFile } = await bridge();
    const { rotatePairing } = await import('../src/mcp/pairing.js');
    const { secret: fresh } = rotatePairing(pairingFile, AGENT, 'Claude Code');
    expect((await poll(b.port, pollBody(secret))).status).toBe(401);
    expect((await poll(b.port, pollBody(fresh))).status).toBe(200);
  });

  it('refuses an oversized body with 413', async () => {
    const { b } = await bridge();
    const r = await poll(b.port, JSON.stringify({ pad: 'x'.repeat(70_000) }));
    expect(r.status).toBe(413);
  });

  it('answers 400 for a body that is not JSON', async () => {
    const { b } = await bridge();
    expect((await poll(b.port, 'nope')).status).toBe(400);
  });
});

describe('bridge: commands and replies', () => {
  it('sends a command to the polling tab and resolves with its reply', async () => {
    const { b, secret } = await bridge({ holdMs: 5_000 });
    const first = pollBody(secret);
    const held = poll(b.port, first);
    await new Promise((r) => setTimeout(r, 50));
    expect(b.connected()).toBe(true);

    const sent = b.send('find', {});
    const res = await held;
    expect(res.status).toBe(200);
    const out = JSON.parse(res.text);
    expect(out.nonce).toBe(first.nonce);
    expect(Number.isInteger(out.ts)).toBe(true);
    expect(verify({ secret, role: 'mcp', agentId: AGENT, ts: out.ts, nonce: first.nonce, payload: out.payload, mac: out.mac })).toBe(true);
    expect(verify({ secret, role: 'tab', agentId: AGENT, ts: out.ts, nonce: first.nonce, payload: out.payload, mac: out.mac })).toBe(false);
    const { commands } = JSON.parse(out.payload);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ op: 'find', args: {} });

    const replying = poll(b.port, pollBody(secret, { replies: [{ id: commands[0].id, ok: true, result: { frames: [] } }] }));
    expect(await sent).toEqual({ ok: true, result: { frames: [] } });
    await b.close();
    expect((await replying).status).toBe(200);
  });

  it('passes a failed reply through', async () => {
    const { b, secret } = await bridge({ holdMs: 5_000 });
    const held = poll(b.port, pollBody(secret));
    await new Promise((r) => setTimeout(r, 50));
    const sent = b.send('add', { url: 'x' });
    const { commands } = JSON.parse(JSON.parse((await held).text).payload);
    poll(b.port, pollBody(secret, { replies: [{ id: commands[0].id, ok: false, error: 'No board.' }] })).catch(() => {});
    expect(await sent).toEqual({ ok: false, error: 'No board.' });
  });

  it('delivers a command queued between polls on the next poll', async () => {
    const { b, secret } = await bridge({ holdMs: 30 });
    expect((await poll(b.port, pollBody(secret))).status).toBe(200);
    expect(b.connected()).toBe(true); // ended under 3 s ago
    const sent = b.send('list', {});
    const res = await poll(b.port, pollBody(secret));
    const { commands } = JSON.parse(JSON.parse(res.text).payload);
    expect(commands.map((c) => c.op)).toEqual(['list']);
    poll(b.port, pollBody(secret, { replies: [{ id: commands[0].id, ok: true, result: 1 }] })).catch(() => {});
    expect(await sent).toEqual({ ok: true, result: 1 });
  });

  it('answers an empty command list when the hold runs out', async () => {
    const { b, secret } = await bridge({ holdMs: 30 });
    const res = await poll(b.port, pollBody(secret));
    expect(JSON.parse(JSON.parse(res.text).payload)).toEqual({ commands: [] });
  });

  it('a newer poll from the same tab answers the older one empty', async () => {
    const { b, secret } = await bridge({ holdMs: 5_000 });
    const older = poll(b.port, pollBody(secret));
    await new Promise((r) => setTimeout(r, 50));
    const newer = poll(b.port, pollBody(secret));
    const res = await older;
    expect(res.status).toBe(200);
    expect(JSON.parse(JSON.parse(res.text).payload)).toEqual({ commands: [] });
    await b.close();
    await newer;
  });

  it('times out when the tab never replies', async () => {
    const { b, secret } = await bridge({ holdMs: 30 });
    await poll(b.port, pollBody(secret));
    expect(await b.send('find', {}, { timeoutMs: 100 })).toEqual({ ok: false, error: 'timeout' });
  });

  it('with no tab, send says not-connected in under 3.5 s', async () => {
    const { b } = await bridge({ holdMs: undefined });
    expect(b.connected()).toBe(false);
    const t0 = Date.now();
    expect(await b.send('find', {})).toEqual({ ok: false, error: 'not-connected' });
    expect(Date.now() - t0).toBeLessThan(3_500);
  }, 10_000);

  it('says not-connected, not timeout, when the tab went away just before', async () => {
    const { b, secret } = await bridge({ holdMs: 20, graceMs: 60, connectWaitMs: 40 });
    await poll(b.port, pollBody(secret));
    expect(b.connected()).toBe(true);
    const t0 = Date.now();
    expect(await b.send('find', {}, { timeoutMs: 5_000 })).toEqual({ ok: false, error: 'not-connected' });
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it('with the default timings, a tab that just went away is reported before 3 s', async () => {
    const { b, secret } = await bridge({ holdMs: 20 });
    await poll(b.port, pollBody(secret));
    await new Promise((r) => setTimeout(r, 60));
    const t0 = Date.now();
    expect(await b.send('find', {}, { timeoutMs: 10_000 })).toEqual({ ok: false, error: 'not-connected' });
    expect(Date.now() - t0).toBeLessThan(3_000);
  }, 10_000);

  it('connected() turns false once polls stop', async () => {
    const { b, secret } = await bridge({ holdMs: 20, graceMs: 60 });
    await poll(b.port, pollBody(secret));
    expect(b.connected()).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    expect(b.connected()).toBe(false);
  });
});

describe('bridge: ports', () => {
  it('two bridges take the next free ports and both serve /who', async () => {
    const { b: one } = await bridge({ ports: [47900, 47901] });
    const { b: two } = await bridge({ ports: [47900, 47901] });
    expect(one.port).toBe(47900);
    expect(two.port).toBe(47901);
    expect((await request(one.port)).status).toBe(200);
    expect((await request(two.port)).status).toBe(200);
  });

  it('rejects when every port is taken', async () => {
    await bridge({ ports: [47900] });
    await expect(bridge({ ports: [47900] })).rejects.toThrow('No free port from 47900 to 47900.');
  });
});
