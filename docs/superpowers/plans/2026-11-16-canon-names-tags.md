# Names, metadata, automatic tags, star and note: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every prototype carries a name, summary, source, tags, star, note and archive flag, and the MCP tools read, write and search them.

**Architecture:** The boards live in the browser tab (`src/app/`), so the fields are stored there on `Frame` and handled in `bridge/ops.ts`. The MCP process (`cli/src/mcp/`) reads what only it can reach (the page at the URL, and `.git` in its working directory), checks names, and forwards everything to the tab. Tag rules are pure functions in `src/app/lib/tags.ts`.

**Tech stack:** Plain JavaScript on Node built-ins in `cli/`, TypeScript in `src/app/`, vitest.

**Spec:** `docs/superpowers/plans/2026-11-13-canon-next-six-projects.md` on `alpha`, section “Project 1”. Answers to open questions: `docs/PROPOSED.md`. Rules: `docs/BRIEF.md`.

## Global constraints

- No runtime dependencies in `cli/`. Imports are `node:` modules and local files only.
- No AI model. Tags come from page title, headings, agent name, repo and branch.
- The only network call is one GET of the prototype's own URL from the MCP process.
- Every new stored field is optional. `DB_VERSION` stays 3 and `LIBRARY_VERSION` stays 1.
- No em dashes or en dashes in any text. Sentence case. People read “prototype”, not “frame”, in new text.
- Commit with explicit paths. No attribution lines. Never push.
- Never bind ports 4410, 4321, 4400, 4500, 8091 or 8093. Tests use port 0.
- Run tests from the repository root: `npx vitest run <file>`.

## Review focus

1. A page that never answers: `canon_add` must still add within about 3 seconds, with only the source tag.
2. A huge or non-HTML response (a 50 MB file, a PNG): the read stops at the cap and yields nothing.
3. A board saved before this project: `find`, `update`, `open` on frames with none of the new fields must work and must not write the fields unasked.
4. Tags that differ only by case, spacing or punctuation (“Pricing”, “ pricing ”, “pricing!”) are one tag.
5. An agent passing `tags` that is not a list of text, or 500 tags, gets a plain refusal before anything is written.

---

## The contract between the two halves

The MCP process sends these to the tab. Task 2 implements the tab side, task 4 the MCP side. Both must match this exactly.

`add` args: `url, name, project, board, width` (as today) plus
`summary: string`, `tags: string[]`, `repo: string`, `branch: string`, `starred: boolean`, `note: string`, and `page: { title: string, headings: string[] }` (added by the MCP process, never by the agent).

`add` result: today's fields plus `summary` (if set), `tags: string[]`, `names: string[]` (the names of the other prototypes in the project, newest first, at most 50).

`update` args: `project, frame, board, url, name, moveTo` (as today) plus `summary, repo, branch, starred, note` as above, `archived: boolean`, `tags: string[]` (to add), `removeTags: string[]`, and `page` (sent only when `url` is sent).

`update` result: today's fields plus `tags: string[]`.

`find` args: `project, query` plus `tag: string`, `starred: boolean`, `archived: boolean`.

`find` row: today's fields plus, only when set, `summary`, `tags`, `starred: true`, `note`, `archived: true`, `repo`, `branch`; and always `created` and `updated` as ISO strings.

---

### Task 1: tag rules and stored fields

**Files:**
- Modify: `src/app/db.ts` (the `Frame` interface)
- Create: `src/app/lib/tags.ts`
- Test: `tests/app/tags.test.ts`

**Interfaces (produces):**

In `db.ts`, add to `Frame`, all optional, with one doc comment saying they belong to the prototype across its versions:

```ts
summary?: string; repo?: string; branch?: string; tool?: string;
tags?: string[]; removedTags?: string[]; starred?: boolean; note?: string; archived?: boolean;
```

and export `type FrameMeta = Pick<Frame, 'summary' | 'repo' | 'branch' | 'tool' | 'tags' | 'removedTags' | 'starred' | 'note' | 'archived'>`.

In `tags.ts`:

```ts
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 40;
/** Lower case, punctuation other than - and / dropped, spaces collapsed, cut to MAX_TAG_LENGTH. '' when nothing is left. */
export function normalizeTag(raw: string): string;
/** The existing tag to use in place of candidate, or candidate. Words match when one tag's significant words are all in the other's. */
export function reuseTag(candidate: string, existing: string[]): string;
export interface TagSources { title?: string; headings?: string[]; tool?: string; repo?: string; branch?: string }
/** Candidate tags in order: tool, repo, branch, title, headings. Not yet matched against a project. */
export function autoTags(src: TagSources): string[];
/** The tags a prototype ends with after an add or an update. */
export function mergeTags(input: { current?: string[]; removed?: string[]; auto?: string[]; passed?: string[]; projectTags?: string[] }): { tags: string[]; removedTags: string[] };
/** A person adds or removes one tag. Removing records it so automatic tagging does not bring it back. */
export function addTag(meta: { tags?: string[]; removedTags?: string[] }, tag: string, projectTags?: string[]): { tags: string[]; removedTags: string[] };
export function removeTag(meta: { tags?: string[]; removedTags?: string[] }, tag: string): { tags: string[]; removedTags: string[] };
/** A source tag for a link added by hand: 'localhost', or the name before the public suffix ('foo.vercel.app' gives 'vercel'). '' if unreadable. */
export function hostTag(url: string): string;
```

Rules the tests pin:

- `normalizeTag('  Pricing!  Page ')` is `'pricing page'`. `normalizeTag('feat/annual-toggle')` keeps `/` and `-`. `normalizeTag('!!!')` is `''`.
- Significant words drop these stop words: a, an, the, and, or, of, for, to, in, on, with, my, our, your, page, app, site. A trailing `s` is ignored when comparing (“prices” matches “price”). If a tag has only stop words, its words are compared as they are.
- `reuseTag('pricing page', ['pricing'])` is `'pricing'`. `reuseTag('pricing', ['pricing page'])` is `'pricing page'`. `reuseTag('Pricing', ['pricing'])` is `'pricing'`. `reuseTag('checkout', ['pricing'])` is `'checkout'`. An exact match wins over a word match.
- `autoTags`: tool, repo and branch each become one tag by `normalizeTag`. Branches `main`, `master`, `HEAD`, `trunk`, `develop` give none. The title is split on ` | `, ` - `, ` · `, `: ` and only the first part is used. A title part or heading becomes a tag when it has 1 to 3 significant words; the tag is those words joined by spaces. Longer ones are skipped. These whole phrases are skipped: document, untitled, home, index, welcome, hello world, react app, vite app, vite + react, vite + react + ts, next app, create next app, localhost. At most 3 heading tags. At most 6 tags in all. No duplicates.
- `autoTags({})` is `[]`. `autoTags({ tool: 'Claude Code' })` is `['claude code']`.
- `autoTags({ title: 'Pricing | Acme', headings: ['Choose a plan', 'Frequently asked questions about billing and invoices'], tool: 'Cursor', repo: 'acme-web', branch: 'feat/annual-toggle' })` is `['cursor', 'acme-web', 'feat/annual-toggle', 'pricing', 'choose plan']`.
- `mergeTags`: start from `current`. Add each `passed` tag (through `normalizeTag` then `reuseTag` against `projectTags` plus the tags so far) and take it out of `removed`. Then add each `auto` tag the same way unless its normalized form, or the tag it reuses, is in `removed`. Stop at `MAX_TAGS`. Empty tags are dropped. Order is kept; no duplicates.
- `mergeTags({ current: ['pricing'], removed: ['cursor'], auto: ['cursor', 'checkout'] })` gives tags `['pricing', 'checkout']` and removedTags `['cursor']`.
- `mergeTags({ removed: ['cursor'], passed: ['Cursor'] })` gives tags `['cursor']` and removedTags `[]`.
- `mergeTags({ auto: ['pricing page'], projectTags: ['pricing'] })` gives tags `['pricing']`.
- `removeTag({ tags: ['a', 'b'] }, 'A')` gives tags `['b']`, removedTags `['a']`. Removing a tag that is not there changes nothing.
- `addTag({ tags: ['b'], removedTags: ['a'] }, 'A')` gives tags `['b', 'a']`, removedTags `[]`.
- `hostTag('http://localhost:5173/x')` and `hostTag('http://127.0.0.1:3000')` are `'localhost'`. `hostTag('https://foo.vercel.app/')` is `'vercel'`. `hostTag('https://www.figma.com/proto/1')` is `'figma'`. `hostTag('https://team.github.io/x')` is `'github'`. `hostTag('nope')` is `''`. The rule: take the host, drop a leading `www.`, and use the label before the last one, or before the last two when the last two are a known pair (`co.uk`, `com.au`, `co.jp`, `co.nz`, `com.br`).

- [ ] **Step 1:** Write `tests/app/tags.test.ts` with one test per rule above. Run `npx vitest run tests/app/tags.test.ts`. Expected: fails, module not found.
- [ ] **Step 2:** Add the fields to `Frame` and write `src/app/lib/tags.ts`.
- [ ] **Step 3:** Run `npx vitest run tests/app/tags.test.ts` and `npx tsc --noEmit -p .` (or `npm run check` if tsc alone is not set up; report which). Expected: pass, and no new type errors in the files you touched.
- [ ] **Step 4:** Commit `src/app/db.ts src/app/lib/tags.ts tests/app/tags.test.ts` with the message “Prototypes can carry a summary, source, tags, a star, a note and an archive flag, with the rules for automatic tags.”

### Task 2: the tab reads, writes and searches the fields

**Files:**
- Modify: `src/app/bridge/ops.ts`, `src/app/store.ts`, `src/app/bridge/client.ts` (the `opsDeps` wiring only)
- Test: `tests/app/bridge-ops.test.ts` (extend; its `fake()` store needs the new action), `tests/app/old-boards.test.ts` (create), `tests/app/fixtures/library-before-metadata.json` (create)

**Interfaces:**
- Consumes: everything task 1 produces.
- Produces: the tab side of “The contract between the two halves” above.

**store.ts**

- `addUrl` opts gain `meta?: FrameMeta`. The frame is built with `...opts.meta`. When `opts.meta?.tags` is undefined, tags default to `mergeTags({ auto: [hostTag(url)], projectTags })` (a link added by hand). `projectTags` is every tag on frames of that project.
- `addUrlVersion` copies the current version's `FrameMeta` fields onto the new version.
- New actions, each applying to every version in the prototype's stack through `updateFrame`:
  `updateMeta(frameId: string, patch: FrameMeta): Promise<void>`, and for the person (used by project 2's controls) `setStarred(id, starred: boolean)`, `setNote(id, note: string)`, `setArchived(id, archived: boolean)`, `tagPrototype(id, tag: string)`, `untagPrototype(id, tag: string)`. The two tag actions use `addTag` and `removeTag` from `tags.ts`.
- `OpsDeps` gains `updateMeta(frameId: string, patch: FrameMeta): Promise<void>`, wired in `client.ts` to `store.updateMeta`.

**ops.ts**

- Limits: summary 300 characters, note 2000, repo and branch 200, at most 20 entries in `tags` or `removeTags`, each a string. `page.title` is cut to 300, `page.headings` to the first 20 strings, each cut to 200. Anything of the wrong type in `tags`, `removeTags`, `starred`, `archived` is refused with a message naming the field, such as “tags must be a list of text.” A malformed `page` is ignored, never refused.
- `add`: all checks happen before the first write. Tags are `mergeTags({ auto: autoTags({ ...page, tool: deps.agentName, repo, branch }), passed: args.tags, projectTags })`. `tool` is stored as `deps.agentName`. The meta goes to `deps.addUrl` as `opts.meta`. The result adds `summary` (if set), `tags` and `names`.
- `update`: reads meta from the stack's current version. `tags` and auto tags (only when `page` came with a new `url`) go through `mergeTags` with `current` and `removed` from the frame. Each entry of `removeTags` goes through `removeTag`. Removals apply after additions. One `deps.updateMeta` call, only when something changed. A changed field counts for the “updated” toast. The result adds `tags`.
- `find`: `query` matches name, URL (as today), summary and any tag. `tag` keeps prototypes holding that tag after `normalizeTag`, or the tag `reuseTag` maps it to. `starred: true` keeps starred ones; `starred: false` keeps unstarred ones. Archived prototypes are left out unless `archived: true`, which shows only them. When `tag`, `starred` or `archived` is given, a project name or board name match no longer pulls in every prototype of that project: only prototypes passing the filters are listed. Meta is read from the stack's current version.
- Frames with none of the new fields behave as: no summary, no tags, not starred, no note, not archived.

**Tests to add (names are the assertions):**

In `bridge-ops.test.ts`:
- “find with the query pricing returns a prototype whose summary mentions pricing and whose name does not” (name `Plans, annual toggle`, summary `The pricing page with yearly billing on by default.`).
- “find searches tags”, “find filters by tag, and a near tag finds the project's own tag”, “find filters by starred”, “find leaves archived prototypes out, and archived: true shows only them”.
- “add stores summary, source, star and note, and returns the names already in the project”.
- “add merges the agent's tags with automatic ones from the page, the agent, the repo and the branch”.
- “add with no page gets only the source tag” (tags equal `['agent']` for an agent named `Agent`).
- “add reuses a tag the project already has” (project has `pricing`; page title `Pricing page`; result has `pricing` once and no `pricing page`).
- “add refuses tags that are not a list of text, before writing” (the fake's `writes` stays empty).
- “update removes a tag and it stays removed when a new URL brings it back”.
- “update sets star, note and archive across every version”.
- “a prototype saved before these fields can be found, updated and opened, and gains no fields it was not given”.

In `old-boards.test.ts`, with a fixture written in today's shape (two projects, two boards, three frames of kinds url, files and linked, one two-version stack, placements, notes with replies, files; none of the new fields):
- “a library saved before metadata parses with every record deep-equal to the file”.
- “a library with the new fields round-trips through toLibrary and parseLibrary unchanged”.
- “DB_VERSION is still 3 and LIBRARY_VERSION is still 1”.

- [ ] **Step 1:** Write the tests. Run both files. Expected: the new ones fail.
- [ ] **Step 2:** Implement store, ops and the `client.ts` wiring.
- [ ] **Step 3:** Run `npx vitest run tests/app` and the type check. Expected: all pass.
- [ ] **Step 4:** Commit the files listed above, by path, with the message “The tab stores a prototype's summary, source, tags, star, note and archive flag, and find searches and filters by them.”

### Task 3: what the MCP process reads and checks

**Files:**
- Create: `cli/src/mcp/page.js`, `cli/src/mcp/source.js`, `cli/src/mcp/naming.js`
- Test: `cli/tests/mcp-page.test.js`, `cli/tests/mcp-source.test.js`, `cli/tests/mcp-naming.test.js`

**Interfaces (produces):**

```js
// page.js
/** Title and h1/h2 text from HTML, tags stripped, entities &amp; &lt; &gt; &quot; &#39; &nbsp; decoded, whitespace collapsed. script, style and comments are ignored. */
export function extractPage(html) // -> { title: string, headings: string[] }  (headings: at most 20, each at most 200 chars; title at most 300)
/** One GET. Null when the page cannot be read: not 2xx, not text/html, slower than timeoutMs, or any error. Reads at most maxBytes, then stops. */
export async function readPage(url, { fetchImpl = globalThis.fetch, timeoutMs = 3000, maxBytes = 512 * 1024 } = {}) // -> { title, headings } | null

// source.js
/** Repo and branch of the git checkout holding dir, read from files. {} when there is none. */
export function readSource(dir = process.cwd()) // -> { repo?: string, branch?: string }

// naming.js
export const NAMING_RULE = 'Name it for what it is, then what is different, such as "Pricing page, annual toggle".';
/** A warning sentence for a name that is a bare URL, a file name, or a placeholder word with an optional number. Null when the name is fine. */
export function nameWarning(name) // -> string | null
/** True when a name has the shape the rule asks for: two non-empty parts around the first comma, and no warning. */
export function followsNamingRule(name) // -> boolean
```

Rules the tests pin:

- `readPage` sends `accept: text/html`, no cookies or other headers, follows redirects, and aborts with an `AbortController` at `timeoutMs`. It reads the body as a stream and stops at `maxBytes`. The whole call, body included, ends by the timeout. Tests use a real `node:http` server on port 0: a normal page; a page that never answers (with `timeoutMs: 200`, resolves null in under 1 second); a body that never ends (same); a PNG content type (null); a 404 (null); a body larger than `maxBytes` whose title is in the first bytes (title is read).
- `extractPage('<title>Pricing &amp; plans</title><h1>Choose <em>a</em> plan</h1><script>var h="<h1>no</h1>"</script><h3>skip</h3><h2>FAQ</h2>')` is `{ title: 'Pricing & plans', headings: ['Choose a plan', 'FAQ'] }`. `extractPage('')` is `{ title: '', headings: [] }`.
- `readSource`: walks up from `dir` to the first `.git`. A `.git` directory: branch from `HEAD` when it reads `ref: refs/heads/<branch>`, none when detached. Repo from the `url` under `[remote "origin"]` in `config`: the last path part without `.git` (`git@github.com:acme/acme-web.git` and `https://github.com/acme/acme-web` both give `acme-web`). With no origin, the name of the folder holding `.git`. A `.git` file (a worktree): follow its `gitdir:` line for `HEAD`, and that folder's `commondir` file for `config`; with no origin, the name of the folder holding the common git directory. Never throws; any error gives `{}`. Tests build these layouts in a temp folder with `node:fs`, without running git.
- `nameWarning` returns null for `'Pricing page, annual toggle'`, `'Checkout'`, `'Test results table, sortable'`. It warns for `'http://localhost:3000/pricing'`, `'localhost:5173'`, `'acme.vercel.app'`, `'index.html'`, `'pricing-v2.tsx'`, `'test'`, `'Test 2'`, `'test-3'`, `'untitled'`, `'New prototype'`, `'demo1'`, `'Prototype 4'`, `''`. Placeholder words: test, untitled, new, demo, prototype, example, sample, draft, temp, tmp, foo, bar, page, frame, screen, new prototype, new page. A placeholder is one of those, then optional space, `-` or `_`, then optional digits, and nothing else.
- The warning text is exactly: `` `"${name}" reads like ${kind}. ${NAMING_RULE} Rename it with canon_update.` `` where kind is `a web address`, `a file name` or `a placeholder`. For an empty name: `` `This prototype has no name. ${NAMING_RULE} Rename it with canon_update.` ``.
- `followsNamingRule('Pricing page, annual toggle')` is true. False for `'Pricing page'`, `'test 2, new'` is true only if no warning applies to the whole name (it is true here: the whole name is not a placeholder), `', annual'` is false, `'index.html'` is false.

- [ ] **Step 1:** Write the three test files. Run `npx vitest run cli/tests/mcp-page.test.js cli/tests/mcp-source.test.js cli/tests/mcp-naming.test.js`. Expected: fail, modules not found.
- [ ] **Step 2:** Write the three modules. Node built-ins only.
- [ ] **Step 3:** Run the same command. Expected: pass.
- [ ] **Step 4:** Commit the six files by path with the message “The MCP process can read a page's title and headings, the repo and branch it runs in, and tell a real name from a placeholder.”

### Task 4: the tools accept, send and report the fields

**Files:**
- Modify: `cli/src/mcp/tools.js`, `cli/README.md` (the tool list), `scripts/mcp-e2e.mjs`
- Test: `cli/tests/mcp-tools.test.js` (extend)

**Interfaces:**
- Consumes: task 3's `readPage`, `readSource`, `nameWarning`, `NAMING_RULE`; the contract above.
- Produces: `makeTools({ bridge, appBase, pairing, readPage?, readSource? })`. The two new options default to the real functions; tests and the scripted run pass fakes.

**Tool definitions**

- `canon_add` description, exactly: `` `Put a prototype on a board so it can be found again. ${NAMING_RULE} The reply lists the names already in the project: match their style. Add a one-sentence summary. Canon tags the prototype from its page, this agent, the repo and the branch; pass tags only to add your own.` ``
- `canon_add` properties added: `summary` (“One sentence on what this prototype shows.”), `tags` (array of strings, “Extra tags. Canon adds its own.”), `repo` and `branch` (“Read from the working directory when left out.” on repo), `starred` (boolean), `note` (“A note to the person, kept with the prototype.”). The `name` description becomes “What it is, then what is different.”
- `canon_update` description: “Change a prototype: its URL, name, summary, tags, star, note, archive or place.” Properties added: `summary`, `repo`, `branch`, `starred`, `note`, `archived` (boolean), `tags` (“Tags to add.”), `removeTags` (“Tags to remove. They stay removed.”).
- `canon_find` description: “List projects, boards and prototypes, or search them by name, summary and tag.” Properties added: `tag`, `starred` (boolean), `archived` (boolean, “Show archived prototypes instead of live ones.”).
- Wherever a description this task touches says “frame”, say “prototype”. Do not rename the `frame` argument.

**Behaviour**

- `checkArgs`: `starred` and `archived` must be boolean (“starred must be true or false.”). `tags` and `removeTags` must be arrays of at most 20 strings, each at most `MAX_STRING` (“tags must be a list of text.”, “tags can hold at most 20.”).
- `canon_add`: after the URL check, read the page and the source at the same time. `page` is sent only when `readPage` returned one. `repo` and `branch` from `readSource()` are used only when the agent passed neither. A throw from either reader is treated as nothing read.
- `canon_update`: `readPage` only when `url` is given. `readSource` is not used.
- Output of a successful add: line 1 as today. Then, when `nameWarning(res.frame)` is not null, a line `Warning: ${warning}`. Then, when `res.names` is a non-empty list, a line `Names already in this project: ${names.map((n) => `"${n}"`).join(', ')}.`. Then the JSON as today, without the `names` key.
- The package must still pass `cli/tests/bin.test.js` and ship only `bin` and `src/mcp`.

**Tests to add:**

- “the canon_add description states the naming rule with its example” (contains `NAMING_RULE`).
- “no tool description or argument description has an em or en dash”.
- “add sends the page it read, and the repo and branch of the working directory”.
- “add keeps the agent's repo and branch over the working directory's”.
- “add still adds when the page cannot be read, and sends no page”.
- “add still adds when a reader throws”.
- “add warns on a bare URL name, a file name and test 2, and still adds” (three cases; `isError` is not set).
- “add with no name warns about the host name Canon gave it” (bridge reply `frame: 'localhost:3000'`).
- “add lists the names already in the project”.
- “add refuses tags that are not a list of text without calling the bridge”.
- “update reads the page only when the URL changes”.
- “find passes tag, starred and archived through”.

`scripts/mcp-e2e.mjs`: add to the first `canon_add` a `summary` of `The pricing page with yearly billing on by default.` and `tags: ['e2e']`, then after the existing find check add: find with `{ query: 'pricing' }` returns the prototype (its name has no “pricing” in it); find with `{ tag: 'e2e' }` returns it; `canon_update` with `{ starred: true }` then find with `{ starred: true }` returns it. Do not run this script: it needs a dev server on a port that is off limits here.

- [ ] **Step 1:** Write the tests. Run `npx vitest run cli/tests/mcp-tools.test.js`. Expected: the new ones fail.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Run `npx vitest run cli/tests` and `node --check scripts/mcp-e2e.mjs`. Expected: pass.
- [ ] **Step 4:** Commit the four files by path with the message “canon_add, canon_update and canon_find take a summary, source, tags, star, note and archive, state the naming rule, and warn on a placeholder name.”

### Task 5: the scripted naming run

**Files:**
- Create: `scripts/naming-run.mjs`
- Modify: `scripts/verify.sh` only if a check is missing

**What it does:** with `--serve`, it is a stdio MCP server built from the real `serve` (`cli/src/mcp/protocol.js`) and the real `makeTools`, over a fake bridge that keeps prototypes in memory, answers `add`, `find` and `status` in the tab's shapes, and appends each add to the file named by `CANON_NAMING_LOG`. Without `--serve`, it writes an MCP config naming itself, starts `claude -p` with only the Canon tools allowed, gives it three plain descriptions of prototypes and their URLs without saying how to name anything, then reads the log and checks each name with `followsNamingRule`. It prints one PASS or FAIL line per name and exits 1 on any failure. It is not part of `npm test`.

- [ ] **Step 1:** Write the script.
- [ ] **Step 2:** Run `node scripts/naming-run.mjs`. Expected: three PASS lines.
- [ ] **Step 3:** Commit `scripts/naming-run.mjs` with the message “A scripted run checks that an agent names three prototypes to the rule from the tool descriptions alone.”

## Done when, and the test for each

| Done when | Test |
| --- | --- |
| An agent given only the tool descriptions names three prototypes to the rule, checked by a scripted run. | `scripts/naming-run.mjs` (real agent), backed by `cli/tests/mcp-naming.test.js` and the description test in `cli/tests/mcp-tools.test.js`. |
| `canon_find` with the query “pricing” returns a prototype whose summary mentions pricing and whose name does not. | `tests/app/bridge-ops.test.ts`, the test of that name. |
| A board saved before this project opens with nothing lost. | `tests/app/old-boards.test.ts` and the old-prototype test in `tests/app/bridge-ops.test.ts`. |
