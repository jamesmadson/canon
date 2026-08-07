import { describe, it, expect } from 'vitest';
import { parseSourceUrl } from '../../src/lib/parseSourceUrl';

describe('parseSourceUrl', () => {
  it('parses a subtree URL into owner, repo, and path', () => {
    const result = parseSourceUrl('https://github.com/anthropics/skills/tree/main/skills/frontend-design');
    expect(result).toEqual({ owner: 'anthropics', repo: 'skills', path: 'skills/frontend-design' });
  });

  it('parses a repo-root URL with an empty path', () => {
    const result = parseSourceUrl('https://github.com/dominikmartn/nothing-design-skill');
    expect(result).toEqual({ owner: 'dominikmartn', repo: 'nothing-design-skill', path: '' });
  });

  it('parses a repo-root URL whose repo name has no special characters', () => {
    const result = parseSourceUrl('https://github.com/jakubkrehel/make-interfaces-feel-better');
    expect(result).toEqual({ owner: 'jakubkrehel', repo: 'make-interfaces-feel-better', path: '' });
  });

  it('parses a subtree URL with a nested path', () => {
    const result = parseSourceUrl('https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng');
    expect(result).toEqual({ owner: 'emilkowalski', repo: 'skills', path: 'skills/emil-design-eng' });
  });

  it('throws on a non-GitHub URL', () => {
    expect(() => parseSourceUrl('https://gitlab.com/foo/bar')).toThrow();
  });

  it('throws on a malformed string', () => {
    expect(() => parseSourceUrl('not-a-url')).toThrow();
  });
});
