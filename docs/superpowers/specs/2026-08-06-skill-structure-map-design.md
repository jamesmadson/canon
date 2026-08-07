# Skill Structure Map — Design Spec

Date: 2026-08-06
Status: Approved by user, ready for implementation planning

## Purpose

Each skill on Canon is really two things at once: a `SKILL.md` with its own
internal outline (sections, sometimes subsections), and a small package of
files around it (a `references/` folder, license, supporting docs). Right
now both are invisible — you have to click through to GitHub and actually
open files to see what you're getting. This feature adds a per-skill
"structure map" to the detail page: `SKILL.md` rendered as a hub, with one
branch unpacking its own heading outline and another showing the files that
ship alongside it, each linking straight to GitHub.

This went through two rounds of visual iteration as an Artifact mockup
before this spec was finalized:
1. An initial file-tree-only version (grouped by folder, counts + example
   filenames) was approved ("better, yes!").
2. The user then asked specifically to visualize `SKILL.md`'s own content
   taxonomy, not just the files around it — informed by reference images of
   an illustrated hub-and-arrow diagram and a genealogy-chart-style
   node/legend diagram. The design below is the result: a hub-and-branch
   layout with hover-to-expand depth, rendered in Canon's existing outline
   glyph language rather than the references' illustrated icons (a
   deliberate choice — see the Component section). This version was
   approved after a follow-up fix for row alignment and hover polish.

## Data model

`skillSchema.ts` gains two new fields.

```ts
const fileTreeEntrySchema = z.object({
  path: z.string(),               // relative to the skill's own folder,
                                    // e.g. "references/tokens.md", or
                                    // "SKILL.md" itself
  type: z.enum(['file', 'dir']),
  url: z.string().url(),          // exact GitHub blob/tree URL, branch
                                    // already resolved — component never
                                    // constructs URLs itself
});

const contentSectionSchema = z.object({
  title: z.string(),              // an H2 heading's text, e.g.
                                    // "2. Craft Rules — How to Compose"
  subsections: z.array(z.string()).default([]), // that H2's H3 children,
                                    // in document order
});

// in skillSchema:
fileTree: z.array(fileTreeEntrySchema).min(1),
contentOutline: z.array(contentSectionSchema).default([]),
```

`fileTree` entries are relative to the skill's own folder (the last path
segment of `sourceUrl`), not the repo root, and **include `SKILL.md`
itself** — the component (not the data) is responsible for excluding it
from the rendered file list, since it's shown separately as the hub. This
keeps the schema's `min(1)` guarantee simple and always true: every skill
has at least its own `SKILL.md` entry in `fileTree`.

`contentOutline` entries are **not** links — content sections are Canon's
own summary of `SKILL.md`'s structure, not a citable location, so unlike
file/folder nodes they render as plain text, no `url` field needed.

Both fields are populated in the same backfill pass. They have different
requiredness because they mean different things when empty:
- `fileTree` is required and always non-empty (`min(1)`) — an empty array
  would mean the generation script was never run for that skill, which
  should fail the build loudly, consistent with every other required field
  on this schema.
- `contentOutline` defaults to `[]` and empty is a **valid, meaningful**
  state — it means `SKILL.md` has no `##` headings (pure prose). None of
  the 11 current skills hit this, but the schema allows it without failing
  the build, because "no structure to show" isn't an error the way "script
  never ran" is.

## Generation script

A one-time script, `scripts/fetch-skill-trees.ts`, run manually via
`npx tsx scripts/fetch-skill-trees.ts` — **not** part of the Astro build or
CI. For each skill `.mdx` file:

1. Parse `sourceUrl` frontmatter into `{ owner, repo, path }`. `sourceUrl`
   is either a repo root (`github.com/{owner}/{repo}`) or a subtree
   (`github.com/{owner}/{repo}/tree/{branch}/{path}`).
2. Resolve the repo's actual default branch via `gh api repos/{owner}/{repo}
   --jq .default_branch`. (Not assumed to be `main` — `huashu-design` 404'd
   on that assumption during brainstorming.)
3. Fetch the full recursive tree via
   `gh api repos/{owner}/{repo}/git/trees/{branch}?recursive=1`.
4. Filter to entries whose path starts with the skill's path prefix, strip
   that prefix to get paths relative to the skill folder, and build the
   `fileTree` array — `type: 'dir'` for tree entries, `type: 'file'` for
   blob entries, `url` built as
   `https://github.com/{owner}/{repo}/blob/{branch}/{full path}` for files
   and `.../tree/{branch}/{full path}` for dirs.
5. Fetch `SKILL.md`'s raw content via
   `gh api repos/{owner}/{repo}/contents/{path to SKILL.md} --jq .content`
   (base64-decoded), and regex-extract its `^## ` and `^### ` lines in
   document order to build `contentOutline`: each `##` line becomes a
   `contentSectionSchema` entry, each following `###` line (until the next
   `##`) is pushed onto that entry's `subsections`. No markdown-parser
   dependency needed — heading extraction is a line-anchored regex, and
   this script isn't part of the build.
6. Rewrite that skill's `.mdx` frontmatter in place with the new `fileTree`
   and `contentOutline` fields (existing frontmatter fields and MDX body
   untouched).

Uses `gh api` (already authenticated in this environment) rather than a raw
`fetch` + personal access token — no new secret to manage for a script that
runs once and isn't part of the deploy pipeline.

This is a manual, editorial-cadence operation — the same rhythm as
`lastVerified` on each skill. Re-run by hand if a skill's upstream repo
restructures.

## Component: `StructureMap.astro`

Props: `name: string`, `tagline: string`, `fileTree: FileTreeEntry[]`,
`contentOutline: ContentSection[]` (the skill's existing `name`/`tagline`
fields are reused for the hub card — no new data needed for them).

### Layout: a hub with two branches

- **Hub**: a compact card (not full-bleed like the page's hero — this
  section already sits below that hero, so it stays a contained accent
  block, not a repeat of it) in `accent-orange` with white text: the literal
  filename `SKILL.md` (Geist Mono), the skill's `name` (Archivo 900), and
  its `tagline`.
- **Contents branch** (top): one row per `contentOutline` entry, in document
  order. A section with `subsections` shows a count badge (`9 sub`) and a
  small "hover" affordance label; hovering (or `.is-open` for the
  pre-expanded demo state) reveals up to 4 subsections, then `+N more` as
  plain text beyond that. **Omitted entirely if `contentOutline` is
  empty.**
- **Package branch** (bottom): `fileTree` filtered to exclude the entry
  whose `path === 'SKILL.md'` (already shown as the hub), then partitioned
  into root-level files and subdirectories exactly as in the original
  file-tree-only design — folders show a count + up to 3 example filenames
  + `+N more`, revealed the same hover-to-expand way as content
  subsections. **Omitted entirely if empty after filtering** — this is a
  real case today, not hypothetical: `emil-design-eng`'s only file is its
  own `SKILL.md`, so it renders with a Contents branch and no Package
  branch at all.
- If both branches are empty (no headings, no other files), the hub renders
  alone — not observed in any of the 11 current skills, but the layout
  degrades to just the hub card with no special-casing required.
- A small **legend** below the diagram explains the three glyphs: filled
  circle = content section, filled square = file, outlined square = folder.

### Visual language: adapted from the references, not copied

The reference images used illustrated folder/document icons in a teal
palette and a genealogy-chart box style. Canon's existing identity — the
outline `ToolBadge`s, hairline grid dividers, one deliberate accent color —
is built on restraint, not illustration, so the diagram keeps the
references' *underlying mechanics* (a highlighted hub, branching
connectors, a legend, hover-revealed depth) while reusing Canon's own
geometric glyph vocabulary instead of illustrated icons.

### Implementation

Plain HTML/CSS, no SVG, no client-side JS:
- Every row (`.node`, `.child-row`) is a **flex container** with the
  connector tick, glyph, and label as flex children under
  `align-items: center` — not independently-positioned absolute elements
  with hand-tuned pixel offsets. (An earlier draft used
  `position: absolute; top: 16px` on the connector tick, which visibly
  drifted out of alignment with the glyph/label depending on font metrics.
  The flex approach makes that class of bug structurally impossible: all
  three pieces are centered by the same `align-items` rule, not by three
  separately-guessed numbers.)
- Expand-on-hover is pure CSS: `max-height` (0 → 400px) paired with an
  `opacity` fade, eased with `cubic-bezier(0.4, 0, 0.2, 1)` over ~250–300ms,
  triggered by `:hover` or a `.is-open` class for a pre-expanded demo state.
- Hover feedback on every row: a soft `accent-orange`-tinted background
  wash-in (~180ms), the connector tick darkening from `rule` to
  `rule-strong`, and the glyph scaling up slightly (~1.25×) — all quick,
  subtle transitions, not a single abrupt color swap.
- `@media (prefers-reduced-motion: reduce)` disables every transition
  listed above.
- Real `<a>` tags for every file/folder link (per the earlier-approved
  interactivity decision); content-section nodes are plain text (per the
  Data model section above).

## Page wiring

`skills/[slug].astro` gains a new full-width `<section>` placed **after**
the existing two-column `article`/`aside` grid (not inside the narrow
sidebar column, which doesn't have room for a tree diagram). Section heading
reads "File & content map", styled consistently with the page's existing
`text-xs font-semibold text-ink-soft` label pattern used for sidebar
headings.

## Error handling / edge cases

- **Empty Package branch**: real today, not hypothetical — `emil-design-eng`
  has no files besides its own `SKILL.md`. Handled by omitting the branch
  entirely (see Component section).
- **Empty Contents branch**: `contentOutline` defaults to `[]` for any
  `SKILL.md` with no `##` headings; the branch is omitted, no fabricated
  structure is shown. Not hit by any of the 11 current skills, but the
  schema and component both support it.
- **Deeply nested folders** (folder within a folder): out of scope for this
  pass — none of the 11 current skills have this shape (deepest is one
  level, `references/*.md`). If a future skill needs it, the grouping logic
  would need to recurse; noted as a known limitation, not built speculatively.
- **Script failures** (repo renamed/deleted, rate limit): the script is
  manual and run once per skill addition/refresh, so a failure just means
  re-running it — no build-time fallback needed since it never runs during
  `astro build`.

## Testing

Visual verification in the Browser pane after wiring, against three real
cases that each exercise a different branch combination:
- `frontend-design` — both branches populated but small: 5 flat content
  sections, 1 file (`LICENSE.txt`).
- `nothing-design` — both branches populated and dense: 5 content sections
  (one with 9 subsections), 3 root files, 1 folder with 3 files. Exercises
  hover-to-expand on both a content section and a folder.
- `emil-design-eng` — Contents branch only: 15 content sections (the
  largest, "Component Building Principles", has 7 subsections), no Package
  branch at all (no files besides `SKILL.md`). Confirms the empty-branch
  omission actually degrades cleanly rather than leaving a blank labeled
  section, and that 15 top-level rows doesn't feel unreasonable.

No automated tests beyond the existing `astro check` type-check — this is a
presentational feature over build-time-validated data, consistent with how
the rest of the site's Astro components are (not unit-) tested.
