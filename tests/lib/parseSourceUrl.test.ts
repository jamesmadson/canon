import { describe, it, expect } from 'vitest';
import { parseSourceUrl } from '../../src/lib/parseSourceUrl';

describe('parseSourceUrl', () => {
  it('parses a subtree URL into owner, repo, and path', () => {
    const result = parseSourceUrl('https://github.com/jamesmadson/canon/tree/main/plugin/deter');
    expect(result).toEqual({ owner: 'jamesmadson', repo: 'canon', path: 'plugin/deter' });
  });

  it('parses a repo-root URL with an empty path', () => {
    const result = parseSourceUrl('https://github.com/example-owner/example-design-skill');
    expect(result).toEqual({ owner: 'example-owner', repo: 'example-design-skill', path: '' });
  });

  it('parses a repo-root URL whose repo name has no special characters', () => {
    const result = parseSourceUrl('https://github.com/jamesmadson/canon');
    expect(result).toEqual({ owner: 'jamesmadson', repo: 'canon', path: '' });
  });

  it('parses a subtree URL with a nested path', () => {
    const result = parseSourceUrl('https://github.com/jamesmadson/canon/tree/main/plugin/graft/skills/graft');
    expect(result).toEqual({ owner: 'jamesmadson', repo: 'canon', path: 'plugin/graft/skills/graft' });
  });

  it('throws on a non-GitHub URL', () => {
    expect(() => parseSourceUrl('https://gitlab.com/foo/bar')).toThrow();
  });

  it('throws on a malformed string', () => {
    expect(() => parseSourceUrl('not-a-url')).toThrow();
  });
});
