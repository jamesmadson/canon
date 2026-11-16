import { describe, expect, it } from 'vitest';
import { filterPrototypes, sortPrototypes, type LibraryItem } from '../../src/app/lib/library';

const item = (p: Partial<LibraryItem>): LibraryItem => ({
  id: 'x', name: 'x', kind: 'files', pages: 1, boards: 1, comments: 0, createdAt: 0, updatedAt: 0, ...p,
});
const items = [
  item({ id: 'a', updatedAt: 5, starred: true, tags: ['pricing', 'table'] }),
  item({ id: 'b', updatedAt: 9, tags: ['pricing'] }),
  item({ id: 'c', updatedAt: 7, archived: true, starred: true }),
  item({ id: 'd', updatedAt: 1, starred: true }),
];

describe('the project library: starred, tags and archive', () => {
  it('sorts starred first, then the most recently updated', () => {
    expect(sortPrototypes(items, 'starred').map((i) => i.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('hides archived prototypes unless asked for them', () => {
    expect(filterPrototypes(items, {}).map((i) => i.id)).toEqual(['a', 'b', 'd']);
    expect(filterPrototypes(items, { archived: true }).map((i) => i.id)).toEqual(['c']);
  });

  it('filters by tags, keeping prototypes that carry all of them', () => {
    expect(filterPrototypes(items, { tags: ['pricing'] }).map((i) => i.id)).toEqual(['a', 'b']);
    expect(filterPrototypes(items, { tags: ['pricing', 'table'] }).map((i) => i.id)).toEqual(['a']);
    expect(filterPrototypes(items, { tags: [] }).map((i) => i.id)).toEqual(['a', 'b', 'd']);
  });

  it('matches the query against the summary and tags as well as the name', () => {
    const withText = [item({ id: 'n', name: 'Plain', summary: 'Yearly prices', tags: ['annual'] })];
    expect(filterPrototypes(withText, { query: 'yearly' }).map((i) => i.id)).toEqual(['n']);
    expect(filterPrototypes(withText, { query: 'annual' }).map((i) => i.id)).toEqual(['n']);
    expect(filterPrototypes(withText, { query: 'nothing' })).toEqual([]);
  });
});
