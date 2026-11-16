/**
 * Sends a build folder's files to the tab in pieces. The bridge refuses a
 * command whose arguments are over 64 KB of JSON, so each piece stays well
 * under that. A piece holds parts: a run of one file's bytes, as base64, with
 * where it starts and how big the whole file is. The tab puts them back
 * together by offset (src/app/lib/stage.ts) and the add or update that
 * follows names the upload and says how many files and bytes to expect.
 */

import { randomBytes } from 'node:crypto';

/** What one piece may cost, counting base64 and the words around each part. Under the bridge's 64 KB with room to spare. */
export const PIECE_BUDGET = 48_000;
const PART_OVERHEAD = 80;
const PARALLEL = 6;

const cost = (path, bytes) => Math.ceil(bytes * (4 / 3)) + path.length + PART_OVERHEAD;

/** The pieces for these files: [{ upload, parts: [{ path, at, size, data }] }]. */
export function piecesOf(files, upload) {
  const pieces = [];
  let parts = [];
  let used = 0;
  const flush = () => {
    if (parts.length) pieces.push({ upload, parts });
    parts = [];
    used = 0;
  };
  for (const file of files) {
    const bytes = Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);
    // The tab refuses a path over 500 characters, so a part always has room for some bytes.
    const roomAfter = (spent) => Math.floor(((PIECE_BUDGET - spent - file.path.length - PART_OVERHEAD) * 3) / 4);
    let at = 0;
    for (;;) {
      let room = roomAfter(used);
      if (room < 1 && parts.length) {
        flush();
        room = roomAfter(0);
      }
      const n = Math.min(room, bytes.length - at);
      parts.push({ path: file.path, at, size: bytes.length, data: bytes.subarray(at, at + n).toString('base64') });
      used += cost(file.path, n);
      at += n;
      if (at >= bytes.length) break;
      flush();
    }
  }
  flush();
  return pieces;
}

/**
 * Sends every piece through send(op, args), a few at a time. Returns
 * { ok: true, build } for the add or update to carry, or { ok: false, reply }
 * with the first failed reply.
 */
export async function stageBuild(send, read) {
  const upload = randomBytes(8).toString('hex');
  const pieces = piecesOf(read.files, upload);
  let failure = null;
  let next = 0;
  async function worker() {
    while (!failure && next < pieces.length) {
      const piece = pieces[next++];
      const reply = await send('stage', piece);
      if (!reply.ok) failure ??= reply;
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, pieces.length) }, worker));
  if (failure) return { ok: false, reply: failure };
  return { ok: true, build: { upload, count: read.files.length, bytes: read.bytes } };
}
