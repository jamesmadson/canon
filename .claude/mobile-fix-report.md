# Mobile audit platform defects — fix report

Fixes applied against `.claude/mobile-audit-report.md` → "Platform defects" section, findings #1, #2, #4, #5, #6, #7, #8, #9, #10, #11. Findings #3/#12 (Grid — Off toggle) and Design & Judgment items were left untouched per instructions.

## #1 — Submit form 14px inputs → iOS zoom
`src/pages/submit.astro`: all 7 `<input>`/`<textarea>` elements now carry `text-base` (16px) alongside their existing classes. Labels remain `text-sm`.
- Measured (browser): `getComputedStyle(input).fontSize` → `"16px"` (was 14px). iOS Safari auto-zoom-on-focus threshold cleared.

## #2 — Nav links sub-44px tap targets
`src/layouts/BaseLayout.astro`: added `py-3` to the three nav anchors (Gallery, Submit, Newsletter). `py-3` (12px top+bottom) + `text-sm`'s 20px line-height = 44px exactly.
- Measured (browser): all three links → height 44px (was ~20px). No other styling changed.

## #4 — StructureMap file/folder links: dead-zone padding
`src/components/StructureMap.astro`, scoped `<style>` block only.
- `.node-row` given `position: relative` (was static).
- `a.node-label::before` changed from `inset: 0` to explicit negative insets (`top/bottom: -0.4375rem`, `left/right: -0.25rem`) matching `.node`'s own padding exactly — this pulls the row's padding into the link's hit area **without** reaching into an expanded `.children` list below (verified, see below).
- `.child-row` given `position: relative`; `a.child-label::before` added with `inset: 0` — since `.child-row` owns its padding directly, this cleanly fills its own padding box.
- No visual changes — both pseudo-elements are transparent overlays; only the tappable area changed.
- Verified in browser (`/skills/nothing-design/`):
  - `LICENSE` link: visible text height 20.5px → hit area now 34.5px (row height + node padding), matching the row's full visual footprint, exactly as the audit's fix note specified (not stretched further, since 33.5–34.5px was the row's own bound).
  - Confirmed no regression: `elementFromPoint` on the `components.md` nested child link (inside expanded `references/` folder) returns the child link itself, not the folder link's overlay. Probing points just below the folder row's `node-row` bottom edge (offsets 1px/3px) still resolve to the folder's `node-label`; by 6px/8px (children's margin-top) they resolve cleanly to `child-label` — no overlap/collision between the folder link's stretched hit area and its own expanded children.

## #5 — Submit button 36px → ≥44px
`src/pages/submit.astro`: button padding changed `py-2` → `py-3` (12px × 2 + 20px line-height = 44px).
- Measured (browser): `button.getBoundingClientRect().height` → `44`.

## #6 — FilterBar checkbox rows ~20px → toward 44px
`src/components/FilterBar.astro`: both checkbox `<label>` elements (Tools, Categories) gained `py-3`. Single-label-wraps-all pattern kept as-is (correct per audit).
- Measured (browser): checkbox label height → `44px` (was ~20px).

## #7 — aria-live on filter result state
`src/components/FilterBar.astro`: wrapped `#filter-count` and `#filter-empty` in a `<div aria-live="polite">`. Both the count text update and the empty-state visibility toggle now live inside the same announced region.
- Verified in browser: wrapper `aria-live` attribute → `"polite"`; wrapper contains `#filter-empty`.

## #8 — autocomplete on submit form
`src/pages/submit.astro`:
- `submitterName` → `autocomplete="name"`
- `submitterEmail` → `autocomplete="email"`
- `sourceUrl` → `autocomplete="url"`
- `skillName`, `tools`, `category`, `pitch` → `autocomplete="off"` (no matching standard token)
- Verified in browser: attributes read back as set.

## #9 — Skip to content link
`src/layouts/BaseLayout.astro`: added `<a href="#main">Skip to content</a>` as the first element in `<body>`, before `<header>`. Visually hidden via Tailwind `sr-only`, revealed on focus (`focus:not-sr-only focus:fixed ...`) styled with existing tokens (`border-rule-strong`, `bg-bg`, `text-ink`). `<main>` given `id="main"`.
- Verified in browser: link exists, text "Skip to content", `#main` present on `<main>`.

## #10 — theme-color meta
`src/layouts/BaseLayout.astro` `<head>`: added `<meta name="theme-color" content="#ffffff">` (matches `--color-bg`).
- Verified in browser: `meta[name="theme-color"]` content → `"#ffffff"`.

## #11 — Font preload
`src/layouts/BaseLayout.astro` `<head>`: added `<link rel="preload" href="/fonts/archivo/Archivo-400.woff2" as="font" type="font/woff2" crossorigin>` — only the 400 weight, per the report.
- Verified in browser: preload link present with correct href and `crossorigin` attribute.

## Not touched (explicitly out of scope)
- "Grid — Off" toggle (#3/#12) — pending product decision.
- FilterBar mobile layout order — pending design fork.
- Design & Judgment section items.

## Gate outputs

**`npx astro check`**
```
Result (30 files):
- 0 errors
- 0 warnings
- 0 hints
```

**`npm run build`**
```
20 page(s) built in 1.32s
[build] Complete!
```

**`npx vitest run`**
```
Test Files  7 passed (7)
     Tests  82 passed (82)
```

All three gates pass. Browser spot-checks against the dev server (`http://localhost:4321`) confirmed measured tap-target heights and attribute values as documented above.
