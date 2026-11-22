import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/app.css', 'utf8');

describe('icons sit at the centre of their buttons', () => {
  it('gives icon-only buttons no padding and no nudge on the glyph', () => {
    expect(css).toMatch(/:is\(\.ibtn, \.st, \.more, \.btn\.icon\) \{ padding: 0; \}/);
    expect(css).toMatch(/:is\(\.ibtn, \.st, \.more, \.btn\.icon\) > svg \{ margin: 0; flex: none; \}/);
  });

  it('puts the projects plus in the count column at the size of a count', () => {
    expect(css).toMatch(/\.sh \.ibtn \{ width: 24px; height: 24px; margin-right: -8px; \}/);
  });
});

describe('the prototype name keeps its room in the bottom bar', () => {
  it('never squeezes the rename button', () => {
    expect(css).toMatch(/\.vb-id \.vb-rename \{ flex: none; \}/);
  });

  it('lets the tags and then the version text go before the name is cut', () => {
    expect(css).toMatch(/@container \(max-width: 920px\) \{\s*\.vb-tags-wrap \{ display: none; \}/);
    expect(css).toMatch(/@container \(max-width: 820px\) \{\s*\.vb-ver \.vb-vtext \{ display: none; \}/);
  });
});
