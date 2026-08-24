import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { buildInstallScript, type KitSkillInput } from '../../../lib/buildInstallScript';

export const getStaticPaths: GetStaticPaths = async () => {
  const kits = await getCollection('kits', ({ data }) => data.status === 'active');
  return kits.map((kit) => ({ params: { slug: kit.data.slug }, props: { kit } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { kit } = props as { kit: { data: import('../../../content/kitSchema').Kit } };
  const allSkills = await getCollection('skills');
  const bySlug = new Map(allSkills.map((s) => [s.data.slug, s]));

  const skills: KitSkillInput[] = [];
  for (const phase of kit.data.phases) {
    for (const entry of phase.entries) {
      const skill = bySlug.get(entry.skill);
      if (!skill) throw new Error(`Kit ${kit.data.slug} references unknown skill "${entry.skill}"`);
      // Never generate a command that copies a source we have no permission to
      // copy. Hiding the page but still shipping the clone would be worse than
      // doing neither.
      if (skill.data.status !== 'active') continue;
      const hub = skill.data.fileTree.find((f) => f.path.split('/').pop() === 'SKILL.md');
      if (!hub) throw new Error(`Skill ${entry.skill} has no SKILL.md in its fileTree`);
      skills.push({
        slug: skill.data.slug,
        sourceUrl: skill.data.sourceUrl,
        hubPath: hub.path,
        companionPaths: skill.data.companionPaths,
      });
    }
  }

  const script = buildInstallScript({ slug: kit.data.slug, name: kit.data.name, skills });
  return new Response(script, {
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' },
  });
};
