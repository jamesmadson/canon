# Canon Installable Prototypes (V2, Storybook-shape) — Sunday cut

## Handoff (2026-09-03, paused)

**Done:** `.canon/` (unrecognized prior artifact, config.json + dashboard.html)
moved aside to `.canon-prior/` and gitignored; nothing built on it or deleted.
Checkboxes ticked on `2026-08-14-canon-router.md` — that work is verified
shipped on `main` (DemoBox, demoCases, `/kits`, canon-all.md, OG tags all
present and committed). This doc created; findings logged as they came in.

**Not started yet:** `canon.config.json` schema, the GitHub Actions workflow,
the gallery index page, giscus wiring, the jamesmadson.me validation pass.
None of the Sunday-cut build has begun.

**Next step to resume:** start at Build order item 1 below — draft
`canon.config.json` schema (`{ prototypes: [{ branch, buildCommand,
outputDir }] }`) and the package/template shape. Then item 2, the Actions
workflow cloned from `designskills`' own `deploy.yml`.

**Not touched:** `license-field` worktree — untouched per instruction. The
Deter→Prune rename (manifest, SKILL.md, marketplace.json, deter.mdx, preview
svg, astro.config redirect, DECISIONS.md/PRD prose, regenerated artifacts)
is scoped and ready to do, but explicitly sequenced *after* this build.

**Needs from James, surface early (not blockers yet, but will be):**
1. Flip Settings → Pages → Source → GitHub Actions on the target repo.
2. Enable GitHub Discussions + install the giscus app, for comments to work.

## Framing

The product's aim is removing friction. Tooling used to be per-role
(designer, dev, PM, or Jira/Notion for the team); now everyone produces
vibe designs and code, so the surface has to serve a mixed team, not one
role. Bias every decision toward fewer steps to first working prototype —
if install takes more than a couple minutes or assumes a role's expertise,
that's a bug.

## Scope — the Sunday cut

**Ship:**
- Config-driven install (`canon.config.json`, manually-listed prototype
  branches — no live branch discovery)
- GitHub Action: build N branches, assemble under `/<branch-slug>/`, deploy
  to Pages — cloned from `designskills`' own `deploy.yml`
- Gallery index page on the existing monochrome Astro shell
- Comments via giscus — real, working, zero backend
- Validate the whole loop against `jamesmadson.me` (its FTP deploy.yml
  stays untouched; Canon's Pages workflow is additive and independent)

**Stub, visibly labeled:** a Strata-shaped read view over the giscus
comments (display only, not the intake).

**Defer entirely:** GitHub App/OAuth, Postgres, live branch indexing, Figma
embeds, Survey, Linear, deter/access review runs.

## Build order

1. `canon.config.json` schema + installable package/template shape —
   per-prototype `{ buildCommand, outputDir }`
2. GitHub Actions workflow: checkout each configured branch, run its build,
   assemble under `/<branch-slug>/`, deploy via `actions/deploy-pages`
3. Statically-generated gallery index on the existing monochrome shell
4. Giscus wired in for comments, plus the labeled Strata-shaped read view
5. Validate against `jamesmadson.me`

## Findings

- **2026-08-27** — [Beyond the Handoff](https://content-creation-eosin.vercel.app/)
  — filed on the canon-router plan doc; cross-referenced here as background
  for the same thesis: design/dev friction is a modeling problem, not a
  process one.

- **2026-09 (thread, ~2mo old at capture)** — Reddit comment, u/404_computer_says_no
  (flaired Experienced), r/UXDesign:
  > "I'd build out the more complex patterns as components (address look up
  > component with the different states)
  >
  > Either document in Storybook or build your own internal website"

  Why it matters: independent evidence the choice practitioners see is
  exactly binary — adopt Storybook, or roll your own internal site —
  nothing in between. That gap is the position Canon is aiming at. The pain
  named is specific: complex multi-state patterns (an address lookup) are a
  prototype-with-states case, not a static component-doc case.

- **Same thread, parent post** — u/404_computer_says_no, r/UXDesign,
  ["Anyone else really enjoying this golden era of prototyping?"](https://www.reddit.com/r/UXDesign/comments/1ubzgef/anyone_else_really_enjoying_this_golden_era_of/)
  (~2mo old). Their team fully embraced AI prototyping; customer research
  got dramatically better. Key lines: the old way "now feels like a fake
  PowerPoint presentation"; they get "so much gold from giving the user
  fully functional prototypes"; researchers "feel more empowered to
  observe instead of coaching them through our janky clickable demos."
  Axure-grade prototypes now spin up in a day.

  Why it matters: the demand-side case for Canon — the value isn't the
  gallery UI, it's genuinely functional prototypes in front of customers,
  and the named bottleneck is the gap between janky clickable demos and
  real ones. Same practitioner as the comment above: he's living the
  abundance (day-one functional prototypes) and hitting the wall of where
  to put them (Storybook or roll your own) — production got cheap, the
  surface to host/share/discuss them didn't. That's the thesis in one
  person.

- **Same thread** — u/Lramirez194 (flaired Experienced), plus a reply
  exchange with u/prolly-not1. They describe: Claude Code outputting HTML
  prototypes as the handoff artifact; a UX-controlled design system
  optimized for Claude Code use, with a component map to their real dev
  design system, kept in sync; PRD in, 60–80% of a real solution out,
  strong for early editing and interviews. Named friction: once a solution
  is near-final, small specific tweaks (text, padding) take longer to
  prompt than to do by hand in Figma — accepted as worth the tradeoff.
  Separately, a "Claude Code research repo" modeled on the atomic research
  framework (transcripts → md notes, substance kept, fluff dropped →
  observations → insights, run at the end of an interview wave), built on
  skills plus project files per research effort, extended with participant
  files and company files; a dedicated skill generates recruitment lists
  as a filtered HTML file. They'd rather pull this from Salesforce but
  can't.

  Why it matters:
  1. Strongest validation yet of the kit/component-map thesis — someone
     independently built a Claude-Code-optimized DS mapped to their
     production DS. That's Canon's premise, already in production at a
     real team.
  2. HTML prototype as handoff artifact is exactly what Canon hosts —
     confirms the artifact shape.
  3. Late-stage tweak friction (prompting slower than hand-editing for the
     last 10%) is a concrete product opening: direct manipulation as a
     candidate capability, not Sunday scope.
  4. The research repo is a coherent second product surface, and rhymes
     hard with Strata's Said/Meant/Decided — transcripts to structured,
     queryable evidence. Flagged for later; not acted on now.

- **Same thread** — u/nseckinoral (flaired Experienced), 13h old at
  capture:
  > "I'd say just create a knowledgebase in MD files and hook them up to
  > story book and/or LLMs"

  Why it matters: a third independent voice reaching for Storybook as the
  default answer, this time paired with "a knowledgebase in MD files" as
  the thing that feeds both Storybook and LLMs. Reinforces Strata's own
  shape (dated markdown entries) as the right format for a record meant to
  serve both a human-facing doc site and an agent — not a coincidence
  worth designing around, a pattern worth noticing.

## Later / Ideas (not Sunday scope)

- **Short URL layer for prototype addresses** (bitly-like), from James.
  Feasibility note: on static Pages, the cheap version is build-time
  redirect stubs at stable slugs (`/p/<slug>/` → the branch build) — needs
  no service, survives branch renames. That's probably the 80% win. An
  actual short domain needs an external service, which conflicts with the
  no-backend constraint.
