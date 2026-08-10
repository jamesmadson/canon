# Monochrome Retheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Canon to a type-led monochrome system — white ground, black ink, cool-neutral grays — with orange appearing exclusively on hover/focus states.

**Architecture:** One token rewrite in `global.css` does most of the work (every component reads tokens); four surface files then re-point the classes that referenced deleted tokens or used orange at rest. No structural/layout changes except deleting the two colored hero bands. No new files, no new dependencies, no schema or content changes.

**Tech Stack:** Astro 5 + Tailwind CSS v4 (`@theme` CSS-first tokens) + one scoped `<style>` block (StructureMap).

## Global Constraints

- **The orange rule (from spec):** `--color-accent-orange` appears in **zero resting styles**. It is allowed only in `:hover`, `group-hover`, and `:focus-visible` styles. Any resting use is a defect.
- Deleted tokens: `--color-paper`, `--color-tile`, `--color-accent-yellow`. After Task 5's grep, `grep -rn "paper\|tile\|accent-yellow" src/ --include="*.astro" --include="*.css"` must return nothing.
- Exact new token values (spec-locked): `--color-bg: oklch(100% 0 0)`, `--color-ink: oklch(20.02% 0 0)` (unchanged), `--color-ink-soft: oklch(42% 0 0)`, `--color-surface: oklch(92% 0.003 210)`, `--color-rule: oklch(85% 0.005 210)`, `--color-rule-strong: oklch(68% 0.005 210)`, `--color-accent-orange: oklch(56% 0.185 40)` (unchanged).
- Intermediate tasks may leave pages visually half-migrated (e.g. a class referencing a deleted token silently renders as nothing in Tailwind v4 — no build error). That is expected between Tasks 1–4; only Task 5 requires the finished state.
- Reference spec: `docs/superpowers/specs/2026-08-10-monochrome-retheme-design.md`.
- No automated tests change: this is styling only. Each task's gate is `npx astro check` (0 errors) + `npm run build` (success). Task 5 also runs `npx vitest run` (all 67 must still pass, untouched).

---

### Task 1: Token rewrite in `global.css`

**Files:**
- Modify: `src/styles/global.css:42-53` (the `@theme` block only; fonts and `.grid-overlay` rules untouched)

**Interfaces:**
- Produces: Tailwind utilities `bg-bg`, `bg-surface`, `text-ink`, `text-ink-soft`, `border-rule`, `border-rule-strong`, `text-accent-orange`, `bg-accent-orange` and the CSS vars `--color-bg`, `--color-surface`, etc. consumed by Tasks 2–4. Utilities `bg-paper`, `bg-tile`, `bg-accent-yellow` cease to exist after this task.

- [ ] **Step 1: Replace the `@theme` color tokens**

Change:

```css
@theme {
  --font-sans: "Archivo", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --color-paper: oklch(83.21% 0.0112 95.19);
  --color-tile: oklch(100% 0 0);
  --color-ink: oklch(20.02% 0 0);
  --color-ink-soft: oklch(41.83% 0.0097 106.81);
  --color-rule: oklch(75.92% 0.0142 97.5);
  --color-rule-strong: oklch(53.72% 0.0139 96.58);
  --color-accent-orange: oklch(56% 0.185 40);
  --color-accent-yellow: oklch(76.53% 0.138 80.38);
}
```

to:

```css
@theme {
  --font-sans: "Archivo", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --color-bg: oklch(100% 0 0);
  --color-ink: oklch(20.02% 0 0);
  --color-ink-soft: oklch(42% 0 0);
  --color-surface: oklch(92% 0.003 210);
  --color-rule: oklch(85% 0.005 210);
  --color-rule-strong: oklch(68% 0.005 210);
  --color-accent-orange: oklch(56% 0.185 40);
}
```

- [ ] **Step 2: Verify**

Run: `npx astro check` — Expected: 0 errors.
Run: `npm run build` — Expected: success. (Pages referencing `bg-paper`/`bg-tile` now render those classes as nothing — expected mid-migration state, not a failure.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "Collapse palette to monochrome tokens + interaction-only orange"
```

---

### Task 2: Chrome and index surfaces (BaseLayout, homepage hero, SkillCard)

**Files:**
- Modify: `src/layouts/BaseLayout.astro:23-47`
- Modify: `src/pages/index.astro:12`
- Modify: `src/components/SkillCard.astro:14-17`

**Interfaces:**
- Consumes: Task 1's tokens/utilities (`bg-bg`, `bg-surface`, `border-rule`).

- [ ] **Step 1: BaseLayout — white chrome, interactive nav**

In `src/layouts/BaseLayout.astro`, change the body tag:

```astro
<body class="bg-tile font-sans font-medium text-ink antialiased">
```

to:

```astro
<body class="bg-bg font-sans font-medium text-ink antialiased">
```

Change the header and nav block:

```astro
<header class="border-b border-rule-strong bg-paper">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
    <a href="/" class="text-xl font-semibold">Canon</a>
    <nav class="flex gap-6 text-sm font-semibold">
      <a href="/skills">Gallery</a>
      <a href="/submit">Submit</a>
      <a href="/newsletter">Newsletter</a>
    </nav>
  </div>
</header>
```

to:

```astro
<header class="border-b border-rule">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
    <a href="/" class="text-xl font-semibold">Canon</a>
    <nav class="flex gap-6 text-sm font-semibold">
      <a href="/skills" class="text-ink-soft transition-colors hover:text-accent-orange focus-visible:text-accent-orange">Gallery</a>
      <a href="/submit" class="text-ink-soft transition-colors hover:text-accent-orange focus-visible:text-accent-orange">Submit</a>
      <a href="/newsletter" class="text-ink-soft transition-colors hover:text-accent-orange focus-visible:text-accent-orange">Newsletter</a>
    </nav>
  </div>
</header>
```

Change the grid-toggle button's `bg-tile` to `bg-bg` (rest of its classes unchanged):

```astro
class="fixed bottom-5 right-5 z-10 border border-rule-strong bg-bg px-3.5 py-2 text-xs font-semibold tracking-wide text-ink-soft hover:text-ink"
```

- [ ] **Step 2: Homepage hero — drop the band**

In `src/pages/index.astro`, change:

```astro
<section class="-mx-6 mb-8 bg-paper px-6 py-10 sm:py-12">
```

to:

```astro
<section class="mb-8 py-10 sm:py-12">
```

(The full-bleed negative margin and horizontal padding existed only to paint the greige band edge-to-edge; on white they're pointless.)

- [ ] **Step 3: SkillCard — Framer-pattern hierarchy, orange only on hover**

In `src/components/SkillCard.astro`, change:

```astro
<a href={`/skills/${slug}/`} class="group flex flex-col gap-2 bg-tile p-4 hover:bg-paper/40">
```

to:

```astro
<a href={`/skills/${slug}/`} class="group flex flex-col gap-2 bg-bg p-4 hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-accent-orange">
```

and change the name line:

```astro
<h3 class="text-base font-semibold text-accent-orange">{name}</h3>
```

to:

```astro
<h3 class="text-base font-semibold text-ink transition-colors group-hover:text-accent-orange">{name}</h3>
```

- [ ] **Step 4: Verify**

Run: `npx astro check` — Expected: 0 errors.
Run: `npm run build` — Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro src/components/SkillCard.astro
git commit -m "Retheme chrome and index surfaces to monochrome"
```

---

### Task 3: Skill detail page — Snøhetta hero, monochrome matrix

**Files:**
- Modify: `src/pages/skills/[slug].astro:36-70`

**Interfaces:**
- Consumes: Task 1's tokens.

- [ ] **Step 1: Replace the orange hero slab**

Change the hero block (starts `<div class="-mx-6 mb-10 bg-accent-orange ...`, ends with the matrix's closing `</div>` two lines before the two-column grid):

```astro
<div class="-mx-6 mb-10 bg-accent-orange px-6 py-12 text-white sm:px-10 sm:py-16">
  <span class="inline-block bg-white px-2.5 py-1 text-xs font-semibold text-ink">
    {CATEGORY_META[categories[0]].label}
  </span>
  <h1 class="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">{name}</h1>
  <div class="mt-10 grid max-w-md grid-cols-8 gap-1">
    {TOOL_VALUES.map((toolValue) => {
      const active = tools.includes(toolValue);
      return (
        <div
          class={
            active
              ? 'flex aspect-square items-center justify-center border border-white bg-white'
              : 'flex aspect-square items-center justify-center border border-white/40'
          }
        >
          <span class={active ? 'text-[10px] font-semibold uppercase text-accent-orange' : 'text-[10px] font-semibold uppercase text-white/70'}>
            {TOOL_META[toolValue].abbr}
          </span>
        </div>
      );
    })}
  </div>
</div>
```

to:

```astro
<div class="mb-12 pt-10 sm:pt-14">
  <span class="inline-block border border-rule-strong px-2.5 py-1 text-xs font-semibold text-ink">
    {CATEGORY_META[categories[0]].label}
  </span>
  <h1 class="mt-6 max-w-3xl text-5xl font-black leading-tight sm:text-6xl">{name}</h1>
  <div class="mt-10 grid max-w-md grid-cols-8 gap-1">
    {TOOL_VALUES.map((toolValue) => {
      const active = tools.includes(toolValue);
      return (
        <div
          class={
            active
              ? 'flex aspect-square items-center justify-center bg-ink'
              : 'flex aspect-square items-center justify-center border border-rule-strong'
          }
        >
          <span class={active ? 'text-[10px] font-semibold uppercase text-white' : 'text-[10px] font-semibold uppercase text-ink-soft'}>
            {TOOL_META[toolValue].abbr}
          </span>
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Prose links — ink at rest, orange on hover**

Change:

```astro
<article class="prose prose-stone max-w-none prose-headings:text-ink prose-p:text-ink-soft prose-a:text-accent-orange prose-strong:text-ink">
```

to:

```astro
<article class="prose prose-stone max-w-none prose-headings:text-ink prose-p:text-ink-soft prose-a:text-ink hover:prose-a:text-accent-orange prose-strong:text-ink">
```

- [ ] **Step 3: Superseded banner — surface gray, not yellow**

Change:

```astro
<p class="bg-accent-yellow/20 px-3 py-2 font-medium text-ink">
```

to:

```astro
<p class="bg-surface px-3 py-2 font-medium text-ink">
```

- [ ] **Step 4: Verify**

Run: `npx astro check` — Expected: 0 errors.
Run: `npm run build` — Expected: success.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/skills/[slug].astro"
git commit -m "Replace orange detail hero with large-type monochrome treatment"
```

---

### Task 4: StructureMap — monochrome at rest, orange on touch

**Files:**
- Modify: `src/components/StructureMap.astro` (scoped `<style>` block only; the template markup is untouched)

**Interfaces:**
- Consumes: Task 1's CSS vars (`--color-bg`, `--color-surface`, `--color-ink`).

All edits are inside the `<style>` block. The hover rules that turn **links** orange (`a.node-label:hover` at ~line 256, `a.child-label:hover` at ~line 338) are correct under the new rule — **do not touch them**. The edits below remove orange from *resting* styles only.

- [ ] **Step 1: Hub card — outlined white, ink text**

Change:

```css
.hub {
  background: var(--color-accent-orange);
  color: white;
  padding: 1.25rem 1.125rem;
  border-radius: 3px;
}
```

to:

```css
.hub {
  background: var(--color-bg);
  border: 1px solid var(--color-rule-strong);
  color: var(--color-ink);
  padding: 1.25rem 1.125rem;
  border-radius: 3px;
}
```

and change the tagline rule:

```css
.hub-tagline {
  font-size: 0.75rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
  margin: 0;
}
```

to:

```css
.hub-tagline {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-ink-soft);
  margin: 0;
}
```

Also add a color to the mono filename so it reads as secondary on white — change:

```css
.hub-file {
  display: block;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
}
```

to:

```css
.hub-file {
  display: block;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
  color: var(--color-ink-soft);
}
```

- [ ] **Step 2: Hover washes — orange tint → surface gray**

Three rules use `color-mix(in oklch, var(--color-accent-orange) 8%, transparent)` as a background (`.node:hover` ~line 190, `.node-meta` ~line 264, `.child-row:hover` ~line 316). Replace the background value in **all three** with `var(--color-surface)`:

```css
.node:hover {
  background-color: var(--color-surface);
}
```

```css
.node-meta {
  font-size: 0.65625rem;
  color: var(--color-ink-soft);
  background: var(--color-surface);
  padding: 1px 6px;
  border-radius: 20px;
}
```

```css
.child-row:hover {
  background-color: var(--color-surface);
}
```

- [ ] **Step 3: Section glyph — ink, not orange**

Change:

```css
.glyph.section {
  border-radius: 50%;
  border-color: var(--color-accent-orange);
  background: var(--color-accent-orange);
}
```

to:

```css
.glyph.section {
  border-radius: 50%;
  border-color: var(--color-ink);
  background: var(--color-ink);
}
```

- [ ] **Step 4: Hint badge — gray pill, no resting orange**

Change:

```css
.hint-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.59375rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent-orange);
  margin-left: auto;
}
```

to:

```css
.hint-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.59375rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink-soft);
  background: var(--color-surface);
  padding: 1px 6px;
  border-radius: 20px;
  margin-left: auto;
}
```

- [ ] **Step 5: Legend — surface fill**

Change the legend's `background: var(--color-paper);` line to `background: var(--color-surface);` (its `border: 1px solid var(--color-rule);` stays).

- [ ] **Step 6: Keyboard focus — orange, matching hover**

Extend the two link-hover rules to cover `:focus-visible`. Change:

```css
a.node-label:hover {
  color: var(--color-accent-orange);
  border-color: var(--color-accent-orange);
}
```

to:

```css
a.node-label:hover,
a.node-label:focus-visible {
  color: var(--color-accent-orange);
  border-color: var(--color-accent-orange);
}
```

and change:

```css
a.child-label:hover {
  color: var(--color-accent-orange);
}
```

to:

```css
a.child-label:hover,
a.child-label:focus-visible {
  color: var(--color-accent-orange);
}
```

- [ ] **Step 7: Verify no resting orange remains in the component**

Run: `grep -n "accent-orange" src/components/StructureMap.astro`
Expected: matches ONLY inside `:hover`/`:focus-visible` rule blocks (the two link rules from Step 6). Any other match is an unfinished edit.

Run: `npx astro check` — Expected: 0 errors.
Run: `npm run build` — Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/components/StructureMap.astro
git commit -m "Retheme StructureMap: monochrome at rest, orange on interaction"
```

---

### Task 5: Migration sweep and full verification

**Files:**
- Modify: none expected — this task verifies and only edits if the sweep finds a straggler.

- [ ] **Step 1: Dead-token sweep**

Run: `grep -rn "paper\|tile\|accent-yellow" src/ --include="*.astro" --include="*.css"`
Expected: no output. If anything appears, re-point it per the spec's surface rules (white ground → `bg-bg`, tinted fills → `bg-surface`) and include it in this task's commit.

Run: `grep -rn "accent-orange" src/ --include="*.astro" --include="*.css"`
Expected: every match is a `hover:`, `group-hover:`, `focus-visible:` utility or inside a `:hover`/`:focus-visible` CSS rule — plus the token definition itself in `global.css`. Any resting-style match is a defect to fix now.

- [ ] **Step 2: Full gates**

Run: `npx vitest run` — Expected: 67/67 passing (styling changes must not touch tests).
Run: `npx astro check` — Expected: 0 errors.
Run: `npm run build` — Expected: success, 15 pages.

- [ ] **Step 3: Commit (only if Step 1 found stragglers)**

```bash
git add -A src/
git commit -m "Sweep remaining dead-token references"
```

Visual verification (homepage, /skills, three detail pages, submit, newsletter — hover and focus checks per the spec's Testing section) is performed by the controller in the Browser pane after this task, not by the implementer.
