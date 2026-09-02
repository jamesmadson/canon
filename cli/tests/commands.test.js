import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { main, parseArgv } from '../bin/canon.js';
import { sharedSegments, parseSelection, orderCandidates } from '../src/commands.js';
import { openerFor } from '../src/opener.js';

const binPath = fileURLToPath(new URL('../bin/canon.js', import.meta.url));

/**
 * A scratch repository, built with real git so the read only wrappers are
 * exercised against a real work tree. This is test scaffolding: the shipped
 * code never runs any of these commands, which the git suite enforces.
 */
function scratchRepo(branches) {
  const root = mkdtempSync(join(tmpdir(), 'canon-repo-'));
  const run = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  run(['init', '--initial-branch=main']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'Test']);
  writeFileSync(join(root, 'README.md'), 'scratch\n');
  run(['add', '.']);
  run(['commit', '-m', 'first']);
  for (const name of branches) {
    run(['branch', name]);
  }
  return root;
}

/**
 * A command runs against an io object rather than the process, so a test can
 * read what was printed and, where a command asks a question, answer it with a
 * scripted stream instead of a person.
 *
 * The answers are typed in reply to the prompt rather than queued ahead of it:
 * every write to the output stream is a question going out, so the next answer
 * goes back in. Queuing them all up front would let readline see later lines
 * while only the first question was waiting, and drop them.
 */
function capture(cwd, { answers = null } = {}) {
  const out = [];
  const err = [];
  const input = new PassThrough();
  let asked = 0;
  const output = new Writable({
    write(_chunk, _encoding, done) {
      if (answers && asked < answers.length) {
        const answer = answers[asked];
        asked += 1;
        setImmediate(() => input.write(`${answer}\n`));
      }
      done();
    },
  });
  return {
    cwd,
    interactive: answers !== null,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    stdout: output,
    stdin: answers === null ? process.stdin : input,
    text: () => out.join('\n'),
    errors: () => err.join('\n'),
  };
}

describe('parseArgv', () => {
  it('reads the command and its flags', () => {
    expect(parseArgv(['index', '--all'])).toMatchObject({ command: 'index', all: true });
    expect(parseArgv(['open', '--no-open'])).toMatchObject({ command: 'open', noOpen: true });
    expect(parseArgv(['note', '--about', 'a b', '--said', 'c d'])).toMatchObject({
      command: 'note',
      about: 'a b',
      said: 'c d',
    });
  });

  it('names an option it does not know rather than ignoring it', () => {
    expect(parseArgv(['index', '--wat']).unknown).toBe('--wat');
  });

  it('reads help and version from either spelling', () => {
    expect(parseArgv(['--help']).help).toBe(true);
    expect(parseArgv(['-v']).version).toBe(true);
  });
});

describe('canon with no command', () => {
  it('prints usage', async () => {
    const io = capture(process.cwd());
    const code = await main([], io);
    expect(code).toBe(1);
    expect(io.text()).toContain('Usage: canon <command>');
  });

  it('prints usage for --help and exits clean', async () => {
    const io = capture(process.cwd());
    expect(await main(['--help'], io)).toBe(0);
    expect(io.text()).toContain('index [--all]');
  });

  it('prints a version', async () => {
    const io = capture(process.cwd());
    expect(await main(['--version'], io)).toBe(0);
    expect(io.text()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('names an unknown command', async () => {
    const io = capture(process.cwd());
    expect(await main(['sync'], io)).toBe(1);
    expect(io.errors()).toContain('sync is not a command');
  });
});

describe('outside a git work tree', () => {
  it('says so plainly for every command', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'canon-bare-'));
    for (const command of ['init', 'index', 'note', 'open']) {
      const io = capture(bare);
      expect(await main([command], io)).toBe(1);
      expect(io.errors()).toContain('not a git work tree');
    }
  });
});

describe('init', () => {
  let root;
  beforeEach(() => {
    root = scratchRepo(['proto/ring']);
  });

  it('writes the config and the ignore line and says what to run next', async () => {
    const io = capture(root);
    expect(await main(['init'], io)).toBe(0);
    expect(existsSync(join(root, '.canon', 'config.json'))).toBe(true);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('.canon/dashboard.html');
    expect(io.text()).toContain('Next: canon index');
  });

  it('changes nothing the second time and says so', async () => {
    await main(['init'], capture(root));
    const before = readFileSync(join(root, '.canon', 'config.json'), 'utf8');
    const ignoreBefore = readFileSync(join(root, '.gitignore'), 'utf8');
    const io = capture(root);
    expect(await main(['init'], io)).toBe(0);
    expect(io.text()).toContain('Already set up');
    expect(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(ignoreBefore);
  });

  it('never rewrites the ignore lines already there', async () => {
    writeFileSync(join(root, '.gitignore'), 'node_modules/\ndist/\n');
    await main(['init'], capture(root));
    const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(lines[0]).toBe('node_modules/');
    expect(lines[1]).toBe('dist/');
  });
});

describe('index', () => {
  it('asks for init first', async () => {
    const io = capture(scratchRepo([]));
    expect(await main(['index'], io)).toBe(1);
    expect(io.errors()).toContain('canon init first');
  });

  it('will not guess a selection when it cannot ask', async () => {
    const root = scratchRepo(['proto/ring', 'feat/x', 'spike/y']);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['index'], io)).toBe(1);
    expect(io.errors()).toContain('--all');
  });

  it('takes every branch with --all and records the selection', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt', 'feat/x']);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['index', '--all'], io)).toBe(0);
    const config = JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8'));
    expect(config.prototypes.sort()).toEqual(['feat/x', 'proto/ring/alt', 'proto/ring/base']);
    expect(io.text()).toContain('2 families, 3 branches');
  });

  it('takes the only branch beside the default without asking', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['index'], io)).toBe(0);
    expect(io.text()).toContain('so it is the prototype');
  });

  it('says nothing is here when only the default branch exists', async () => {
    const root = scratchRepo([]);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['index'], io)).toBe(0);
    expect(io.text()).toContain('never a prototype');
  });

  it('respects the recorded selection on a later run', async () => {
    const root = scratchRepo(['proto/ring', 'feat/x']);
    await main(['init'], capture(root));
    const path = join(root, '.canon', 'config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...config, prototypes: ['proto/ring'] }, null, 2));
    const io = capture(root);
    expect(await main(['index'], io)).toBe(0);
    expect(JSON.parse(readFileSync(path, 'utf8')).prototypes).toEqual(['proto/ring']);
    expect(io.text()).toContain('1 branches are not indexed: feat/x');
  });

  it('adopts a new variant that shares a family with one already selected', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt']);
    await main(['init'], capture(root));
    const path = join(root, '.canon', 'config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...config, prototypes: ['proto/ring/base'] }, null, 2));
    const io = capture(root);
    await main(['index'], io);
    expect(io.text()).toContain('Adopted 1 new variants');
    expect(JSON.parse(readFileSync(path, 'utf8')).prototypes.sort()).toEqual([
      'proto/ring/alt',
      'proto/ring/base',
    ]);
  });

  it('does not adopt a branch that only shares the filing namespace', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/other-thing']);
    await main(['init'], capture(root));
    const path = join(root, '.canon', 'config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...config, prototypes: ['proto/ring/base'] }, null, 2));
    const io = capture(root);
    await main(['index'], io);
    expect(io.text()).toContain('not indexed: proto/other-thing');
    expect(JSON.parse(readFileSync(path, 'utf8')).prototypes).toEqual(['proto/ring/base']);
  });
});

describe('the branch table', () => {
  /**
   * A configured familyRoot can put a shallow root after a deeper child once
   * the nodes are sorted by name. Indenting from the first node then asks for a
   * negative number of spaces, which throws rather than printing a table.
   */
  it('indents from the shallowest node when the root sorts after its child', async () => {
    const root = scratchRepo(['proto/zz', 'proto/aa/x']);
    await main(['init'], capture(root));
    const path = join(root, '.canon', 'config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
      path,
      JSON.stringify(
        { ...config, prototypes: ['proto/zz', 'proto/aa/x'], familyRoots: { 'proto/aa/x': 'proto/zz' } },
        null,
        2,
      ),
    );

    const io = capture(root);
    expect(await main(['index'], io)).toBe(0);
    const lines = io
      .text()
      .split('\n')
      .filter((line) => line.includes('proto/'));
    const zz = lines.find((line) => line.includes('proto/zz'));
    const child = lines.find((line) => line.includes('proto/aa/x'));
    // The root sits flush and the child sits one step in, whatever the sort did.
    expect(zz.startsWith('  zz')).toBe(true);
    expect(child.startsWith('    x')).toBe(true);
  });
});

describe('index, asked rather than told', () => {
  it('lists the branches and takes the numbers chosen', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt', 'feat/x']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['1 2'] });
    expect(await main(['index'], io)).toBe(0);
    expect(io.text()).toContain('Branches beside main');
    expect(io.text()).toContain('Selected 2 of 3');
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toEqual([
      'feat/x',
      'proto/ring/alt',
    ]);
  });

  it('takes every branch when the answer is all', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt', 'feat/x']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['all'] });
    await main(['index'], io);
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toHaveLength(3);
  });
});

describe('parseSelection', () => {
  it('reads single numbers', () => {
    expect(parseSelection('1 3', 5)).toEqual({ picked: [1, 3], bad: [] });
  });

  it('reads a range written with a dash or with dots', () => {
    expect(parseSelection('1-4', 9).picked).toEqual([1, 2, 3, 4]);
    expect(parseSelection('1..4', 9).picked).toEqual([1, 2, 3, 4]);
  });

  it('reads a mixed list separated by spaces or commas', () => {
    expect(parseSelection('1-4 7 9-12', 12).picked).toEqual([1, 2, 3, 4, 7, 9, 10, 11, 12]);
    expect(parseSelection('1-3,5', 12).picked).toEqual([1, 2, 3, 5]);
  });

  it('sorts and de-duplicates overlapping ranges', () => {
    expect(parseSelection('3 1-3 2', 5).picked).toEqual([1, 2, 3]);
  });

  it('reads a descending range as the same span', () => {
    expect(parseSelection('4-1', 9).picked).toEqual([1, 2, 3, 4]);
  });

  it('names a token it did not understand rather than dropping it', () => {
    expect(parseSelection('1 wat 3', 5)).toEqual({ picked: [1, 3], bad: ['wat'] });
  });

  it('names a number outside the list the same way', () => {
    expect(parseSelection('1 99', 5)).toEqual({ picked: [1], bad: ['99'] });
    expect(parseSelection('0', 5).bad).toEqual(['0']);
    expect(parseSelection('1-99', 5).bad).toEqual(['1-99']);
  });
});

describe('index, when the answer is not understood', () => {
  const branches = ['a-one', 'b-two', 'c-three'];

  it('takes a range, which is what a person types for a long list', async () => {
    const root = scratchRepo(branches);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['1-2'] });
    expect(await main(['index'], io)).toBe(0);
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toEqual([
      'a-one',
      'b-two',
    ]);
  });

  it('says which tokens it did not understand and asks again', async () => {
    const root = scratchRepo(branches);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['wat', '1'] });
    expect(await main(['index'], io)).toBe(0);
    expect(io.text()).toContain('Did not understand: wat');
    expect(io.text()).toContain('Numbers, ranges like 1-12, or all');
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toEqual([
      'a-one',
    ]);
  });

  /**
   * The tester's run wrote prototypes: [] from a typo and then said "Next:
   * canon open", so the tool reported success for having understood nothing.
   */
  it('never writes an empty selection from an answer it could not read', async () => {
    const root = scratchRepo(branches);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['wat', 'nope', 'still-wrong'] });
    expect(await main(['index'], io)).toBe(1);
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toBe(null);
    expect(io.text()).not.toContain('Next: canon open');
  });

  it('gives up after three tries rather than asking forever', async () => {
    const root = scratchRepo(branches);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['wat', 'nope', 'still-wrong'] });
    await main(['index'], io);
    expect(io.text().match(/Did not understand/g)).toHaveLength(3);
  });

  it('does not read an empty answer as every branch, and says the next step only on success', async () => {
    const root = scratchRepo(branches);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['', '', ''] });
    expect(await main(['index'], io)).toBe(1);
    expect(io.text()).toContain('an empty answer');
    expect(io.text()).not.toContain('Next: canon open');
    expect(io.errors()).toContain('Nothing was selected');
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toBe(null);
  });
});

describe('index with an empty selection already recorded', () => {
  it('says there is nothing to draw rather than pointing at canon open', async () => {
    const root = scratchRepo(['proto/ring', 'feat/x']);
    await main(['init'], capture(root));
    const path = join(root, '.canon', 'config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...config, prototypes: [] }, null, 2));
    const io = capture(root);
    expect(await main(['index'], io)).toBe(1);
    expect(io.text()).not.toContain('Next: canon open');
    expect(io.errors()).toContain('nothing to draw');
  });
});

describe('orderCandidates', () => {
  it('keeps the order given, then the likely tooling, and says where the cut is', () => {
    const ordered = orderCandidates([
      { name: 'worktree-agent-a' },
      { name: 'proto/ring' },
      { name: 'dependabot/x' },
      { name: 'renovate/y' },
      { name: 'feat/z' },
    ]);
    expect(ordered.list.map((b) => b.name)).toEqual([
      'proto/ring',
      'feat/z',
      'worktree-agent-a',
      'dependabot/x',
      'renovate/y',
    ]);
    expect(ordered.firstTooling).toBe(2);
  });

  it('reports no cut when nothing looks like tooling', () => {
    expect(orderCandidates([{ name: 'a' }, { name: 'b' }]).firstTooling).toBe(-1);
  });
});

describe('the numbered list of branches', () => {
  /**
   * D-22: never assume. A worktree branch may well be the prototype, so it is
   * listed and selectable. It is moved to the end under a caption so a person
   * reading twenty one lines can skip the machinery by eye.
   */
  it('puts likely tooling branches last, under a caption', async () => {
    const root = scratchRepo([
      'worktree-agent-abc',
      'proto/ring',
      'dependabot/npm_and_yarn/x',
      'renovate/y',
      'feat/real',
    ]);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['1'] });
    await main(['index'], io);
    const lines = io.text().split('\n');
    const caption = lines.findIndex((line) => line.includes('likely tooling'));
    expect(caption).toBeGreaterThan(-1);
    const before = lines.slice(0, caption).join('\n');
    const after = lines.slice(caption).join('\n');
    expect(before).toContain('proto/ring');
    expect(before).toContain('feat/real');
    expect(after).toContain('worktree-agent-abc');
    expect(after).toContain('dependabot/npm_and_yarn/x');
    expect(after).toContain('renovate/y');
    // Still numbered in one sequence, and still choosable.
    expect(io.text()).toMatch(/\n\s*1\s+feat\/real/);
  });

  it('keeps the numbers matching the branches they are printed beside', async () => {
    const root = scratchRepo(['worktree-agent-abc', 'proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['2'] });
    await main(['index'], io);
    expect(JSON.parse(readFileSync(join(root, '.canon', 'config.json'), 'utf8')).prototypes).toEqual([
      'worktree-agent-abc',
    ]);
  });
});

describe('note, asked rather than told', () => {
  it('asks for the topic, the quote and the code', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['review surface', 'the quote, word for word', 'P-09'] });
    expect(await main(['note'], io)).toBe(0);
    const files = readdirSync(join(root, '.strata'));
    const text = readFileSync(join(root, '.strata', files[0]), 'utf8');
    expect(text).toContain('participants: [P-09]');
    expect(text).toContain('> the quote, word for word');
  });

  /**
   * A prompt for something already supplied is a question with a known answer.
   * Under a TTY the old code asked for the participant code even when the topic
   * and the quote came in on the command line, so a scripted run that happened
   * to have a terminal attached would stop and wait.
   */
  it('asks for nothing when the topic and the quote were both supplied', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    // answers: [] means interactive with nothing to say back. Any question here
    // would hang rather than fail, so reaching the assertion is the assertion.
    const io = capture(root, { answers: [] });
    expect(await main(['note', '--about', 'ring', '--said', 'the ring is the thing'], io)).toBe(0);
    const files = readdirSync(join(root, '.strata'));
    expect(readFileSync(join(root, '.strata', files[0]), 'utf8')).toContain('participants: []');
  });

  it('asks only for the value that is missing', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['the quote itself'] });
    expect(await main(['note', '--about', 'ring', '--as', 'P-04'], io)).toBe(0);
    const files = readdirSync(join(root, '.strata'));
    const text = readFileSync(join(root, '.strata', files[0]), 'utf8');
    expect(text).toContain('> the quote itself');
    expect(text).toContain('participants: [P-04]');
  });

  it('leaves the participant open when the answer is blank', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root, { answers: ['topic', 'a quote', ''] });
    await main(['note'], io);
    const files = readdirSync(join(root, '.strata'));
    expect(readFileSync(join(root, '.strata', files[0]), 'utf8')).toContain('participants: []');
  });
});

describe('sharedSegments', () => {
  it('counts the leading segments two names have in common', () => {
    expect(sharedSegments('proto/ring/a', 'proto/ring/b')).toBe(2);
    expect(sharedSegments('proto/ring', 'proto/ring-alt')).toBe(1);
    expect(sharedSegments('feat/x', 'proto/y')).toBe(0);
    expect(sharedSegments('proto/ring', 'proto/ring')).toBe(2);
  });
});

describe('note', () => {
  let root;
  beforeEach(async () => {
    root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
  });

  it('writes an entry in the record shape', async () => {
    const io = capture(root);
    const code = await main(
      ['note', '--about', 'Review surface', '--said', 'the zoomed out view is unsolved', '--as', 'P-21'],
      io,
    );
    expect(code).toBe(0);
    const files = readdirSync(join(root, '.strata'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-review-surface\.md$/);
    const text = readFileSync(join(root, '.strata', files[0]), 'utf8');
    expect(text).toContain('participants: [P-21]');
    expect(text).toContain('about: [review-surface]');
    expect(text).toContain('> the zoomed out view is unsolved');
    expect(text).toContain('## Meant');
    expect(text).toContain('## Decided');
  });

  it('refuses a participant name that is not a P code', async () => {
    const io = capture(root);
    expect(await main(['note', '--about', 't', '--said', 'q', '--as', 'Sam'], io)).toBe(1);
    expect(io.errors()).toContain('P codes');
    expect(existsSync(join(root, '.strata'))).toBe(false);
  });

  it('files without a participant rather than inventing one', async () => {
    await main(['note', '--about', 't', '--said', 'q'], capture(root));
    const files = readdirSync(join(root, '.strata'));
    expect(readFileSync(join(root, '.strata', files[0]), 'utf8')).toContain('participants: []');
  });

  it('numbers a second entry on the same topic and day', async () => {
    await main(['note', '--about', 'ring', '--said', 'one'], capture(root));
    await main(['note', '--about', 'ring', '--said', 'two'], capture(root));
    expect(readdirSync(join(root, '.strata'))).toHaveLength(2);
  });

  it('will not guess a quote when it cannot ask', async () => {
    const io = capture(root);
    expect(await main(['note'], io)).toBe(1);
    expect(io.errors()).toContain('needs a topic and a quote');
  });
});

describe('open', () => {
  it('writes the dashboard and leaves it closed with --no-open', async () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt']);
    await main(['init'], capture(root));
    await main(['index', '--all'], capture(root));
    await main(['note', '--about', 'ring', '--said', 'the ring is the thing', '--as', 'P-01'], capture(root));

    const io = capture(root);
    expect(await main(['open', '--no-open'], io)).toBe(0);
    const html = readFileSync(join(root, '.canon', 'dashboard.html'), 'utf8');
    expect(html).not.toContain('__CANON_DATA__');
    expect(html).not.toMatch(/https?:\/\//);
    expect(io.text()).toContain('Left it closed');
    expect(io.text()).toContain('1 families, 2 branches, 1 entries, 1 open');
  });

  /**
   * index refuses to guess a selection. open drawing every branch instead would
   * make the refusal cosmetic: a person would see a dashboard of everything and
   * reasonably believe they had chosen it.
   */
  it('refuses to guess a selection, in the words index uses', async () => {
    const root = scratchRepo(['proto/ring', 'feat/x', 'spike/y']);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['open', '--no-open'], io)).toBe(1);
    expect(io.errors()).toContain('none are chosen yet');
    expect(io.errors()).toContain('will not guess');
    expect(io.errors()).toContain('--all');
    expect(existsSync(join(root, '.canon', 'dashboard.html'))).toBe(false);
  });

  it('takes the only branch beside the default without being told, as index does', async () => {
    const root = scratchRepo(['proto/ring']);
    await main(['init'], capture(root));
    const io = capture(root);
    expect(await main(['open', '--no-open'], io)).toBe(0);
    expect(io.text()).toContain('1 branches');
  });

  it('touches nothing outside .canon, .gitignore and the record', async () => {
    const root = scratchRepo(['proto/ring']);
    const before = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    expect(before).toBe('');
    await main(['init'], capture(root));
    await main(['index', '--all'], capture(root));
    await main(['open', '--no-open'], capture(root));
    const after = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3));
    expect(after.sort()).toEqual(['.canon/', '.gitignore']);
  });

  it('leaves the checked out branch and the commit count alone', async () => {
    const root = scratchRepo(['proto/ring']);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    await main(['init'], capture(root));
    await main(['index', '--all'], capture(root));
    await main(['open', '--no-open'], capture(root));
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()).toBe(head);
    expect(
      execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    ).toBe(branch);
  });
});

describe('openerFor', () => {
  it('names the platform viewer', () => {
    expect(openerFor('darwin').command).toBe('open');
    expect(openerFor('linux').command).toBe('xdg-open');
    expect(openerFor('win32').command).toBe('cmd');
  });
});

describe('the executable', () => {
  it('runs help without throwing', () => {
    const out = execFileSync('node', [binPath, '--help'], { encoding: 'utf8' });
    expect(out).toContain('Usage: canon');
  });

  /**
   * npm install -g puts a symlink on PATH and points it at the real file inside
   * the global node_modules. Node then reports the symlink as argv[1] while
   * import.meta.url resolves to the real path, so a guard that compares the two
   * as written strings never fires and the whole CLI silently does nothing.
   */
  it('runs when invoked through a symlink, as a global install does', () => {
    const dir = mkdtempSync(join(tmpdir(), 'canon-link-'));
    const link = join(dir, 'canon');
    symlinkSync(binPath, link);
    expect(execFileSync('node', [link, '--version'], { encoding: 'utf8' })).toMatch(
      /^\d+\.\d+\.\d+\n$/,
    );
    expect(execFileSync('node', [link, '--help'], { encoding: 'utf8' })).toContain('Usage: canon');
  });

  it('runs every command end to end in a scratch repository', () => {
    const root = scratchRepo(['proto/ring/base', 'proto/ring/alt']);
    const run = (args) => execFileSync('node', [binPath, ...args], { cwd: root, encoding: 'utf8' });
    expect(run(['init'])).toContain('Next: canon index');
    expect(run(['index', '--all'])).toContain('families');
    expect(run(['note', '--about', 'ring', '--said', 'a quote'])).toContain('Wrote');
    expect(run(['open', '--no-open'])).toContain('Left it closed');
    mkdirSync(join(root, '.canon'), { recursive: true });
  });
});
