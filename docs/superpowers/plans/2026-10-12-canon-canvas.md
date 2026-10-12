# Canon Canvas: a look-and-feel experiment

Branch: `canvas-explore`. Status: first cut built 2026-10-12 at `/canon/app/`. Owner: James.

## The question

Does Canon feel better as a canvas, Paper and Lunagraph style, than as a
list and a CLI? This branch exists to answer that by touch, not argument.
It is an experiment: nothing here changes `main`, the CLI, or the plan of
record until James decides it should.

## Scope, revised 2026-10-12

James: the whole Canon interface should look like Paper and Lunagraph, not
one canvas page. So this branch builds the product app in that shape. The
marketing site and gallery are untouched.

The app, as surfaces:
- **Home.** Dark shell, left sidebar (workspace, search, boards, record,
  trash), a grid of boards with live thumbnails, and a first-run "Add your
  prototypes" panel with the ways in as cards.
- **Board.** The canvas below: frames you drop, drag, group and open.
- **Inspector.** Right panel, only when something is selected: name,
  source, device sizes, notes on that prototype.
- **Record.** The Strata view as a panel: every note across boards, with
  Said, Meant and Decided, filterable, exportable.
- **Focus.** One prototype full size, device widths, notes pinned on it.

These replace the scripted `v2-preview` screens as the picture of the
product if James likes them.

## What it is, in one sentence

A page on the Canon site where you drop prototypes onto a board, arrange
and group them, open any one live, and pin notes to it, with everything
kept in your browser and nothing uploaded.

## Ways in

1. **Drop an `.html` file.** Becomes a frame on the board.
2. **Drop a `.zip`.** Unpacked in the browser; its `index.html` (or the one
   you pick) becomes the frame, and relative CSS, JS and images resolve.
3. **Drop a folder** (or pick one). Same as a zip, read straight from disk.
4. **Link a folder on your machine** (Chromium only, via the File System
   Access API). Canon keeps a handle to, say, your repo's `dist/`, and
   re-reads it when you come back or press refresh. This is the "hot link
   to a repo" path. Safari and Firefox fall back to 3.
5. **Link a URL** (a running `localhost`, a preview deploy). An iframe
   pointed at it, no copy taken.

## What you can do once things are on the board

- Pan and zoom an infinite canvas; drag frames; resize.
- Frames show a live, scaled render of the prototype, named from the file
  or the page `<title>`, never "Frame 4".
- Group frames into sections (a flow, a round of options).
- Two arrangements: **freeform** (yours, saved) and **tidy** (a computed
  grid by section). Switching never destroys the freeform layout. This is
  D-32's Survey rule, at its smallest.
- Open a frame full size, at four device widths.
- Pin a note to a spot on a frame. Notes file as Strata drafts (Said, and
  optionally Meant), exportable as `.strata/*.md`.
- Export the whole board as one `.canon` file (a zip) and import it back.
  That is also how you share it, until there is a hosted version.

## The look

Lunagraph and Paper as references for feel, Canon's system for detail:
- Dark chrome by default, light available; content carries the colour.
- A left rail (boards, sections, layers), the canvas, a right inspector
  that appears only when something is selected.
- A first-run "Add your first prototype" panel with the ways in as cards,
  like Lunagraph's "Connect your agent".
- Canon's existing tokens, Public Sans, the mono labels, the fills-not-
  borders rule.

## How it works (no backend)

- **Storage:** IndexedDB. Files, board layout, notes. Survives reloads;
  lives only in that browser.
- **Rendering multi-file prototypes:** a service worker scoped to the
  canvas serves `/canon/canvas/p/<id>/<path>` straight from IndexedDB, so a
  zipped prototype's relative paths just work. Frames are sandboxed
  iframes (`allow-scripts`, no same-origin) so a dropped prototype cannot
  read Canon's storage.
- **Zip:** `fflate` (one small dependency, about 8KB), or the browser's own
  `DecompressionStream` if we want zero dependencies.
- **Linked folders:** `showDirectoryPicker()` handles stored in IndexedDB;
  permission re-asked on return, as the browser requires.
- **Where it lives:** `/canon/canvas/` on the existing Astro site. Static,
  deploys like the rest, costs nothing to host.

## Out of scope for the experiment

Accounts, sync between people, real-time collaboration, hosting uploads,
the CLI integration, MCP, Figma. Each is a later decision this experiment
should inform, not pre-empt.

## Build order

1. **Shell and canvas.** Route, dark chrome, rail, pan/zoom, empty state.
2. **Drop HTML.** IndexedDB store, frame render, drag and resize, persist.
3. **Zip and folders.** Unpack, service worker, entry picker.
4. **Organize.** Sections, rename, delete, tidy arrangement.
5. **Open and preview.** Full-size view with four device widths.
6. **Linked folder and URL frames.** File System Access with fallback.
7. **Notes.** Pins on frames, Strata draft export.
8. **Board export and import.**

1 to 3 are the "how does it feel" cut: enough to drop real NatureQuant
prototypes on a board and judge it. 4 to 8 follow only if that feels right.

## Risks

- **Many live iframes are heavy.** Past a dozen frames, render
  thumbnails (a captured image) when zoomed out and go live on focus.
- **Service workers on GitHub Pages** work, but scope must sit under
  `/canon/`. Tested in step 3 before anything is built on it.
- **File System Access is Chromium only.** Fallback is the folder drop.
- **Positioning drift.** A canvas pulls toward "design tool", the category
  Canon says it is not. The test is whether the canvas makes prototypes
  and feedback easier to find, not whether it makes them easier to draw.

## Built, first cut (2026-10-12)

At `/canon/app/`, `src/app/`, `public/app-sw.js`:
- Home: sidebar (search, Boards, Record, recent boards), the "add" panel
  with four ways in, a grid of boards with layout thumbnails. Dropping
  anywhere on home starts a new board.
- Board: pan (drag the canvas, two-finger scroll), zoom at the pointer
  (pinch or Cmd/Ctrl + scroll, + and -), fit (Shift+1), drag frames, live
  mode on double-click (Esc leaves), Free and Tidy arrangements, drop files
  at the pointer, Add menu (files, folder, linked folder, URL).
- Inspector: rename, source, size (Phone, Tablet, Desktop), Open, Refresh
  for linked folders, New tab, notes on that prototype, remove.
- Notes: N or the pin tool, click where it happened; Said word for word,
  a P code, an optional Meant. Exported as `.strata/*.md` in a zip.
- Focus: one prototype full screen at four widths.
- Record: every note, grouped by prototype, with a voice count.
- Verified in Chromium: sample board renders through the service worker,
  a zipped build's CSS and images resolve, state survives a reload.

Not yet: sections, multi-select, undo, board export/import, thumbnails
instead of live frames at low zoom, light theme, touch gestures.

**Security note:** frames run with `allow-same-origin` so the service
worker can serve them, which means a dropped prototype's scripts can read
this app's storage. Fine for your own prototypes, the same trust as opening
them locally. Anything shared or hosted later needs frames on a separate
origin.
