import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
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
const ID = 'G-F4MW70DVD4';
const EVENT_NAMES = ['open_app', 'try_mcp_open', 'copy_setup', 'waitlist_submit', 'waitlist_done', 'nav_section', 'readme_click', 'github_click', 'consent_choice'];

beforeAll(() => {
  // Built apart from dist, so the owner's dev server and any other build are left alone.
  out = mkdtempSync(join(tmpdir(), 'canon-ga-'));
  execFileSync('npx', ['astro', 'build', '--outDir', out], { cwd: root, stdio: 'pipe' });
}, 300_000);

describe('analytics in the built site', () => {
  it('is on the marketing pages with the consent bar and the footer button', () => {
    for (const page of ['index.html', 'hero-a/index.html', 'skills/index.html', 'skills/lath/index.html']) {
      // The last two words of each line are tied with a non-breaking space.
      const html = text(join(out, page)).replace(/ |&nbsp;/g, ' ');
      expect(html, page).toContain(ID);
      expect(html, page).toContain('googletagmanager');
      expect(html, page).toMatch(/role="region"[^>]*aria-label="[^"]+"[^>]*data-ga-bar/);
      expect(html, page).toContain('Allow analytics cookies so we can count visits? The app never sends anything.');
      expect(html, page).toContain('This site counts visits with Google Analytics. The app does not.');
      expect(html, page).toContain('Cookie choice');
    }
  });

  it('is in no file of the app, nor in the scripts the app page loads', () => {
    const appFiles = files(join(out, 'app'));
    expect(appFiles.length).toBeGreaterThan(0);
    for (const f of appFiles) {
      const body = text(f);
      expect(body, relative(out, f)).not.toContain(ID);
      expect(body, relative(out, f)).not.toMatch(/googletagmanager|google-analytics|gtag\(/);
      for (const name of EVENT_NAMES) expect(body, `${relative(out, f)} ${name}`).not.toContain(name);
    }
    const appHtml = text(join(out, 'app/index.html'));
    expect(appHtml).not.toContain('data-ga-');
    const loaded = [...appHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1].replace(/^\/canon\//, ''));
    expect(loaded.length).toBeGreaterThan(0);
    for (const rel of loaded) {
      const body = text(join(out, rel));
      expect(body, rel).not.toMatch(/googletagmanager|G-F4MW70DVD4|gtag\(/);
      for (const name of EVENT_NAMES) expect(body, `${rel} ${name}`).not.toContain(name);
    }
  });

  it('marks the homepage links and buttons for the delegated listener', () => {
    const html = text(join(out, 'index.html'));
    expect(html).toMatch(/data-ga="open_app" data-ga-location="header"/);
    expect(html).toMatch(/data-ga="open_app" data-ga-location="hero"/);
    expect(html).toMatch(/data-ga="nav_section" data-ga-section="agents"/);
    expect(html).toMatch(/data-ga="github_click"/);
    expect(html).toMatch(/data-ga="readme_click"/);
    expect(html).toMatch(/data-ga-copy="hero"/);
    expect(html).toMatch(/data-ga-copy="agents"/);
  });

  it('keeps the app out of the consent code: the service worker and comments script too', () => {
    for (const f of ['app-sw.js', 'app-comments.js']) {
      expect(text(join(out, f)), f).not.toMatch(/googletagmanager|G-F4MW70DVD4|gtag\(/);
    }
  });
});

describe('analytics in the source', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  it('is included by the marketing layout only', () => {
    expect(read('src/layouts/BaseLayout.astro')).toContain("import Analytics from");
    for (const f of files(join(root, 'src/app')).concat(join(root, 'src/pages/app/index.astro'))) {
      expect(text(f), relative(root, f)).not.toMatch(/analytics|googletagmanager|GA_ID|gtag/i);
    }
    expect(read('src/pages/app/index.astro')).not.toContain('BaseLayout');
  });
  it('never grants an ad setting', () => {
    const src = read('src/lib/analytics.ts');
    expect(src).not.toMatch(/(ad_storage|ad_user_data|ad_personalization)['"]?:\s*['"]granted/);
    expect(src).toContain('allow_google_signals: false');
    expect(src).toContain('allow_ad_personalization_signals: false');
  });
  it('sets the measurement id in one place', () => {
    expect(read('src/lib/site.ts')).toContain(`export const GA_ID = '${ID}';`);
  });
});
