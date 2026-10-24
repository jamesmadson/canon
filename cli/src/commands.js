/**
 * The four commands.
 *
 * Each one takes the parsed argv and an io object, so the suite can run a
 * command against a scratch repository and read what it printed rather than
 * inspecting a spy. Everything a command writes lands in .canon, .gitignore,
 * or the record directory, and nowhere else.
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

import {
  locateRepo,
  repoName,
  currentBranch,
  listBranches,
  pickDefaultBranch,
  forkDates,
  originRemote,
  userName,
  initialsOf,
  authors,
} from './git.js';
import {
  configPath,
  dashboardPath,
  defaultConfig,
  readConfig,
  writeConfig,
  ensureGitignoreEntry,
  DASHBOARD_IGNORE_LINE,
} from './config.js';
import { deriveFamilies, isCandidate } from './families.js';
import { stalenessOf } from './staleness.js';
import { readRecord, renderEntry, slugify, entryFileName, isParticipant } from './record.js';
import { buildDashboardData, renderDashboard, describeRepo } from './render.js';
import { openFile } from './opener.js';

const NOT_A_REPO = [
  'This is not a git work tree.',
  'canon reads a repository to find prototypes, so run it inside one.',
].join('\n');

const NOT_SET_UP = 'No .canon/config.json here. Run canon init first.';

/**
 * The refusal, in one place so index and open say the same thing.
 *
 * Choosing which branches are prototypes is the one judgement this tool will
 * not make for a person. index refuses to guess it; open has to refuse the same
 * way, or the refusal is cosmetic and a person sees a dashboard of everything
 * and reasonably believes they chose it.
 */
function unchosenMessage(count, defaultBranch) {
  return [
    `${count} branches sit beside ${defaultBranch} and none are chosen yet.`,
    'Choosing is a call for a person to make, so this run will not guess.',
    'Run canon index again in a terminal, or canon index --all to take every branch.',
  ].join('\n');
}

/**
 * Today, in the calendar the machine is in.
 *
 * Both sides of a staleness number have to be the same calendar. git reports a
 * commit date in local time, so reading the clock in UTC puts the tool a day
 * out for the hours between local midnight and UTC midnight: a commit made
 * minutes ago reads as made tomorrow. Built from the local parts rather than
 * from an ISO string, which is always UTC.
 */
export function today(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The repository a command is about, or a message saying why there is none.
 * One rev-parse answers both halves, so this costs one process rather than two.
 */
function locate(io) {
  const found = locateRepo(io.cwd);
  if (!found.isWorkTree) {
    io.err(NOT_A_REPO);
    return null;
  }
  return found.root;
}

/**
 * One readline for a whole command. A fresh interface per question would take
 * the input stream with it when it closed, so the second question would never
 * be answered.
 */
function prompter(io) {
  let rl = null;
  return {
    async ask(question) {
      if (!rl) rl = createInterface({ input: io.stdin, output: io.stdout });
      return (await rl.question(question)).trim();
    },
    close() {
      if (rl) rl.close();
    },
  };
}

export async function init(_argv, io) {
  const root = locate(io);
  if (!root) return 1;

  const existing = readConfig(root);
  const branches = listBranches(io.cwd);
  const names = branches.map((b) => b.name);

  if (existing) {
    io.out(`Already set up. ${configPath(root)} is unchanged.`);
    io.out(`Default branch: ${existing.defaultBranch}.`);
    io.out(
      existing.prototypes === null
        ? 'No prototypes chosen yet. Run canon index to choose.'
        : `${existing.prototypes.length} branches selected as prototypes.`,
    );
    return 0;
  }

  const config = defaultConfig({
    repo: repoName(io.cwd),
    defaultBranch: pickDefaultBranch(names, currentBranch(io.cwd)),
  });
  writeConfig(root, config);
  const ignore = ensureGitignoreEntry(root, DASHBOARD_IGNORE_LINE);

  io.out(`Wrote ${configPath(root)}.`);
  io.out(`Default branch read as ${config.defaultBranch}.`);
  io.out(
    ignore === 'present'
      ? `.gitignore already covers ${DASHBOARD_IGNORE_LINE}.`
      : `Added ${DASHBOARD_IGNORE_LINE} to .gitignore.`,
  );
  io.out('');
  io.out('Next: canon index to choose which branches are prototypes.');
  return 0;
}

/** How many leading path segments two branch names have in common. */
export function sharedSegments(a, b) {
  const left = a.split('/');
  const right = b.split('/');
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared += 1;
  return shared;
}

/**
 * The tree as indented text.
 *
 * Indentation is measured from the shallowest node in the family, not from the
 * first one after sorting. A configured familyRoot can put a shallow root after
 * a deeper child, and subtracting the first node's depth then asks repeat for a
 * negative count, which throws instead of printing.
 */
/**
 * An answer to the numbered list, read as numbers and ranges.
 *
 * A person facing twenty one branches types `1-12`, not twelve numbers. The
 * first version read only single numbers, so `1-12` became NaN, was silently
 * dropped, and the run recorded a selection of nothing as though it had been
 * chosen. Anything not understood comes back in `bad` rather than vanishing,
 * so the caller can say what it could not read instead of guessing.
 *
 * @returns {{picked: number[], bad: string[]}} one based positions, and the
 *   tokens that were not numbers, not ranges, or outside the list
 */
export function parseSelection(answer, count) {
  const picked = new Set();
  const bad = [];
  const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= count;

  for (const token of String(answer).split(/[\s,]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)(?:-|\.\.)(\d+)$/);
    if (range) {
      // A person who types 12-1 means the same span as 1-12.
      const from = Number(range[1]);
      const to = Number(range[2]);
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      if (!inRange(low) || !inRange(high)) {
        bad.push(token);
        continue;
      }
      for (let n = low; n <= high; n += 1) picked.add(n);
      continue;
    }
    if (/^\d+$/.test(token) && inRange(Number(token))) {
      picked.add(Number(token));
      continue;
    }
    bad.push(token);
  }

  return { picked: [...picked].sort((a, b) => a - b), bad };
}

/**
 * Names that are almost always machinery rather than somebody's prototype.
 *
 * D-22 says never assume, so none of these are filtered out: a worktree branch
 * may well be the work. They are moved to the end of the numbered list under a
 * caption instead, so a person reading twenty one lines can skip them by eye
 * and still choose one by number if it is the one they want.
 */
const LIKELY_TOOLING = [/^worktree-agent-/, /^dependabot\//, /^renovate\//];

export function isLikelyTooling(name) {
  return LIKELY_TOOLING.some((pattern) => pattern.test(name));
}

/** The candidates in the order they are shown, and where the tooling starts. */
export function orderCandidates(candidates) {
  const work = candidates.filter((b) => !isLikelyTooling(b.name));
  const tooling = candidates.filter((b) => isLikelyTooling(b.name));
  return { list: [...work, ...tooling], firstTooling: tooling.length ? work.length : -1 };
}

function branchTable(families) {
  const rows = families.flatMap((family) => {
    const base = family.nodes.reduce((least, node) => Math.min(least, node.depth), Infinity);
    return family.nodes.map((node) => [
      `${'  '.repeat(Math.max(0, node.depth - base))}${node.label}`,
      node.name,
      node.lastCommit || '',
      node.staleness.label,
    ]);
  });
  const widths = [0, 1, 2].map((column) =>
    rows.reduce((max, row) => Math.max(max, row[column].length), 0),
  );
  return rows.map(
    (row) =>
      `  ${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padEnd(widths[2])}  ${row[3]}`,
  );
}

export async function index(argv, io) {
  const root = locate(io);
  if (!root) return 1;
  const config = readConfig(root);
  if (!config) {
    io.err(NOT_SET_UP);
    return 1;
  }

  const branches = listBranches(io.cwd);
  const names = branches.map((b) => b.name);
  const defaultBranch = pickDefaultBranch(names, currentBranch(io.cwd));
  const candidates = branches.filter((b) => isCandidate(b, defaultBranch));

  if (!candidates.length) {
    io.out(`Only ${defaultBranch} is here, and the default branch is never a prototype.`);
    return 0;
  }

  // --choose sets the stored selection aside and asks again, which is the only
  // way back out of a choice made once. It never edits the config on its own:
  // a run that fails to land on an answer leaves the old selection in place.
  let selection = argv.choose ? null : config.prototypes;
  // Adoption applies to a selection carried over from an earlier run. A choice
  // made on this run is honoured exactly as it was made.
  let chosenNow = false;

  // Said out loud rather than assumed. A tool that quietly reuses a decision
  // made a week ago looks broken when the decision was wrong, so the run names
  // what it is reusing and how to change it.
  if (!argv.all && selection !== null && selection.length) {
    io.out(
      `Using ${selection.length} branches chosen on ${config.indexedAt || 'an earlier run'}. ` +
        'Run canon index --choose to pick again.',
    );
  }

  if (argv.all) {
    selection = candidates.map((b) => b.name);
    chosenNow = true;
    io.out(`Selected all ${selection.length} branches beside ${defaultBranch}.`);
  } else if (selection === null && candidates.length === 1) {
    selection = [candidates[0].name];
    chosenNow = true;
    io.out(`One branch beside ${defaultBranch}, so it is the prototype: ${selection[0]}.`);
  } else if (selection === null) {
    if (!io.interactive) {
      io.err(unchosenMessage(candidates.length, defaultBranch));
      return 1;
    }
    const { list, firstTooling } = orderCandidates(candidates);
    io.out(`Branches beside ${defaultBranch}:`);
    list.forEach((b, i) => {
      if (i === firstTooling) {
        io.out('');
        io.out('  likely tooling');
      }
      io.out(`  ${String(i + 1).padStart(3)}  ${b.name.padEnd(40)} ${b.lastCommit}`);
    });
    io.out('');

    const prompt = prompter(io);
    let answer = null;
    let picked = null;
    try {
      // Three tries. An answer that parsed to nothing is not a choice, so it is
      // never recorded as one: the loop says what it could not read and asks
      // again, and a run that never lands on an answer fails rather than
      // writing an empty selection and calling it done.
      for (let attempt = 0; attempt < 3 && picked === null; attempt += 1) {
        answer = await prompt.ask('Which are prototypes? Numbers, ranges like 1-12, or all: ');
        if (answer.trim().toLowerCase() === 'all') {
          picked = list.map((b) => b.name);
          break;
        }
        if (answer.trim() === '') {
          io.out('Did not understand: an empty answer. Numbers, ranges like 1-12, or all.');
          continue;
        }
        const read = parseSelection(answer, list.length);
        if (read.bad.length || !read.picked.length) {
          const named = read.bad.length ? read.bad.join(' ') : answer.trim();
          io.out(`Did not understand: ${named}. Numbers, ranges like 1-12, or all.`);
          continue;
        }
        picked = read.picked.map((n) => list[n - 1].name);
      }
    } finally {
      prompt.close();
    }

    if (picked === null) {
      io.err('Nothing was selected, so nothing was written. Run canon index again when you know.');
      return 1;
    }
    chosenNow = true;
    selection = picked;
    io.out(`Selected ${selection.length} of ${candidates.length}.`);
  }

  // A variant of a family already chosen is a prototype by construction, so it
  // joins without asking. Sharing a family means sharing at least two leading
  // segments, which is where a root sits. Sharing only the first segment is
  // sharing a filing convention, so an unrelated new branch is only reported.
  const chosen = new Set(selection || []);
  const adopted = chosenNow
    ? []
    : candidates
        .filter((b) => !chosen.has(b.name))
        .filter((b) => [...chosen].some((other) => sharedSegments(b.name, other) >= 2))
        .map((b) => b.name);
  for (const name of adopted) chosen.add(name);
  if (adopted.length) io.out(`Adopted ${adopted.length} new variants of branches already selected.`);

  const unselected = candidates.filter((b) => !chosen.has(b.name));
  selection = candidates.filter((b) => chosen.has(b.name)).map((b) => b.name);

  const families = deriveFamilies(branches, {
    defaultBranch,
    selected: selection,
    familyRoots: config.familyRoots || {},
  }).map((family) => ({
    ...family,
    nodes: family.nodes.map((node) => ({
      ...node,
      staleness: stalenessOf(node.lastCommit || today(), today()),
    })),
  }));

  writeConfig(root, {
    ...config,
    defaultBranch,
    prototypes: selection,
    indexedAt: today(),
  });

  io.out('');
  io.out(`${families.length} families, ${selection.length} branches.`);
  for (const line of branchTable(families)) io.out(line);

  if (unselected.length) {
    io.out('');
    io.out(`${unselected.length} branches are not indexed: ${unselected.map((b) => b.name).join(', ')}.`);
    io.out('Run canon index --all to take every branch.');
  }
  // The next step depends on the result. A run that indexed nothing has nothing
  // to draw, so pointing at canon open would be reporting success for it.
  io.out('');
  if (!selection.length) {
    io.err('Nothing is indexed, so there is nothing to draw. Run canon index again to choose.');
    return 1;
  }
  io.out('Next: canon open to draw the dashboard.');
  return 0;
}

export async function note(argv, io) {
  const root = locate(io);
  if (!root) return 1;
  const config = readConfig(root);
  if (!config) {
    io.err(NOT_SET_UP);
    return 1;
  }

  let about = argv.about;
  let said = argv.said;
  let who = argv.as || '';

  if ((!about || !said) && !io.interactive) {
    io.err(
      [
        'canon note needs a topic and a quote.',
        'Run it in a terminal to be asked, or pass both:',
        '  canon note --about "review surface" --said "the quote, word for word"',
      ].join('\n'),
    );
    return 1;
  }

  // Only what is missing is asked for. A prompt for a value already on the
  // command line is a question with a known answer, and it stops a scripted run
  // that happens to have a terminal attached. With the topic and the quote both
  // supplied there is nothing left to ask: the participant code is optional, so
  // its absence is an answer rather than a gap.
  const missing = !about || !said;
  if (io.interactive && missing) {
    const prompt = prompter(io);
    try {
      if (!about) about = await prompt.ask('About, one topic: ');
      if (!said) said = await prompt.ask('Said, word for word: ');
      if (!who) who = await prompt.ask('Participant code, P-nn, or blank to leave it open: ');
    } finally {
      prompt.close();
    }
  }

  if (!about || !said) {
    io.err('An entry needs a topic and a quote. Nothing was written.');
    return 1;
  }

  // Never invent a name. A code that is not a P code is refused rather than
  // corrected, because the record's identity hygiene is the whole point.
  const participants = [];
  if (who) {
    if (!isParticipant(who)) {
      io.err(`${who} is not a participant code. Entries take P codes such as P-01.`);
      return 1;
    }
    participants.push(who);
  }

  const dir = join(root, config.recordDir || '.strata');
  mkdirSync(dir, { recursive: true });
  const date = today();
  const file = entryFileName(date, slugify(about), readdirSync(dir));
  const path = join(dir, file);
  writeFileSync(path, renderEntry({ date, about: [slugify(about)], participants, said }));

  io.out(`Wrote ${path}.`);
  io.out(
    participants.length
      ? `Filed under ${slugify(about)} for ${participants[0]}.`
      : `Filed under ${slugify(about)} with no participant code yet.`,
  );
  io.out('Meant and Decided are left for a person to fill in.');
  return 0;
}

export async function open(argv, io) {
  const root = locate(io);
  if (!root) return 1;
  const config = readConfig(root);
  if (!config) {
    io.err(NOT_SET_UP);
    return 1;
  }

  const branches = listBranches(io.cwd);
  const defaultBranch = config.defaultBranch || pickDefaultBranch(branches.map((b) => b.name), currentBranch(io.cwd));

  // Nobody has chosen yet. One candidate is not a choice, so take it as index
  // does; more than one is, so refuse in the same words rather than guess.
  let selected = config.prototypes;
  if (selected === null) {
    const candidates = branches.filter((b) => isCandidate(b, defaultBranch)).map((b) => b.name);
    if (candidates.length > 1) {
      io.err(unchosenMessage(candidates.length, defaultBranch));
      return 1;
    }
    selected = candidates;
  }

  // One log call for every fork date, rather than one per branch.
  const forked = forkDates(selected, defaultBranch, io.cwd);

  const entries = readRecord(join(root, config.recordDir || '.strata'));
  const data = buildDashboardData({
    repo: config.repo || repoName(io.cwd),
    defaultBranch,
    branches,
    // The resolved selection, so the page draws what was chosen rather than
    // reading the null again and falling back to everything.
    config: { ...config, prototypes: selected },
    entries,
    generatedAt: today(),
    root,
    forkDates: forked,
    // Facts about this machine, read locally and written into a local file.
    remote: originRemote(io.cwd),
    viewer: (() => {
      const name = userName(io.cwd);
      return name ? { name, initials: initialsOf(name) } : null;
    })(),
    people: authors(io.cwd),
    description: describeRepo(root),
  });

  const target = dashboardPath(root);
  mkdirSync(join(root, '.canon'), { recursive: true });
  writeFileSync(target, renderDashboard(data));

  io.out(`Wrote ${target}.`);
  io.out(
    `${data.counts.families} families, ${data.counts.branches} branches, ${data.counts.entries} entries, ${data.counts.open} open.`,
  );

  if (argv.noOpen) {
    io.out('Left it closed. Open the file yourself when you want it.');
    return 0;
  }
  openFile(target);
  io.out('Opened it with the platform viewer.');
  return 0;
}

export const USAGE = [
  'canon keeps a local index of the prototype branches in a repository and the',
  'feedback record beside them, and draws both into one HTML file.',
  '',
  'Usage: canon <command> [options]',
  '',
  '  init                 set up .canon in this repository',
  '  index                read branches, derive families, record the selection',
  '    --all              take every branch beside the default, no questions',
  '    --choose           set the recorded selection aside and pick again',
  '  note                 file a record entry',
  '    --about <topic>    the question the entry is evidence about',
  '    --said <quote>     the words, verbatim',
  '    --as <P-nn>        the participant code, if there is one',
  '  open [--no-open]     draw the dashboard and show it',
  '  mcp [--dev [--dev-port N]]  serve Canon to an agent over stdio (MCP)',
  '',
  '  --help               this text',
  '  --version            the version',
  '',
  'It reads git and never writes to it. Nothing leaves the machine.',
].join('\n');
