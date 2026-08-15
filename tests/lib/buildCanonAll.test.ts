import { describe, it, expect } from 'vitest';
import { buildCanonAll, demoteHeadings, type CanonAllInput } from '../../src/lib/buildCanonAll';

const input: CanonAllInput = {
  routerBody: '# Canon\n\nRouting table goes here.\n',
  kits: [
    { slug: 'marketing-site', title: 'Marketing / Landing Site', body: '# Marketing / Landing Site — Kit Digest\n\n## Section A\n\nMarketing body.\n' },
    { slug: 'product-ui', title: 'Product UI / Dashboard', body: '# Product UI / Dashboard — Kit Digest\n\n## Section B\n\nProduct body.\n' },
    { slug: 'mobile-first-review', title: 'Mobile-First Review', body: '# Mobile-First Review — Kit Digest\n\n## Section C\n\nMobile body.\n' },
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

  it('wraps each kit under its own H2 and demotes the digest body underneath it', () => {
    const out = buildCanonAll(input);
    const lines = out.split('\n');

    // Exactly one H1 in the whole document (the router's own title) — every
    // kit body's H1 must have been demoted to H2 or deeper, and the kit
    // title must not appear twice at heading level (once as the `##`
    // wrapper, once again as the digest's own, now-demoted, H1).
    const h1Lines = lines.filter((line) => /^# (?!#)/.test(line));
    expect(h1Lines).toEqual(['# Canon']);

    expect(out).toContain('## Marketing / Landing Site');
    // The digest's own H1 ("# Marketing / Landing Site — Kit Digest") must
    // have been demoted to H2, not survive as a second, nested H1.
    expect(lines).not.toContain('# Marketing / Landing Site — Kit Digest');
    expect(lines).toContain('## Marketing / Landing Site — Kit Digest');
    // The digest's H2 ("## Section A") must have been demoted to H3.
    expect(lines).toContain('### Section A');
  });
});

describe('demoteHeadings', () => {
  it('demotes ATX headings of every level by one', () => {
    const out = demoteHeadings('# One\n## Two\n###### Six');
    expect(out.split('\n')).toEqual(['## One', '### Two', '####### Six']);
  });

  it('leaves non-heading lines untouched', () => {
    const out = demoteHeadings('Some text\n#not-a-heading\n    # indented past ATX rules');
    expect(out).toContain('Some text');
    expect(out).toContain('#not-a-heading');
  });

  it('does not demote headings inside fenced code blocks', () => {
    const out = demoteHeadings('# Real heading\n\n```\n# fake heading in a shell comment\n```\n\n## Also real');
    const lines = out.split('\n');
    expect(lines).toContain('## Real heading');
    expect(lines).toContain('# fake heading in a shell comment');
    expect(lines).toContain('### Also real');
  });

  it('does not demote headings inside tilde-fenced code blocks', () => {
    const out = demoteHeadings('~~~\n# fake\n~~~\n# Real');
    const lines = out.split('\n');
    expect(lines).toContain('# fake');
    expect(lines).toContain('## Real');
  });

  it('does not alter a lone # character inside an inline code span', () => {
    const out = demoteHeadings('Use the `#` character to comment.');
    expect(out).toBe('Use the `#` character to comment.');
  });

  it('is idempotent-safe to run on text with no headings', () => {
    expect(demoteHeadings('Just prose.\n\nMore prose.')).toBe('Just prose.\n\nMore prose.');
  });
});
