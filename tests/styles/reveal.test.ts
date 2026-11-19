import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', 'index'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const css = read('src/components/home/HeroText.astro');
const script = read('src/scripts/mcp.ts');
const hero = () => html.slice(html.indexOf('class="htext"'), html.indexOf('class="hpanel"'));

describe('the Try the MCP reveal markup', () => {
  it('has two buttons in a row: the solid Open the app, and an outlined Try the MCP', () => {
    const cta = hero().match(/<div class="cta[^"]*">([\s\S]*?)<\/div>/)![1];
    expect(cta).toMatch(/<a class="hbtn hbtn-primary" href="\/canon\/app\/"[^>]*>Open the app<\/a>/);
    expect(cta).toMatch(/<button type="button" class="hbtn" data-mcp-toggle aria-expanded="false" aria-controls="mcp-panel">Try the MCP<\/button>/);
    expect(cta.match(/hbtn-primary/g)).toHaveLength(1);
  });

  it('points aria-controls at a panel that exists, directly after the buttons', () => {
    const h = hero();
    expect(h.match(/id="mcp-panel"/g)).toHaveLength(1);
    expect(h.indexOf('id="mcp-panel"')).toBeGreaterThan(h.indexOf('data-mcp-toggle'));
  });

  it('holds the label, the command with a named Copy button, and the one line with the README link', () => {
    const panel = hero().slice(hero().indexOf('id="mcp-panel"'));
    expect(panel).toMatch(/Connect your[\s ]agent/);
    expect(panel).toContain('<code>claude mcp add canon -- npx -y usecanon mcp</code>');
    expect(panel).toContain('data-copy="claude mcp add canon -- npx -y usecanon mcp"');
    expect(panel).toContain('aria-label="Copy the setup command"');
    expect(panel).toContain('One line connects Claude Code. Codex and Cursor take a few lines in their config, ');
    expect(panel).toMatch(/<a href="https:\/\/github\.com\/jamesmadson\/canon#connect-your-agent"[^>]*>written up in the(&nbsp;| )README<\/a>/);
  });

  it('keeps the free and open source line outside the panel, below it', () => {
    const h = hero();
    const fine = h.indexOf('Free and open source.');
    expect(fine).toBeGreaterThan(h.indexOf('id="mcp-panel"'));
    expect(h.slice(h.indexOf('id="mcp-panel"'), fine)).toMatch(/<\/div>\s*<\/div>\s*<\/div>\s*<p class="fine/);
  });

  it('is open without script: nothing hides it in the markup, and the button is hidden', () => {
    expect(hero()).not.toMatch(/id="mcp-panel"[^>]*hidden/);
    // The closed look only applies once the page has marked itself as scripted.
    expect(css).toMatch(/\.js \.mcp-panel \{[^}]*visibility: hidden/);
    expect(css).not.toMatch(/\n  \.mcp-panel \{[^}]*visibility: hidden/);
    expect(css).toMatch(/html:not\(\.js\) \[data-mcp-toggle\] \{\s*display: none/);
  });

  it('keeps the agent band beside its own copy field', () => {
    const agents = html.slice(html.indexOf('id="agents"'), html.indexOf('id="find"'));
    expect(agents).toContain('data-copy="claude mcp add canon -- npx -y usecanon mcp"');
  });
});

describe('the reveal panel styles', () => {
  const transitions = [...css.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]);

  it('inverts the surface with no border, radius 14', () => {
    expect(css).toMatch(/\.mcp \{[^}]*--mp-bg: #1a1918/);
    expect(css).not.toContain('data-app-theme');
    const panel = css.match(/\n  \.mcp-panel \{[^}]*\}/)![0];
    expect(panel).toContain('border-radius: 14px');
    expect(panel).toContain('background: var(--mp-bg)');
    expect(panel).not.toMatch(/border:|box-shadow/);
  });

  it('changes only transform, opacity, filter and (stepped) visibility, on the one curve', () => {
    expect(transitions.length).toBeGreaterThan(0);
    for (const t of transitions) {
      for (const part of t.split(',')) {
        const [prop, , curve] = part.trim().split(/\s+/);
        if (prop === 'none') continue;
        expect(prop).toMatch(/^(transform|opacity|filter|visibility)$/);
        expect(curve).toMatch(/^(var\(--ease\)|linear)$/);
      }
    }
    expect(css).not.toMatch(/transition:[^;]*(height|width|margin|top|left)/);
  });

  it('opens in 300 to 400ms, closes in 200ms, blurs at most 4px and staggers by 40ms', () => {
    expect(css).toMatch(/\.js \.mcp\.is-open \.mcp-panel \{[^}]*opacity 360ms/);
    expect(css).toMatch(/\.js \.mcp-panel \{[^}]*opacity 200ms/);
    for (const m of css.matchAll(/blur\((\d+)px\)/g)) expect(Number(m[1])).toBeLessThanOrEqual(4);
    const delays = [...css.matchAll(/:nth-child\((\d)\) \{\s*transition-delay: (\d+)ms/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(delays).toEqual([[1, 40], [2, 80], [3, 120]]);
    for (const m of css.matchAll(/(\d+)ms/g)) {
      const ms = Number(m[1]);
      if (ms === 0) continue;
      expect([40, 80, 120, 160, 200, 280, 360]).toContain(ms);
    }
    expect(script).toContain('OPEN_MS = 360');
    expect(script).toContain('CLOSE_MS = 200');
    expect(script).toContain("EASE = 'cubic-bezier(0.2, 0, 0, 1)'");
  });

  it('plays the height change by transform and moves nothing under reduced motion', () => {
    expect(script).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(script).toContain('still ? [] : movers');
    expect(script).toContain("{ transform: from }, { transform: 'none' }");
    expect(script).not.toMatch(/style\.(height|top|marginTop)/);
    const reduced = css.slice(css.indexOf('Reduced motion: the panel only fades'), css.indexOf('@media (max-width: 960px)'));
    expect(reduced).toMatch(/filter: none;\s*transform: none/);
    expect(reduced).toMatch(/\.js \.mcp-panel > \*[\s\S]*?transition: none/);
  });

  it('meets 4.5:1 for ink and muted text, and 3:1 for the Copy border', () => {
    const light = { bg: '#1a1918', ink: '#f3f0eb', muted: '#b0aba3' };
    for (const t of [light]) {
      expect(ratio(t.ink, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio('#85817a', t.bg)).toBeGreaterThanOrEqual(3);
    }
    expect(css).toContain('--mp-muted: #b0aba3');
    expect(css).toContain('--mp-line: #85817a');
  });

  it('draws its own focus ring so it shows on the inverted surface', () => {
    expect(css).toMatch(/\.home \.mcp-panel button:focus-visible \{\s*outline-color: var\(--mp-ink\)/);
  });
});

describe('the reveal script', () => {
  it('toggles aria-expanded, leaves focus on the button, and closes on Escape from inside', () => {
    expect(script).toContain("button!.setAttribute('aria-expanded', String(open))");
    expect(script).toContain("e.key !== 'Escape'");
    expect(script).toContain('box.contains(document.activeElement)');
    expect(script).toContain('button.focus()');
    // Opening never moves focus into the panel.
    expect(script).not.toMatch(/\.focus\(\)[\s\S]*set\(true\)/);
  });

  it('keeps the press scale on the button', () => {
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/\.hbtn:active \{\s*transform: scale\(0\.97\)/);
  });
});
