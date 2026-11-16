import { describe, expect, it } from 'vitest';
import { BUILD_LIMITS, createStaging } from '../../src/app/lib/stage';
import { BUILD_LIMITS as CLI_LIMITS } from '../../cli/src/mcp/folder.js';

const b64 = (s: string | Uint8Array) => Buffer.from(s).toString('base64');
const UP = '0123456789abcdef';
const part = (path: string, text: string, at = 0, size = text.length + at) => ({ path, at, size, data: b64(text) });
const text = (u: Uint8Array) => Buffer.from(u).toString();

describe('the limits match the ones the MCP process checks', () => {
  it('same bytes, files and path length', () => {
    expect(BUILD_LIMITS).toEqual(CLI_LIMITS);
  });
});

describe('staging a build', () => {
  it('puts files back together from parts in any order', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('index.html', '<h1>Hi</h1>')] });
    s.part({ upload: UP, parts: [part('app.js', 'world', 5, 10)] });
    s.part({ upload: UP, parts: [part('app.js', 'hello', 0, 10)] });
    const files = s.take({ upload: UP, count: 2, bytes: 21 });
    expect(files.map((f) => f.path).sort()).toEqual(['app.js', 'index.html']);
    expect(text(files.find((f) => f.path === 'app.js')!.bytes)).toBe('helloworld');
  });

  it('keeps an empty file', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('index.html', 'x'), { path: 'empty.txt', at: 0, size: 0, data: '' }] });
    const files = s.take({ upload: UP, count: 2, bytes: 1 });
    expect(files.find((f) => f.path === 'empty.txt')!.bytes.length).toBe(0);
  });

  it('can be taken once', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('index.html', 'x')] });
    s.take({ upload: UP, count: 1, bytes: 1 });
    expect(() => s.take({ upload: UP, count: 1, bytes: 1 })).toThrow('Canon no longer has those files. Add the build again.');
  });

  it('refuses a build with a missing piece, a wrong count or a wrong size', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('index.html', 'abc', 0, 6)] });
    expect(() => s.take({ upload: UP, count: 1, bytes: 6 })).toThrow('Some of the files did not arrive. Add the build again.');
    const t = createStaging();
    t.part({ upload: UP, parts: [part('index.html', 'abc')] });
    expect(() => t.take({ upload: UP, count: 2, bytes: 3 })).toThrow('Some of the files did not arrive. Add the build again.');
    const u = createStaging();
    u.part({ upload: UP, parts: [part('index.html', 'abc')] });
    expect(() => u.take({ upload: UP, count: 1, bytes: 9 })).toThrow('Some of the files did not arrive. Add the build again.');
  });

  it('refuses a build with no index.html at its top', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('pages/index.html', 'x')] });
    expect(() => s.take({ upload: UP, count: 1, bytes: 1 })).toThrow('The build has no index.html at its top.');
  });

  it('refuses a build reference that is not shaped right', () => {
    const s = createStaging();
    expect(() => s.take(undefined)).toThrow('build must say which upload, how many files and how many bytes.');
    expect(() => s.take({ upload: 1, count: 1, bytes: 1 })).toThrow('build must say which upload');
  });
});

describe('what the tab refuses', () => {
  const bad = (parts: unknown, upload: unknown = UP) => () => createStaging().part({ upload, parts });
  it('an upload id that is not 16 hex digits', () => {
    expect(bad([part('a', 'x')], 'nope')).toThrow('upload must be 16 hex digits.');
  });
  it('paths that could leave the prototype', () => {
    for (const p of ['../x', 'a/../x', '/abs', 'a//b', './a', 'a\\b', '', 'a\0b']) {
      expect(bad([part(p, 'x')]), p).toThrow('is not a path inside the build');
    }
    expect(bad([part('x'.repeat(501), 'x')])).toThrow('is not a path inside the build');
  });
  it('parts that run past the size they declare, or have a bad offset or size', () => {
    expect(bad([part('a', 'abc', 0, 2)])).toThrow('runs past the end of the file');
    expect(bad([{ path: 'a', at: -1, size: 5, data: b64('x') }])).toThrow('at and size must be whole numbers');
    expect(bad([{ path: 'a', at: 0, size: 1.5, data: b64('x') }])).toThrow('at and size must be whole numbers');
    expect(bad([{ path: 'a', at: 0, size: 3, data: 5 }])).toThrow('data must be base64 text');
    expect(bad([{ path: 'a', at: 0, size: 3, data: '***' }])).toThrow('data must be base64 text');
  });
  it('more files, or more bytes, than the limit', () => {
    const s = createStaging();
    const many = Array.from({ length: BUILD_LIMITS.maxFiles + 1 }, (_, i) => ({ path: `f${i}`, at: 0, size: 0, data: '' }));
    s.part({ upload: UP, parts: many.slice(0, 1000) });
    s.part({ upload: UP, parts: many.slice(1000, 2000) });
    expect(() => s.part({ upload: UP, parts: many.slice(2000) })).toThrow(`more than ${BUILD_LIMITS.maxFiles} files`);
    expect(bad([{ path: 'a', at: 0, size: BUILD_LIMITS.maxBytes + 1, data: '' }])).toThrow('larger than 25 MB');
  });
  it('a file declared with two different sizes', () => {
    const s = createStaging();
    s.part({ upload: UP, parts: [part('a', 'x', 0, 4)] });
    expect(() => s.part({ upload: UP, parts: [part('a', 'x', 0, 5)] })).toThrow('two different sizes');
  });
  it('parts that are not a list', () => {
    expect(bad('x')).toThrow('parts must be a list');
    expect(bad(Array.from({ length: 1001 }, () => part('a', 'x')))).toThrow('parts must be a list');
  });
});

describe('forgetting', () => {
  it('drops an upload that sat for ten minutes', () => {
    let now = 0;
    const s = createStaging(() => now);
    s.part({ upload: UP, parts: [part('index.html', 'x')] });
    now = 10 * 60 * 1000 + 1;
    expect(() => s.take({ upload: UP, count: 1, bytes: 1 })).toThrow('Canon no longer has those files');
  });
  it('keeps at most four uploads, dropping the oldest', () => {
    let now = 0;
    const s = createStaging(() => now++);
    const ids = ['a', 'b', 'c', 'd', 'e'].map((c) => c.repeat(16));
    for (const id of ids) s.part({ upload: id, parts: [part('index.html', 'x')] });
    expect(() => s.take({ upload: ids[0], count: 1, bytes: 1 })).toThrow('no longer has');
    expect(s.take({ upload: ids[4], count: 1, bytes: 1 })).toHaveLength(1);
  });
});
