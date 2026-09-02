---
name: raster
license: MIT
description: Use when asked to read the grid out of existing CSS, layout code, a Figma export, or a screenshot, or to recommend a grid, column count, gutter, margin, or spacing scale for a page, screen, or dashboard, or to draw a grid overlay to inspect one. Also use when spacing or alignment is called arbitrary, inconsistent, or off, or when a layout has to hold several screen sizes.
---

# Raster

A grid is a set of decisions taken once so that a thousand later ones need not
be taken at all. Josef Müller-Brockmann argued the system; Massimo Vignelli's
Unigrid showed the rest of it: one system can serve a family of formats
without becoming one stretched layout.

Answers here are specs, in numbers, with the unknowns named.

## The hierarchy

Decide in this order, never skipping downward.

1. **Baseline unit.** The smallest vertical step, 4px or 8px on screens. Every
   other number is a whole multiple of it.
2. **Columns.** Count, gutter, margin, stated per format.
3. **Modules.** Where a column band crosses a run of baseline rows. State the
   proportion, not only the column count.

Terms in [references/vocabulary.md](references/vocabulary.md), what screens
change in [references/digital.md](references/digital.md), the rules stated so
they can be checked in [references/checks.md](references/checks.md).

## Read

From CSS, layout code, a Figma export description, or a screenshot, return a
spec sheet: baseline unit, columns, gutter, margin, column width, module
proportion, whether type sits on the baseline. Every spacing value twice, in
pixels and in units. Derive the unit from the common divisor of the spacing
values, then name the values that break it.

Close with what **cannot be determined from this input**. CSS with no row
height sets no module height, so states no module proportion; a screenshot
states no fluid behavior. Say so rather than filling the gap.

## Recommend

Two or three candidate grids, one line each, tradeoff priced. Then one pick,
with the reason. Unit first, then a grid per format, then the modules. A phone
grid is a different grid from a desktop grid, not the same grid squeezed; a
family is held together by the shared unit, not a shared column count.

## Overlay

Emit [references/overlay.md](references/overlay.md) filled with the chosen
numbers: columns, baseline, module cells, on a class the person toggles. An
inspection tool, never shipped chrome, never left on.

## Red flags, stop

- "12 columns" with no unit, no gutter, no margin
- A module proportion the input cannot support
- One grid handed to three formats
- A range where the grid needs a number
- Drift into type treatment, color, or component styling

## Rationalizations

| Excuse | Reality |
|---|---|
| "The framework's 12 columns are the grid" | Twelve is a divisibility choice. Without a unit, a gutter, a margin, and a module it specifies nothing. |
| "It obviously uses an 8px unit" | Then measure it and name the values that break it. Obvious is how a wrong unit gets adopted. |
| "One fluid grid covers every breakpoint" | It covers them by degrading. A format family is several grids that agree on the unit. |
