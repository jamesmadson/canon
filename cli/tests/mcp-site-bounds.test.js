import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuildPage, CRAWL_LIMITS } from '../src/mcp/site.js';
import { BUILD_LIMITS } from '../src/mcp/folder.js';

const scratch = () => mkdtempSync(join(tmpdir(), 'canon-bounds-'));

function write(dir, files) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

describe('readBuildPage stays fast and bounded', () => {
  it('reads a file with 200,000 unclosed script tags in well under a second', async () => {
    const junk = '<script>'.repeat(200_000) + '<style>'.repeat(50_000) + '<a "'.repeat(50_000) + '<!-- never closed';
    const dir = write(scratch(), { 'p/index.html': `<img src=/a.png>${junk}`, 'a.png': 'a' });
    const started = Date.now();
    const r = await readBuildPage(dir, 'p/');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r.files.map((f) => f.path)).toEqual(['a.png', 'p/index.html']);
  });

  it('keeps a file over the parse cap without reading it, and says so', async () => {
    const dir = write(scratch(), { 'p/index.html': '<script src=/big.js></script>', 'big.js': 'import "/other.js";' + ' '.repeat(5000), 'other.js': 'x' });
    const r = await readBuildPage(dir, 'p/', BUILD_LIMITS, { ...CRAWL_LIMITS, maxFileBytes: 1000 });
    expect(r.files.map((f) => f.path)).toEqual(['big.js', 'p/index.html']);
    expect(r.report.unparsed).toEqual(['big.js']);
  });

  it('cuts every reported reference to 120 characters', async () => {
    const long = 'x'.repeat(100_000);
    const dir = write(scratch(), { 'p/index.html': `<img src=/${long}.png><img src=https://a.test/${long}><script>fetch("/${long}.json")</script>` });
    const r = await readBuildPage(dir, 'p/');
    for (const list of [r.report.missing, r.report.external, r.report.runtime]) {
      for (const item of list) expect(item.length).toBeLessThanOrEqual(120);
    }
    expect(r.report.missing).toHaveLength(1);
    expect(r.report.external).toHaveLength(1);
  });

  it('counts a file it could not rewrite because it is not UTF-8', async () => {
    const html = Buffer.concat([Buffer.from('<img src=/a.png><p>'), Buffer.from([0xff, 0xfe]), Buffer.from('</p>')]);
    const dir = write(scratch(), { 'p/index.html': html, 'a.png': 'a' });
    const r = await readBuildPage(dir, 'p/');
    expect(r.report.unrewritten).toEqual(['p/index.html']);
    expect(Buffer.from(r.files.find((f) => f.path === 'p/index.html').data).equals(html)).toBe(true);
  });
});

describe('readBuildPage keeps nothing from outside the folder', () => {
  const none = (r) => {
    expect(r.ok).toBe(true);
    expect(r.files.map((f) => f.path)).toEqual(['p/index.html']);
  };
  /** A build folder with a secret file beside it. */
  const site = (files) => {
    const parent = scratch();
    writeFileSync(join(parent, 'secret.jpg'), 'secret');
    mkdirSync(join(parent, 'build'));
    return { parent, dir: write(join(parent, 'build'), files) };
  };

  it('an encoded dot-dot in a reference', async () => {
    const { dir } = site({ 'p/index.html': '<img src="/%2e%2e/secret.jpg"><img src="../%2E%2E/secret.jpg"><img src="%2e%2e/%2e%2e/secret.jpg">' });
    none(await readBuildPage(dir, 'p/'));
  });

  it('a reference that decodes to a path outside the folder', async () => {
    const { dir } = site({ 'p/index.html': '<img src="..%2fsecret.jpg"><img src="/..%2Fsecret.jpg"><img src="/a%2f..%2f..%2fsecret.jpg">' });
    none(await readBuildPage(dir, 'p/'));
  });

  it('a symlinked parent directory that leads out of the folder', async () => {
    const { parent, dir } = site({ 'p/index.html': '<img src=/linked/secret.jpg><img src=/linked/sub/pic.png>' });
    mkdirSync(join(parent, 'sub'));
    writeFileSync(join(parent, 'sub/pic.png'), 'pic');
    symlinkSync(parent, join(dir, 'linked'));
    const r = await readBuildPage(dir, 'p/');
    none(r);
    expect(r.report.missing).toHaveLength(2);
  });
});
