import { describe, expect, it } from 'vitest';
import { filterPrototypes, sortPrototypes, initials, type LibraryItem } from '../../src/app/lib/library';

const item = (p: Partial<LibraryItem>): LibraryItem => ({
  id: 'x', name: 'x', kind: 'files', pages: 1, boards: 1, comments: 0, createdAt: 0, updatedAt: 0, ...p,
});
const items = [
  item({ id: 'a', name: 'Checkout v3', pages: 1, boards: 2, comments: 4, createdAt: 3, updatedAt: 9 }),
  item({ id: 'b', name: 'Fernwell site', pages: 6, boards: 1, comments: 0, createdAt: 1, updatedAt: 5, kind: 'linked' }),
  item({ id: 'c', name: 'Streak', pages: 1, boards: 0, comments: 1, createdAt: 2, updatedAt: 2, kind: 'url' }),
];

describe('filterPrototypes', () => {
  it('matches the query anywhere in the name, ignoring case', () => {
    expect(filterPrototypes(items, { query: 'SITE' }).map((i) => i.id)).toEqual(['b']);
  });
  it('filters by source, pages, comments and placement', () => {
    expect(filterPrototypes(items, { source: 'url' }).map((i) => i.id)).toEqual(['c']);
    expect(filterPrototypes(items, { multiPage: true }).map((i) => i.id)).toEqual(['b']);
    expect(filterPrototypes(items, { hasComments: true }).map((i) => i.id)).toEqual(['a', 'c']);
    expect(filterPrototypes(items, { unplaced: true }).map((i) => i.id)).toEqual(['c']);
  });
});

describe('sortPrototypes', () => {
  it('sorts newest first, by name, by comments, or by last change', () => {
    expect(sortPrototypes(items, 'added').map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(sortPrototypes(items, 'name').map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(sortPrototypes(items, 'comments').map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(sortPrototypes(items, 'updated').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not reorder the list it was given', () => {
    const copy = [...items];
    sortPrototypes(items, 'name');
    expect(items).toEqual(copy);
  });
});

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('james')).toBe('J');
    expect(initials('  ')).toBe('?');
  });
});
