# Tester fixes, before the first invite

Approved by James on 2026-11-20 after the two audits of the live app and
the agent path. One branch, `canon-tester-fixes`, from main at dd40041.

The goal is that five designers can follow the invite without hitting a
dead end. Nothing here adds a feature beyond rename.

## Fixes

1. **Sites that refuse framing.** Links on hosts known to refuse being
   shown in a frame get `frameBlocked` set when a person adds them, the
   same flag an agent sets today (`bridge/ops.ts:340`), so the existing
   panel shows (`prototype.ts:29-35`, `:101`). Hosts: `v0.app`, `v0.dev`,
   `lovable.dev`, `figma.com`, and their subdomains. Keep the list in one
   small module with a test. The viewer notice for other links keeps one
   "Open in a new tab" button, not two (`prototype.ts:44` and `:201`).

2. **New version keeps the prototype.** `addVersion` (`shared.ts:139-147`)
   carries the name, star, note, tags and archive state onto the new
   version, the same fields `autoStack` carries (`store.ts:646-649`).

3. **Connecting an agent.**
   - The app says an agent is connected only after the first poll to its
     bridge succeeds. When Chrome blocks the request (local network
     access denied), it says: "Chrome is blocking Canon from reaching your
     agent. Allow local network access for this site, then reload."
   - An already open Canon tab handles a `#pair=` link arriving by
     `hashchange`, the same as a fresh load, instead of the toast.
   - In `cli/src/mcp/tools.js`, the not-connected and `canon_pair` text
     says to open the link in a new browser tab. No version bump: 0.1.1
     is unpublished and this lands in it.
   - The homepage Try the MCP panel becomes three numbered steps: add the
     server, open Canon in Chrome, ask the agent to connect and approve
     the link in a new tab, allowing Chrome's local network prompt. Codex
     and Cursor get their exact lines inline (copy them from the README),
     as tabs or a simple switch beside Claude Code.

4. **Phone width.** Under 760px the app shows one plain screen instead of
   a clipped layout: "Canon needs a wider window", a line saying to widen
   the window or open it on a laptop, and a Copy link button. No mobile
   menu. A prototype opened full screen from a shared link is out of
   scope.

5. **Address field.** `type="text"` with `inputmode="url"` (`ui.ts:86`),
   so bare hosts such as `example.org` reach `checkPrototypeUrl`.
   Problems show under the field, not in a toast, and the field is marked
   invalid for assistive tech. Wording: "Enter a web address, like
   example.com." Esc closes the dialog. The Canon-itself refusal also
   shows under the field.

6. **Notes are visible.** A prototype's note shows its first line on its
   row and card, muted, one line with an ellipsis and the full text in
   the prototype view. The project Notes tab's empty text stops pointing
   at boards when the project has none (`ui.ts:381`).

7. **Install.** Fix the gap in `useStore` (`shared.ts:60-63`) so a change
   that lands between first draw and subscribing still redraws; the
   Install Canon button (`sidebar.ts:114`) then shows on every eligible
   visit. On the homepage, one muted line under the hero's Open the app:
   "Install it from Chrome and it opens in its own window."

8. **Rename a prototype.** "Rename" in the row menu (`move.ts:125`) and
   in the prototype view. Inline field or the app's own small dialog,
   Enter saves, Esc cancels, an empty name is refused with a message.
   Also: an empty project name is refused with a message instead of
   silently ignored (`store.ts:195-201`).

9. **Cancel leaves nothing behind.** The first-run "My prototypes" project
   is created only once the dialog or picker returns something to add
   (`home.ts:223-227`), so cancelling keeps "Try the sample project".

## Queued, not in this branch

- **Check framing through the agent.** When an agent is connected, the
  local CLI reads a link’s `X-Frame-Options` and `frame-ancestors`
  headers (a preview URL read, allowed by CLAUDE.md) and sets
  `frameBlocked` for certain. Links it has checked drop the “blank
  below” line.

## Rules that bind every change

- CLAUDE.md: no runtime dependencies, Canon tokens, sentence case, no em
  or en dashes, curly quotes in text, errors say what happened and how to
  fix it, visible focus, 4.5:1 text, one motion curve.
- Tests in vitest for each fix. The full suite stays green.
- No widows: the last two words of a heading or short line are joined
  with a non-breaking space where it can wrap.

## Done when

Each fix has a test, the full suite passes, and James's controller has
walked every fix in a browser against a local build.
