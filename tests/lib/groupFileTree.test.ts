import { describe, it, expect } from 'vitest';
import { groupFileTree, type FileTreeEntry } from '../../src/lib/groupFileTree';

describe('groupFileTree', () => {
  it('handles a skill with SKILL.md at the scope root plus one sibling file', () => {
    // A subtree sourceUrl, fileTree already scoped to the skill's own folder
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/example-owner/skills/blob/main/skills/example-skill/SKILL.md' },
      { path: 'LICENSE.txt', type: 'file', url: 'https://github.com/example-owner/skills/blob/main/skills/example-skill/LICENSE.txt' },
    ];
    expect(groupFileTree(fileTree)).toEqual({
      rootFiles: [{ path: 'LICENSE.txt', type: 'file', url: 'https://github.com/example-owner/skills/blob/main/skills/example-skill/LICENSE.txt' }],
      folders: [],
    });
  });

  it('hoists a one-level-deep SKILL.md folder, keeping true-root siblings separate', () => {
    // A repo-root sourceUrl, SKILL.md lives at example-design/SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'LICENSE', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/LICENSE' },
      { path: 'README.md', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/README.md' },
      { path: 'example-design', type: 'dir', url: 'https://github.com/example-owner/example-design-skill/tree/main/example-design' },
      { path: 'example-design/SKILL.md', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/example-design/SKILL.md' },
      { path: 'example-design/references', type: 'dir', url: 'https://github.com/example-owner/example-design-skill/tree/main/example-design/references' },
      { path: 'example-design/references/components.md', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/example-design/references/components.md' },
      { path: 'example-design/references/platform-mapping.md', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/example-design/references/platform-mapping.md' },
      { path: 'example-design/references/tokens.md', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/example-design/references/tokens.md' },
      { path: 'preview.gif', type: 'file', url: 'https://github.com/example-owner/example-design-skill/blob/main/preview.gif' },
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
    // A repo-root sourceUrl, SKILL.md lives at
    // skills/example-interface/SKILL.md: "skills" is an ancestor
    // directory that must NOT surface as a bogus empty folder row.
    const base = 'https://github.com/example-owner/example-interface';
    const fileTree: FileTreeEntry[] = [
      { path: 'AGENTS.md', type: 'file', url: `${base}/blob/main/AGENTS.md` },
      { path: 'CLAUDE.md', type: 'file', url: `${base}/blob/main/CLAUDE.md` },
      { path: 'LICENSE', type: 'file', url: `${base}/blob/main/LICENSE` },
      { path: 'README.md', type: 'file', url: `${base}/blob/main/README.md` },
      { path: 'skills', type: 'dir', url: `${base}/tree/main/skills` },
      { path: 'skills/example-interface', type: 'dir', url: `${base}/tree/main/skills/example-interface` },
      { path: 'skills/example-interface/SKILL.md', type: 'file', url: `${base}/blob/main/skills/example-interface/SKILL.md` },
      { path: 'skills/example-interface/agents', type: 'dir', url: `${base}/tree/main/skills/example-interface/agents` },
      { path: 'skills/example-interface/agents/openai.yaml', type: 'file', url: `${base}/blob/main/skills/example-interface/agents/openai.yaml` },
      { path: 'skills/example-interface/animations.md', type: 'file', url: `${base}/blob/main/skills/example-interface/animations.md` },
      { path: 'skills/example-interface/icons.md', type: 'file', url: `${base}/blob/main/skills/example-interface/icons.md` },
      { path: 'skills/example-interface/performance.md', type: 'file', url: `${base}/blob/main/skills/example-interface/performance.md` },
      { path: 'skills/example-interface/surfaces.md', type: 'file', url: `${base}/blob/main/skills/example-interface/surfaces.md` },
      { path: 'skills/example-interface/typography.md', type: 'file', url: `${base}/blob/main/skills/example-interface/typography.md` },
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
    // A skill with no files besides its own SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/jamesmadson/canon/blob/main/plugin/graft/skills/graft/SKILL.md' },
    ];
    expect(groupFileTree(fileTree)).toEqual({ rootFiles: [], folders: [] });
  });

  it('counts nested files recursively for the badge while only listing direct children as examples', () => {
    // Models a real shape: a folder (e.g. assets/) containing both
    // direct files and nested subdirectories with their own files — the case that
    // exposed the original bug (folder badge showed direct-child count only, 18
    // instead of the real ~120, because nested files were silently dropped).
    const base = 'https://github.com/example-owner/example-assets-skill';
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: `${base}/blob/master/SKILL.md` },
      { path: 'assets', type: 'dir', url: `${base}/tree/master/assets` },
      { path: 'assets/logo.png', type: 'file', url: `${base}/blob/master/assets/logo.png` },
      { path: 'assets/sfx', type: 'dir', url: `${base}/tree/master/assets/sfx` },
      { path: 'assets/sfx/click.mp3', type: 'file', url: `${base}/blob/master/assets/sfx/click.mp3` },
      { path: 'assets/sfx/hover.mp3', type: 'file', url: `${base}/blob/master/assets/sfx/hover.mp3` },
      { path: 'assets/showcases', type: 'dir', url: `${base}/tree/master/assets/showcases` },
      { path: 'assets/showcases/demo1.png', type: 'file', url: `${base}/blob/master/assets/showcases/demo1.png` },
    ];

    const result = groupFileTree(fileTree);

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('assets');
    // display list stays direct-children-only
    expect(result.folders[0].files.map((f) => f.path)).toEqual(['logo.png']);
    // badge count is recursive — everything nested underneath, however deep
    expect(result.folders[0].fileCount).toBe(4);
  });
});
