# Canon MCP, tab side, on the current app: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a paired agent, through the finished `canon mcp`, can add URL prototypes to a project's library and boards, add a new URL as a version in the prototype's existing version stack, find prototypes, open a view in Canon, and get deep links. It works against the current app (projects, a library, placements, version stacks, ⌘K, notes, vault).

**Architecture:** the bridge protocol stays exactly as it is (`/who`, signed `/poll`, ports 47800–47809, `TAB_ID`, the 64 KB body limit). The tab-side code from `canon-mcp` (`client.ts`, `ops.ts`, `address.ts`, `resolve.ts`, the pairing UI) is ported, and `ops.ts` and `address.ts` are rewritten for this app's model. The MCP side changes only in small ways: a `project` argument, project-aware `doneText`, a `project` lookup label, and `--dev-port`.

**Spec:** `docs/superpowers/specs/2026-10-23-canon-mcp-design.md`. Departures from it are listed under "Conflicts with the spec" and are deliberate.

---

## 1. How MCP concepts map onto the current model

| MCP | Current app | Decision |
|---|---|---|
| `project` (new, optional) | `Project` (`db.ts`); boards and the library belong to one | **For add:** exact name or id. If nothing matches, a project with that name is created (same rule as boards). If the argument is absent, the default is: the project of the board the add lands on (when `board` exactly matches one board anywhere), else the open project, else the only project, else a new "My prototypes" when there are none, else `{status:'many', what:'project'}`. **For lookups** (update, find, open, link): exact name, then a unique substring. If absent, all projects are searched. |
| "open project / board" | The route in the tab the user last focused (not necessarily the tab holding the bridge lock; see Task 7) | `projectOf` logic moves into ops as a pure helper |
| `board` | `Board` (`projectId`) | **For add:** exact name or id only. With `project` given, the search is limited to it, otherwise it spans all projects. One exact match: use it. Several: `many`, with candidates shown as `Name (Project)`. None: create the board in the default project. **For narrowing** (update, open, link): exact, then a unique substring, inside the project scope. |
| `frame` (prototype) | A **stack**: library `Frame` records sharing a `stackId` (or a single record). A board shows one member through a `Placement` | A `frame` lookup resolves to a stack. A match is the id of **any** member, then the exact name of any member, then a unique substring of any member's name. Versions of one stack never count as two matches. The candidates shown are the names of each stack's current version. Narrowing by `board` keeps only stacks that have a member placed on that board. |
| `version` | `versionOf(stack, id)`: 1-based, oldest first (`lib/versions.ts`) | The `version` argument picks that member of the stack. The default is `currentOf(stack)`. A number past the end is refused with a plain message. |
| URL change (`canon_update url`) | The **existing version stack**: a new `kind:'url'` Frame joins the stack and becomes current | **No URL-history field.** The app already stacks URL prototypes (Versions panel: "A running URL…"). Adding a second, parallel version scheme would split versioning in two. Every board spot that showed the previously current member is swapped to the new one, so positions are kept. Spots that deliberately show an older version stay as they are. The same URL as the current version is a no-op. Files stacks may also take a URL version, as the UI already allows. |
| Rename | `updateFrame` | Renames the current member only. |
| `moveTo` | Placements | Moves one placement: the one on `board` if given, else the only one. If the prototype is on several boards and `board` is not given, the reply is `many` with what `board`. If it is on no board, it is placed on the target. A target in another project is refused ("That board is in another project."). The library entry is never removed. |
| Deep links | Existing hash routes: `#/`, `#/p/<p>[/boards\|/comments]`, `#/b/<b>`, `#/f/<f>?from=&page=` (bundle) | They are extended in the same style (see below). There is **no `v=`**: a version is addressed by its member frame id, which stays stable when stacks change (make current, unstack, re-dating). |
| Auto-stacking on add | `addUrl` → `autoStack` by `urlStem` | **Off for MCP adds** (`stack:false`). The agent has an explicit way to make a version (`canon_update url`). Otherwise two different prototypes on `localhost:5173` would silently stack, and the new one would hide the old one as current. |

**Addresses (new `src/app/lib/address.ts`):**
- `#/b/<board>/f/<frameId>`: the board, with the placement holding that frame's stack selected and centred.
- `#/b/<board>/f/<frameId>/full?w=390&path=%2Fcheckout`: full screen on that board. `w` is a positive integer or `fill`. When absent, the prototype's own width is used.
- `#/f/<frameId>/full?w=…&path=…`: full screen for a prototype that is on no board, shown over its project. Closing goes to `#/p/<project>`.
- Every existing route parses exactly as it does now. Old `#b/x` links (no slash) and `canon-mcp` links (`#b/x/f/y/full?…&v=3`) still parse, and `v` is ignored.

---

## Global Constraints

- No new dependencies in the app or the CLI (`cli/package.json` `dependencies` stays `{}`).
- The bridge wire protocol, signing, pairing file and port range do not change. `tools/list` still has 7 tools with the same names.
- The MCP contract changes are only these: `project` on add/update/find/open/link; a `project` label in `LOOKUPS`; `doneText` naming the project, with or without a board; and `canon mcp --dev --dev-port <n>`.
- Prototype URLs are `http:` and `https:` only. They are checked in the MCP, again in `ops`, and again at render (`safeFrameUrl`).
- No deletes through the MCP. Moving a placement is not a delete.
- The MCP only ever sends URLs. No files cross the bridge.
- Agent secrets live only in the IndexedDB `agents` store. They are never in backups, the vault folder, toasts, logs or links (except the pairing link the MCP itself makes).
- DB upgrade to v3 is additive. Existing data survives every starting state (see Task 3).
- Every `/poll` answer is verified (role `mcp`, the stored secret, the echoed nonce, ts within 30 s) before anything runs. `#pair` is honoured only on initial load. Per-poll reply budget is 56 KB. Web Lock `canon-bridge`. Probing every 2 s when visible and 10 s when hidden, woken on focus or visibility. `pollAborts` keyed by port. These are ported unchanged.
- Links are absolute: `appBase + buildAddress(...)`, where `appBase = location.origin + location.pathname`.
- Commit messages are plain sentences like the existing history, with no prefixes and no attribution lines.
- Gate: `npm test` (both suites) and `npm run check`.

## Review Focus (ways a person could get hurt that no test pins)

1. **Pairing link handling** (DOM, untested). The `#pair=` secret must be read and cleared with `replaceState` synchronously at the top of `main.ts`, before any `await` (SW registration, `load`, `initVault`), so it never sits in history during boot. A `#pair` that arrives later by hashchange is cleared with a toast, never honoured. Cancel is autofocused. Replacing an existing pairing is called out (`pairNotice`).
2. **A prototype lands where the person isn't looking.** The defaults for project and board come from the last-focused Canon tab's route, not from the lock holder, which may be a stale background tab. Check that the `here` reports and `activeHash` really follow focus, and that `navigate` reaches that tab.
3. **A URL update loses a version, a board spot or notes.** `store.addUrlVersion` and `store.moveToBoard` run against IndexedDB, and only their pure parts (`swapsFor`) are tested. The old member, its notes and every other board's spot must survive. Only spots that showed the previously current member may change.
4. **The DB v3 upgrade hides or loses data.** Cases: a `canon-mcp` dev database (v2 with `agents` and no `projects`), an older tab still open, a database the service worker created empty. `upgradePlan` is tested. Running it in a real browser is not.
5. **A stale holder tab overwrites another tab's edits.** `updateFrame` writes `{...stateCopy, ...patch}`. The holder must apply any pending cross-tab reload (`refreshIfStale`) before running a batch, and every DB write must broadcast. Check that no write path bypasses `db.ts`.

Already pinned by tests: `javascript:`/`data:`/`file:`/`blob:` refused (tools, resolve, ops, `safeFrameUrl`); ambiguity never guessed; a `path` that would leave the prototype's origin refused; not-connected within 3 s; two sessions on two ports.

---

### Task 0: MCP server changes

**Files:**
- Modify: `cli/src/mcp/tools.js`, `cli/src/mcp/bridge.js`, `cli/src/mcp/index.js`, `cli/bin/canon.js`, `cli/src/commands.js` (USAGE)
- Test: `cli/tests/mcp-tools.test.js`, `cli/tests/mcp-bridge.test.js`, `cli/tests/commands.test.js` (or wherever `parseArgs` is tested)

**Interfaces:**
- `TOOL_DEFS`: add `project: str('Project name or id. Add uses the project open in Canon when this is left out; other tools search every project.')` to `canon_add`, `canon_update`, `canon_find`, and `OPEN_PROPS` (so open and link get it).
  - `frame` description: `'Prototype name or id.'`
  - `version` description: `'Version to open. 1 is the oldest in its stack.'`
  - `canon_status` description: `'Say whether Canon is connected, and which project and board are open.'`
- `LOOKUPS` gains `project: 'project'`.
- `doneText(op, res)`. It needs `res.frame` and `res.project` as strings. `res.board` is a string or null.
  - add with a board: `Added ${frame} to board ${board} in project ${project}.`
  - add without a board: `Added ${frame} to project ${project}. It isn't on a board.`
  - update with a board: `Updated ${frame} on board ${board} in project ${project}.`
  - update without a board: `Updated ${frame} in project ${project}.`
  - An update that made a version adds ` It is version ${version} now.` (when `res.newVersion === true`).
  - A result missing `project` falls back to today's two strings, so an older tab still renders.
- `startBridge({ ..., devPort = 4321 })`: dev origins become `http://localhost:${devPort}` and `http://127.0.0.1:${devPort}`.
- bin: `VALUE_FLAGS['--dev-port'] = 'devPort'`.
- `mcp(parsed, io)`: if `devPort` is set without `dev`, or is not an integer from 1024 to 65535, it writes `--dev-port needs --dev and a port number.` to stderr and returns 2. Otherwise `appBase = http://localhost:${devPort}/canon/app/`.

- [ ] **Step 1: Write the failing tests.**
  - `accepts project on add, update, find, open and link`: the bridge gets `project`.
  - `refuses project on canon_status`: text is `project is not an option for canon_status.`
  - `says which project matched nothing`: `Nothing matched project "Zed".`
  - `names the project an add or update landed on`: the four first lines above, plus the version suffix.
  - Keep `names the board an add or update landed on` passing for results without `project`.
  - bridge: `dev origins follow devPort`. With `devPort: 4322`, `localhost:4321` gets 403 and `localhost:4322` and `127.0.0.1:4322` get 200.
  - commands: `--dev-port 4322` parses to `devPort: '4322'`. `mcp({ devPort: '4322' })` without `dev` returns 2.
- [ ] **Step 2: Run them and see them fail:** `npx vitest run cli/tests/mcp-tools.test.js cli/tests/mcp-bridge.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit:** `Let agents name a project, say which project an add landed in, and run against a dev server on any port`

### Task 1: Addresses over the app's own routes

**Files:**
- Create: `src/app/lib/address.ts`
- Test: `tests/app/address.test.ts`

**Interfaces:**
```ts
export type ProjectTab = 'prototypes' | 'boards' | 'comments';
export type Width = number | 'fill' | null;
export type Address =
  | { name: 'home' }
  | { name: 'project'; project: string; tab: ProjectTab }
  | { name: 'board'; board: string; frame: string | null }
  | { name: 'bundle'; frame: string; from: string | null; page: string | null }
  | { name: 'full'; frame: string; board: string | null; width: Width; path: string | null };
export function parseAddress(hash: string): Address;   // '#/…', '#…' or bare; never throws
export function buildAddress(a: Address): string;       // always '#/…' ('#/' for home)
export function safePath(path: string): string | null;  // ported verbatim
export function joinPath(frameUrl: string, path: string | null): string; // ported verbatim
```

- [ ] **Step 1: Write the failing tests.**
  - `round-trips every shape`: home; project in each tab; board with and without a frame; bundle with `from` and `page`; full with a board at 390 with `/checkout`; full with no board and `fill`.
  - `reads today's routes as parseRoute did`: `#/` → home; `#/p/x` → prototypes; `#/p/x/boards`; `#/p/x/comments`; `#/b/x` → board with frame null; `#/f/x?from=b&page=a.html` → bundle; `#pair=…` → home; `#nonsense` → home.
  - `accepts the older slashless and canon-mcp forms`: `#b/x` → board, and `#b/x/f/y/full?w=390&v=3` → full with width 390 and no version field.
  - `bad width is null`: `w=-3`, `w=1.5`, `w=huge`.
  - `ids are encoded`: `a/b c` round-trips.
  - `safePath refuses anything that could leave the origin` and `joinPath keeps the frame origin`: ported, including the tab and newline cases.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit:** `Give boards, prototypes and full-screen views addresses in the app's own routes`

### Task 2: Resolving names and stacks, and checking URLs everywhere

**Files:**
- Create: `src/app/lib/resolve.ts`, `src/app/lib/sizes.ts` (move `SIZES` there; `shared.ts` re-exports it)
- Modify: `src/app/shared.ts`. `frameSrc` and `previewUrl` use `safeFrameUrl` for url frames.
- Modify: `src/app/ui.ts` `UrlDialog`. It uses `checkPrototypeUrl` and toasts its message. Today it accepts `javascript:`.
- Modify: `src/app/canvas.ts`. The Inspector's "Open" `href` goes through `safeFrameUrl`.
- Test: `tests/app/resolve.test.ts`

**Interfaces:**
```ts
export type Resolved<T> = { ok: true; item: T } | { ok: false; reason: 'none' | 'many'; matches: T[] };
export function resolveByName<T extends { id: string; name: string }>(items: T[], query: string, opts?: { exact?: boolean }): Resolved<T>; // ported
export function resolveStack<T extends { id: string; name: string }>(stacks: T[][], query: string): Resolved<T[]>;
export function checkPrototypeUrl(input: string): { ok: true; url: string } | { ok: false; message: string }; // ported, same message
export function safeFrameUrl(url: string | undefined): string; // http(s) href, else 'about:blank'
export function parseWidth(w: unknown): number | 'fill' | null; // ported; names from SIZES
```

- [ ] **Step 1: Write the failing tests.** Port every old `resolve.test.ts` case. Add:
  - `an exact name of any version finds its stack`
  - `versions of one stack never count as two matches`: `Today ring v1` and `Today ring v2` in one stack; `today ring` gives that stack.
  - `an id of an old version finds its stack`
  - `two stacks sharing a substring are ambiguous`: matches are both stacks.
  - `safeFrameUrl blanks anything but http and https`: `javascript:`, `data:`, an empty value, and `undefined` all give `about:blank`.
  - `named widths match SIZES`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit:** `Resolve prototypes by stack without guessing, and refuse non-web URLs wherever a URL can enter`

### Task 3: Database v3: agents, and a safe upgrade

**Files:**
- Modify: `src/app/db.ts`
- Test: `tests/app/db-upgrade.test.ts`, `tests/app/backup.test.ts`

**Interfaces:**
```ts
export const DB_VERSION = 3;
export interface Agent { id: string; name: string; secret: string; tabId: string; pairedAt: number }
export const STORES: Record<string, { keyPath: string; index?: string }>; // the existing 7 + agents
export function upgradePlan(existing: string[]): { create: string[]; migrateToProjects: boolean };
// migrateToProjects = existing has 'frames' and does not have 'projects'. Not oldVersion < 2,
// because a canon-mcp dev database is already at v2 and has no projects.
export function onWrite(fn: (store: string) => void): void; // see Task 4
```

`openDb` changes:
- `onupgradeneeded` applies `upgradePlan`.
- `onblocked` shows "Close other Canon tabs to finish updating." when nothing has rendered yet.
- `onversionchange` closes, sets `dbPromise = null`, and toasts "Canon was updated in another tab. Reload this one." It does this through a callback, so db does not import store.
- `onerror` resets `dbPromise`.

- [ ] **Step 1: Write the failing tests.**
  - `a new database gets every store and no migration`
  - `a service-worker-made empty database gets every store and no migration`
  - `a v1 database with frames migrates to projects`
  - `a canon-mcp v2 database (agents, no projects) gets projects and placements and migrates`
  - `a current v2 database gets only agents`
  - backup: `a backup carrying agents restores none`. `parseLibrary` of JSON with an `agents` array gives a library with no `agents` key.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** `npm run check` is clean.
- [ ] **Step 5: Commit:** `Keep paired agents in their own store, and upgrade any earlier database without losing prototypes`

### Task 4: Store: URL versions, moving a placement, cross-tab freshness

**Files:**
- Modify: `src/app/store.ts`, `src/app/lib/versions.ts`, `src/app/db.ts` (the write hook)
- Test: `tests/app/versions.test.ts`

**Interfaces:**
```ts
// versions.ts
export const isLocal: (url: string) => boolean; // localhost, 127.0.0.1, [::1], *.localhost
export function swapsFor<P extends { id: string; frameId: string }>(placements: P[], fromId: string): P[]; // spots showing fromId
// store.ts
export function addUrl(projectId: string, url: string, opts?: { boardId?: string; at?: {x:number;y:number}; name?: string; size?: {w:number;h:number}; stack?: boolean }): Promise<Frame>;
export function addUrlVersion(frameId: string, url: string): Promise<{ frame: Frame; added: boolean }>;
  // New kind:'url' frame. It takes the stack's current name and w/h, no cover, stack:false,
  // joinStack(new, current) and makeCurrent. Every swapsFor(placements, previousCurrent.id)
  // goes through swapOnBoard. The same URL as the current one returns { frame: current, added: false }.
export function moveToBoard(placementId: string, boardId: string): Promise<void>;
  // Same project only. If the target already shows this stack, the source placement is just removed.
  // Otherwise removeFromBoard, then placeOnBoard at nextSlot. Touches both boards.
export function watchOtherTabs(): void;    // BroadcastChannel('canon-app'), debounced 150 ms load(); replaces main.ts's reloadNotes listener
export function refreshIfStale(): Promise<void>; // runs a pending debounced load now
// db.ts: after every completed write transaction (put, putMany, remove, replaceFiles),
// post 'changed' on a lazily created 'canon-app' channel. Writes to 'agents' are skipped.
```

- [ ] **Step 1: Write the failing tests.**
  - `isLocal knows local hosts`: true for `http://localhost:5173`, `http://app.localhost`, `http://[::1]:3000`; false for `https://x.vercel.app`.
  - `swapsFor finds only the spots showing that version`: spots showing an older member are not returned.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Check by hand in the dev app: add a URL version from the agent, and every board showing the current version swaps; one showing v1 does not.
- [ ] **Step 4: Run them and see them pass.** `npm run check` is clean.
- [ ] **Step 5: Commit:** `Add a new URL as the next version in a prototype's stack, move a prototype between boards, and keep tabs in step`

### Task 5: Ops over the current store

**Files:**
- Create: `src/app/bridge/ops.ts`
- Test: `tests/app/bridge-ops.test.ts`

**Interfaces:**
```ts
export interface OpsDeps {
  state(): State;
  route(): Address;                        // last-focused tab's address
  createProject(name: string): Promise<Project>;
  createBoard(projectId: string, name: string): Promise<Board>;
  addUrl: typeof store.addUrl;             // always called with stack:false
  addUrlVersion: typeof store.addUrlVersion;
  updateFrame(id: string, patch: Partial<Frame>): Promise<void>;
  placeOnBoard(boardId: string, frameId: string): Promise<void>;
  moveToBoard(placementId: string, boardId: string): Promise<void>;
  navigate(hash: string): void;
  appBase: string; agentName: string; toast(msg: string): void;
}
export type OpResult = { ok: true; result: any } | { ok: false; error: string };
export function runOp(op: string, args: unknown, deps: OpsDeps): Promise<OpResult>;
export function openProjectId(route: Address, s: State): string | null; // board/frame/bundle/full → its project
```

**Results:**
- add and update: `{ frameId, frame, projectId, project, boardId|null, board|null, version, versions, newVersion?, link }`
- find: `{ projects: [{ id, name, boards: [{id,name}], prototypes: [{ id, name, kind, url|null, boards: string[], version, versions }] }], truncated? }`, capped at 200 prototypes
- open and link: `{ link }`
- status: `{ projects, boards, prototypes, openProject?, openBoard? }`

"Which one?" replies stay as `{ok:true,result:{status,candidates,what,query}}`, where `what` is `project`, `board`, `moveTo` or `frame`. Everything that can fail is settled before the first write. Name capped at 200 characters, width at 3840. Toasts: `<agent> added <name>` and `<agent> updated <name>`.

**Links:**
- A prototype on a board: `#/b/<b>/f/<id>`. The board is the given one, else the open board if it holds the stack, else the most recently updated board that holds it.
- On no board: `#/f/<id>/full`.
- With `full`, `width`, `path` or `version`: the full form. `path` only applies to `kind:'url'` members; others are refused with "Paths only work on URL prototypes."
- Without a frame: `#/b/<b>`, else `#/p/<p>`, else "Say which project, board or prototype."

- [ ] **Step 1: Write the failing tests** (in-memory fake deps).
  - **add:**
    - `makes a missing project and board, and names and sizes the prototype`: phone gives 390×844 from SIZES.
    - `with no project uses the open project and its open board`
    - `with several projects and nothing open asks which project and adds nothing`
    - `with no projects makes My prototypes`
    - `an exact board name in one project is used from any route`
    - `a board name in two projects lists both with their projects and adds nothing`
    - `a near board name makes a new board`
    - `with no board and none open leaves it in the library, linked full screen`
    - `never auto-stacks`: `addUrl` receives `stack:false`
    - `refuses a data: URL`
    - `caps names at 200 and widths at 3840`
  - **update:**
    - `a new URL becomes the next version and the old one stays`: `addUrlVersion` is called with the current id; the result has `version 2`, `versions 2`, `newVersion true`.
    - `the same URL adds nothing`
    - `versions of one stack resolve as one prototype; two stacks are ambiguous`
    - `an old version's id still finds its stack`
    - `rename touches the current version only`
    - `moveTo moves the one placement; with two boards and no board it asks which`
    - `moveTo another project's board is refused and nothing changes`
    - `says which lookup failed: project, board, moveTo, frame`
    - `a bad moveTo with a new URL writes nothing`
    - `refuses a javascript: URL`
  - **open and link:**
    - `open navigates and replies with the absolute link`
    - `full at phone width with a path builds #/b/b1/f/f1/full?w=390&path=%2Fcheckout`
    - `version picks that member, oldest first; past the end is refused`
    - `a prototype on no board links to #/f/<id>/full`
    - `a path leaving the prototype is refused`
    - `a path on a files prototype is refused`
    - `link does not navigate`
  - **find and status:**
    - `find lists projects, boards and one row per stack`
    - `find matches project, board, any version's name and URL, case-insensitively`
    - `find stops at 200 and says truncated`
    - `status names the open project and board`
    - `an unknown op fails plainly`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit:** `Let a paired agent add, version, move, find and open prototypes across projects`

### Task 6: The bridge client, ported

**Files:**
- Create: `src/app/bridge/client.ts`, ported from `git show canon-mcp:src/app/bridge/client.ts`
- Test: `tests/app/bridge-client.test.ts`, ported

**What changes from canon-mcp:**
- `opsDeps` maps to the Task 4 and Task 5 store functions.
- Before running a non-empty command batch: `await store.refreshIfStale()`.
- `route()` and `navigate()` go through Task 7's active-tab tracking.
- Everything else is kept verbatim: `parsePairLink`, `fitReplies` (56 KB), `pairNotice`, `checkResponse` (role `mcp`, stored secret, echoed nonce, 30 s), `stalePolls`, `pollAborts` keyed by port, `probeDelay` 2 s / 10 s, `wakeProbes` on focus and visibility, Web Lock `canon-bridge`, the BroadcastChannel `canon-bridge` messages `agents`/`ask`/`status`, `saveAgent` keeping `tabId`, `removeAgent`, and stopping mid-batch when the agent is removed.

**Additions:**
```ts
type Msg = … | { type: 'here'; tab: string; hash: string; at: number } | { type: 'gone'; tab: string } | { type: 'navigate'; tab: string; hash: string };
export function activeHash(reports: Map<string, { hash: string; at: number }>, own: { tab: string; hash: string; at: number }): { tab: string; hash: string }; // latest `at` wins
export function acceptNavigate(hash: string): boolean; // starts '#/', not a pair link, parseAddress not home-by-error
```
Every tab posts `here` on load, hashchange, focus, and on becoming visible. It posts `gone` on pagehide. The holder's `navigate` either sets its own hash (then `window.focus()`) or posts `navigate` to the active tab. That tab checks `acceptNavigate` before setting its hash.

- [ ] **Step 1: Write the failing tests.** Port every old case (`checkResponse` ×6, `fitReplies` ×3, `pairNotice` ×2, `parsePairLink` ×3, `probeDelay`, `stalePolls` ×2). Add:
  - `the most recently focused tab is the active one`
  - `navigate refuses pair links and anything outside the app's routes`: `#pair=…`, `javascript:`, `#x` are refused; `#/b/b1` is accepted.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit:** `Let the open Canon tab carry out a paired agent's commands, acting where the person last looked`

### Task 7: Routing, Focus, pairing and agents in the current UI; main.ts wiring

**Files:**
- Modify: `src/app/ui.ts`, `src/app/canvas.ts`, `src/app/main.ts`, `src/app/app.css` (port the `.agent` and `.dot` rules)

**Behaviour:**
- `parseRoute` becomes `parseAddress(location.hash)`. `projectOf` and the sidebar `aria-current` use the new shapes. The `frame` route becomes `bundle`.
- `BoardView({ id, frameId, full, askUrl })`:
  - `frameId` selects the placement whose frame is in that stack and centres it once. Port the old `centred` ref and the `tidyWas` effect so a tidy board does not refit over the centring.
  - `full` opens Focus on that member, even if the spot shows another version.
  - Enter and Open on a single-page prototype `go(buildAddress(full))` rather than setting local state.
  - Close goes to `#/b/<id>`.
- `App`: `full` with board null renders `ProjectView` for the frame's project, with Focus over it. Close goes to `#/p/<project>`.
- `Focus({ frame, page?, onClose, address? })`:
  - With `address`, width comes from it (`null` means `frame.w`), and changes use `history.replaceState` plus a dispatched `hashchange`.
  - A url frame's src is `joinPath(safeFrameUrl(frame.url), address.path)`.
  - When the stack has more than one member, a `select[aria-label=Version]` switches member by replacing the address.
  - A localhost member that is not current shows: `This is localhost, so it shows what's running now, not v<n>.`
  - A "Copy link" button copies the absolute link.
  - Callers that don't pass `address` (Library, ⌘K, BundleView) keep their local state.
- `main.ts`, at the top, before `boot()`:
  - `const pairAtLoad = takePairLink();` reads with `parsePairLink`, clears with `replaceState`, and on `'bad'` toasts after load.
  - In `boot()`: replace the `reloadNotes` channel line with `watchOtherTabs()`, render `App` with `{ pairAtLoad }`, then call `startBridgeClient({ appBase: location.origin + location.pathname })`.
- `App`:
  - Shows `PairDialog` for `pairAtLoad`, ported: `#pair-title` reads "Connect <name> to Canon?"; copy: "It will be able to add prototypes to your projects, add versions, move them between boards and open views. It can't delete anything or read your files."; the `pairNotice` alert; Cancel autofocused; `role="dialog" aria-modal`.
  - A later `#pair` hashchange is cleared with the toast "Open the pairing link in a new tab to connect an agent."
- `Sidebar`: an `Agents` section above `rail-foot`, ported. It has a state dot (Connected, Connecting, Not connected), and Disconnect asks for confirmation.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify by hand.** Run `npm run dev` and open `#/b/<b>/f/<id>/full?w=390&path=%2Fabout` by hand. Focus opens at 390 on `/about`. Switching to Desktop sets the hash to `w=1280`, and Back does not step through widths. On a tidy board, a frame link stays centred. `#/f/<id>?from=…&page=…` still opens the bundle. ⌘K and the Library Focus are unchanged. `npm run check` is clean and `npm test` is green.
- [ ] **Step 3: Commit:** `Open any board, prototype or full-screen view from a link, and pair agents from the sidebar`

### Task 8: End to end on a chosen port, and notes

**Files:**
- Modify: `scripts/mcp-e2e.mjs`
- Modify: the spec's "Left to the builder" section

**Script changes:**
- `--port <n>` (or `CANON_E2E_PORT`; default 4321). This sets `APP = http://localhost:${n}/canon/app/` and spawns the MCP with `['mcp','--dev','--dev-port',n]`. `--cdp-port` defaults to 9340.
- The header says to run `PORT=<n> npm run dev -- --host 127.0.0.1`.
- The test prototype URL is `http://127.0.0.1:${n}/canon/`, so it is not on the app's own origin.

**Flow:**
1. Unpaired add gives a pair link; pair; status answers.
2. `canon_add` with `project:'MCP e2e'`, `board:'MCP test'`. The first line is `Added Canon home to board MCP test in project MCP e2e.`
3. Rename.
4. URL change. The first line ends `It is version 2 now.`, find shows `"versions": 2`, and the board label shows `v2/2`.
5. Open full at phone width. The hash matches `#/b/…/f/…/full?w=390`.
6. Link with `version:1`, opened in a new page. The `.focus iframe` src is v1's URL and the Version select shows 1.
7. Make a second project with a board also called "MCP test". An add with `board:'MCP test'` and no project gives `More than one match for board "MCP test".`
8. The existing failure paths, unchanged: close the tab (under 3 s), reopen and reconnect, a second agent on the next port, Disconnect (says to run canon_pair), re-pair, the other agent unaffected.

- [ ] **Step 1: Update the script, then run it** (`node scripts/mcp-e2e.mjs --port 4322`) until it reports ALL PASSED.
- [ ] **Step 2: Update the spec's verified note** to this app and this script.
- [ ] **Step 3: Commit:** `Drive the agent end to end against the project and stack model, on any dev port`

Order: 0 and 1 to 3 can run in parallel. Then 4, then 5, then 6, then 7, then 8.

---

## Conflicts with the spec (flagged)

1. **"Canon points at prototypes, never stores files"** versus the library and vault storing builds. The MCP still only sends URLs. A URL prototype here is a `Frame` with `kind:'url'` and `url`. It has no stored files, except an optional cover screenshot the person adds. It goes into backups and the vault as JSON only. Nothing in this plan carries files.
2. **Goal 3, "versions as URL history":** replaced by the app's version stacks. Each URL version is its own library record, and the old one is always kept.
3. **"Same frame, position and notes kept"; "notes … show on every version, marked":** positions are kept by swapping placements. Notes in this app belong to the version record they were made on, so they show when you switch back to that version, not on every version. The plan keeps the app's behaviour. (Open question 1.)
4. **The spec's addresses** (`#b/<board>/f/<frame>/full?…&v=3`): this plan uses the app's `#/b/…` style, puts the member id in place of `v=`, and adds `#/f/<id>/full` for prototypes on no board, because `#/f/<id>` already means the bundle view.
5. **"Move to another board":** a prototype can be on several boards, so a move is of one placement, and the reply asks which board when that isn't clear.
6. **The spec's known issue gets wider:** stored prototypes (and `public/app-comments.js`) run on Canon's origin and can open the `canon-app` database, including the `agents` store. Same exposure as before, still unfixed.
7. **Existing app holes the MCP would make worse, fixed in Task 2:** `UrlDialog` accepts any scheme (`new URL(value)`), and restored backups can carry any `url`. Both now go through `checkPrototypeUrl` and `safeFrameUrl`.
8. **Database version collision:** `canon-mcp` dev databases are v2 with `agents` and no `projects`. Today's `oldVersion < 2` check would skip the projects migration for them. Task 3 fixes this. `canon-mcp` was never on `main` (local `canvas-explore` equals `canon-mcp`), so only dev browsers on `localhost:4321` are affected. Old `Frame.versions` arrays are ignored, not converted.

## Open questions (only where a wrong guess matters)

1. Should notes show across a whole stack (the spec) or stay per version (the app, and this plan)? Changing it later means migrating where notes are keyed.
2. An add with no board while no board is open goes into the library only. The alternative is the old behaviour of creating "Untitled board". This decides where an agent's adds pile up.
3. MCP adds don't auto-stack. Confirm. If James wants auto-stacking, `ops` should at least report `stackedWith` so the agent can say what happened.

### Critical Files for Implementation
- /Users/jamesmadson/Documents/GitHub/designskills/src/app/bridge/ops.ts (new; ported and rewritten from canon-mcp)
- /Users/jamesmadson/Documents/GitHub/designskills/src/app/store.ts
- /Users/jamesmadson/Documents/GitHub/designskills/src/app/db.ts
- /Users/jamesmadson/Documents/GitHub/designskills/src/app/ui.ts (with /Users/jamesmadson/Documents/GitHub/designskills/src/app/canvas.ts for BoardView and Focus)
- /Users/jamesmadson/Documents/GitHub/designskills/cli/src/mcp/tools.js (with bridge.js and index.js for `--dev-port`)
