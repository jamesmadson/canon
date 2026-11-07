import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUT_OUTLINE, lineDiff, markRemoved } from '../../src/lib/cutDiff';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const before = read('public/previews/prune/pricing.html');
const after = read('public/previews/prune/after.html');

describe('lineDiff', () => {
  // Mutation: swap the 'removed' and 'added' kinds in lineDiff fails this.
  it('names removed and added lines with their element and first text', () => {
    const diff = lineDiff('<ul>\n<li>One</li>\n<li>Two</li>\n</ul>', '<ul>\n<li>One</li>\n<li>Three</li>\n</ul>');
    expect(diff).toEqual([
      { kind: 'removed', line: 3, tag: 'li', label: 'Two' },
      { kind: 'added', line: 3, tag: 'li', label: 'Three' },
    ]);
  });

  it('skips blank lines and reads Windows line endings', () => {
    expect(lineDiff('a\r\n\r\nb', 'a\r\nb')).toEqual([]);
  });

  // Mutation: drop the first-text match in describe() fails this.
  it("finds Prune's four cut rows by their headings, and nothing else", () => {
    const diff = lineDiff(before, after);
    expect(diff.map((d) => [d.kind, d.tag, d.label])).toEqual([
      ['removed', 'tr', 'Jobs'],
      ['removed', 'tr', 'Quotes'],
      ['removed', 'tr', 'Scheduling and invoices'],
      ['removed', 'tr', '14-day free trial, no card'],
    ]);
    expect(diff.map((d) => d.line)).toEqual([194, 195, 196, 202]);
  });
});

describe('markRemoved', () => {
  // Mutation: mark every line, or none, fails this.
  it('marks exactly the removed lines and adds the orange outline', () => {
    const marked = markRemoved(before, lineDiff(before, after));
    expect(marked.match(/<tr data-cut="/g)).toHaveLength(4);
    expect(marked).toContain(`outline:2px solid ${CUT_OUTLINE}`);
    expect(CUT_OUTLINE).toBe('#FF4F00');
    // Unmarked, it is the page as it was.
    expect(marked.replace(/ data-cut="[^"]*"/g, '').replace(/<style>\[data-cut\][^\n]*<\/style>\n/, '')).toBe(before);
  });

  // Mutation: mark every cut line "start end" fails this.
  it('marks a run of neighbouring cut lines as one box', () => {
    const marks = markRemoved(before, lineDiff(before, after)).match(/<tr data-cut="[^"]*"/g);
    expect(marks).toEqual(['<tr data-cut="start"', '<tr data-cut=""', '<tr data-cut="end"', '<tr data-cut="start end"']);
  });
});
