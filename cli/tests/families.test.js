import { describe, it, expect } from 'vitest';
import { deriveFamilies, familyDisplayName, branchDepth } from '../src/families.js';

/**
 * Branch names carry the hierarchy, so the tree is derived on every run and
 * never stored. These tests pin the derivation before the renderer is allowed
 * to depend on it.
 */

function branch(name, lastCommit = '2026-09-01') {
  return { name, lastCommit, sha: 'abc1234', subject: 'a commit' };
}

describe('branchDepth', () => {
  it('counts path segments below the namespace', () => {
    expect(branchDepth('main')).toBe(0);
    expect(branchDepth('proto/today-ring')).toBe(1);
    expect(branchDepth('proto/today-ring/streaks-alt')).toBe(2);
    expect(branchDepth('proto/today-ring/streaks-alt/dense')).toBe(3);
  });
});

describe('deriveFamilies', () => {
  it('returns nothing for an empty repo', () => {
    expect(deriveFamilies([], { defaultBranch: 'main' })).toEqual([]);
  });

  it('never treats the default branch as a prototype', () => {
    const families = deriveFamilies([branch('main'), branch('proto/ring')], {
      defaultBranch: 'main',
    });
    expect(families.map((f) => f.root)).toEqual(['proto/ring']);
  });

  it('makes a lone branch a single node family', () => {
    const families = deriveFamilies([branch('proto/ring')], { defaultBranch: 'main' });
    expect(families).toHaveLength(1);
    expect(families[0].nodes).toHaveLength(1);
    expect(families[0].nodes[0]).toMatchObject({ name: 'proto/ring', parent: null, depth: 1 });
  });

  it('nests a child under its named parent', () => {
    const families = deriveFamilies(
      [branch('proto/today-ring'), branch('proto/today-ring/streaks-alt')],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    const [family] = families;
    expect(family.root).toBe('proto/today-ring');
    expect(family.nodes.map((n) => n.name)).toEqual([
      'proto/today-ring',
      'proto/today-ring/streaks-alt',
    ]);
    expect(family.nodes[1].parent).toBe('proto/today-ring');
  });

  it('keeps sibling variants in one family, ordered by name', () => {
    const families = deriveFamilies(
      [
        branch('proto/today-ring/streaks-alt'),
        branch('proto/today-ring'),
        branch('proto/today-ring/compact'),
      ],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    expect(families[0].nodes.map((n) => n.name)).toEqual([
      'proto/today-ring',
      'proto/today-ring/compact',
      'proto/today-ring/streaks-alt',
    ]);
    expect(families[0].size).toBe(3);
  });

  it('handles deep nesting three levels down', () => {
    const families = deriveFamilies(
      [branch('proto/a'), branch('proto/a/b'), branch('proto/a/b/c')],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    expect(families[0].nodes.map((n) => n.depth)).toEqual([1, 2, 3]);
    expect(families[0].nodes[2].parent).toBe('proto/a/b');
    expect(families[0].maxDepth).toBe(3);
  });

  it('keeps dots and dashes inside a segment rather than splitting on them', () => {
    const families = deriveFamilies(
      [branch('proto/v1.2-ring'), branch('proto/v1.2-ring/alt-b.2')],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('proto/v1.2-ring');
    expect(families[0].name).toBe('v1.2-ring');
    expect(families[0].nodes[1].label).toBe('alt-b.2');
  });

  it('makes a child whose parent is not selected its own root', () => {
    const families = deriveFamilies(
      [branch('proto/today-ring'), branch('proto/today-ring/streaks-alt')],
      { defaultBranch: 'main', selected: ['proto/today-ring/streaks-alt'] },
    );
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('proto/today-ring/streaks-alt');
    expect(families[0].nodes[0].parent).toBeNull();
    expect(families[0].nodes[0].orphaned).toBe(true);
    expect(families[0].name).toBe('streaks-alt');
  });

  /**
   * An orphan is a branch whose parent was left out, which is a thing a person
   * did. A branch under a prefix that no branch occupies had no parent to leave
   * out, so captioning it "parent not selected" would name a branch that never
   * existed.
   */
  it('does not call a branch an orphan when its named parent is not a branch', () => {
    const families = deriveFamilies([branch('feat/solo'), branch('proto/ring')], {
      defaultBranch: 'main',
    });
    const solo = families.find((f) => f.root === 'feat/solo');
    expect(solo.nodes[0].orphaned).toBe(false);
  });

  it('gives an arbitrary name a family of its own', () => {
    const families = deriveFamilies([branch('feat/x'), branch('proto/ring')], {
      defaultBranch: 'main',
    });
    expect(families.map((f) => f.root)).toEqual(['feat/x', 'proto/ring']);
    expect(families[0].nodes).toHaveLength(1);
  });

  it('lets a configured familyRoot override the derived parent', () => {
    const families = deriveFamilies([branch('proto/ring'), branch('feat/x')], {
      defaultBranch: 'main',
      familyRoots: { 'feat/x': 'proto/ring' },
    });
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('proto/ring');
    expect(families[0].nodes.map((n) => n.name)).toEqual(['feat/x', 'proto/ring']);
    expect(families[0].nodes.find((n) => n.name === 'feat/x').parent).toBe('proto/ring');
  });

  it('ignores a familyRoot pointing at a branch that is not selected', () => {
    const families = deriveFamilies([branch('feat/x')], {
      defaultBranch: 'main',
      familyRoots: { 'feat/x': 'proto/gone' },
    });
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('feat/x');
  });

  it('carries the branch payload onto the node untouched', () => {
    const families = deriveFamilies([{ name: 'proto/ring', lastCommit: '2026-08-01', sha: 'ff01' }], {
      defaultBranch: 'main',
    });
    expect(families[0].nodes[0]).toMatchObject({ lastCommit: '2026-08-01', sha: 'ff01' });
    expect(families[0].lastCommit).toBe('2026-08-01');
  });

  it('reports the family last commit as the newest node', () => {
    const families = deriveFamilies(
      [branch('proto/a', '2026-07-01'), branch('proto/a/b', '2026-08-20')],
      { defaultBranch: 'main' },
    );
    expect(families[0].lastCommit).toBe('2026-08-20');
  });

  it('sorts families by root name so the output does not reshuffle', () => {
    const families = deriveFamilies(
      [branch('proto/zeta'), branch('proto/alpha'), branch('feat/mid')],
      { defaultBranch: 'main' },
    );
    expect(families.map((f) => f.root)).toEqual(['feat/mid', 'proto/alpha', 'proto/zeta']);
  });
});

/**
 * Git stores a branch as a file under refs/heads, so proto/ring and
 * proto/ring/alt cannot both exist: git refuses the second. The family a real
 * repository can actually hold is a shared prefix that no branch occupies,
 * with the variants under it, so that shape gets its own block.
 */
describe('deriveFamilies with a prefix no branch occupies', () => {
  it('groups siblings under a virtual root', () => {
    const families = deriveFamilies(
      [branch('proto/today-ring/base'), branch('proto/today-ring/streaks-alt')],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    const [family] = families;
    expect(family.root).toBe('proto/today-ring');
    expect(family.name).toBe('today-ring');
    expect(family.virtualRoot).toBe(true);
    expect(family.nodes.map((n) => n.name)).toEqual([
      'proto/today-ring',
      'proto/today-ring/base',
      'proto/today-ring/streaks-alt',
    ]);
    expect(family.nodes[0].virtual).toBe(true);
    expect(family.nodes[1].parent).toBe('proto/today-ring');
  });

  it('counts only real branches in the family size', () => {
    const [family] = deriveFamilies(
      [branch('proto/ring/a'), branch('proto/ring/b')],
      { defaultBranch: 'main' },
    );
    expect(family.size).toBe(2);
    expect(family.nodes).toHaveLength(3);
  });

  it('gives the virtual root the newest date underneath it', () => {
    const [family] = deriveFamilies(
      [branch('proto/ring/a', '2026-01-01'), branch('proto/ring/b', '2026-08-20')],
      { defaultBranch: 'main' },
    );
    expect(family.lastCommit).toBe('2026-08-20');
    expect(family.nodes[0].lastCommit).toBe('2026-08-20');
  });

  it('leaves a lone branch under a prefix alone rather than inventing a parent', () => {
    const families = deriveFamilies([branch('proto/ring/only')], { defaultBranch: 'main' });
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('proto/ring/only');
    expect(families[0].virtualRoot).toBe(false);
  });

  it('never invents a prefix that a real branch already occupies', () => {
    const families = deriveFamilies(
      [branch('proto/ring'), branch('proto/ring-alt/a'), branch('proto/ring-alt/b')],
      { defaultBranch: 'main' },
    );
    expect(families.map((f) => f.root)).toEqual(['proto/ring', 'proto/ring-alt']);
  });

  it('nests one virtual root under another', () => {
    const families = deriveFamilies(
      [
        branch('proto/ring/dense/a'),
        branch('proto/ring/dense/b'),
        branch('proto/ring/loose/a'),
        branch('proto/ring/loose/b'),
      ],
      { defaultBranch: 'main' },
    );
    expect(families).toHaveLength(1);
    expect(families[0].root).toBe('proto/ring');
    expect(families[0].nodes.filter((n) => n.virtual).map((n) => n.name)).toEqual([
      'proto/ring',
      'proto/ring/dense',
      'proto/ring/loose',
    ]);
    expect(families[0].nodes.find((n) => n.name === 'proto/ring/dense').parent).toBe('proto/ring');
  });

  it('lets a configured familyRoot point at a virtual root', () => {
    const families = deriveFamilies(
      [branch('proto/ring/a'), branch('proto/ring/b'), branch('feat/x')],
      { defaultBranch: 'main', familyRoots: { 'feat/x': 'proto/ring' } },
    );
    expect(families).toHaveLength(1);
    expect(families[0].nodes.find((n) => n.name === 'feat/x').parent).toBe('proto/ring');
  });
});

describe('familyDisplayName', () => {
  it('reads the last segment of the root branch', () => {
    expect(familyDisplayName('proto/today-ring')).toBe('today-ring');
    expect(familyDisplayName('solo')).toBe('solo');
  });
});
