# Design Skills Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Astro site — a curated, editorial gallery of design/design-engineering "skill" files (SKILL.md-style instructions for AI coding agents), with build-time-validated content, client-side faceted filtering, and 8 real, researched seed entries.

**Architecture:** Astro + TypeScript with Content Collections (Zod-validated MDX) as the single source of truth for skill data. All pure logic (schema, filtering, taxonomy metadata) lives in framework-free TypeScript modules tested with Vitest. UI is server-rendered Astro components; the only client-side JS is a small inline `<script>` in the filter island — no UI framework dependency. Tailwind CSS (v4, CSS-first config) handles styling.

**Tech Stack:** Astro 5, TypeScript (strict), Tailwind CSS 4 (`@tailwindcss/vite`), `@astrojs/mdx`, Zod, Vitest, `@fontsource/fraunces` + `@fontsource/inter` (self-hosted fonts), npm. Deploy target: Vercel (static output, no adapter). Form backend: Formspree (placeholder ID). Newsletter: Buttondown (placeholder).

Full design rationale lives in [docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md](../specs/2026-07-29-design-skills-gallery-design.md).

## Global Constraints

- Package manager: npm only.
- No database, no auth, no user accounts in this pass — schema is flat/typed so a later Postgres migration is a data-import job.
- `tools` is a closed enum of exactly: `claude`, `claude-code`, `cursor`, `codex`, `copilot`, `figma`, `miro`, `generic`.
- `categories` is a closed enum of exactly: `ui-aesthetics`, `motion`, `accessibility`, `design-systems`, `copywriting`, `diagramming`.
- Gallery filtering rule: **OR within a facet group, AND across groups** (e.g. checking `cursor` + `codex`, both `tools`, shows either; checking `cursor` + `motion`, a `tools` value and a `categories` value, requires both).
- Filter UI ships as vanilla TypeScript — no React/Vue/Svelte dependency anywhere in this project.
- Visual design: achromatic UI chrome (nav, borders, buttons) — color enters via preview imagery and tool badges, not interface chrome. Spacing-driven separation between cards/sections, not heavy borders/boxes. Oversized, confident homepage hero headline. Neutral palette: paper `#faf9f5` background, ink `#141413` text, one accent `#c1666b`. Fonts self-hosted via `@fontsource` (no external font CDN).
- Editorial copy (taglines, write-ups) must be original voice — never copied verbatim from a source repo's README.
- Seed content is exactly these 8 real, GitHub-verified skills — no invented entries: `anthropics/skills` (`frontend-design`, `brand-guidelines`), `emilkowalski/skills` (`improve-animations`), `jakubkrehel/skills` (`better-accessibility`, `better-writing`), `jakubkrehel/make-interfaces-feel-better`, `vercel-labs/agent-skills` (`web-design-guidelines`, `react-view-transitions`).
- No live third-party wiring: the Formspree form action and Buttondown form action are placeholders, each marked with an HTML comment telling the site owner what to replace and where to find it.
- Deploy target is Vercel; Astro's static output (`output: 'static'`, the default) needs no adapter — do not add `@astrojs/vercel` or a `vercel.json` unless a later task explicitly requires it.
- Testing strategy: Vitest covers pure TypeScript logic (schema parsing, taxonomy consistency, filter engine). Astro components/pages have no unit-test framework in this pass (none was requested) — their correctness gate is `npx astro sync` / `npm run build` succeeding (which validates all content collection entries against the Zod schema) plus a manual dev-server check described in the task.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/env.d.ts`
- Create: `src/styles/global.css`
- Create: `src/pages/index.astro` (temporary placeholder — replaced in Task 8)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm run dev` / `npm run build` / `npm run test` / `npm run check` pipeline that every later task builds on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "designskills",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/mdx": "^4.0.0",
    "@fontsource/fraunces": "^5.0.0",
    "@fontsource/inter": "^5.0.0",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.astro/
.vercel/
```

- [ ] **Step 6: Create `src/env.d.ts`**

```ts
/// <reference types="astro/client" />
```

- [ ] **Step 7: Create `src/styles/global.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Create the temporary placeholder homepage `src/pages/index.astro`**

```astro
---
import '../styles/global.css';
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Design Skills</title>
  </head>
  <body class="bg-stone-50 p-8">
    <h1 class="text-2xl font-bold">Coming soon</h1>
  </body>
</html>
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes with no error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 10: Verify the build pipeline works end-to-end**

Run: `npm run build`
Expected: exits 0, prints an Astro build-success message (e.g. `1 page(s) built` / `Complete!`), creates `dist/index.html`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs vitest.config.ts .gitignore src/env.d.ts src/styles/global.css src/pages/index.astro
git commit -m "Scaffold Astro + Tailwind + Vitest project"
```

---

### Task 2: Content schema & taxonomy metadata

**Files:**
- Create: `src/content/skillSchema.ts`
- Create: `src/content/config.ts`
- Create: `src/lib/toolMeta.ts`
- Create: `src/lib/categoryMeta.ts`
- Test: `tests/content/skillSchema.test.ts`
- Test: `tests/content/taxonomy.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `skillSchema` (Zod object schema), `TOOL_VALUES: readonly string[]`, `CATEGORY_VALUES: readonly string[]`, `Skill` type (all from `src/content/skillSchema.ts`); `collections` export (from `src/content/config.ts`, used implicitly by Astro's content pipeline); `TOOL_META: Record<string, { label: string; color: string }>` (`src/lib/toolMeta.ts`); `CATEGORY_META: Record<string, { label: string; color: string }>` (`src/lib/categoryMeta.ts`). All later tasks that render tool/category badges or query the `skills` collection depend on these exact names.

- [ ] **Step 1: Write the failing schema test**

Create `tests/content/skillSchema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { skillSchema } from '../../src/content/skillSchema';

const validSkill = {
  slug: 'frontend-design',
  name: 'Frontend Design',
  tagline: 'A tagline.',
  sourceUrl: 'https://github.com/anthropics/skills',
  sourceAuthor: 'Anthropic',
  tools: ['claude'],
  categories: ['ui-aesthetics'],
  previewType: 'image',
  previewAssets: ['/previews/frontend-design.svg'],
  rating: 5,
  addedDate: '2026-07-01',
  lastVerified: '2026-07-29',
  status: 'active',
  featured: true,
};

describe('skillSchema', () => {
  it('parses a valid skill entry', () => {
    const result = skillSchema.parse(validSkill);
    expect(result.name).toBe('Frontend Design');
    expect(result.featured).toBe(true);
  });

  it('defaults featured to false when omitted', () => {
    const { featured, ...rest } = validSkill;
    const result = skillSchema.parse(rest);
    expect(result.featured).toBe(false);
  });

  it('rejects an unknown tool value', () => {
    expect(() => skillSchema.parse({ ...validSkill, tools: ['photoshop'] })).toThrow();
  });

  it('rejects an unknown category value', () => {
    expect(() => skillSchema.parse({ ...validSkill, categories: ['branding'] })).toThrow();
  });

  it('rejects a rating outside 1-5', () => {
    expect(() => skillSchema.parse({ ...validSkill, rating: 6 })).toThrow();
  });

  it('rejects a missing required field', () => {
    const { tagline, ...rest } = validSkill;
    expect(() => skillSchema.parse(rest)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/content/skillSchema.test.ts`
Expected: FAIL — `Cannot find module '../../src/content/skillSchema'`.

- [ ] **Step 3: Implement `src/content/skillSchema.ts`**

```ts
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
```

`z` is imported from the plain `zod` package (not `astro:content`) so this module has zero Astro-specific imports and can be unit-tested directly in Vitest, outside Astro's runtime.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/content/skillSchema.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Write the failing taxonomy consistency test**

Create `tests/content/taxonomy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TOOL_VALUES, CATEGORY_VALUES } from '../../src/content/skillSchema';
import { TOOL_META } from '../../src/lib/toolMeta';
import { CATEGORY_META } from '../../src/lib/categoryMeta';

describe('taxonomy metadata', () => {
  it('has a TOOL_META entry for every schema tool value', () => {
    for (const tool of TOOL_VALUES) {
      expect(TOOL_META[tool], `missing TOOL_META for "${tool}"`).toBeDefined();
    }
  });

  it('has a CATEGORY_META entry for every schema category value', () => {
    for (const category of CATEGORY_VALUES) {
      expect(CATEGORY_META[category], `missing CATEGORY_META for "${category}"`).toBeDefined();
    }
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/content/taxonomy.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/toolMeta'`.

- [ ] **Step 7: Implement `src/lib/toolMeta.ts`**

```ts
export const TOOL_META: Record<string, { label: string; color: string }> = {
  claude: { label: 'Claude', color: '#c1666b' },
  'claude-code': { label: 'Claude Code', color: '#a65a6e' },
  cursor: { label: 'Cursor', color: '#3b4252' },
  codex: { label: 'Codex', color: '#2e86ab' },
  copilot: { label: 'Copilot', color: '#1b998b' },
  figma: { label: 'Figma', color: '#e1b16a' },
  miro: { label: 'Miro', color: '#f2c14e' },
  generic: { label: 'Any agent', color: '#8d99ae' },
};
```

- [ ] **Step 8: Implement `src/lib/categoryMeta.ts`**

```ts
export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  'ui-aesthetics': { label: 'UI Aesthetics', color: '#c1666b' },
  motion: { label: 'Motion', color: '#6a9bcc' },
  accessibility: { label: 'Accessibility', color: '#5b8c5a' },
  'design-systems': { label: 'Design Systems', color: '#8e7cc3' },
  copywriting: { label: 'Copywriting', color: '#d9a441' },
  diagramming: { label: 'Diagramming', color: '#4fb0a5' },
};
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/content/taxonomy.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 10: Implement `src/content/config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { skillSchema } from './skillSchema';

const skills = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/skills' }),
  schema: skillSchema,
});

export const collections = { skills };
```

- [ ] **Step 11: Generate content types and verify the project still builds**

Run: `mkdir -p src/content/skills && npx astro sync`
Expected: exits 0, prints that content types were generated (creates/updates `.astro/types.d.ts`). The `skills` collection is empty at this point, which is fine — Task 4 populates it.

- [ ] **Step 12: Run the full test suite**

Run: `npm run test`
Expected: PASS — 7 tests total (5 schema + 2 taxonomy).

- [ ] **Step 13: Commit**

```bash
git add src/content/skillSchema.ts src/content/config.ts src/lib/toolMeta.ts src/lib/categoryMeta.ts tests/content/skillSchema.test.ts tests/content/taxonomy.test.ts
git commit -m "Add content collection schema and taxonomy metadata"
```

---

### Task 3: Filter engine

**Files:**
- Create: `src/lib/filterSkills.ts`
- Test: `tests/lib/filterSkills.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `filterSkills<T extends { tools: string[]; categories: string[] }>(skills: T[], filter: { tools: string[]; categories: string[] }): T[]` from `src/lib/filterSkills.ts`. Task 9 (FilterBar) is the consumer.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/filterSkills.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterSkills } from '../../src/lib/filterSkills';

const skills = [
  { slug: 'a', tools: ['cursor'], categories: ['motion'] },
  { slug: 'b', tools: ['codex'], categories: ['motion'] },
  { slug: 'c', tools: ['cursor'], categories: ['accessibility'] },
  { slug: 'd', tools: ['figma'], categories: ['ui-aesthetics'] },
];

describe('filterSkills', () => {
  it('returns everything when no filters are active', () => {
    expect(filterSkills(skills, { tools: [], categories: [] })).toHaveLength(4);
  });

  it('ORs multiple selections within the tools facet', () => {
    const result = filterSkills(skills, { tools: ['cursor', 'codex'], categories: [] });
    expect(result.map((s) => s.slug).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ORs multiple selections within the categories facet', () => {
    const result = filterSkills(skills, { tools: [], categories: ['motion', 'accessibility'] });
    expect(result.map((s) => s.slug).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ANDs across facet groups', () => {
    const result = filterSkills(skills, { tools: ['cursor'], categories: ['motion'] });
    expect(result.map((s) => s.slug)).toEqual(['a']);
  });

  it('returns an empty array when no skill satisfies both facets', () => {
    const result = filterSkills(skills, { tools: ['figma'], categories: ['motion'] });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/filterSkills.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/filterSkills'`.

- [ ] **Step 3: Implement `src/lib/filterSkills.ts`**

```ts
export interface FilterableSkill {
  tools: string[];
  categories: string[];
}

export interface FacetFilter {
  tools: string[];
  categories: string[];
}

export function filterSkills<T extends FilterableSkill>(skills: T[], filter: FacetFilter): T[] {
  const hasToolFilter = filter.tools.length > 0;
  const hasCategoryFilter = filter.categories.length > 0;

  if (!hasToolFilter && !hasCategoryFilter) {
    return skills;
  }

  return skills.filter((skill) => {
    const matchesTools = !hasToolFilter || skill.tools.some((tool) => filter.tools.includes(tool));
    const matchesCategories =
      !hasCategoryFilter || skill.categories.some((category) => filter.categories.includes(category));
    return matchesTools && matchesCategories;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/filterSkills.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filterSkills.ts tests/lib/filterSkills.test.ts
git commit -m "Add faceted filter engine (OR within group, AND across groups)"
```

---

### Task 4: Seed content — 8 skill entries + preview graphics

**Files:**
- Create: `src/content/skills/frontend-design.mdx`
- Create: `src/content/skills/brand-guidelines.mdx`
- Create: `src/content/skills/improve-animations.mdx`
- Create: `src/content/skills/better-accessibility.mdx`
- Create: `src/content/skills/make-interfaces-feel-better.mdx`
- Create: `src/content/skills/better-writing.mdx`
- Create: `src/content/skills/web-design-guidelines.mdx`
- Create: `src/content/skills/react-view-transitions.mdx`
- Create: `public/previews/frontend-design.svg`
- Create: `public/previews/brand-guidelines.svg`
- Create: `public/previews/improve-animations.svg`
- Create: `public/previews/better-accessibility.svg`
- Create: `public/previews/make-interfaces-feel-better.svg`
- Create: `public/previews/better-writing.svg`
- Create: `public/previews/web-design-guidelines.svg`
- Create: `public/previews/react-view-transitions.svg`

**Interfaces:**
- Consumes: `skillSchema` (Task 2) — every file's frontmatter must satisfy it.
- Produces: 8 entries in the `skills` content collection, queryable via `getCollection('skills')` in Task 8, 10, 11.

Preview graphics are generated placeholder cards (paper background, ink text, a category-colored accent bar) — not screenshots or logos — since no real preview media exists yet. Real preview media can replace these files later without any schema or code change.

- [ ] **Step 1: Create `src/content/skills/frontend-design.mdx`**

```mdx
---
slug: frontend-design
name: Frontend Design
tagline: "Claude's actual design-lead persona — useful for turning \"clean and modern\" into an actual point of view."
sourceUrl: https://github.com/anthropics/skills/tree/main/skills/frontend-design
sourceAuthor: Anthropic
tools: [claude, claude-code, generic]
categories: [ui-aesthetics]
previewType: image
previewAssets: ["/previews/frontend-design.svg"]
rating: 5
addedDate: 2026-07-25
lastVerified: 2026-07-29
status: active
featured: true
---

Claude's own design-lead persona, distilled into a skill file. Rather than a checklist, it's a point of view: name the subject before designing anything, treat the hero section as a thesis rather than a template slot, and work in two passes — a compact token plan (color, type, layout, signature), a self-critique against three named "AI-generated" defaults, then the build.

The named defaults are the useful part: cream-and-terracotta, near-black-with-one-accent, and broadsheet-hairline-newspaper. Naming them doesn't ban them — it just means picking one has to be a choice, not a reflex. That's the difference between "clean and modern" as a brief and an actual creative decision.

**Install**: this ships inside Anthropic's public `skills` repo, which bundles a `.claude-plugin` marketplace manifest — add it as a Claude Code plugin source, or copy `skills/frontend-design/` straight into your own `.claude/skills/` directory.

**Gotcha**: it explicitly tells the model to watch for CSS specificity collisions between type-based and element-based selectors (`.section` vs `.cta`) — a real, specific failure mode, not generic advice. Expect it to ask more brief-clarifying questions than a typical UI prompt; that's by design.
```

- [ ] **Step 2: Create `public/previews/frontend-design.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#c1666b"/>
  <text x="60" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#141413">Frontend Design</text>
  <text x="60" y="345" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">UI AESTHETICS</text>
</svg>
```

- [ ] **Step 3: Create `src/content/skills/brand-guidelines.mdx`**

```mdx
---
slug: brand-guidelines
name: Brand Guidelines
tagline: "A tight, portable pattern for baking exact brand colors and type rules into anything Claude touches."
sourceUrl: https://github.com/anthropics/skills/tree/main/skills/brand-guidelines
sourceAuthor: Anthropic
tools: [claude, claude-code]
categories: [design-systems]
previewType: image
previewAssets: ["/previews/brand-guidelines.svg"]
rating: 4
addedDate: 2026-07-20
lastVerified: 2026-07-29
status: active
featured: false
---

A short, mechanical skill: apply Anthropic's own brand colors (dark `#141413`, light `#faf9f5`, plus orange/blue/green accents) and typography (Poppins headings, Lora body) to whatever artifact you hand it — decks, docs, exported assets. It's less a design philosophy than a stylesheet Claude can carry between formats.

What makes it worth including isn't the specific palette — it's the shape. A skill that pins exact hex values, named font roles, and a fallback chain is a clean, portable pattern for baking *your own* brand into any agent workflow: swap the values, keep the structure.

**Install**: bundled in `anthropics/skills`'s `.claude-plugin` marketplace, or copy `skills/brand-guidelines/` into `.claude/skills/` directly.

**Gotcha**: it assumes Poppins and Lora are already installed in the environment it's running in, falling back to Arial/Georgia otherwise — if you fork this for your own brand, check your target environment actually has your fonts before relying on the primary pairing.
```

- [ ] **Step 4: Create `public/previews/brand-guidelines.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#8e7cc3"/>
  <text x="60" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#141413">Brand Guidelines</text>
  <text x="60" y="345" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">DESIGN SYSTEMS</text>
</svg>
```

- [ ] **Step 5: Create `src/content/skills/improve-animations.mdx`**

```mdx
---
slug: improve-animations
name: Improve Animations
tagline: "Turns \"the app feels off\" into a prioritized, execute-anywhere motion audit."
sourceUrl: https://github.com/emilkowalski/skills/tree/main/skills/improve-animations
sourceAuthor: Emil Kowalski
tools: [claude-code, cursor, generic]
categories: [motion]
previewType: image
previewAssets: ["/previews/improve-animations.svg"]
rating: 5
addedDate: 2026-07-15
lastVerified: 2026-07-29
status: active
featured: true
---

Emil Kowalski's audit-then-plan skill for motion. It never touches source code — it surveys a codebase's animation surface (transitions, keyframes, Framer Motion/GSAP/WAAPI usage), scores findings against eight categories (easing, physicality, interruptibility, performance, accessibility, cohesion, and more), and writes fully self-contained fix plans that a *different*, cheaper agent can execute with zero context and zero taste of its own.

That last part is the interesting design decision: it treats "deciding what's wrong" and "typing out the fix" as separable work, and only spends the expensive model on the former. The output is a `plans/` directory of numbered, git-stamped implementation plans, not a diff.

**Install**: no `.claude-plugin` manifest in `emilkowalski/skills` — copy `skills/improve-animations/` (plus its `AUDIT.md` and `PLAN-TEMPLATE.md`) into your `.claude/skills/` directory.

**Gotcha**: it's read-only by hard rule — if you ask it to "just fix it," it will decline and point you at running the plan it wrote instead. Don't reach for this when you want an immediate patch; reach for it when you want a prioritized backlog.
```

- [ ] **Step 6: Create `public/previews/improve-animations.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#6a9bcc"/>
  <text x="60" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="44" fill="#141413">Improve Animations</text>
  <text x="60" y="345" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">MOTION</text>
</svg>
```

- [ ] **Step 7: Create `src/content/skills/better-accessibility.mdx`**

```mdx
---
slug: better-accessibility
name: Better Accessibility
tagline: "The a11y reference you actually want cited inline — focus rings to ARIA, with real before/afters."
sourceUrl: https://github.com/jakubkrehel/skills/tree/main/skills/better-accessibility
sourceAuthor: Jakub Krehel
tools: [claude, cursor, codex, generic]
categories: [accessibility]
previewType: image
previewAssets: ["/previews/better-accessibility.svg"]
rating: 5
addedDate: 2026-07-10
lastVerified: 2026-07-29
status: active
featured: true
---

The most citation-dense accessibility reference in this gallery: fourteen numbered principles (focus-visible over bare focus, roving tabindex on composite widgets, `aria-describedby` wiring for form errors, minimum 24×24px hit targets per WCAG 2.5.8) each paired with a "common mistakes" table of real before/after code, not just prose rules.

It's structured to be skimmed under pressure — a quick-reference table routes to per-topic files (focus-and-keyboard, semantics-and-aria, forms, screen-readers, hit-areas, motion-and-zoom) so a review doesn't have to load everything at once. The review output format itself is opinionated: findings grouped by principle, a Block/Needs-changes/Approve verdict gated strictly on whether any HIGH-severity finding survives.

**Install**: `jakubkrehel/skills` ships a `.claude-plugin` manifest — install as a plugin, or copy `skills/better-accessibility/` (with its reference files) manually.

**Gotcha**: several principles explicitly hand off to sibling skills in the same repo (contrast math to `better-colors`, input-zoom sizing to `better-typography`) — install those alongside it if you want the cross-references to resolve to real skills rather than dead ends.
```

- [ ] **Step 8: Create `public/previews/better-accessibility.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#5b8c5a"/>
  <text x="60" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#141413">Better Accessibility</text>
  <text x="60" y="345" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">ACCESSIBILITY</text>
</svg>
```

- [ ] **Step 9: Create `src/content/skills/make-interfaces-feel-better.mdx`**

```mdx
---
slug: make-interfaces-feel-better
name: Make Interfaces Feel Better
tagline: "Nineteen small physical details — concentric radii, tabular numbers, scale-on-press — that add up to \"feels expensive.\""
sourceUrl: https://github.com/jakubkrehel/make-interfaces-feel-better
sourceAuthor: Jakub Krehel
tools: [claude, cursor, codex, generic]
categories: [motion, ui-aesthetics]
previewType: image
previewAssets: ["/previews/make-interfaces-feel-better.svg"]
rating: 5
addedDate: 2026-07-05
lastVerified: 2026-07-29
status: active
featured: true
---

Nineteen small, extremely specific physical-detail rules — the kind that don't show up in a style guide but that your eye clocks instantly when they're missing. Concentric border radius (outer = inner + padding). Scale-on-press pinned to exactly `0.96`, never below `0.95`. Icon stroke width matched to adjacent text weight. A pure-black-or-white 10% outline on images, explicitly *not* a tinted neutral, because a tinted outline "reads as dirt on the image edge."

The instruction to slow every animation to 10% speed in the browser's Animations panel before judging it is the kind of concrete, repeatable check that makes a review skill actually useful rather than vibes-based.

**Install**: standalone repo, no plugin manifest — copy `skills/make-interfaces-feel-better/` (with its five reference files: typography, surfaces, animations, icons, performance) into `.claude/skills/`.

**Gotcha**: several rules assume a specific motion library convention (`motion`/`framer-motion` in `package.json`) and branch behavior accordingly — read the animations reference before applying its icon-transition guidance to a project with no motion library installed.
```

- [ ] **Step 10: Create `public/previews/make-interfaces-feel-better.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#6a9bcc"/>
  <text x="60" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#141413">Make Interfaces</text>
  <text x="60" y="320" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#141413">Feel Better</text>
  <text x="60" y="365" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">MOTION</text>
</svg>
```

- [ ] **Step 11: Create `src/content/skills/better-writing.mdx`**

```mdx
---
slug: better-writing
name: Better Writing
tagline: "Microcopy rules that catch \"Oops, something went wrong\" before it ships."
sourceUrl: https://github.com/jakubkrehel/skills/tree/main/skills/better-writing
sourceAuthor: Jakub Krehel
tools: [claude, cursor, codex, generic]
categories: [copywriting]
previewType: image
previewAssets: ["/previews/better-writing.svg"]
rating: 4
addedDate: 2026-06-20
lastVerified: 2026-07-29
status: active
featured: false
---

UX copy rules pitched at the writing that's easiest to get wrong under deadline: verb-first buttons ("Delete project," never bare "OK"), one capitalization policy applied consistently, settings labeled for their ON state, and — the rule most worth stealing — never concatenate strings around a variable (`"You have " + n + " messages"`), because word order isn't stable across languages.

Its error-copy rule is the sharpest thing in it: an error is an instruction, sited next to the field that broke, with no "Oops" and no blame. The before/after table format (used across this author's whole skill set) makes every rule falsifiable against real code rather than aspirational.

**Install**: bundled in `jakubkrehel/skills`'s `.claude-plugin` marketplace, or copy `skills/better-writing/` directly.

**Gotcha**: principle #1 is "recon the existing voice" before changing anything — it's designed to defer to a product's established terminology, not overwrite it with generic plain-language defaults. Skipping that recon step is the most common way to misuse it.
```

- [ ] **Step 12: Create `public/previews/better-writing.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#d9a441"/>
  <text x="60" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#141413">Better Writing</text>
  <text x="60" y="345" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">COPYWRITING</text>
</svg>
```

- [ ] **Step 13: Create `src/content/skills/web-design-guidelines.mdx`**

```mdx
---
slug: web-design-guidelines
name: Web Design Guidelines
tagline: "A thin wrapper that always fetches Vercel's live interface guidelines before reviewing your UI."
sourceUrl: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
sourceAuthor: Vercel
tools: [claude, cursor, codex, copilot, generic]
categories: [accessibility, ui-aesthetics]
previewType: image
previewAssets: ["/previews/web-design-guidelines.svg"]
rating: 3
addedDate: 2026-06-10
lastVerified: 2026-07-29
status: active
featured: false
---

The thinnest skill in this gallery, and deliberately so: it doesn't encode any rules of its own. It fetches Vercel's `web-interface-guidelines` document fresh from GitHub on every run, reads the files you point it at, and reports findings in a terse `file:line` format against whatever the guidelines say *today*.

That's the whole pitch — a review skill that can't go stale, because it has no opinions cached locally to go stale. Worth including as a contrast to every other entry here, which bakes its rules directly into the skill file.

**Install**: from `vercel-labs/agent-skills` — copy `skills/web-design-guidelines/` into `.claude/skills/`.

**Gotcha**: it needs live network access (a working `WebFetch`) to do anything at all — it has no offline fallback, so it's the wrong choice in a sandboxed or network-restricted agent environment.
```

- [ ] **Step 14: Create `public/previews/web-design-guidelines.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#5b8c5a"/>
  <text x="60" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="#141413">Web Design</text>
  <text x="60" y="318" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="#141413">Guidelines</text>
  <text x="60" y="360" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">ACCESSIBILITY</text>
</svg>
```

- [ ] **Step 15: Create `src/content/skills/react-view-transitions.mdx`**

```mdx
---
slug: react-view-transitions
name: React View Transitions
tagline: "The missing manual for React's View Transition API — when to animate, when not to, copy-paste CSS included."
sourceUrl: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions
sourceAuthor: Vercel
tools: [claude, claude-code, cursor, codex, copilot, generic]
categories: [motion]
previewType: image
previewAssets: ["/previews/react-view-transitions.svg"]
rating: 4
addedDate: 2026-06-01
lastVerified: 2026-07-29
status: active
featured: false
---

The clearest explanation of React's `<ViewTransition>` API available anywhere right now: a priority-ordered list of five animation patterns (shared element, Suspense reveal, list identity, state change, route change), a rule for when *not* to use directional slides (lateral tab-to-tab navigation has no depth to communicate, so don't fake one), and copy-paste CSS recipes instead of hand-rolled keyframes.

The placement rule alone — a `<ViewTransition>` only fires enter/exit if it appears before any DOM nodes, not wrapped inside a `<div>` — is the kind of gotcha that costs an hour of confused debugging without this skill in the room.

**Install**: from `vercel-labs/agent-skills` — copy `skills/react-view-transitions/` (with its `references/implementation.md` and `references/css-recipes.md`) into `.claude/skills/`.

**Gotcha**: outside of Next.js's App Router (which already bundles a canary React internally), this requires `react@canary react-dom@canary` — `ViewTransition` isn't in stable React yet. Don't reach for this on a stable-React project without planning for that upgrade.
```

- [ ] **Step 16: Create `public/previews/react-view-transitions.svg`**

```svg
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#faf9f5"/>
  <rect x="0" y="0" width="800" height="10" fill="#6a9bcc"/>
  <text x="60" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="#141413">React View</text>
  <text x="60" y="318" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="#141413">Transitions</text>
  <text x="60" y="360" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="2" fill="#8d8a7d">MOTION</text>
</svg>
```

- [ ] **Step 17: Validate all 8 entries against the schema**

Run: `npx astro sync`
Expected: exits 0 with no Zod validation errors. If any entry fails, the error names the file and the invalid field — fix it before continuing.

- [ ] **Step 18: Commit**

```bash
git add src/content/skills public/previews
git commit -m "Add 8 seed skill entries with researched editorial write-ups"
```

---

### Task 5: `ToolBadge.astro` component

**Files:**
- Create: `src/components/ToolBadge.astro`

**Interfaces:**
- Consumes: `TOOL_META` from `src/lib/toolMeta.ts` (Task 2).
- Produces: `ToolBadge.astro`, `Props: { tool: string }`. Consumed by Task 6 (`SkillCard`) and Task 11 (`/skills/[slug]`).

No real tool logos have been supplied, so per the spec this renders a colored text pill for every tool (the documented fallback) rather than attempting to reproduce third-party logos.

- [ ] **Step 1: Create `src/components/ToolBadge.astro`**

```astro
---
import { TOOL_META } from '../lib/toolMeta';

interface Props {
  tool: string;
}

const { tool } = Astro.props;
const meta = TOOL_META[tool] ?? TOOL_META.generic;
---

<span
  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
  style={`background-color: ${meta.color}`}
>
  {meta.label}
</span>
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx astro check`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolBadge.astro
git commit -m "Add ToolBadge component (colored text pills)"
```

---

### Task 6: `SkillCard.astro` component

**Files:**
- Create: `src/components/SkillCard.astro`

**Interfaces:**
- Consumes: `ToolBadge` (Task 5); `CollectionEntry<'skills'>` shape from the `skills` collection (Task 2/4) — reads `skill.data.{name,tagline,tools,rating,previewAssets,slug}`.
- Produces: `SkillCard.astro`, `Props: { skill: CollectionEntry<'skills'> }`. Consumed by Task 8 (homepage), Task 9 (`FilterBar`).

- [ ] **Step 1: Create `src/components/SkillCard.astro`**

```astro
---
import ToolBadge from './ToolBadge.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  skill: CollectionEntry<'skills'>;
}

const { skill } = Astro.props;
const { name, tagline, tools, rating, previewAssets, slug } = skill.data;
---

<a href={`/skills/${slug}/`} class="group flex flex-col gap-3">
  <div class="aspect-[4/3] w-full overflow-hidden rounded-md bg-stone-100">
    <img
      src={previewAssets[0]}
      alt={`Preview of ${name}`}
      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      loading="lazy"
    />
  </div>
  <div class="flex flex-col gap-1">
    <h3 class="font-serif text-lg text-ink">{name}</h3>
    <p class="text-sm text-stone-600">{tagline}</p>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    {tools.map((tool) => <ToolBadge tool={tool} />)}
    <span class="ml-auto text-xs text-stone-400" aria-label={`Rated ${rating} out of 5`}>
      {'●'.repeat(rating)}{'○'.repeat(5 - rating)}
    </span>
  </div>
</a>
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx astro check`
Expected: exits 0, no errors (the `bg-ink`/`text-ink` classes referenced here resolve once Task 7 defines the `--color-ink` theme token; Tailwind won't error on an unrecognized utility, it simply won't generate CSS for it yet, so this step only checks Astro/TS types, not visual output).

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillCard.astro
git commit -m "Add SkillCard component"
```

---

### Task 7: `BaseLayout.astro` + site-wide styling

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BaseLayout.astro`, `Props: { title: string; description?: string }`; global Tailwind theme tokens `bg-paper`, `text-ink`, `text-accent`, `bg-accent`, `font-serif`, `font-sans` usable anywhere after this task. Consumed by Tasks 8, 10, 11, 12, 13.

- [ ] **Step 1: Replace `src/styles/global.css` with the full theme**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-serif: "Fraunces", ui-serif, Georgia, serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --color-paper: #faf9f5;
  --color-ink: #141413;
  --color-accent: #c1666b;
}
```

- [ ] **Step 2: Create `src/layouts/BaseLayout.astro`**

```astro
---
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const {
  title,
  description = 'A curated gallery of design and design-engineering skills for AI agents.',
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · Design Skills</title>
    <meta name="description" content={description} />
  </head>
  <body class="bg-paper font-sans text-ink antialiased">
    <header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
      <a href="/" class="font-serif text-xl">Design Skills</a>
      <nav class="flex gap-6 text-sm">
        <a href="/skills">Gallery</a>
        <a href="/submit">Submit</a>
        <a href="/newsletter">Newsletter</a>
      </nav>
    </header>
    <main class="mx-auto max-w-6xl px-6 pb-24">
      <slot />
    </main>
    <footer class="mx-auto max-w-6xl px-6 py-12 text-sm text-stone-500">
      <p>A hand-picked gallery of design and design-engineering skills.</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 3: Point the placeholder homepage at the new layout to verify it renders**

Modify `src/pages/index.astro` (temporary — Task 8 replaces this file's contents entirely):

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Home">
  <h1 class="text-2xl font-bold">Coming soon</h1>
</BaseLayout>
```

- [ ] **Step 4: Verify the dev server renders the themed page**

Run: `npm run dev` (in the background), then in another terminal: `curl -s http://localhost:4321/ | grep -o '<title>[^<]*</title>'`
Expected: outputs `<title>Home · Design Skills</title>`. Stop the dev server afterward.

- [ ] **Step 5: Verify the build still succeeds**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "Add BaseLayout with editorial theme (paper/ink palette, Fraunces + Inter)"
```

---

### Task 8: Homepage

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 7), `SkillCard` (Task 6), `getCollection('skills')` (Task 2/4).
- Produces: the `/` route.

- [ ] **Step 1: Replace `src/pages/index.astro` with the real homepage**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import SkillCard from '../components/SkillCard.astro';

const allSkills = await getCollection('skills', ({ data }) => data.status !== 'archived');
const sorted = [...allSkills].sort((a, b) => b.data.addedDate.valueOf() - a.data.addedDate.valueOf());
const featured = sorted.filter((s) => s.data.featured).slice(0, 5);
---

<BaseLayout title="Home">
  <section class="py-16 sm:py-24">
    <h1 class="max-w-2xl font-serif text-5xl font-semibold leading-tight sm:text-6xl">
      A curated gallery of design skills for AI agents.
    </h1>
    <p class="mt-6 max-w-xl text-lg text-stone-600">
      Hand-picked SKILL.md files and design-tool instructions — Sidebar.io meets an
      awesome-list, not a scraped registry.
    </p>
  </section>

  <section class="mb-20">
    <h2 class="mb-6 font-serif text-2xl font-semibold">This month's picks</h2>
    <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {featured.map((skill) => <SkillCard skill={skill} />)}
    </div>
  </section>

  <section>
    <h2 class="mb-6 font-serif text-2xl font-semibold">All skills</h2>
    <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((skill) => <SkillCard skill={skill} />)}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Build and verify the homepage lists all 8 skills**

Run: `npm run build && grep -c "group flex flex-col gap-3" dist/index.html`
Expected: exits 0; the grep count is `12` (8 cards in "All skills" + 4 in "This month's picks", since `frontend-design`, `improve-animations`, `better-accessibility`, and `make-interfaces-feel-better` are the 4 `featured: true` entries).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "Build homepage with featured picks strip and full grid"
```

---

### Task 9: `FilterBar.astro` (filter island)

**Files:**
- Create: `src/components/FilterBar.astro`

**Interfaces:**
- Consumes: `filterSkills` (Task 3), `TOOL_META`/`CATEGORY_META`/`TOOL_VALUES`/`CATEGORY_VALUES` (Task 2), `SkillCard` (Task 6).
- Produces: `FilterBar.astro`, `Props: { skills: CollectionEntry<'skills'>[] }`. Consumed by Task 10 (`/skills`).

Cards are server-rendered for every skill up front (so the page works with JS disabled); the inline `<script>` only toggles visibility client-side. This is the "small filter island" — no UI framework, no re-fetch.

- [ ] **Step 1: Create `src/components/FilterBar.astro`**

```astro
---
import { TOOL_META } from '../lib/toolMeta';
import { CATEGORY_META } from '../lib/categoryMeta';
import { TOOL_VALUES, CATEGORY_VALUES } from '../content/skillSchema';
import SkillCard from './SkillCard.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  skills: CollectionEntry<'skills'>[];
}

const { skills } = Astro.props;
---

<div class="flex flex-col gap-8 lg:flex-row lg:gap-12">
  <aside class="lg:w-56 shrink-0">
    <fieldset class="mb-8">
      <legend class="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">Tools</legend>
      <div class="flex flex-col gap-2">
        {TOOL_VALUES.map((tool) => (
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" value={tool} data-filter="tools" class="accent-ink" />
            {TOOL_META[tool].label}
          </label>
        ))}
      </div>
    </fieldset>
    <fieldset>
      <legend class="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">Categories</legend>
      <div class="flex flex-col gap-2">
        {CATEGORY_VALUES.map((category) => (
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" value={category} data-filter="categories" class="accent-ink" />
            {CATEGORY_META[category].label}
          </label>
        ))}
      </div>
    </fieldset>
  </aside>

  <div class="flex-1">
    <p id="filter-count" class="mb-4 text-sm text-stone-500"></p>
    <p id="filter-empty" class="hidden text-sm text-stone-500">No skills match those filters.</p>
    <div id="skill-grid" class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill) => (
        <div
          data-skill-card
          data-tools={skill.data.tools.join(',')}
          data-categories={skill.data.categories.join(',')}
        >
          <SkillCard skill={skill} />
        </div>
      ))}
    </div>
  </div>
</div>

<script>
  import { filterSkills } from '../lib/filterSkills';

  const grid = document.getElementById('skill-grid')!;
  const countLabel = document.getElementById('filter-count')!;
  const emptyLabel = document.getElementById('filter-empty')!;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-skill-card]'));
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-filter]'));

  const entries = cards.map((card) => ({
    el: card,
    tools: (card.dataset.tools ?? '').split(',').filter(Boolean),
    categories: (card.dataset.categories ?? '').split(',').filter(Boolean),
  }));

  function currentFilter() {
    const tools = checkboxes
      .filter((checkbox) => checkbox.dataset.filter === 'tools' && checkbox.checked)
      .map((checkbox) => checkbox.value);
    const categories = checkboxes
      .filter((checkbox) => checkbox.dataset.filter === 'categories' && checkbox.checked)
      .map((checkbox) => checkbox.value);
    return { tools, categories };
  }

  function applyFilter() {
    const filter = currentFilter();
    const matched = filterSkills(entries, filter);
    const matchedSet = new Set(matched.map((entry) => entry.el));

    for (const entry of entries) {
      entry.el.hidden = !matchedSet.has(entry.el);
    }

    countLabel.textContent = `Showing ${matched.length} of ${entries.length} skills`;
    emptyLabel.classList.toggle('hidden', matched.length > 0);
  }

  checkboxes.forEach((checkbox) => checkbox.addEventListener('change', applyFilter));
  applyFilter();
</script>
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx astro check`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterBar.astro
git commit -m "Add FilterBar island (vanilla TS, OR-within/AND-across facets)"
```

---

### Task 10: `/skills` page

**Files:**
- Create: `src/pages/skills/index.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 7), `FilterBar` (Task 9), `getCollection('skills')` (Task 2/4).
- Produces: the `/skills` route.

- [ ] **Step 1: Create `src/pages/skills/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import FilterBar from '../../components/FilterBar.astro';

const allSkills = await getCollection('skills', ({ data }) => data.status !== 'archived');
const sorted = [...allSkills].sort((a, b) => b.data.addedDate.valueOf() - a.data.addedDate.valueOf());
---

<BaseLayout title="Gallery" description="The full gallery of design and design-engineering skills.">
  <h1 class="mb-10 font-serif text-4xl font-semibold">All skills</h1>
  <FilterBar skills={sorted} />
</BaseLayout>
```

- [ ] **Step 2: Build and manually verify filtering in the browser**

Run: `npm run build && npm run preview` (in the background)

Then open `http://localhost:4321/skills` in a browser and verify:
- All 8 cards show, and the counter reads "Showing 8 of 8 skills".
- Checking the "Cursor" tool checkbox narrows the grid to skills tagged `cursor` and updates the counter.
- Additionally checking a category checkbox (e.g. "Motion") narrows further to skills matching both.
- Unchecking all boxes restores all 8 cards.

Stop the preview server afterward.

- [ ] **Step 3: Commit**

```bash
git add src/pages/skills/index.astro
git commit -m "Add /skills gallery page with client-side filtering"
```

---

### Task 11: `/skills/[slug]` detail page

**Files:**
- Create: `src/pages/skills/[slug].astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 7), `ToolBadge` (Task 5), `getCollection`/`render` from `astro:content` (Task 2/4).
- Produces: the `/skills/:slug` route for each of the 8 seed entries.

- [ ] **Step 1: Create `src/pages/skills/[slug].astro`**

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ToolBadge from '../../components/ToolBadge.astro';

export async function getStaticPaths() {
  const skills = await getCollection('skills');
  return skills.map((entry) => ({
    params: { slug: entry.data.slug },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
const { name, tagline, tools, rating, sourceUrl, sourceAuthor, lastVerified, previewAssets, status } =
  entry.data;
---

<BaseLayout title={name} description={tagline}>
  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_1fr]">
    <div>
      <img src={previewAssets[0]} alt={`Preview of ${name}`} class="mb-8 w-full rounded-md" />
      <h1 class="mb-2 font-serif text-4xl font-semibold">{name}</h1>
      <p class="mb-8 text-lg text-stone-600">{tagline}</p>
      <article class="prose prose-stone max-w-none">
        <Content />
      </article>
    </div>
    <aside class="flex flex-col gap-6 text-sm">
      {status === 'superseded' && (
        <p class="rounded-md bg-amber-100 px-3 py-2 text-amber-900">
          This skill has been superseded by a newer entry.
        </p>
      )}
      <div>
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Works with</h2>
        <div class="flex flex-wrap gap-2">
          {tools.map((tool) => <ToolBadge tool={tool} />)}
        </div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Rating</h2>
        <p aria-label={`Rated ${rating} out of 5`}>{'●'.repeat(rating)}{'○'.repeat(5 - rating)}</p>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Source</h2>
        <p><a href={sourceUrl} class="underline">{sourceAuthor}</a></p>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Last verified</h2>
        <p>{lastVerified.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </aside>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Build and verify all 8 detail pages are generated**

Run: `npm run build && ls dist/skills/`
Expected: 8 directories, one per slug: `frontend-design/`, `brand-guidelines/`, `improve-animations/`, `better-accessibility/`, `make-interfaces-feel-better/`, `better-writing/`, `web-design-guidelines/`, `react-view-transitions/` (each containing an `index.html`).

- [ ] **Step 3: Spot-check one page's rendered content**

Run: `grep -o '<h1[^>]*>[^<]*</h1>' dist/skills/frontend-design/index.html`
Expected: `<h1 class="mb-2 font-serif text-4xl font-semibold">Frontend Design</h1>`.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/skills/[slug].astro"
git commit -m "Add skill detail page"
```

---

### Task 12: `/submit` page

**Files:**
- Create: `src/pages/submit.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 7).
- Produces: the `/submit` route.

- [ ] **Step 1: Create `src/pages/submit.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Submit a skill" description="Suggest a skill for the gallery.">
  <h1 class="mb-4 font-serif text-4xl">Submit a skill</h1>
  <p class="mb-10 max-w-xl text-stone-600">
    Suggest a skill for the gallery. This does not publish automatically — every
    submission is reviewed by hand before it's added.
  </p>

  <!--
    Replace YOUR_FORM_ID with the ID from your Formspree form
    (https://formspree.io/forms) before deploying.
  -->
  <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" class="flex max-w-xl flex-col gap-6">
    <label class="flex flex-col gap-2 text-sm">
      Skill name
      <input type="text" name="skillName" required class="rounded-md border border-stone-300 px-3 py-2" />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      Source URL
      <input type="url" name="sourceUrl" required class="rounded-md border border-stone-300 px-3 py-2" />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      Tool(s)
      <input
        type="text"
        name="tools"
        placeholder="e.g. Claude, Cursor"
        required
        class="rounded-md border border-stone-300 px-3 py-2"
      />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      Category
      <input
        type="text"
        name="category"
        placeholder="e.g. motion, accessibility"
        required
        class="rounded-md border border-stone-300 px-3 py-2"
      />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      Your name
      <input type="text" name="submitterName" required class="rounded-md border border-stone-300 px-3 py-2" />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      Your email
      <input type="email" name="submitterEmail" required class="rounded-md border border-stone-300 px-3 py-2" />
    </label>
    <label class="flex flex-col gap-2 text-sm">
      One-line pitch
      <textarea name="pitch" required rows="3" class="rounded-md border border-stone-300 px-3 py-2"></textarea>
    </label>
    <button type="submit" class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
      Submit for review
    </button>
  </form>
</BaseLayout>
```

- [ ] **Step 2: Verify the build succeeds and the form action placeholder is present**

Run: `npm run build && grep -o 'action="[^"]*"' dist/submit/index.html`
Expected: `action="https://formspree.io/f/YOUR_FORM_ID"`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/submit.astro
git commit -m "Add /submit page (Formspree, placeholder form ID)"
```

---

### Task 13: `/newsletter` page

**Files:**
- Create: `src/pages/newsletter.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 7).
- Produces: the `/newsletter` route.

- [ ] **Step 1: Create `src/pages/newsletter.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

interface ArchiveIssue {
  title: string;
  url: string;
  publishedAt: string;
}

const archive: ArchiveIssue[] = [];
---

<BaseLayout
  title="Newsletter"
  description="Sign up for occasional emails about new skills added to the gallery."
>
  <h1 class="mb-4 font-serif text-4xl">Newsletter</h1>
  <p class="mb-10 max-w-xl text-stone-600">
    Occasional emails when a genuinely good skill gets added. No spam.
  </p>

  <!--
    Placeholder Buttondown embed. Replace YOUR_USERNAME with your Buttondown
    username before deploying: https://buttondown.com/emails
  -->
  <form
    action="https://buttondown.com/api/emails/embed-subscribe/YOUR_USERNAME"
    method="post"
    target="popupwindow"
    class="mb-16 flex max-w-md gap-3"
  >
    <input
      type="email"
      name="email"
      required
      placeholder="you@example.com"
      class="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
    />
    <button type="submit" class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
      Subscribe
    </button>
  </form>

  <h2 class="mb-6 font-serif text-2xl">Archive</h2>
  {
    archive.length === 0 ? (
      <p class="text-sm text-stone-500">No issues yet — check back soon.</p>
    ) : (
      <ul class="flex flex-col gap-3">
        {archive.map((issue) => (
          <li>
            <a href={issue.url} class="underline">{issue.title}</a>
            <span class="ml-2 text-sm text-stone-500">{issue.publishedAt}</span>
          </li>
        ))}
      </ul>
    )
  }
</BaseLayout>
```

- [ ] **Step 2: Verify the build succeeds and the placeholder empty-state renders**

Run: `npm run build && grep -o 'No issues yet[^<]*' dist/newsletter/index.html`
Expected: `No issues yet — check back soon.`

- [ ] **Step 3: Commit**

```bash
git add src/pages/newsletter.astro
git commit -m "Add /newsletter page (Buttondown placeholder + empty archive)"
```

---

### Task 14: Final verification & README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the entire project.
- Produces: nothing new — this task only verifies and documents.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — 12 tests total (5 schema + 2 taxonomy + 5 filterSkills).

- [ ] **Step 2: Run the full type-check**

Run: `npx astro check`
Expected: exits 0, no errors.

- [ ] **Step 3: Run the full production build**

Run: `npm run build`
Expected: exits 0, prints a success message covering all routes: `/`, `/skills`, `/skills/<8 slugs>`, `/submit`, `/newsletter` (11 total HTML pages).

- [ ] **Step 4: Manually walk every page in the browser**

Run: `npm run preview` (in the background), then visit and check each of:
- `http://localhost:4321/` — hero renders with the oversized serif headline, "This month's picks" shows 4 cards, full grid shows 8.
- `http://localhost:4321/skills` — filtering works as verified in Task 10, Step 2.
- `http://localhost:4321/skills/frontend-design` (and at least one other slug) — write-up renders, tool badges show, rating dots show, source link points to the real GitHub URL, last-verified date is formatted.
- `http://localhost:4321/submit` — all 7 form fields render and are focusable/typeable.
- `http://localhost:4321/newsletter` — signup form renders, archive shows the empty state.

Stop the preview server afterward.

- [ ] **Step 5: Update `README.md`**

```md
# Design Skills Gallery

A curated, editorial gallery of design and design-engineering "skill" files for
AI coding agents (Claude, Cursor, Codex, Copilot) and design tools (Figma, Miro).

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

## Other commands

- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run test` — run the Vitest suite (schema, taxonomy, filter engine)
- `npm run check` — Astro type-check

## Before deploying

- Replace `YOUR_FORM_ID` in `src/pages/submit.astro` with your real Formspree form ID.
- Replace `YOUR_USERNAME` in `src/pages/newsletter.astro` with your real Buttondown username.

## Content

Skills live as MDX files in `src/content/skills/`, validated at build time against
the schema in `src/content/skillSchema.ts`. See
`docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md` for the full
design spec.
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "Document dev commands and pre-deploy checklist in README"
```
