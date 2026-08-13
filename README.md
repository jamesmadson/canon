# Canon

A curated, editorial gallery of design and design-engineering "skill" files for
AI coding agents (Claude, Cursor, Codex, Copilot) and design tools (Figma, Miro).
Formerly "Design Skills Gallery" — renamed Canon, as in an accepted body of
principles/work, echoing the Vignelli Canon that helped shape its visual system.

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

## Other commands

- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run test` — run the Vitest suite (schema, taxonomy, filter engine)
- `npm run check` — Astro type-check

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

The submit and newsletter forms are intentionally disabled for launch (see
`src/pages/submit.astro` and `src/pages/newsletter.astro`) — both pages are
live with a "not open yet" notice in place of the form.

## Content

Skills live as MDX files in `src/content/skills/`, validated at build time against
the schema in `src/content/skillSchema.ts`. See
`docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md` for the full
design spec.
