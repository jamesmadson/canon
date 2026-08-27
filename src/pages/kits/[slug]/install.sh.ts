import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { buildInstallScript } from '../../../lib/buildInstallScript';
import { collectKitSkills } from '../../../lib/collectKitSkills';

export const getStaticPaths: GetStaticPaths = async () => {
  const kits = await getCollection('kits', ({ data }) => data.status === 'active');
  return kits.map((kit) => ({ params: { slug: kit.data.slug }, props: { kit } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { kit } = props as { kit: { data: import('../../../content/kitSchema').Kit } };
  const allSkills = await getCollection('skills');
  const bySlug = new Map(allSkills.map((s) => [s.data.slug, s]));

  const skills = collectKitSkills(
    kit.data,
    new Map([...bySlug].map(([slug, entry]) => [slug, entry.data]))
  );

  const script = buildInstallScript({ slug: kit.data.slug, name: kit.data.name, skills });
  return new Response(script, {
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' },
  });
};
