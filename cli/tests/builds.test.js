import { describe, it, expect } from 'vitest';
import { branchSlug, buildPlan } from '../src/builds.js';
import { defaultConfig } from '../src/config.js';

function config(overrides) {
  return { ...defaultConfig({ repo: 'r', defaultBranch: 'main' }), ...overrides };
}

describe('branchSlug', () => {
  it('turns a branch into one URL-safe path segment', () => {
    expect(branchSlug('prototype/Checkout V3')).toBe('prototype-checkout-v3');
    expect(branchSlug('feature/site-redesign-prototype')).toBe('feature-site-redesign-prototype');
  });

  it('never returns an empty segment', () => {
    expect(branchSlug('///')).toBe('prototype');
  });
});

describe('buildPlan', () => {
  it('lists every selected prototype that has a build, in selection order', () => {
    const plan = buildPlan(
      config({
        prototypes: ['proto/b', 'proto/a'],
        builds: {
          'proto/a': { command: 'npm run build', outputDir: 'dist' },
          'proto/b': { command: 'npm run build:proto', outputDir: 'out/site' },
        },
      })
    );
    expect(plan.builds).toEqual([
      { branch: 'proto/b', slug: 'proto-b', command: 'npm run build:proto', outputDir: 'out/site' },
      { branch: 'proto/a', slug: 'proto-a', command: 'npm run build', outputDir: 'dist' },
    ]);
    expect(plan.problems).toEqual([]);
  });

  it('names a selected prototype with no build instead of dropping it quietly', () => {
    const plan = buildPlan(config({ prototypes: ['a', 'b'], builds: { a: { command: 'make', outputDir: 'dist' } } }));
    expect(plan.builds.map((b) => b.branch)).toEqual(['a']);
    expect(plan.problems).toEqual([{ branch: 'b', problem: 'no build configured' }]);
  });

  it('ignores builds for branches nobody selected', () => {
    const plan = buildPlan(config({ prototypes: ['a'], builds: { a: { command: 'make', outputDir: 'dist' }, z: { command: 'make', outputDir: 'dist' } } }));
    expect(plan.builds.map((b) => b.branch)).toEqual(['a']);
  });

  it('reads a config written before builds existed', () => {
    const old = config({ prototypes: ['a'] });
    delete old.builds;
    expect(buildPlan(old)).toEqual({ builds: [], problems: [{ branch: 'a', problem: 'no build configured' }] });
  });

  it('returns nothing to build when no prototypes are chosen yet', () => {
    expect(buildPlan(config({ prototypes: null }))).toEqual({ builds: [], problems: [] });
  });

  it('refuses an output directory that leaves the checkout', () => {
    const plan = buildPlan(
      config({
        prototypes: ['a', 'b', 'c'],
        builds: {
          a: { command: 'make', outputDir: '../elsewhere' },
          b: { command: 'make', outputDir: '/etc' },
          c: { command: 'make', outputDir: '' },
        },
      })
    );
    expect(plan.builds).toEqual([]);
    expect(plan.problems.map((p) => p.problem)).toEqual([
      'outputDir must stay inside the repository',
      'outputDir must stay inside the repository',
      'outputDir is missing',
    ]);
  });

  it('refuses a missing command', () => {
    const plan = buildPlan(config({ prototypes: ['a'], builds: { a: { command: '  ', outputDir: 'dist' } } }));
    expect(plan.problems).toEqual([{ branch: 'a', problem: 'command is missing' }]);
  });

  it('keeps slugs unique when two branches collapse to the same one', () => {
    const plan = buildPlan(
      config({
        prototypes: ['proto/a', 'proto-a'],
        builds: {
          'proto/a': { command: 'make', outputDir: 'dist' },
          'proto-a': { command: 'make', outputDir: 'dist' },
        },
      })
    );
    expect(plan.builds.map((b) => b.slug)).toEqual(['proto-a', 'proto-a-2']);
  });
});

describe('defaultConfig', () => {
  it('starts with no builds configured', () => {
    expect(defaultConfig({ repo: 'r', defaultBranch: 'main' }).builds).toEqual({});
  });
});
