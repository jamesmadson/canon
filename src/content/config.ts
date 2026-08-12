import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { skillSchema } from './skillSchema';
import { kitSchema } from './kitSchema';

const skills = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/skills' }),
  schema: skillSchema,
});

const kits = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/kits' }),
  schema: kitSchema,
});

export const collections = { skills, kits };
