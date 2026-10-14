# Handoff: where Canon stands (2026-10-14)

Pick-up notes for the next working session, on a local machine.

## State

- `main` is live at https://jamesmadson.github.io/canon/ (app at `/canon/app/`).
  `canvas-explore` matches `main`.
- Canon is a local-first prototype manager: library, version stacks, ⌘K,
  boards, page maps, notes. Decisions D-36 to D-45 in `docs/DECISIONS.md`.
- Durable storage: a Canon folder (`canon.json` + `prototypes/`) in Chromium
  browsers, `.canon` backup files everywhere (D-43).
- Run locally: `npm install && npm run dev`, then
  http://localhost:4321/canon/app/. Checks: `npm run check`, `npm test`,
  `npm run build`.

## Open items, in order

1. **Scrub AI authorship from history.** Run `scrub-history.sh` (sent in chat)
   on `canon` (main, canvas-explore) and `jamesmadson.me` (master). Then
   delete the stale branch: `git push origin --delete claude/canon-in-cloud-in2djc`.
2. **Repo About box** on GitHub: description "Every prototype, from every
   tool, in one place. A local-first prototype manager for designers. Open
   source, MIT." Website https://jamesmadson.github.io/canon/.
3. **Getting prototypes in, from any tool** (agreed plan, not built):
   - Paste a URL anywhere to add it, plus a "Send to Canon" bookmarklet
     (`#/add?url=`). Covers Paper, Figma Make, v0, Lovable, Vercel.
   - An inbox folder, `~/Canon/inbox/`, read when Canon gets focus: folders,
     zips, HTML, or a small link file.
   - A skill (plugin marketplace) that has agents write `canon.json` beside
     each prototype (name, version, parent, tool, url) and copy finished
     rounds to the inbox.
   - Later: `npx canon mcp`, a thin MCP wrapper over the inbox. Blocked on the
     npm package name (`canon` is taken).
4. **Tune auto-stacking** once used on real work. If it lumps different
   designs together, ask before stacking instead.
5. **NatureQuant gate (D-36):** hand them the app with real prototypes; if they
   don't reopen it unprompted within two weeks, stop investing.
6. **Desktop app (Tauri)** when the browser stops being enough. The headline
   reason: live previews of pages behind work SSO (D-44). Needs an Apple
   Developer account, $99 a year, to sign it.

## Small leftovers

- Homepage still has the "Send a link" sharing row; consider cutting it.
- The library's stack "sheet" behind phone-sized cards is landscape-shaped.
- Commits from here on: author James Madson, no co-author or session lines.
