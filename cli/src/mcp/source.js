/**
 * The repo and branch of the git checkout the MCP process runs in, read from
 * the files in .git. Git itself is never run.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function findGit(dir) {
  let current = resolve(dir);
  for (;;) {
    const candidate = join(current, '.git');
    if (existsSync(candidate)) return { root: current, git: candidate };
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function branchFrom(gitDir) {
  const head = read(join(gitDir, 'HEAD'));
  const match = head && /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(head);
  return match ? match[1] : undefined;
}

function originRepo(gitDir) {
  const config = read(join(gitDir, 'config'));
  if (!config) return undefined;
  let inOrigin = false;
  for (const line of config.split(/\r?\n/)) {
    const section = /^\s*\[(.*)\]\s*$/.exec(line);
    if (section) {
      inOrigin = /^remote\s+"origin"$/.test(section[1].trim());
      continue;
    }
    const url = inOrigin && /^\s*url\s*=\s*(.+?)\s*$/.exec(line);
    if (url) {
      const last = url[1].replace(/\/+$/, '').replace(/\.git$/, '').split(/[/:\\]/).pop();
      if (last) return last;
    }
  }
  return undefined;
}

export function readSource(dir = process.cwd()) {
  try {
    const found = findGit(dir);
    if (!found) return {};
    let headDir = found.git;
    let commonDir = found.git;
    let holder = found.root;
    if (statSync(found.git).isFile()) {
      const pointer = /^gitdir:\s*(.+?)\s*$/m.exec(read(found.git) || '');
      if (!pointer) return {};
      headDir = isAbsolute(pointer[1]) ? pointer[1] : resolve(found.root, pointer[1]);
      if (!existsSync(headDir)) return {};
      const common = (read(join(headDir, 'commondir')) || '').trim();
      commonDir = common ? resolve(headDir, common) : headDir;
      holder = basename(commonDir) === '.git' ? dirname(commonDir) : commonDir;
    }
    const out = {};
    const repo = originRepo(commonDir) || basename(holder);
    if (repo) out.repo = repo;
    const branch = branchFrom(headDir);
    if (branch) out.branch = branch;
    return out;
  } catch {
    return {};
  }
}
