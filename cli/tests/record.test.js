import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseEntry,
  readRecord,
  slugify,
  renderEntry,
  entryFileName,
  openReport,
  DECIDED_PLACEHOLDER,
  isParticipant,
} from '../src/record.js';

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

const SAMPLE = `---
date: 2026-08-27
source: field-note
participants: [P-12]
about: [review-surface, annotation]
assets: []
---

## Said

*Reply in a thread, 2026-08-27.*

> a toggle-able annotation layer above the screens

## Meant

In prototype annotation, hand rolled per project.

## Decided

2026-08-27 adopted as committed v2 scope.
`;

function scratchRecord(files) {
  const dir = join(mkdtempSync(join(tmpdir(), 'canon-record-')), '.strata');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('parseEntry', () => {
  const entry = parseEntry(SAMPLE, '2026-08-27-annotation-layer.md');

  it('reads the frontmatter shape the record already uses', () => {
    expect(entry.date).toBe('2026-08-27');
    expect(entry.source).toBe('field-note');
    expect(entry.participants).toEqual(['P-12']);
    expect(entry.about).toEqual(['review-surface', 'annotation']);
    expect(entry.assets).toEqual([]);
  });

  it('keeps Said, Meant and Decided apart', () => {
    expect(entry.said).toContain('annotation layer above the screens');
    expect(entry.meant).toContain('hand rolled per project');
    expect(entry.decided).toContain('adopted as committed v2 scope');
  });

  it('reports a filed decision as closed', () => {
    expect(entry.open).toBe(false);
  });

  it('reads the slug and date from the file name', () => {
    expect(entry.slug).toBe('annotation-layer');
    expect(entry.file).toBe('2026-08-27-annotation-layer.md');
  });

  it('counts a placeholder Decided as still open', () => {
    const open = parseEntry(SAMPLE.replace(/2026-08-27 adopted.*/, DECIDED_PLACEHOLDER), 'x.md');
    expect(open.open).toBe(true);
    expect(open.decided).toBe('');
  });

  it('counts an empty Decided as still open', () => {
    const open = parseEntry(SAMPLE.replace(/2026-08-27 adopted.*/, ''), 'x.md');
    expect(open.open).toBe(true);
  });

  /**
   * The record predates the tool, and a person filling in an entry by hand
   * writes a dash to mean "nothing here yet". Reading that as a decision closes
   * every hand written entry in this repository and empties the open report.
   */
  it('counts a bare dash Decided as still open, in any of the three spellings', () => {
    for (const dash of [EM_DASH, EN_DASH, '-']) {
      const open = parseEntry(SAMPLE.replace(/2026-08-27 adopted.*/, dash), `${dash}.md`);
      expect(open.open, `dash ${dash.codePointAt(0)}`).toBe(true);
      expect(open.decided).toBe('');
    }
  });

  it('still reads a decision that merely starts with a dash', () => {
    const entry3 = parseEntry(
      SAMPLE.replace(/2026-08-27 adopted.*/, `${EM_DASH} adopted after all`),
      'x.md',
    );
    expect(entry3.open).toBe(false);
  });

  it('survives a file with no frontmatter rather than throwing', () => {
    const entry2 = parseEntry('## Said\n\nsomething\n', '2026-01-01-loose.md');
    expect(entry2.participants).toEqual([]);
    expect(entry2.about).toEqual([]);
    expect(entry2.date).toBe('2026-01-01');
  });
});

describe('readRecord', () => {
  it('returns nothing when there is no record directory', () => {
    expect(readRecord(join(tmpdir(), 'canon-no-such-record-dir'))).toEqual([]);
  });

  it('returns entries newest first', () => {
    const dir = scratchRecord({
      '2026-01-02-early.md': SAMPLE.replace('2026-08-27', '2026-01-02'),
      '2026-08-27-late.md': SAMPLE,
      'notes.txt': 'ignored',
    });
    const entries = readRecord(dir);
    expect(entries.map((e) => e.slug)).toEqual(['late', 'early']);
  });
});

describe('slugify', () => {
  it('lowercases and joins on single dashes', () => {
    expect(slugify('Review Surface')).toBe('review-surface');
    expect(slugify('  spaced   out  ')).toBe('spaced-out');
  });

  it('drops punctuation rather than encoding it', () => {
    expect(slugify('What about "canvas"?')).toBe('what-about-canvas');
    expect(slugify('v1.2 / alt')).toBe('v1-2-alt');
  });

  it('falls back to a plain word for a topic with nothing usable', () => {
    expect(slugify('???')).toBe('entry');
  });
});

describe('entryFileName', () => {
  it('is the date and the slug', () => {
    expect(entryFileName('2026-09-01', 'ring', [])).toBe('2026-09-01-ring.md');
  });

  it('numbers a second entry on the same day and topic', () => {
    expect(entryFileName('2026-09-01', 'ring', ['2026-09-01-ring.md'])).toBe('2026-09-01-ring-2.md');
    expect(
      entryFileName('2026-09-01', 'ring', ['2026-09-01-ring.md', '2026-09-01-ring-2.md']),
    ).toBe('2026-09-01-ring-3.md');
  });
});

describe('renderEntry', () => {
  const text = renderEntry({
    date: '2026-09-01',
    about: ['review-surface'],
    participants: ['P-01'],
    said: 'the zoomed out view is the unsolved part',
  });

  it('writes the frontmatter shape the record already uses', () => {
    expect(text.split('\n').slice(0, 7)).toEqual([
      '---',
      'date: 2026-09-01',
      'source: field-note',
      'participants: [P-01]',
      'about: [review-surface]',
      'assets: []',
      '---',
    ]);
  });

  it('carries the three headings and quotes the verbatim', () => {
    expect(text).toContain('## Said');
    expect(text).toContain('> the zoomed out view is the unsolved part');
    expect(text).toContain('## Meant');
    expect(text).toContain('## Decided');
    expect(text).toContain(DECIDED_PLACEHOLDER);
  });

  it('wraps a long quote across blockquote lines', () => {
    const long = renderEntry({
      date: '2026-09-01',
      about: ['t'],
      participants: [],
      said: 'word '.repeat(40).trim(),
    });
    const quoted = long.split('\n').filter((line) => line.startsWith('> '));
    expect(quoted.length).toBeGreaterThan(1);
    expect(quoted.every((line) => line.length <= 78)).toBe(true);
  });

  it('writes an empty participant list rather than inventing a code', () => {
    const anon = renderEntry({ date: '2026-09-01', about: ['t'], participants: [], said: 'x' });
    expect(anon).toContain('participants: []');
  });

  it('round trips through the parser', () => {
    const parsed = parseEntry(text, '2026-09-01-review-surface.md');
    expect(parsed.participants).toEqual(['P-01']);
    expect(parsed.about).toEqual(['review-surface']);
    expect(parsed.open).toBe(true);
  });
});

describe('isParticipant', () => {
  it('accepts P codes only', () => {
    expect(isParticipant('P-12')).toBe(true);
    expect(isParticipant('p-12')).toBe(false);
    expect(isParticipant('Sam')).toBe(false);
    expect(isParticipant('S-02')).toBe(false);
  });
});

describe('openReport', () => {
  const entries = [
    { about: ['ring'], participants: ['P-01'], open: true, date: '2026-09-01' },
    { about: ['ring'], participants: ['P-01'], open: true, date: '2026-08-30' },
    { about: ['ring'], participants: ['P-02'], open: true, date: '2026-08-29' },
    { about: ['canvas'], participants: ['P-03'], open: true, date: '2026-08-28' },
    { about: ['closed'], participants: ['P-04'], open: false, date: '2026-08-27' },
  ];

  it('counts people, not entries', () => {
    const ring = openReport(entries).find((t) => t.topic === 'ring');
    expect(ring.entries).toBe(3);
    expect(ring.voices).toBe(2);
    expect(ring.strength).toBe('a possible pattern');
  });

  it('names one voice a quote and three a pattern', () => {
    const canvas = openReport(entries).find((t) => t.topic === 'canvas');
    expect(canvas.strength).toBe('a quote');
    const three = openReport([
      { about: ['x'], participants: ['P-01'], open: true, date: '2026-09-01' },
      { about: ['x'], participants: ['P-02'], open: true, date: '2026-09-01' },
      { about: ['x'], participants: ['P-03'], open: true, date: '2026-09-01' },
    ]);
    expect(three[0].strength).toBe('a pattern');
  });

  /**
   * A decision is a fact about a moment, not about a topic forever. Treating
   * any decided entry as closing the topic means a question reopened after a
   * decision never reappears, which is exactly the case the report exists for.
   */
  it('reopens a topic whose most recent entry is open again', () => {
    const reopened = openReport([
      { about: ['ring'], participants: ['P-01'], open: false, date: '2026-08-01' },
      { about: ['ring'], participants: ['P-02'], open: true, date: '2026-09-01' },
    ]);
    expect(reopened.map((t) => t.topic)).toContain('ring');
  });

  it('keeps a topic closed when the decision is the most recent word on it', () => {
    const closed = openReport([
      { about: ['ring'], participants: ['P-01'], open: true, date: '2026-08-01' },
      { about: ['ring'], participants: ['P-02'], open: false, date: '2026-09-01' },
    ]);
    expect(closed.map((t) => t.topic)).not.toContain('ring');
  });

  it('reads the same day as decided, because the decision is the later word', () => {
    const sameDay = openReport([
      { about: ['ring'], participants: ['P-01'], open: true, date: '2026-09-01' },
      { about: ['ring'], participants: ['P-02'], open: false, date: '2026-09-01' },
    ]);
    expect(sameDay.map((t) => t.topic)).not.toContain('ring');
  });

  it('leaves out topics that already have a decision', () => {
    expect(openReport(entries).map((t) => t.topic)).not.toContain('closed');
  });

  it('sorts by voices, then by the most recent entry', () => {
    expect(openReport(entries).map((t) => t.topic)).toEqual(['ring', 'canvas']);
  });

  it('never counts a name that is not a P code as a voice', () => {
    const report = openReport([
      { about: ['x'], participants: ['S-01', 'P-01'], open: true, date: '2026-09-01' },
    ]);
    expect(report[0].voices).toBe(1);
  });
});

/**
 * A fixture rather than a unit test. Every other case here builds its own
 * input, so all of them can agree with each other and still be wrong about the
 * record this tool exists to read. This one reads the real directory.
 */
describe('the record in this repository', () => {
  const dir = fileURLToPath(new URL('../../.strata', import.meta.url));
  const entries = readRecord(dir);

  it('reads every entry on disk', () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it('finds open entries, because the hand written ones have no decision yet', () => {
    const open = entries.filter((entry) => entry.open);
    expect(open.length).not.toBe(0);
    expect(open.length).toBeGreaterThan(entries.length / 2);
  });

  it('still reads the one entry that carries a decision as closed', () => {
    const decided = entries.find((entry) => entry.slug === 'annotation-layer');
    expect(decided.open).toBe(false);
  });

  it('gives the open report something to report', () => {
    expect(openReport(entries).length).toBeGreaterThan(0);
  });
});

describe('writing beside the real record', () => {
  it('matches the shape of an entry already in this repo', () => {
    const existing = readFileSync(
      new URL('../../.strata/2026-08-27-annotation-layer.md', import.meta.url),
      'utf8',
    );
    const keys = existing
      .split('\n---')[0]
      .split('\n')
      .filter((l) => l.includes(':'))
      .map((l) => l.split(':')[0].trim());
    const written = renderEntry({
      date: '2026-09-01',
      about: ['t'],
      participants: ['P-01'],
      said: 'x',
    });
    for (const key of keys) expect(written).toContain(`${key}:`);
    for (const heading of ['## Said', '## Meant', '## Decided']) {
      expect(existing).toContain(heading);
      expect(written).toContain(heading);
    }
  });
});
