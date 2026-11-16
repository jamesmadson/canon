import { describe, expect, it } from 'vitest';
import type { Frame } from '../../src/app/db';
import { cardsOf } from '../../src/app/lib/home';
import { searchCards } from '../../src/app/lib/search';

const frame = (p: Partial<Frame> & { id: string }): Frame => ({
  projectId: 'p1', name: p.id, kind: 'files', x: 0, y: 0, w: 1280, h: 800, rev: 0, createdAt: 1, updatedAt: 1, ...p,
});
const names: Record<string, string> = { p1: 'Pricing', p2: 'Checkout' };
const projectName = (id: string) => names[id] ?? '';

const cards = cardsOf([
  frame({ id: 'a', name: 'Pricing page, annual toggle', summary: 'Monthly and yearly prices.', tags: ['pricing', 'annual toggle'], tool: 'Claude Code', updatedAt: 5 }),
  frame({ id: 'b', name: 'Checkout, one page', projectId: 'p2', tags: ['payment'], tool: 'Figma', updatedAt: 9 }),
  frame({ id: 'c', name: 'Welcome screen', summary: 'Invite teammates before the first project.', note: 'Ask Sam about the invite copy', updatedAt: 3 }),
  frame({ id: 'd', name: 'Settings, billing', tags: ['pricing'], updatedAt: 7 }),
]);

describe('searchCards', () => {
  it('lists the latest prototypes when nothing is typed', () => {
    expect(searchCards(cards, '', projectName).map((c) => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('finds a prototype by the start of its name', () => {
    expect(searchCards(cards, 'check', projectName)[0].id).toBe('b');
  });

  it('ranks a name match above a tag match above a summary match', () => {
    const ranked = searchCards(cards, 'pricing', projectName).map((c) => c.id);
    // a: name and tag. d: tag. c and b do not mention it. The project name Pricing matches p1's prototypes too.
    expect(ranked[0]).toBe('a');
    expect(ranked.indexOf('d')).toBeGreaterThan(-1);
    expect(ranked).not.toContain('b');
  });

  it('matches the summary, the source, the project name and the note', () => {
    expect(searchCards(cards, 'yearly', projectName).map((c) => c.id)).toEqual(['a']);
    expect(searchCards(cards, 'figma', projectName).map((c) => c.id)).toEqual(['b']);
    expect(searchCards(cards, 'checkout', projectName).map((c) => c.id)).toEqual(['b']);
    expect(searchCards(cards, 'sam', projectName).map((c) => c.id)).toEqual(['c']);
  });

  it('needs every word to match somewhere, in any order', () => {
    expect(searchCards(cards, 'toggle annual', projectName).map((c) => c.id)).toEqual(['a']);
    expect(searchCards(cards, 'toggle figma', projectName)).toEqual([]);
  });

  it('ignores case and surrounding space', () => {
    expect(searchCards(cards, '  WELCOME ', projectName).map((c) => c.id)).toEqual(['c']);
  });

  it('breaks ties by the most recently updated', () => {
    const tied = cardsOf([frame({ id: 'x', name: 'Card one', updatedAt: 1 }), frame({ id: 'y', name: 'Card two', updatedAt: 2 })]);
    expect(searchCards(tied, 'card', projectName).map((c) => c.id)).toEqual(['y', 'x']);
  });

  it('stops at the limit', () => {
    const many = cardsOf(Array.from({ length: 30 }, (_, i) => frame({ id: `f${i}`, name: `Page ${i}`, updatedAt: i })));
    expect(searchCards(many, 'page', projectName, 8)).toHaveLength(8);
  });

  it('includes archived prototypes only when asked', () => {
    const withArchived = cardsOf([frame({ id: 'z', name: 'Old pricing', archived: true })]);
    expect(searchCards(withArchived, 'pricing', projectName)).toEqual([]);
    expect(searchCards(withArchived, 'pricing', projectName, 12, { archived: true }).map((c) => c.id)).toEqual(['z']);
  });
});
