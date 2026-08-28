# Canon v2 — PRD

**One line:** Canon grows from a skills practice into a workbench — your
team's prototypes from Git and Figma in one place, feedback filed as
evidence, history drawn as maps, and Canon's skills running against all of
it.

Status: draft for alpha. Owner: James. Ship posture: lean MVP, weekly
cuts, first external team (NatureQuant) this cycle, 3–5 more next week.

---

## Why this, why now

Generation is solved; the mess it produces is not. Teams using AI to
prototype now generate faster than they can track: branches nobody can
find, Figma files nobody links, feedback in Slack threads nobody can cite.
Every tool in the audit ships opinions about *making*; nothing manages
what got made.

Canon v1 earned the right to this position — 20 skills read and judged, a
router, two authored skills (Graft, Strata) that already do the two hardest
pieces: mapping history and filing evidence. v2 puts a product surface on
that practice.

**The thesis carried over from v1:** the value is judgment, not plumbing.
Prototype hosting is a table-stakes shell; the skills that run against the
prototypes are the reason to pick Canon.

## Who it is for

Design-led product teams of 2–15 who prototype in code and Figma
simultaneously. First user: NatureQuant. The buyer is the design lead who
currently answers "where's the latest version?" from memory.

## The riskiest assumptions (test these, in order)

1. **Teams will select which branches are prototypes.** Connecting a
   repo lists its branches; the person picks what's visible — no rename
   required to be indexed (D-22, superseding the `prototype-*`
   requirement). Prototypes *created in Canon* get the prefix, where it
   costs nothing. The assumption is now curation-on-connect, not
   convention adoption.
2. **Feedback filed at the prototype beats feedback in Slack** — people
   will actually comment where the work lives.
3. **Skill runs on real prototypes produce findings a lead acts on** —
   the Deter/a11y reviews must change a decision, not decorate a page.
4. People will connect a private repo to a solo-maintained alpha (trust
   threshold — mitigated by read-only scopes and a clean security story).

Each alpha week answers one of these before we build the layer above it.

## Core model

```
Account (personal at alpha; teams are a later layer, not a rename)
 └─ Project
     ├─ Sources        a Git repo (GitHub App, read-only at alpha)
     │                 a Figma file (embed by URL at alpha)
     ├─ Prototypes     every branch matching prototype-* on a source repo
     │                 every attached Figma frame/proto link
     ├─ Feedback       Strata entries attached to a prototype or project
     │                 (pseudonymized, Said/Meant/Decided, evidence bar)
     ├─ Maps           Graft renders: branch history, session history
     └─ Reviews        skill runs against a prototype: deter, access,
                       (code review later)
```

A prototype is a *reference*, not a copy — Canon indexes and annotates; the
work stays in GitHub and Figma. This is what keeps the MVP lean and the
security story honest.

## MVP scope

| In (alpha) | Out (explicitly) |
| --- | --- |
| GitHub App, read-only: list all branches; the person selects which appear as prototypes; last commit, author, staleness. Canon-created prototypes get the `prototype-` prefix | Hosting/deploying prototypes (link to the team's existing preview URLs) |
| Figma attach-by-URL with live embed | Figma API import, component sync |
| Prototype cards carry screen thumbnails; the detail page previews the live URL at user-selected device sizes and orientations (phone, phone landscape, tablet, desktop) | Real-device farms, pixel-diffing |
| Prototype page: description, links, activity, feedback thread | Realtime multiplayer anything |
| Feedback: the annotation layer (below) plus a plain comment box, both filing Strata entries; reports (themes/open) per project | Public commenting, reactions, notifications beyond email |
| Access: GitHub org membership = project access; share links for viewers | Roles/permissions matrix, SSO — alpha rides on GitHub auth |
| Skill runs: `deter` and `access` against a branch's preview URL or Figma frame, results filed to the prototype | Automatic runs on every push; code-review skill (James, later) |
| Sign-up page with interface preview + waitlist | Billing, teams self-serve onboarding |

**Staleness is a feature, not a metric aside:** the dashboard flags
prototypes with no commits in 14 days. Curation includes retiring things —
that is the Canon position expressed in the product.

## The annotation layer

The field signal that graduated to committed scope (entry
`2026-08-27-annotation-layer`, decided same day): a **toggleable layer
above the running prototype** where a comment points at an actual page
element. Teams in the thread are already hand-rolling this per project;
Canon amortizes it.

- **Delivery:** one script tag the team drops into their prototype build —
  analytics-snippet ergonomics. It renders the layer, off by default,
  toggled by keyboard shortcut or the Canon share link's `?annotate=1`.
- **Anchoring:** a comment stores element selector + offset + viewport
  size, and a snapshot of the anchor's text, so it degrades to "near
  here" instead of vanishing when the prototype changes underneath it.
- **Where it lands:** every annotation files as a Strata draft on that
  prototype — the pointer is the evidence's context. Said is the
  comment verbatim; the commenter confirms or is P-numbered by the
  project owner.
- **Honest limits, kept from the source:** web prototypes whose build you
  control. Not native apps, not third-party sites (a browser extension is
  the later answer), and not Figma — Figma's own comments already do this
  there, and rebuilding them would be decoration.

This is the concrete answer to the thread's strongest pattern: the shared
review surface, restored **on** the live work instead of on a screenshot
of it.

## Developers, and what handoff becomes

Two independent voices now say the same thing (entries
`2026-08-27-discussion-moves-to-prs`, `2026-05-21-when-designers-start-
building`): when designers build, handoff stops being a moment and
becomes co-ownership of one artifact — and the enabling condition is
social, a named engineering buddy, not a tool. v2 makes that legible
instead of pretending to replace it:

- **The prototype page is the handoff artifact.** Preview link, branch,
  the feedback thread, and review runs in one place — the thing a
  designer sends an engineer is a link, not a package.
- **Copy the context.** One button on a prototype assembles a paste-ready
  prompt: what this prototype is, the relevant record excerpts (decisions,
  open feedback), and the branch — so an engineer's or designer's agent
  starts warm instead of cold. Copying a prompt is the CLI-less handoff.
- **Graduation is a PR.** "Open a PR from this prototype" is the exit
  ramp (post-alpha; alpha links to the branch's compare view). The
  dashboard's staleness flag is the other exit — retired is a valid end.
- **A buddy field, not a role system.** A prototype can name its
  engineering buddy — a person, displayed plainly. No approvals, no
  workflow engine; just making the relationship the field study says
  matters visible.

## Survey — the zoomed-out view

The field named the gap in one sentence: *"Nobody's built a good 'canvas
of your running app' yet."* Preview links answer "try this flow" and
nothing answers "step back and see everything" — which is exactly why the
demoted Figma file survives, kept alive for flows and key states. Four
voices now circle this (snapshot walls, a storyboard canvas, a deleted
UI-map tool, and the entry above); James has taken it as a problem to
solve. **Survey** is the answer: Graft draws the time maps, Survey draws
the space maps.

The one property every workaround lacks, and Survey's core commitment:
**the canvas is captured from the running prototype, so it cannot
drift.** A Figma mirror decays the day it's drawn; a generated map is
re-capturable on demand.

- **Capture:** an agent walks the prototype's routes and key states and
  snapshots each screen — the field's own `/prototype-exploder` pattern,
  productized. Human-triggered like every run; re-run replaces the layer.
- **Layout:** screens arranged by route into a zoomable map — flows as
  paths, key states stacked under their screen. Project level zooms out
  to every prototype's map side by side.
- **Alive, not decorative:** annotation-layer comments pin to the canvas
  where they were made; Strata entries about a screen surface on it;
  a branch's map can sit beside main's to show what changed, spatially.
- **Arrangement (D-32):** keep Figma's spatial freedom — pan, zoom, drag
  screens by hand — and add what a free canvas can never have: computed
  arrangements that cost nothing, because capture already knows the
  structure. Three modes: **by IA** (route hierarchy), **by journey**
  (flow order), **freeform** (hand placement, persisted). Switching to a
  computed mode never destroys a freeform layout — it is a view, not an
  edit. And no screen is ever "Frame 604252871": names come from routes
  at capture, which is the whole difference between a canvas and a junk
  drawer.
- **Rings:** (1) agent-assisted capture via the CLI/skill and a manual
  arrange; (2) capture on demand from the app with route detection;
  (3) flow-graph edges and state variants. Ring 1 is post-alpha unless
  NatureQuant's week screams otherwise — the dashboard and annotation
  layer stay first.

## Contextual skills — the v2 architecture

Strata accidentally defined the pattern every v2 skill follows: **the skill
is a static method; the project record grows beside it.** The skill never
mutates; the layers accumulate; reports read the layers. Users "teach" a
skill their context through the prototypes they connect, not by editing
prompts.

Generalized:

| Skill | Its record holds |
| --- | --- |
| `strata` | what users said, dated, pseudonymized |
| `system` (design system) | tokens, components, and the *reasons* — why spacing-6 is card padding, why the tertiary button died |
| `interface` | the project's own interaction conventions, learned from its prototypes |
| `ux` | flows, decision forks taken, patterns rejected and why |
| `copy` | voice rules, banned words, approved strings with their contexts |
| `cairn` (candidate) | product decisions with their reasoning — the trail markers; sourced from `docs/DECISIONS.md`'s meta-pattern |

Each follows the Strata disciplines: append-only layers, verbatim kept
apart from interpretation, an evidence bar before anything is called a
rule, and identity hygiene. A reviewed prototype checks against *this
team's* accumulated record — "you used spacing-4 here but this system's
cards use spacing-6, decided 2026-03-12" — which is the thing no generic
skill can say.

Alpha ships `strata` + `deter` + `access`; `system` is next once
assumption 3 proves review runs get acted on. `interface`, `ux`, and
`copy` follow the same mold and are cheap once the mold is proven.

### Promotion — prototypes feed the system (held, not committed)

Held idea (D-31): connect a project's Storybook / design-system repo, and
a component proven in a prototype can be **promoted into the system with
a click**. The click's honest shape, consistent with D-15's no-storage
rule: it scaffolds a **PR against the team's own system repo** — the
extracted component, a story file, and a `system` record entry carrying
the why (promoted from which prototype, on what evidence). Canon never
hosts the component; the engineering buddy finishes the PR.

This gives the contextual-skills architecture its missing write path:
prototypes graduate as PRs, components graduate into the system — and
the `system` record becomes the design system's changelog of reasons.
Rings when taken up: (1) link Storybook, reference components; (2) the
promote-scaffold; (3) drift flags — a prototype using a variant the
system doesn't have. Held behind `system` itself, which is held behind
assumption 3.

## The skills lineup at launch

| Skill | State | Job in v2 |
| --- | --- | --- |
| `canon` router + 3 kits | shipped | build-time judgment in the agent |
| `graft` | shipped | maps: session history now, branch graph in v2 |
| `strata` | shipped | the feedback system — the product's comment box *is* a Strata intake |
| `deter` | to build | constraint review: less, but better — flags what to remove, not add |
| `access` | to build | accessibility pass on a prototype: contrast, targets, keyboard path |
| code review | later (James) | correctness/hygiene pass on prototype branches |

Naming note for `deter`: "Less is more" is Mies van der Rohe; Rams'
phrase is **"Less, but better"** (*Weniger, aber besser*). The skill uses
the ethos as v1 decided — principles underneath, applied as concrete
constraints — and avoids claiming the man's endorsement. `deter` is a
tribute name; the description says so.

## Architecture (lean, scales)

- **Marketing + gallery stay exactly as they are** — static Astro on
  Pages. v2 does not destabilize v1.
- **App** at its own subdomain: server-rendered app (Astro SSR or Next on
  Vercel), Postgres (Neon), GitHub OAuth for sign-in, GitHub App
  (read-only) for repo data, Figma via public embed at alpha.
- **Skill runs** execute as agent jobs producing a filed report — human-
  triggered at alpha (a "Run review" button that queues a job), never a
  surprise bill.
- **Strata storage:** entries live in the project's own repo under
  `.strata/` when the team allows a write scope, else in Canon's DB with
  export. Repo-native is the default position: the team owns its record.

Scale path: nothing above requires re-architecture to add orgs, roles,
webhook-driven updates, or paid plans. What it deliberately defers is
anything requiring us to *store user code*.

## Sign-up page

`/alpha` on the existing site. One screen: the argument in a sentence, an
**interface preview**, a waitlist form, and "built by the practice behind
the Canon gallery" as the credential.

- The preview is a **new, Canon-branded mock** in the monochrome system —
  three panes: prototypes with staleness flags, a feedback thread in
  Said/Meant/Decided form, a review result. Built as crafted HTML/SVG, not
  screenshots.
- **Hard rule:** no imagery, names, copy, or layouts from any internal
  employer tool. v2 is a clean-room build from public Canon work. (Also
  pending James's confirmation this week that an independent release is
  cleared — nothing irreversible ships before that.)
- Waitlist capture is still blocked on a Formspree/Buttondown account —
  the one Phase-0 blocker this PRD inherits from the GTM plan.

## Accounts and surfaces

- **Sign in:** OAuth only — GitHub and Google, no passwords to store.
  Sign-up and sign-in are one screen; the first sign-in creates the
  account. Personal accounts at alpha; a team is a later *addition*
  (shared projects via invite link bridge the gap until then).
- **Dark mode from day one in the app.** The OKLCH token set inverts
  cleanly; ship system-preference default plus a toggle. The marketing
  site stays light — one committed look — while the app, a daily surface,
  gets both.
- **PWA-first app shell.** Manifest + service worker from the start:
  installable, offline read of last-viewed prototypes and feedback.
  Justified now in a way it wasn't for the static site — the app has
  state, sessions, and a return loop. Native apps stay out of scope.
- **The CLI** — `npx canon` (or `npm i -g canon`): the same model,
  text-only, for people who live where the prototypes live. `canon ls`
  (prototypes + staleness), `canon feedback` (a Strata intake at the
  terminal), `canon report themes|open`, `canon review deter`. No
  previews — the terminal gets tables and verbatims, not screenshots.
  It greets with the wordmark and then stays quiet:

```
 ██████  █████  ███   ██  ██████  ███   ██
██      ██   ██ ████  ██ ██    ██ ████  ██
██      ███████ ██ ██ ██ ██    ██ ██ ██ ██
██      ██   ██ ██  ████ ██    ██ ██  ████
 ██████ ██   ██ ██   ███  ██████  ██   ███
        the record of the work
```

## Research

A project-level **Research page** cataloguing every finding — the Strata
record with a face. Filterable by source type, participant, tag, and
date; every card traceable to its entry; the themes/open reports rendered
live at the top with their citations.

Intake grows in rings:

1. **Alpha:** paste text, upload `.md` and screenshots — Strata parses
   into Said/Meant/Decided drafts the person confirms before filing.
   Parsing proposes; a human files.
2. **Next:** Figma and Miro **links** attach to entries as references
   (embed where the platform allows).
3. **Later:** true Miro/Figma import — pull sticky notes and frames via
   their APIs and parse each into a draft entry. Gated on ring 1 proving
   people actually confirm drafts rather than rubber-stamping them.

The evidence bar and pseudonymization apply at every ring — imports get
the same discipline as hand-filed entries, and an import that can't be
pseudonymized cleanly lands in a quarantine list, not the record.

## Field signals — 2026-08-27 thread (filed in `.strata/`)

A 13-reply r/UXDesign thread on designing in code, filed as entries.
Counts are stated per the evidence bar; all one thread, so independence
is partial — replies could see each other:

- **Coded prototypes lose the shared review surface** — 4 participants
  (P-03, P-04, P-11, P-12): snapshot walls in Mural, discussion displaced
  into PRs and Looms, a hand-rolled annotation layer, and an essay naming
  the trade ("you gain fidelity and lose visibility, context, and
  collaboration"). Directly validates assumption 2 and the prototype
  page.
- **Screens get piped back into boards as a workaround** — 4 participants
  (P-03, P-05, P-09, P-10), including reviews run for legal and copy
  teams. Review surfaces must serve people who never open the repo.
- **Figma demoted to whiteboard, not deliverable** — 4 participants
  (P-02, P-04, P-06, P-07), one team already running its own "mocks
  site" — the dashboard, hand-built.
- Single signals, not patterns: staging-and-overwrites chaos with no
  branch discipline (P-01), "working in code means production code, not
  a prototype tier" (P-08), and an open question on where content
  designers fit (P-13) — the last one bears on the `copy` skill and is
  worth a follow-up.

## Alpha plan

- **Week 1 — NatureQuant.** Hand-onboarded. One project, one repo, Figma
  links, feedback filed through the product. Success: ten real feedback
  entries and one review run that changes a decision.
- **Week 2 — 3–5 teams** from author/tester outreach. Success: one team
  reaches the same bar without hand-holding.
- **Dogfood clause:** every piece of alpha feedback about Canon is filed
  with Strata in this repo — the product's own record is the demo.

## Metrics (alpha)

Prototypes indexed per project · feedback entries per week · % of
feedback with a later `Decided` · review runs acted on · weekly returning
users per team. Vanity counts (signups, stars) tracked but never steering.

## Risks

- **Scope: this is a platform ask on a solo maintainer.** Mitigation is
  the assumption ladder above — each week ships only the layer the last
  week validated.
- **Employer overlap.** Same product category as internal work. Mitigated
  by clean-room rule, public-repo provenance, and the pending
  confirmation; if that answer is no, v2 pivots to skills-only (deter +
  access still ship — they carry value without the platform).
- **Repo trust.** Read-only scopes, no code storage, security page from
  day one.
- **Figma expectations.** Embeds look like integration; users will ask
  for sync. The PRD's answer: not until assumption 2 is proven.

## Where it sits — adjacencies

Canon v2 lives in the seam between the issue tracker ("what should we
build and why") and the repo ("the code"): the prototypes, the evidence,
the reviews. Read the neighbors accordingly:

- **Linear** — worldview-aligned, complementary; their Customer Requests
  is Strata's cousin inside an issue tracker. A Linear integration
  (prototype ↔ project, feedback ↔ Customer Request) is the first
  post-alpha integration candidate.
- **Figma** — fighting for design-in-code centripetally (Make, Dev Mode);
  will build its version *inside* the canvas, which is the version the
  field entries show people leaving. Coexist via embed; never depend.
- **Frame.io** — the best *analogy*, offered unprompted by the field
  (entry `2026-08-28-frameio-comparison`): comments anchored to the
  artifact, share links for people without the authoring tool. Use it as
  the door-opener — "Frame.io for coded prototypes" — then correct on the
  second sentence: Canon references live branches instead of hosting
  uploaded versions, and feedback becomes an evidence record with
  decided-states instead of an approve/reject queue. Also the
  willingness-to-pay reference: review tooling in this shape sold to
  Adobe for $1.275B.
- **Chromatic / Pastel / Markup.io / BugHerd / Vercel previews** — the
  honest near-competitors. Annotation-on-a-URL is a commodity; the moat
  is annotations landing in an evidence record with a decided-state, and
  reviews run against the team's own accumulated context.

Assumption, stated as one: this reads adjacency from public surfaces;
any of them may be building the seam quietly. The response is the same
either way — ship the record, which is the part that compounds.

## Out of scope for v2 entirely

Skill configurator, hosting arbitrary bundles, PWA packaging, benchmark
publishing (stays on the GTM track), MCP server (revisit after alpha).

## Build order

1. `/alpha` page + waitlist (needs the form account) + preview mock
2. App shell: auth, project, GitHub App branch index, staleness
3. Prototype page + Figma embed + Strata-backed feedback
4. `deter` + `access` skills (TDD, baseline-first, like Strata)
5. Review runs UI
6. NatureQuant onboarding, then widen
