---
name: canon-product-ui
description: >-
  Canon's Product UI / Dashboard kit, distilled into one file: restraint as a
  functional requirement — systems before screens, density and data craft, a
  motion frequency gate, copy for dense interfaces, an accessibility floor for
  custom widgets, and mobile reality. Use when designing, building, or
  reviewing a dashboard, data-heavy product interface, or admin tool.
compatibility: >-
  A portable reference distilled from a Canon kit. Works in any agent or
  design tool that accepts a single Markdown skill file; the kit's full
  multi-file skills install separately.
metadata:
  source: https://jamesmadson.github.io/canon/kits/product-ui/
  kit: product-ui
---

# Product UI / Dashboard — Kit Digest

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

## 0 · The governing constraint

This is a surface people use every day, not one they visit once. Restraint
isn't a style preference here — it's the functional requirement. A flourish
that delights on first encounter becomes a tax on the four-hundredth. When
a decision is genuinely close, pick the quieter option.

## 1 · Systems before screens

Define tokens and primitives before composing views: spacing scale, radius
scale, type scale, elevation levels, and the semantic state colors
(neutral / good / warning / critical) kept separate from any brand accent.
A dashboard designed screen-by-screen produces twelve near-identical card
components; a dashboard designed system-first produces one.

## 2 · Density and data craft

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

## 3 · Motion, restrained

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

## 4 · Copy rules

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

## 5 · Accessibility floor

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

## 6 · Mobile reality

Dashboards get opened on phones whether or not they were designed for it.
Decide deliberately rather than letting it happen: which views have a
mobile form at all, what a wide table becomes (cards? horizontal scroll
with a frozen first column? a deliberate "open on desktop" message?),
where the primary action sits in the thumb zone, and what gets dropped
rather than shrunk.

## 7 · Pre-ship gates

Nothing ships until: a keyboard-only walkthrough completes every flow
including custom widgets; every state (loading, empty, error, overflow) has
been seen with real data; motion has been checked against the frequency
gate; copy has been read against §4 for term consistency; contrast has been
measured including chart and status colors; and the densest view has been
opened at 375px.
