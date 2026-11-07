// The page a skill reviewed, with what its one cut removed outlined. Built
// once per skill that shows an after page, from the two files in public/.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { lineDiff, markRemoved } from '../../../lib/cutDiff';

const fromPublic = (url: string) => readFileSync(path.join(process.cwd(), 'public', url.split('#')[0]), 'utf-8');

export const getStaticPaths = (async () => {
  const skills = await getCollection('skills', ({ data }) => Boolean(data.subject && data.subjectAfter));
  return skills.map((s) => ({
    params: { slug: s.data.slug },
    props: { subject: s.data.subject as string, after: s.data.subjectAfter as string },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const before = fromPublic(props.subject);
  const html = markRemoved(before, lineDiff(before, fromPublic(props.after)));
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
