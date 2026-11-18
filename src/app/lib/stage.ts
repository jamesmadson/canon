/**
 * Where a build folder's files wait while an agent sends them. The MCP
 * process sends pieces (op 'stage'); the add or update that follows names the
 * upload (op args.build) and this puts the files back together, checked, so
 * every refusal happens before anything is written. Pure and in memory, so
 * the rules are testable. Nothing here touches the network or storage.
 */

/** Mirror of BUILD_LIMITS in cli/src/mcp/folder.js. A test keeps the two equal. */
export const BUILD_LIMITS = { maxBytes: 25 * 1024 * 1024, maxFiles: 2000, maxPath: 500 };

const MAX_PARTS = 1000;
/** Pieces the MCP process cuts are at most about 36 KB; counting 30 KB makes the caps below roomy for a real build and tight for a flood. */
const PIECE_BYTES = 30_000;
/** A build of the largest size in pieces of PIECE_BYTES, twice over for small files that share a piece. */
export const MAX_PIECES = 2 * Math.ceil(BUILD_LIMITS.maxBytes / PIECE_BYTES);
/** Every file once, plus every piece-sized run of bytes split across pieces. */
const MAX_UPLOAD_PARTS = BUILD_LIMITS.maxFiles + MAX_PIECES;
const MAX_UPLOADS = 4;
const KEEP_MS = 10 * 60 * 1000;
const UPLOAD = /^[0-9a-f]{16}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface BuildFile { path: string; bytes: Uint8Array }

interface Entry { size: number; chunks: Map<number, Uint8Array> }
interface Upload { started: number; files: Map<string, Entry>; held: number; pieces: number; parts: number }

export interface Staging {
  /** Takes one piece. Throws a sentence that says what is wrong. */
  part(args: unknown): void;
  /** The files of an upload, checked and complete. Each upload can be taken once. */
  take(build: unknown): BuildFile[];
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** A path inside the build: relative, forward slashes, no empty, dot or dot-dot parts. */
function safe(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > BUILD_LIMITS.maxPath) return false;
  if (path.includes('\\') || path.includes('\0') || path.startsWith('/')) return false;
  return path.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

function decode(data: unknown): Uint8Array {
  if (typeof data !== 'string' || data.length % 4 !== 0 || !BASE64.test(data)) throw new Error('data must be base64 text.');
  const raw = atob(data);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function createStaging(now: () => number = Date.now): Staging {
  const uploads = new Map<string, Upload>();

  function forget() {
    for (const [id, u] of uploads) if (now() - u.started > KEEP_MS) uploads.delete(id);
  }

  function open(id: string): Upload {
    let u = uploads.get(id);
    if (!u) {
      while (uploads.size >= MAX_UPLOADS) {
        const oldest = [...uploads].sort((a, b) => a[1].started - b[1].started)[0][0];
        uploads.delete(oldest);
      }
      u = { started: now(), files: new Map(), held: 0, pieces: 0, parts: 0 };
      uploads.set(id, u);
    }
    return u;
  }

  return {
    part(args) {
      forget();
      if (!isObject(args) || typeof args.upload !== 'string' || !UPLOAD.test(args.upload)) throw new Error('upload must be 16 hex digits.');
      if (!Array.isArray(args.parts) || args.parts.length > MAX_PARTS) throw new Error(`parts must be a list of at most ${MAX_PARTS} parts.`);
      const u = open(args.upload);
      if (++u.pieces > MAX_PIECES) throw new Error('The build was sent in too many pieces.');
      u.parts += args.parts.length;
      if (u.parts > MAX_UPLOAD_PARTS) throw new Error('The build was sent in too many parts.');
      for (const p of args.parts) {
        if (!isObject(p)) throw new Error('Each part must be an object.');
        if (!safe(p.path)) throw new Error(`"${String(p.path).slice(0, 80)}" is not a path inside the build.`);
        if (!whole(p.at) || !whole(p.size)) throw new Error('at and size must be whole numbers.');
        if (p.size > BUILD_LIMITS.maxBytes) throw new Error('The build is larger than 25 MB.');
        const bytes = decode(p.data);
        if (bytes.length === 0 && p.size !== 0) throw new Error('A part with no bytes is only allowed for an empty file.');
        if (p.at + bytes.length > p.size) throw new Error(`A part of ${p.path} runs past the end of the file.`);
        let file = u.files.get(p.path);
        if (!file) {
          if (u.files.size + 1 > BUILD_LIMITS.maxFiles) throw new Error(`The build has more than ${BUILD_LIMITS.maxFiles} files.`);
          file = { size: p.size, chunks: new Map() };
          u.files.set(p.path, file);
        } else if (file.size !== p.size) {
          throw new Error(`${p.path} was sent with two different sizes.`);
        }
        const before = file.chunks.get(p.at)?.length ?? 0;
        if (u.held - before + bytes.length > BUILD_LIMITS.maxBytes) throw new Error('The build is larger than 25 MB.');
        u.held += bytes.length - before;
        file.chunks.set(p.at, bytes);
      }
    },

    take(build) {
      forget();
      if (!isObject(build) || typeof build.upload !== 'string' || !whole(build.count) || !whole(build.bytes)) {
        throw new Error('build must say which upload, how many files and how many bytes.');
      }
      const u = uploads.get(build.upload);
      uploads.delete(build.upload);
      if (!u) throw new Error('Canon no longer has those files. Add the build again.');
      const lost = new Error('Some of the files did not arrive. Add the build again.');
      if (u.files.size !== build.count) throw lost;
      const files: BuildFile[] = [];
      let total = 0;
      for (const [path, entry] of u.files) {
        const bytes = new Uint8Array(entry.size);
        let next = 0;
        for (const at of [...entry.chunks.keys()].sort((a, b) => a - b)) {
          const chunk = entry.chunks.get(at)!;
          if (at !== next) throw lost;
          bytes.set(chunk, at);
          next = at + chunk.length;
        }
        if (next !== entry.size) throw lost;
        total += entry.size;
        files.push({ path, bytes });
      }
      if (total !== build.bytes) throw lost;
      if (!files.some((f) => /\.html?$/i.test(f.path))) throw new Error('The build has no HTML page.');
      return files;
    },
  };
}
