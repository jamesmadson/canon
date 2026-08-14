import { describe, it, expect } from 'vitest';
import { buildCanonAll, type CanonAllInput } from '../../src/lib/buildCanonAll';

const input: CanonAllInput = {
  routerBody: '# Canon\n\nRouting table goes here.\n',
  kits: [
    { slug: 'marketing-site', title: 'Marketing / Landing Site', body: '## Section A\n\nMarketing body.\n' },
    { slug: 'product-ui', title: 'Product UI / Dashboard', body: '## Section B\n\nProduct body.\n' },
    { slug: 'mobile-first-review', title: 'Mobile-First Review', body: '## Section C\n\nMobile body.\n' },
  ],
};

describe('buildCanonAll', () => {
  it('emits spec-valid frontmatter naming canon-all', () => {
    const out = buildCanonAll(input);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('name: canon-all');
    expect(out).toContain('description:');
  });

  it('includes the router body before any kit section', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Routing table goes here.');
    expect(out.indexOf('Routing table goes here.')).toBeLessThan(out.indexOf('Marketing body.'));
  });

  it('inlines every kit body verbatim', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Marketing body.');
    expect(out).toContain('Product body.');
    expect(out).toContain('Mobile body.');
  });

  it('keeps kits in the given order', () => {
    const out = buildCanonAll(input);
    expect(out.indexOf('Marketing body.')).toBeLessThan(out.indexOf('Product body.'));
    expect(out.indexOf('Product body.')).toBeLessThan(out.indexOf('Mobile body.'));
  });

  it('gives each kit a titled section heading', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Marketing / Landing Site');
    expect(out).toContain('Product UI / Dashboard');
    expect(out).toContain('Mobile-First Review');
  });

  it('is deterministic for identical input', () => {
    expect(buildCanonAll(input)).toEqual(buildCanonAll(input));
  });
});
