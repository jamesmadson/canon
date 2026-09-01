import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configPath,
  dashboardPath,
  defaultConfig,
  readConfig,
  writeConfig,
  ensureGitignoreEntry,
  DASHBOARD_IGNORE_LINE,
} from '../src/config.js';

function scratch() {
  return mkdtempSync(join(tmpdir(), 'canon-config-'));
}

describe('paths', () => {
  it('keeps everything the tool owns under one directory', () => {
    expect(configPath('/repo')).toBe(join('/repo', '.canon', 'config.json'));
    expect(dashboardPath('/repo')).toBe(join('/repo', '.canon', 'dashboard.html'));
  });
});

describe('defaultConfig', () => {
  it('starts with nothing selected so the person chooses', () => {
    const config = defaultConfig({ repo: 'designskills', defaultBranch: 'main' });
    expect(config).toMatchObject({
      version: 1,
      repo: 'designskills',
      defaultBranch: 'main',
      prototypes: null,
      familyRoots: {},
      thumbnails: {},
      recordDir: '.strata',
    });
  });
});

describe('readConfig and writeConfig', () => {
  it('returns null before init has run', () => {
    expect(readConfig(scratch())).toBeNull();
  });

  it('round trips and writes a readable file', () => {
    const root = scratch();
    writeConfig(root, defaultConfig({ repo: 'r', defaultBranch: 'main' }));
    expect(readConfig(root).repo).toBe('r');
    const raw = readFileSync(configPath(root), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "repo"');
  });

  it('returns null rather than throwing on a damaged file', () => {
    const root = scratch();
    writeConfig(root, defaultConfig({ repo: 'r', defaultBranch: 'main' }));
    writeFileSync(configPath(root), '{ not json');
    expect(readConfig(root)).toBeNull();
  });
});

describe('ensureGitignoreEntry', () => {
  it('creates the file when there is none', () => {
    const root = scratch();
    expect(ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE)).toBe('created');
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain(DASHBOARD_IGNORE_LINE);
  });

  it('appends without rewriting the lines already there', () => {
    const root = scratch();
    const before = 'node_modules/\ndist/\n';
    writeFileSync(join(root, '.gitignore'), before);
    expect(ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE)).toBe('added');
    const after = readFileSync(join(root, '.gitignore'), 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after).toContain(DASHBOARD_IGNORE_LINE);
  });

  it('adds the missing newline before appending', () => {
    const root = scratch();
    writeFileSync(join(root, '.gitignore'), 'dist/');
    ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE);
    const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(lines).toContain('dist/');
    expect(lines).toContain(DASHBOARD_IGNORE_LINE);
  });

  it('does nothing at all the second time', () => {
    const root = scratch();
    ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE);
    const once = readFileSync(join(root, '.gitignore'), 'utf8');
    expect(ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE)).toBe('present');
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(once);
  });

  it('recognises the line when it is already there under a comment', () => {
    const root = scratch();
    writeFileSync(join(root, '.gitignore'), `# generated locally\n${DASHBOARD_IGNORE_LINE}\n`);
    expect(ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE)).toBe('present');
  });

  it('never creates the config directory as a side effect', () => {
    const root = scratch();
    ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE);
    expect(existsSync(join(root, '.canon'))).toBe(false);
  });
});
