# Vocabulary

Eight words. Everything this skill says is built from them. Definitions are
ours, written for screens; the tradition behind them is Josef
Müller-Brockmann's grid systems and Massimo Vignelli's Unigrid, and nothing
here is quoted from either.

## Format

One size the design is actually built for. On screens a format is a viewport
width you have named and committed to, such as 390, 768, 1280. A format is not
a range. The range between two formats is where a grid stretches; the format
is where it is correct.

Vignelli's Unigrid is the reference case: a family of printed formats, all
different sizes, all governed by one system, so a poster and a folded brochure
were recognizably the same publisher. The screen version of that idea is one
unit and one module logic shared across phone, tablet, and desktop, with the
column count free to differ.

## Margin

The space between the outer edge of the format and the outer edge of the
content area. It has one job: to stop the layout from touching the edge, and
to make the content area read as a deliberate object rather than as whatever
was left over.

A margin narrower than a gutter is a mistake you can see: the outside of the
layout looks tighter than the inside, so the columns appear to fall off the
format.

## Column

One of a set of equal vertical bands inside the content area. Equal is not
optional. The moment columns differ in width, spans stop being interchangeable
and the count stops meaning anything.

Column width is derived, never chosen:

```
column = (content width - (count - 1) x gutter) / count
```

Choose the count for how you want to be able to divide the page. Twelve
divides by 2, 3, 4, and 6. Sixteen divides by 2, 4, and 8 and gives a finer
step. Four or five is often right on a phone.

## Gutter

The space between two adjacent columns. It never appears outside the outermost
columns, which is what makes it different from a margin.

The gutter is the smallest gap in the layout that still separates two ideas.
It should be a whole number of baseline units, so that horizontal and vertical
space come from one scale rather than two.

## Baseline

The horizontal rhythm every vertical measurement is a multiple of. The
baseline unit is the step: 4px or 8px on screens. Line heights, block spacing,
component heights, and module heights are whole multiples of it.

Type "sits on the baseline" when its line height is a whole multiple of the
unit and the block it lives in starts on a unit boundary. Both halves are
required. A 24px line height inside a block offset by 5px sits on nothing.

## Module

The cell. One column band wide (or a span of them), a fixed run of baseline
rows tall. The module is where the horizontal system and the vertical system
meet, and it is the part most digital grids never define, which is why so many
of them are only column grids wearing the word.

State a module by its proportion, width to height, at the format in question.
A module 264 wide and 176 tall is 3:2. The proportion is what makes two cards
of different content read as the same kind of object.

A module has a proportion only if something sets its height. In CSS that means
an explicit row height, an aspect ratio, or a fixed component height. Where
nothing sets it, there is no module, and the honest answer is that there is
none rather than a guess.

## Field

A group of adjacent modules assigned to one kind of content: the thumbnail
field, the stat field, the list field. Fields are how a grid stops being
uniform without becoming irregular. Every field is a whole number of modules,
so the page can vary in density while every edge still lands on the same
system.

## Hierarchy

The order the decisions are taken in: unit, then columns, then modules, then
fields. It is one-way. A column count picked before the unit produces gutters
that are not multiples of anything, and a module drawn before the columns
produces a proportion no span can reproduce.

When a later decision cannot be satisfied, the fix is to change an earlier one
and rebuild forward, not to make an exception at the bottom. Exceptions at the
bottom are how a grid becomes a suggestion.
