import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuildFolder, BUILD_LIMITS } from '../src/mcp/folder.js';

const scratch = () => mkdtempSync(join(tmpdir(), 'canon-folder-'));

function build(files) {
  const dir = scratch();
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const refusal = async (path, limits) => {
  const r = await readBuildFolder(path, limits);
  expect(r.ok).toBe(false);
  return r.message;
};

describe('readBuildFolder refusals', () => {
  it('refuses a path that is not absolute and says how to fix it', async () => {
    const m = await refusal('dist');
    expect(m).toBe('folder must be an absolute path. Pass the full path to the build folder, such as /Users/you/app/dist.');
  });
  it('refuses text that is not a path', async () => {
    expect(await refusal('')).toContain('absolute path');
    expect(await refusal(undefined)).toContain('absolute path');
  });
  it('refuses a folder that does not exist', async () => {
    const m = await refusal(join(scratch(), 'nope'));
    expect(m).toMatch(/^There is no folder at .*nope\. Build the project first, then pass the folder it wrote\.$/);
  });
  it('refuses a file', async () => {
    const dir = build({ 'a.html': '<p>x</p>' });
    const m = await refusal(join(dir, 'a.html'));
    expect(m).toMatch(/is a file, not a folder\. Pass the folder that holds index\.html\.$/);
  });
  it('refuses a folder with no index.html at its top', async () => {
    const dir = build({ 'pages/index.html': '<p>x</p>' });
    const m = await refusal(dir);
    expect(m).toMatch(/has no index\.html at its top\. Run the build and pass its output folder, often dist, build or out\.$/);
  });
  it('refuses more files than the limit and names the limit', async () => {
    const dir = build({ 'index.html': '<p/>', 'a.js': '1', 'b.js': '2' });
    const m = await refusal(dir, { ...BUILD_LIMITS, maxFiles: 2 });
    expect(m).toBe('The build has more than 2 files. Pass a smaller build folder, without files the prototype does not use.');
  });
  it('refuses a build over the size limit and names it', async () => {
    const dir = build({ 'index.html': '<p/>', 'big.bin': 'x'.repeat(2000) });
    const m = await refusal(dir, { ...BUILD_LIMITS, maxBytes: 1000 });
    expect(m).toBe('The build is larger than 1000 bytes. Pass a smaller build folder, or compress large images and videos first.');
  });
  it('states real limits in bytes and files', () => {
    expect(BUILD_LIMITS).toEqual({ maxBytes: 25 * 1024 * 1024, maxFiles: 2000 });
  });
});

describe('readBuildFolder reads', () => {
  it('reads every file with forward-slash paths, sorted, as bytes', async () => {
    const dir = build({ 'index.html': '<h1>Hi</h1>', 'assets/app.js': 'x=1', 'assets/img/a.png': 'png' });
    const r = await readBuildFolder(dir);
    expect(r.ok).toBe(true);
    expect(r.files.map((f) => f.path)).toEqual(['assets/app.js', 'assets/img/a.png', 'index.html']);
    expect(Buffer.from(r.files[2].data).toString()).toBe('<h1>Hi</h1>');
    expect(r.bytes).toBe('<h1>Hi</h1>'.length + 'x=1'.length + 'png'.length);
  });
  it('skips node_modules, dot folders and .DS_Store', async () => {
    const dir = build({ 'index.html': '<p/>', 'node_modules/x/i.js': '1', '.git/HEAD': 'ref', '.cache/a': '1', 'sub/node_modules/y.js': '1', '.DS_Store': 'junk', 'sub/.hidden/z': '1', 'sub/ok.css': 'a{}' });
    const r = await readBuildFolder(dir);
    expect(r.files.map((f) => f.path)).toEqual(['index.html', 'sub/ok.css']);
  });
  it('skips a symbolic link that leaves the folder and keeps one that stays inside', async () => {
    const outside = build({ 'secret.txt': 'secret' });
    const dir = build({ 'index.html': '<p/>', 'real.css': 'a{}' });
    symlinkSync(join(outside, 'secret.txt'), join(dir, 'leak.txt'));
    symlinkSync(outside, join(dir, 'leakdir'));
    symlinkSync(join(dir, 'real.css'), join(dir, 'alias.css'));
    const r = await readBuildFolder(dir);
    expect(r.files.map((f) => f.path)).toEqual(['alias.css', 'index.html', 'real.css']);
    expect(r.skipped).toBe(2);
  });
});
