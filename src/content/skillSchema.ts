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

// 'none' means the repo states no license, which makes the work legally
// unusable regardless of how good it is. Say so plainly rather than omitting it.
export const LICENSE_VALUES = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'CC-BY-4.0',
  'none',
] as const;

export const skillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  // Where the skill earns its place in the work, shown under the name on its page.
  story: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceAuthor: z.string(),
  license: z.enum(LICENSE_VALUES),
  tools: z.array(z.enum(TOOL_VALUES)).min(1),
  // What the skill made on a real run, shown on its page: 'page' is a page it
  // made, live in a frame; 'reply' is Markdown it wrote back, set as prose;
  // 'file' is a file it wrote, shown as the file.
  previewType: z.enum(['image', 'page', 'reply', 'file']),
  previewAssets: z.array(z.string()).min(1),
  previewNote: z.string().optional(),
  // The exact prompt that made the preview, copyable from the page.
  prompt: z.string().min(1),
  // Two to four short lines on what to look at in the output.
  notice: z.array(z.string().max(119)).min(2).max(4),
  // One paragraph on what to do with the output.
  next: z.string().min(1),
  // A page the skill worked on, served from /previews/ and shown above its review.
  subject: z.string().startsWith('/previews/').optional(),
  // The reviewed page's own name and primary colour, for its label row
  // (D-124). The colour is read from the page by the dashboard's rule.
  subjectBrand: z.object({ name: z.string().min(1), colour: z.string().regex(/^#[0-9a-f]{6}$/i) }).optional(),
  addedDate: z.coerce.date(),
  // 'pending-license' hides an entry everywhere it would be published or
  // installed, without deleting the work. For sources that state no license
  // at all, while we ask the author to add one.
  status: z.enum(['active', 'archived', 'superseded', 'pending-license']),
});

export type Skill = z.infer<typeof skillSchema>;
