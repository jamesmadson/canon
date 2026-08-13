import { describe, it, expect } from 'vitest';
import { buildInstallScript, type KitSkillInput } from '../../src/lib/buildInstallScript';

const subtreeSkill: KitSkillInput = {
  slug: 'frontend-design',
  sourceUrl: 'https://github.com/anthropics/skills/tree/main/skills/frontend-design',
  hubPath: 'SKILL.md',
  companionPaths: [],
};

const nestedHubSkill: KitSkillInput = {
  slug: 'nothing-design',
  sourceUrl: 'https://github.com/dominikmartn/nothing-design-skill',
  hubPath: 'nothing-design/SKILL.md',
  companionPaths: [],
};

const rootHubSkill: KitSkillInput = {
  slug: 'huashu-design',
  sourceUrl: 'https://github.com/alchaincyf/huashu-design',
  hubPath: 'SKILL.md',
  companionPaths: [],
};

const suiteSkill: KitSkillInput = {
  slug: 'thumb-first',
  sourceUrl: 'https://github.com/kylezantos/thumb-first/tree/main/skills/thumb-first',
  hubPath: 'SKILL.md',
  companionPaths: ['skills/thumb-first-design', 'skills/thumb-first-platform'],
};

const nestedSubtreeSkill: KitSkillInput = {
  slug: 'nested-subtree',
  sourceUrl: 'https://github.com/example/kit/tree/main/foo/bar',
  hubPath: 'baz/SKILL.md',
  companionPaths: [],
};

function script(skills: KitSkillInput[]): string {
  return buildInstallScript({ slug: 'test-kit', name: 'Test Kit', skills });
}

describe('buildInstallScript', () => {
  it('installs a subtree skill from its sourceUrl path', () => {
    expect(script([subtreeSkill])).toContain('install_skill anthropics/skills skills/frontend-design\n');
  });

  it('joins a non-empty sourceUrl path with a nested hubPath directory', () => {
    expect(script([nestedSubtreeSkill])).toContain('install_skill example/kit foo/bar/baz\n');
  });

  it('installs a root-form skill whose SKILL.md sits in a nested folder', () => {
    expect(script([nestedHubSkill])).toContain('install_skill dominikmartn/nothing-design-skill nothing-design\n');
  });

  it('installs a repo-root skill via "." with an explicit dest name', () => {
    expect(script([rootHubSkill])).toContain('install_skill alchaincyf/huashu-design . huashu-design\n');
  });

  it('expands companionPaths into additional install lines on the same repo', () => {
    const out = script([suiteSkill]);
    expect(out).toContain('install_skill kylezantos/thumb-first skills/thumb-first\n');
    expect(out).toContain('install_skill kylezantos/thumb-first skills/thumb-first-design\n');
    expect(out).toContain('install_skill kylezantos/thumb-first skills/thumb-first-platform\n');
  });

  it('carries the clone-once memo guard and stderr logging in the template', () => {
    const out = script([subtreeSkill]);
    expect(out).toContain('if [ ! -d "$dir" ]; then');
    expect(out).toContain('echo "→ cloning $repo" >&2');
  });

  it('names the kit in the header and uses safe shell options', () => {
    const out = script([subtreeSkill]);
    expect(out).toContain('# Canon kit: Test Kit');
    expect(out).toContain('set -uo pipefail');
  });

  it('is deterministic for identical input', () => {
    expect(script([subtreeSkill, suiteSkill])).toEqual(script([subtreeSkill, suiteSkill]));
  });

  it('template strips .git after copying (static template regression check)', () => {
    expect(script([rootHubSkill])).toContain('rm -rf "$DEST/$name/.git"');
  });
});
