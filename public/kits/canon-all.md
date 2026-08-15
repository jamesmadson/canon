---
name: canon-all
description: >-
  Canon's three build kits in one file: marketing and landing sites,
  product UI and dashboards, and mobile review. Routes by task, then
  applies that kit's guidance — brand discipline, craft floor, motion
  frequency gate, copy rules, accessibility floor, and pre-ship gates.
  Use when designing, building, or reviewing any interface and you want
  Canon's judgment; say which kind of work it is, or ask which applies.
compatibility: >-
  Self-contained: needs no sibling skills installed. Built for surfaces
  that accept a single Markdown skill file, such as Figma Make and the
  Figma agent.
metadata:
  source: https://jamesmadson.github.io/canon/kits/
  generated: scripts/build-canon-artifacts.ts
---

# Canon — design skill router

Canon curates design skills and composes them into kits. This router is the
one thing you install; it reads the task and pulls in the kit that applies.

**It stays dormant until called.** Invoke it by naming Canon, naming a kit, or
asking which design skills apply. Never activate on general design chatter.

## Routing table

| The task sounds like | Route to |
| --- | --- |
| Landing page, marketing site, hero, launch page, pricing page, persuasion, "make this argue in one scroll" | `canon-marketing-site` |
| Dashboard, admin panel, data table, product UI, internal tool, settings, data-heavy screen | `canon-product-ui` |
| Mobile audit, "review my app", thumb zones, tap targets, safe areas, PWA, "is this good on mobile" | `canon-mobile-first-review` |
| Anything else, or two routes fit equally | **Ask. Never guess.** |

When the task is ambiguous, present the three routes in one line each and let
the user pick:

- **Marketing / Landing Site** — a page that has to persuade in one scroll.
- **Product UI / Dashboard** — a dense interface used daily, where restraint
  is a functional requirement.
- **Mobile-First Review** — auditing something that already exists on a phone.

A full redesign spanning brand, marketing, and product is not a route. Point
the user at Canon's Full Redesign kit
(https://jamesmadson.github.io/canon/kits/full-redesign/) and let them install
it directly.

## How each route works

Load the routed kit skill and follow it. Each kit also composes named
upstream skills: **when those skills are installed in this project, defer to
them for their own subject** — they carry the detail the kit summarizes. When
they are not installed, the kit skill's own guidance is sufficient on its own;
do not tell the user to go install anything mid-task.

### `canon-marketing-site`

The page's job before its layout, a UI craft floor, motion that earns its
weight, persuasion copy, an accessibility floor that survives heavy motion,
and mobile discipline.

Composes: `brand-guidelines`, `frontend-design`, `web-design-guidelines`,
`make-interfaces-feel-better`, `design-motion-principles`,
`scroll-scrubbed-visual-sequence`, `falling-leaves`, `threejs-landscape`,
`better-writing`, `better-accessibility`.

### `canon-product-ui`

Systems before screens, density and data craft, a motion frequency gate, copy
for dense interfaces, an accessibility floor for custom widgets, and mobile
reality for tools built on desktop.

Composes: `frontend-design`, `web-design-guidelines`,
`make-interfaces-feel-better`, `emil-design-eng`, `design-motion-principles`,
`improve-animations`, `react-view-transitions`, `better-accessibility`,
`better-writing`, `thumb-first`.

### `canon-mobile-first-review`

A method, not a build kit: run design judgment and platform verification as
two separate passes, then merge them into one prioritized report. An opinion
must never read as a defect.

Composes: `thumb-first`, `web-design-guidelines`, `better-accessibility`,
`better-writing`, `improve-animations`.

## Working rules

- Route once, at the start. Say which kit you routed to and why, in one line.
- If the task shifts (a dashboard review turns into a landing page), re-route
  and say so rather than mixing two kits' guidance silently.
- Canon's kits carry judgment, not house style. They tell you what to decide
  and what the trade-off is — they do not hand you a component library.

---

## Marketing / Landing Site

## Marketing / Landing Site — Kit Digest

Canon's ten-skill Marketing / Landing Site kit, distilled into one
self-contained file. It carries the kit's judgment — what to decide, and
what the trade-off is — and needs nothing else installed to be useful.
Where the individual skills it draws on are present, they hold more detail
on their own subjects and are worth deferring to.

Provenance: distilled from skills by Jakub Krehel
(make-interfaces-feel-better, better-writing, better-accessibility), Kyle
Zantos (design-motion-principles), and Meng To
(scroll-scrubbed-visual-sequence, falling-leaves, threejs-landscape) —
MIT; Anthropic (frontend-design, brand-guidelines) — Apache-2.0; and
Vercel Labs (web-design-guidelines) — no license stated. This digest
itself is Canon's own writing, distilled from those skills rather than
copied from them — curated by Canon.

---

### 1 · Brand foundation

> FILL IN before first use: the real palette, type families and scale, logo
> rules, and three adjectives for the voice.

A landing page is the brand's loudest surface, so the rules exist before
the hero does. Name the subject and its world, write a compact token plan
(color, type, layout, one signature element), then self-critique against
the defaults every AI-built landing page collapses toward: the gradient
hero on white, the cream-and-terracotta wellness look, near-black with one
acid accent, Inter-as-safe-choice. Pick one deliberately or avoid them
deliberately — but decide.

### 2 · The page's job

One page, one argument. Before any layout: what should a visitor
understand, believe, and do? Every section either advances that or gets
cut. The hero states the thesis rather than decorating it. Social proof
sits where doubt appears, not in a band at the bottom because that's where
logos go.

### 3 · UI craft floor

- Depth, radius, and spacing from a scale. Concentric radii: inner = outer
  − padding.
- Every interactive element looks interactive; hover, focus-visible,
  active, and loading states all exist.
- Real copy and real images in mockups. Marketing pages are where lorem
  hides the fact that the argument doesn't work yet.
- Set the type scale for the widest hero and the narrowest phone in the
  same pass, not in sequence.

### 4 · Motion & signature moments

The frequency gate still applies — but a marketing page is one of the few
contexts where the top row is the right answer:

| Frequency | Motion budget |
| --- | --- |
| Rare (a visitor sees it once) | Expressive motion welcome |
| Occasional | Subtle and fast |
| Frequent (nav, forms) | Minimal or none |
| Keyboard-initiated | Never animate |

Rules that don't bend: animate `transform` and `opacity` only; enters
slightly slower than exits; `prefers-reduced-motion` fully supported with a
static poster state that still communicates.

**Scroll sequences**: native scroll position is the only source of truth —
never wheel deltas, elapsed time, or autoplay. Define the sequence as data
(scroll length, frame count, poster frame, reduced-motion frame, copy
stops) before building. It must be reversible and usable with motion off.

**Signature moments**: one per page, usually. Ambient motion (drifting
foliage, a live landscape) belongs behind a subject, never competing with
it — a backdrop's job is to make the subject look like it's *somewhere*,
then get out of the way. If a flourish would survive being described in a
sentence to a stakeholder, it's probably earning its place.

### 5 · Copy rules

Marketing copy is the product on this surface.

- Verb-first CTAs naming the action: "Start a project", "See pricing" —
  never "Learn more" twice on one page, never "Click here".
- Plain claims beat clever ones. Specific beats aspirational: a number, a
  named customer, a concrete outcome.
- One voice; tone can be warm here, but errors (forms, failed submissions)
  stay calm and plain.
- Address the reader as "you". Delete every word not doing work.
- Links describe their destination. One capitalization policy throughout.

### 6 · Accessibility floor

Heavy motion and full-bleed art are exactly where these get dropped:

- Native elements first; `<button>` for actions, `<a href>` for navigation.
- Visible `:focus-visible` ring ≥2px, verified against every background it
  crosses — including over imagery and video.
- Text over media needs a verified contrast ratio (≥4.5:1), not a hopeful
  scrim.
- Every pointer interaction has a keyboard path; scroll-driven content must
  be reachable and readable without scrolling animation.
- Hit areas ≥44×44 on touch.
- Autoplaying video: muted, with a pause control, and disabled under
  `prefers-reduced-motion`.

### 7 · Mobile discipline

The first screen on a phone shows the argument, not the navigation. Decide
deliberately: how the hero reflows, whether the signature moment runs at
all on mobile (often it shouldn't — battery and mid-range GPUs are real),
where the primary CTA sits in the thumb zone, and whether long scroll
sequences degrade to static art below a breakpoint.

### 8 · Pre-ship gates

Nothing ships until: a keyboard-only pass reaches every CTA; a 375px pass
shows the argument on the first screen with no horizontal scroll; motion
has been checked against the frequency gate *and* with reduced-motion on;
copy has been read against §5; contrast has been measured over every
background including media; and the page has been loaded once on a real
mid-range phone, not just an emulator.

---

## Product UI / Dashboard

## Product UI / Dashboard — Kit Digest

Canon's ten-skill Product UI / Dashboard kit, distilled into one
self-contained file. It carries the kit's judgment — what to decide, and
what the trade-off is — and needs nothing else installed to be useful.
Where the individual skills it draws on are present, they hold more detail
on their own subjects and are worth deferring to.

Provenance: distilled from skills by Jakub Krehel
(make-interfaces-feel-better, better-accessibility, better-writing), Emil
Kowalski (emil-design-eng, improve-animations), and Kyle Zantos
(design-motion-principles, thumb-first suite) — MIT; Anthropic
(frontend-design) — Apache-2.0; and Vercel Labs (web-design-guidelines,
react-view-transitions) — no license stated. This digest itself is
Canon's own writing, distilled from those skills rather than copied from
them — curated by Canon.

---

### 0 · The governing constraint

This is a surface people use every day, not one they visit once. Restraint
isn't a style preference here — it's the functional requirement. A flourish
that delights on first encounter becomes a tax on the four-hundredth. When
a decision is genuinely close, pick the quieter option.

### 1 · Systems before screens

Define tokens and primitives before composing views: spacing scale, radius
scale, type scale, elevation levels, and the semantic state colors
(neutral / good / warning / critical) kept separate from any brand accent.
A dashboard designed screen-by-screen produces twelve near-identical card
components; a dashboard designed system-first produces one.

### 2 · Density and data craft

- Tabular numbers everywhere digits align — tables, stat tiles, timestamps,
  anything comparable down a column.
- Concentric radii: inner radius = outer radius − padding.
- Right-align numerics, left-align text, and keep column alignment stable
  when values change length.
- Encode state in form as well as color: a pill, a chip, a severity stripe,
  an icon. Color alone fails for ~8% of users and in every grayscale print.
- Summary before detail: the number that matters is readable before the
  table that explains it.
- Every state exists and is designed: loading (skeleton, not spinner-only),
  empty (says what belongs here and how to get it), error (says what
  happened and the next action), and the "too much data" state nobody
  mocks up.
- Sparklines and charts get the same care as type: an emphasized endpoint,
  a faint grid, a legible axis.

### 3 · Motion, restrained

The frequency gate does the most work in this kit:

| Frequency | Motion budget |
| --- | --- |
| Rare (monthly) | Subtle motion acceptable |
| Occasional (daily) | Fast and minimal |
| Frequent (hundreds/day) | None, or an instant transition |
| Keyboard-initiated | Never animate |

Most dashboard interactions land in the bottom two rows. Animate
`transform` and `opacity` only; enters slightly slower than exits; never
animate a keyboard-initiated action; `prefers-reduced-motion` fully
supported. If you're on React and the shell is navigation-heavy, view
transitions are the one place a little motion reliably helps orientation.

### 4 · Copy rules

Labels and errors carry more weight per word here than anywhere else.

- Verb-first buttons naming the action: "Export CSV", "Revoke access".
  Confirmations repeat the consequence: "Delete this project?" answers with
  `Delete project`, not `Yes`.
- Errors are calm, plain, and actionable: what happened, what to do next.
  Zero playfulness in anything touching data loss or permissions.
- One term per concept, everywhere. If it's "Archive" in the menu, it isn't
  "Move to storage" in the toast.
- Address the reader as "you"; avoid "we" in errors.
- One capitalization policy; one flow vocabulary.
- Never concatenate fragments around variables — full templated strings
  with real pluralization.

### 5 · Accessibility floor

Custom widgets are where dense product UI actually fails:

- Native elements first. Reach for ARIA patterns (combobox, listbox, tabs,
  menu) only when no native element exists — and then follow the APG
  keyboard model exactly: Escape closes, arrows move within, Tab moves
  between, roving `tabindex` in composites.
- Visible `:focus-visible` ring ≥2px, verified against every adjacent
  surface — including inside tables and on dark toolbars.
- Modals set the background `inert`, move focus in, restore it on close.
- Virtualized lists and infinite tables must stay keyboard-navigable and
  announce updates via a live region.
- Text contrast ≥4.5:1; non-text UI boundaries ≥3:1, including bordered-only
  inputs and chart elements that carry meaning.
- Hit areas ≥40×40 on desktop when density permits, ≥44×44 on touch;
  extended areas never overlap in a dense grid.
- Inputs: correct `type`, `inputmode`, `autocomplete`; never block paste.

### 6 · Mobile reality

Dashboards get opened on phones whether or not they were designed for it.
Decide deliberately rather than letting it happen: which views have a
mobile form at all, what a wide table becomes (cards? horizontal scroll
with a frozen first column? a deliberate "open on desktop" message?),
where the primary action sits in the thumb zone, and what gets dropped
rather than shrunk.

### 7 · Pre-ship gates

Nothing ships until: a keyboard-only walkthrough completes every flow
including custom widgets; every state (loading, empty, error, overflow) has
been seen with real data; motion has been checked against the frequency
gate; copy has been read against §4 for term consistency; contrast has been
measured including chart and status colors; and the densest view has been
opened at 375px.

---

## Mobile-First Review

## Mobile-First Review — Kit Digest

Canon's five-skill Mobile-First Review kit, distilled into one
self-contained file. It carries the kit's judgment — what to decide, and
what the trade-off is — and needs nothing else installed to be useful.
Where the individual skills it draws on are present, they hold more detail
on their own subjects and are worth deferring to.

Unlike the build kits, this one is a **method**: it tells you how to run a
review and what to look for, not how to design something new.

Provenance: distilled from skills by Kyle Zantos (thumb-first suite),
Jakub Krehel (better-accessibility, better-writing), and Emil Kowalski
(improve-animations) — MIT; and Vercel Labs (web-design-guidelines) — no
license stated. This digest itself is Canon's own writing, distilled from
those skills rather than copied from them — curated by Canon.

---

### 1 · The method: two passes, one report

Mobile review collapses two different questions, and mixing them is how
reviews become unusable. Run them as separate passes:

**Pass A — design judgment.** *Is this the right mobile design?* Output:
opinions and decision forks, ranked by user impact. Platform-agnostic.

**Pass B — platform verification.** *Is it built correctly for the device?*
Output: objective defects, P0–P3, each with a file and line and a concrete
fix.

Then merge into ONE report that keeps the two classes visually distinct and
ends with a single combined fix-order. The discipline that makes it work:
an opinion must never read as a defect, and a must-fix must never read as
a preference.

### 2 · Pass A — design judgment

Review through named lenses rather than a flattened "best practices" list,
and surface disagreements as decisions rather than papering over them:
ergonomics and reach, thumb-zone placement, forced focus (what earns the
first screen), direct manipulation, navigation taxonomy, empirical
skepticism about untested patterns, and the platform canons (HIG,
Material).

The recurring forks — decide each deliberately, don't inherit them:

1. Primary navigation pattern (tabs, drawer, hybrid)
2. Sheet vs. modal vs. full screen
3. Gesture vs. visible control
4. Primary action placement
5. List vs. grid
6. Long-form content structure
7. Information density
8. Where destructive actions live
9. Whether and how to onboard

Two heuristics that catch the most: **content before controls** — a
visitor's first screen shows the thing, not the filters for the thing; and
**one primary action per screen**, placed in the natural thumb zone,
with that zone not squandered on secondary or developer affordances.

### 3 · Pass B — platform verification

Objective, checkable, and severity-ranked:

- **Tap targets**: ≥44×44 CSS px in touch contexts. Check the *functional*
  hit area, not the visual box — padding on a wrapper isn't tappable if the
  anchor doesn't own it.
- **Font size in inputs**: ≥16px, or iOS Safari zooms on focus.
- **Viewport**: no horizontal scroll at 375px
  (`documentElement.scrollWidth === clientWidth`); beware `100vh` on iOS.
- **Safe areas**: `viewport-fit=cover` plus `env(safe-area-inset-*)` for
  anything fixed near an edge — and know that emulators cannot confirm
  this; it needs a real notched device.
- **Hover-dependent UI**: anything revealed only on `:hover` is unreachable
  on touch. Provide a tap path or an `@media (hover: none)` fallback, and
  verify the fallback actually works under touch emulation.
- **Forms**: correct `type`, `inputmode`, and `autocomplete`; visible
  labels; never block paste.
- **Announcements**: async result updates (filters, search, validation)
  need a live region or screen readers miss them.
- **Skip link**: present, and reaching `<main>`.
- **Performance**: measure on a production build, not a dev server —
  dev-toolbar and unbundled assets make dev-server numbers meaningless.

### 4 · Copy under mobile constraints

Mobile's space punishes vague labels first. Verb-first buttons naming the
action; errors calm, plain, and actionable; one term per concept; links
that describe their destination. Truncation is a design decision, not an
accident — decide what wraps, what truncates, and what shrinks.

### 5 · Motion under mobile constraints

Motion that reads as polish on a desktop demo often reads as lag on a
mid-range phone. Apply the frequency gate (frequent interactions get no
motion), animate `transform` and `opacity` only, support
`prefers-reduced-motion`, and pause offscreen work. Anything continuously
animating is a battery decision as much as a design one.

### 6 · Reporting

Findings are only as good as their specificity. "Improve the tap targets"
is worth less than "nav links measure 46×20px, under the 44px floor —
`BaseLayout.astro:28-30`, add `py-3`". Every platform defect carries a
location, a measurement, and a fix. Every design fork carries options,
honest tradeoffs, and the signal that should decide it.

State plainly what you could not assess: emulators lie about safe areas and
address-bar behavior, dev servers lie about performance, and neither can
tell you how the thing feels in one hand on a bus.
