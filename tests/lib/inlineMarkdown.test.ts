import { describe, it, expect } from 'vitest';
import { renderInlineMarkdown } from '../../src/lib/inlineMarkdown';
import { DEMO_CASES } from '../../src/data/demoCases';

describe('renderInlineMarkdown', () => {
  it('escapes HTML special characters', () => {
    expect(renderInlineMarkdown('a < b & c > d "quoted" \'single\'')).toBe(
      'a &lt; b &amp; c &gt; d &quot;quoted&quot; &#39;single&#39;'
    );
  });

  it('renders `code` spans as <code> elements', () => {
    expect(renderInlineMarkdown('animate `transform` and `opacity` only')).toBe(
      'animate <code class="font-mono text-[0.85em]">transform</code> and <code class="font-mono text-[0.85em]">opacity</code> only'
    );
  });

  it('renders **bold** as <strong>', () => {
    expect(renderInlineMarkdown('**Tap targets**: matter')).toBe('<strong>Tap targets</strong>: matter');
  });

  it('renders *italic* as <em>', () => {
    expect(renderInlineMarkdown('the *functional* hit area')).toBe('the <em>functional</em> hit area');
  });

  it('handles bold and italic in the same line without cross-matching', () => {
    expect(renderInlineMarkdown('**Tap targets**: check the *functional* hit area')).toBe(
      '<strong>Tap targets</strong>: check the <em>functional</em> hit area'
    );
  });

  it('never leaves a literal backtick or asterisk in a rendered DEMO_CASES excerpt', () => {
    for (const demoCase of DEMO_CASES) {
      for (const line of demoCase.excerpt) {
        const rendered = renderInlineMarkdown(line);
        expect(rendered.includes('`'), `stray backtick in rendered "${line}"`).toBe(false);
        expect(rendered.includes('*'), `stray asterisk in rendered "${line}"`).toBe(false);
      }
    }
  });

  it('escapes text before substituting, so escaped markup cannot be reintroduced by input', () => {
    expect(renderInlineMarkdown('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});
