// Tab side of the bridge signing scheme. Must match cli/src/mcp/auth.js byte
// for byte:
//
//   MAC = hex(HMAC-SHA256(secretHex -> bytes,
//             `${role}\n${agentId}\n${ts}\n${nonce}\n${payload}`))

export type BridgeRole = 'tab' | 'mcp';

export interface SignFields {
  secret: string;
  role: BridgeRole;
  agentId: string;
  ts: number;
  nonce: string;
  payload: string;
}

const HEX = /^(?:[0-9a-fA-F]{2})+$/;
const MAC_HEX = /^[0-9a-f]{64}$/;

function message(f: Omit<SignFields, 'secret'>): string | null {
  if (f.role !== 'tab' && f.role !== 'mcp') return null;
  if (typeof f.agentId !== 'string' || typeof f.nonce !== 'string') return null;
  if (typeof f.payload !== 'string') return null;
  if (typeof f.ts !== 'number' && typeof f.ts !== 'string') return null;
  const tsText = String(f.ts);
  for (const part of [f.agentId, tsText, f.nonce]) {
    if (part.includes('\n')) return null;
  }
  return `${f.role}\n${f.agentId}\n${tsText}\n${f.nonce}\n${f.payload}`;
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

async function mac(secret: string, text: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    fromHex(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

export async function sign(f: SignFields): Promise<string> {
  if (typeof f.secret !== 'string' || !HEX.test(f.secret)) {
    throw new Error('Signing secret must be non-empty hex.');
  }
  const text = message(f);
  if (text === null) throw new Error('Cannot sign a malformed message.');
  return toHex(await mac(f.secret, text));
}

/** Compares without an early exit. Resolves false, never rejects, on malformed input. */
export async function verify(f: SignFields & { mac: string }): Promise<boolean> {
  try {
    if (typeof f.secret !== 'string' || !HEX.test(f.secret)) return false;
    if (typeof f.mac !== 'string' || !MAC_HEX.test(f.mac)) return false;
    const text = message(f);
    if (text === null) return false;
    const expected = await mac(f.secret, text);
    const given = fromHex(f.mac);
    if (given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function newNonce(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}
