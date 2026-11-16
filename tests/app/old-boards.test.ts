import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DB_VERSION } from '../../src/app/db';
import { LIBRARY_VERSION, parseLibrary, toLibrary } from '../../src/app/lib/backup';

const text = readFileSync(new URL('./fixtures/library-before-metadata.json', import.meta.url), 'utf8');

describe('boards saved before names and metadata', () => {
  it('a library saved before metadata parses with every record deep-equal to the file', () => {
    const raw = JSON.parse(text);
    const parsed = parseLibrary(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const key of ['projects', 'boards', 'frames', 'placements', 'notes', 'files'] as const) {
      expect(parsed.library[key]).toEqual(raw[key]);
    }
    for (const f of parsed.library.frames) {
      expect(f).not.toHaveProperty('tags');
      expect(f).not.toHaveProperty('summary');
      expect(f).not.toHaveProperty('starred');
    }
  });

  it('a library with the new fields round-trips through toLibrary and parseLibrary unchanged', () => {
    const parsed = parseLibrary(text);
    if (!parsed.ok) throw new Error('fixture must parse');
    const frames = parsed.library.frames.map((f) => (f.id === 'f2'
      ? { ...f, summary: 'The cart page.', repo: 'shop', branch: 'cart-redo', tool: 'Claude', tags: ['cart', 'claude'], removedTags: ['checkout'], starred: true, note: 'Use this one.', archived: true }
      : f));
    const lib = toLibrary({ ...parsed.library, frames }, parsed.library.files, 5);
    const back = parseLibrary(JSON.stringify(lib));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.library.frames).toEqual(frames);
  });

  it('DB_VERSION is still 3 and LIBRARY_VERSION is still 1', () => {
    expect(DB_VERSION).toBe(3);
    expect(LIBRARY_VERSION).toBe(1);
  });
});
