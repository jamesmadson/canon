/**
 * The one file the tool owns in a repo: .canon/config.json.
 *
 * Everything in it is a person's choice, not a cache. Which branches count as
 * prototypes, which family a stray branch belongs to, where a thumbnail lives.
 * Anything derivable from git is derived on every run instead of being stored,
 * so the config cannot go quietly out of date.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_DIR = '.canon';
export const DASHBOARD_IGNORE_LINE = '.canon/dashboard.html';

export function configPath(root) {
  return join(root, CONFIG_DIR, 'config.json');
}

export function dashboardPath(root) {
  return join(root, CONFIG_DIR, 'dashboard.html');
}

export function defaultConfig({ repo, defaultBranch }) {
  return {
    version: 1,
    repo,
    defaultBranch,
    // null means nobody has chosen yet, which is different from choosing none.
    prototypes: null,
    familyRoots: {},
    thumbnails: {},
    recordDir: '.strata',
    indexedAt: null,
  };
}

export function readConfig(root) {
  const path = configPath(root);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeConfig(root, config) {
  mkdirSync(join(root, CONFIG_DIR), { recursive: true });
  writeFileSync(configPath(root), `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Appends one line to .gitignore if it is not already there. Existing lines
 * are never rewritten: this file belongs to the repo, not to the tool.
 * Returns what happened so the command can say it plainly.
 */
export function ensureGitignoreEntry(root, line) {
  const path = join(root, '.gitignore');
  if (!existsSync(path)) {
    writeFileSync(path, `${line}\n`);
    return 'created';
  }
  const current = readFileSync(path, 'utf8');
  if (current.split('\n').some((existing) => existing.trim() === line)) return 'present';
  const separator = current.endsWith('\n') ? '' : '\n';
  writeFileSync(path, `${current}${separator}${line}\n`);
  return 'added';
}
