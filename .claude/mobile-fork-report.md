# Mobile UX fork implementation — Canon

Implements the three user-decided mobile UX changes from `.claude/mobile-audit-report.md`, building on the prior tap-target/a11y fix wave (commit 9012cf9). All three preserve desktop behavior exactly and stay fully monochrome.

## Change 1 — Mobile filter disclosure (`src/components/FilterBar.astro`)

**Decision implemented:** cards render first on mobile; filters live behind a collapsed "Filters" toggle. Desktop (lg+) sidebar is unchanged.

- Restructured the three flex children (`<button>`, `<aside id="filter-panel">`, results `<div>`) as direct siblings of the `flex flex-col lg:flex-row` container. On mobile this gives DOM/visual order: toggle → (filter panel, if open) → result count → cards. On desktop, `lg:order-1`/`lg:order-2` restores the original two-column sidebar layout (aside left, results right); the button carries `lg:hidden` so it drops out of desktop flow entirely.
- Toggle button: `<button type="button" id="filter-toggle" aria-expanded aria-controls="filter-panel" class="min-h-11 border border-rule-strong px-4 text-sm font-semibold lg:hidden">` — 44px min height, existing outline convention.
- `<aside id="filter-panel" class="hidden lg:order-1 lg:block ...">` — hidden by default, `lg:block` always shows it on desktop regardless of the `hidden` class.
- Script: click toggles `filter-panel`'s `hidden` class and the button's `aria-expanded`. `applyFilter()` now also updates the button's own text to `Filters · N` when N tools/categories are active, `Filters` otherwise — plain text, no color.
- `#filter-count`'s `aria-live="polite"` wrapper (from the prior fix wave) is untouched and still wraps both `#filter-count` and `#filter-empty`.

**Measured (375px mobile emulation):** Filters button renders directly under "All skills", tapping it inserts the panel between the button and "Showing N of N skills" (not scrolled below the 16 cards) — verified via `aria-expanded`/`classList` state changes and screenshot. Desktop (1280px) confirmed pixel-identical to the pre-change two-column layout via screenshot.

## Change 2 — Grid toggle: desktop-only, proper size (`src/layouts/BaseLayout.astro`)

- `#grid-toggle` class changed from `fixed bottom-5 right-5 z-10 border border-rule-strong bg-bg px-3.5 py-2 text-xs font-semibold tracking-wide text-ink-soft hover:text-ink` to add `hidden ... sm:flex` (hidden below `sm`, flex at `sm:` and up) and `min-h-11 items-center` (was `py-2` alone, which under-shot 44px at this font-size/line-height).
- Nothing else about the button (position, click handler, label, `aria-pressed`) changed.

**Measured:** `getBoundingClientRect()` on desktop (1280px) → 90.5×44px (was 90.5×34px). Confirmed `display: none` at mobile widths (375px) via `sm:` breakpoint — button never renders below 640px, so mobile users no longer see it or lose the previously-flagged overlap with card content.

## Change 3 — StructureMap tap-to-expand on touch (`src/components/StructureMap.astro`)

**Decision implemented:** desktop hover/focus-within reveal is byte-for-byte unchanged; touch devices get real `<button>` toggles per expandable row, collapsed by default.

- Each expandable row's `<span class="node-meta">…</span><span class="hint-badge">hover</span>` pair is now wrapped in a `<button type="button" class="node-toggle" aria-expanded="false" aria-label="…">`, containing `.node-meta` plus two hint spans (`.hint-hover` "hover", `.hint-tap` "tap") — CSS shows exactly one per device class. The button does **not** wrap the folder/file `<a>` links; it's a sibling positioned after them in the row.
- `.node-toggle` reuses the exact visual slot the old `.hint-badge` occupied (`margin-left: auto`, same row), reset to a bare, borderless, monochrome button (`font: inherit; color: inherit; background: none; border: none`).
- Hit-area: a `::after` pseudo-element expands the button's tap target by `-13px` top/bottom, `-10px` right, `-4px` left (the small left inset avoids overlapping the neighboring folder `<a>`'s own expanded hit box from the prior fix wave — confirmed no overlap by design, not just by luck: anchor expands `+4px` right, button expands `-4px` left, meeting exactly at the gap midpoint).
- `@media (hover: none)` reworked: no longer force-expands `.children` (`max-height: none`) — instead `.children` stays at its default collapsed state (`max-height: 0; opacity: 0`, unchanged base rule) until JS adds `.is-open`, which only has effect inside this same media block (`.children.is-open { max-height: 400px; opacity: 1 }`). Desktop's `.node:hover .children, .node:focus-within .children` rule is untouched and unconditional — it keeps applying regardless of the new class, and `.is-open` has zero visual effect on hover-capable devices since that rule only exists inside `@media (hover: none)`.
- Small inline `<script>` added (Astro renders it once, component is used once per page): finds all `.node-toggle:not([data-bound])`, marks each `data-bound="true"`, and binds a click handler that finds the sibling `.children` via `closest('.node')` + `:scope > .children`, toggles `.is-open`, and syncs `aria-expanded`. The `data-bound` guard is defensive per the task's request even though this component only renders once per page today.
- `prefers-reduced-motion` block is unchanged (still lists `.children` etc. with `transition: none`).

**Measured on `/skills/emil-design-eng/` (375px mobile emulation, `hover: none` confirmed via `matchMedia`):**
- Page height before interaction: **3065px** (down from ~4200px in the audit's always-expanded baseline).
- 11 `.node-toggle` buttons present; all `.children` start at `max-height: 0px` / not in the layout (`getBoundingClientRect().height === 0`).
- Tap → `aria-expanded` flips to `"true"`, `.children` gains `.is-open`, renders at its natural content height (verified 78px for a 3-subsection row) with the existing 0.3s transition.
- Tap again → collapses back, `aria-expanded` returns to `"false"`.
- Hint badge reads "tap" (uppercased via existing CSS `text-transform: uppercase`) on touch, confirmed `.hint-tap` computed `display: flex` / `.hint-hover` computed `display: none`.

**Measured on desktop (1280px, `hover: none` → `false`):**
- Hint badge reads "hover" (`.hint-hover` visible, `.hint-tap` `display: none`).
- Rows start collapsed (`max-height: 0px`) exactly as before.
- Real mouse hover over a row (`computer` tool hover action, not JS) expands `.children` via the untouched `:hover` CSS rule — screenshot-confirmed, no click required.

## Verification

1. `npx astro check` — 0 errors, 0 warnings, 0 hints.
2. `npm run build` — 20 pages built successfully.
3. `npx vitest run` — 82/82 tests passed.
4. Browser pane (dev server, tab "seed"):
   - `/skills` mobile: cards appear before filters; toggle opens/closes panel between button and result count.
   - `/skills` desktop (1280px): sidebar layout pixel-identical to before, no toggle button rendered.
   - `/skills/emil-design-eng/` mobile: sections collapsed by default, tap expands/collapses, page height 3065px (vs ~4200px baseline).
   - `/skills/emil-design-eng/` desktop: hover still expands with no click, "hover" hint badge, grid toggle visible at 44px height.

## Concerns / follow-ups

- The `.node-toggle` hit-area pseudo-element's left inset (`-4px`) is intentionally smaller than its other three sides to avoid overlapping the adjacent folder link's own expanded hit box (`+4px`). This is a tight but non-overlapping fit — verified by inspection, not by an automated test, since there's no test coverage for CSS hit-area geometry in this repo's vitest suite.
- No automated/vitest coverage was added for the new client-side toggle scripts (`FilterBar` toggle, `StructureMap` tap-to-expand) — the existing test suite covers only `src/lib/*` pure functions and content/schema, not component-level DOM behavior. Verification here was manual (browser pane), consistent with how the prior fix wave was validated per the audit report.
