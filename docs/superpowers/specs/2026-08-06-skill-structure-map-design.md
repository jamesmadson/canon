# Skill Structure Map — Design Spec

Date: 2026-08-06
Status: Approved by user, ready for implementation planning

## Purpose

Each skill on Canon is really a small package of files — usually a
`SKILL.md`, sometimes with a `references/` folder, license, or supporting
docs. Right now that structure is invisible; you have to click through to
GitHub to see what you're actually getting. This feature adds a per-skill
"structure map" to the detail page: a compact diagram of the skill's real
file tree, grouped by folder, linking straight to each file on GitHub.

This was previously explored as a static Artifact mockup and approved by the
user ("better, yes!"). This spec covers wiring the real version, backed by
real file-tree data, into the live site.

## Data model

`skillSchema.ts` gains a new required field:

```ts
const fileTreeEntrySchema = z.object({
  path: z.string(),               // relative to the skill's own folder,
                                    // e.g. "references/tokens.md"
  type: z.enum(['file', 'dir']),
  url: z.string().url(),          // exact GitHub blob/tree URL, branch
                                    // already resolved — component never
                                    // constructs URLs itself
});

// in skillSchema:
fileTree: z.array(fileTreeEntrySchema).min(1),
```

Entries are relative to the skill's own folder (the last path segment of
`sourceUrl`), not the repo root. A skill whose `sourceUrl` is a repo root
(e.g. `nothing-design-skill`) has entries relative to that root.

`fileTree` is required, not optional. All 11 existing skills are backfilled
in the same pass that adds the field, so there's no "some skills have it,
some don't" state to design around. If a future skill entry is added without
running the generation script, the Zod `min(1)` requirement fails the build
loudly — consistent with how every other required field on this schema
already behaves.

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
5. Rewrite that skill's `.mdx` frontmatter in place with the new `fileTree`
   field (existing frontmatter fields and MDX body untouched).

Uses `gh api` (already authenticated in this environment) rather than a raw
`fetch` + personal access token — no new secret to manage for a script that
runs once and isn't part of the deploy pipeline.

This is a manual, editorial-cadence operation — the same rhythm as
`lastVerified` on each skill. Re-run by hand if a skill's upstream repo
restructures.

## Component: `StructureMap.astro`

Props: `fileTree: FileTreeEntry[]`.

Rendering logic:
- Partition entries into **root-level files** (no `/` in `path`) and
  **subdirectories** (grouped by their first path segment).
- Root-level files render first, each as a linked row.
- Each subdirectory renders as a folder row: folder name (linked to its
  `dir` entry's GitHub tree URL) + file count, followed by up to 3 example
  filenames (linked to their blob URLs) drawn from that folder's files, then
  `+N more` as plain text (not a link) if the folder has more than 3 files.
- A skill with no subdirectories (just a `SKILL.md`, e.g. `frontend-design`)
  renders as a single root-level file row — no empty folder section, no
  special-casing needed beyond "the subdirectories group is empty."

Implementation is plain HTML/CSS: a nested list (`<ul>`/`<li>`), indentation
+ `border-left` for connector lines, real `<a>` tags for every link. No SVG,
no client-side JS — matches the site's existing outline/hairline visual
language (`ToolBadge`, the gallery grid dividers) rather than the bespoke
SVG treatment used for the one-off, gallery-wide taxonomy map.

## Page wiring

`skills/[slug].astro` gains a new full-width `<section>` placed **after**
the existing two-column `article`/`aside` grid (not inside the narrow
sidebar column, which doesn't have room for a tree diagram). Section heading
styled consistently with the page's existing `text-xs font-semibold
text-ink-soft` label pattern used for sidebar headings.

## Error handling / edge cases

- **Empty subdirectory listing**: not possible given `min(1)` on the whole
  array combined with the script always emitting at least the skill's own
  files — no rendering branch needed for "no files at all."
- **Deeply nested folders** (folder within a folder): out of scope for this
  pass — none of the 11 current skills have this shape (deepest is one
  level, `references/*.md`). If a future skill needs it, the grouping logic
  would need to recurse; noted as a known limitation, not built speculatively.
- **Script failures** (repo renamed/deleted, rate limit): the script is
  manual and run once per skill addition/refresh, so a failure just means
  re-running it — no build-time fallback needed since it never runs during
  `astro build`.

## Testing

Visual verification in the Browser pane after wiring, against the two real
extremes already confirmed during brainstorming:
- `frontend-design` — 2 root-level files, no subdirectories.
- `nothing-design` — root files (`LICENSE`, `README.md`, `preview.gif`) plus
  a nested `nothing-design/references/` folder with 3 files.

No automated tests beyond the existing `astro check` type-check — this is a
presentational feature over build-time-validated data, consistent with how
the rest of the site's Astro components are (not unit-) tested.
