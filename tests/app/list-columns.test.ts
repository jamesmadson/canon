import { describe, expect, it } from 'vitest';
import { css } from './helpers/css';

const ruleOf = (selector: string) => css.split('\n').find((l) => l.startsWith(`${selector} {`)) ?? '';
const shrink = (selector: string) => {
  const m = /flex:\s*(\S+)\s+(\S+)/.exec(ruleOf(selector));
  return m ? Number(m[2]) : NaN;
};

describe('a list row that is short of room', () => {
  it('gives way in a set order: summary, then source, then tags, with the name last', () => {
    expect(ruleOf('.prow .sm')).toMatch(/flex: 1 1 0; min-width: 0;/);
    expect(shrink('.prow .src')).toBeGreaterThan(shrink('.prow .tags'));
    expect(shrink('.prow .tags')).toBeGreaterThan(shrink('.prow .nm'));
  });

  it('gives the note the room of an empty summary instead of splitting it', () => {
    expect(css).toMatch(/\.prow \.sm:empty:has\(\+ \.pn\) \{ flex: 0 0 0; \}/);
  });

  it('lets a long note show in full in the view, with no clipped height', () => {
    expect(ruleOf('.view-note.view-note-text')).not.toMatch(/max-height|overflow/);
  });

  it('never fixes the width of the date, so a long label like "33 min ago" is not clipped', () => {
    const when = ruleOf('.prow .when');
    expect(when).toMatch(/flex: none/);
    expect(when).toMatch(/min-width: 76px/);
    expect(when).not.toMatch(/[^-]width: 76px/);
  });

  it('shows whole tags only, so a squeezed row hides the last ones rather than cutting them', () => {
    const tags = ruleOf('.prow .tags');
    expect(tags).toMatch(/flex-wrap: wrap/);
    expect(tags).toMatch(/overflow: hidden/);
  });
});
