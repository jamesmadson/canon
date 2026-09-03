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

// A unit separator, because a commit subject can contain anything a tab can.
const FIELD = '\u001f';

/**
 * The only git subcommands this tool is allowed to run. All of them read.
 *
 * config is the one that could write, so the allowlist is not enough on its
 * own: gitConfig below refuses anything that is not a --get, and a suite test
 * pins both halves. It is here so the top bar can name the repository and the
 * person, which are facts about this machine and never leave it.
 */
export const ALLOWED_SUBCOMMANDS = ['config', 'for-each-ref', 'log', 'merge-base', 'rev-parse'];

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

/**
 * git config, and only ever the reading half of it.
 *
 * The subcommand allowlist cannot tell a read from a write here, so this is the
 * narrower gate: the first argument has to be --get, and everything else is
 * refused before a process is spawned.
 */
export function gitConfig(args, cwd) {
  if (args[0] !== '--get') {
    throw new Error('Refusing to run git config without --get: this tool only reads.');
  }
  return git(['config', ...args], cwd);
}

function tryConfig(key, cwd) {
  try {
    return gitConfig(['--get', key], cwd) || null;
  } catch {
    // An unset key exits non zero, which is an answer rather than a failure.
    return null;
  }
}

/**
 * Owner and repository out of a remote URL, without going near the network.
 *
 * Both spellings a person is likely to have: the https one and the scp style
 * ssh one. Anything else is null, and the caller falls back to the folder name,
 * which is always true even when it is less specific.
 */
export function parseRemote(url) {
  if (!url) return null;
  const trimmed = String(url).trim().replace(/\.git$/, '').replace(/\/+$/, '');
  // scp style: git@host:owner/repo
  const scp = trimmed.match(/^[^/@]+@[^:/]+:([^/]+)\/([^/]+)$/);
  if (scp) return { owner: scp[1], repo: scp[2] };
  // Anything with a scheme: the last two path segments are the pair.
  const scheme = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\/(.+)$/i);
  if (scheme) {
    const parts = scheme[1].split('/').filter(Boolean);
    if (parts.length >= 2) return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
  }
  return null;
}

/** The origin remote as owner and repo, or null where there is no remote. */
export function originRemote(cwd) {
  return parseRemote(tryConfig('remote.origin.url', cwd));
}

/** The name git would put on a commit made here. */
export function userName(cwd) {
  return tryConfig('user.name', cwd);
}

/** A short mark for the account slot: first and last initial. */
export function initialsOf(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Who has committed here, from the commit history and nowhere else.
 *
 * There is no member list to read: a repository knows who has written to it and
 * that is all. The page says so rather than presenting these as a roster.
 */
export function authors(cwd) {
  // A person name can hold anything a tab can, so the two fields are split
  // on the unit separator rather than on a character a name might contain.
  const out = tryGit(['log', `--format=%an${FIELD}%cd`, '--date=format-local:%Y-%m-%d'], cwd);
  if (!out) return [];

  const byName = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [name, date] = line.split(FIELD);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { name, commits: 0, lastCommit: date || '' });
    const person = byName.get(name);
    person.commits += 1;
    if (date && date > person.lastCommit) person.lastCommit = date;
  }

  return [...byName.values()].sort(
    (a, b) => b.commits - a.commits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
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
