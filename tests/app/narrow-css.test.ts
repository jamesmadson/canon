import { describe, expect, it } from 'vitest';
import { body, css } from './helpers/css';

describe('the narrow screen styles', () => {
  it('replaces the app below 760px and stays out of the way above it', () => {
    expect(css).toMatch(/\.narrow \{ display: none; \}/);
    const rule = body(css, /@media \(max-width: 759\.98px\)\s*\{\s*\.shell \{ display: none; \}/);
    expect(rule).toMatch(/\.narrow \{[^}]*display: flex/);
  });
});
