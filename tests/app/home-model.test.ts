import { describe, expect, it } from 'vitest';
import type { Frame, Project } from '../../src/app/db';
import { cardsOf, filterByTags, groupByProject, scopeCards, sortCards, sourceOf, tagCounts, whenLabel } from '../../src/app/lib/home';

const frame = (p: Partial<Frame> & { id: string }): Frame => ({
  projectId: 'p1', name: p.id, kind: 'files', x: 0, y: 0, w: 1280, h: 800, rev: 0, createdAt: 1, updatedAt: 1, ...p,
});
const project = (id: string, name: string, updatedAt = 1): Project => ({ id, name, createdAt: 1, updatedAt });

describe('cardsOf', () => {
  it('makes one card per prototype, showing its current version', () => {
    const frames = [
      frame({ id: 'a1', name: 'Pricing', stackId: 'a1', createdAt: 1, updatedAt: 5 }),
      frame({ id: 'a2', name: 'Pricing v2', stackId: 'a1', createdAt: 2, updatedAt: 9 }),
      frame({ id: 'b', name: 'Checkout' }),
    ];
    const cards = cardsOf(frames);
    expect(cards.map((c) => c.id).sort()).toEqual(['a2', 'b']);
    const pricing = cards.find((c) => c.id === 'a2')!;
    expect(pricing.versions).toBe(2);
    expect(pricing.updatedAt).toBe(9);
    expect(pricing.name).toBe('Pricing v2');
  });

  it('carries the stored summary, tags, star, note and archive flag', () => {
    const [c] = cardsOf([frame({ id: 'a', summary: 'Three tiers.', tags: ['pricing'], starred: true, note: 'Ask Sam', archived: true })]);
    expect(c).toMatchObject({ summary: 'Three tiers.', tags: ['pricing'], starred: true, note: 'Ask Sam', archived: true });
  });

  it('reads a prototype saved before these fields existed as empty', () => {
    const [c] = cardsOf([frame({ id: 'old' })]);
    expect(c).toMatchObject({ summary: '', tags: [], starred: false, archived: false, note: '', versions: 1 });
  });
});

describe('sourceOf', () => {
  it('names the agent when there is one, else how it came in', () => {
    expect(sourceOf(frame({ id: 'a', tool: 'Claude Code' }))).toBe('Claude Code');
    expect(sourceOf(frame({ id: 'b', kind: 'files' }))).toBe('Files');
    expect(sourceOf(frame({ id: 'c', kind: 'linked' }))).toBe('Folder');
    expect(sourceOf(frame({ id: 'd', kind: 'url', url: 'https://www.example.com/x' }))).toBe('example.com');
    expect(sourceOf(frame({ id: 'e', kind: 'url', url: 'not a url' }))).toBe('Link');
  });
});

describe('scopeCards', () => {
  const cards = cardsOf([
    frame({ id: 'a', tags: ['pricing'], starred: true }),
    frame({ id: 'b', tags: ['pricing', 'table'] }),
    frame({ id: 'c', archived: true, starred: true, tags: ['pricing'] }),
  ]);
  it('home shows everything not archived', () => {
    expect(scopeCards(cards, { kind: 'home' }).map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('starred shows starred prototypes that are not archived', () => {
    expect(scopeCards(cards, { kind: 'starred' }).map((c) => c.id)).toEqual(['a']);
  });
  it('archive shows only archived prototypes', () => {
    expect(scopeCards(cards, { kind: 'archive' }).map((c) => c.id)).toEqual(['c']);
  });
  it('a tag shows its prototypes that are not archived, ignoring case', () => {
    expect(scopeCards(cards, { kind: 'tag', tag: 'Table' }).map((c) => c.id)).toEqual(['b']);
  });
});

describe('sortCards', () => {
  const cards = cardsOf([
    frame({ id: 'old', updatedAt: 1, starred: true }),
    frame({ id: 'new', updatedAt: 9 }),
    frame({ id: 'mid', updatedAt: 5 }),
    frame({ id: 'mid2', updatedAt: 6, starred: true }),
  ]);
  it('sorts by last updated, newest first', () => {
    expect(sortCards(cards, 'updated').map((c) => c.id)).toEqual(['new', 'mid2', 'mid', 'old']);
  });
  it('puts starred first, then newest first', () => {
    expect(sortCards(cards, 'starred').map((c) => c.id)).toEqual(['mid2', 'old', 'new', 'mid']);
  });
  it('does not change the list it was given', () => {
    const before = cards.map((c) => c.id);
    sortCards(cards, 'updated');
    expect(cards.map((c) => c.id)).toEqual(before);
  });
});

describe('filterByTags', () => {
  const cards = cardsOf([
    frame({ id: 'a', tags: ['pricing', 'table'] }),
    frame({ id: 'b', tags: ['pricing'] }),
    frame({ id: 'c' }),
  ]);
  it('keeps everything with no tags chosen', () => {
    expect(filterByTags(cards, []).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('keeps prototypes that carry every chosen tag', () => {
    expect(filterByTags(cards, ['pricing']).map((c) => c.id)).toEqual(['a', 'b']);
    expect(filterByTags(cards, ['pricing', 'table']).map((c) => c.id)).toEqual(['a']);
  });
});

describe('tagCounts', () => {
  it('counts each tag once per prototype, most used first, then by name', () => {
    const cards = cardsOf([
      frame({ id: 'a', tags: ['pricing', 'table'] }),
      frame({ id: 'b', tags: ['pricing', 'form'] }),
      frame({ id: 'c', tags: ['form'] }),
      frame({ id: 'd', tags: ['alpha'] }),
    ]);
    expect(tagCounts(cards)).toEqual([
      { tag: 'form', count: 2 }, { tag: 'pricing', count: 2 }, { tag: 'alpha', count: 1 }, { tag: 'table', count: 1 },
    ]);
  });
});

describe('groupByProject', () => {
  const projects = [project('p1', 'Pricing', 1), project('p2', 'Checkout', 2), project('p3', 'Empty', 10)];
  const cards = cardsOf([
    frame({ id: 'a', projectId: 'p1', updatedAt: 3 }),
    frame({ id: 'b', projectId: 'p1', updatedAt: 8 }),
    frame({ id: 'c', projectId: 'p2', updatedAt: 5 }),
  ]);
  it('lists the project with the latest prototype first, and each project newest first', () => {
    const groups = groupByProject(cards, projects);
    expect(groups.map((g) => g.project.id)).toEqual(['p1', 'p2']);
    expect(groups[0].cards.map((c) => c.id)).toEqual(['b', 'a']);
  });
  it('can keep projects with nothing in them, after the others', () => {
    expect(groupByProject(cards, projects, { includeEmpty: true }).map((g) => g.project.id)).toEqual(['p1', 'p2', 'p3']);
  });
  it('leaves out a prototype whose project is gone', () => {
    const lost = cardsOf([frame({ id: 'z', projectId: 'gone' })]);
    expect(groupByProject(lost, projects)).toEqual([]);
  });
});

describe('whenLabel', () => {
  const at = (iso: string) => new Date(iso).getTime();
  const now = at('2026-11-16T15:00:00');
  it('reads in the order people say it', () => {
    expect(whenLabel(now - 20_000, now)).toBe('Just now');
    expect(whenLabel(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(whenLabel(at('2026-11-16T09:00:00'), now)).toBe('Today');
    expect(whenLabel(at('2026-11-15T23:00:00'), now)).toBe('Yesterday');
    expect(whenLabel(at('2026-11-12T12:00:00'), now)).toBe('Thursday');
    expect(whenLabel(at('2026-11-02T12:00:00'), now)).toBe('2 Nov');
  });
  it('adds the year only when it is a different year', () => {
    expect(whenLabel(at('2025-03-04T12:00:00'), now)).toBe('4 Mar 2025');
  });
});
