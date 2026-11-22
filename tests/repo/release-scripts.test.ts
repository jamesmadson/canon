import { describe, expect, it } from 'vitest';
import { matchTag } from '../../scripts/release-version.mjs';
import { notesFor } from '../../scripts/release-notes.mjs';

describe('matchTag', () => {
  it('returns the version when the tag is v plus the version', () => {
    expect(matchTag('v0.1.1', '0.1.1')).toBe('0.1.1');
  });

  it('throws when the tag and version differ', () => {
    expect(() => matchTag('v0.1.2', '0.1.1')).toThrow(
      'Tag v0.1.2 does not match cli/package.json version 0.1.1. Bump the package version or retag.',
    );
  });

  it('throws for a tag without the leading v', () => {
    expect(() => matchTag('0.1.1', '0.1.1')).toThrow(
      'Tag 0.1.1 does not match cli/package.json version 0.1.1. Bump the package version or retag.',
    );
  });

  it('matches a prerelease tag', () => {
    expect(matchTag('v0.2.0-beta.1', '0.2.0-beta.1')).toBe('0.2.0-beta.1');
  });
});

const changelog = [
  '# Changelog',
  '',
  '## 0.1.10 · 2026-12-01',
  '',
  'Ten notes.',
  '',
  '## 0.1.1 · 2026-11-21',
  '',
  'First note.',
  'Second note.',
  '',
  '## 0.1.0',
  '',
  'First public release.',
  '',
  '## 0.0.9',
  '',
  '',
].join('\n');

describe('notesFor', () => {
  it('returns a middle section up to the next heading', () => {
    expect(notesFor(changelog, '0.1.1')).toBe('First note.\nSecond note.');
  });

  it('returns the last section', () => {
    expect(notesFor(changelog.replace('## 0.0.9\n', ''), '0.1.0')).toBe('First public release.');
  });

  it('does not match 0.1.1 against a 0.1.10 heading', () => {
    expect(notesFor(changelog, '0.1.10')).toBe('Ten notes.');
    expect(() => notesFor('## 0.1.10\n\nTen notes.\n', '0.1.1')).toThrow(
      'CHANGELOG.md has no "## 0.1.1" section. Add one before tagging.',
    );
  });

  it('throws when the section is missing', () => {
    expect(() => notesFor(changelog, '0.1.2')).toThrow(
      'CHANGELOG.md has no "## 0.1.2" section. Add one before tagging.',
    );
  });

  it('throws when the section is empty', () => {
    expect(() => notesFor(changelog, '0.0.9')).toThrow(
      'CHANGELOG.md has no "## 0.0.9" section. Add one before tagging.',
    );
  });
});
