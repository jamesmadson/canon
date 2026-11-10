import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const css = read('src/styles/global.css');
const index = read('src/pages/index.astro');

describe('the homepage without rules', () => {
  // Mutation: put a border-top back on .feature, or border-b on the skills list.
  it('draws no separator lines between sections', () => {
    expect(index).not.toMatch(/\.feature\s*\{[^}]*border/);
    expect(index).not.toMatch(/border-(t|b)\b|border-rule/);
    expect(read('src/components/SkillStep.astro')).not.toMatch(/border-(t|b)\b|border-rule/);
  });
  // Mutation: restore the mono 11px line under the hero buttons.
  it('says something useful under the hero buttons, in Public Sans at 16px', () => {
    expect(index).toContain('Opens with a sample project. Drop in your own HTML, zips or folders. Nothing is&nbsp;uploaded.');
    expect(index).not.toMatch(/font-mono text-\[11px\]/);
  });
  // Mutation: point a Try it now link back at the bare app address.
  it('sends both Try it now links to the sample', () => {
    expect(index.match(/withBase\('\/app\/#try'\)/g)?.length).toBe(2);
  });
  // Mutation: remove the display word or drop it to a smaller step.
  it('sets Skills large above the skills heading, and puts the orange dot beside each name', () => {
    expect(index).toMatch(/<p class="display-xl" aria-hidden="true">Skills<\/p>/);
    expect(read('src/components/SkillStep.astro')).toContain('<Wordmark size={10} />{name}');
  });
});

describe('the MCP step tabs', () => {
  const mcp = read('src/components/McpWalkthrough.astro');
  // Mutation: move .controls back under .panel.
  it('sit above the window', () => {
    expect(mcp.indexOf('data-mcp-nav')).toBeLessThan(mcp.indexOf('data-mcp-panel'));
  });
  // Mutation: shrink .tab-cap back to 12px.
  it('read at 16px', () => {
    expect(mcp).toMatch(/\.tab-cap \{[^}]*font-size: 16px/);
  });
  // Mutation: drop the tablist role or aria-selected from the tabs.
  it('stay a tablist', () => {
    expect(mcp).toContain('role="tablist"');
    expect(mcp).toContain('role="tab"');
    expect(mcp).toContain('aria-controls={`mcp-scene-${i}`}');
  });
});

describe('the header logo', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  // Mutation: turn the selection back into a keyframe animation, which restarts on re-entry.
  it('plays by transition, not by keyframes', () => {
    const block = css.slice(css.indexOf('.home-mark-name {'), css.indexOf('/* ── The rail'));
    expect(block).not.toMatch(/@keyframes|animation:/);
    expect(block).toMatch(/\.home-mark-name::before \{[^}]*transition:[^}]*transform 320ms cubic-bezier\(0\.2, 0, 0, 1\)/);
  });
  // Mutation: give the exit its own curve, or use the spring on the way back.
  it('uses the one curve in both directions', () => {
    const block = css.slice(css.indexOf('.home-mark-name {'), css.indexOf('/* ── The rail'));
    expect(block).not.toContain('var(--ease-glide)');
    expect(block).not.toMatch(/ease-in|ease-out|ease\b/);
  });
  // Mutation: drop the flowchart, or lose one of the five letters.
  it('lays out c a n o n as a flowchart on the even hovers', () => {
    expect(layout).toMatch(/>c<\/i>[\s\S]*>a<\/i>[\s\S]*>n<\/i>[\s\S]*fn hub[\s\S]*>n<\/i>/);
    expect(layout).toContain("count++ % 2 === 0 ? 'select' : 'flow'");
    expect(css).toContain(".home-mark[data-show='flow'] .home-mark-flow > *");
  });
  // Mutation: let keyboard focus play the flowchart.
  it('plays the selection only for keyboard focus', () => {
    expect(css).toMatch(/\.home-mark:focus-visible \.home-mark-name::before,\s*\.home-mark\[data-show='select'\] \.home-mark-name::before/);
    expect(css).not.toMatch(/:focus-visible[^{]*home-mark-flow/);
  });
  // Mutation: let a touch pointer play it, or restart the pick when pointing back in mid-exit.
  it('is for a mouse, and keeps its turn when pointed at again mid-exit', () => {
    expect(layout).toContain("e.pointerType !== 'mouse'");
    expect(layout).toContain('performance.now() - left > 600');
  });
  // Mutation: let transforms survive under reduced motion.
  it('drops the movement and keeps the fades with reduced motion', () => {
    const rm = css.slice(css.indexOf('/* Reduced motion keeps the fades and drops every movement. */'));
    expect(rm.slice(0, rm.indexOf('/* ── The rail'))).toMatch(/home-mark-flow > \*[\s\S]*transform: none !important/);
  });
});

describe('the footer dot', () => {
  const strip = read('src/components/ClosingStrip.astro');
  // Mutation: remove the arrow, or draw it in white.
  it('shows an ink up arrow inside the dot on hover', () => {
    expect(strip).toContain('class="giant-arrow"');
    expect(css).toMatch(/\.giant-arrow \{[^}]*stroke: #1A1918/);
    expect(css).toMatch(/\.giant-dot:hover \.giant-arrow \{\s*opacity: 1/);
  });
  // Mutation: move the ring or the lift outside the fine-pointer query.
  it('sends one soft ring out and lifts, for a fine pointer', () => {
    const fine = css.slice(css.indexOf('@media (hover: hover) and (pointer: fine) {\n  .closing-strip .giant-dot:hover'));
    expect(fine.slice(0, 700)).toMatch(/giant-dot:hover::after[\s\S]*giant-ring 700ms cubic-bezier\(0\.2, 0, 0, 1\)/);
    expect(fine.slice(0, 700)).toMatch(/translateY\(-0\.04em\)/);
  });
  // Mutation: change the press back to a colour change, or to a different scale.
  it('presses to 0.97', () => {
    expect(css).toMatch(/\.giant-dot:active \{\s*transform: translateY\(-0\.04em\) scale\(0\.97\)/);
  });
  // Mutation: stop adding .rising on click, or add it under reduced motion.
  it('rises on click unless motion is unwelcome', () => {
    expect(strip).toContain("if (!still.matches) {\n      toTop.classList.add('rising');");
    expect(css).toMatch(/\.giant-dot\.rising \{\s*transform: translateY\(-0\.16em\)/);
  });
  // Mutation: let the dot move with reduced motion.
  it('keeps only the arrow fade with reduced motion', () => {
    const rm = css.slice(css.indexOf('.closing-strip .giant-dot {\n    transform: none !important'));
    expect(rm.slice(0, 400)).toContain('transform: none !important');
    expect(rm.slice(0, 600)).toContain('animation: none !important');
  });
});

describe('the Lath preview', () => {
  const html = read('public/previews/lath/checkout-payment.html');
  // Mutation: restore --pin:#B83A00 or white numbers.
  it('pins in Canon orange with ink numbers', () => {
    expect(html).toContain('--pin:#FF4F00;');
    expect(html).toContain('background:var(--pin);color:#1A1918;');
  });
});

describe('the hero board', () => {
  const hero = read('src/components/HeroBoard.astro');
  // Mutation: rename a card to a name the sample does not have.
  it('draws only prototypes from the Fernwell sample', () => {
    for (const n of ['Today ring', 'Fernwell site', 'Held lane, option B', 'Streak']) expect(hero).toContain(`name: '${n}'`);
  });
  // Mutation: make a card a div again, or send it to the bare app address.
  it('makes each card a real link into the sample with an accessible name', () => {
    expect(hero).toContain('href={withBase(`/app/#try/${f.to}`)}');
    expect(hero).toContain('aria-label={`Open ${f.name} in the sample project`}');
    expect(hero).toMatch(/<a\s+class="item rise"/);
    expect(hero).not.toContain('role="img"');
  });
  // Mutation: remove the focus ring from the cards.
  it('has a visible focus ring', () => {
    expect(hero).toMatch(/\.item:focus-visible \{[^}]*outline: 2px solid var\(--color-ink\)/);
  });
  // Mutation: fan on any hover, not only a fine pointer, or on focus alone.
  it('fans on a fine-pointer hover or on keyboard focus', () => {
    expect(hero).toMatch(/\.item:focus-visible \.sheet \{\s*transform: var\(--out\)/);
    expect(hero).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.item:hover \.sheet \{\s*transform: var\(--out\)/);
  });
  // Mutation: lengthen the way in past 320ms or make the way out slower than the way in.
  it('goes in at 280ms and out at 200ms on the one curve', () => {
    expect(hero).toMatch(/\.sheet \{[^}]*transition: transform 200ms cubic-bezier\(0\.2, 0, 0, 1\)/);
    expect(hero).toContain('transition-duration: 280ms;');
  });
  // Mutation: animate anything but transform and opacity on the fan.
  it('moves only by transform and opacity', () => {
    const style = hero.slice(hero.indexOf('<style>'));
    for (const m of style.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) expect(m[1]).toMatch(/^(none|transform|opacity)\b/);
  });
  // Mutation: let the sheets move under reduced motion.
  it('does not fan with reduced motion, and fades the edge instead', () => {
    const rm = hero.slice(hero.indexOf('@media (prefers-reduced-motion: reduce) {'));
    expect(rm).toContain('transform: var(--rest) !important;');
    expect(rm).toMatch(/\.edge \{[\s\S]*opacity: 0;/);
  });
  // Mutation: set the card labels back in mono.
  it('keeps mono for nothing on the board, since no label is an address', () => {
    const style = hero.slice(hero.indexOf('<style>'));
    expect(style).not.toContain('font-app-mono');
    expect(hero).toContain('<span>Explorations</span><span>Sample project</span>');
  });
});
