# What screens change

The print grid assumed one fixed format. A screen has no fixed format, and
that is the whole difference. Everything below follows from it.

## Fluid columns, fixed gutters

The column is the elastic part. The gutter is not.

A gutter that scales with the viewport drifts off the baseline unit at every
width except the one you designed at, and takes every gap on the page with it.
A column that scales is simply a column doing its job.

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;                 /* fixed, 3 units */
  max-width: 1080px;
  margin-inline: auto;
  padding-inline: 40px;      /* fixed, 5 units */
}
```

The consequence is that column width is fractional at most viewport widths.
That is fine and expected. Do not chase whole-pixel columns by making the
gutter fluid; you would be trading a rounding artifact nobody sees for a
spacing scale that no longer holds.

## Breakpoints are grid changes, not layout patches

A breakpoint exists because the grid changes at it: a different column count,
a different gutter, a different margin. If nothing about the grid changes,
there is no breakpoint, only a component that reflows.

State each format's grid in full. A typical three-format family:

| Format | Columns | Gutter | Margin | Content width |
|---|---|---|---|---|
| 390 | 4 | 16px (2u) | 16px (2u) | 358px |
| 768 | 8 | 24px (3u) | 32px (4u) | 704px |
| 1280 | 12 | 24px (3u) | 40px (5u) | 1200px |

The column counts differ deliberately. What makes these three the same system
is the 8px unit, the module logic, and the fact that a card is a whole number
of columns in each.

## The 4 and 8px unit

8px is the default. It divides into the common line heights (16, 24, 32, 40),
it keeps a spacing scale short enough to memorize, and it survives the two
device pixel ratios that matter.

Use 4px when the interface is genuinely dense, such as data tables or tool
panels, where an 8px step forces either a cramped row or a wasteful one. The
cost is a scale with twice as many rungs, which is twice as many chances to
pick the wrong one.

Pick one. A codebase with both is a codebase with neither, because every value
is a multiple of 4 and the unit stops constraining anything.

Do not include border radius in the divisor when deriving a unit from existing
CSS. Radius is not spacing and is not laid on the grid, though a radius off
the scale is still worth mentioning.

## Module proportion across orientation

A module's proportion changes when the column width changes, so a module fixed
in both dimensions is a module that only works at one format.

Fix the proportion, let the size follow:

```css
.module { aspect-ratio: 3 / 2; }
```

Take the family in the table above. At 1280 the column is 78px, so a
4-column span is 384px wide and 256px tall at 3:2, which is 32 units exactly.
At 768 the column is 67px, so the same half-width span is 340px wide and
226.67px tall, which is neither a whole pixel nor a whole unit.

Both cannot hold at once. Choose per format which one you are protecting:

- **Proportion fixed** for image and thumbnail modules, where a changing crop
  is more visible than a half-unit of drift.
- **Height fixed** in whole units for text, list, and stat modules, where the
  baseline holding is what makes a dense screen readable.

Say which you chose. An unstated choice here is the most common reason a grid
looks correct on one screen and loose on another.

## Container queries

A grid belongs to a container, not to the viewport. A card placed in a sidebar
and the same card placed in the main area are at different widths, and a
viewport query cannot tell them apart.

```css
.panel { container-type: inline-size; }

@container (min-width: 640px) {
  .panel .cards { grid-template-columns: repeat(8, 1fr); gap: 24px; }
}
```

The rule that keeps this from multiplying: the container's grid keeps the page
unit and the page gutter. Only the column count changes. A nested grid with
its own unit is a second design system inside the first.

## A responsive grid is several grids

Worth saying plainly, because the phrase "a responsive grid" hides it. Three
named formats is three grids. Each one has its own column count, its own
gutter, its own margin, and its own module proportions, and each has to be
specified and checked on its own.

What makes them a family rather than three unrelated layouts:

1. One baseline unit across all of them.
2. Gutters and margins that are whole units in every one.
3. Content that occupies whole columns in every one.
4. A module logic that survives the change in column count, even where the
   proportion does not.

The stretch between two named formats is unspecified space. Layouts are
allowed to be merely acceptable there. They are required to be correct at the
formats you named.
