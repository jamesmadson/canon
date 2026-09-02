# Overlay

An inspection tool. It draws the grid you specified on top of the page so the
two can be compared by eye instead of by argument.

It is not a component, not a background, not a feature. Paste it, look, delete
it. If it is still in the codebase next week it has become a layer somebody
has to maintain and a layer that can leak into production.

## The CSS

Fill the six variables from the spec, then toggle the class.

```css
/* raster overlay: inspection only, delete before shipping */

.raster {
  --raster-cols: 12;        /* column count at this format */
  --raster-gutter: 24px;    /* gutter */
  --raster-margin: 40px;    /* margin */
  --raster-max: 1080px;     /* container max width, or none */
  --raster-unit: 8px;       /* baseline unit */
  --raster-module: 48px;    /* module height, a whole number of units */
  --raster-ink: 0 0 0;      /* rgb triplet, use 255 255 255 on dark */

  --raster-col: calc(
    (100% - (var(--raster-cols) - 1) * var(--raster-gutter))
    / var(--raster-cols)
  );
}

.raster::before,
.raster::after {
  content: "";
  position: fixed;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2147483647;
}

/* columns and module rows, held inside the margins */
.raster::before {
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: var(--raster-max);
  padding-inline: var(--raster-margin);
  box-sizing: border-box;
  background-origin: content-box;
  background-clip: content-box;
  background-image:
    repeating-linear-gradient(
      to right,
      rgb(var(--raster-ink) / 0.07) 0 var(--raster-col),
      transparent var(--raster-col)
        calc(var(--raster-col) + var(--raster-gutter))
    ),
    repeating-linear-gradient(
      to bottom,
      rgb(var(--raster-ink) / 0.05) 0 var(--raster-module),
      transparent var(--raster-module) calc(var(--raster-module) * 2)
    );
}

/* baseline, full width */
.raster::after {
  left: 0;
  right: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(var(--raster-ink) / 0.16) 0 1px,
    transparent 1px var(--raster-unit)
  );
}
```

## Toggling it

```js
document.body.classList.toggle('raster');
```

Bind it to a key while you are working, and remove the binding with the CSS.

```js
addEventListener('keydown', (e) => {
  if (e.key === 'g' && e.metaKey) document.body.classList.toggle('raster');
});
```

## What each layer shows

- **Vertical bands.** The columns, inside the margins. Content edges that do
  not land on a band edge are failing check 9.
- **Horizontal bands.** The module rows. Where a band crosses a column, that
  rectangle is one module, and its proportion is what you are looking at.
- **Hairlines.** The baseline, every unit. Text whose baselines wander between
  them is failing check 6.

## Per format

The overlay describes one format. To inspect a family, wrap the variable block
in the same media queries the grid uses, so the overlay changes when the grid
does. An overlay showing the desktop grid over a phone layout will report
failures that are not there.

```css
@media (max-width: 767px) {
  .raster {
    --raster-cols: 4;
    --raster-gutter: 16px;
    --raster-margin: 16px;
    --raster-max: none;
  }
}
```

## Honest limits

- The module rows start at the top of the viewport, not at the top of the
  content. They tell you the module height and proportion; they do not tell
  you that a specific card starts on a module boundary.
- The baseline layer is fixed to the viewport, so it does not scroll with the
  page. Read it against whatever is on screen, not across a scroll.
- Sub-pixel rendering makes the hairlines uneven at some zoom levels. That is
  the browser, not the grid.
- `position: fixed` means the overlay sits above everything except another
  fixed layer with a higher stacking context. If a modal covers it, toggle the
  overlay after the modal opens.
