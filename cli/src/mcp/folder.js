/**
 * Reads a build folder (static files with an index.html at its top) so it can
 * be sent to the Canon tab. Node built-ins only. The same limits are checked
 * again in the tab (src/app/lib/stage.ts); a test keeps the two in step.
 */

import { readdir, lstat, stat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, sep } from 'node:path';

export const BUILD_LIMITS = { maxBytes: 25 * 1024 * 1024, maxFiles: 2000, maxPath: 500 };

const SKIPPED_NAMES = new Set(['node_modules', '.DS_Store']);
const refuse = (message) => ({ ok: false, message });

/** A name that would break a stored path. */
const odd = (name) => name.includes('\\') || name.includes('\0');

/** hooks.afterWalk runs between checking the files and reading them; tests use it to change files. */
export async function readBuildFolder(folder, limits = BUILD_LIMITS, hooks = {}) {
  if (typeof folder !== 'string' || !isAbsolute(folder)) {
    return refuse('folder must be an absolute path. Pass the full path to the build folder, such as /Users/you/app/dist.');
  }
  let root;
  try {
    root = await realpath(folder);
  } catch {
    return refuse(`There is no folder at ${folder}. Build the project first, then pass the folder it wrote.`);
  }
  const top = await stat(root);
  if (!top.isDirectory()) return refuse(`${folder} is a file, not a folder. Pass the folder that holds index.html.`);
  const index = await stat(join(root, 'index.html')).catch(() => null);
  if (!index?.isFile()) {
    return refuse(`${folder} has no index.html at its top. Run the build and pass its output folder, often dist, build or out.`);
  }

  const found = []; // { path, full, size }
  let bytes = 0;
  let skipped = 0;
  let failure = null;

  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (failure) return;
      const name = entry.name;
      if (SKIPPED_NAMES.has(name) || odd(name)) continue;
      const full = join(dir, name);
      if (entry.isSymbolicLink()) {
        const target = await realpath(full).catch(() => null);
        const inside = target && (target === root || target.startsWith(root + sep));
        const info = inside ? await stat(target).catch(() => null) : null;
        // A link that leaves the folder, breaks, or points at a folder is left out (a folder link could loop).
        if (!info?.isFile()) {
          skipped++;
          continue;
        }
        add(prefix + name, target, info.size);
      } else if (entry.isDirectory()) {
        if (name.startsWith('.')) continue;
        await walk(full, `${prefix}${name}/`);
      } else if (entry.isFile()) {
        add(prefix + name, full, (await lstat(full)).size);
      }
    }
  }

  function add(path, full, size) {
    if (path.length > limits.maxPath) {
      failure = refuse(`The build has a file path longer than ${limits.maxPath} characters (${path.slice(0, 60)}...). Shorten the folder names in the build.`);
      return;
    }
    if (found.length + 1 > limits.maxFiles) {
      failure = refuse(`The build has more than ${limits.maxFiles} files. Pass a smaller build folder, without files the prototype does not use.`);
      return;
    }
    bytes += size;
    if (bytes > limits.maxBytes) {
      failure = refuse(`The build is larger than ${limits.maxBytes} bytes. Pass a smaller build folder, or compress large images and videos first.`);
      return;
    }
    found.push({ path, full, size });
  }

  await walk(root, '');
  if (failure) return failure;

  found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  await hooks.afterWalk?.();
  const done = await readCollected(found, limits);
  return done.ok ? { ...done, skipped } : done;
}

/**
 * Reads files already found: [{ path, full, size, data? }]. A file with data
 * is already in memory and is passed through. Each other file is opened
 * without following a link, checked to be a regular file, and read for no
 * more than the budget left.
 */
export async function readCollected(found, limits = BUILD_LIMITS) {
  const files = [];
  let read = 0;
  const changed = (path) => refuse(`${path} changed while Canon was reading the build. Finish the build, then pass the folder again.`);
  const tooBig = () => refuse(`The build is larger than ${limits.maxBytes} bytes. Pass a smaller build folder, or compress large images and videos first.`);
  for (const f of found) {
    if (f.data) {
      read += f.data.length;
      if (read > limits.maxBytes) return tooBig();
      files.push({ path: f.path, data: f.data });
      continue;
    }
    let handle;
    try {
      handle = await open(f.full, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      return changed(f.path);
    }
    try {
      const info = await handle.stat();
      if (!info.isFile()) return changed(f.path);
      if (read + info.size > limits.maxBytes) return tooBig();
      if (info.size !== f.size) return changed(f.path);
      const data = Buffer.alloc(info.size);
      let got = 0;
      while (got < info.size) {
        const { bytesRead } = await handle.read(data, got, info.size - got, got);
        if (bytesRead === 0) break;
        got += bytesRead;
      }
      if (got !== info.size) return changed(f.path);
      // One more byte means the file grew while it was read.
      const extra = await handle.read(Buffer.alloc(1), 0, 1, info.size);
      if (extra.bytesRead !== 0) return changed(f.path);
      read += got;
      files.push({ path: f.path, data });
    } finally {
      await handle.close();
    }
  }
  return { ok: true, files, bytes: read };
}
