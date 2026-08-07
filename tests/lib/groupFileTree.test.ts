import { describe, it, expect } from 'vitest';
import { groupFileTree, type FileTreeEntry } from '../../src/lib/groupFileTree';

describe('groupFileTree', () => {
  it('handles a skill with SKILL.md at the scope root plus one sibling file', () => {
    // frontend-design: subtree sourceUrl, fileTree already scoped to skills/frontend-design/
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md' },
      { path: 'LICENSE.txt', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt' },
    ];
    expect(groupFileTree(fileTree)).toEqual({
      rootFiles: [{ path: 'LICENSE.txt', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt' }],
      folders: [],
    });
  });

  it('hoists a one-level-deep SKILL.md folder, keeping true-root siblings separate', () => {
    // nothing-design: repo-root sourceUrl, SKILL.md lives at nothing-design/SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'LICENSE', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/LICENSE' },
      { path: 'README.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/README.md' },
      { path: 'nothing-design', type: 'dir', url: 'https://github.com/dominikmartn/nothing-design-skill/tree/main/nothing-design' },
      { path: 'nothing-design/SKILL.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/SKILL.md' },
      { path: 'nothing-design/references', type: 'dir', url: 'https://github.com/dominikmartn/nothing-design-skill/tree/main/nothing-design/references' },
      { path: 'nothing-design/references/components.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/components.md' },
      { path: 'nothing-design/references/platform-mapping.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/platform-mapping.md' },
      { path: 'nothing-design/references/tokens.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/tokens.md' },
      { path: 'preview.gif', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/preview.gif' },
    ];

    const result = groupFileTree(fileTree);

    expect(result.rootFiles.map((f) => f.path)).toEqual(['LICENSE', 'README.md', 'preview.gif']);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('references');
    expect(result.folders[0].files.map((f) => f.path)).toEqual([
      'components.md',
      'platform-mapping.md',
      'tokens.md',
    ]);
  });

  it('hoists a two-level-deep SKILL.md folder and drops intermediate ancestor directories', () => {
    // make-interfaces-feel-better: repo-root sourceUrl, SKILL.md lives at
    // skills/make-interfaces-feel-better/SKILL.md — "skills" is an ancestor
    // directory that must NOT surface as a bogus empty folder row.
    const base = 'https://github.com/jakubkrehel/make-interfaces-feel-better';
    const fileTree: FileTreeEntry[] = [
      { path: 'AGENTS.md', type: 'file', url: `${base}/blob/main/AGENTS.md` },
      { path: 'CLAUDE.md', type: 'file', url: `${base}/blob/main/CLAUDE.md` },
      { path: 'LICENSE', type: 'file', url: `${base}/blob/main/LICENSE` },
      { path: 'README.md', type: 'file', url: `${base}/blob/main/README.md` },
      { path: 'skills', type: 'dir', url: `${base}/tree/main/skills` },
      { path: 'skills/make-interfaces-feel-better', type: 'dir', url: `${base}/tree/main/skills/make-interfaces-feel-better` },
      { path: 'skills/make-interfaces-feel-better/SKILL.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/SKILL.md` },
      { path: 'skills/make-interfaces-feel-better/agents', type: 'dir', url: `${base}/tree/main/skills/make-interfaces-feel-better/agents` },
      { path: 'skills/make-interfaces-feel-better/agents/openai.yaml', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/agents/openai.yaml` },
      { path: 'skills/make-interfaces-feel-better/animations.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/animations.md` },
      { path: 'skills/make-interfaces-feel-better/icons.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/icons.md` },
      { path: 'skills/make-interfaces-feel-better/performance.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/performance.md` },
      { path: 'skills/make-interfaces-feel-better/surfaces.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/surfaces.md` },
      { path: 'skills/make-interfaces-feel-better/typography.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/typography.md` },
    ];

    const result = groupFileTree(fileTree);

    expect(result.rootFiles.map((f) => f.path)).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
      'LICENSE',
      'README.md',
      'animations.md',
      'icons.md',
      'performance.md',
      'surfaces.md',
      'typography.md',
    ]);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('agents');
    expect(result.folders[0].files.map((f) => f.path)).toEqual(['openai.yaml']);
  });

  it('returns empty rootFiles and folders when SKILL.md is the only entry', () => {
    // emil-design-eng: no files besides its own SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md' },
    ];
    expect(groupFileTree(fileTree)).toEqual({ rootFiles: [], folders: [] });
  });
});
