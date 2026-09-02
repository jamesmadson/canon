# Checks

Each rule below is written so that it can be answered yes or no from numbers,
not from taste. Run them against a grid you read and against a grid you
recommend. Report the failures with the offending value, never as a general
impression.

Notation: `u` is the baseline unit. `c` is the column count. `g` is the
gutter. `m` is the margin. `W` is the format width. `C` is the content width,
`W - 2m`.

## 1. The unit is stated

There is a single number, 4 or 8, and it is written down.

Fail if the answer says "8px-ish", names two units, or derives spacing from a
type scale instead.

## 2. The gutter is a whole number of units

```
g mod u == 0
```

24 with u=8 passes, and is reported as "24px (3u)". 20 with u=8 fails. Report
the failure as "gutter 20px is 2.5u".

## 3. The margin is a whole number of units

```
m mod u == 0
```

## 4. The margin is not narrower than the gutter

```
m >= g
```

Equality is allowed and reads as deliberately edge-to-edge. Below it, the
outside of the layout is tighter than the inside and the columns look like
they are falling off the format.

## 5. Columns are equal width

```
column = (C - (c - 1) * g) / c
```

Every column is this number. Fail on any hand-set track that differs, on a
`grid-template-columns` list with unequal values, and on an `auto-fill` or
`auto-fit` track sizing where the count is not fixed at each named format.

The column width itself does not need to be a whole number. Fractional column
width is normal on screens. Report it to one decimal place and move on.

## 6. Type sits on the baseline, or is declared not to

For every type style:

```
line-height mod u == 0
```

and the block containing it starts on a unit boundary. Both halves are
required, and the second is the one that is usually missing.

16/24 with u=8 passes (3u). 32/40 passes (5u). 16/1.4 gives 22.4px and fails.
A unitless line height only passes when it multiplies out to a whole number of
units at the size it is used at, which means it has to be checked per size,
not once.

## 7. Every spacing value is a multiple of the unit

Padding, margin, gap, and fixed component heights. Border radius is excluded,
because radius is not spacing, but a radius off the scale is still worth one
line.

Derive the working unit from existing code by taking the greatest common
divisor of the spacing values present, then listing the values that break it.
Two or more breaking values means the codebase has no unit, whatever the
documentation says.

## 8. The module proportion is stated

A ratio, width to height, at a named format: `3:2`, `1:1`, `16:10`.

If nothing in the input sets a module height, there is no module proportion.
Write "no module height is set, so no module proportion exists" rather than
proposing one. Absence stated is a finding. Absence filled in is a fabrication.

## 9. Content occupies whole columns

Every element's width is a span of columns plus the gutters between them:

```
width = n * column + (n - 1) * g,  where n is a whole number, 1 <= n <= c
```

Fail on percentage widths that do not resolve to a span, and on fixed pixel
widths that land between two spans.

## 10. Each named format has its own grid

Every format in the brief has a stated `c`, `g`, and `m`. A format that
inherits another format's grid unchanged is not a format, it is the same grid
being stretched, and it should either be removed from the list or given its
own numbers.

## 11. The family shares one unit

Across every format: same `u`, and rules 2, 3, 4, 6, and 7 pass at each one.
Column counts are free to differ. This is the rule that makes several grids
one system.

## Reporting

One line per failure, in this shape:

```
FAIL 4 - margin 16px is narrower than gutter 24px at the 1280 format
FAIL 6 - .meta line-height 1.4 at 15px resolves to 21px, 2.6u
PASS   - 9 of 11
```

Rules that cannot be evaluated from the input are reported as such, never as
passes. A check you could not run is not a check that passed.
