---
name: canon
description: >-
  Canon's router for design work. Routes to one of three kits: marketing and
  landing pages (hero, launch page, persuasion, one-scroll argument), product
  UI (dashboard, admin, data table, internal tool, data-heavy screens), and
  mobile review (mobile audit, thumb zones, tap targets, PWA, "is this good on
  mobile"). NEVER trigger automatically. This skill activates only when the
  user explicitly says "canon", names one of its kits, or asks which design
  skills apply to a task. Do not load it because a task merely sounds like
  design work — general UI, CSS, or copy questions are not a trigger.
compatibility: >-
  Expects its sibling Canon kit skills (canon-marketing-site, canon-product-ui,
  canon-mobile-first-review) installed alongside it. Works without them by
  naming which kit applies and what it covers. For single-file surfaces such
  as Figma, use canon-all instead.
metadata:
  source: https://jamesmadson.github.io/canon/kits/
  routes: canon-marketing-site, canon-product-ui, canon-mobile-first-review
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
