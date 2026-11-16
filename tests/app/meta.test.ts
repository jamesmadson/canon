import { describe, expect, it } from 'vitest';
import { inheritedMeta, metaOf } from '../../src/app/lib/meta';

const old = { id: 'a', name: 'Old', kind: 'url' as const, url: 'https://a.test/' };

describe('metaOf', () => {
  it('a frame saved before metadata reads as empty', () => {
    expect(metaOf(old)).toEqual({});
  });
  it('carries only the metadata keys, and only the ones set', () => {
    expect(metaOf({ ...old, starred: true, note: 'Ship', tags: ['pricing'] })).toEqual({ starred: true, note: 'Ship', tags: ['pricing'] });
  });
  it('keeps false and empty values, which are answers too', () => {
    expect(metaOf({ ...old, starred: false, archived: false, note: '' })).toEqual({ starred: false, archived: false, note: '' });
  });
});

describe('inheritedMeta', () => {
  it('a new version keeps the star, note, tags, removed tags and archive flag', () => {
    const previous = { ...old, summary: 'S', repo: 'r', branch: 'b', tool: 'Cursor', tags: ['pricing'], removedTags: ['cursor'], starred: true, note: 'Ship', archived: true };
    expect(inheritedMeta(previous)).toEqual({ summary: 'S', repo: 'r', branch: 'b', tool: 'Cursor', tags: ['pricing'], removedTags: ['cursor'], starred: true, note: 'Ship', archived: true });
  });
  it('copies the lists, so the versions do not share them', () => {
    const previous = { ...old, tags: ['pricing'], removedTags: ['x'] };
    const next = inheritedMeta(previous);
    expect(next.tags).not.toBe(previous.tags);
    expect(next.removedTags).not.toBe(previous.removedTags);
  });
  it('a version of an old prototype gains nothing', () => {
    expect(inheritedMeta(old)).toEqual({});
  });
});
