import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { skillSchema } from './skillSchema';

const skills = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/skills' }),
  schema: skillSchema,
});

export const collections = { skills };
