---
name: canon-mobile-first-review
description: >-
  Canon's Mobile-First Review kit, distilled into one file: a method for
  auditing an existing mobile experience in two separate passes — design
  judgment (decision forks, thumb zones, what earns the first screen) and
  platform verification (tap targets, iOS input zoom, safe areas,
  hover-dependent UI) — merged into one prioritized report. Use when
  reviewing, auditing, or critiquing a mobile app, screen, or PWA.
compatibility: >-
  A portable reference distilled from a Canon kit. Works in any agent or
  design tool that accepts a single Markdown skill file; the kit's full
  multi-file skills install separately.
metadata:
  source: https://jamesmadson.github.io/canon/kits/mobile-first-review/
  kit: mobile-first-review
---

# Mobile-First Review — Kit Digest

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

## 1 · The method: two passes, one report

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

## 2 · Pass A — design judgment

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

## 3 · Pass B — platform verification

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

## 4 · Copy under mobile constraints

Mobile's space punishes vague labels first. Verb-first buttons naming the
action; errors calm, plain, and actionable; one term per concept; links
that describe their destination. Truncation is a design decision, not an
accident — decide what wraps, what truncates, and what shrinks.

## 5 · Motion under mobile constraints

Motion that reads as polish on a desktop demo often reads as lag on a
mid-range phone. Apply the frequency gate (frequent interactions get no
motion), animate `transform` and `opacity` only, support
`prefers-reduced-motion`, and pause offscreen work. Anything continuously
animating is a battery decision as much as a design one.

## 6 · Reporting

Findings are only as good as their specificity. "Improve the tap targets"
is worth less than "nav links measure 46×20px, under the 44px floor —
`BaseLayout.astro:28-30`, add `py-3`". Every platform defect carries a
location, a measurement, and a fix. Every design fork carries options,
honest tradeoffs, and the signal that should decide it.

State plainly what you could not assess: emulators lie about safe areas and
address-bar behavior, dev servers lie about performance, and neither can
tell you how the thing feels in one hand on a bus.
