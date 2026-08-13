# Full Redesign — Kit Digest

Attach this file where design work happens but skills can't run — Claude
Design, a claude.ai Project's knowledge base, or any tool that takes an
upload. It's the distilled, portable form of an eleven-skill kit. The
complete skills (with their reference files, workflows, and checklists)
install into `.claude/skills/` via the kit's install script and should do
the heavy work wherever they can run.

Provenance: distilled from skills by Jakub Krehel (better-writing,
better-accessibility, make-interfaces-feel-better), Emil Kowalski
(emil-design-eng, improve-animations), Kyle Zantos
(design-motion-principles, thumb-first suite), and Meng To
(scroll-scrubbed-visual-sequence) — MIT; Anthropic (frontend-design,
brand-guidelines) — Apache-2.0; and Vercel Labs (web-design-guidelines) —
no license stated. This digest itself is Canon's own writing, distilled
from those skills rather than copied from them — curated by Canon.

---

## 1 · Brand foundation

> FILL IN before first use: the real palette (hex or OKLCH), type families
> and scale, logo rules, and three adjectives for the voice. Everything
> below serves these; nothing below overrides them.

Name the subject and its world before designing anything. Write a compact
token plan — color, type, layout, one signature element — before building.
Then self-critique against the named AI-default looks: cream-and-terracotta,
near-black-with-one-accent, broadsheet-hairline-newspaper. Using one is
allowed; drifting into one is not. The difference is whether it was a
decision.

## 2 · UI craft floor

- Depth, radius, and spacing come from a scale, not per-element taste.
  Concentric radii: inner radius = outer radius − padding.
- Tabular numbers wherever digits line up in a column.
- Every interactive element looks interactive, and every state exists:
  hover, focus-visible, active, disabled, loading, empty, error.
- Empty states do work: say what belongs here and how to get it.
- Real content in mockups — never lorem, never a placeholder number that
  couldn't occur.

## 3 · Motion rules

The frequency gate, applied before anything animates:

| Frequency | Motion budget |
| --- | --- |
| Rare (monthly) | Expressive, delightful motion welcome |
| Occasional (daily) | Subtle and fast |
| Frequent (hundreds/day) | None, or an instant transition |
| Keyboard-initiated | Never animate |

Weight by context: utility surfaces lead with restraint; marketing
surfaces may lead with polish and spend expressiveness on one moment.
Enter animations run slightly slower than exits. Animate `transform` and
`opacity` only. Scroll-driven sequences take native scroll position as the
single source of truth, define a poster and a reduced-motion frame, and
stay reversible in both directions. `prefers-reduced-motion` is mandatory.

## 4 · Copy rules

- One voice; tone flexes with stakes. Warm for success, onboarding, and
  empty states. Neutral for routine actions and settings. Calm and plain
  for errors — zero playfulness. Serious and explicit for data loss or
  security.
- Verb-first buttons naming the specific action: "Save draft", "Delete
  project". Never "OK!", "Let's go", or a bare Yes/No on anything
  consequential. Confirmations repeat the consequence.
- Address the reader as "you". Avoid "we" in errors: "Unable to load" beats
  "We're having trouble loading".
- Plain words; delete every word not doing work. No idioms or humor that
  won't translate.
- Links describe their destination. Never "Click here"; never a bare "Learn
  more" when several appear on one page.
- One capitalization policy and one flow vocabulary (Continue *or* Next,
  not both), applied everywhere.
- Never concatenate fragments around variables — full templated strings
  with real pluralization.

## 5 · Accessibility floor

- Native elements first: `<button>` for actions, `<a href>` for navigation,
  real `<label>`s. No ARIA beats bad ARIA.
- Style `:focus-visible`, at least a 2px indicator, verified against every
  adjacent color. Never `outline: none` without a verified replacement.
- Every pointer interaction has a keyboard path. Modals set the background
  `inert`, move focus in, and restore it to the trigger on close.
- Hit areas: 44×44 in touch contexts, 40×40 on desktop when density
  permits. Extend with a pseudo-element; extended areas never overlap.
- Text contrast ≥4.5:1; non-text UI boundaries ≥3:1 — including the borders
  of bordered-only form inputs.
- Color never carries meaning alone; pair it with a label, icon, or shape.
- Inputs: correct `type`, `inputmode`, and `autocomplete`; 16px+ font size
  to prevent iOS zoom; never block paste.

## 6 · Mobile discipline

Two separate questions, never blended: *is this the right design?*
(judgment) and *is it built right for the device?* (objective defects). An
opinion must never read as a defect, nor a must-fix as a preference.
Decide the recurring forks deliberately: primary navigation pattern, sheet
vs. modal, gesture vs. visible control, where destructive actions live,
information density. Content before controls — the first screen shows the
thing, not the filters for the thing.

## 7 · Pre-ship gates

Nothing ships until: a keyboard-only walkthrough completes every flow; a
375px pass shows no horizontal scroll, ≥44px targets, and content on the
first screen; motion has been checked against the frequency gate; copy has
been read against §4; and contrast has been measured, including every
color-coded state.
