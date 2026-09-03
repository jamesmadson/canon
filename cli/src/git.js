/**
 * Read only git.
 *
 * Canon indexes and annotates; the work stays where it is. That is the product
 * position and it is also the security story, so it is enforced here rather
 * than promised in a readme: this module is the only place the tool shells out
 * to git, and the allowlist below is the whole vocabulary it knows.
 *
 * Nothing here writes a ref, moves HEAD, or opens a socket. There is no commit,
 * no branch, no checkout, no fetch, no pull, no push, and no remote command of
 * any kind. A suite test reads this file and fails if one appears.
 */

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

/** The only git subcommands this tool is allowed to run. All of them read. */
export const ALLOWED_SUBCOMMANDS = ['for-each-ref', 'log', 'rev-parse', 'merge-base'];

function git(args, cwd) {
  if (!ALLOWED_SUBCOMMANDS.includes(args[0])) {
    throw new Error(`Refusing to run git ${args[0]}: this tool only reads.`);
  }
  // execFile, never a shell, so a branch name can never be read as a command.
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

export function isWorkTree(cwd) {
  return tryGit(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
}

export function repoRoot(cwd) {
  return tryGit(['rev-parse', '--show-toplevel'], cwd);
}

/**
 * Both questions every command opens with, in one spawn.
 *
 * Is this a work tree, and where is its root. rev-parse answers both at once,
 * and asking twice meant two processes to learn two things about the same
 * directory. Outside a work tree the whole call fails, which is the answer.
 */
export function locateRepo(cwd) {
  const out = tryGit(['rev-parse', '--is-inside-work-tree', '--show-toplevel'], cwd);
  if (!out) return { isWorkTree: false, root: null };
  const [inside, root] = out.split('\n');
  return inside === 'true' && root ? { isWorkTree: true, root } : { isWorkTree: false, root: null };
}

export function repoName(cwd) {
  const root = repoRoot(cwd);
  return root ? basename(root) : basename(cwd);
}

export function currentBranch(cwd) {
  const name = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return name === 'HEAD' ? null : name;
}

// A unit separator, because a commit subject can contain anything a tab can.
const FIELD = '\u001f';

/**
 * Every local branch with the facts a card needs. Remote tracking refs are
 * deliberately out: they would need a fetch to be true, and this tool does not
 * fetch, so showing them would be showing something stale as if it were live.
 */
export function listBranches(cwd) {
  // format-local, not :short. The short form is the date in the committer's own
  // timezone, so a commit pushed from another zone reads as a different day
  // than the clock this tool compares it against. Every date the tool handles
  // is the machine's local calendar date, on both sides of the subtraction.
  const format = [
    '%(refname:short)',
    '%(committerdate:format-local:%Y-%m-%d)',
    '%(objectname:short)',
    '%(contents:subject)',
  ].join(FIELD);
  const out = tryGit(['for-each-ref', `--format=${format}`, 'refs/heads'], cwd);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, lastCommit, sha, subject] = line.split(FIELD);
      return { name, lastCommit, sha, subject: subject || '' };
    });
}

/**
 * Which branch the others are variants of. Read from what is present rather
 * than from a remote, because asking a remote would mean going to the network.
 */
export function pickDefaultBranch(names, current) {
  for (const candidate of ['main', 'master', 'trunk']) {
    if (names.includes(candidate)) return candidate;
  }
  if (current && names.includes(current)) return current;
  return names[0] ?? 'main';
}

/** Where a branch left the default branch, as a date. Null when it cannot be read. */
export function forkDate(branch, defaultBranch, cwd) {
  const base = tryGit(['merge-base', branch, defaultBranch], cwd);
  if (!base) return null;
  return tryGit(['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d', base], cwd);
}

/**
 * Where each of many branches left the default branch, as dates.
 *
 * The merge base still costs one call per branch, because merge-base answers
 * about one pair. Resolving those bases to dates does not: log --no-walk takes
 * every sha at once, so a repository with twenty prototypes reads twenty one
 * times rather than forty. Several branches usually share a base, so the shas
 * are de-duplicated before the one call that dates them.
 *
 * @returns {Record<string, string>} branch name to date, missing where unread
 */
export function forkDates(branches, defaultBranch, cwd) {
  const baseOf = {};
  for (const name of branches) {
    const base = tryGit(['merge-base', name, defaultBranch], cwd);
    if (base) baseOf[name] = base;
  }

  const shas = [...new Set(Object.values(baseOf))];
  if (!shas.length) return {};

  const out = tryGit(
    ['log', '--no-walk', '--format=%H %cd', '--date=format-local:%Y-%m-%d', ...shas],
    cwd,
  );
  if (!out) return {};

  const dateOf = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const cut = line.indexOf(' ');
    if (cut !== -1) dateOf.set(line.slice(0, cut), line.slice(cut + 1).trim());
  }

  const dates = {};
  for (const [name, base] of Object.entries(baseOf)) {
    // merge-base prints a full sha and so does %H, so the two match directly.
    const date = dateOf.get(base);
    if (date) dates[name] = date;
  }
  return dates;
}
