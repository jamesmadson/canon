import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** The homepage as HTML, rendered by Astro in a child process. */
function render(waitlistUrl = '', hero = 'scatter'): string {
  const out = execFileSync('node', ['tests/helpers/renderHome.mjs', waitlistUrl, hero], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  return out.slice(out.indexOf('\u0001') + 1);
}

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>');

const WAITLIST = 'https://example.test/join';
let closed = '';
let open = '';
let terminal = '';
beforeAll(() => {
  closed = render('');
  open = render(WAITLIST);
  terminal = render('', 'terminal');
}, 120_000);

describe('the commands and feedback link', () => {
  // Mutation: change a character of the setup line.
  it('shows the setup line exactly, with a Copy button that has a name', () => {
    for (const html of [closed, open]) {
      expect(html).toContain('<code>claude mcp add canon -- npx -y usecanon mcp</code>');
      expect(html).toContain('data-copy="claude mcp add canon -- npx -y usecanon mcp"');
      expect(html).toContain('aria-label="Copy the setup command"');
    }
  });

  // Mutation: bring back the bare command or point the hero link elsewhere.
  it('has an Open the app link in the hero and no bare npx usecanon command', () => {
    for (const html of [closed, open]) {
      const hero = html.slice(html.indexOf('class="hero'), html.indexOf('id="projects"'));
      expect(hero).toMatch(/<a class="hbtn hbtn-primary" href="\/canon\/app\/"[^>]*>Open the app<\/a>/);
      expect(hero).toContain('claude mcp add canon -- npx -y usecanon mcp');
      expect(text(html).replaceAll('npx -y usecanon mcp', '')).not.toMatch(/npx\s+usecanon/);
      expect(html).not.toContain('data-copy="npx usecanon"');
    }
  });

  it('points Codex and Cursor readers at the README', () => {
    expect(closed).toContain('https://github.com/jamesmadson/canon#connect-your-agent');
  });

  // Mutation: point the feedback link anywhere else.
  it('sends feedback to GitHub issues', () => {
    expect(read('src/lib/site.ts')).toContain("ISSUES_URL = 'https://github.com/jamesmadson/canon/issues'");
    expect(read('src/components/home/SiteFooter.astro')).toContain('href={ISSUES_URL}');
  });
});

describe('the pictures', () => {
  // Mutation: bring the pricing example back, or change the prompt or the new card's name.
  it('tells the onboarding story in every picture', () => {
    for (const html of [closed, open]) {
      const t = text(html);
      expect(t).not.toMatch(/pricing|checkout/i);
      expect(t).toContain('Welcome, single screen');
      expect(html).toContain('data-type="Gather every onboarding prototype into one project."');
      expect(t).toContain('canon_add');
      expect(t).toContain('Welcome, three steps');
      expect(t).toContain('Invite a teammate');
      expect(t).toContain('Empty dashboard, with sample data');
      expect(t).toContain('Mobile sign-up');
      expect(t).toContain('welcome-single-screen.lovable.app');
      expect(t).toContain('Lovable · added just now');
      expect(t).not.toContain('v0.app');
      expect(t).toContain('mobile-sign-up.zip');
      expect(t).toContain('Cut this to two steps.');
      expect(t).toContain('Priya');
      expect(t).toContain('Try the single screen first?');
    }
  });

  it('keeps the terminal hero prompt on the earlier hero', () => {
    expect(terminal).toContain('data-type="Add the single screen version of the welcome flow"');
    expect(text(terminal)).toContain('“Welcome, single screen”');
  });

  // Mutation: rename the section back, or drop the project row under the three cards.
  it('labels the nav Projects', () => {
    expect(read('src/components/home/SectionNav.astro')).toContain("{ label: 'Projects', section: 'projects', href: '/#projects' }");
  });

  it('opens with projects: the heading, the nav label, and one project fed by three sources', () => {
    for (const html of [closed, open]) {
      const t = text(html);
      expect(t).toContain('Every prototype lands in a project.');
      expect(t).toContain('it is filed under the project it belongs to, beside its earlier versions.');
      expect(html).toContain('id="projects"');
      expect(t).not.toContain('Three ways in');
      const ways = html.slice(html.indexOf('id="projects"'), html.indexOf('id="agents"'));
      expect(ways).toContain('aria-label="The Onboarding project with five prototypes in a row');
      for (const src of ['Claude Code', 'Lovable', 'Figma Make', 'v0', 'zip']) expect(text(ways)).toContain(src);
    }
  });

  it('shows the agent filing prototypes as a move from No project to Onboarding', () => {
    const agents = closed.slice(closed.indexOf('id="agents"'), closed.indexOf('id="find"'));
    expect(agents).toContain('aria-label="Three loose prototypes under No project move into the Onboarding project');
    expect(text(agents)).toContain('No project');
    expect(text(agents)).toContain('Nothing loose');
  });

  it('searches for onboarding', () => {
    expect(closed).toMatch(/<span>onboarding<\/span>/);
    expect(closed).toContain('Search results for the word onboarding.');
  });

  // Mutation: drop the mask from the hero window, or put orange in a thumbnail.
  it('fades the hero window out and keeps thumbnails free of orange', () => {
    const css = read('src/components/home/HomeStyles.astro');
    expect(css).toMatch(/\.fade \{[^}]*overflow: hidden;[^}]*mask-image: linear-gradient\(to bottom/);
    expect(css).toMatch(/\.canvas|\.cmask \{[^}]*mask-image/);
    const thumbs = css.slice(css.indexOf('A prototype thumbnail'), css.indexOf('The terminal, a second window'));
    expect(thumbs).not.toMatch(/ff4f00|b83a00|var\(--color-orange\)/i);
    expect(read('src/lib/thumbs.ts')).not.toMatch(/ff4f00|orange/i);
  });

  it('keeps the terminal text at 13px or larger', () => {
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/\.term \{[^}]*font-size: 13px/);
  });
});

describe('the shared container', () => {
  // Mutation: give a page or the layout its own max-width and side padding again.
  it('uses one .wrap for the header, footer and every page, with no padding of its own', () => {
    expect(read('src/components/home/SiteHeader.astro')).toContain('class="wrap top"');
    expect(read('src/components/home/SiteFooter.astro')).toContain('class="wrap foot"');
    const layout = read('src/layouts/BaseLayout.astro');
    expect(layout).toContain("'wrap pt-8 pb-24 sm:pt-12'");
    expect(layout).not.toMatch(/max-w-6xl|px-6/);
    const css = read('src/components/home/HomeStyles.astro');
    expect(css).toMatch(/\n  \.wrap \{\s*max-width: 1240px;\s*margin-inline: auto;\s*padding-inline: 40px;/);
    expect(css).toMatch(/\.foot \{\s*padding-block: 72px 40px;/);
  });
});

describe('the footer wordmark', () => {
  // Mutation: go back to one letter per column, or loosen the tracking.
  it('sets Canon as one piece of text, sized to the container, with display tracking', () => {
    const footer = read('src/components/home/SiteFooter.astro');
    expect(footer).toContain('<span class="word" aria-hidden="true">Canon</span>');
    expect(footer).not.toContain('glyph');
    const css = read('src/components/home/HomeStyles.astro');
    const rule = css.match(/\n  \.word \{([^}]*)\}/)![1];
    expect(rule).toMatch(/font-size: [\d.]+cqw/);
    expect(rule).toMatch(/font-weight: 400/);
    expect(rule).toMatch(/font-kerning: normal/);
    const tracking = Number(rule.match(/letter-spacing: (-[\d.]+)em/)![1]);
    expect(tracking).toBeGreaterThanOrEqual(-0.05);
    expect(tracking).toBeLessThanOrEqual(-0.03);
  });
});

describe('the waitlist', () => {
  it('is set to the Formspree form, in one obvious place', () => {
    expect(read('src/lib/site.ts')).toMatch(/export const WAITLIST_URL = 'https:\/\/formspree\.io\/f\/xrpqqjqb';/);
  });

  // Mutation: render the form or the hero button while the address is empty.
  it('with no address shows no form and no waitlist button, and says it opens soon', () => {
    expect(closed).not.toContain('<form');
    expect(closed).not.toContain('<input');
    expect(text(closed)).not.toMatch(/Join the (hosted )?waitlist/);
    expect(text(closed)).toContain('The waitlist opens soon.');
    expect(text(closed)).toContain('Canon, hosted');
  });

  // Mutation: drop a field, or post somewhere else.
  it('with an address shows the hero button and the short form posting to it', () => {
    expect(text(open)).toContain('Join the hosted waitlist');
    expect(text(open)).not.toContain('The waitlist opens soon.');
    const form = open.match(/<form[^>]*>/)![0];
    expect(form).toContain(`action="${WAITLIST}"`);
    expect(form).toContain('method="post"');
    for (const name of ['email', '_gotcha']) {
      expect(open, name).toMatch(new RegExp(`<input[^>]*name="${name}"`));
    }
    const email = open.match(/<input[^>]*name="email"[^>]*>/)![0];
    expect(email).toContain('type="email"');
    expect(email).toContain('autocomplete="email"');
    expect(email).toMatch(/\brequired\b/);
    expect(open).toMatch(/<label for="wl-email">Email<\/label>/);
    expect(open).toMatch(/<[^>]*aria-live="polite"[^>]*data-waitlist-note|<[^>]*data-waitlist-note[^>]*aria-live="polite"/);
    expect(text(open)).toContain('Only your email address is sent, to Formspree, so we can tell you when hosting opens.');
    // The honeypot is hidden from people and from screen readers, and cannot be tabbed to.
    expect(open).toMatch(/<input[^>]*name="_gotcha"[^>]*tabindex="-1"/);
  });

  it('only treats an http or https address as open', async () => {
    const { waitlistOpen } = await import('../../src/lib/waitlist');
    expect(waitlistOpen('')).toBe(false);
    expect(waitlistOpen('mailto:someone@example.test')).toBe(false);
    expect(waitlistOpen(WAITLIST)).toBe(true);
  });
});

describe('what the copy claims', () => {
  // Mutation: say hosted sharing is available, or drop the not built yet line.
  it('says hosted is not built yet, in both states', () => {
    for (const html of [closed, open]) {
      const hosted = html.slice(html.indexOf('id="hosted"'));
      expect(text(hosted)).toContain('Not built yet.');
      expect(text(hosted.slice(0, hosted.indexOf('Canon, hosted')))).toContain('Available now.');
    }
  });

  it('promises no hosted sharing, accounts or payment outside the hosted card', () => {
    for (const html of [closed, open]) {
      const outside = text(html.slice(0, html.indexOf('id="hosted"')));
      expect(outside).not.toMatch(/\b(account required|sign up|sign in|log in|paid|pricing plan|subscribe)\b/i);
      expect(outside).not.toMatch(/\bshare (it|a project|your)\b/i);
      expect(outside).not.toContain('Hosted');
    }
  });

  it('shows no email address and no mailto link', () => {
    for (const html of [closed, open]) {
      expect(html).not.toContain('mailto:');
      expect(text(html)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    }
  });

  it('does not promise tagging for dropped zips or tag controls', () => {
    expect(text(closed)).not.toMatch(/tags? (every|each) (zip|folder)/i);
    expect(text(closed)).toContain('Your agent can add or remove tags, and tags filter Home in one click.');
  });
});

describe('words', () => {
  const sources = [
    ...readdirSync(join(root, 'src/components/home')).map((f) => `src/components/home/${f}`),
    'src/pages/index.astro',
    'src/layouts/BaseLayout.astro',
    'src/scripts/home.ts',
    'src/lib/site.ts',
    'src/lib/thumbs.ts',
    'src/lib/words.ts',
    'src/lib/waitlist.ts',
    'src/styles/global.css',
  ];

  // Mutation: put an em or en dash in any homepage file.
  it('has no em or en dashes', () => {
    for (const f of sources) expect(read(f), f).not.toMatch(/[\u2013\u2014]/);
    expect(closed + open).not.toMatch(/[\u2013\u2014]/);
  });

  // Mutation: type a straight apostrophe in prose.
  it('uses curly apostrophes and quotes in prose', () => {
    expect(text(closed)).not.toMatch(/[A-Za-z]'[A-Za-z]/);
    expect(text(closed)).not.toMatch(/(^|\s)"[A-Za-z]/);
    expect(text(closed)).toContain('what’s in it');
  });

  // Mutation: remove a tie() or a &nbsp; so a heading or short paragraph can end on one word.
  it('joins the last two words of headings and short paragraphs', () => {
    const bad: string[] = [];
    for (const m of closed.matchAll(/<(h[1-3]|p)\b[^>]*>([^<]*)<\/\1>/g)) {
      const body = m[2].trim();
      if (!body.includes(' ') && !body.includes('\u00a0') && !body.includes('&nbsp;')) continue;
      const compact = body.replace(/&nbsp;/g, '\u00a0');
      if (!/\S\u00a0\S+$/.test(compact) && compact.includes(' ')) bad.push(body);
    }
    expect(bad).toEqual([]);
  });

  // Mutation: go back to a line break, or drop the tie on a sentence's last two words.
  it('sets each sentence of a two-sentence heading in its own block span, tied at the end', () => {
    const heads = [...closed.matchAll(/<h([12])\b[^>]*>((?:<span class="sent">[^<]*<\/span>)+)<\/h\1>/g)];
    expect(heads).toHaveLength(3);
    for (const h of heads) {
      const spans = [...h[2].matchAll(/<span class="sent">([^<]*)<\/span>/g)].map((m) => m[1]);
      expect(spans).toHaveLength(2);
      for (const t of spans) expect(/\S[\u00a0\s]\S+$/.test(t.replace(/&nbsp;/g, '\u00a0')) || !t.includes(' ')).toBe(true);
    }
    expect(closed).not.toMatch(/<h[12]\b[^>]*>[^<]*<br/);
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/\.home \.sent \{\s*display: block;\s*text-wrap: balance/);
  });

  it('sets headings balanced and paragraphs pretty', () => {
    const css = read('src/components/home/HomeStyles.astro');
    expect(css).toMatch(/\.home h1,?[\s\S]*?text-wrap: balance/);
    expect(css).toMatch(/\.home h2 \{[^}]*text-wrap: balance/);
    expect(css).toMatch(/\.home p \{\s*text-wrap: pretty/);
  });
});

describe('structure and names', () => {
  // Mutation: add a second h1, or skip from h1 to h3.
  it('has one h1 and no skipped heading levels', () => {
    const levels = [...closed.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
  });

  // Mutation: add an icon-only button with no label.
  it('gives every button, input and picture a name', () => {
    for (const html of [closed, open]) {
      for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const name = /aria-label="[^"]+"/.test(m[1]) || text(m[2]).trim().length > 0;
        expect(name, m[0]).toBe(true);
      }
      for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
        const id = m[1].match(/\bid="([^"]+)"/)?.[1];
        const labelled = /aria-label="[^"]+"/.test(m[1]) || (id && html.includes(`for="${id}"`));
        expect(labelled, m[0]).toBeTruthy();
      }
      for (const m of html.matchAll(/<[a-z]+\b[^>]*role="img"[^>]*>/g)) expect(m[0], m[0]).toMatch(/aria-label="[^"]{8,}"/);
    }
  });

  it('asks for an email address only, with no extra fields', () => {
    const form = open.slice(open.indexOf('<form'), open.indexOf('</form>'));
    expect(form).not.toContain('<fieldset');
    expect(form).not.toContain('type="radio"');
  });
});

describe('motion', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const global = read('src/styles/global.css');
  const styles = read('src/components/home/HomeStyles.astro');
  const script = read('src/scripts/home.ts');

  // Mutation: let the rise move under reduced motion.
  it('rises 12px over 400ms on load, and only fades under reduced motion', () => {
    expect(global).toMatch(/@keyframes rise \{\s*from \{\s*opacity: 0;\s*transform: translateY\(12px\)/);
    expect(global).toMatch(/\.rise \{\s*animation: rise 0\.4s cubic-bezier\(0\.2, 0, 0, 1\) both/);
    expect(global).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.rise \{\s*animation-name: fade/);
  });

  // Mutation: start the demos without checking the preference.
  it('plays the demos only when motion is welcome, and they rest on their last frame', () => {
    expect(script).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(script).toContain('if (!still)');
    expect(script).toMatch(/if \(t >= TICKS\) clearInterval\(timer\)/);
    expect(layout).toContain("if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion')");
    // The first-frame styles only apply under .motion, so with no script or reduced motion nothing is hidden.
    for (const m of styles.matchAll(/(^|\n)\s*([^{}\n]*\[data-step\][^{}\n]*|[^{}\n]*\.kcard:not\(\.tidy\)[^{}\n]*) \{/g)) {
      expect(m[2], m[2]).toContain('.motion');
    }
  });

  // Mutation: drop the pause when the hero is off screen, or the fade before the reset.
  it('loops the hero demo, fading before the reset and pausing when unseen', () => {
    expect(script).toMatch(/function loop\(/);
    expect(script).toContain("root.classList.add('fading')");
    expect(script).toContain("root.classList.remove('fading')");
    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain('new IntersectionObserver');
    expect(styles).toMatch(/\.motion \.fading \[data-step\][\s\S]*?opacity: 0 !important;\s*transition: opacity 360ms var\(--ease\)/);
  });

  it('uses the one curve and moves only by transform and opacity', () => {
    expect(styles).not.toMatch(/ease-in|ease-out/);
    expect(styles).toContain('--ease: cubic-bezier(0.2, 0, 0, 1)');
    for (const m of styles.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
      for (const part of m[1].split(',')) expect(part.trim().split(/\s+/)[0]).toMatch(/^(transform|opacity)$/);
    }
    for (const m of styles.matchAll(/(\d+)ms/g)) {
      const ms = Number(m[1]);
      expect(ms >= 100 && ms <= 400, `${ms}ms`).toBe(true);
    }
    expect(styles).toMatch(/\.hbtn:active \{\s*transform: scale\(0\.97\)/);
  });

  it('draws the caret orange only in the ink panel, and never puts white type on orange', () => {
    const orange = [...styles.matchAll(/var\(--color-orange\)/g)];
    expect(orange).toHaveLength(1);
    expect(styles).toMatch(/\.big \.caret \{\s*background: var\(--color-orange\)/);
  });
});

describe('fonts and tokens', () => {
  const global = read('src/styles/global.css');
  it('uses Geist and IBM Plex Mono from the site, with no CDN', () => {
    expect(global).toMatch(/--font-sans: "Geist"/);
    expect(global).toMatch(/--font-mono: "IBM Plex Mono"/);
    for (const f of ['src/styles/global.css', 'src/layouts/BaseLayout.astro', 'src/components/home/HomeStyles.astro']) {
      expect(read(f), f).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\./);
    }
  });
  it('carries the D-133 light surfaces', () => {
    for (const hex of ['#FFFFFF', '#F6F3F0', '#EAE6E2', '#F0ECE9']) expect(global).toContain(hex);
  });
});
