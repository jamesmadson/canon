import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_SUBCOMMANDS,
  isWorkTree,
  repoRoot,
  repoName,
  currentBranch,
  listBranches,
  pickDefaultBranch,
  forkDate,
} from '../src/git.js';

const cliDir = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(js|html)$/.test(entry.name) ? [path] : [];
  });
}

describe('the tool never writes to a repo it did not create', () => {
  const files = sourceFiles(cliDir).filter((f) => !f.includes(`${join('cli', 'tests')}`));

  it('finds the shipped files to check', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it('never names a mutating git subcommand anywhere in the shipped code', () => {
    const mutating = [
      'commit',
      'checkout',
      'switch',
      'branch',
      'push',
      'fetch',
      'pull',
      'merge',
      'rebase',
      'reset',
      'clean',
      'stash',
      'tag',
      'remote',
      'clone',
      'apply',
      'cherry-pick',
      'update-ref',
      'symbolic-ref',
      'gc',
      'worktree',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const command of mutating) {
        expect(
          source.includes(`'${command}'`) || source.includes(`"${command}"`),
          `${file} names git ${command}`,
        ).toBe(false);
        expect(source.includes(`git ${command}`), `${file} names git ${command}`).toBe(false);
      }
    }
  });

  it('shells out from one module only', () => {
    const callers = files.filter((file) => readFileSync(file, 'utf8').includes('node:child_process'));
    expect(callers.map((f) => f.replace(cliDir, ''))).toEqual([join('src', 'git.js')]);
  });

  it('keeps the allowlist to commands that only read', () => {
    expect(ALLOWED_SUBCOMMANDS).toEqual(['for-each-ref', 'log', 'rev-parse', 'merge-base']);
  });

  it('never shells through a shell', () => {
    const source = readFileSync(join(cliDir, 'src', 'git.js'), 'utf8');
    expect(source).toContain('execFileSync');
    expect(source).not.toContain('execSync(');
    expect(source).not.toContain('shell: true');
  });
});

describe('reading this repo', () => {
  it('recognises a work tree', () => {
    expect(isWorkTree(repo)).toBe(true);
  });

  it('does not mistake a plain directory for one', () => {
    expect(isWorkTree('/')).toBe(false);
  });

  it('finds the repository root and its name', () => {
    expect(statSync(repoRoot(repo)).isDirectory()).toBe(true);
    expect(typeof repoName(repo)).toBe('string');
  });

  it('reads the branch this work is on', () => {
    expect(currentBranch(repo)).toBeTruthy();
  });

  it('lists local branches with a date and a short sha', () => {
    const branches = listBranches(repo);
    expect(branches.length).toBeGreaterThan(0);
    for (const branch of branches) {
      expect(branch.name).toBeTruthy();
      expect(branch.lastCommit).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(branch.sha).toMatch(/^[0-9a-f]{4,}$/);
    }
  });

  it('reads a fork date against the default branch', () => {
    const names = listBranches(repo).map((b) => b.name);
    const base = pickDefaultBranch(names, currentBranch(repo));
    const date = forkDate(currentBranch(repo), base, repo);
    expect(date === null || /^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
  });
});

describe('pickDefaultBranch', () => {
  it('prefers main, then master, then trunk', () => {
    expect(pickDefaultBranch(['dev', 'master', 'main'], 'dev')).toBe('main');
    expect(pickDefaultBranch(['dev', 'master'], 'dev')).toBe('master');
    expect(pickDefaultBranch(['trunk', 'dev'], 'dev')).toBe('trunk');
  });

  it('falls back to the checked out branch, then to the first one', () => {
    expect(pickDefaultBranch(['alpha', 'beta'], 'beta')).toBe('beta');
    expect(pickDefaultBranch(['alpha', 'beta'], null)).toBe('alpha');
  });

  it('names main in an empty repository rather than returning nothing', () => {
    expect(pickDefaultBranch([], null)).toBe('main');
  });
});
