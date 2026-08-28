# Canon decision log

Every product decision James has made building Canon, with the reasoning
that made it. Two jobs: the working record, and the raw material for a
future skill that encodes *how James decides* so new decisions start
warm. (Candidate name: Cairn — stones stacked to mark the route taken.)

Format: the call, why, what was rejected. Superseded decisions stay —
the change of mind is data, not embarrassment.

---

## How James decides — the observed pattern

Extracted from the decisions below; this section is what the skill will
actually encode.

1. **Field evidence before features.** Ideas arrive as links — threads,
   essays, tools — get filed as entries, and graduate to scope only when
   the evidence bar clears. The annotation layer went signal → entry →
   committed scope in one day *because* the field showed four people
   hand-rolling it.
2. **Honesty outranks polish.** Disabled states over fake submits, "None
   stated" over silence, scripted-preview labels on every mock, counts
   said out loud. When a mechanism could mislead, it is removed rather
   than softened.
3. **Names carry the ethos.** One-word field terms (Graft, Strata,
   Deter), puns that work twice, collisions checked (Survey vs the
   survey source-type), attributions rendered exactly (less, but better —
   not "less is more").
4. **Constrain before critique; remove before add.** The default
   question is "what should go," and additions must survive being the
   single Missing item.
5. **Riskiest assumption first, lean cuts weekly.** Build the layer only
   after last week's layer validated. Ship posture over roadmap posture.
6. **Hold the irreversible.** Public announcements, merges that publish,
   anything employer-adjacent — gated until explicitly cleared, even
   mid-momentum.
7. **References, not copies.** Index and annotate other people's work;
   never store, redistribute, or overwrite it. Applies to repos, skills,
   and feedback alike.
8. **Kill collecting-features.** Anything that serves hoarding over
   working (download-all zips, configurators) dies in review.
9. **Change your mind in the open.** Supersede, don't rewrite. D-22 is
   the standing example.

---

## Decisions

### D-01 · Monochrome, no accent — 2026-08
Only ink/paper tokens; hover and focus are value shifts, never hue.
Orange considered, tried, removed entirely. Why: the gallery's subjects
provide the color; the frame must not compete. Any color is a defect, so
the rule is testable.

### D-02 · Curate, never scrape — 2026-08
Every gallery entry read in full, license-checked, hand-written. Rejected:
auto-imported registries. Why: judgment is the product; a scraped list is
the competitor category, not the aspiration.

### D-03 · DESIGN.md-style entries excluded — 2026-08
awesome-design-md owns that lane. Canon lists skills, not extracted
design docs. Standing scope fence.

### D-04 · Licenses are derived, never hand-typed — 2026-08-24
The `license` field comes from the GitHub API via the fetch script, with
per-folder LICENSE files outranking repo-level. Why: a hand-typed claim
shipped wrong once; a derived one cannot drift.

### D-05 · Unlicensed work is hidden everywhere, not just unlisted — 2026-08-25
`pending-license` removes the page, the listings, and every generated
install command — because a hidden card with a live clone script would be
compliance theater. Reversal is one status field once a license lands.

### D-06 · Notify authors; don't ask permission for criticism — 2026-08-25
Listing and reviewing is protected commentary. Permission is requested
only where genuinely required (CC-NC content, redistributing files).
Rejected: blanket permission emails, which invite vetoes nobody holds.

### D-07 · Launch the argument, not the gallery — 2026-08-25
The waste benchmark is the launchable asset; the gallery is the
credential behind it. Rejected: a "check out my gallery" launch with no
capture and no retention loop.

### D-08 · Canon authors skills under its own name — 2026-08-25
Positioning moved from aggregator to practice-that-publishes. Own skills
are labeled as Canon's, never slipped in as peers.

### D-09 · Skills are static; records grow beside them — 2026-08-27
The Strata architecture, generalized: SKILL.md never mutates; dated
entries accumulate in the project. Rejected: self-editing skills, which
degrade as they accrete.

### D-10 · Said / Meant / Decided stay separate — 2026-08-27
Verbatim, interpretation, and action are different epistemic states.
Collapsing them is how one mention becomes "users are demanding this."
An empty Decided is information — it powers the open report.

### D-11 · Pseudonymize at intake, key stays local — 2026-08-27
P-numbers in everything written; the mapping gitignored before the first
entry exists. Rejected: verbatim-with-warnings (one careless commit is
unrecoverable) and full stripping (loses longitudinal signal).

### D-12 · The evidence bar: three independent, or say the count — 2026-08-27
One is a quote, two is a possible pattern said aloud, three is a
pattern. Same person twice = persistence, not pattern. Stakeholders never
pool with users. Thread replies get an independence caveat.

### D-13 · Reviews remove; additions must be the one Missing item — 2026-08-27
Deter's shape: job, removals priced against it, kept, ≤1 missing,
smallest next step. Rejected: severity emoji, framework tours, and the
unrequested rewrite (the baseline's signature failure).

### D-14 · Tribute names, rendered exactly — 2026-08-27
Deter (né dieter) tips the hat without claiming endorsement; "less, but
better" quoted correctly. Renames get redirects even for URLs live only
hours.

### D-15 · v2 is a workbench of references — 2026-08-27
Canon indexes and annotates prototypes; the work stays in GitHub and
Figma. No code storage. This *is* the security story and the lean story.

### D-16 · Judgment, not plumbing, is the moat — 2026-08-27
Hosting/annotation are commodities (Chromatic, Pastel, Vercel). The moat
is annotations landing in an evidence record with decided-states, and
reviews citing the team's own history.

### D-17 · Personal accounts first; teams are an addition — 2026-08-27
OAuth only (GitHub + Google), first sign-in creates the account, invite
links bridge until team objects exist. Rejected: launching with roles.

### D-18 · Dark mode day one in the app; the site stays light — 2026-08-27
The app is a daily surface and gets both themes; the marketing site is
one committed look.

### D-19 · PWA-first shell; native out of scope — 2026-08-27
Justified now that there's state and a return loop — the same test that
rejected PWA for the static site earlier.

### D-20 · A person triggers every skill run — 2026-08-27
No runs on push, no surprise billing. Stated on the onboarding screen as
a contract, not buried in docs.

### D-21 · Annotation layer: committed scope with the source's caveat — 2026-08-27
One script tag, anchored comments filing as Strata drafts, limits kept
honest (web builds you control; not native, not third-party, not Figma).
First real Decided in the record.

### D-22 · Branch indexing: select what's visible; prefix only on create — 2026-08-28
**Supersedes the `prototype-*` requirement (and softens assumption 1).**
Connecting a repo lists its branches; the person chooses which appear as
prototypes. A prototype *created in Canon* gets the `prototype-` prefix.
Why: teams arrive with conventions; requiring a rename to be indexed is
adoption friction dressed as tidiness. The convention earns its place on
new work, where it costs nothing.

### D-23 · Prototypes read as products: screen previews, device frames — 2026-08-28
Cards carry screen thumbnails; the detail page previews at
user-selected device sizes and orientations. Why: a list of branch names
is legible to engineers only; the product's buyer thinks in screens.
The preview fiction must look like a real product (NatureDose-shaped),
not abstract slugs.

### D-24 · The handoff is a link plus context — 2026-08-27
Prototype page as the artifact, copy-the-context prompt, PR as
graduation, a visible buddy field. Rejected: workflow engines pretending
to replace the engineering-buddy relationship the field says matters.

### D-25 · Research intake grows in rings — 2026-08-27
Paste/upload → links → API import, each ring gated on the previous
proving people confirm drafts instead of rubber-stamping. Imports that
can't be pseudonymized cleanly quarantine.

### D-26 · Don't build: configurator, bundle hosting, download-all — 2026-08
Each inverts the curation moat, adds legal exposure, or serves
collecting over working. Standing.

### D-27 · Clean room from employer work — 2026-08-27
No internal names, imagery, copy, or layouts; fiction invented fresh;
nothing irreversible ships before the independent-release confirmation.
Enforced once against Canon's own skill docs when scenario names leaked
into examples.

### D-28 · App shell: platform-tool class, structure over styling — 2026-08-28
The v2 app reads like GitHub / Supabase / Vercel / Linear: top bar with
wordmark, project breadcrumb, account; left sidebar (Overview,
Prototypes, Research, Members); stat strip; card grids with screen
thumbnails. James's prior screens are the structural reference — generic
SaaS patterns are fair game; names, copy, imagery, and distinctive
compositions stay clean-room (refines D-27). Canon's monochrome system
does the styling.

### D-29 · Decisions live in a log; the log becomes a skill — 2026-08-28
This file. Superseded decisions stay visible; the meta-pattern section up
top is the future skill's source material. Candidate name: Cairn.

### D-30 · Survey answers the zoomed-out gap; captured, never mirrored — 2026-08-28
The field named the unsolved problem — "a canvas of your running app" —
and James took it. Survey is the space map beside Graft's time maps:
screens captured from the running prototype by an agent walk, arranged by
route, zoomable to project level, with annotations and evidence pinned in
place. Core property: generated from the running app so it cannot drift —
the one thing every workaround (Figma mirrors, snapshot walls, storyboard
canvases) lacks. Sequenced post-alpha behind the dashboard and annotation
layer. Also upgrades critique-in-PRs to a confirmed pattern (third
independent voice).

### D-31 · Held: component promotion into the team's system — 2026-08-28
Status: held, not committed — the log's first explicitly-held idea.
Connect Storybook or the design-system repo; a component proven in a
prototype promotes with a click. The click scaffolds a PR against the
team's own repo (component + story + a system-record entry carrying the
why) — never a copy into Canon, per D-15. Gives the contextual-skills
architecture its write path: prototypes graduate as PRs, components
graduate into the system. Sequenced behind the system skill, which sits
behind assumption 3. Note: Storybook's commercial arm is Chromatic —
already mapped as a near-competitor — so this is both a bridge and a
border.

### D-32 · Survey keeps the canvas, kills the entropy — 2026-08-28
The Figma-artboard screenshot is the reference for both halves: spatial
pan/zoom/drag is the beloved interaction and stays; hundreds of unnamed
"Frame 4…" rectangles are the disease and cannot occur. Arrangement has
three modes — by IA (route hierarchy), by journey (flow order), freeform
(hand placement, persisted) — and computed modes are views, never edits:
switching arrangements never destroys a hand layout. Names come from
routes at capture, so auto-layout is free where Figma's is manual labor.

### D-33 · Held: the Linear integration runs both ways — 2026-08-28
Refines the standing Linear adjacency, still post-alpha. Linear → Canon:
issues, comments, and Customer Requests as a Strata intake source, under
full ring discipline — pseudonymized (customers P-, teammates T-),
drafts confirmed by a person, quarantine for anything uncleanable.
Canon → Linear: commands run where the team works — mention or assign
Canon on an issue linked to a prototype and a review runs, filing back
as a comment plus a record entry. A mention is a person triggering, so
D-20 holds naturally. Sequencing unchanged: this enriches what the
integration is, not when it comes.

### D-34 · Every stage commits an artifact the next stage can read — 2026-08-28
Adopted from Anthropic's AI-native SDLC playbook (entry
2026-08-28-ai-native-sdlc-playbook) as an articulated principle — it was
already true implicitly. Canon is the design lane of that cycle: Strata
and this log feed Plan; prototypes are Build artifacts; review runs are
Test; PR graduation is Deploy; staleness is Maintain feeding back to
Plan. Doubles as the alpha-conversation frame, citable to Anthropic's
own literature, and as a description of how Canon itself is built.

### D-35 · The alpha aperture: manage prototypes, facilitate feedback — 2026-08-28
James, asking the right question at the right moment: is the scope too
wide? The answer: the horizon can be wide; the build aperture cannot.
Alpha is two jobs — a prototype manager (index, select, staleness,
device previews) and a feedback facilitator (annotation layer, Strata
record, reports) — plus the single deter run that tests assumption 3.
Survey, promotion, Linear, the contextual skills, and the CLI remain
sequenced or held, unbuilt until the ladder clears them. The positioning
sentence tightens to match: prototypes in one place, feedback that
becomes evidence.
