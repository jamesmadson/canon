# Canon MCP — design

Status: draft for James's review, 2026-10-23. Branch context: `canvas-explore`
(the Canon app at `/canon/app/`). Owner: James.

## Intent

James is building a prototype somewhere — Claude Code, another CLI, an agent —
and wants to talk to Canon from inside that session:

- "Add this to Canon" / "update my prototype in Canon"
- "Pull up my other prototype that's in Canon"
- "Give me the link to that view" — mostly a frame full screen at a width

Canon points at prototypes; it doesn't hold them. Prototypes live wherever the
user already runs them — a localhost dev server, or whatever preview method
their product or repo uses (Vercel preview, Netlify, a staging URL). Canon is
the board of links and views over them.

The why: people won't adopt "a new tool just for that" (P-16,
`.strata/2026-10-23-flow-review-agent.md`; also P-09, P-10). Canon has a
better chance arriving inside the agent session people already work in.

## The shape: a live bridge

Canon keeps its boards in the browser's IndexedDB with no backend
(`src/app/db.ts`). An outside program can't write there, so:

- The **Canon MCP** is a local program the agent starts (standard MCP over
  stdio). It also listens on a loopback port.
- The **open Canon tab** connects to that port and carries out what the MCP
  asks.
- Canon must be open (James: fine). If it isn't, the tool says so plainly and
  returns the link to open Canon. Nothing is queued silently.
- Nothing leaves the machine.

## Goals

1. **Add a prototype by URL** to a named board (or a new one), with a name.
   Any URL: `localhost:5173`, a hosted preview. Framed live, as URL frames
   are today.
2. **Update a prototype:** new URL, rename, move to another board. Same
   frame — position and notes kept.
3. **Versions as URL history.** An update that changes the URL keeps the old
   URL as a version you can flip back to (James: keep previous versions;
   never drop them). With per-commit previews every version still opens; a
   localhost URL always shows whatever is running now, and Canon says so on
   those frames.
4. **Find prototypes:** list boards and frames, search by name.
5. **Open a view:** the paired Canon tab navigates there; the agent also gets
   the link.
6. **Links to:** a board, a frame, a frame full screen at a width (the main
   one), a route inside the prototype, a version. Only boards have an
   address today (`#b/<board>`); the rest are new.
7. **Works with any MCP-speaking agent**, installed from the Canon npm
   package.

## Non-goals

- **Storing prototype files.** The MCP sends URLs, never builds. A user with
  only a `dist/` folder runs their own preview first (e.g. `npx serve dist`),
  or zips it and drags it into Canon themselves. Carrying files over the
  bridge stays out until users ask for it (James: add later if requested);
  if it comes back, it needs prototypes served from a separate origin first.
- **Sharing or hosting.** Links are for James on his machine for now.
- **Crawling a site** to map its pages.
- **A flow-walking screenshot agent** (what P-16 built). Separate, later.
- **Deleting** through the MCP. **Notes** through the MCP. Later, if at all.
- **Remote/cloud agents** — they can't reach a loopback port.

## Anti-goals

- Any web page, other program, or unpaired agent able to drive Canon.
- Anything uploaded anywhere.

## Security (James: important)

Prototypes on their own URLs are a different origin from Canon, so they
can't reach Canon's storage. What's left to guard is the bridge itself:

1. **Loopback only.** Bind `127.0.0.1`, never `0.0.0.0`.
2. **Origin and Host checked on every connection.** Accept only Canon's
   origin (`https://jamesmadson.github.io`; dev origins like
   `http://localhost:4321` only behind an explicit dev flag). Reject a Host
   that isn't `127.0.0.1:<port>`/`localhost:<port>` (DNS rebinding).
3. **Pairing, per agent.** First use, the MCP returns a one-time link,
   `…/canon/app/#pair=<port>.<token>` (fragment, so it never reaches a
   server). Canon asks "Connect Claude Code?" and stores the token on
   Approve. Each agent pairs separately; Canon lists them and revokes one at
   a time. MCP side kept in `~/.canon/`, mode 0600.
4. **The MCP proves itself to the tab** (challenge-response on the pairing
   secret), so a program that grabs the port first can't pose as the MCP.
   Other programs running as the same user are otherwise out of scope.
5. **Narrow tools.** Canon actions only. No file reading, no shell, no
   fetching URLs — the MCP passes URLs along, it never loads them.
6. **Tool results are data.** Board and frame names come back as data.

**Known, not fixed here:** files dragged straight into Canon (HTML, zips,
folders) are still served from Canon's own origin and can reach its storage,
including pairing tokens. A stolen token is worth only URLs and names, since
the MCP has no file access. Revisit before sharing.

## Claude's calls (James to check)

- Ships as `canon mcp`, a subcommand of the existing CLI (`cli/`, bin
  `canon`). Package name still unpicked (`cli/package.json` `_name`).
- No confirm on add/update (reversible via versions); Canon shows a brief
  "Added by Claude Code" notice.
- Finding the frame in a later session: by name via `canon_find`, or by
  matching the URL already on a frame.
- Notes record which version they were made on and show on every version,
  marked.
- "Open a view" navigates the tab and tries to focus it; the returned link is
  the reliable path.
- Tools (names refinable): `canon_status`, `canon_add`, `canon_update`,
  `canon_find`, `canon_open`, `canon_link`.
- Addresses (hash routes, matching `#b/<board>`):
  - `#b/<board>`
  - `#b/<board>/f/<frame>`
  - `#b/<board>/f/<frame>/full?w=390` (`w` = number or `fill`; presets
    390 / 834 / 1280 in `src/app/ui.ts`)
  - `…&path=/checkout` — route inside the prototype
  - `…&v=3` — a version (default latest)

## Left to the builder

- Transport (WebSocket, SSE + POST, …). The CLI has zero dependencies today;
  adding the MCP SDK or a WebSocket library is fine if stated in the plan.
- Several agent sessions at once, each its own MCP process: no port fights.
  Pick a scheme and say why.
- Several Canon tabs open: pick which acts; no stale state in the others.
- Browsers: Chromium primary; its local-network-access prompt is expected.
  Check Safari/Firefox for an https page reaching loopback; state what works.
  - Verified (Chrome, headless, 2026-10-24, `scripts/mcp-e2e.mjs`): the real
    `canon mcp --dev` over stdio against the dev Canon app. Pairing from a
    fresh page load, add, rename, URL change (version 2), open full screen at
    phone width, a link to version 1, two agents at once on ports 47800 and
    47801 against one tab. Closing the tab and Disconnect both returned a
    "not connected" answer within 3 s (about 2.5 s) after the fix round;
    after Disconnect the agent is told to run canon_pair, which pairs again.
  - Not tested: Safari, Firefox, and the production https origin
    (`https://jamesmadson.github.io`) reaching loopback, including Chrome's
    local-network prompt. None of these could be run here. Check them before
    release.
- IndexedDB migration for URL versions; existing data must survive.
- Tests: vitest for the pure parts (origin/host checks, address parsing,
  pairing); the MCP against a fake tab; one real run in Chromium.
