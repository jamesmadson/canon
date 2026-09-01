# Alpha week — get it into hands

The plan for the week of 2026-09-01. Goal: a small group of real people
running Canon in a real repo by Friday. Supersedes ROADMAP.md for the v2
track (that file is v1-era and stale); the PRD holds the full picture,
this file holds the week.

**The gate, first.** Nothing in this plan leaves the machine before the
independent-release confirmation James expected this Tuesday. Every step
below up to "send" is internal and safe either way. If the answer is no,
the week pivots per the PRD's risk section: skills ship, the platform
waits.

## What testers get

Two things, one link apart:

1. **The package (alpha zero, per D-41 and the PRD's Alpha plan).**
   `npx` into their repo: branch families, staleness, the local dashboard
   in the restyled language, record entries as files, the open report.
   Local only. Nothing phones home.
2. **The vision demo.** The v2 clickable preview, linked from the landing
   page as "where this goes": annotations, handoff, reviews, the full
   record.

The ask of a tester is one sentence: run one command in a repo with
prototypes in it, use it for a week, and tell us where it lied to you.

## The week

**Tuesday — decisions and foundations**
- James: confirm the release gate. Nothing sends without it.
- James: pick the npm name (`usecanon`, `canon-cli`, or claim the
  `@canon-design` org). Ten minutes, gates everything.
- Restyle pass lands (agent finishing); verify gates, screenshots.
- Scope freeze: alpha zero is the four items in the PRD. Anything else
  found mid-build gets written down, not built.

**Wednesday — build the slice**
- CLI scaffold: `init`, branch reading, family derivation from names,
  the D-22 selection step, staleness.
- Local dashboard: family cards, simplest node canvas, thumbnail
  precedence (person-set or placeholder mark).
- `note` flow and the report view, filing to `.strata/` as files.
- Landing page build on the restyled base: the book-cover hero, the
  install script block with the copy button, sideways rail, footer with
  waitlist, the closing strip.

**Thursday — dogfood and harden**
- Run the package on this repo itself; Canon's own branches are the
  test fixture (v2-work, v2-restyle, the worktree branches are a real
  family mess — good).
- Fix what the dogfood finds. Gates: tests, astro check, build, both
  themes, 390px, install-from-tarball on a clean checkout.
- Tester brief updated: one page, the one-sentence ask, what is real
  versus vision, where feedback goes.

**Friday — send**
- Publish the package. Publish the landing page. Both are the first
  pushes since the hold; they happen together, once, after the gate.
- Send to NatureQuant plus 2–4 people from the outreach list. Personal
  notes, not a blast.
- Open the record: every reply files as a Strata entry the same day.

## What is deliberately not this week

The annotation script, capture, adapters, accounts, hosting, the Chrome
extension, Survey, the wireframe theme. Each has its place in the PRD's
sequence; none of them make Friday better.

## Success

By next Monday: the package runs in at least two repos that are not ours,
one person has filed a record entry without being walked through it, and
the first honest complaint is in `.strata/`. Counts stated plainly per
the evidence bar; two voices is not a pattern, and we will not call it
one.
