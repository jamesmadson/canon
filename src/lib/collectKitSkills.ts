import type { KitSkillInput } from './buildInstallScript';

export interface SkillLike {
  slug: string;
  sourceUrl: string;
  status: string;
  companionPaths?: string[];
  fileTree: { path: string; type: 'file' | 'dir'; url: string }[];
}

export interface KitLike {
  slug: string;
  phases: { entries: { skill: string }[] }[];
}

/**
 * Turns a kit's phase entries into the inputs buildInstallScript needs.
 *
 * Lives here rather than inline in the install.sh route so the tests exercise
 * the same code the route ships, instead of a copy that can drift from it.
 *
 * Skills whose status is not 'active' are skipped: a source that states no
 * license grants no permission to copy it, so no generated script may clone it.
 */
export function collectKitSkills(kit: KitLike, skillsBySlug: Map<string, SkillLike>): KitSkillInput[] {
  const inputs: KitSkillInput[] = [];

  for (const phase of kit.phases) {
    for (const entry of phase.entries) {
      const skill = skillsBySlug.get(entry.skill);
      if (!skill) throw new Error(`Kit ${kit.slug} references unknown skill "${entry.skill}"`);
      if (skill.status !== 'active') continue;

      const hub = skill.fileTree.find((f) => f.path.split('/').pop() === 'SKILL.md');
      if (!hub) throw new Error(`Skill ${skill.slug} has no SKILL.md in its fileTree`);

      inputs.push({
        slug: skill.slug,
        sourceUrl: skill.sourceUrl,
        hubPath: hub.path,
        companionPaths: skill.companionPaths ?? [],
      });
    }
  }

  return inputs;
}
