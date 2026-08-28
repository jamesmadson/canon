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

1. **Teams will name branches `prototype-*`** (or map an existing
   convention) to get their work indexed. If they won't adopt the
   convention, nothing downstream matters.
2. **Feedback filed at the prototype beats feedback in Slack** — people
   will actually comment where the work lives.
3. **Skill runs on real prototypes produce findings a lead acts on** —
   the Dieter/a11y reviews must change a decision, not decorate a page.
4. People will connect a private repo to a solo-maintained alpha (trust
   threshold — mitigated by read-only scopes and a clean security story).

Each alpha week answers one of these before we build the layer above it.

## Core model

```
Team
 └─ Project
     ├─ Sources        a Git repo (GitHub App, read-only at alpha)
     │                 a Figma file (embed by URL at alpha)
     ├─ Prototypes     every branch matching prototype-* on a source repo
     │                 every attached Figma frame/proto link
     ├─ Feedback       Strata entries attached to a prototype or project
     │                 (pseudonymized, Said/Meant/Decided, evidence bar)
     ├─ Maps           Graft renders: branch history, session history
     └─ Reviews        skill runs against a prototype: dieter, access,
                       (code review later)
```

A prototype is a *reference*, not a copy — Canon indexes and annotates; the
work stays in GitHub and Figma. This is what keeps the MVP lean and the
security story honest.

## MVP scope

| In (alpha) | Out (explicitly) |
| --- | --- |
| GitHub App, read-only: list branches matching `prototype-*`, last commit, author, staleness | Hosting/deploying prototypes (link to the team's existing preview URLs) |
| Figma attach-by-URL with live embed | Figma API import, component sync |
| Prototype page: description, links, activity, feedback thread | Realtime multiplayer anything |
| Feedback: comment box that files a Strata entry; reports (themes/open) per project | Public commenting, reactions, notifications beyond email |
| Access: GitHub org membership = project access; share links for viewers | Roles/permissions matrix, SSO — alpha rides on GitHub auth |
| Skill runs: `dieter` and `access` against a branch's preview URL or Figma frame, results filed to the prototype | Automatic runs on every push; code-review skill (James, later) |
| Sign-up page with interface preview + waitlist | Billing, teams self-serve onboarding |

**Staleness is a feature, not a metric aside:** the dashboard flags
prototypes with no commits in 14 days. Curation includes retiring things —
that is the Canon position expressed in the product.

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

Each follows the Strata disciplines: append-only layers, verbatim kept
apart from interpretation, an evidence bar before anything is called a
rule, and identity hygiene. A reviewed prototype checks against *this
team's* accumulated record — "you used spacing-4 here but this system's
cards use spacing-6, decided 2026-03-12" — which is the thing no generic
skill can say.

Alpha ships `strata` + `dieter` + `access`; `system` is next once
assumption 3 proves review runs get acted on. `interface`, `ux`, and
`copy` follow the same mold and are cheap once the mold is proven.

## The skills lineup at launch

| Skill | State | Job in v2 |
| --- | --- | --- |
| `canon` router + 3 kits | shipped | build-time judgment in the agent |
| `graft` | shipped | maps: session history now, branch graph in v2 |
| `strata` | shipped | the feedback system — the product's comment box *is* a Strata intake |
| `dieter` | to build | constraint review: less, but better — flags what to remove, not add |
| `access` | to build | accessibility pass on a prototype: contrast, targets, keyboard path |
| code review | later (James) | correctness/hygiene pass on prototype branches |

Naming note for `dieter`: "Less is more" is Mies van der Rohe; Rams'
phrase is **"Less, but better"** (*Weniger, aber besser*). The skill uses
the ethos as v1 decided — principles underneath, applied as concrete
constraints — and avoids claiming the man's endorsement. `dieter` is a
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
  confirmation; if that answer is no, v2 pivots to skills-only (dieter +
  access still ship — they carry value without the platform).
- **Repo trust.** Read-only scopes, no code storage, security page from
  day one.
- **Figma expectations.** Embeds look like integration; users will ask
  for sync. The PRD's answer: not until assumption 2 is proven.

## Out of scope for v2 entirely

Skill configurator, hosting arbitrary bundles, PWA packaging, benchmark
publishing (stays on the GTM track), MCP server (revisit after alpha).

## Build order

1. `/alpha` page + waitlist (needs the form account) + preview mock
2. App shell: auth, project, GitHub App branch index, staleness
3. Prototype page + Figma embed + Strata-backed feedback
4. `dieter` + `access` skills (TDD, baseline-first, like Strata)
5. Review runs UI
6. NatureQuant onboarding, then widen
