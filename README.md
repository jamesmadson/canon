# Canon

A curated, editorial gallery of design and design-engineering "skill" files for
AI coding agents (Claude, Cursor, Codex, Copilot) and design tools (Figma, Miro).
Every entry is read in full, license-checked, and written up by hand.

**Live at [jamesmadson.github.io/canon](https://jamesmadson.github.io/canon)**

Named Canon as in an accepted body of principles/work, echoing the Vignelli
Canon that helped shape its visual system.

---

## Using Canon

Three ways in, depending on where you work.

### Claude Code plugin — install once, invoke deliberately

```
/plugin marketplace add jamesmadson/canon
```

Then install the `canon` plugin from that marketplace. You get a router skill
plus three kits. Name the kind of work — a landing page, a dashboard, a mobile
review — and the router pulls in the kit that applies. It stays dormant until
you call it; it never triggers on general design chatter.

See [`plugin/canon/README.md`](plugin/canon/README.md) for what each kit covers.

### Figma, or anywhere that takes one file

Download **[canon-all.md](https://jamesmadson.github.io/canon/kits/canon-all.md)**
— the router and all three kits inlined into a single self-contained file, under
the Agent Skills 500-line recommendation. Upload it to Figma Make, the Figma
agent, a claude.ai Project's knowledge base, or anything else that accepts one
Markdown file.

### A single kit, installed into a project

Each kit page has an install script that clones its skills into
`./.claude/skills/` of the current project:

```bash
curl -fsSL https://jamesmadson.github.io/canon/kits/marketing-site/install.sh | bash
```

Kits: `marketing-site`, `product-ui`, `mobile-first-review`, `full-redesign`.
Re-running updates everything in place. Each kit page also offers a digest —
the kit distilled into one attachable file.

---

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. Note the `/canon` base path —
the site serves at `http://localhost:4321/canon/`, and the bare root 404s.

## Other commands

- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run test` — run the Vitest suite (schema, taxonomy, filter engine,
  generated-artifact drift, install scripts)
- `npm run check` — Astro type-check
- `npx tsx scripts/fetch-skill-trees.ts` — re-verify every gallery entry against
  its source repo, refreshing file trees, content outlines, and licenses
- `npx tsx scripts/build-canon-artifacts.ts` — regenerate the plugin skills and
  `canon-all.md` from the kit digests

## Deploying

Canon deploys to GitHub Pages at **https://jamesmadson.github.io/canon**, via
`.github/workflows/deploy.yml` on every push to `main` (or manually with
`workflow_dispatch`).

One-time manual step: in the repo's Settings → Pages, set **Source** to
"GitHub Actions". Nothing deploys until that's set.

The `/canon` base path is coupled in three places — if the deploy domain or
path ever changes, update all three together:

- `astro.config.mjs` (`site` and `base`)
- `src/styles/global.css` (`@font-face` `url("/canon/fonts/...")` — plain CSS
  can't read Astro's `BASE_URL`, so it's hardcoded)
- `src/lib/buildInstallScript.ts` (the generated install script's header comment)

The submit and newsletter forms are intentionally not wired up yet (see
`src/pages/submit.astro` and `src/pages/newsletter.astro`) — both pages are live
with a "not open yet" notice in place of the form.

## Content

Skills live as MDX files in `src/content/skills/`, validated at build time
against the schema in `src/content/skillSchema.ts`.

`license` is **derived, never hand-typed** — `scripts/fetch-skill-trees.ts`
reads it from the GitHub API so it can't drift from the source. A skill whose
source states no license is marked `status: pending-license`, which hides it
everywhere it would be published or copied — no detail page, no listing, and no
entry in any generated install script — until the author adds one.

The kits in `src/content/kits/` compose those skills into phased bundles. Their
digests in `public/kits/` are Canon's own writing and are themselves valid
single-file skills; `plugin/canon/skills/` and `public/kits/canon-all.md` are
generated from them, with byte-match tests preventing drift.

See `docs/superpowers/specs/` for design specs, `docs/ROADMAP.md` for what's
next, and `docs/GO-TO-MARKET.md` for the launch plan.
