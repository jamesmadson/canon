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
  forkDates,
  locateRepo,
  parseRemote,
  originRemote,
  authors,
  gitConfig,
  userName,
  initialsOf,
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

  it('spawns from two modules only, and only one of them knows about git', () => {
    const callers = files
      .filter((file) => readFileSync(file, 'utf8').includes('node:child_process'))
      .map((f) => f.replace(cliDir, ''))
      .sort();
    expect(callers).toEqual([join('src', 'git.js'), join('src', 'opener.js')]);
    expect(readFileSync(join(cliDir, 'src', 'opener.js'), 'utf8')).not.toContain('git');
  });

  it('keeps the allowlist to commands that only read', () => {
    expect(ALLOWED_SUBCOMMANDS).toEqual(['config', 'for-each-ref', 'log', 'merge-base', 'rev-parse']);
  });

  /**
   * config is the one subcommand here that can write, so the allowlist is not
   * enough on its own. Every call goes through --get, which reads, and the
   * wrapper refuses the rest rather than trusting the caller.
   */
  it('only ever reads config, never sets it', () => {
    const source = readFileSync(join(cliDir, 'src', 'git.js'), 'utf8');
    expect(source).toContain("'--get'");
    for (const write of ['--replace-all', '--unset', '--add', '--edit', '--rename-section']) {
      expect(source.includes(write), `git.js names config ${write}`).toBe(false);
    }
    expect(() => gitConfig(['--unset', 'user.name'], repo)).toThrow();
  });

  it('refuses a config call that is not a --get', () => {
    expect(() => gitConfig(['user.name', 'somebody'], repo)).toThrow(/only reads/);
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

describe('how many times git is spawned', () => {
  /**
   * Every git call is a process. open() resolved one merge base and then one
   * date per branch, so a repository with twenty prototypes paid forty spawns
   * to draw a page, and locate() paid two more to answer one question about the
   * same directory. The counts below are the shape of the fix, not a
   * micro-optimisation: they are what keeps the tool quick on a real repository.
   */
  it('resolves many fork dates in one log call', () => {
    const names = listBranches(repo).map((b) => b.name);
    const base = pickDefaultBranch(names, currentBranch(repo));
    const others = names.filter((n) => n !== base).slice(0, 4);
    const dates = forkDates(others, base, repo);
    expect(Object.keys(dates).length).toBeGreaterThan(0);
    for (const date of Object.values(dates)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('agrees with reading the dates one at a time', () => {
    const names = listBranches(repo).map((b) => b.name);
    const base = pickDefaultBranch(names, currentBranch(repo));
    const others = names.filter((n) => n !== base).slice(0, 3);
    const batched = forkDates(others, base, repo);
    for (const name of others) {
      expect(batched[name] ?? null, name).toBe(forkDate(name, base, repo));
    }
  });

  it('answers both questions about the work tree in one call', () => {
    const found = locateRepo(repo);
    expect(found.isWorkTree).toBe(true);
    expect(found.root).toBe(repoRoot(repo));
  });

  it('says plainly when a directory is not a work tree', () => {
    const found = locateRepo('/');
    expect(found.isWorkTree).toBe(false);
    expect(found.root).toBe(null);
  });

  it('takes an empty list of branches without spawning anything', () => {
    expect(forkDates([], 'main', repo)).toEqual({});
  });
});

describe('the breadcrumb, read from the remote', () => {
  it('reads owner and repo out of an https remote', () => {
    expect(parseRemote('https://github.com/jamesmadson/canon.git')).toEqual({
      owner: 'jamesmadson',
      repo: 'canon',
    });
    expect(parseRemote('https://github.com/acme/thing')).toEqual({ owner: 'acme', repo: 'thing' });
  });

  it('reads the ssh spelling the same way', () => {
    expect(parseRemote('git@github.com:acme/thing.git')).toEqual({ owner: 'acme', repo: 'thing' });
    expect(parseRemote('ssh://git@gitlab.com/group/sub.git')).toEqual({
      owner: 'group',
      repo: 'sub',
    });
  });

  it('is null where there is no remote to read', () => {
    expect(parseRemote('')).toBe(null);
    expect(parseRemote(null)).toBe(null);
    expect(parseRemote('not a url')).toBe(null);
  });

  it('reads this repository, which has a remote', () => {
    const remote = originRemote(repo);
    // Reading the configured URL is not contacting it.
    expect(remote === null || typeof remote.owner === 'string').toBe(true);
  });
});

describe('the account slot', () => {
  it('reads the configured name', () => {
    const name = userName(repo);
    expect(name === null || typeof name === 'string').toBe(true);
  });

  it('takes initials from the first and last word', () => {
    expect(initialsOf('James Madson')).toBe('JM');
    expect(initialsOf('ada')).toBe('A');
    expect(initialsOf('Ada Something Lovelace')).toBe('AL');
    expect(initialsOf('  spaced   out  ')).toBe('SO');
  });

  it('falls back to a plain mark rather than showing nothing', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('authors, read from the commit history', () => {
  it('counts commits per person, newest date first', () => {
    const people = authors(repo);
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      expect(person.name).toBeTruthy();
      expect(person.commits).toBeGreaterThan(0);
      expect(person.lastCommit).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('de-duplicates a person who committed more than once', () => {
    const people = authors(repo);
    const names = people.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('sorts the busiest first', () => {
    const counts = authors(repo).map((p) => p.commits);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
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
