# Design Skills Gallery — Design Spec

Date: 2026-07-29
Status: Approved by user, ready for implementation planning

## Purpose

A curated, visual gallery site for design and design-engineering "skills" — the
SKILL.md-style instruction files used by AI agents (Claude, Cursor, Codex,
Copilot) and design tools (Figma, Miro) where relevant. Hand-picked and
editorial in voice — "Sidebar.io meets an awesome-list" — not a scraped
registry.

## Stack

- **Astro** + TypeScript (`astro check` for type safety)
- **Tailwind CSS** for styling
- **Content Collections** (`src/content/config.ts`) as the schema/source of
  truth for all skill entries, validated with Zod at build time
- Filter UI ships as a small **vanilla TypeScript** island — no React/Vue/
  Svelte dependency, since it's just checkbox-driven filtering over a static
  JSON array
- Package manager: npm
- Deploy target: **Vercel** (Astro's static output needs no adapter config
  for a first pass)
- Form backend: **Formspree** — plain `<form action="https://formspree.io/f/{id}">`,
  styled natively, no embed script. Placeholder form ID left for the user to
  swap in.
- Newsletter: placeholder block for **Buttondown**, wired later by the user.

### Why Astro over Next+MDX

Content Collections give schema-validated MDX out of the box (a build fails
if frontmatter is malformed), and the islands architecture means the site
ships ~0 JS by default with only the filter UI hydrating client-side — both
map directly onto this project's stated requirements. Next+MDX would need a
third-party content layer (Contentlayer is unmaintained; alternatives add
config) to reach schema validation, and needs more care to avoid broader
hydration by default.

## Project structure

```
src/
  content/
    config.ts          # Zod schema for the "skills" collection
    skills/*.mdx        # one file per skill entry
  components/
    SkillCard.astro
    ToolBadge.astro
    FilterBar.ts        # vanilla TS filter island logic
    FilterBar.astro     # island shell
  layouts/
    BaseLayout.astro
  pages/
    index.astro
    skills/index.astro
    skills/[slug].astro
    submit.astro
    newsletter.astro
public/
  previews/             # per-skill preview images
  logos/                # tool SVG logos (claude, cursor, codex, copilot, figma, miro)
```

## Content schema (`src/content/config.ts`)

```ts
slug: string
name: string
tagline: string          // editorial one-liner, our voice — not copied from source
sourceUrl: string
sourceAuthor: string
tools: z.array(z.enum([
  'claude', 'claude-code', 'cursor', 'codex', 'copilot', 'figma', 'miro', 'generic'
]))
categories: z.array(z.enum([
  'ui-aesthetics', 'motion', 'accessibility', 'design-systems', 'copywriting', 'diagramming'
]))
previewType: z.enum(['image', 'video', 'before-after'])
previewAssets: z.array(z.string())
rating: z.number().min(1).max(5)
addedDate: z.date()
lastVerified: z.date()
status: z.enum(['active', 'archived', 'superseded'])
featured: z.boolean().default(false)   // drives the homepage "this month's picks" strip
```

`tools` and `categories` are closed enums rather than free text — adding a
value later is a one-line schema change, but keeping them constrained now
prevents typos from silently fragmenting the filter UI. This schema is the
migration seam: moving to Postgres later is a straightforward row-per-file
import job, since every field is already flat and typed.

The MDX body is the longer editorial write-up: why the skill is good, how to
install it, gotchas.

## Pages

- **`/`** — hero, then a "This Month's Picks" strip (entries with
  `featured: true`, 3-5 of them), then the full gallery grid below (same
  `SkillCard` component, reused).
- **`/skills`** — `getCollection('skills')` at build time, sorted by
  `addedDate` desc, excluding `status: 'archived'` (kept in the repo for
  history but off the visible grid; `superseded` still shows since that's
  informative). The full list serializes as a small JSON payload; `FilterBar`
  filters it client-side — AND within a facet group, OR across groups (e.g.
  checking "cursor" + "codex" shows either; checking "cursor" + "motion"
  requires both). No backend, no re-fetch.
- **`/skills/[slug]`** — `getStaticPaths()` over the collection; renders the
  MDX write-up plus a metadata sidebar (source link, tool badges, rating,
  last verified date).
- **`/submit`** — plain HTML form posting to Formspree, styled to match the
  site. Fields: skill name, source URL, tool(s), category, submitter name/
  email, one-line pitch. Does not auto-publish — just notifies the site owner
  by email for manual review.
- **`/newsletter`** — placeholder Buttondown signup block (styled, not yet
  wired to a live endpoint) + an archive list rendered from an empty array.

## Visual design

Editorial gallery aesthetic — closer to a design portfolio or magazine than a
SaaS template. Serif or high-contrast display font for headings (self-hosted
via `@fontsource`, no external font-loading dependency), clean sans for body/
UI text, generous whitespace, restrained neutral palette (paper background,
ink-black text, one accent color). Cards: preview image on top, name +
tagline, small colorful tool-badge pills, subtle rating indicator (dots or
stars, not loud).

`ToolBadge.astro` takes a `tool` prop and renders an SVG logo from
`public/logos/` if one exists, else falls back to a text pill. Placeholder
SVGs will be created for claude, cursor, codex, copilot, figma, miro — real
logo assets can be swapped in later.

## Seed content (8 entries)

Pulled from real, verified public repos (confirmed via `gh repo view` /
`gh api` during this session) — no invented entries. Each gets an original
editorial write-up in the site's own voice, not copied from the source
README.

| Skill | Source repo | Category |
|---|---|---|
| Frontend Design | `anthropics/skills` (`frontend-design`) | ui-aesthetics |
| Brand Guidelines | `anthropics/skills` (`brand-guidelines`) | design-systems |
| Improve Animations | `emilkowalski/skills` (`improve-animations`) | motion |
| Better Accessibility | `jakubkrehel/skills` (`better-accessibility`) | accessibility |
| Make Interfaces Feel Better | `jakubkrehel/make-interfaces-feel-better` | motion |
| Better Writing | `jakubkrehel/skills` (`better-writing`) | copywriting |
| Web Design Guidelines | `vercel-labs/agent-skills` (`web-design-guidelines`) | accessibility |
| React View Transitions | `vercel-labs/agent-skills` (`react-view-transitions`) | motion |

`mattpocock/skills` was also considered (real, live repo) but its content is
general software-engineering (TDD, code review, merge conflicts, domain
modeling) rather than design-focused, so it's excluded from this gallery's
scope.

Note: no `diagramming`-category entry in this initial seed set — none of the
six source repos had a strong fit. Acceptable gap for a launch set; can be
filled via a future submission.

## Explicitly out of scope for this pass

- No database, no auth, no accounts (schema is structured to make a later
  Postgres migration a data-import job, not a rewrite)
- No live Buttondown wiring (placeholder only)
- No live Formspree form ID (placeholder only, user swaps in their own)
- No deploy-platform-specific config beyond what Astro's static output needs
  by default for Vercel
