import { describe, expect, it } from 'vitest';
import { noteToEntry, entryFileName } from '../../src/app/lib/strata';

describe('noteToEntry', () => {
  it('writes a Strata entry with Said verbatim and the rest left open', () => {
    const md = noteToEntry({ said: 'I could not tell held from booked.', participant: 'P-04' }, { date: '2026-10-12', about: 'checkout-v3' });
    expect(md).toContain('date: 2026-10-12');
    expect(md).toContain('source: canvas-note');
    expect(md).toContain('participants: [P-04]');
    expect(md).toContain('about: [checkout-v3]');
    expect(md).toContain('## Said\n\n> I could not tell held from booked.');
    expect(md).toContain('## Meant\n\nNot yet interpreted.');
    expect(md).toContain('## Decided\n\nNot yet decided.');
  });
  it('keeps a reading under Meant, marked as one', () => {
    const md = noteToEntry({ said: 'x', meant: 'States read the same.' }, { date: '2026-10-12', about: 'a' });
    expect(md).toContain('## Meant\n\nStates read the same.');
  });
  it('never files something that is not a P code as a participant', () => {
    const md = noteToEntry({ said: 'x', participant: 'Dana from sales' }, { date: '2026-10-12', about: 'a' });
    expect(md).toContain('participants: []');
    expect(md).not.toContain('Dana');
  });
  it('quotes every line of a multi-line Said', () => {
    const md = noteToEntry({ said: 'one\ntwo' }, { date: '2026-10-12', about: 'a' });
    expect(md).toContain('> one\n> two');
  });
});

describe('entryFileName', () => {
  it('dates and slugs the file, and numbers repeats', () => {
    expect(entryFileName('2026-10-12', 'Checkout V3', 0)).toBe('2026-10-12-checkout-v3.md');
    expect(entryFileName('2026-10-12', 'Checkout V3', 2)).toBe('2026-10-12-checkout-v3-3.md');
  });
});
