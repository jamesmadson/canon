import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', '..', 'src/components/home/HeroScatter.astro'), 'utf8');
const rule = (selector: string, from = 0) => {
  const i = css.indexOf(`${selector} {`, from);
  return css.slice(i, css.indexOf('}', i));
};

describe('the hero panel lines up with the container', () => {
  it('has no sideways margin below 1100px, so it ends where the header does', () => {
    expect(rule('.hpanel')).toMatch(/margin: 28px 0 0;/);
  });

  it('beside the text, reaches out exactly as far as the hero pads its content in', () => {
    const hero = css.slice(css.indexOf('.hero.hero-b {', css.indexOf('@media (min-width: 1100px)')));
    const pad = /padding-inline: (\d+)px/.exec(hero.slice(0, hero.indexOf('}')));
    expect(pad).toBeTruthy();
    const wide = css.slice(css.indexOf('grid-area: 1 / 1 / -1 / -1;'));
    expect(wide.slice(0, wide.indexOf('}'))).toContain(`margin: -48px -${pad![1]}px 0;`);
  });

  it('keeps the window inside the panel at every width', () => {
    expect(rule('.sstage')).toMatch(/margin: 40px 12px 0;/);
  });
});
