# Project 2: home, project view and the canvas bottom bar

Goal: the app opens on a Home that lists projects with their latest prototypes,
a project view that sorts and filters, a bottom bar on the canvas, and a first
run that shows only the agent setup line and a drop target.

Built on project 1 (names, tags, star, note, archive, summary and source are
already stored). Pure logic goes in `src/app/lib/` with unit tests. Components
take plain props so jsdom tests can render them without a database.

## Tasks

1. **Tokens, Geist, light and dark.** Light and dark tokens in `app.css`, Geist
   self-hosted like the other fonts, popovers and dialogs on tokens.
   Check: `tests/app/tokens.test.ts` (both schemes define every token, text
   pairs reach 4.5:1, input borders 3:1, a focus ring rule, reduced motion).
2. **Home model.** One card per prototype (current version), grouped by
   project, scoped (home, starred, archive, tag), sorted (updated, starred),
   filtered by tag, with tag counts and short date labels.
   Check: `tests/app/home-model.test.ts`.
3. **Search, keys, drop and the setup line.** Search ranking over name,
   summary, tags, source, project and note; arrow movement; links from a drop
   or a paste; the setup command.
   Check: `tests/app/home-search.test.ts`, `home-keys.test.ts`, `home-drop.test.ts`.
4. **Home screen.** Sidebar, list and shelf, first run, a search palette that
   opens from the keyboard alone, new routes for Starred, Archive and a tag.
   Check: jsdom tests: every control has a name, a cold open reaches a named
   prototype in three actions, 50 prototypes render in under a second, first
   run shows only the setup line and the drop target.
5. **Project view.** Grid or list, sort by updated or starred, filter by tag,
   star on each prototype, keeping versions, selection and board adding.
   Check: jsdom test of the project library.
6. **Canvas bottom bar.** Star, note, archive and zoom for the selected
   prototype on a board and in a multi-page view.
   Check: jsdom test of the bar and the store calls it makes.
7. **Drop moment.** A dropped zip lands in the first slot of its project row
   in shelf view with the zip animation; list view fades the row in; reduced
   motion shows the finished card.
   Check: CSS rule test for the timings and reduced motion, plus a jsdom test
   that the new card carries the arriving state.
8. **Verify and write up.** `VERIFY_BASE=c03cbd9 scripts/verify.sh`, questions
   in `docs/PROPOSED.md`.
