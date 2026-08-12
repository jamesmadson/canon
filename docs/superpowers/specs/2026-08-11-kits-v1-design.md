# Kits v1 — Design Spec

Date: 2026-08-11
Status: Approved by user (design presented in conversation; user said
"proceed on a new branch, I'll check work later"), ready for
implementation planning

## Purpose

Canon's first product step beyond browsing: **kits** — hand-curated,
phased bundles of skills for a concrete job, each shipping two proven
artifacts: a generated install script (installs every skill into a
project's `.claude/skills/`) and a hand-authored digest (one attachable
file carrying the kit's judgment into surfaces that can't run skills,
e.g. Claude Design). Both artifacts were prototyped manually for the
NatureQuant redesign and verified working; this feature productizes
them.

Four kits at launch (user-selected): **Full Redesign**,
**Marketing / Landing Site**, **Product UI / Dashboard**,
**Mobile-First Review**.

Out of scope for v1 (recorded, deliberately deferred): build-your-own
picker, agent-plugins.org plugin bundles, describe-your-project
AI recommendations, accounts.

## Content model

New content collection `kits` (`src/content/kits/*.mdx`), schema in
`src/content/kitSchema.ts` (plain `zod` import, matching
`skillSchema.ts`'s testable pattern):

```ts
export const kitEntrySchema = z.object({
  skill: z.string(),          // slug of a skills-collection entry
  why: z.string(),            // one line: why this skill, in this kit
});

export const kitPhaseSchema = z.object({
  title: z.string(),          // e.g. "Brand foundation"
  entries: z.array(kitEntrySchema).min(1),
});

export const kitSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  phases: z.array(kitPhaseSchema).min(1),
  digestPath: z.string(),     // public path, e.g. "/kits/full-redesign-digest.md"
  addedDate: z.coerce.date(),
  status: z.enum(['active', 'archived']),
});
```

`src/content/config.ts` registers the collection alongside `skills`.

**Referential integrity is test-enforced, not schema-enforced**: a
corpus test (`tests/content/kitsCorpus.test.ts`) asserts every
`entries[].skill` slug resolves to a real file in
`src/content/skills/`, every `digestPath` resolves to a real file under
`public/`, and kit slugs are unique. A renamed skill breaks the build,
not the kit page.

**Skill schema addition**: `skillSchema` gains
`companionPaths: z.array(z.string()).default([])` — repo-relative paths
of sibling folders that must install alongside the skill.
Backfill: `thumb-first.mdx` gets
`['skills/thumb-first-design', 'skills/thumb-first-platform']`
(the umbrella hard-requires both siblings). All other skills keep the
default `[]`.

## Install-script generation

Pure function `src/lib/buildInstallScript.ts`:

```ts
buildInstallScript(kit: {
  slug: string; name: string;
  skills: Array<{
    slug: string;
    sourceUrl: string;          // parsed with existing parseSourceUrl
    hubPath: string;            // fileTree entry whose basename is SKILL.md
    companionPaths: string[];
  }>;
}): string
```

It emits the field-tested script shape (clone-once-per-repo via a
`clone()` helper that logs to **stderr** — the stdout-corruption bug
found and fixed during the NatureQuant prototype — `install_skill`
lines, a FAILURES counter, `set -uo pipefail`, next-steps footer).

**Install-folder derivation** (the subtle part, learned from real
repos): the folder to copy is the directory containing the skill's
`SKILL.md`, computed as `join(parseSourceUrl(sourceUrl).path,
dirname(hubPath))`:

- Subtree skill (`frontend-design`): path `skills/frontend-design`,
  hub `SKILL.md` → install `skills/frontend-design`.
- Root-form with nested hub (`nothing-design`): path ``, hub
  `nothing-design/SKILL.md` → install `nothing-design`.
- Root-form with root hub (`huashu-design`): path ``, hub `SKILL.md`
  → install path is the **repo root**: the generated line passes `.`
  and an explicit dest name (the skill slug), and the script's
  `install_skill` accepts an optional third dest-name argument for
  exactly this case (copying the clone minus `.git`).
- Companions: one extra `install_skill` line per `companionPaths`
  entry, same repo.
- Repos are cloned once regardless of how many skills they contribute.

The generated script must be byte-deterministic for a given kit (no
timestamps), so builds are reproducible and the endpoint can be
snapshot-tested.

**Endpoint**: `src/pages/kits/[slug]/install.sh.ts` — a static Astro
endpoint (`getStaticPaths` over active kits) returning the script with
`Content-Type: text/x-shellscript`. Ships as a real file at
`/kits/<slug>/install.sh`.

## Digests

Hand-authored, one per kit, at `public/kits/<slug>-digest.md` —
editorial artifacts in the NatureQuant digest's structure (provenance
header; numbered sections for brand discipline, craft floor, motion
rules incl. the frequency gate, copy rules, accessibility floor,
mobile discipline, pre-ship gates — scaled to each kit's scope; the
Mobile-First Review digest is audit-oriented rather than build-
oriented). Authored by the curator (controller) directly, as all
Canon editorial content has been; validated by the corpus test's
existence check and proofread in the final review.

## Pages

- **`/kits` index**: heading matching `/skills`' quiet style, then the
  four kits as hairline tiles (`gap-px bg-rule` grid, `KitCard.astro`:
  name ink, tagline ink-soft, "N phases · M skills" meta line in
  ink-soft, whole tile a single `<a>` like SkillCard).
- **`/kits/[slug]`**: monochrome type hero (same scale/treatment as the
  skill detail hero — chip says "Kit"), tagline, editorial body
  (prose), then per-phase tables: phase title as the page's existing
  h2 label style; each row = skill name linking to `/skills/<slug>/` +
  the `why` line in ink-soft. Then an **Artifacts** section: two
  bordered download links (Install script → `/kits/<slug>/install.sh`,
  Digest → `digestPath`) each with a one-line mono usage hint
  (`bash install.sh` from the project root; attach the digest in
  Claude Design). All monochrome; hover/focus follow the sitewide
  value-shift rules (no color).
- **Nav**: "Kits" added to the header nav (before Gallery), same link
  treatment (ink-soft, hover:text-ink, focus-visible, 44px targets).
- **Homepage**: a "Kits" section above "This month's picks" — the four
  kit tiles in the same hairline grid, section eyebrow matching the
  existing ones.

## The four kits (content outline)

Exact `why` lines and essays are authored at implementation; the
skill lineup per kit is fixed here:

- **full-redesign** — Brand foundation: brand-guidelines,
  frontend-design · Build: web-design-guidelines,
  make-interfaces-feel-better, emil-design-eng · Motion:
  design-motion-principles, scroll-scrubbed-visual-sequence ·
  Pre-ship: better-accessibility, better-writing, improve-animations,
  thumb-first.
- **marketing-site** — Brand foundation: brand-guidelines,
  frontend-design · Build: web-design-guidelines,
  make-interfaces-feel-better · Motion & storytelling:
  design-motion-principles, scroll-scrubbed-visual-sequence ·
  Signature moments (optional flourishes): falling-leaves,
  threejs-landscape · Pre-ship: better-writing, better-accessibility.
- **product-ui** — Build: frontend-design, web-design-guidelines,
  make-interfaces-feel-better, emil-design-eng · Motion (restrained):
  design-motion-principles, improve-animations · If React:
  react-view-transitions · Pre-ship: better-accessibility,
  better-writing, thumb-first.
- **mobile-first-review** — Audit team: thumb-first ·
  Foundations it audits against: web-design-guidelines,
  better-accessibility, better-writing · Motion pass:
  improve-animations.

(11 of Canon's 16 skills appear in kits; huashu-design,
nothing-design, brand-guidelines-absent-from-none — the aesthetic-
recipe and prototype-generator entries stay gallery-only, which is
correct: kits are jobs, not inventories.)

## Testing

- `tests/lib/buildInstallScript.test.ts` — pure-function tests
  covering: subtree skill, root-form/nested-hub, root-form/root-hub
  (dest-name case), companions expansion, one-clone-per-repo dedup,
  stderr logging preserved in template, determinism (two calls equal).
- `tests/content/kitsCorpus.test.ts` — schema validity per kit file,
  slug resolution against real skills, digest existence, unique slugs.
- Existing suites must stay green; `npx astro check` 0 errors;
  `npm run build` succeeds and emits `/kits/<slug>/install.sh` files
  (build output checked for their presence).
- Visual pass (controller, Browser pane): /kits and one kit detail at
  desktop and 375px mobile — tile grid, phase tables, artifact links,
  nav addition; homepage strip; tap targets ≥44px on new interactive
  elements; a downloaded install.sh from the build output actually
  runs in a temp dir (end-to-end smoke, same as the NatureQuant
  script test).
