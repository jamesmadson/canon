import { describe, expect, it } from 'vitest';
import { resolveHref, linksFrom, linkGraph, iaLayout, teaseSlots, orderPages } from '../../src/app/lib/bundle';

describe('resolveHref', () => {
  it('resolves relative links against the page folder', () => {
    expect(resolveHref('shop/cart.html', '../index.html')).toBe('index.html');
    expect(resolveHref('shop/cart.html', 'pay.html?x=1#top')).toBe('shop/pay.html');
    expect(resolveHref('index.html', './about/')).toBe('about/index.html');
    expect(resolveHref('a/b.html', '/c.html')).toBe('c.html');
  });
  it('ignores links that leave the prototype', () => {
    expect(resolveHref('index.html', 'https://example.com/')).toBeNull();
    expect(resolveHref('index.html', 'mailto:a@b.co')).toBeNull();
    expect(resolveHref('index.html', '#section')).toBeNull();
    expect(resolveHref('index.html', '../../out.html')).toBeNull();
  });
});

describe('linksFrom', () => {
  it('reads href targets from anchors and areas', () => {
    expect(linksFrom('<a href="a.html">A</a><area href=\'b.html\'><link href="c.css">')).toEqual(['a.html', 'b.html']);
  });
});

describe('linkGraph', () => {
  it('keeps only links between pages of the prototype, once each', () => {
    const pages = ['index.html', 'about.html', 'shop/cart.html'];
    const html: Record<string, string> = {
      'index.html': '<a href="about.html"></a><a href="about.html#x"></a><a href="shop/cart.html"></a><a href="nope.html"></a><a href="index.html"></a>',
      'about.html': '<a href="index.html"></a>',
      'shop/cart.html': '',
    };
    expect(linkGraph(pages, html)).toEqual([
      ['index.html', 'about.html'],
      ['index.html', 'shop/cart.html'],
      ['about.html', 'index.html'],
    ]);
  });
});

describe('orderPages', () => {
  it('puts the entry first, then pages in link order, then the rest alphabetically', () => {
    expect(orderPages(['z.html', 'b.html', 'index.html', 'a.html'], 'index.html', [['index.html', 'z.html']])).toEqual(['index.html', 'z.html', 'a.html', 'b.html']);
  });
});

describe('iaLayout', () => {
  const size = { w: 400, h: 300 };
  it('puts the entry in the first column and each link depth one column right', () => {
    const { positions, unlinked } = iaLayout(['index.html', 'a.html', 'b.html', 'c.html'], 'index.html', [['index.html', 'a.html'], ['index.html', 'b.html'], ['a.html', 'c.html']], size, { colGap: 200, rowGap: 100 });
    expect(positions['index.html']).toEqual({ x: 0, y: 0 });
    expect(positions['a.html']).toEqual({ x: 600, y: 0 });
    expect(positions['b.html']).toEqual({ x: 600, y: 400 });
    expect(positions['c.html']).toEqual({ x: 1200, y: 0 });
    expect(unlinked).toEqual([]);
  });
  it('gathers pages nothing links to in a last column', () => {
    const { positions, unlinked } = iaLayout(['index.html', 'a.html', 'orphan.html'], 'index.html', [['index.html', 'a.html']], size, { colGap: 200, rowGap: 100 });
    expect(unlinked).toEqual(['orphan.html']);
    expect(positions['orphan.html']).toEqual({ x: 1200, y: 0 });
  });
});

describe('teaseSlots', () => {
  it('goes right first, then alternates, and stops at four', () => {
    expect(teaseSlots(1)).toEqual([{ side: 'right', depth: 1 }]);
    expect(teaseSlots(6)).toEqual([
      { side: 'right', depth: 1 },
      { side: 'left', depth: 1 },
      { side: 'right', depth: 2 },
      { side: 'left', depth: 2 },
    ]);
  });
});

import { splitNav } from '../../src/app/lib/bundle';

describe('splitNav', () => {
  const pages = ['index.html', 'a.html', 'b.html', 'c.html', 'd.html'];
  const nav = (to: string) => pages.filter((p) => p !== to).map((p) => [p, to] as [string, string]);
  it('treats a target most pages link to as navigation, not flow', () => {
    const edges = [...nav('index.html'), ...nav('a.html'), ['b.html', 'd.html'] as [string, string]];
    const { flow, navigation } = splitNav(pages, edges);
    expect(flow).toEqual([['b.html', 'd.html']]);
    expect(navigation.length).toBe(8);
  });
  it('keeps the entry linking out as flow even when the target is in the nav', () => {
    const edges = [...nav('a.html')];
    const { flow } = splitNav(pages, edges, 'index.html');
    expect(flow).toEqual([['index.html', 'a.html']]);
  });
  it('leaves small prototypes alone', () => {
    const edges: [string, string][] = [['index.html', 'a.html'], ['a.html', 'index.html']];
    expect(splitNav(['index.html', 'a.html'], edges).flow).toEqual(edges);
  });
});
