import { z } from 'zod';

export const TOOL_VALUES = [
  'claude',
  'claude-code',
  'cursor',
  'codex',
  'copilot',
  'figma',
  'miro',
  'generic',
] as const;

export const CATEGORY_VALUES = [
  'ui-aesthetics',
  'motion',
  'accessibility',
  'design-systems',
  'copywriting',
  'diagramming',
] as const;

export const skillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  sourceUrl: z.string().url(),
  sourceAuthor: z.string(),
  tools: z.array(z.enum(TOOL_VALUES)).min(1),
  categories: z.array(z.enum(CATEGORY_VALUES)).min(1),
  previewType: z.enum(['image', 'video', 'before-after']),
  previewAssets: z.array(z.string()).min(1),
  rating: z.number().min(1).max(5),
  addedDate: z.coerce.date(),
  lastVerified: z.coerce.date(),
  status: z.enum(['active', 'archived', 'superseded']),
  featured: z.boolean().default(false),
});

export type Skill = z.infer<typeof skillSchema>;
