import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/app.css', 'utf8');
const rule = (selector: RegExp) => selector.exec(css)?.[1] ?? '';

describe('the main panel', () => {
  const main = rule(/^\.main \{([^}]*)\}/m);
  it('sits flush on the right and bottom edges', () => {
    expect(main).toMatch(/margin: 8px 0 0 0/);
    expect(main).toMatch(/border-radius: 11px 0 0 0/);
  });
  it('has no outline', () => {
    expect(main).not.toMatch(/box-shadow/);
    expect(main).not.toMatch(/border:/);
  });
});

describe('tag filter chips', () => {
  it('use a fill when chosen and no outline otherwise', () => {
    expect(rule(/\.fchip \{([^}]*)\}/)).not.toMatch(/box-shadow/);
  });
});

describe('utility buttons such as Filter', () => {
  it('use a light fill and no outline', () => {
    const util = rule(/^\.util \{([^}]*)\}/m);
    expect(util).toMatch(/border: 0/);
    expect(util).toMatch(/background: var\(--panel\)/);
  });
});

describe('the mono face', () => {
  it('is Geist Mono, served from the bundled file, with no IBM Plex Mono left', () => {
    expect(css).toMatch(/--mono: "Geist Mono"/);
    expect(css).toMatch(/font-family: "Geist Mono";\s*font-weight: 400 500;\s*src: url\("\/canon\/fonts\/geist\/GeistMono-Regular\.woff2"\)/);
    expect(css).not.toMatch(/Plex/);
  });
});
