/**
 * The private pairing file the local MCP processes share: ~/.canon/mcp.json.
 *
 * One entry per agent, each with an HMAC secret. Several MCP processes (one
 * per agent session) read and write it, so every call re-reads the file and
 * every write goes to a 0600 temp file that is renamed over the target.
 */

import { closeSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { newSecret } from './auth.js';

export function pairingPath(home = homedir()) {
  return join(home, '.canon', 'mcp.json');
}

const AGENT_ID = /^[a-z0-9-]{1,64}$/;

function checkId(agentId) {
  if (typeof agentId !== 'string' || !AGENT_ID.test(agentId)) {
    throw new Error(`Invalid agent id: ${String(agentId).slice(0, 64)}`);
  }
}

export function readPairings(path) {
  const agents = Object.create(null);
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const raw = data && typeof data === 'object' ? data.agents : null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const key of Object.keys(raw)) {
        const entry = raw[key];
        if (!AGENT_ID.test(key)) continue;
        if (!entry || typeof entry !== 'object' || !/^[0-9a-f]{64}$/.test(entry.secret)) continue;
        agents[key] = entry;
      }
    }
  } catch {
    // missing or unparsable: treated as no pairings
  }
  return { agents };
}

function writePairings(path, data) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const fd = openSync(tmp, 'wx', 0o600);
  try {
    try {
      writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    } finally {
      closeSync(fd);
    }
    chmodSync(tmp, 0o600); // umask-proof
    renameSync(tmp, path);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    throw error;
  }
}

export function ensurePairing(path, agentId, name) {
  checkId(agentId);
  const data = readPairings(path);
  if (Object.hasOwn(data.agents, agentId)) {
    return { secret: data.agents[agentId].secret, fresh: false };
  }
  const secret = newSecret();
  data.agents[agentId] = { name, secret, claimedBy: null, createdAt: new Date().toISOString() };
  writePairings(path, data);
  return { secret, fresh: true };
}

export function rotatePairing(path, agentId, name) {
  checkId(agentId);
  const data = readPairings(path);
  const secret = newSecret();
  data.agents[agentId] = {
    name,
    secret,
    claimedBy: null,
    createdAt: Object.hasOwn(data.agents, agentId)
      ? (data.agents[agentId].createdAt ?? new Date().toISOString())
      : new Date().toISOString(),
  };
  writePairings(path, data);
  return { secret };
}

export function claimPairing(path, agentId, tabId) {
  if (typeof agentId !== 'string' || !AGENT_ID.test(agentId)) return false;
  const data = readPairings(path);
  if (!Object.hasOwn(data.agents, agentId)) return false;
  const entry = data.agents[agentId];
  if (entry.claimedBy === tabId) return true;
  if (entry.claimedBy) return false;
  entry.claimedBy = tabId;
  writePairings(path, data);
  return true;
}

export function agentIdFor(clientName) {
  const slug = String(clientName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'agent';
}

export function pairLink(appBase, { agentId, name, port, secret }) {
  return `${appBase}#pair=${agentId}.${port}.${secret}&name=${encodeURIComponent(name)}`;
}
