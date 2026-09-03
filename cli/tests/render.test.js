import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PLACEHOLDER,
  encodeData,
  inlineThumbnail,
  buildDashboardData,
  readTemplate,
  renderDashboard,
  excerpt,
  describeRepo,
} from '../src/render.js';
import { defaultConfig } from '../src/config.js';

const config = { ...defaultConfig({ repo: 'demo', defaultBranch: 'main' }), prototypes: null };

const branches = [
  { name: 'main', lastCommit: '2026-09-01', sha: 'aaa1', subject: 'root' },
  { name: 'proto/today-ring', lastCommit: '2026-08-30', sha: 'bbb2', subject: 'ring' },
  { name: 'proto/today-ring/streaks-alt', lastCommit: '2026-08-01', sha: 'ccc3', subject: 'alt' },
  { name: 'feat/solo', lastCommit: '2026-01-01', sha: 'ddd4', subject: 'solo' },
];

const entries = [
  {
    date: '2026-08-30',
    slug: 'ring',
    about: ['ring'],
    participants: ['P-01'],
    said: '> the ring is the thing\n',
    open: true,
  },
  {
    date: '2026-08-29',
    slug: 'ring-again',
    about: ['ring'],
    participants: ['P-02'],
    said: '> agreed\n',
    open: true,
  },
];

function data() {
  return buildDashboardData({
    repo: 'demo',
    defaultBranch: 'main',
    branches,
    config,
    entries,
    generatedAt: '2026-09-01',
    forkDates: { 'proto/today-ring': '2026-08-20' },
  });
}

describe('encodeData', () => {
  it('cannot be broken out of by a closing script tag in the data', () => {
    const encoded = encodeData({ subject: '</script><img onerror=x>' });
    expect(encoded).not.toContain('</script');
    expect(encoded).not.toContain('<');
    expect(JSON.parse(encoded).subject).toBe('</script><img onerror=x>');
  });

  it('round trips ordinary text unchanged', () => {
    expect(JSON.parse(encodeData({ a: 'plain & simple' })).a).toBe('plain & simple');
  });
});

describe('describeRepo', () => {
  function scratch(files) {
    const dir = mkdtempSync(join(tmpdir(), 'canon-desc-'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  }

  it('prefers the package description, which was written to be one', () => {
    const dir = scratch({
      'package.json': JSON.stringify({ description: 'A gallery of skill files.' }),
      'README.md': '# Thing\n\nThe readme paragraph.\n',
    });
    expect(describeRepo(dir)).toBe('A gallery of skill files.');
  });

  it('falls back to the first real paragraph of the readme', () => {
    const dir = scratch({ 'README.md': '# Canon\n\nA curated gallery,\nwrapped over lines.\n\nMore.\n' });
    expect(describeRepo(dir)).toBe('A curated gallery, wrapped over lines.');
  });

  it('skips the heading, the badges and the rules', () => {
    const dir = scratch({
      'README.md': '# Canon\n\n[![badge](x)](y)\n\n---\n\nThe actual sentence.\n',
    });
    expect(describeRepo(dir)).toBe('The actual sentence.');
  });

  it('says nothing rather than inventing a sentence', () => {
    expect(describeRepo(scratch({}))).toBe(null);
    expect(describeRepo(scratch({ 'package.json': 'not json' }))).toBe(null);
    expect(describeRepo(scratch({ 'package.json': JSON.stringify({ name: 'x' }) }))).toBe(null);
  });
});

describe('the shell data', () => {
  function shellData(extra) {
    return buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches,
      config: { ...config, prototypes: null },
      entries,
      generatedAt: '2026-09-01',
      ...extra,
    });
  }

  it('carries the breadcrumb, the viewer and the people', () => {
    const built = shellData({
      remote: { owner: 'acme', repo: 'thing' },
      viewer: { name: 'Ada Lovelace', initials: 'AL' },
      people: [{ name: 'Ada Lovelace', commits: 4, lastCommit: '2026-09-01' }],
      description: 'A description.',
    });
    expect(built.remote).toEqual({ owner: 'acme', repo: 'thing' });
    expect(built.viewer.initials).toBe('AL');
    expect(built.people).toHaveLength(1);
    expect(built.description).toBe('A description.');
    expect(built.counts.people).toBe(1);
  });

  it('counts the candidates and the stale families for the strip', () => {
    const built = shellData({});
    // Three branches beside main in the fixture.
    expect(built.counts.candidates).toBe(3);
    expect(built.counts.stale).toBeGreaterThan(0);
    expect(built.counts.branches).toBe(3);
  });

  it('is null in each slot rather than absent when there is nothing to say', () => {
    const built = shellData({});
    expect(built.remote).toBe(null);
    expect(built.viewer).toBe(null);
    expect(built.description).toBe(null);
    expect(built.people).toEqual([]);
  });
});

describe('an orphaned node', () => {
  /**
   * A branch whose name says it has a parent, where that parent is a real
   * branch the person chose to leave out. It stands as its own root, and the
   * tree has to say why rather than drawing it as though it were one.
   */
  const orphanBranches = [
    { name: 'main', lastCommit: '2026-09-01', sha: 'aaa1', subject: 'root' },
    { name: 'proto/ring', lastCommit: '2026-09-01', sha: 'bbb2', subject: 'ring' },
    { name: 'proto/ring/alt', lastCommit: '2026-08-30', sha: 'ccc3', subject: 'alt' },
  ];

  function orphanData() {
    return buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches: orphanBranches,
      // proto/ring is a branch, and it was not selected.
      config: { ...config, prototypes: ['proto/ring/alt'] },
      entries: [],
      generatedAt: '2026-09-01',
    });
  }

  it('is marked in the data rather than quietly reparented', () => {
    const family = orphanData().families.find((f) => f.root === 'proto/ring/alt');
    expect(family).toBeDefined();
    const node = family.nodes.find((n) => n.name === 'proto/ring/alt');
    expect(node.orphaned).toBe(true);
    expect(node.parent).toBe(null);
  });

  it('leaves an ordinary root unmarked', () => {
    const family = data().families.find((f) => f.root === 'feat/solo');
    expect(family.nodes[0].orphaned).toBe(false);
  });

  it('is drawn with the caption that says why it stands alone', () => {
    const html = renderDashboard(orphanData());
    expect(html).toContain('parent not selected');
  });

  it('draws the stub edge only for a node that is orphaned', () => {
    const html = renderDashboard(orphanData());
    expect(html).toContain('orphan-stub');
  });
});

describe('excerpt', () => {
  it('drops the italic provenance line', () => {
    expect(excerpt('*Reply in a thread, 2026-08-27.*\n\nthe words themselves')).toBe(
      'the words themselves',
    );
  });

  /**
   * The provenance strip used to match across newlines, so it ran from the
   * first asterisk to the last one anywhere below it. A bullet list, which is
   * the ordinary way a summary is written, was eaten whole and the entry showed
   * an empty quote.
   */
  it('leaves a bullet list alone', () => {
    const said = ['* the first point', '* the second point', '* the third point'].join('\n');
    const text = excerpt(said);
    expect(text).toContain('the first point');
    expect(text).toContain('the second point');
    expect(text).toContain('the third point');
  });

  it('drops the provenance and keeps the bullets under it', () => {
    const said = ['*Filed at the terminal, 2026-09-01.*', '', '* one point', '* another point'].join('\n');
    const text = excerpt(said);
    expect(text).not.toContain('Filed at the terminal');
    expect(text).toContain('one point');
    expect(text).toContain('another point');
  });

  /**
   * The provenance in this repository wraps over three lines and carries the
   * source URL on the second, so a rule that only strips a single line leaves
   * that URL in the generated page.
   */
  it('drops a provenance block that wraps over several lines', () => {
    const said = [
      '*Observation of an essay',
      '(https://example.com/), read 2026-08-27. Summary, not',
      'quotation.*',
      '',
      'The argument itself.',
    ].join('\n');
    const text = excerpt(said);
    expect(text).toBe('The argument itself.');
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('keeps emphasis that sits inside a sentence', () => {
    expect(excerpt('the *whole* point is this')).toContain('the *whole* point is this');
  });

  it('prefers the blockquote when there is one', () => {
    expect(excerpt('*provenance*\n\n> the verbatim\n\nsome prose')).toBe('the verbatim');
  });
});

describe('inlineThumbnail', () => {
  it('is null when nothing is configured', () => {
    expect(inlineThumbnail('/repo', null)).toBeNull();
  });

  it('is null for a path that is not there, rather than a broken image', () => {
    expect(inlineThumbnail('/repo', 'screens/missing.png')).toBeNull();
  });

  it('is null for a file type it will not vouch for', () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-thumb-'));
    writeFileSync(join(root, 'shot.svg'), '<svg></svg>');
    expect(inlineThumbnail(root, 'shot.svg')).toBeNull();
  });

  it('inlines a raster file as a data URI', () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-thumb-'));
    writeFileSync(join(root, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(inlineThumbnail(root, 'shot.png')).toBe('data:image/png;base64,iVBORw==');
  });
});

describe('buildDashboardData', () => {
  const built = data();

  it('leaves the default branch out of the families', () => {
    expect(built.families.map((f) => f.root)).toEqual(['feat/solo', 'proto/today-ring']);
  });

  it('counts families, branches, entries and open topics', () => {
    expect(built.counts).toMatchObject({ families: 2, branches: 3, entries: 2, open: 1 });
    // The strip needs these two as well, and both are counted off the data.
    expect(built.counts.candidates).toBe(3);
    expect(typeof built.counts.stale).toBe('number');
  });

  it('computes staleness for the family and for every node', () => {
    const ring = built.families.find((f) => f.root === 'proto/today-ring');
    expect(ring.staleness.label).toBe('active 2 days');
    expect(ring.nodes.map((n) => n.staleness.state)).toEqual(['active', 'stale']);
  });

  it('marks a family whose root is a prefix rather than a branch', () => {
    const grouped = buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches: [
        { name: 'main', lastCommit: '2026-09-01' },
        { name: 'proto/ring/a', lastCommit: '2026-09-01' },
        { name: 'proto/ring/b', lastCommit: '2026-09-01' },
      ],
      config,
      entries: [],
      generatedAt: '2026-09-01',
    });
    expect(grouped.families).toHaveLength(1);
    expect(grouped.families[0]).toMatchObject({ root: 'proto/ring', virtualRoot: true, size: 2 });
    expect(built.families.every((f) => f.virtualRoot === false)).toBe(true);
  });

  it('carries the fork date when git could read one', () => {
    const ring = built.families.find((f) => f.root === 'proto/today-ring');
    expect(ring.forkedFrom).toBe('2026-08-20');
    expect(built.families.find((f) => f.root === 'feat/solo').forkedFrom).toBeNull();
  });

  it('counts people rather than entries in the open report', () => {
    expect(built.record.open).toEqual([
      { topic: 'ring', entries: 2, voices: 2, strength: 'a possible pattern', latest: '2026-08-30' },
    ]);
  });

  it('quotes the verbatim rather than the whole entry body', () => {
    expect(built.record.entries[0].quote).toBe('the ring is the thing');
  });

  it('drops the italic provenance line, which is where the source links live', () => {
    const withSource = buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches,
      config,
      generatedAt: '2026-09-01',
      entries: [
        {
          date: '2026-08-27',
          slug: 'essay',
          about: ['x'],
          participants: ['P-11'],
          open: false,
          said: '*Observation of an essay\n(https://example.com/), read 2026-08-27.*\n\nThe argument itself.',
        },
      ],
    });
    expect(withSource.record.entries[0].quote).toBe('The argument itself.');
  });

  it('shortens a long excerpt rather than carrying the whole entry', () => {
    const long = buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches,
      config,
      generatedAt: '2026-09-01',
      entries: [
        {
          date: '2026-08-27',
          slug: 'long',
          about: ['x'],
          participants: [],
          open: true,
          said: `> ${'word '.repeat(200)}`,
        },
      ],
    });
    const quote = long.record.entries[0].quote;
    expect(quote.length).toBeLessThanOrEqual(323);
    expect(quote.endsWith('...')).toBe(true);
  });

  it('respects a person selection over every branch', () => {
    const selected = buildDashboardData({
      repo: 'demo',
      defaultBranch: 'main',
      branches,
      config: { ...config, prototypes: ['proto/today-ring'] },
      entries,
      generatedAt: '2026-09-01',
    });
    expect(selected.families.map((f) => f.root)).toEqual(['proto/today-ring']);
  });
});

describe('renderDashboard', () => {
  const html = renderDashboard(data());

  it('leaves no placeholder behind', () => {
    expect(html).not.toContain(PLACEHOLDER);
    expect(readTemplate()).toContain(PLACEHOLDER);
  });

  it('embeds data a browser can parse back out', () => {
    const match = html.match(/<script id="canon-data" type="application\/json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    expect(JSON.parse(match[1]).repo).toBe('demo');
  });

  it('makes no network request of any kind', () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('fetch(');
    expect(html).not.toContain('XMLHttpRequest');
    expect(html).not.toContain('WebSocket');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('src="http');
  });

  it('falls back to system faces rather than loading a font', () => {
    expect(html).not.toContain('@font-face');
    expect(html).toContain('ui-sans-serif, system-ui');
    expect(html).toContain('ui-monospace');
  });

  it('carries both palettes with every token defined on the root', () => {
    const light = ['#eeede9', '#fafaf8', '#e4e2dc', '#d8d6d0', '#6e6b64', '#1a1815'];
    const dark = ['#191817', '#232120', '#2e2b29', '#35322f', '#9a968d', '#edebe6'];
    for (const value of [...light, ...dark]) expect(html.toLowerCase()).toContain(value);

    const rootBlock = html.slice(html.indexOf(':root {'), html.indexOf('@media (prefers-color-scheme: dark)'));
    for (const token of ['--ground', '--panel', '--recess', '--rule', '--ink-soft', '--ink']) {
      expect(rootBlock, `${token} must have a value outside the media query`).toContain(`${token}:`);
    }
  });

  it('keeps hue out of the chrome', () => {
    const chrome = html.slice(0, html.indexOf('</style>'));
    const colors = chrome.match(/#[0-9a-f]{6}/gi) || [];
    expect(colors.length).toBeGreaterThan(6);
    for (const color of colors) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      // The warm bias is the palette's one opinion and the widest of the six
      // tokens spreads 13 points across the channels. A hue spreads far more.
      expect(Math.max(r, g, b) - Math.min(r, g, b), `${color} carries a hue`).toBeLessThanOrEqual(14);
    }
  });

  it('meets the target size and shows focus', () => {
    expect(html).toContain('min-height: 44px');
    expect(html).toContain('focus-visible');
    expect(html).toContain('outline: 2px solid var(--ink)');
  });

  it('respects reduced motion and keeps wide content in its own scroller', () => {
    expect(html).toContain('@media (prefers-reduced-motion: reduce)');
    expect(html).toContain('overflow-x: hidden');
    expect(html).toContain('.scroller');
  });

  it('refuses to render if the template loses its placeholder', () => {
    expect(() => renderDashboard(data(), '<html></html>')).toThrow(/placeholder/);
  });
});
