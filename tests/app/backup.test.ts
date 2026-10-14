import { describe, it, expect } from 'vitest';
import { backupName, parseLibrary, safeSegments, summarize, toLibrary, LIBRARY_FORMAT } from '../../src/app/lib/backup';
import type { Frame } from '../../src/app/db';

const frame = (id: string): Frame => ({ id, projectId: 'p', name: id, kind: 'files', x: 0, y: 0, w: 390, h: 844, rev: 1, createdAt: 1, updatedAt: 1 });
const data = {
  projects: [{ id: 'p', name: 'Fernwell', createdAt: 1, updatedAt: 1 }],
  boards: [],
  frames: [frame('a')],
  placements: [],
  notes: [],
};

describe('the library file', () => {
  it('round-trips through JSON', () => {
    const lib = toLibrary(data, [{ key: 'a/index.html', frameId: 'a', type: 'text/html' }], 42);
    const parsed = parseLibrary(JSON.stringify(lib));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.library.frames[0].id).toBe('a');
      expect(parsed.library.files).toEqual([{ key: 'a/index.html', frameId: 'a', type: 'text/html' }]);
      expect(parsed.library.savedAt).toBe(42);
    }
  });

  it('drops files whose prototype is gone', () => {
    const lib = toLibrary(data, [{ key: 'gone/index.html', frameId: 'gone', type: 'text/html' }], 1);
    expect(lib.files).toEqual([]);
  });

  it('refuses something that is not a library', () => {
    expect(parseLibrary('not json').ok).toBe(false);
    expect(parseLibrary(JSON.stringify({ hello: 'world' })).ok).toBe(false);
  });

  it('refuses a library from a newer Canon', () => {
    const lib = { ...toLibrary(data, [], 1), version: 99 };
    const parsed = parseLibrary(JSON.stringify(lib));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/newer Canon/);
  });

  it('refuses a damaged list instead of half-restoring it', () => {
    const lib = { ...toLibrary(data, [], 1), frames: [{ name: 'no id' }] };
    expect(parseLibrary(JSON.stringify(lib)).ok).toBe(false);
  });

  it('skips file entries that would escape the library folder', () => {
    const lib = {
      format: LIBRARY_FORMAT,
      version: 1,
      ...data,
      files: [
        { key: 'a/../../etc/passwd', frameId: 'a', type: '' },
        { key: 'a/ok.html', frameId: 'a', type: 'text/html' },
      ],
    };
    const parsed = parseLibrary(JSON.stringify(lib));
    expect(parsed.ok && parsed.library.files.map((f) => f.key)).toEqual(['a/ok.html']);
  });
});

describe('file keys on disk', () => {
  it('splits a nested key into segments', () => {
    expect(safeSegments('a/assets/app.js')).toEqual(['a', 'assets', 'app.js']);
  });
  it('rejects climbing, empty and backslash segments', () => {
    expect(safeSegments('a/../b')).toBeNull();
    expect(safeSegments('a//b')).toBeNull();
    expect(safeSegments('a\\b/c')).toBeNull();
    expect(safeSegments('lonely')).toBeNull();
  });
});

describe('naming and counting', () => {
  it('dates the backup file', () => {
    expect(backupName(new Date('2026-10-14T12:00:00Z'))).toBe('canon-backup-2026-10-14.canon');
  });
  it('counts what a restore brings back', () => {
    expect(summarize(toLibrary(data, [], 1))).toBe('1 project, 1 prototype, 0 notes');
  });
});
