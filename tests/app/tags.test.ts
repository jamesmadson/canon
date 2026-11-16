import { describe, expect, it } from 'vitest';
import { addTag, autoTags, hostTag, mergeTags, normalizeTag, removeTag, reuseTag } from '../../src/app/lib/tags';

describe('normalizeTag', () => {
  it('lowercases, drops punctuation and collapses spaces', () => {
    expect(normalizeTag('  Pricing!  Page ')).toBe('pricing page');
  });
  it('keeps / and -', () => {
    expect(normalizeTag('feat/annual-toggle')).toBe('feat/annual-toggle');
  });
  it('gives an empty string when nothing is left', () => {
    expect(normalizeTag('!!!')).toBe('');
  });
  it('cuts to 40 characters', () => {
    expect(normalizeTag('a'.repeat(60))).toHaveLength(40);
  });
});

describe('reuseTag', () => {
  it('reuses a tag whose significant words are inside the candidate', () => {
    expect(reuseTag('pricing page', ['pricing'])).toBe('pricing');
  });
  it('reuses a longer tag when the candidate is inside it', () => {
    expect(reuseTag('pricing', ['pricing page'])).toBe('pricing page');
  });
  it('matches case', () => {
    expect(reuseTag('Pricing', ['pricing'])).toBe('pricing');
  });
  it('keeps an unrelated candidate', () => {
    expect(reuseTag('checkout', ['pricing'])).toBe('checkout');
  });
  it('prefers an exact match over a word match', () => {
    expect(reuseTag('pricing', ['pricing page', 'pricing'])).toBe('pricing');
  });
  it('ignores a trailing s', () => {
    expect(reuseTag('prices', ['price'])).toBe('price');
  });
  it('compares stop-word-only tags as they are', () => {
    expect(reuseTag('the app', ['the site'])).toBe('the app');
    expect(reuseTag('the app', ['app the'])).toBe('app the');
  });
});

describe('autoTags', () => {
  it('is empty for no sources', () => {
    expect(autoTags({})).toEqual([]);
  });
  it('turns the tool into one tag', () => {
    expect(autoTags({ tool: 'Claude Code' })).toEqual(['claude code']);
  });
  it('builds the full example in order', () => {
    expect(autoTags({
      title: 'Pricing | Acme',
      headings: ['Choose a plan', 'Frequently asked questions about billing and invoices'],
      tool: 'Cursor', repo: 'acme-web', branch: 'feat/annual-toggle',
    })).toEqual(['cursor', 'acme-web', 'feat/annual-toggle', 'pricing', 'choose plan']);
  });
  it.each(['main', 'master', 'HEAD', 'trunk', 'develop'])('gives no tag for branch %s', (branch) => {
    expect(autoTags({ branch })).toEqual([]);
  });
  it.each([' | ', ' - ', ' · ', ': '])('splits the title on %j and uses the first part', (sep) => {
    expect(autoTags({ title: `Checkout${sep}Acme` })).toEqual(['checkout']);
  });
  it('skips long titles and headings', () => {
    expect(autoTags({ title: 'one two three four', headings: ['one two three four five'] })).toEqual([]);
  });
  it.each([
    'document', 'untitled', 'home', 'index', 'welcome', 'hello world', 'react app', 'vite app',
    'vite + react', 'vite + react + ts', 'next app', 'create next app', 'localhost',
  ])('skips the phrase %s', (title) => {
    expect(autoTags({ title })).toEqual([]);
    expect(autoTags({ headings: [title] })).toEqual([]);
  });
  it('takes at most 3 heading tags', () => {
    expect(autoTags({ headings: ['one', 'two', 'three', 'four'] })).toEqual(['one', 'two', 'three']);
  });
  it('takes at most 6 tags and no duplicates', () => {
    const tags = autoTags({ tool: 'a1', repo: 'b1', branch: 'c1', title: 'd1', headings: ['e1', 'f1', 'g1'] });
    expect(tags).toEqual(['a1', 'b1', 'c1', 'd1', 'e1', 'f1']);
    expect(autoTags({ tool: 'x', repo: 'x', title: 'x' })).toEqual(['x']);
  });
});

describe('mergeTags', () => {
  it('keeps removed tags out of the automatic ones', () => {
    expect(mergeTags({ current: ['pricing'], removed: ['cursor'], auto: ['cursor', 'checkout'] }))
      .toEqual({ tags: ['pricing', 'checkout'], removedTags: ['cursor'] });
  });
  it('lets a passed tag undo a removal', () => {
    expect(mergeTags({ removed: ['cursor'], passed: ['Cursor'] })).toEqual({ tags: ['cursor'], removedTags: [] });
  });
  it('reuses a project tag', () => {
    expect(mergeTags({ auto: ['pricing page'], projectTags: ['pricing'] }).tags).toEqual(['pricing']);
  });
  it('skips an automatic tag that reuses a removed tag', () => {
    expect(mergeTags({ removed: ['pricing'], auto: ['pricing page'] }).tags).toEqual([]);
  });
  it('treats case, spacing and punctuation as one tag', () => {
    expect(mergeTags({ passed: ['Pricing', ' pricing ', 'pricing!'] }).tags).toEqual(['pricing']);
  });
  it('drops empty tags and keeps order', () => {
    expect(mergeTags({ passed: ['b', '!!', 'a'], auto: ['c'] }).tags).toEqual(['b', 'a', 'c']);
  });
  it('stops at 12 tags', () => {
    const passed = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(mergeTags({ passed, auto: ['more'] }).tags).toHaveLength(12);
  });
});

describe('addTag and removeTag', () => {
  it('removing records the tag', () => {
    expect(removeTag({ tags: ['a', 'b'] }, 'A')).toEqual({ tags: ['b'], removedTags: ['a'] });
  });
  it('removing a tag that is not there changes nothing', () => {
    expect(removeTag({ tags: ['b'], removedTags: ['x'] }, 'a')).toEqual({ tags: ['b'], removedTags: ['x'] });
  });
  it('adding takes the tag out of the removed list', () => {
    expect(addTag({ tags: ['b'], removedTags: ['a'] }, 'A')).toEqual({ tags: ['b', 'a'], removedTags: [] });
  });
  it('adding reuses a project tag', () => {
    expect(addTag({ tags: [] }, 'pricing page', ['pricing']).tags).toEqual(['pricing']);
  });
});

describe('hostTag', () => {
  it.each([
    ['http://localhost:5173/x', 'localhost'],
    ['http://127.0.0.1:3000', 'localhost'],
    ['https://foo.vercel.app/', 'vercel'],
    ['https://www.figma.com/proto/1', 'figma'],
    ['https://team.github.io/x', 'github'],
    ['https://www.bbc.co.uk/x', 'bbc'],
    ['https://shop.example.com.au', 'example'],
    ['nope', ''],
  ])('%s gives %j', (url, tag) => {
    expect(hostTag(url)).toBe(tag);
  });
});
