# Monochrome Retheme — Design Spec

Date: 2026-08-10
Status: Approved by user, ready for implementation planning

## Purpose

Strip Canon's remaining color blocks — the orange skill-detail hero, the
orange StructureMap hub, the greige nav/hero bands — and move the whole
site to a type-led monochrome system: white ground, black ink, two grays
for hierarchy and hairlines. Direction set by the user's references
(1042.studio/store, drams.framer.website journal, snohetta.com, and two
swatch/type images): hierarchy through value and weight, not hue; color
does no compositional work.

**The one rule for orange:** it survives only as an interaction color.
Zero resting styles use it. It appears exclusively on `:hover` and
`:focus-visible` states. A page at rest is entirely monochrome.

## Palette

The user supplied three gray swatches: a pale cool (sage/blue-tinted)
gray, a warm off-white, and a neutral-cool light gray. The gray family
below follows the **cool-neutral** direction (first and third swatches).
The warm swatch is deliberately unused: the ground stays pure white, and
a warm surface gray would read as a return of the retired greige.

`src/styles/global.css` `@theme` becomes:

```css
--font-sans / --font-mono: unchanged;
--color-bg:          oklch(100% 0 0);          /* pure white ground */
--color-ink:         oklch(20.02% 0 0);        /* unchanged near-black */
--color-ink-soft:    oklch(42% 0 0);           /* secondary text — was
                        oklch(41.83% 0.0097 106.81); warm tint dropped,
                        same lightness so AA contrast (≥4.5:1) holds */
--color-surface:     oklch(92% 0.003 210);     /* NEW: hover washes,
                        legend/badge fills, superseded banner */
--color-rule:        oklch(85% 0.005 210);     /* hairlines — was warm
                        oklch(75.92% 0.0142 97.5); now cool-neutral and
                        lighter, per the swatches, against pure white */
--color-rule-strong: oklch(68% 0.005 210);     /* borders/underlines —
                        was warm oklch(53.72% 0.0139 96.58) */
--color-accent-orange: oklch(56% 0.185 40);    /* unchanged value;
                        interaction-only from now on */
```

**Deleted tokens:** `--color-paper` (greige, no remaining use),
`--color-tile` (white-on-white collapses into `--color-bg`),
`--color-accent-yellow` (its one use, the superseded banner, moves to
`--color-surface`).

Migration note: every `bg-tile`, `bg-paper`, `hover:bg-paper/40`,
`text-accent-*`, `bg-accent-*` utility in `src/` must be re-pointed or
removed — finish with `grep -rn "paper\|tile\|accent-yellow" src/`
returning nothing.

## Surfaces

### BaseLayout / nav
White background (no band), hairline bottom border (`border-rule`).
Wordmark ink. Nav links `ink-soft`; orange on hover and
`focus-visible`. Grid-overlay toggle untouched (it reads rule tokens).

### Homepage
Hero band's `bg-paper` and negative-margin full-bleed go; the hero is
plain white with the existing quiet type scale — headline ink, subtitle
`ink-soft`. Section eyebrows unchanged structurally, `ink-soft`. The
hairline-tile card grid (`gap-px bg-rule`) keeps its structure — only
the divider color changes via the token. SkillCard: tiles `bg-bg`,
index + tagline + rating dots `ink-soft`, name **ink** at rest, orange
on card (`group`) hover; hover wash becomes `hover:bg-surface/60`.

### /skills + FilterBar
Same grid treatment. Checkbox `accent-ink` stays (a black checkbox is
monochrome). Legends/labels already `ink-soft`.

### Skill detail page
- **Hero:** the orange slab and its full-bleed wrapper are deleted.
  Replacement, Snøhetta-style: generous top whitespace, category as a
  hairline-outlined chip (`border-rule-strong`, ink text, white bg),
  then the skill name very large in ink — `text-5xl sm:text-6xl
  font-black` — on white. No background of any kind.
- **Tool matrix:** active cells `bg-ink` with white abbreviation text;
  inactive cells `border-rule-strong` outline with `ink-soft` text.
- **Prose links:** ink with underline at rest, orange on hover.
- **Superseded banner:** `bg-surface` with ink text (was yellow tint).
- **Sidebar:** already monochrome; unchanged.

### StructureMap
- **Hub card:** white, `1px solid rule-strong` border (no fill).
  `SKILL.md` in mono `ink-soft`, name ink 900, tagline `ink-soft`.
- **Glyphs at rest:** section dot = filled ink circle (was orange);
  file square = filled `ink-soft`; folder square = outline. Glyph
  hover-scale behavior unchanged.
- **Hover states:** row wash becomes `--color-surface` (was orange
  tint); link text and underline turn orange on hover (already do);
  the "hover" hint badge and count badges go `bg-surface` +
  `ink-soft` text (count badge was orange-tinted).
- **Legend:** `bg-surface`, `border-rule`.
- All `color-mix(... var(--color-accent-orange) 8% ...)` washes in the
  component's scoped CSS are replaced by `var(--color-surface)`.

### Submit / newsletter
Token inheritance only; re-point any `bg-paper`/`bg-tile` utilities
found by the migration grep. No structural change.

## Interaction / accessibility

- Orange hover states must be accompanied by a non-color cue where the
  element isn't obviously interactive already (links keep underlines at
  rest, so hue change is supplementary — WCAG 1.4.1 satisfied).
- `focus-visible` states use orange outlines sitewide (nav links, card
  links, StructureMap links) — interaction rule includes keyboard.
- New pairings are black-on-white and the existing AA-verified grays;
  `ink-soft` keeps its lightness, so no contrast re-audit is needed
  beyond spot-checking the two re-derived rule grays are decorative
  (hairlines/borders, not text — no AA requirement).

## Testing

Visual pass in the Browser pane: homepage, /skills (filter interaction),
three detail pages (`frontend-design`, `nothing-design`,
`emil-design-eng` — covers hero, matrix, both StructureMap branches),
submit, newsletter. Confirm: no greige or orange visible anywhere at
rest; hover a card, a nav link, and a StructureMap file link and confirm
orange appears only then. `npx astro check` + `npm run build` green;
migration grep returns nothing.
