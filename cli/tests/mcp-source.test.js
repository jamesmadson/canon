import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSource } from '../src/mcp/source.js';

function scratch() {
  return mkdtempSync(join(tmpdir(), 'canon-source-'));
}

function repoWithGit(root, name, { head, config }) {
  const dir = join(root, name);
  mkdirSync(join(dir, '.git'), { recursive: true });
  if (head !== undefined) writeFileSync(join(dir, '.git', 'HEAD'), head);
  if (config !== undefined) writeFileSync(join(dir, '.git', 'config'), config);
  return dir;
}

const originConfig = (url) => `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`;

describe('readSource', () => {
  it('reads branch and repo from an ssh remote', () => {
    const dir = repoWithGit(scratch(), 'checkout', {
      head: 'ref: refs/heads/feature/pricing\n',
      config: originConfig('git@github.com:acme/acme-web.git'),
    });
    expect(readSource(dir)).toEqual({ repo: 'acme-web', branch: 'feature/pricing' });
  });

  it('reads the repo from an https remote without .git', () => {
    const dir = repoWithGit(scratch(), 'x', {
      head: 'ref: refs/heads/main\n',
      config: originConfig('https://github.com/acme/acme-web'),
    });
    expect(readSource(dir).repo).toBe('acme-web');
  });

  it('walks up from a subfolder', () => {
    const dir = repoWithGit(scratch(), 'x', {
      head: 'ref: refs/heads/main\n',
      config: originConfig('https://github.com/acme/acme-web.git'),
    });
    const sub = join(dir, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    expect(readSource(sub)).toEqual({ repo: 'acme-web', branch: 'main' });
  });

  it('gives no branch for a detached HEAD', () => {
    const dir = repoWithGit(scratch(), 'x', {
      head: '0123456789abcdef0123456789abcdef01234567\n',
      config: originConfig('https://github.com/acme/acme-web.git'),
    });
    expect(readSource(dir)).toEqual({ repo: 'acme-web' });
  });

  it('uses the folder name when there is no origin', () => {
    const dir = repoWithGit(scratch(), 'my-folder', { head: 'ref: refs/heads/dev\n', config: '[core]\n\tbare = false\n' });
    expect(readSource(dir)).toEqual({ repo: 'my-folder', branch: 'dev' });
  });

  it('ignores a url under another remote', () => {
    const dir = repoWithGit(scratch(), 'my-folder', {
      head: 'ref: refs/heads/dev\n',
      config: '[remote "upstream"]\n\turl = https://github.com/other/thing.git\n',
    });
    expect(readSource(dir).repo).toBe('my-folder');
  });

  it('uses the folder name when there is no config file', () => {
    const dir = repoWithGit(scratch(), 'bare-ish', { head: 'ref: refs/heads/dev\n' });
    expect(readSource(dir)).toEqual({ repo: 'bare-ish', branch: 'dev' });
  });

  describe('a worktree', () => {
    function worktree(root, { origin }) {
      const main = repoWithGit(root, 'main-checkout', {
        head: 'ref: refs/heads/main\n',
        config: origin ? originConfig(origin) : '[core]\n',
      });
      const gitdir = join(main, '.git', 'worktrees', 'wt');
      mkdirSync(gitdir, { recursive: true });
      writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/feature-x\n');
      writeFileSync(join(gitdir, 'commondir'), '../..\n');
      const wt = join(root, 'wt-folder');
      mkdirSync(wt, { recursive: true });
      writeFileSync(join(wt, '.git'), `gitdir: ${gitdir}\n`);
      return wt;
    }

    it('follows gitdir for HEAD and commondir for config', () => {
      const wt = worktree(scratch(), { origin: 'git@github.com:acme/acme-web.git' });
      expect(readSource(wt)).toEqual({ repo: 'acme-web', branch: 'feature-x' });
    });

    it('uses the folder holding the common git directory when there is no origin', () => {
      const wt = worktree(scratch(), { origin: null });
      expect(readSource(wt)).toEqual({ repo: 'main-checkout', branch: 'feature-x' });
    });
  });

  it('gives an empty object when there is no checkout', () => {
    expect(readSource(scratch())).toEqual({});
  });

  it('never throws', () => {
    const root = scratch();
    const dir = join(root, 'broken');
    mkdirSync(dir);
    writeFileSync(join(dir, '.git'), 'gitdir: /nonexistent/nowhere\n');
    expect(() => readSource(dir)).not.toThrow();
    expect(readSource(join(root, 'does-not-exist'))).toEqual({});
  });
});
