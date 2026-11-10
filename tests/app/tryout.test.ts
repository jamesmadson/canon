import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRY_TARGETS, parseTry, tryDestination } from '../../src/app/lib/tryout';
import { personTone } from '../../src/app/lib/library';
import { SAMPLES, SAMPLE_SITE } from '../../src/app/samples';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('the try link', () => {
  // Mutation: parse "#try" only when it is the whole hash, or require a target.
  it('reads #try and #try/<target>', () => {
    expect(parseTry('#try')).toEqual({ target: null });
    expect(parseTry('#try/today-ring')).toEqual({ target: 'today-ring' });
  });

  // Mutation: let an unknown target through, or throw on it.
  it('opens the sample for a target it does not know', () => {
    expect(parseTry('#try/nope')).toEqual({ target: null });
    expect(parseTry('#try/__proto__')).toEqual({ target: null });
  });

  // Mutation: match addresses that merely start with try, like #trying or a pairing link.
  it('ignores every other address', () => {
    for (const h of ['', '#/', '#/p/try', '#trying', '#pair=x', '#try/a/b']) expect(parseTry(h), h).toBeNull();
  });

  // Mutation: rename a target's frame in TRY_TARGETS so it no longer exists in samples.ts.
  it('only points at prototypes that exist in the Fernwell sample', () => {
    const names = [...SAMPLES.map((s) => s.name), SAMPLE_SITE.name];
    for (const t of Object.values(TRY_TARGETS)) expect(names).toContain(t.frame);
  });

  // Mutation: send a pages target to the board route, or lose the project fallback.
  it('lands on the board for a screen, the page map for a site, and the project otherwise', () => {
    expect(tryDestination('p1', 'b1', { target: 'streak' }, 'f1')).toBe('#/b/b1/f/f1');
    expect(tryDestination('p1', 'b1', { target: 'fernwell-site' }, 'f2')).toBe('#/f/f2');
    expect(tryDestination('p1', 'b1', { target: null }, null)).toBe('#/p/p1');
    expect(tryDestination('p1', 'b1', { target: 'streak' }, null)).toBe('#/p/p1');
  });

  // Mutation: drop the projects.length guard in openTry, so a returning person gets the sample added.
  it('loads the sample only into an empty library, and clears the address', () => {
    const main = read('src/app/main.ts');
    expect(main).toMatch(/if \(getState\(\)\.projects\.length > 0\) return;\s*\n\s*const \{ project, board \} = await createSampleProject\(\)/);
    expect(main).toContain("history.replaceState(null, '', location.pathname + location.search);\n  return t;");
    expect(main).toContain('await openTry(tryAtLoad);');
  });
});

describe('the drop hint', () => {
  // Mutation: remove the hint from the library, or reword it.
  it('says in plain words what can be dropped', () => {
    expect(read('src/app/ui.ts')).toContain('<b>Drop a prototype here:</b> HTML, a zip or a folder');
  });
  // Mutation: stop the project view's drop handler from covering the library.
  it('sits inside the view that takes the drop', () => {
    const ui = read('src/app/ui.ts');
    expect(ui.indexOf('onDrop=${onDrop}')).toBeLessThan(ui.indexOf('<${Library} projectId'));
  });
  // Mutation: make the hint a solid fill or a modal.
  it('is dashed and quiet', () => {
    expect(read('src/app/app.css')).toMatch(/\.drop-hint \{[^}]*outline: 1px dashed/);
  });
});

describe('the app in Canon colours', () => {
  const css = read('src/app/app.css');
  const root_ = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  // Mutation: restore an olive ground or a blue accent in :root.
  it('takes the site dark tokens and orange accent', () => {
    for (const [name, hex] of [['--bg', '#151413'], ['--panel', '#1F1E1C'], ['--raised', '#262522'], ['--hover', '#2E2D2A'], ['--text', '#EDEBE6'], ['--soft', '#A29E96'], ['--input-border', '#77736B'], ['--accent', '#FF4F00']]) {
      expect(root_, name).toMatch(new RegExp(`${name}:\\s*${hex}`, 'i'));
    }
    expect(css).not.toMatch(/#4d8dff|#3ccf7f|#1b1c18|255, 246, 222/i);
  });
  // Mutation: put text-transform: uppercase back on any label.
  it('has no uppercase labels', () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
  });
  // Mutation: set white type on an orange fill in the app.
  it('puts ink, not white, on orange', () => {
    expect(css).toMatch(/\.avatar \{[^}]*background: var\(--accent\); color: var\(--ink-on-orange\)/);
    expect(css).toMatch(/\.pin\.draft \{ background: var\(--accent\); color: var\(--ink-on-orange\)/);
    expect(css).toMatch(/::selection \{ background: var\(--accent\); color: var\(--ink-on-orange\)/);
  });
  // Mutation: restore the 6px rectangle on .btn.primary or the grey disabled slab.
  it('draws the primary button as a pill with an outlined disabled state', () => {
    expect(css).toMatch(/\.btn\.primary \{ border-radius: 999px/);
    expect(css).toMatch(/\.btn\.primary\[disabled\] \{[^}]*background: none/);
  });
  // Mutation: bring back a hue palette for people.
  it('gives people only orange or pin discs', () => {
    const tones = new Set(['James M.', 'Ana', 'Lee', 'Priya', 'Sam', 'Zed', 'Q'].map(personTone));
    for (const t of tones) expect(['orange', 'pin']).toContain(t);
    expect(read('src/app/comments.ts')).not.toMatch(/personColor/);
  });
  // Mutation: set theme-color back to the olive.
  it('sets the browser theme colour to the ground', () => {
    expect(read('src/pages/app/index.astro')).toContain('<meta name="theme-color" content="#151413" />');
  });
});
