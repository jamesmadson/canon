import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
let out = '';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const text = (p: string) => readFileSync(p, 'utf8');

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'canon-roadmap-'));
  execFileSync('npx', ['astro', 'build', '--outDir', out], { cwd: root, stdio: 'pipe' });
}, 300_000);

describe('the hidden roadmap page', () => {
  const page = () => text(join(out, 'roadmap/index.html')).replace(/ |&nbsp;/g, ' ');

  it('shows three columns and nine items', () => {
    const html = page();
    for (const name of ['Now', 'Next', 'Later']) expect(html).toMatch(new RegExp(`class="rm-name"[^>]*>${name}<`));
    expect((html.match(/<li>/g) ?? []).length).toBe(9);
    expect(html).toContain('Roadmap');
    expect(html).toContain('Join the waitlist');
    expect(html).toContain('https://github.com/jamesmadson/canon/issues/new');
  });

  it('asks crawlers to skip it', () => {
    expect(page()).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it('is linked from no other built page and is in no sitemap', () => {
    const others = files(out).filter((f) => /\.(html|xml|txt|js|json)$/.test(f) && !f.includes('/roadmap/'));
    for (const f of others) expect(text(f), f).not.toMatch(/\/roadmap\/?["'#?]/);
    for (const f of files(out).filter((f) => /sitemap/i.test(f))) expect(text(f)).not.toContain('roadmap');
    expect(existsSync(join(out, 'sitemap-index.xml'))).toBe(false);
  });
});
