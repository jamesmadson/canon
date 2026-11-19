import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSite } from '../helpers/buildSite';

let out = '';

function pages(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, found);
    else if (name.endsWith('.html')) found.push(p);
  }
  return found;
}

// A page's own markup plus every stylesheet it links, so the app's CSS (which has its own theme handling) is only counted for the app page.
function styleOf(file: string): string {
  const html = readFileSync(file, 'utf8');
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/^\/canon\//, ''));
  return html + linked.map((href) => readFileSync(join(out, href), 'utf8')).join('\n');
}

beforeAll(() => {
  out = buildSite('canon-light');
}, 240_000);
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('the marketing site is light only', () => {
  // Mutation: put a prefers-color-scheme: dark rule back into any site style or preview page.
  it('has no dark colour-scheme rule in any built site page, its stylesheets or its previews', () => {
    const files = pages(out).filter((f) => !f.startsWith(join(out, 'app')));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const text = styleOf(f);
      expect(text, f).not.toMatch(/prefers-color-scheme:\s*dark/);
      expect(text, f).not.toMatch(/data-app-theme/);
    }
  });

  it('declares color-scheme light on the home page and still builds the app', () => {
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(existsSync(join(out, 'app', 'index.html'))).toBe(true);
  });
});
