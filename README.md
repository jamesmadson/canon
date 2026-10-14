# Canon

James Madson's design skills for AI agents: graft, strata and deter. The site
also hosts the Canon app, which keeps your prototypes in one place.

**Live at [jamesmadson.github.io/canon](https://jamesmadson.github.io/canon)**

Named Canon as in an accepted body of principles and work, echoing the Vignelli
Canon that helped shape its visual system.

---

## The skills

- **graft** maps a Claude Code session as a branch diagram: your turns as the
  trunk, subagents as forks, compactions as diamonds.
- **strata** keeps a record of what users actually said, in dated layers, under
  pseudonyms, with verbatim kept apart from interpretation.
- **deter** is a review that removes: every finding priced against the
  surface's job, one thing kept, at most one thing missing.

Each one ships as a Claude Code plugin from this repo's marketplace:

```
/plugin marketplace add jamesmadson/canon
```

Then install `graft`, `strata` or `deter` from that marketplace. The sources
live in `plugin/graft`, `plugin/strata` and `plugin/deter`.

---

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. Note the `/canon` base path:
the site serves at `http://localhost:4321/canon/`, and the bare root 404s.

## Other commands

- `npm run build`: production build to `dist/`
- `npm run preview`: preview the production build locally
- `npm run test`: run the Vitest suite (schema, taxonomy, filter engine,
  marketplace, app)
- `npm run check`: Astro type-check
- `npx tsx scripts/fetch-skill-trees.ts`: re-verify every gallery entry against
  its source, refreshing file trees, content outlines and licenses

## Deploying

Canon deploys to GitHub Pages at **https://jamesmadson.github.io/canon**, via
`.github/workflows/deploy.yml` on every push to `main` (or manually with
`workflow_dispatch`).

One-time manual step: in the repo's Settings, Pages, set **Source** to
"GitHub Actions". Nothing deploys until that's set.

The `/canon` base path is coupled in two places. If the deploy domain or path
ever changes, update both together:

- `astro.config.mjs` (`site` and `base`)
- `src/styles/global.css` (`@font-face` `url("/canon/fonts/...")`: plain CSS
  can't read Astro's `BASE_URL`, so it's hardcoded)

The newsletter form is intentionally not wired up yet (see
`src/pages/newsletter.astro`): the page is live with a "not open yet" notice in
place of the form.

## Content

Skills live as MDX files in `src/content/skills/`, validated at build time
against the schema in `src/content/skillSchema.ts`. The gallery carries only
Canon's own skills.

`license` is **derived, never hand-typed**: `scripts/fetch-skill-trees.ts`
reads it from the GitHub API so it can't drift from the source. A skill whose
source states no license is marked `status: pending-license`, which hides it
everywhere it would be published, with no detail page and no listing.

See `docs/superpowers/specs/` for design specs, `docs/ROADMAP.md` for what's
next, and `docs/GO-TO-MARKET.md` for the launch plan.
