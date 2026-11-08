import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');

/** Top-level blocks as [prelude, body]. */
function blocks(source: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0;
  let start = 0;
  let prelude = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0) {
        prelude = source.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        out.push([prelude, source.slice(start, i)]);
        start = i + 1;
      }
    }
  }
  return out;
}

/** Style rules as {ctx, sel, body}, with media and layer blocks flattened. */
function rules(source: string, ctx = ''): Array<{ ctx: string; sel: string; body: string }> {
  const out: Array<{ ctx: string; sel: string; body: string }> = [];
  for (const [prelude, body] of blocks(source.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const p = prelude.replace(/^[\s\S]*;\s*/, '');
    if (p.startsWith('@media') || p.startsWith('@layer')) {
      out.push(...rules(body, `${ctx} ${p}`.trim()));
    } else if (!p.startsWith('@')) {
      out.push({ ctx, sel: p, body });
    }
  }
  return out;
}

const FINE = '(hover: hover) and (pointer: fine)';
const styleOf = (s: string) => [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/** Every .astro file under src/ except src/app/, which belongs to the hosted app. */
function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return full === join(root, 'src/app') ? [] : astroFiles(full);
    return e.name.endsWith('.astro') ? [full] : [];
  });
}
const astro = astroFiles(join(root, 'src')).map((f) => [f.slice(root.length + 1), readFileSync(f, 'utf8')] as const);
const sources: Array<[string, string]> = [
  ['src/styles/global.css', css],
  ...astro.map(([name, src]) => [name, styleOf(src)] as [string, string]),
];

describe('fields', () => {
  // Mutation: delete the coarse-pointer font-size rule for .field, or set it under 16px.
  it('show 16px or more under a coarse pointer', () => {
    const r = rules(css).find((x) => x.sel === '.field' && x.ctx.includes('(pointer: coarse)'));
    expect(r, 'a .field rule inside @media (pointer: coarse)').toBeTruthy();
    expect(Number(r!.body.match(/font-size:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(16);
  });
});

describe('browser surfaces', () => {
  // Mutation: remove ::selection, or change its background away from orange.
  it('selects in orange with ink type, as the dashboard does', () => {
    const r = rules(css).find((x) => x.sel === '::selection');
    expect(r?.body).toMatch(/background-color:\s*var\(--color-orange\)/);
    expect(r?.body).toMatch(/color:\s*#1A1918/i);
  });

  // Mutation: delete the caret-color declaration.
  it('draws the caret in orange on text entries', () => {
    const r = rules(css).find((x) => /input/.test(x.sel) && /textarea/.test(x.sel) && /caret-color/.test(x.body));
    expect(r?.body).toMatch(/caret-color:\s*var\(--color-orange\)/);
  });

  // Mutation: delete scrollbar-color, or hardcode hex values in it.
  it('colours scrollbars from the site tokens, so dark follows the theme', () => {
    const r = rules(css).find((x) => /scrollbar-color/.test(x.body));
    expect(r?.body).toMatch(/scrollbar-color:\s*var\(--color-input-border\)\s+var\(--color-recess\)/);
  });
});

describe('hover', () => {
  // Mutation: write any :hover selector in these files outside the fine-pointer media query.
  it('is gated by a fine pointer everywhere', () => {
    const bad: string[] = [];
    for (const [name, src] of sources) {
      for (const r of rules(src)) {
        if (/:hover/.test(r.sel) && !r.ctx.includes(FINE)) bad.push(`${name}: ${r.sel}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('tailwind hover utilities', () => {
  // Mutation: write hover: (not fine-hover:) in any class attribute, or drop the variant from global.css.
  it('use the fine-pointer variant, never bare hover:', () => {
    const bad: string[] = [];
    for (const [name, src] of astro) {
      for (const m of src.matchAll(/(?<![\w-])(?:[\w[\]=-]+:)*hover:[\w[\]/.%-]+/g)) {
        if (!m[0].includes('fine-hover:')) bad.push(`${name}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
    expect(css).toMatch(/@custom-variant fine-hover[\s\S]*?\(hover: hover\) and \(pointer: fine\)/);
  });
});

describe('transitions', () => {
  // Mutation: add width, color or background-color back to any transition.
  it('animate only transform and opacity', () => {
    const bad: string[] = [];
    for (const [name, src] of sources) {
      for (const r of rules(src)) {
        for (const m of r.body.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
          const props = m[1]
            .split(',')
            .map((p) => p.trim().split(/\s+/)[0])
            .filter((p) => p && p !== 'none' && !/^[\d.]/.test(p));
          // visibility and display are discrete flips that wait for an opacity fade.
          for (const p of props) if (!['transform', 'opacity', 'visibility', 'display'].includes(p)) bad.push(`${name}: ${r.sel} ${p}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  // Mutation: put width back into the .tick or ::after transition, or drop scaleX.
  it('grows the tick rules by scaleX from the start edge', () => {
    const all = rules(css);
    const tick = all.find((x) => x.sel === '.tick-link .tick');
    expect(tick?.body).toMatch(/transform-origin:\s*right/);
    expect(tick?.body).not.toMatch(/width:\s*14px/);
    const bar = all.find((x) => x.sel === '.tick-bar::after');
    expect(bar?.body).toMatch(/transform-origin:\s*left/);
    expect(bar?.body).toMatch(/transform:\s*scaleX\(0\)/);
    const hover = all.find((x) => x.sel.includes('.tick-bar:hover::after'));
    expect(hover?.body).toMatch(/scaleX\(1\)/);
  });
});

describe('press', () => {
  // Mutation: change .btn:active back to scale(0.96).
  it('scales to 0.97', () => {
    const r = rules(css).find((x) => x.sel === '.btn:active');
    expect(r?.body).toMatch(/scale\(0\.97\)/);
  });
});

describe('rise', () => {
  // Mutation: lengthen .rise past the 640ms reveal ceiling (D-81).
  it('stays within the one-time reveal ceiling', () => {
    const r = rules(css).find((x) => x.sel === '.rise');
    const ms = Number(r?.body.match(/animation:\s*rise\s+([\d.]+)s/)?.[1]) * 1000;
    expect(ms).toBeLessThanOrEqual(640);
  });
});

describe('fonts', () => {
  // Mutation: remove a fallback face, one of its overrides, or the fallback from a font stack.
  it('carry metric-matched fallbacks so swapping does not shift layout', () => {
    for (const family of ['Public Sans Fallback', 'IBM Plex Mono Fallback']) {
      const face = blocks(css.replace(/\/\*[\s\S]*?\*\//g, '')).find(([p, b]) => p === '@font-face' && b.includes(`"${family}"`));
      expect(face, family).toBeTruthy();
      for (const d of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
        expect(face![1], `${family} ${d}`).toContain(d);
      }
    }
    for (const token of ['--font-sans', '--font-mono', '--font-app', '--font-app-mono']) {
      expect(css).toMatch(new RegExp(`${token}:[^;]*Fallback`));
    }
  });
});

describe('words', () => {
  // Mutation: restore the word in the .label comment.
  it('does not call labels eyebrows', () => {
    expect(css.toLowerCase()).not.toContain('eyebrow');
  });
});

describe('prose colours', () => {
  // Mutation: drop --tw-prose-code from the .prose block, so inline code
  // falls back to Typography's fixed dark value and vanishes on the dark ground.
  it('draws every Typography text and border colour from the site tokens', () => {
    const prose = blocks(css).find(([prelude]) => prelude.endsWith('.prose'));
    expect(prose).toBeDefined();
    const body = prose![1];
    for (const name of ['body', 'headings', 'links', 'bold', 'counters', 'bullets', 'hr', 'quotes', 'quote-borders', 'captions', 'kbd', 'code', 'th-borders', 'td-borders']) {
      expect(body, name).toMatch(new RegExp(`--tw-prose-${name}:\\s*var\\(--color-`));
    }
  });
});
