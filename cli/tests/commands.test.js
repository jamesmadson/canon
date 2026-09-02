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
import { sharedSegments } from '../src/commands.js';
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
