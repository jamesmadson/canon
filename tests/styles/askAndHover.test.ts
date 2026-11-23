import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASK_LINKS, ASK_QUESTION, askHref } from '../../src/lib/askLinks';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const css = read('src/components/home/HomeStyles.astro');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderHome.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

describe('the ask row', () => {
  // Mutation: drop the repository from the question, or stop encoding it.
  it('asks about the public repository, encoded into each link', () => {
    expect(ASK_QUESTION).toContain('https://github.com/jamesmadson/canon');
    for (const l of ASK_LINKS) {
      expect(askHref(l)).toBe(l.base + encodeURIComponent(ASK_QUESTION));
    }
  });

  // Mutation: remove the row, or a link's visible name, or its new-tab safety.
  it('sits after the plans with one named link per assistant, opening in a new tab', () => {
    const plans = html.indexOf('id="hosted"');
    const ask = html.indexOf('id="h-ask"');
    expect(plans).toBeGreaterThan(-1);
    expect(ask).toBeGreaterThan(plans);
    const row = html.slice(ask, html.indexOf('</section>', ask));
    const links = [...row.matchAll(/<a class="ask-link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(links.map((m) => m[2].replace(/<[^>]+>/g, '').trim())).toEqual(['Claude', 'ChatGPT', 'Perplexity']);
    for (const m of links) expect(m[0]).toMatch(/target="_blank" rel="noopener"/);
    expect(links[0][1]).toBe(askHref(ASK_LINKS[0]).replaceAll('&', '&amp;'));
  });
});

describe('hover states', () => {
  const fine = css.slice(css.indexOf('/* Hover, for a fine pointer only.'));

  // Mutation: delete the hover rule for either kind of pill.
  it('deepens the fill of both pill buttons on hover', () => {
    expect(fine).toMatch(/\.hbtn-primary:hover \{\s*background: color-mix/);
    expect(fine).toMatch(/\.home \.hbtn:not\(\.hbtn-primary\):hover \{\s*background: var\(--color-recess\)/);
  });

  // Mutation: drop the underline change on hover, or the wordmark fade.
  it('darkens link underlines and fades the wordmark on hover', () => {
    expect(fine).toMatch(/\.home p a:hover,\s*\.links a:hover \{\s*text-decoration-color: currentColor/);
    expect(fine).toMatch(/\.lockup:hover \{\s*opacity: 0\.64/);
  });

  // Mutation: drop the stacking, and the wordmark's overhang takes the links' clicks.
  it('keeps the footer links above the overhanging wordmark', () => {
    expect(css).toMatch(/\n  \.links \{\s*position: relative;\s*z-index: 1;/);
  });

  // Mutation: remove the arrow from the skills link.
  it('gives the link to every skill an arrow that steps forward', () => {
    expect(html).toMatch(/See every skill and how to install(?:\s|&nbsp;| )them<span class="go" aria-hidden="true">→<\/span><\/a>/);
    expect(css).toMatch(/\.home a:hover \.go \{\s*transform: translateX\(3px\)/);
  });
});
