/**
 * Keeps one page of a built site. The build root is the folder; the page is a
 * path inside it. The page's HTML is read for the files it asks for (links to
 * styles and icons, scripts, images, srcset, posters, inline styles), the CSS
 * for url() and @import, and the JavaScript for static module references,
 * each one in turn. Only the files found that way are kept, at the same
 * paths they have in the build.
 *
 * The stored copy is served from a folder of its own (p/<id>/), so a
 * reference that starts with a slash would leave it. Those references in the
 * collected HTML, CSS and JavaScript are rewritten to relative ones, and
 * nothing else in a file changes. Node built-ins only.
 */

import { stat, realpath } from 'node:fs/promises';
import { isAbsolute, join, sep, posix } from 'node:path';
import { BUILD_LIMITS, readCollected } from './folder.js';

/** The crawl stops here, so a build that links to itself endlessly cannot hang it. */
export const CRAWL_LIMITS = { maxRefs: 5000, maxParsedBytes: 64 * 1024 * 1024 };

const refuse = (message) => ({ ok: false, message });
const extOf = (path) => path.slice(path.lastIndexOf('.') + 1).toLowerCase();
const kindOf = (path) => {
  const ext = extOf(path);
  if (ext === 'html' || ext === 'htm' || ext === 'svg') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'mjs') return 'js';
  return null;
};
const mb = (n) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

/* ── Finding references in text ─────────────────────────────────────────── */

const TAG = /<!--[\s\S]*?-->|<(script|style)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/\1\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
/** Only links that load something. A canonical or alternate link names another page, which is not part of this one. */
const LINK_RELS = new Set(['stylesheet', 'icon', 'preload', 'modulepreload', 'apple-touch-icon', 'apple-touch-icon-precomposed', 'mask-icon', 'manifest']);

/** Each reference is { raw, start, end }: the text, and where it sits in the file. */
function htmlRefs(text) {
  const refs = [];
  const nested = []; // inline style and script bodies: { kind, text, offset }
  for (const m of text.matchAll(TAG)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const attrsAt = m.index + 1 + m[1].length;
      const list = attributes(m[2], attrsAt, tag, refs);
      const bodyAt = attrsAt + m[2].length + 1;
      const type = (list.find((a) => a.name === 'type')?.value ?? '').toLowerCase();
      if (tag === 'style') nested.push({ kind: 'css', text: m[3], offset: bodyAt });
      else if (!list.some((a) => a.name === 'src') && (type === '' || type === 'module' || type.includes('javascript'))) {
        nested.push({ kind: 'js', text: m[3], offset: bodyAt });
      }
    } else {
      attributes(m[5], m.index + 1 + m[4].length, m[4].toLowerCase(), refs);
    }
  }
  return { refs, nested };
}

function attributes(attrs, base, tag, refs) {
  const list = [];
  for (const a of attrs.matchAll(ATTR)) {
    const value = a[2] ?? a[3] ?? a[4];
    if (value === undefined) continue;
    const end = a.index + a[0].length - (a[4] === undefined ? 1 : 0);
    list.push({ name: a[1].toLowerCase(), value, start: base + end - value.length });
  }
  const rel = (list.find((a) => a.name === 'rel')?.value ?? '').toLowerCase().split(/\s+/);
  for (const a of list) {
    const { name, value, start } = a;
    const whole = { raw: value, start, end: start + value.length };
    if (name === 'src' || name === 'poster' || name === 'data-src' || name === 'data-poster') refs.push(whole);
    else if (name === 'href' && (tag === 'use' || tag === 'image' || (tag === 'link' && rel.some((r) => LINK_RELS.has(r))))) refs.push(whole);
    else if (name === 'data' && tag === 'object') refs.push(whole);
    else if (name === 'srcset' || name === 'data-srcset' || name === 'imagesrcset') {
      for (const c of srcsetUrls(value)) refs.push({ raw: c.raw, start: start + c.start, end: start + c.end });
    } else if (name === 'style') {
      for (const c of cssRefs(value)) refs.push({ raw: c.raw, start: start + c.start, end: start + c.end });
    }
  }
  return list;
}

/** The url of each candidate in a srcset. A url ends at whitespace; a candidate ends at the comma after its descriptor. */
function srcsetUrls(value) {
  const out = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i++;
    let end = i;
    while (end > start && value[end - 1] === ',') end--; // a url that ends in a comma has no descriptor
    if (end > start) out.push({ raw: value.slice(start, end), start, end });
    if (end < i) continue;
    while (i < value.length && value[i] !== ',') i++;
  }
  return out;
}

const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']+))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/dgi;

function cssRefs(text) {
  const blank = text.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
  const out = [];
  for (const m of blank.matchAll(CSS_URL)) {
    for (let g = 1; g <= 5; g++) {
      if (m[g] === undefined) continue;
      const [start, end] = m.indices[g];
      out.push({ raw: m[g], start, end });
    }
  }
  return out;
}

const JS_PATTERNS = [
  /\bimport\s*["']([^"'\n]+)["']/dg,
  /(?<![.\w$])from\s*["']([^"'\n]+)["']/dg,
  /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?["']([^"'\n]+)["']/dg,
];
const JS_URL = /new\s+URL\(\s*["']([^"'\n]+)["']\s*,\s*import\.meta\.url\s*\)/dg;
/** A quoted path that starts with a slash and ends in a file extension: what code asks for at run time. */
const JS_LITERAL = /["'`](\/[\w\-./%@]+\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|json|css|m?js|mp4|webm|mp3|wav|txt|csv|wasm))["'`]/g;

function jsRefs(text) {
  const out = [];
  const seen = new Set();
  const add = (m, bare) => {
    const [start, end] = m.indices[1];
    if (seen.has(start)) return;
    seen.add(start);
    // A bare module name such as "react" is not a file in the build. new URL(..., import.meta.url) may use a bare path.
    if (!bare && !/^(\.\.?\/|\/(?!\/))/.test(m[1])) return;
    out.push({ raw: m[1], start, end });
  };
  for (const re of JS_PATTERNS) for (const m of text.matchAll(re)) add(m, false);
  for (const m of text.matchAll(JS_URL)) add(m, true);
  return out;
}

/** Root-absolute paths in code that are not static references. They stay as they are. */
function jsRuntimePaths(text, refs) {
  const known = new Set(refs.map((r) => r.raw));
  const out = new Set();
  for (const m of text.matchAll(JS_LITERAL)) if (!known.has(m[1]) && !m[1].startsWith('//')) out.add(m[1]);
  return out;
}

/* ── Resolving a reference ──────────────────────────────────────────────── */

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Where a reference points: { skip }, { external }, { outside }, or { target, rootAbsolute, suffix, dir }. */
function resolveRef(raw, fromPath) {
  const text = raw.trim();
  if (text === '' || text.startsWith('#')) return { skip: true };
  if (/^(https?:)?\/\//i.test(text)) return { external: text };
  if (SCHEME.test(text)) return { skip: true }; // data:, blob:, javascript:, mailto: and the like
  const cut = text.search(/[?#]/);
  const path = cut < 0 ? text : text.slice(0, cut);
  const suffix = cut < 0 ? '' : text.slice(cut);
  const rootAbsolute = path.startsWith('/');
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  const joined = rootAbsolute ? decoded.slice(1) : posix.join(posix.dirname(fromPath), decoded);
  const target = posix.normalize(joined || '.');
  if (target === '..' || target.startsWith('../') || target.includes('\0') || target.includes('\\')) return { outside: text };
  return { target: target === '.' ? '' : target.replace(/\/$/, ''), rootAbsolute, suffix, dir: decoded.endsWith('/') };
}

/** The relative reference from one stored file to a target, keeping the query and hash. */
function relativeRef(fromPath, target, dir, suffix) {
  let rel = posix.relative(posix.dirname(fromPath), target || '.');
  rel = rel.split('/').map((s) => (s === '..' || s === '.' || s === '' ? s : encodeURIComponent(s))).join('/');
  if (rel === '') rel = '.';
  if (dir && !rel.endsWith('/')) rel += '/';
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel + suffix;
}

/* ── The crawl ──────────────────────────────────────────────────────────── */

/** hooks.afterCrawl runs after the crawl and before the files are read; tests use it to change files. */
export async function readBuildPage(folder, page, limits = BUILD_LIMITS, crawl = CRAWL_LIMITS, hooks = {}) {
  if (typeof folder !== 'string' || !isAbsolute(folder)) {
    return refuse('folder must be an absolute path. Pass the full path to the build folder, such as /Users/you/site/dist.');
  }
  let root;
  try {
    root = await realpath(folder);
  } catch {
    return refuse(`There is no folder at ${folder}. Build the site first, then pass the folder it wrote as folder.`);
  }
  if (!(await stat(root)).isDirectory()) return refuse(`${folder} is a file, not a folder. Pass the build root, the folder that holds the whole built site.`);
  if (typeof page !== 'string' || page.trim() === '' || page.includes('\\') || page.includes('\0')) {
    return refuse('page must be the path of a page inside the build, such as lab/home-d/ or prototypes/thesis-home/index.html.');
  }
  const asked = posix.normalize(page.trim().replace(/^\/+/, '') || '.');
  if (asked === '..' || asked.startsWith('../')) {
    return refuse(`page ${page} points outside the build folder. Pass a path inside it, such as lab/home-d/.`);
  }

  const kept = new Map(); // path -> { path, full, size }
  const queue = [];
  const missing = new Set();
  const external = new Set();
  const runtime = new Set();
  const edits = new Map(); // path -> [{ start, end, text }]
  const texts = new Map(); // path -> text, for the files that were read
  let examined = 0;
  let parsedBytes = 0;
  let rewritten = 0;

  const inside = (full) => full === root || full.startsWith(root + sep);

  /** A regular file inside the build at this path, or why not. A folder gives its index.html. */
  async function lookup(path) {
    const segments = path.split('/').filter(Boolean);
    if (segments.some((s) => s === 'node_modules') || segments.slice(0, -1).some((s) => s.startsWith('.'))) return { why: 'skipped' };
    let full = await realpath(join(root, ...segments)).catch(() => null);
    if (!full) return { why: 'missing' };
    if (!inside(full)) return { why: 'outside' };
    let info = await stat(full).catch(() => null);
    if (info?.isDirectory()) {
      full = await realpath(join(full, 'index.html')).catch(() => null);
      if (!full) return { why: 'missing' };
      if (!inside(full)) return { why: 'outside' };
      info = await stat(full).catch(() => null);
      segments.push('index.html');
    }
    if (!info?.isFile()) return { why: 'missing' };
    return { path: segments.join('/'), full, size: info.size };
  }

  /** Adds a file to the set, and to the queue when its references should be read. */
  async function keep(path) {
    const hit = await lookup(path);
    if (!hit.path) return hit;
    const known = kept.get(hit.path);
    if (known) return known;
    kept.set(hit.path, hit);
    if (kindOf(hit.path)) queue.push(hit);
    return hit;
  }

  const entry = await keep(asked === '.' ? '' : asked);
  if (!entry.path) {
    if (entry.why === 'outside') return refuse(`page ${page} leads outside the build folder through a link. Pass a page that is inside it.`);
    return refuse(`There is no page at ${page} in ${folder}. Check that the build has it, and pass its path inside the build, such as lab/home-d/ or prototypes/thesis-home/index.html.`);
  }
  if (!['html', 'htm'].includes(extOf(entry.path))) return refuse(`page ${page} is not an HTML page. Pass the path of the page, such as lab/home-d/.`);

  /** Handles each reference found in one file. Returns a refusal when the crawl must stop. */
  async function visit(file, refs) {
    for (const ref of refs) {
      if (++examined > crawl.maxRefs) {
        return refuse(`The page leads to more than ${crawl.maxRefs} references, so Canon stopped looking. Pass a simpler page, or a build with less on it.`);
      }
      const r = resolveRef(ref.raw, file.path);
      if (r.skip) continue;
      if (r.external) {
        external.add(r.external);
        continue;
      }
      if (r.outside) {
        missing.add(r.outside);
        continue;
      }
      const hit = await keep(r.target);
      if (!hit.path) {
        if (hit.why !== 'skipped') missing.add(r.target || '/');
        continue;
      }
      if (r.rootAbsolute) {
        // A folder that gave its index.html is named by that file, so the stored copy finds it.
        const asDir = r.dir && hit.path === (r.target ? `${r.target}/index.html` : 'index.html');
        const target = asDir ? r.target : hit.path;
        const list = edits.get(file.path) ?? [];
        list.push({ start: ref.start, end: ref.end, text: relativeRef(file.path, target, asDir, r.suffix) });
        edits.set(file.path, list);
        rewritten++;
      }
    }
    return null;
  }

  while (queue.length) {
    const file = queue.shift();
    parsedBytes += file.size;
    if (parsedBytes > crawl.maxParsedBytes) {
      return refuse(`The page pulls in more than ${Math.round(crawl.maxParsedBytes / (1024 * 1024))} MB of HTML, CSS and JavaScript to read, so Canon stopped. Pass a simpler page.`);
    }
    const got = await readCollected([{ path: file.path, full: file.full, size: file.size }], { ...limits, maxBytes: Math.max(limits.maxBytes, file.size) });
    if (!got.ok) return got;
    const text = Buffer.from(got.files[0].data).toString('utf8');
    texts.set(file.path, text);
    const kind = kindOf(file.path);
    let failure = null;
    if (kind === 'html') {
      const { refs, nested } = htmlRefs(text);
      failure = await visit(file, refs);
      for (const n of nested) {
        if (failure) break;
        const inner = n.kind === 'css' ? cssRefs(n.text) : jsRefs(n.text);
        failure = await visit(file, inner.map((r) => ({ ...r, start: r.start + n.offset, end: r.end + n.offset })));
      }
    } else if (kind === 'css') {
      failure = await visit(file, cssRefs(text));
    } else {
      const refs = jsRefs(text);
      failure = await visit(file, refs);
      for (const p of jsRuntimePaths(text, refs)) runtime.add(p);
    }
    if (failure) return failure;
  }

  // The limits apply to what was collected. A refusal names the largest files.
  const all = [...kept.values()];
  const tooLong = all.find((f) => f.path.length > limits.maxPath);
  if (tooLong) return refuse(`The page needs a file path longer than ${limits.maxPath} characters (${tooLong.path.slice(0, 60)}...). Shorten the folder names in the build.`);
  const total = all.reduce((n, f) => n + f.size, 0);
  if (all.length > limits.maxFiles || total > limits.maxBytes) {
    const biggest = [...all].sort((a, b) => b.size - a.size).slice(0, 5).map((f) => `${f.path} (${mb(f.size)})`).join(', ');
    const what = all.length > limits.maxFiles
      ? `The page needs ${all.length} files, over the limit of ${limits.maxFiles}.`
      : `The page needs ${mb(total)} of files, over the limit of ${mb(limits.maxBytes)}.`;
    return refuse(`${what} The largest are ${biggest}. Compress or remove the biggest files from the build, or pass a lighter page.`);
  }

  // Root-absolute references become relative, in files that read as text. A file with bytes that are not UTF-8 is left as it is.
  const found = all.map((f) => {
    const list = edits.get(f.path);
    const text = texts.get(f.path);
    if (!list || text === undefined || text.includes('�')) return { path: f.path, full: f.full, size: f.size };
    let out = text;
    for (const e of [...list].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    const data = Buffer.from(out, 'utf8');
    return { path: f.path, full: f.full, size: data.length, data };
  });
  found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  await hooks.afterCrawl?.();
  const done = await readCollected(found, limits);
  if (!done.ok) return done;
  return {
    ok: true,
    files: done.files,
    bytes: done.bytes,
    entry: entry.path,
    report: { missing: [...missing].sort(), external: [...external].sort(), runtime: [...runtime].sort(), rewritten },
  };
}
