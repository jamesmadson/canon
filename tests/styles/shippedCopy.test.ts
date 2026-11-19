import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const flat = (s: string) => s.replace(/\u00a0/g, ' ');

let home = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', 'index'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  home = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

describe('the homepage describes what is shipped', () => {
  // Mutation: delete the stored copy sentence, or the Live switch, from WaysIn.astro.
  it('says a build from code keeps a stored copy, and shows it on one card', () => {
    const projects = flat(home.slice(home.indexOf('id="projects"'), home.indexOf('id="agents"')));
    expect(projects).toContain('keeps a stored copy that opens without its dev server running');
    expect(projects).toContain('a Live switch shows the running version when the server is on');
    expect(projects.match(/class="stored"/g)).toHaveLength(1);
  });

  // Mutation: put the version label back in the title, or drop the arrows.
  it('says a new round is the next version, and the bar reads Version 3 of 3 with arrows and four labelled actions', () => {
    const open = flat(home.slice(home.indexOf('id="open"'), home.indexOf('id="hosted"')));
    expect(open).toContain('A new round becomes the next version of the same prototype.');
    expect(open).toContain('opens as a map of its pages and the links between them');
    const bar = open.slice(open.indexOf('class="bbar"'));
    expect(bar).toContain('Version 3 of 3');
    expect(bar.match(/<svg/g)!.length).toBeGreaterThanOrEqual(3);
    for (const label of ['Note', 'Star', 'Versions', 'Archive']) expect(bar).toContain(label);
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/\.bbar \.bitem \{\s*border-radius: 999px/);
  });

  // Mutation: drop the tags sentence or the chip row.
  it('says tags filter Home in one click, with a row of tag chips above the results', () => {
    const find = flat(home.slice(home.indexOf('id="find"'), home.indexOf('id="open"')));
    expect(find).toContain('tags filter Home in one click');
    const row = find.slice(find.indexOf('class="tagrow"'), find.indexOf('class="res on"'));
    expect(row.match(/class="tag[ "]/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps to the page voice: no dashes in the new copy', () => {
    const copy = ['WaysIn', 'OpenBand', 'FindBand'].map((n) => read(`src/components/home/${n}.astro`)).join('\n');
    expect(copy).not.toMatch(new RegExp('[\\u2013\\u2014]'));
  });

  it('does not mention moving prototypes between projects', () => {
    expect(flat(home).toLowerCase()).not.toMatch(/move a prototype|moving prototypes|move prototypes between/);
  });
});
