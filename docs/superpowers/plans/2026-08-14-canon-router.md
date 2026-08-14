# Canon Router + Homepage Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `canon` router skill as an installable Claude Code plugin, a self-contained `canon-all` file for Figma, and a scripted demo box on the homepage that shows the router in use.

**Architecture:** The four kit digests already carry spec-valid Agent Skills frontmatter, so they *are* valid `SKILL.md` files. A generator script copies three of them into plugin skill folders and inlines their bodies into `canon-all`, with byte-matching tests preventing drift — the only new prose is the router itself. The demo box is a data-driven vanilla-TS island rendering scripted exchanges; no backend, no simulated latency.

**Tech Stack:** Astro 5 + TypeScript strict + Zod + Vitest + Tailwind v4 + `gray-matter` (existing devDependency).

## Global Constraints

- **Fully monochrome.** Only tokens `ink`, `ink-soft`, `rule`, `rule-strong`, `surface`, `bg`. Hover/focus are value shifts, never hue. Any color is a defect.
- **No new npm dependencies.**
- **≥44px tap targets** on interactive elements.
- **The demo box must never simulate a live system.** No typing animation, no spinner, no artificial delay. It carries a visible label identifying it as a scripted example. Misrepresenting a static page as a working console is a defect, not a polish issue.
- **Demo excerpts must be drawn verbatim from the kit digests** — true statements, not marketing prose written for the box.
- Router description must include an explicit non-auto-trigger clause (the `nothing-design` technique) so the skill stays dormant until deliberately invoked.
- `canon-all` must stay **under 500 lines** (Agent Skills spec recommendation). Current projection ≈ 410.
- Reference spec: `docs/superpowers/specs/2026-08-14-canon-router-design.md`.

---

### Task 1: Router skill and plugin manifests — CURATOR-EXECUTED (do not dispatch)

**Executed by the controller/curator, not an implementer subagent.** The routing table encodes editorial judgment about which kit serves which task — the same curatorial call as the kit lineups themselves. The reviewable gate is Task 2's tests plus the final review.

**Files (all Create):**
- `plugin/canon/skills/canon/SKILL.md`
- `plugin/canon/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

**Interfaces:**
- Produces: a router skill whose body contains a routing table naming exactly the slugs `canon-marketing-site`, `canon-product-ui`, `canon-mobile-first-review`; manifests that Task 2's tests parse.

- [ ] **Step 1 (curator): author `plugin/canon/skills/canon/SKILL.md`**

Frontmatter: `name: canon`; `description` naming all three routes, their trigger language, AND the explicit non-auto-trigger clause; `compatibility` noting it expects sibling kit skills.

Body: a routing table (task language → kit slug), an ambiguity rule (ask, never guess), and one section per route naming that kit's constituent skills plus the graceful-degradation instruction (defer to installed skills; otherwise use the sibling digest's inlined guidance).

- [ ] **Step 2 (curator): author the two manifests**

`plugin/canon/.claude-plugin/plugin.json` — `name`, `description`, `version`, `author`.

`.claude-plugin/marketplace.json` — `name`, `description`, `owner`, and a `plugins` array with one entry: `name: canon`, `description`, `author`, `category: design`, and a `source` pointing at `./plugin/canon`.

- [ ] **Step 3: Verify** — `npx astro check` (0 errors), `npm run build` (success). Neither manifest affects the build; this confirms nothing was broken.

- [ ] **Step 4: Commit**

```bash
git add plugin .claude-plugin
git commit -m "Add the canon router skill and plugin manifests"
```

---

### Task 2: Generator — sync plugin skills and build `canon-all`

**Files:**
- Create: `scripts/build-canon-artifacts.ts`
- Create: `src/lib/buildCanonAll.ts`
- Test: `tests/lib/buildCanonAll.test.ts`
- Generated (by running the script): `plugin/canon/skills/canon-marketing-site/SKILL.md`, `plugin/canon/skills/canon-product-ui/SKILL.md`, `plugin/canon/skills/canon-mobile-first-review/SKILL.md`, `public/kits/canon-all.md`

**Interfaces:**
- Consumes: the router SKILL.md (Task 1), the four digests in `public/kits/`.
- Produces: `buildCanonAll(input: CanonAllInput): string` from `src/lib/buildCanonAll.ts`, where

```ts
export interface CanonAllKit {
  slug: string;      // e.g. 'marketing-site'
  title: string;     // e.g. 'Marketing / Landing Site'
  body: string;      // digest body with frontmatter already stripped
}

export interface CanonAllInput {
  routerBody: string;   // router SKILL.md body, frontmatter stripped
  kits: CanonAllKit[];  // in order: marketing-site, product-ui, mobile-first-review
}
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildCanonAll, type CanonAllInput } from '../../src/lib/buildCanonAll';

const input: CanonAllInput = {
  routerBody: '# Canon\n\nRouting table goes here.\n',
  kits: [
    { slug: 'marketing-site', title: 'Marketing / Landing Site', body: '## Section A\n\nMarketing body.\n' },
    { slug: 'product-ui', title: 'Product UI / Dashboard', body: '## Section B\n\nProduct body.\n' },
    { slug: 'mobile-first-review', title: 'Mobile-First Review', body: '## Section C\n\nMobile body.\n' },
  ],
};

describe('buildCanonAll', () => {
  it('emits spec-valid frontmatter naming canon-all', () => {
    const out = buildCanonAll(input);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('name: canon-all');
    expect(out).toContain('description:');
  });

  it('includes the router body before any kit section', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Routing table goes here.');
    expect(out.indexOf('Routing table goes here.')).toBeLessThan(out.indexOf('Marketing body.'));
  });

  it('inlines every kit body verbatim', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Marketing body.');
    expect(out).toContain('Product body.');
    expect(out).toContain('Mobile body.');
  });

  it('keeps kits in the given order', () => {
    const out = buildCanonAll(input);
    expect(out.indexOf('Marketing body.')).toBeLessThan(out.indexOf('Product body.'));
    expect(out.indexOf('Product body.')).toBeLessThan(out.indexOf('Mobile body.'));
  });

  it('gives each kit a titled section heading', () => {
    const out = buildCanonAll(input);
    expect(out).toContain('Marketing / Landing Site');
    expect(out).toContain('Product UI / Dashboard');
    expect(out).toContain('Mobile-First Review');
  });

  it('is deterministic for identical input', () => {
    expect(buildCanonAll(input)).toEqual(buildCanonAll(input));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/buildCanonAll.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/buildCanonAll'`

- [ ] **Step 3: Implement `src/lib/buildCanonAll.ts`**

```ts
export interface CanonAllKit {
  slug: string;
  title: string;
  body: string;
}

export interface CanonAllInput {
  routerBody: string;
  kits: CanonAllKit[];
}

const FRONTMATTER = `---
name: canon-all
description: >-
  Canon's three build kits in one file: marketing and landing sites,
  product UI and dashboards, and mobile review. Routes by task, then
  applies that kit's guidance — brand discipline, craft floor, motion
  frequency gate, copy rules, accessibility floor, and pre-ship gates.
  Use when designing, building, or reviewing any interface and you want
  Canon's judgment; say which kind of work it is, or ask which applies.
compatibility: >-
  Self-contained: needs no sibling skills installed. Built for surfaces
  that accept a single Markdown skill file, such as Figma Make and the
  Figma agent.
metadata:
  source: https://jamesmadson.github.io/canon/kits/
  generated: scripts/build-canon-artifacts.ts
---
`;

export function buildCanonAll(input: CanonAllInput): string {
  const sections = input.kits
    .map((kit) => `---\n\n# ${kit.title}\n\n${kit.body.trim()}\n`)
    .join('\n');

  return `${FRONTMATTER}\n${input.routerBody.trim()}\n\n${sections}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/buildCanonAll.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the generator script `scripts/build-canon-artifacts.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { buildCanonAll, type CanonAllKit } from '../src/lib/buildCanonAll';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ROUTED = [
  { slug: 'marketing-site', title: 'Marketing / Landing Site' },
  { slug: 'product-ui', title: 'Product UI / Dashboard' },
  { slug: 'mobile-first-review', title: 'Mobile-First Review' },
];

function digestPath(slug: string): string {
  return path.join(root, 'public/kits', `${slug}-digest.md`);
}

// 1. Copy each routed digest verbatim into its plugin skill folder.
for (const { slug } of ROUTED) {
  const source = readFileSync(digestPath(slug), 'utf-8');
  const dir = path.join(root, 'plugin/canon/skills', `canon-${slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), source);
  console.log(`✓ plugin skill canon-${slug}`);
}

// 2. Build canon-all from the router body plus each digest body.
const routerRaw = readFileSync(path.join(root, 'plugin/canon/skills/canon/SKILL.md'), 'utf-8');
const routerBody = matter(routerRaw).content;

const kits: CanonAllKit[] = ROUTED.map(({ slug, title }) => ({
  slug,
  title,
  body: matter(readFileSync(digestPath(slug), 'utf-8')).content,
}));

const canonAll = buildCanonAll({ routerBody, kits });
writeFileSync(path.join(root, 'public/kits/canon-all.md'), canonAll);

const lines = canonAll.split('\n').length;
console.log(`✓ canon-all.md (${lines} lines)`);
if (lines > 500) {
  console.error(`!! canon-all is ${lines} lines — over the Agent Skills 500-line recommendation`);
  process.exit(1);
}
```

- [ ] **Step 6: Run the generator**

Run: `npx tsx scripts/build-canon-artifacts.ts`
Expected: four ✓ lines, and a `canon-all.md (N lines)` where N < 500. If N ≥ 500 the script exits non-zero — report it rather than trimming content on your own initiative.

- [ ] **Step 7: Write the drift test `tests/content/canonArtifacts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const ROUTED = ['marketing-site', 'product-ui', 'mobile-first-review'];

const digest = (slug: string) =>
  readFileSync(path.join(root, 'public/kits', `${slug}-digest.md`), 'utf-8');

describe('generated canon artifacts stay in sync with their sources', () => {
  for (const slug of ROUTED) {
    it(`plugin skill canon-${slug} byte-matches its digest`, () => {
      const generated = readFileSync(
        path.join(root, 'plugin/canon/skills', `canon-${slug}`, 'SKILL.md'),
        'utf-8'
      );
      expect(generated).toBe(digest(slug));
    });
  }

  it('canon-all exists and is under the 500-line spec recommendation', () => {
    const file = path.join(root, 'public/kits/canon-all.md');
    expect(existsSync(file)).toBe(true);
    const lines = readFileSync(file, 'utf-8').split('\n').length;
    expect(lines).toBeLessThan(500);
  });

  it('canon-all has spec-valid frontmatter', () => {
    const { data } = matter(readFileSync(path.join(root, 'public/kits/canon-all.md'), 'utf-8'));
    expect(data.name).toBe('canon-all');
    expect(typeof data.description).toBe('string');
    expect(data.description.length).toBeLessThanOrEqual(1024);
    expect(data.description.toLowerCase()).toContain('use when');
  });

  it('canon-all inlines every routed kit body', () => {
    const all = readFileSync(path.join(root, 'public/kits/canon-all.md'), 'utf-8');
    for (const slug of ROUTED) {
      const body = matter(digest(slug)).content.trim();
      // Compare a distinctive slice rather than the whole body so the test
      // reports a readable diff when it fails.
      const probe = body.split('\n').filter((l) => l.trim().length > 40)[0];
      expect(all, `canon-all missing content from ${slug}`).toContain(probe);
    }
  });

  it('the router names exactly the three routed kits', () => {
    const router = readFileSync(
      path.join(root, 'plugin/canon/skills/canon/SKILL.md'),
      'utf-8'
    );
    for (const slug of ROUTED) {
      expect(router).toContain(`canon-${slug}`);
    }
    expect(router).not.toContain('canon-full-redesign');
  });

  it('the plugin and marketplace manifests parse and carry required fields', () => {
    const plugin = JSON.parse(
      readFileSync(path.join(root, 'plugin/canon/.claude-plugin/plugin.json'), 'utf-8')
    );
    expect(plugin.name).toBe('canon');
    expect(typeof plugin.description).toBe('string');

    const marketplace = JSON.parse(
      readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf-8')
    );
    expect(Array.isArray(marketplace.plugins)).toBe(true);
    expect(marketplace.plugins.length).toBeGreaterThan(0);
    expect(marketplace.plugins[0].name).toBe('canon');
    expect(marketplace.plugins[0].category).toBe('design');
  });
});
```

- [ ] **Step 8: Verify**

Run: `npx vitest run` — all green.
Run: `npx astro check` — 0 errors.
Run: `npm run build` — success.

- [ ] **Step 9: Commit**

```bash
git add scripts/build-canon-artifacts.ts src/lib/buildCanonAll.ts tests/lib/buildCanonAll.test.ts tests/content/canonArtifacts.test.ts plugin/canon/skills public/kits/canon-all.md
git commit -m "Generate plugin kit skills and canon-all from the digests"
```

---

### Task 3: Demo case data

**Files:**
- Create: `src/data/demoCases.ts`
- Test: `tests/content/demoCases.test.ts`

**Interfaces:**
- Produces: `DemoCase` and `DEMO_CASES` from `src/data/demoCases.ts`:

```ts
export interface DemoCase {
  id: string;        // stable id used for tab wiring, e.g. 'marketing'
  label: string;     // tab label, e.g. 'Marketing site'
  prompt: string;    // what the user would type
  route: string;     // kit slug the router picks, e.g. 'marketing-site'
  skills: string[];  // skill slugs that kit pulls in
  excerpt: string[]; // 3-5 lines drawn verbatim from that kit's digest
}
```

Task 4's component consumes `DEMO_CASES`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { DEMO_CASES } from '../../src/data/demoCases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const kitSlugs = new Set(
  readdirSync(path.join(root, 'src/content/kits'))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => matter(readFileSync(path.join(root, 'src/content/kits', f), 'utf-8')).data.slug)
);

const skillSlugs = new Set(
  readdirSync(path.join(root, 'src/content/skills'))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => matter(readFileSync(path.join(root, 'src/content/skills', f), 'utf-8')).data.slug)
);

describe('demo cases', () => {
  it('has exactly three cases', () => {
    expect(DEMO_CASES).toHaveLength(3);
  });

  it('has unique ids', () => {
    const ids = DEMO_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const demoCase of DEMO_CASES) {
    it(`${demoCase.id} routes to a real kit`, () => {
      expect(kitSlugs.has(demoCase.route), `${demoCase.route} is not a real kit`).toBe(true);
    });

    it(`${demoCase.id} names only real skills`, () => {
      expect(demoCase.skills.length).toBeGreaterThan(0);
      for (const slug of demoCase.skills) {
        expect(skillSlugs.has(slug), `${slug} is not a real skill`).toBe(true);
      }
    });

    it(`${demoCase.id} has a prompt and a 3-5 line excerpt`, () => {
      expect(demoCase.prompt.trim().length).toBeGreaterThan(10);
      expect(demoCase.excerpt.length).toBeGreaterThanOrEqual(3);
      expect(demoCase.excerpt.length).toBeLessThanOrEqual(5);
    });
  }

  it('covers all three routed kits', () => {
    const routes = DEMO_CASES.map((c) => c.route).sort();
    expect(routes).toEqual(['marketing-site', 'mobile-first-review', 'product-ui']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/content/demoCases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/data/demoCases.ts`**

Each `excerpt` line must be drawn from that kit's digest in `public/kits/`. Read the digest before writing the excerpt; do not invent guidance. Choose lines that demonstrate judgment (a rule with a reason) rather than generic advice.

```ts
export interface DemoCase {
  id: string;
  label: string;
  prompt: string;
  route: string;
  skills: string[];
  excerpt: string[];
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'marketing',
    label: 'Marketing site',
    prompt: 'Design the hero for our launch page.',
    route: 'marketing-site',
    skills: ['brand-guidelines', 'frontend-design', 'web-design-guidelines', 'design-motion-principles'],
    excerpt: [
      'One page, one argument. The hero states the thesis rather than decorating it.',
      'Self-critique against the defaults every AI-built landing page collapses toward: the gradient hero on white, cream-and-terracotta, near-black with one acid accent.',
      'A visitor sees the hero once, so expressive motion is welcome here — but animate transform and opacity only, and support prefers-reduced-motion.',
      'One signature moment per page, usually. Two is usually one too many.',
    ],
  },
  {
    id: 'product',
    label: 'Product UI',
    prompt: 'Review this dashboard table before I ship it.',
    route: 'product-ui',
    skills: ['web-design-guidelines', 'make-interfaces-feel-better', 'emil-design-eng', 'better-accessibility'],
    excerpt: [
      'Restraint is not a style preference here — it is the functional requirement. A flourish that delights on first encounter becomes a tax on the four-hundredth.',
      'Tabular numbers everywhere digits align. Right-align numerics, and keep column alignment stable when values change length.',
      'Encode state in form as well as color: a pill, a chip, a severity stripe. Colour alone fails for ~8% of users.',
      'A control used hundreds of times a day gets no animation, or an instant transition.',
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile review',
    prompt: 'Audit this screen on mobile.',
    route: 'mobile-first-review',
    skills: ['thumb-first', 'web-design-guidelines', 'better-accessibility', 'improve-animations'],
    excerpt: [
      'Two passes, never blended: design judgment (is this the right design?) and platform verification (is it built correctly for the device?).',
      'An opinion must never read as a defect, and a must-fix must never read as a preference.',
      'Tap targets ≥44×44. Check the functional hit area, not the visual box — padding on a wrapper is not tappable if the anchor does not own it.',
      'Inputs under 16px make iOS Safari zoom on focus.',
    ],
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/content/demoCases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/demoCases.ts tests/content/demoCases.test.ts
git commit -m "Add demo case data for the homepage router demo"
```

---

### Task 4: DemoBox component and homepage placement

**Files:**
- Create: `src/components/DemoBox.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `DEMO_CASES` from `src/data/demoCases.ts` (Task 3).

- [ ] **Step 1: Create `src/components/DemoBox.astro`**

```astro
---
import { DEMO_CASES } from '../data/demoCases';
import { withBase } from '../lib/withBase';
---

<section class="mb-12" aria-labelledby="demo-heading">
  <h2 id="demo-heading" class="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
    Canon in use
  </h2>
  <p class="mb-4 max-w-2xl text-sm font-medium text-ink-soft">
    Install one skill. Name the kind of work, and it pulls in the judgment that
    applies — not a list of files to read.
  </p>

  <div class="border border-rule-strong">
    <div role="tablist" aria-label="Example use cases" class="flex flex-wrap gap-px bg-rule">
      {DEMO_CASES.map((demoCase, i) => (
        <button
          type="button"
          role="tab"
          id={`demo-tab-${demoCase.id}`}
          aria-controls={`demo-panel-${demoCase.id}`}
          aria-selected={i === 0 ? 'true' : 'false'}
          tabindex={i === 0 ? 0 : -1}
          data-demo-tab={demoCase.id}
          class="min-h-11 flex-1 bg-bg px-4 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink aria-selected:bg-surface aria-selected:text-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2"
        >
          {demoCase.label}
        </button>
      ))}
    </div>

    {DEMO_CASES.map((demoCase, i) => (
      <div
        role="tabpanel"
        id={`demo-panel-${demoCase.id}`}
        aria-labelledby={`demo-tab-${demoCase.id}`}
        data-demo-panel={demoCase.id}
        hidden={i !== 0}
        class="border-t border-rule p-4 sm:p-6"
      >
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">You type</p>
        <p class="mb-5 font-mono text-sm text-ink">{demoCase.prompt}</p>

        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Canon pulls in</p>
        <div class="mb-5 flex flex-col gap-px bg-rule">
          <div class="bg-bg py-2">
            <a
              href={withBase(`/kits/${demoCase.route}/`)}
              class="text-sm font-semibold text-ink underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink"
            >
              {demoCase.route}
            </a>
          </div>
          {demoCase.skills.map((slug) => (
            <div class="bg-bg py-2">
              <a
                href={withBase(`/skills/${slug}/`)}
                class="text-sm font-medium text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-ink hover:decoration-rule-strong"
              >
                {slug}
              </a>
            </div>
          ))}
        </div>

        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">What comes back</p>
        <ul class="flex flex-col gap-2">
          {demoCase.excerpt.map((line) => (
            <li class="border-l border-rule-strong pl-3 text-sm font-medium leading-relaxed text-ink-soft">
              {line}
            </li>
          ))}
        </ul>
      </div>
    ))}

    <p class="border-t border-rule bg-surface px-4 py-2 text-[11px] font-medium text-ink-soft sm:px-6">
      A scripted example, not a live session. Every line above is quoted from the
      kit it names.
    </p>
  </div>
</section>

<script>
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-demo-tab]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-demo-panel]'));

  function select(id: string, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.demoTab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.demoPanel !== id;
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.demoTab!));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      select(next.dataset.demoTab!, true);
    });
  });
</script>
```

- [ ] **Step 2: Place it on the homepage**

In `src/pages/index.astro`, add the import after the `KitCard` import:

```astro
import DemoBox from '../components/DemoBox.astro';
```

Then insert `<DemoBox />` immediately after the hero `</section>` and before the `Kits` section, so the argument lands before the inventory.

- [ ] **Step 3: Verify**

Run: `npx astro check` — 0 errors.
Run: `npm run build` — success.
Run: `grep -rn "accent\|blue\|green\|red-" src/components/DemoBox.astro` — expect no matches (monochrome constraint).

- [ ] **Step 4: Commit**

```bash
git add src/components/DemoBox.astro src/pages/index.astro
git commit -m "Add the homepage demo box showing the router in use"
```

---

### Task 5: `/kits` router lead section

**Files:**
- Modify: `src/pages/kits/index.astro`

- [ ] **Step 1: Add the router lead above the kit grid**

In `src/pages/kits/index.astro`, after the existing intro paragraph and before the kit grid, insert:

```astro
  <section class="mb-10 border border-rule-strong p-5">
    <h2 class="text-lg font-semibold text-ink">Start here: the Canon router</h2>
    <p class="mt-2 max-w-2xl text-sm font-medium text-ink-soft">
      One skill that routes to the right kit. Install it once, then name the kind
      of work — a landing page, a dashboard, a mobile review — and it pulls in
      that kit's guidance. It stays dormant until you call it.
    </p>
    <div class="mt-4 flex flex-wrap gap-px bg-rule">
      <a
        href={withBase('/kits/canon-all.md')}
        download
        class="min-h-11 flex-1 bg-bg px-4 py-3 text-sm font-semibold text-ink underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2"
      >
        canon-all.md — one file for Figma
      </a>
      <a
        href="https://github.com/jamesmadson/canon/tree/main/plugin/canon"
        class="min-h-11 flex-1 bg-bg px-4 py-3 text-sm font-semibold text-ink underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2"
      >
        Claude Code plugin — install from GitHub
      </a>
    </div>
  </section>
```

Add `import { withBase } from '../../lib/withBase';` to the frontmatter if not already present.

- [ ] **Step 2: Label the routed kits vs the bundle**

The page already has `<h1>Kits</h1>` at line 12 — do **not** add a second "Kits" heading. Instead, above the grid add a distinct eyebrow that names what the grid contains:

```astro
  <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">The four kits</h2>
```

and after the grid, add a one-line note:

```astro
  <p class="mt-4 max-w-2xl text-sm font-medium text-ink-soft">
    The router covers Marketing / Landing Site, Product UI / Dashboard, and
    Mobile-First Review. Full Redesign is the everything bundle — install it
    directly rather than routing to it.
  </p>
```

- [ ] **Step 3: Verify**

Run: `npx astro check` — 0 errors. `npm run build` — success. Confirm `dist/kits/canon-all.md` exists (it is a `public/` file, so the build copies it).

- [ ] **Step 4: Commit**

```bash
git add src/pages/kits/index.astro
git commit -m "Lead the kits page with the Canon router"
```

---

### Task 6: Open Graph and Twitter Card tags

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

This closes the P1 from `.claude/marketing-kit-audit.md`: social shares currently render with no preview card.

- [ ] **Step 1: Add the meta tags**

In `src/layouts/BaseLayout.astro`, inside `<head>` after the existing `<meta name="description" …>` line, add:

```astro
    <meta property="og:title" content={`${title} · Canon`} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Canon" />
    {Astro.site && <meta property="og:url" content={new URL(Astro.url.pathname, Astro.site).href} />}
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={`${title} · Canon`} />
    <meta name="twitter:description" content={description} />
```

**On `og:image`:** the spec calls for a 1200×630 share image, but Canon has no logo asset yet (the user has said the logo and favicon are not ready). Ship without `og:image` and with `twitter:card` set to `summary` rather than `summary_large_image` — a text-only card that renders correctly is better than a large-image card with a missing image. Do not generate a placeholder image. Note this in your report so it can be revisited when brand assets exist.

- [ ] **Step 2: Verify the tags render**

Run: `npm run build`
Run: `grep -o 'property="og:[^"]*"' dist/index.html`
Expected: `og:title`, `og:description`, `og:type`, `og:site_name`, `og:url`.
Run: `grep -o 'content="https://jamesmadson.github.io/canon[^"]*"' dist/index.html | head -2`
Expected: the `og:url` resolves to a full absolute URL including the base path.

Run: `npx astro check` — 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Add Open Graph and Twitter Card meta tags"
```

---

### Task 7: Full gates and artifact verification

**Files:** none expected — verification only; edit only if a gate fails.

- [ ] **Step 1: Regenerate artifacts and confirm no drift**

Run: `npx tsx scripts/build-canon-artifacts.ts`
Run: `git status --short`
Expected: no modified files. If the generator changes anything, the committed artifacts were stale — commit the regenerated output and note it.

- [ ] **Step 2: Full gates**

Run: `npx vitest run` — all green.
Run: `npx astro check` — 0 errors.
Run: `npm run build` — success.

- [ ] **Step 3: Monochrome sweep on new surfaces**

Run: `grep -rn "accent\|amber\|blue-\|green-\|red-\|yellow-" src/components/DemoBox.astro src/data/demoCases.ts src/pages/kits/index.astro`
Expected: no matches.

- [ ] **Step 4: Confirm the shipped artifacts exist in the build**

Run: `ls dist/kits/canon-all.md dist/kits/marketing-site-digest.md`
Expected: both exist.

- [ ] **Step 5: Commit (only if a gate required a fix)**

Visual verification (demo box at desktop and 390px, keyboard tab-through with arrow keys, `/kits` hierarchy) is performed by the controller in the Browser pane after this task.
