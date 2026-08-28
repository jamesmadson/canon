import { describe, it, expect } from 'vitest';
import {
  groupByTheme,
  isParticipant,
  openLoops,
  strengthOf,
  strengthTag,
  type EvidenceItem,
} from '../../src/lib/evidence';
import { RECORD_ENTRIES } from '../../src/data/v2Preview';

const entry = (speaker: string, theme: string, decided: string | null = null): EvidenceItem => ({
  speaker,
  theme,
  decided,
});

describe('isParticipant', () => {
  it('counts P-nn and never S-nn', () => {
    expect(isParticipant('P-02')).toBe(true);
    expect(isParticipant('S-01')).toBe(false);
    expect(isParticipant('Ade O.')).toBe(false);
  });
});

describe('strengthOf', () => {
  it('follows the scale on the page', () => {
    expect(strengthOf(1)).toBe('quote');
    expect(strengthOf(2)).toBe('possible');
    expect(strengthOf(3)).toBe('pattern');
    expect(strengthOf(9)).toBe('pattern');
  });

  it('calls a theme with no participants a request, not a pattern', () => {
    expect(strengthOf(0)).toBe('request');
  });
});

describe('groupByTheme', () => {
  it('counts people, not entries', () => {
    const [theme] = groupByTheme([entry('P-02', 'ring'), entry('P-02', 'ring')]);
    expect(theme.voices).toBe(1);
    expect(theme.strength).toBe('quote');
  });

  it('keeps stakeholders out of the voice count', () => {
    const [theme] = groupByTheme([entry('S-01', 'average'), entry('S-02', 'average')]);
    expect(theme.voices).toBe(0);
    expect(theme.requests).toBe(2);
    expect(theme.strength).toBe('request');
  });

  it('puts the strongest theme first and holds filing order on a tie', () => {
    const themes = groupByTheme([
      entry('P-01', 'first'),
      entry('P-02', 'second'),
      entry('P-03', 'second'),
      entry('P-04', 'third'),
    ]);
    expect(themes.map((t) => t.theme)).toEqual(['second', 'first', 'third']);
  });

  it('carries the first dated decision on the theme', () => {
    const [theme] = groupByTheme([
      entry('P-01', 'ring'),
      entry('P-02', 'ring', '2026-08-25 — gap held open'),
    ]);
    expect(theme.decided).toBe('2026-08-25 — gap held open');
  });
});

describe('strengthTag', () => {
  it('prints the count that earned the label', () => {
    expect(strengthTag({ voices: 1, strength: 'quote' })).toBe('A quote · 1 voice');
    expect(strengthTag({ voices: 3, strength: 'pattern' })).toBe('Pattern · 3 voices');
    expect(strengthTag({ voices: 0, strength: 'request' })).toBe('Stakeholder request');
  });
});

describe('openLoops', () => {
  it('returns only themes with nothing decided', () => {
    const loops = openLoops([
      entry('P-01', 'open'),
      entry('P-02', 'closed', '2026-08-22 — done'),
    ]);
    expect(loops.map((t) => t.theme)).toEqual(['open']);
  });
});

describe('the scripted record', () => {
  it('has one pattern, and it is the ring', () => {
    const patterns = groupByTheme(RECORD_ENTRIES).filter((t) => t.strength === 'pattern');
    expect(patterns).toHaveLength(1);
    expect(patterns[0].voices).toBe(3);
    expect(patterns[0].theme).toBe('The ring reads as done before it is');
  });

  it('files exactly two decisions', () => {
    expect(RECORD_ENTRIES.filter((e) => e.decided).length).toBe(2);
  });

  it('never puts a real name in the speaker column', () => {
    for (const record of RECORD_ENTRIES) {
      expect(record.speaker).toMatch(/^[PS]-\d{2}$/);
    }
  });
});
