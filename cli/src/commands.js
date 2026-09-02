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
  isWorkTree,
  repoRoot,
  repoName,
  currentBranch,
  listBranches,
  pickDefaultBranch,
  forkDate,
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
import { deriveFamilies } from './families.js';
import { stalenessOf } from './staleness.js';
import { readRecord, renderEntry, slugify, entryFileName, isParticipant } from './record.js';
import { buildDashboardData, renderDashboard } from './render.js';
import { openFile } from './opener.js';

const NOT_A_REPO = [
  'This is not a git work tree.',
  'canon reads a repository to find prototypes, so run it inside one.',
].join('\n');

const NOT_SET_UP = 'No .canon/config.json here. Run canon init first.';

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** The repository a command is about, or a message saying why there is none. */
function locate(io) {
  if (!isWorkTree(io.cwd)) {
    io.err(NOT_A_REPO);
    return null;
  }
  return repoRoot(io.cwd);
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
  const candidates = branches.filter((b) => b.name !== defaultBranch);

  if (!candidates.length) {
    io.out(`Only ${defaultBranch} is here, and the default branch is never a prototype.`);
    return 0;
  }

  let selection = config.prototypes;
  // Adoption applies to a selection carried over from an earlier run. A choice
  // made on this run is honoured exactly as it was made.
  let chosenNow = false;

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
      io.err(
        [
          `${candidates.length} branches sit beside ${defaultBranch} and none are chosen yet.`,
          'Choosing is a call for a person to make, so this run will not guess.',
          'Run canon index again in a terminal, or canon index --all to take every branch.',
        ].join('\n'),
      );
      return 1;
    }
    io.out(`Branches beside ${defaultBranch}:`);
    candidates.forEach((b, i) => {
      io.out(`  ${String(i + 1).padStart(3)}  ${b.name.padEnd(40)} ${b.lastCommit}`);
    });
    io.out('');
    const prompt = prompter(io);
    let answer;
    try {
      answer = await prompt.ask('Which are prototypes? Numbers separated by spaces, or all: ');
    } finally {
      prompt.close();
    }
    chosenNow = true;
    if (answer.toLowerCase() === 'all' || answer === '') {
      selection = candidates.map((b) => b.name);
    } else {
      selection = answer
        .split(/[\s,]+/)
        .map((token) => candidates[Number(token) - 1])
        .filter(Boolean)
        .map((b) => b.name);
    }
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
  io.out('');
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

  if (io.interactive) {
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

  const forkDates = {};
  const selected = config.prototypes ?? branches.filter((b) => b.name !== defaultBranch).map((b) => b.name);
  for (const name of selected) {
    const date = forkDate(name, defaultBranch, io.cwd);
    if (date) forkDates[name] = date;
  }

  const entries = readRecord(join(root, config.recordDir || '.strata'));
  const data = buildDashboardData({
    repo: config.repo || repoName(io.cwd),
    defaultBranch,
    branches,
    config,
    entries,
    generatedAt: today(),
    root,
    forkDates,
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
  '  index [--all]        read branches, derive families, record the selection',
  '  note                 file a record entry',
  '    --about <topic>    the question the entry is evidence about',
  '    --said <quote>     the words, verbatim',
  '    --as <P-nn>        the participant code, if there is one',
  '  open [--no-open]     draw the dashboard and show it',
  '',
  '  --help               this text',
  '  --version            the version',
  '',
  'It reads git and never writes to it. Nothing leaves the machine.',
].join('\n');
