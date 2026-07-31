# Grid Direction Retheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's live visual theme with "Direction B" — the Swiss-modernist (Aicher / Müller-Brockmann) grid theme validated in a mood-board exploration — across every page, without deleting the old theme's dependencies or design-spec text.

**Architecture:** Same Astro + Tailwind v4 CSS-token architecture already in place. Retheming is almost entirely a `src/styles/global.css` token swap (color/font values) plus targeted component/page edits for the pieces that need new structure, not just new colors: `ToolBadge` (outline, not filled pills), `SkillCard` (typography only, no preview image), and the skill detail page (new solid-color hero with a coverage matrix). Fonts move from Fraunces+Inter to a single self-hosted Geist family (Sans + Mono), served from `public/fonts/` the same way `public/previews/*.svg` already is.

**Tech Stack:** Same as the existing project (Astro 5, Tailwind v4, TypeScript strict). New dependency: `geist` (Vercel's OFL-licensed font package, used only as a source to copy static `.woff2` files from — not imported as a JS module).

## Global Constraints

- Do NOT uninstall `@fontsource/fraunces` or `@fontsource/inter` from `package.json`, and do NOT delete the current design spec's description of the old theme. The user wants the old theme's code kept available and will decide separately, later, whether to strip it out before launch — this plan only stops *using* it.
- Palette (exact values): `--color-paper: #cac8c0` (page ground), `--color-tile: #ffffff` (card/panel surfaces), `--color-ink: #161616`, `--color-ink-soft: #55554f`, `--color-rule: #b3b1a7`, `--color-rule-strong: #8c8a80`, `--color-accent-blue: #2c7fb8`, `--color-accent-orange: #d8501f`, `--color-accent-yellow: #e0a83a`.
- Type: one family, Geist, for everything except literal code — no display/body font pairing. Body text and labels are medium weight (500) at minimum; headings are semibold-to-black (600–900). Geist Mono is not used anywhere in this pass (nothing in the current content is a code snippet) — the font is installed and available for later, not wired into any page.
- No rounded corners anywhere in the retheme (buttons, inputs, cards, chips all square) — matches the Grid Systems / Aicher references, a deliberate departure from the old theme's `rounded-md`.
- Construction grid: a faint 6-column rule overlay across `<main>`, hidden by default, toggled by a small fixed button in `BaseLayout`. Opacity when on: `.28` — do not make it more prominent than that (an earlier, stronger version was explicitly rejected as "too much").
- Skill detail page hero: solid `--color-accent-blue` fill, white heading text, a black-on-white category chip, and an 8-cell tool-coverage matrix (filled cell = this skill lists that tool). This is the one place per skill page color appears as a large fill; everywhere else color stays a small flag (a badge, a rule, a chip).
- `SkillCard` drops the preview-image render entirely in favor of a zero-padded index number (`01`, `02`, ...) passed in by the parent page — every caller must now pass an `index` prop.
- `ToolBadge` drops per-tool fill colors — every badge renders as an outlined, uppercase, ink-colored label. `TOOL_META`'s `color` field stays in the data (unused for now) since deleting data isn't part of this task.

---

### Task 1: Geist fonts + global theme tokens + grid-overlay CSS

**Files:**
- Modify: `package.json` (add `geist` dependency)
- Create: `public/fonts/geist/Geist-Regular.woff2`, `Geist-SemiBold.woff2`, `Geist-Black.woff2`, `GeistMono-Regular.woff2` (copied binary files, not authored)
- Modify: `src/styles/global.css`
- Modify: `src/lib/toolMeta.ts` (add `abbr` field to every entry)

**Interfaces:**
- Consumes: nothing new.
- Produces: Tailwind utilities `bg-paper`, `bg-tile`, `text-ink`, `text-ink-soft`, `border-rule`, `border-rule-strong`, `bg-accent-blue`/`text-accent-blue` (and `-orange`/`-yellow` variants), `font-sans` (Geist), `font-mono` (Geist Mono) — consumed by every later task. `.grid-overlay` CSS class and `html.grid-visible` toggle hook — consumed by Task 2. `TOOL_META[tool].abbr` — consumed by Task 6.

- [ ] **Step 1: Install the `geist` package**

Run: `npm install geist`
Expected: exits 0, adds `geist` to `package.json` dependencies.

- [ ] **Step 2: Copy the four font files this project needs into `public/fonts/geist/`**

Run:
```bash
mkdir -p public/fonts/geist
cp node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2 public/fonts/geist/
cp node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2 public/fonts/geist/
cp node_modules/geist/dist/fonts/geist-sans/Geist-Black.woff2 public/fonts/geist/
cp node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2 public/fonts/geist/
ls -la public/fonts/geist/
```
Expected: `ls` shows all 4 `.woff2` files, each roughly 25–30KB.

- [ ] **Step 3: Add `abbr` to every `TOOL_META` entry in `src/lib/toolMeta.ts`**

Replace the file's contents with:

```ts
export const TOOL_META: Record<string, { label: string; color: string; abbr: string }> = {
  claude: { label: 'Claude', color: '#c1666b', abbr: 'CL' },
  'claude-code': { label: 'Claude Code', color: '#a65a6e', abbr: 'CC' },
  cursor: { label: 'Cursor', color: '#3b4252', abbr: 'CU' },
  codex: { label: 'Codex', color: '#2e86ab', abbr: 'CX' },
  copilot: { label: 'Copilot', color: '#1b998b', abbr: 'CP' },
  figma: { label: 'Figma', color: '#e1b16a', abbr: 'FG' },
  miro: { label: 'Miro', color: '#f2c14e', abbr: 'MR' },
  generic: { label: 'Any agent', color: '#8d99ae', abbr: 'GN' },
};
```

- [ ] **Step 4: Replace `src/styles/global.css` entirely**

```css
@import "tailwindcss" source(none);
@source "../**/*.{astro,ts,mdx}";
@plugin "@tailwindcss/typography";

@font-face {
  font-family: "Geist";
  font-weight: 400;
  src: url("/fonts/geist/Geist-Regular.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Geist";
  font-weight: 600;
  src: url("/fonts/geist/Geist-SemiBold.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Geist";
  font-weight: 900;
  src: url("/fonts/geist/Geist-Black.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  font-weight: 400;
  src: url("/fonts/geist/GeistMono-Regular.woff2") format("woff2");
  font-display: swap;
}

@theme {
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --color-paper: #cac8c0;
  --color-tile: #ffffff;
  --color-ink: #161616;
  --color-ink-soft: #55554f;
  --color-rule: #b3b1a7;
  --color-rule-strong: #8c8a80;
  --color-accent-blue: #2c7fb8;
  --color-accent-orange: #d8501f;
  --color-accent-yellow: #e0a83a;
}

/* construction grid — hidden by default, faint when toggled on (see BaseLayout) */
.grid-overlay {
  position: relative;
}
.grid-overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to right,
    var(--color-rule) 0,
    var(--color-rule) 1px,
    transparent 1px,
    transparent calc((100% - 100px) / 6 + 20px)
  );
  opacity: 0;
  transition: opacity 0.12s ease;
  pointer-events: none;
}
html.grid-visible .grid-overlay::before {
  opacity: 0.28;
}
```

Note: this file no longer defines `--font-serif` or `--color-accent` (the old terracotta token). Their removal here is required to make the new theme render — this is not the "unneeded things" cleanup the user wants asked about separately; it's simply that a CSS custom property can't hold two different active values at once. The old `@fontsource/fraunces`/`@fontsource/inter` packages stay installed and unused per the Global Constraints.

- [ ] **Step 5: Verify the project still builds**

Run: `npm run build`
Expected: exits 0. (Pages will look broken/unstyled in places until later tasks update markup — that's expected at this checkpoint; this step only confirms the CSS itself is valid and the font files resolve without a 404 breaking the build.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public/fonts/geist src/styles/global.css src/lib/toolMeta.ts
git commit -m "Add Geist fonts and Direction B theme tokens"
```

---

### Task 2: `BaseLayout.astro` — new chrome, grid-overlay wrapper, grid toggle

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: theme tokens and `.grid-overlay`/`grid-visible` CSS from Task 1.
- Produces: no interface change (`Props: { title: string; description?: string }` unchanged) — every page picks up the new chrome automatically.

- [ ] **Step 1: Replace `src/layouts/BaseLayout.astro` entirely**

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const {
  title,
  description = 'A curated gallery of design and design-engineering skills for AI agents.',
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · Design Skills</title>
    <meta name="description" content={description} />
  </head>
  <body class="bg-paper font-sans font-medium text-ink antialiased">
    <header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
      <a href="/" class="text-xl font-semibold">Design Skills</a>
      <nav class="flex gap-6 text-sm font-semibold">
        <a href="/skills">Gallery</a>
        <a href="/submit">Submit</a>
        <a href="/newsletter">Newsletter</a>
      </nav>
    </header>
    <main class="grid-overlay mx-auto max-w-6xl px-6 pb-24">
      <slot />
    </main>
    <footer class="mx-auto max-w-6xl px-6 py-12 text-sm font-medium text-ink-soft">
      <p>A hand-picked gallery of design and design-engineering skills.</p>
    </footer>
    <button
      type="button"
      id="grid-toggle"
      class="fixed bottom-5 right-5 z-10 border border-rule-strong bg-tile px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-soft hover:text-ink"
      aria-pressed="false"
    >
      Grid — Off
    </button>
  </body>
</html>

<script>
  const btn = document.getElementById('grid-toggle') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const on = document.documentElement.classList.toggle('grid-visible');
    btn.textContent = `Grid — ${on ? 'On' : 'Off'}`;
    btn.setAttribute('aria-pressed', String(on));
  });
</script>
```

- [ ] **Step 2: Build and verify the font loads and the toggle button is present**

Run: `npm run build && grep -o 'Grid — Off' dist/index.html`
Expected: exits 0, prints `Grid — Off`.

- [ ] **Step 3: Manually verify the grid toggle works**

Run: `npm run preview` (in the background), open `http://localhost:4321/` in a browser, click the "Grid — Off" button bottom-right. Confirm: label changes to "Grid — On", faint vertical column rules appear across the page, clicking again removes them and reverts the label. Stop the preview server afterward.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Retheme BaseLayout: Geist chrome, grid-overlay toggle"
```

---

### Task 3: `ToolBadge.astro` — outline style, no fill color

**Files:**
- Modify: `src/components/ToolBadge.astro`

**Interfaces:**
- Consumes: `TOOL_META` (Task 1, now includes `abbr` — unused by this component, fine).
- Produces: no prop-shape change (`Props: { tool: string }` unchanged).

- [ ] **Step 1: Replace `src/components/ToolBadge.astro` entirely**

```astro
---
import { TOOL_META } from '../lib/toolMeta';

interface Props {
  tool: string;
}

const { tool } = Astro.props;
const meta = TOOL_META[tool] ?? TOOL_META.generic;
---

<span class="inline-flex items-center border border-rule-strong px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
  {meta.label}
</span>
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx astro check`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolBadge.astro
git commit -m "Retheme ToolBadge: outlined labels, no per-tool fill color"
```

---

### Task 4: `SkillCard.astro` — typography only, index number, no preview image

**Files:**
- Modify: `src/components/SkillCard.astro`

**Interfaces:**
- Consumes: `ToolBadge` (Task 3).
- Produces: `Props: { skill: CollectionEntry<'skills'>; index: number }` — the `index` prop is new and required. Tasks 5 and 6's page/component callers must pass it or the build will fail type-checking.

- [ ] **Step 1: Replace `src/components/SkillCard.astro` entirely**

```astro
---
import ToolBadge from './ToolBadge.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  skill: CollectionEntry<'skills'>;
  index: number;
}

const { skill, index } = Astro.props;
const { name, tagline, tools, rating, slug } = skill.data;
---

<a href={`/skills/${slug}/`} class="group flex flex-col gap-3">
  <span class="text-xs font-semibold text-ink-soft">{String(index).padStart(2, '0')}</span>
  <div class="flex flex-col gap-1">
    <h3 class="text-lg font-semibold text-ink">{name}</h3>
    <p class="text-sm font-medium text-ink-soft">{tagline}</p>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    {tools.map((tool) => <ToolBadge tool={tool} />)}
    <span class="ml-auto text-xs font-medium text-ink-soft" aria-label={`Rated ${rating} out of 5`}>
      {'●'.repeat(rating)}{'○'.repeat(5 - rating)}
    </span>
  </div>
</a>
```

Note: this deliberately drops the `<img src={previewAssets[0]}>` block — per the Global Constraints, cards are typography-only in this direction. `previewAssets` stays in the schema and content files untouched; this component simply stops reading it.

- [ ] **Step 2: Verify the project type-checks**

Run: `npx astro check`
Expected: at this checkpoint, this WILL show errors — every existing caller (`index.astro`, `FilterBar.astro`) still calls `<SkillCard skill={skill} />` without the new required `index` prop. That's expected; Tasks 5 and 6 fix the callers. Confirm the errors are specifically about the missing `index` prop on `SkillCard` usages, not something else.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillCard.astro
git commit -m "Retheme SkillCard: typography-only, index number, no preview image"
```

---

### Task 5: Homepage, `/skills` page, and `FilterBar` — apply theme, pass `index`

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/skills/index.astro`
- Modify: `src/components/FilterBar.astro`

**Interfaces:**
- Consumes: `SkillCard` with its new `Props: { skill, index }` shape (Task 4).
- Produces: fixes the type errors Task 4 introduced; no new interface.

- [ ] **Step 1: Replace `src/pages/index.astro` entirely**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import SkillCard from '../components/SkillCard.astro';

const allSkills = await getCollection('skills', ({ data }) => data.status !== 'archived');
const sorted = [...allSkills].sort((a, b) => b.data.addedDate.valueOf() - a.data.addedDate.valueOf());
const featured = sorted.filter((s) => s.data.featured).slice(0, 5);
---

<BaseLayout title="Home">
  <section class="py-16 sm:py-24">
    <h1 class="max-w-2xl text-5xl font-black leading-tight sm:text-6xl">
      A curated gallery of design skills for AI agents.
    </h1>
    <p class="mt-6 max-w-xl text-lg font-medium text-ink-soft">
      Hand-picked SKILL.md files and design-tool instructions — Sidebar.io meets an
      awesome-list, not a scraped registry.
    </p>
  </section>

  <section class="mb-20">
    <h2 class="mb-6 text-2xl font-bold">This month's picks</h2>
    <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {featured.map((skill, i) => <SkillCard skill={skill} index={i + 1} />)}
    </div>
  </section>

  <section>
    <h2 class="mb-6 text-2xl font-bold">All skills</h2>
    <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((skill, i) => <SkillCard skill={skill} index={i + 1} />)}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Replace `src/pages/skills/index.astro` entirely**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import FilterBar from '../../components/FilterBar.astro';

const allSkills = await getCollection('skills', ({ data }) => data.status !== 'archived');
const sorted = [...allSkills].sort((a, b) => b.data.addedDate.valueOf() - a.data.addedDate.valueOf());
---

<BaseLayout title="Gallery" description="The full gallery of design and design-engineering skills.">
  <h1 class="mb-10 text-4xl font-black">All skills</h1>
  <FilterBar skills={sorted} />
</BaseLayout>
```

- [ ] **Step 3: Update `src/components/FilterBar.astro`**

Change the two `<legend>` elements' class from `text-stone-500` to `text-ink-soft` (both occurrences), and change the `SkillCard` call inside the `skills.map(...)` block from:

```astro
            <SkillCard skill={skill} />
```

to:

```astro
            <SkillCard skill={skill} index={i + 1} />
```

...which requires changing the map callback signature two lines above it from `{skills.map((skill) => (` to `{skills.map((skill, i) => (`.

Also change `#filter-count`/`#filter-empty` paragraph classes from `text-stone-500` to `text-ink-soft`, and `text-sm font-medium` stays as-is (medium is already the new baseline weight).

- [ ] **Step 4: Verify the project type-checks and builds**

Run: `npx astro check && npm run build`
Expected: both exit 0. The `index` prop errors from Task 4 are gone.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/pages/skills/index.astro src/components/FilterBar.astro
git commit -m "Retheme homepage, gallery page, and FilterBar; wire SkillCard index prop"
```

---

### Task 6: Skill detail page — colored hero + tool-coverage matrix

**Files:**
- Modify: `src/pages/skills/[slug].astro`

**Interfaces:**
- Consumes: `TOOL_VALUES` from `src/content/skillSchema.ts` (Task 2 of the original build), `TOOL_META[...].abbr` (Task 1 of this plan), `CATEGORY_META` (existing).
- Produces: no interface change — this page has no props consumed elsewhere.

- [ ] **Step 1: Replace `src/pages/skills/[slug].astro` entirely**

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ToolBadge from '../../components/ToolBadge.astro';
import { CATEGORY_META } from '../../lib/categoryMeta';
import { TOOL_META } from '../../lib/toolMeta';
import { TOOL_VALUES } from '../../content/skillSchema';

export async function getStaticPaths() {
  const skills = await getCollection('skills');
  return skills.map((entry) => ({
    params: { slug: entry.data.slug },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
const {
  name,
  tagline,
  tools,
  categories,
  rating,
  sourceUrl,
  sourceAuthor,
  lastVerified,
  status,
} = entry.data;
---

<BaseLayout title={name} description={tagline}>
  <div class="-mx-6 mb-10 bg-accent-blue px-6 py-12 text-white sm:px-10 sm:py-16">
    <span class="inline-block bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
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
            <span class={active ? 'text-[8px] font-semibold uppercase text-accent-blue' : 'text-[8px] font-semibold uppercase text-white/70'}>
              {TOOL_META[toolValue].abbr}
            </span>
          </div>
        );
      })}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_1fr]">
    <div>
      <p class="mb-8 text-lg font-medium text-ink-soft">{tagline}</p>
      <article class="prose prose-stone max-w-none prose-headings:text-ink prose-p:text-ink-soft prose-a:text-accent-blue prose-strong:text-ink">
        <Content />
      </article>
    </div>
    <aside class="flex flex-col gap-6 text-sm">
      {status === 'superseded' && (
        <p class="bg-accent-yellow/20 px-3 py-2 font-medium text-ink">
          This skill has been superseded by a newer entry.
        </p>
      )}
      <div>
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Works with</h2>
        <div class="flex flex-wrap gap-2">
          {tools.map((tool) => <ToolBadge tool={tool} />)}
        </div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Categories</h2>
        <div class="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span class="inline-flex items-center border border-rule-strong px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
              {CATEGORY_META[category].label}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Rating</h2>
        <p aria-label={`Rated ${rating} out of 5`}>{'●'.repeat(rating)}{'○'.repeat(5 - rating)}</p>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Source</h2>
        <p><a href={sourceUrl} class="underline">{sourceAuthor}</a></p>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Last verified</h2>
        <p class="font-medium">{lastVerified.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>
      </div>
    </aside>
  </div>
</BaseLayout>
```

Note: `categories[0]` is safe without an empty-check — the schema requires `categories: z.array(...).min(1)`, so every entry has at least one.

- [ ] **Step 2: Build and verify the hero and matrix render for a real entry**

Run: `npm run build && grep -c 'aspect-square items-center justify-center border border-white bg-white' dist/skills/frontend-design/index.html`
Expected: exits 0. Frontend Design's `tools: [claude, claude-code, generic]` (3 of 8) means the count should be `3`.

- [ ] **Step 3: Spot-check the hero heading and category chip render**

Run: `grep -o '<h1[^>]*>[^<]*</h1>' dist/skills/frontend-design/index.html`
Expected: `<h1 class="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">Frontend Design</h1>`

- [ ] **Step 4: Commit**

```bash
git add "src/pages/skills/[slug].astro"
git commit -m "Retheme skill detail page: colored hero, tool-coverage matrix"
```

---

### Task 7: `/submit` and `/newsletter` pages — apply theme

**Files:**
- Modify: `src/pages/submit.astro`
- Modify: `src/pages/newsletter.astro`

**Interfaces:**
- Consumes: theme tokens (Task 1).
- Produces: no interface change.

- [ ] **Step 1: Replace `src/pages/submit.astro` entirely**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Submit a skill" description="Suggest a skill for the gallery.">
  <h1 class="mb-4 text-4xl font-black">Submit a skill</h1>
  <p class="mb-10 max-w-xl font-medium text-ink-soft">
    Suggest a skill for the gallery. This does not publish automatically — every
    submission is reviewed by hand before it's added.
  </p>

  <!--
    Replace YOUR_FORM_ID with the ID from your Formspree form
    (https://formspree.io/forms) before deploying.
  -->
  <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" class="flex max-w-xl flex-col gap-6">
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Skill name
      <input type="text" name="skillName" required class="border border-rule-strong px-3 py-2 font-medium" />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Source URL
      <input type="url" name="sourceUrl" required class="border border-rule-strong px-3 py-2 font-medium" />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Tool(s)
      <input
        type="text"
        name="tools"
        placeholder="e.g. Claude, Cursor"
        required
        class="border border-rule-strong px-3 py-2 font-medium"
      />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Category
      <input
        type="text"
        name="category"
        placeholder="e.g. motion, accessibility"
        required
        class="border border-rule-strong px-3 py-2 font-medium"
      />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Your name
      <input type="text" name="submitterName" required class="border border-rule-strong px-3 py-2 font-medium" />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      Your email
      <input type="email" name="submitterEmail" required class="border border-rule-strong px-3 py-2 font-medium" />
    </label>
    <label class="flex flex-col gap-2 text-sm font-semibold">
      One-line pitch
      <textarea name="pitch" required rows="3" class="border border-rule-strong px-3 py-2 font-medium"></textarea>
    </label>
    <button type="submit" class="bg-ink px-4 py-2 text-sm font-semibold text-white">
      Submit for review
    </button>
  </form>
</BaseLayout>
```

- [ ] **Step 2: Replace `src/pages/newsletter.astro` entirely**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

interface ArchiveIssue {
  title: string;
  url: string;
  publishedAt: string;
}

const archive: ArchiveIssue[] = [];
---

<BaseLayout
  title="Newsletter"
  description="Sign up for occasional emails about new skills added to the gallery."
>
  <h1 class="mb-4 text-4xl font-black">Newsletter</h1>
  <p class="mb-10 max-w-xl font-medium text-ink-soft">
    Occasional emails when a genuinely good skill gets added. No spam.
  </p>

  <!--
    Placeholder Buttondown embed. Replace YOUR_USERNAME with your Buttondown
    username before deploying: https://buttondown.com/emails
  -->
  <form
    action="https://buttondown.com/api/emails/embed-subscribe/YOUR_USERNAME"
    method="post"
    target="popupwindow"
    class="mb-16 flex max-w-md gap-3"
  >
    <input
      type="email"
      name="email"
      required
      placeholder="you@example.com"
      class="flex-1 border border-rule-strong px-3 py-2 text-sm font-medium"
    />
    <button type="submit" class="bg-ink px-4 py-2 text-sm font-semibold text-white">
      Subscribe
    </button>
  </form>

  <h2 class="mb-6 text-2xl font-bold">Archive</h2>
  {
    archive.length === 0 ? (
      <p class="text-sm font-medium text-ink-soft">No issues yet — check back soon.</p>
    ) : (
      <ul class="flex flex-col gap-3">
        {archive.map((issue) => (
          <li>
            <a href={issue.url} class="underline">{issue.title}</a>
            <span class="ml-2 text-sm font-medium text-ink-soft">{issue.publishedAt}</span>
          </li>
        ))}
      </ul>
    )
  }
</BaseLayout>
```

- [ ] **Step 3: Verify both pages build**

Run: `npm run build && grep -o 'action="[^"]*"' dist/submit/index.html && grep -o 'No issues yet[^<]*' dist/newsletter/index.html`
Expected: `action="https://formspree.io/f/YOUR_FORM_ID"` and `No issues yet — check back soon.`

- [ ] **Step 4: Commit**

```bash
git add src/pages/submit.astro src/pages/newsletter.astro
git commit -m "Retheme /submit and /newsletter pages"
```

---

### Task 8: Final verification, spec doc update, and old-theme cleanup checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md`

**Interfaces:**
- Consumes: the entire retheme.
- Produces: nothing new — verification, documentation, and a decision point for the user.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS, same test count as before this plan (this retheme touches no `.ts` logic files with tests — schema, taxonomy, filter engine, and content-corpus tests are all unaffected).

- [ ] **Step 2: Run the full type-check and build**

Run: `npx astro check && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Manually walk every page**

Run: `npm run preview` (in the background). Visit and check:
- `/` — grey ground, black Geist headline, cards show index numbers not images.
- `/skills` — filtering still works (check/uncheck a tool and a category, confirm the grid narrows correctly, same mechanism as before — this plan didn't touch `filterSkills.ts`).
- `/skills/frontend-design` (and one other slug) — blue hero renders with white heading, black-on-white category chip, and the 8-cell matrix with the correct cells filled.
- `/submit` — square-cornered inputs, dark submit button.
- `/newsletter` — square-cornered input, dark subscribe button, empty-state message.
- Click the "Grid — Off" toggle bottom-right on any page — confirm it reveals faint column rules and the label flips to "Grid — On".

Stop the preview server afterward.

- [ ] **Step 4: Add a "Direction B" section to the design spec documenting what's live**

Append this section to the end of `docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md`:

```md

## Addendum: Visual Direction B (adopted 2026-07-31)

The theme described in "Visual design" above (Fraunces/Inter, warm paper `#FAF9F5`,
terracotta accent) has been superseded by a Swiss-modernist direction validated
through a mood-board exploration, referencing Otl Aicher's Munich 1972 identity
and Josef Müller-Brockmann's *Grid Systems in Graphic Design*.

**Palette:** `--color-paper: #cac8c0` (warm grey ground, off Aicher's pictogram
sheets), `--color-tile: #ffffff`, `--color-ink: #161616`, `--color-ink-soft:
#55554f`, `--color-rule` / `--color-rule-strong` (hairline rules),
`--color-accent-blue: #2c7fb8`, `--color-accent-orange: #d8501f`,
`--color-accent-yellow: #e0a83a`. All three accent hex values are eyeballed
from reference images, not a verified swatch book.

**Type:** one family (Geist, self-hosted from the `geist` npm package's static
files under `public/fonts/geist/`) at medium-to-bold weight throughout, no
display/body pairing. Geist Mono is installed but not used anywhere yet —
reserved for a future literal code/install-snippet context.

**Distinguishing features:** a toggleable hairline column grid over `<main>`
(off by default), outlined (not filled) tool badges, typography-only skill
cards (no preview image, a zero-padded index number instead), and a solid
color hero on each skill detail page with an 8-cell tool-coverage matrix
inspired by the Munich '72 Games schedule pictogram grid.

**Old theme:** kept installed, not deleted. `@fontsource/fraunces` and
`@fontsource/inter` remain in `package.json` but are no longer imported;
`src/content/skills/*.mdx`'s `previewAssets` field and the generated SVG
files under `public/previews/` are unused by any page but still exist.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md
git commit -m "Document Direction B as the adopted live theme"
```

- [ ] **Step 6: Report the cleanup checklist to the user (no action — informational)**

This step is not a code change. When this task's review is approved, the controller (not a subagent) should present the user with an explicit list of now-unused things to decide on before launch, per the user's own request to be asked rather than have them silently removed:
- `@fontsource/fraunces` and `@fontsource/inter` npm packages (unused, still installed)
- `previewAssets` field in the content schema and the 8 generated SVG files in `public/previews/` (unused by any page now)
- The original "Visual design" section of the spec doc (superseded by the Direction B addendum, not deleted)
