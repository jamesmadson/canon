import { describe, expect, it } from 'vitest';
import { css } from './helpers/css';

describe('the search field focus ring', () => {
  it('shows one ring on the search wrapper, the same as the palette search', () => {
    expect(css).toMatch(/\n\.search:focus-within \{ outline: 1\.5px solid var\(--focus\); outline-offset: 0; \}/);
    expect(css).toMatch(/\.switcher \.search:focus-within \{ outline: 1\.5px solid var\(--focus\); outline-offset: 0; \}/);
  });
  it('adds no second outline or box on the inner input', () => {
    expect(css).toMatch(/\.search input \{[^}]*outline: none/);
    expect(css).not.toMatch(/\.search input:focus/);
  });
});
