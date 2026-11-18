import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuildPage, CRAWL_LIMITS } from '../src/mcp/site.js';
import { BUILD_LIMITS } from '../src/mcp/folder.js';

const scratch = () => mkdtempSync(join(tmpdir(), 'canon-site-'));

function write(dir, files) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const PAGE = `<!doctype html><title>Home D</title>
<link rel="stylesheet" href="/_astro/x.css">
<link rel="canonical" href="/lab/home-d/">
<link rel="icon" href="../../favicon.svg">
<script type="module" src="/_astro/main.js"></script>
<script src="https://cdn.example.com/lib.js"></script>
<img src="/img/a-400.jpg" srcset="/img/a-400.jpg 400w, /img/a-800.jpg 800w" alt="">
<img src="data:image/png;base64,AAAA" alt="">
<img src="/img/missing.png" alt="">
<img src="/img/leak.jpg" alt="">
<img src="/node_modules/pkg/pic.png" alt="">
<a href="/other/">Other page</a>
<style>.hero { background: url(/img/bg.png) }</style>
<div style="background-image: url('/img/inline.png')"></div>
<video poster="//cdn.example.com/p.jpg"></video>`;

/** A built site with one page, the files it needs, and files it does not. */
function site() {
  const outside = write(scratch(), { 'secret.jpg': 'secret' });
  const dir = write(scratch(), {
    'index.html': '<p>The home page, not needed.</p>',
    'lab/home-d/index.html': PAGE,
    'favicon.svg': '<svg/>',
    '_astro/x.css': '@import "./y.css";\n@font-face { font-family: A; src: url(/fonts/a.woff2) format("woff2"); }\n.b { background: url("../img/b.jpg") }\n/* url(/not-used.png) */',
    '_astro/y.css': 'body { margin: 0 }',
    '_astro/main.js': 'import "./chunk.js";import{a}from"/_astro/chunk2.js";const m=()=>import("./lazy.js");const u=new URL("/img/u.png",import.meta.url);import "react";fetch("/data/runtime.json");',
    '_astro/chunk.js': 'export const c = 1;',
    '_astro/chunk2.js': 'export const a = 2;',
    '_astro/lazy.js': 'export default 3;',
    '_astro/unused.js': 'export default 4;',
    'fonts/a.woff2': 'font',
    'img/a-400.jpg': 'a4',
    'img/a-800.jpg': 'a8',
    'img/b.jpg': 'b',
    'img/bg.png': 'bg',
    'img/inline.png': 'in',
    'img/u.png': 'u',
    'img/unused.png': 'unused',
    'data/runtime.json': '{}',
    'other/index.html': '<p>Another page</p>',
    'node_modules/pkg/pic.png': 'no',
  });
  symlinkSync(join(outside, 'secret.jpg'), join(dir, 'img/leak.jpg'));
  return dir;
}

const text = (r, path) => Buffer.from(r.files.find((f) => f.path === path).data).toString('utf8');

describe('readBuildPage keeps one page and what it needs', () => {
  it('keeps exactly the files the page reaches', async () => {
    const r = await readBuildPage(site(), 'lab/home-d/');
    expect(r.ok).toBe(true);
    expect(r.entry).toBe('lab/home-d/index.html');
    expect(r.files.map((f) => f.path)).toEqual([
      '_astro/chunk.js', '_astro/chunk2.js', '_astro/lazy.js', '_astro/main.js', '_astro/x.css', '_astro/y.css',
      'favicon.svg', 'fonts/a.woff2', 'img/a-400.jpg', 'img/a-800.jpg', 'img/b.jpg', 'img/bg.png', 'img/inline.png', 'img/u.png',
      'lab/home-d/index.html',
    ]);
    expect(r.bytes).toBe(r.files.reduce((n, f) => n + f.data.length, 0));
  });

  it('counts what it could not keep', async () => {
    const r = await readBuildPage(site(), 'lab/home-d/');
    expect(r.report.missing).toEqual(['img/leak.jpg', 'img/missing.png']);
    expect(r.report.external).toEqual(['//cdn.example.com/p.jpg', 'https://cdn.example.com/lib.js']);
    expect(r.report.runtime).toEqual(['/data/runtime.json']);
  });

  it('rewrites root-absolute references to relative ones and changes nothing else', async () => {
    const r = await readBuildPage(site(), 'lab/home-d/');
    const html = text(r, 'lab/home-d/index.html');
    expect(html).toContain('href="../../_astro/x.css"');
    expect(html).toContain('src="../../_astro/main.js"');
    expect(html).toContain('src="../../img/a-400.jpg" srcset="../../img/a-400.jpg 400w, ../../img/a-800.jpg 800w"');
    expect(html).toContain('url(../../img/bg.png)');
    expect(html).toContain("url('../../img/inline.png')");
    // Left alone: a canonical link, a page link, an external url, a data url, a missing file, a relative reference.
    expect(html).toContain('<link rel="canonical" href="/lab/home-d/">');
    expect(html).toContain('<a href="/other/">');
    expect(html).toContain('src="https://cdn.example.com/lib.js"');
    expect(html).toContain('poster="//cdn.example.com/p.jpg"');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('src="/img/missing.png"');
    expect(html).toContain('href="../../favicon.svg"');
    expect(text(r, '_astro/x.css')).toBe('@import "./y.css";\n@font-face { font-family: A; src: url(../fonts/a.woff2) format("woff2"); }\n.b { background: url("../img/b.jpg") }\n/* url(/not-used.png) */');
    expect(text(r, '_astro/main.js')).toBe('import "./chunk.js";import{a}from"./chunk2.js";const m=()=>import("./lazy.js");const u=new URL("../img/u.png",import.meta.url);import "react";fetch("/data/runtime.json");');
  });

  it('takes the page as a file path, with or without a leading slash', async () => {
    const dir = site();
    const a = await readBuildPage(dir, 'lab/home-d/index.html');
    const b = await readBuildPage(dir, '/lab/home-d');
    expect(a.files.map((f) => f.path)).toEqual(b.files.map((f) => f.path));
    expect(a.entry).toBe('lab/home-d/index.html');
  });

  it('keeps a page that needs only itself', async () => {
    const dir = write(scratch(), { 'a/index.html': '<h1>Hi</h1>', 'b/big.bin': 'x'.repeat(100) });
    const r = await readBuildPage(dir, 'a/');
    expect(r.files.map((f) => f.path)).toEqual(['a/index.html']);
  });

  it('follows a stylesheet that imports another, a chain of modules, and svg that uses an image', async () => {
    const dir = write(scratch(), {
      'p/index.html': '<link rel=stylesheet href=/s/a.css><script type=module src=/j/1.js></script><img src=/i/logo.svg>',
      's/a.css': '@import url(/s/b.css);', 's/b.css': '.x{background:url(/i/p.png)}',
      'j/1.js': 'import"/j/2.js"', 'j/2.js': 'export{x}from"./3.js"', 'j/3.js': 'export const x=1',
      'i/logo.svg': '<svg><image href="/i/q.png"/></svg>', 'i/p.png': 'p', 'i/q.png': 'q',
    });
    const r = await readBuildPage(dir, 'p/');
    expect(r.files.map((f) => f.path)).toEqual(['i/logo.svg', 'i/p.png', 'i/q.png', 'j/1.js', 'j/2.js', 'j/3.js', 'p/index.html', 's/a.css', 's/b.css']);
    expect(text(r, 'p/index.html')).toContain('href=../s/a.css');
    expect(text(r, 'i/logo.svg')).toContain('href="./q.png"');
  });

  it('reads inline module scripts', async () => {
    const dir = write(scratch(), { 'p/index.html': '<script type="module">import "/m.js"</script>', 'm.js': 'export {}' });
    const r = await readBuildPage(dir, 'p/');
    expect(r.files.map((f) => f.path)).toEqual(['m.js', 'p/index.html']);
    expect(text(r, 'p/index.html')).toContain('import "../m.js"');
  });
});

describe('readBuildPage refusals', () => {
  const refusal = async (...args) => {
    const r = await readBuildPage(...args);
    expect(r.ok).toBe(false);
    return r.message;
  };

  it('refuses a page outside the folder', async () => {
    const dir = site();
    expect(await refusal(dir, '../x/')).toBe('page ../x/ points outside the build folder. Pass a path inside it, such as lab/home-d/.');
    expect(await refusal(dir, 'lab/../../x')).toContain('points outside the build folder');
  });

  it('refuses a page that is a link leading out of the folder', async () => {
    const outside = write(scratch(), { 'index.html': '<p>out</p>' });
    const dir = write(scratch(), { 'a/index.html': 'x' });
    symlinkSync(outside, join(dir, 'escape'));
    expect(await refusal(dir, 'escape/')).toContain('leads outside the build folder');
  });

  it('refuses a missing page and says how to fix it', async () => {
    const dir = site();
    const m = await refusal(dir, 'lab/nope/');
    expect(m).toMatch(/^There is no page at lab\/nope\/ in .* Check that the build has it/);
  });

  it('refuses a page that is not HTML, and a page that is not text', async () => {
    const dir = site();
    expect(await refusal(dir, 'favicon.svg')).toContain('is not an HTML page');
    expect(await refusal(dir, '')).toContain('page must be the path of a page');
    expect(await refusal(dir, 5)).toContain('page must be the path of a page');
  });

  it('refuses a folder that is not absolute, missing, or a file', async () => {
    expect(await refusal('dist', 'a/')).toContain('absolute path');
    expect(await refusal(join(scratch(), 'nope'), 'a/')).toContain('There is no folder at');
    const dir = write(scratch(), { 'f.html': 'x' });
    expect(await refusal(join(dir, 'f.html'), 'a/')).toContain('is a file, not a folder');
  });

  it('applies the file limit to the collected set and names the limit', async () => {
    const dir = site();
    const m = await refusal(dir, 'lab/home-d/', { ...BUILD_LIMITS, maxFiles: 5 });
    expect(m).toMatch(/^The page needs 15 files, over the limit of 5\. The largest are /);
  });

  it('applies the size limit to the collected set and names the largest files', async () => {
    const dir = write(scratch(), {
      'p/index.html': '<img src=/a.jpg><img src=/b.jpg><img src=/c.jpg>',
      'a.jpg': 'a'.repeat(3000), 'b.jpg': 'b'.repeat(9000), 'c.jpg': 'c'.repeat(1000), 'huge-unused.bin': 'z'.repeat(1_000_000),
    });
    const m = await refusal(dir, 'p/', { ...BUILD_LIMITS, maxBytes: 5000 });
    expect(m).toMatch(/^The page needs [\d.]+ MB of files, over the limit of [\d.]+ MB\. The largest are b\.jpg \(.*\), a\.jpg/);
    expect(m).not.toContain('huge-unused');
    // The whole build is far over the limit, and the page alone is not.
    const ok = await readBuildPage(dir, 'p/', { ...BUILD_LIMITS, maxBytes: 20_000 });
    expect(ok.ok).toBe(true);
  });

  it('refuses a path that is too long', async () => {
    const dir = write(scratch(), { 'p/index.html': '<img src=/a/b.jpg>', 'a/b.jpg': 'x' });
    expect(await refusal(dir, 'p/', { ...BUILD_LIMITS, maxPath: 6 })).toContain('longer than 6 characters');
  });

  it('stops a crawl with too many references', async () => {
    const imgs = Array.from({ length: 30 }, (_, i) => `<img src=/i/${i}.png>`).join('');
    const dir = write(scratch(), { 'p/index.html': imgs });
    const m = await refusal(dir, 'p/', BUILD_LIMITS, { ...CRAWL_LIMITS, maxRefs: 10 });
    expect(m).toBe('The page leads to more than 10 references, so Canon stopped looking. Pass a simpler page, or a build with less on it.');
  });

  it('stops a crawl that would read too much text', async () => {
    const dir = write(scratch(), { 'p/index.html': '<script src=/a.js></script>', 'a.js': 'x'.repeat(5000) });
    const m = await refusal(dir, 'p/', BUILD_LIMITS, { ...CRAWL_LIMITS, maxParsedBytes: 1000 });
    expect(m).toContain('Canon stopped');
  });

  it('handles references that loop without stopping', async () => {
    const dir = write(scratch(), { 'p/index.html': '<link rel=stylesheet href=/a.css>', 'a.css': '@import "/b.css";', 'b.css': '@import "/a.css";' });
    const r = await readBuildPage(dir, 'p/');
    expect(r.files.map((f) => f.path)).toEqual(['a.css', 'b.css', 'p/index.html']);
  });

  it('refuses a file that changes after it was found', async () => {
    const dir = site();
    const m = await readBuildPage(dir, 'lab/home-d/', BUILD_LIMITS, CRAWL_LIMITS, {
      afterCrawl: async () => writeFileSync(join(dir, 'img/b.jpg'), 'changed size'),
    });
    expect(m.ok).toBe(false);
    expect(m.message).toBe('img/b.jpg changed while Canon was reading the build. Finish the build, then pass the folder again.');
  });
});
