// Message signing for the loopback bridge. The browser tab has the same
// scheme in src/app/bridge/auth.ts; the two must agree byte for byte.
//
//   MAC = hex(HMAC-SHA256(secretHex -> bytes,
//             `${role}\n${agentId}\n${ts}\n${nonce}\n${payload}`))
//
// A response is signed with role 'mcp' and the request's nonce, which binds
// it to that request.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ROLES = new Set(['tab', 'mcp']);
const HEX = /^(?:[0-9a-fA-F]{2})+$/;
const MAC_HEX = /^[0-9a-f]{64}$/;

/** The signed string, or null if any header field could blur the framing. */
function message({ role, agentId, ts, nonce, payload }) {
  if (!ROLES.has(role)) return null;
  if (typeof agentId !== 'string' || typeof nonce !== 'string') return null;
  if (typeof payload !== 'string') return null;
  if (typeof ts !== 'number' && typeof ts !== 'string') return null;
  const tsText = String(ts);
  // The fields are newline separated, so none of the first four may hold one.
  for (const f of [agentId, tsText, nonce]) {
    if (f.includes('\n')) return null;
  }
  return `${role}\n${agentId}\n${tsText}\n${nonce}\n${payload}`;
}

function mac(secret, text) {
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(text, 'utf8').digest();
}

export function sign(fields) {
  if (typeof fields.secret !== 'string' || !HEX.test(fields.secret)) {
    throw new Error('Signing secret must be non-empty hex.');
  }
  const text = message(fields);
  if (text === null) throw new Error('Cannot sign a malformed message.');
  return mac(fields.secret, text).toString('hex');
}

/** Constant-time check. Returns false, never throws, on any malformed input. */
export function verify(fields) {
  try {
    if (typeof fields.secret !== 'string' || !HEX.test(fields.secret)) return false;
    if (typeof fields.mac !== 'string' || !MAC_HEX.test(fields.mac)) return false;
    const text = message(fields);
    if (text === null) return false;
    const expected = mac(fields.secret, text);
    const given = Buffer.from(fields.mac, 'hex');
    if (given.length !== expected.length) return false;
    return timingSafeEqual(given, expected);
  } catch {
    return false;
  }
}

export function newSecret() {
  return randomBytes(32).toString('hex');
}

export function newNonce() {
  return randomBytes(16).toString('hex');
}

/**
 * Rejects a timestamp more than windowMs from now (either side) and any nonce
 * already accepted inside the window.
 */
export function createReplayGuard({ windowMs = 30_000 } = {}) {
  const seen = new Map(); // nonce -> ts it was accepted with
  return {
    accept(ts, nonce, now = Date.now()) {
      if (typeof ts !== 'number' || !Number.isFinite(ts)) return false;
      if (typeof nonce !== 'string' || nonce === '') return false;
      if (Math.abs(now - ts) > windowMs) return false;
      // A nonce can only be replayed while its timestamp is still in window.
      for (const [n, t] of seen) {
        if (now - t > windowMs) seen.delete(n);
      }
      if (seen.has(nonce)) return false;
      seen.set(nonce, ts);
      return true;
    },
  };
}
