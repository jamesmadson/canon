import { z } from 'zod';

export const kitEntrySchema = z.object({
  skill: z.string(),
  why: z.string(),
});

export const kitPhaseSchema = z.object({
  title: z.string(),
  entries: z.array(kitEntrySchema).min(1),
});

export const kitSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  phases: z.array(kitPhaseSchema).min(1),
  digestPath: z.string(),
  addedDate: z.coerce.date(),
  status: z.enum(['active', 'archived']),
});

export type Kit = z.infer<typeof kitSchema>;
