import { describe, expect, it } from 'vitest';
import { dropTags, extractPage } from '../../src/app/lib/page';
import { prepare } from '../../src/app/intake';
// @ts-expect-error: plain JavaScript, no declarations
import { extractPage as cliExtractPage } from '../../cli/src/mcp/page.js';

const HTML = '<!doctype html><title>Pricing page | Acme</title><script>var h="<h1>no</h1>"</script><h1>Annual plans</h1><h2>Team seats &amp; billing</h2><h2>   </h2>';

describe('extractPage', () => {
  it('reads the title and the headings in order', () => {
    expect(extractPage(HTML)).toEqual({ title: 'Pricing page | Acme', headings: ['Annual plans', 'Team seats & billing'] });
  });
  it('gives the same answer as the CLI reader', () => {
    for (const h of [HTML, '', '<h1>Unclosed', '<TITLE>Up</TITLE><H1 class="x">Big <b>one</b></H1>', '<!-- <h1>c</h1> --><h2>b</h2>' + '<h2>x</h2>'.repeat(30)]) {
      expect(extractPage(h)).toEqual(cliExtractPage(h));
    }
  });
  it('cuts the title to 300, a heading to 200 and the headings to 20', () => {
    const page = extractPage(`<title>${'t'.repeat(400)}</title>` + `<h2>${'h'.repeat(300)}</h2>`.repeat(25));
    expect(page.title).toHaveLength(300);
    expect(page.headings).toHaveLength(20);
    expect(page.headings[0]).toHaveLength(200);
  });
});

describe('dropTags', () => {
  it('gives the source tag, then the title and the headings, as a link would', () => {
    expect(dropTags(HTML, 'files', [])).toEqual(['files', 'pricing', 'annual plans', 'team seats billing']);
  });
  it('uses the folder source for a linked folder', () => {
    expect(dropTags('<title>Home</title>', 'folder', [])[0]).toBe('folder');
  });
  it('gives only the source tag when the page says nothing', () => {
    expect(dropTags('<p>hi</p>', 'files', [])).toEqual(['files']);
  });
  it('reuses a tag the project already has', () => {
    expect(dropTags('<title>Pricing</title>', 'files', ['pricing page'])).toEqual(['files', 'pricing page']);
  });
  it('does not bring back a tag the person removed', () => {
    expect(dropTags(HTML, 'files', [], ['pricing', 'files'])).toEqual(['annual plans', 'team seats billing']);
  });
});

describe('prepare', () => {
  it('reads the entry page once and hands back its text for tagging', async () => {
    const blob = new Blob([HTML], { type: 'text/html' });
    const p = await prepare({ name: 'site', files: [{ path: 'site/index.html', blob }, { path: 'site/a.css', blob: new Blob(['x']) }] });
    expect(p?.html).toBe(HTML);
  });
});
