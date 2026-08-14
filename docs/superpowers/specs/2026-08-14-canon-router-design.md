# Canon Router + Homepage Demo — Design Spec

Date: 2026-08-14
Status: Approved by user (decisions captured inline), ready for
implementation planning

## Purpose

Two things that turn out to be one thing.

**The router.** Canon curates sixteen skills and composes them into four
kits, but using them still means knowing which kit fits and installing it
per project. A router skill — `canon` — becomes the single thing you
install once and call deliberately; it reads the task and pulls in the
right kit's guidance. Install once, invoke on purpose, works across
Claude Code, Figma, and anything that accepts a skill file.

**The homepage demo.** Canon's own Marketing/Landing Site kit was run
against Canon's live homepage (report: `.claude/marketing-kit-audit.md`).
Its highest-impact finding: *"the homepage lists inventory; it doesn't
make an argument."* Its second: *"no CTA anywhere — including on the page
selling the kit that mandates CTAs."* A scripted demo of the router in
use answers both — it shows what Canon does rather than listing what
Canon has.

These ship together because the demo's entire subject is the router.

Also folded in: the audit's P1 defect (no Open Graph tags).

## Decisions already made

- Router is named **`canon`** and routes to **three** kits:
  `marketing-site`, `product-ui`, `mobile-first-review`. Full Redesign
  stays a site-only bundle — routing to it would mean routing to
  everything, which is not a route.
- The homepage demo is **scripted**, not live. Canon is a static site
  with no backend; a box that appears to call an LLM but doesn't would be
  a lie, and one that does would need infrastructure this feature
  doesn't justify.
- Figma gets **`canon-all`** — one self-contained file inlining the
  router table plus all three kits (Option B). Figma custom skills are
  single-file only, so a router whose siblings can't be installed would
  present a menu with nothing behind it.

## Architecture: one source, four artifacts

The kit digests (`public/kits/<slug>-digest.md`) already carry
spec-valid Agent Skills frontmatter as of commit `895eb6c` — `name:
canon-<slug>`, a description, compatibility. **They are already valid
`SKILL.md` files.** Everything below is generated from them; no kit
guidance is authored twice.

| Artifact | Built from | Surface |
| --- | --- | --- |
| `plugin/canon/skills/canon-<slug>/SKILL.md` ×3 | digest, copied verbatim | Claude Code plugin |
| `plugin/canon/skills/canon/SKILL.md` | hand-authored router | Claude Code plugin |
| `public/kits/canon-all.md` | router + all three digests, inlined | Figma, one upload |
| `public/kits/<slug>-digest.md` ×4 | authored (unchanged) | Claude Design, Figma single-kit |

A test asserts each plugin skill byte-matches its digest, so the two can
never drift.

## The router skill

`plugin/canon/skills/canon/SKILL.md` — the only new prose in this
feature.

**Frontmatter**: `name: canon`; a description that names the three
routes and their trigger language; `compatibility` noting it expects its
sibling kit skills alongside it.

**Non-triggering is explicit.** Claude Code auto-activates skills on
description match. The router must stay dormant until called, so the
description carries an explicit clause modeled on the `nothing-design`
skill already in Canon's gallery ("NEVER trigger automatically…"): the
router activates only when the user names Canon, names a kit, or asks
which design skills apply.

**Body**: a routing table mapping task language to kit, then one section
per route naming that kit's constituent skills.

| Task language | Route |
| --- | --- |
| landing page, marketing site, hero, launch page, persuasion, "one scroll" | `canon-marketing-site` |
| dashboard, admin, data table, product UI, internal tool, data-heavy | `canon-product-ui` |
| mobile audit, review my app, thumb zones, PWA, "is this good on mobile" | `canon-mobile-first-review` |
| ambiguous | Ask which of the three, listing them in one line each. Never guess. |

**Graceful degradation.** Each route names its constituent skills (e.g.
`frontend-design`, `web-design-guidelines`) and says: defer to them when
installed; otherwise apply the kit guidance inlined in the sibling
digest. This matters because the router works whether or not the user
ran a kit's install script.

## `canon-all` — the Figma artifact

Generated file at `public/kits/canon-all.md`, built by a script from the
router body plus the three kit digests' bodies (frontmatter stripped
from each, replaced by one set at the top with `name: canon-all`).

Structure: router routing table first, then the three kits as `##`
sections in the order marketing-site, product-ui, mobile-first-review.

**Size constraint**: the Agent Skills spec recommends `SKILL.md` stay
under 500 lines. The three digests total roughly 360 lines plus the
router's table; the generator must emit a line count and the build
should surface it. If it exceeds 500, the fix is trimming the inlined
digests' overlapping accessibility/motion sections (they repeat across
kits) — not splitting the file, which Figma cannot consume.

Because it is generated, `canon-all` is verified by the same
byte-matching discipline: a test asserts each inlined section matches its
source digest's body.

## Plugin packaging

- `.claude-plugin/marketplace.json` at repo root — makes Canon an
  installable Claude Code marketplace. Fields per the observed schema:
  `name`, `description`, `owner`, and a `plugins` array with `name`,
  `description`, `author`, `category`, `source`.
- `plugin/canon/.claude-plugin/plugin.json` — the plugin manifest.
- `plugin/canon/skills/` — the router plus three generated kit skills.

Category assignment is what gives the plugin the same IA as the site:
the marketplace entry is categorized `design`, and each kit skill's
description names its category in Canon's own taxonomy so the mapping is
legible in both places.

## Site IA

`/kits` currently lists four peer kits. It gains a hierarchy:

- **Lead section — "Start here: the Canon router"** above the kit grid.
  Explains install-once/invoke-deliberately, links to install
  instructions, and offers `canon-all` for Figma.
- The three routed kits below, unchanged, now legible as the router's
  routes.
- Full Redesign presented separately as the everything-bundle, so the
  hierarchy reads honestly rather than implying it's a fourth route.

No new nav item — the router is `/kits`' lead, not a sibling page. Nav
stays Kits, Gallery, Submit, Newsletter.

## The homepage demo box

Placed **directly under the hero**, above the Kits strip — the audit's
finding is that the argument must land before the inventory.

**Component**: `src/components/DemoBox.astro`, a small vanilla-TS island
following `FilterBar.astro`'s pattern (no framework, progressive
enhancement).

**Structure**:

- A short framing line above it — the page's one-sentence argument,
  which the hero currently lacks.
- Three buttons, one per use case: *Marketing site*, *Product UI*,
  *Mobile review*. First is selected by default so the box is never
  empty on load.
- A panel showing the selected case's scripted exchange in three parts:
  1. **The prompt** — what you'd type, in mono, styled as input.
  2. **What Canon pulls in** — the route taken and the constituent
     skills named, as hairline-separated rows.
  3. **What comes back** — a short excerpt (3–5 lines) of actual
     guidance, chosen to show *judgment* rather than generic advice.

**The content is the point.** Each excerpt must demonstrate something an
aggregator's one-line description cannot: the frequency gate deciding
against animation, the two-pass split keeping opinions out of the defect
list, tabular numbers and concentric radii as named craft. Excerpts are
drawn verbatim from the digests so they are true, not marketing prose.

**Honesty requirement**: the panel must be visibly a *scripted example*,
never a live console. It carries a plain label saying so. No fake typing
animation, no spinner, no simulated latency — those would misrepresent a
static page as a working product.

**Data**: the three cases live in `src/data/demoCases.ts` as a typed
array (`id`, `label`, `prompt`, `route`, `skills[]`, `excerpt`), so the
component renders from data and a test can assert every referenced kit
and skill slug resolves against the real collections.

**Accessibility**: buttons are real `<button>` elements in a
`role="tablist"`/`role="tabpanel"` relationship with `aria-selected` and
arrow-key navigation per the APG tabs pattern; ≥44px targets; monochrome
only, selection shown by value shift and a rule, never hue; the panel is
readable with JS disabled (first case rendered server-side).

## Open Graph tags

`BaseLayout.astro` gains `og:title`, `og:description`, `og:url`,
`og:type`, `og:image`, and `twitter:card` (`summary_large_image`),
reusing existing `title`/`description` props and the configured `site` +
`base`. A static 1200×630 monochrome share image is added at
`public/og.png` — wordmark and the one-line argument, in Canon's own
type system.

## Testing

- Plugin skills byte-match their source digests (per kit).
- `canon-all`'s inlined sections byte-match their source digest bodies;
  its frontmatter is spec-valid; its line count is asserted under 500.
- Router body references only kits that exist in the `kits` collection.
- `demoCases.ts` — every `route` resolves to a real kit slug, every
  `skills[]` entry resolves to a real skill slug, exactly three cases.
- `marketplace.json` and `plugin.json` parse and carry required fields.
- Existing suites stay green; `astro check` 0 errors; build succeeds.
- Controller visual pass: homepage demo box at desktop and 390px,
  keyboard tab-through of the tablist, and `/kits` hierarchy.
