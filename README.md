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

## Before deploying

- Replace `YOUR_FORM_ID` in `src/pages/submit.astro` with your real Formspree form ID.
- Replace `YOUR_USERNAME` in `src/pages/newsletter.astro` with your real Buttondown username.

## Content

Skills live as MDX files in `src/content/skills/`, validated at build time against
the schema in `src/content/skillSchema.ts`. See
`docs/superpowers/specs/2026-07-29-design-skills-gallery-design.md` for the full
design spec.
