import { describe, expect, it } from 'vitest';
import { buildAddress, joinPath, parseAddress, safePath, type Address } from '../../src/app/lib/address';

describe('addresses', () => {
  it('round-trips every shape', () => {
    const shapes: Address[] = [
      { name: 'home' },
      { name: 'project', project: 'p1', tab: 'prototypes' },
      { name: 'project', project: 'p1', tab: 'boards' },
      { name: 'project', project: 'p1', tab: 'comments' },
      { name: 'board', board: 'b1', frame: null },
      { name: 'board', board: 'b1', frame: 'f1' },
      { name: 'bundle', frame: 'f1', from: null, page: null },
      { name: 'bundle', frame: 'f1', from: 'b1', page: 'a.html' },
      { name: 'full', frame: 'f1', board: 'b1', width: 390, path: '/checkout' },
      { name: 'full', frame: 'f1', board: null, width: 'fill', path: null },
    ];
    for (const a of shapes) expect(parseAddress(buildAddress(a))).toEqual(a);
    expect(buildAddress({ name: 'home' })).toBe('#/');
  });
  it("reads today's routes as parseRoute did", () => {
    expect(parseAddress('#/')).toEqual({ name: 'home' });
    expect(parseAddress('#/p/x')).toEqual({ name: 'project', project: 'x', tab: 'prototypes' });
    expect(parseAddress('#/p/x/boards')).toEqual({ name: 'project', project: 'x', tab: 'boards' });
    expect(parseAddress('#/p/x/comments')).toEqual({ name: 'project', project: 'x', tab: 'comments' });
    expect(parseAddress('#/b/x')).toEqual({ name: 'board', board: 'x', frame: null });
    expect(parseAddress('#/f/x?from=b&page=a.html')).toEqual({ name: 'bundle', frame: 'x', from: 'b', page: 'a.html' });
    expect(parseAddress('#pair=abc')).toEqual({ name: 'home' });
    expect(parseAddress('#nonsense')).toEqual({ name: 'home' });
    expect(parseAddress('')).toEqual({ name: 'home' });
  });
  it('accepts the older slashless and canon-mcp forms', () => {
    expect(parseAddress('#b/x')).toEqual({ name: 'board', board: 'x', frame: null });
    const a = parseAddress('#b/x/f/y/full?w=390&v=3');
    expect(a).toEqual({ name: 'full', frame: 'y', board: 'x', width: 390, path: null });
    expect('version' in a).toBe(false);
  });
  it('bad width is null', () => {
    for (const w of ['-3', '1.5', 'huge']) expect(parseAddress(`#/b/b/f/f/full?w=${w}`)).toMatchObject({ name: 'full', width: null });
  });
  it('ids are encoded', () => {
    const a: Address = { name: 'board', board: 'a/b c', frame: 'x/y' };
    expect(parseAddress(buildAddress(a))).toEqual(a);
  });
  it('safePath refuses anything that could leave the origin', () => {
    for (const p of ['//evil.example/x', 'https://evil.example', 'javascript:alert(1)', '\\\\evil', '', '/\t/evil.example', '/\n/evil.example'])
      expect(safePath(p)).toBeNull();
    expect(safePath('/checkout?step=2#top')).toBe('/checkout?step=2#top');
    expect(safePath('checkout')).toBe('/checkout');
  });
  it('joinPath keeps the frame origin', () => {
    expect(joinPath('http://localhost:5173/app/', '/checkout')).toBe('http://localhost:5173/checkout');
    expect(joinPath('http://localhost:5173/', null)).toBe('http://localhost:5173/');
  });
});
