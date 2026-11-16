# Builder's brief

One page of the rules a builder needs. The full reasons are in the decision
log (`docs/DECISIONS.md` on the `alpha` branch). When this page and the log
disagree, the log wins.

## What Canon is

A place an agent puts prototypes so a person can find them again. The agent
talks to `canon mcp` (the `usecanon` package in `cli/`). That process talks
to the Canon tab open in the person's browser, where the boards are stored.

## Where things are

- `cli/src/mcp/`: the shipped package. Plain JavaScript, Node 20 or later.
- `cli/tests/`: its tests.
- `src/app/`: the browser app. TypeScript. `bridge/ops.ts` is what an agent
  can do to a tab. `lib/` holds pure helpers. `db.ts` holds the stored shapes.
- `tests/app/`: its tests.
- `scripts/verify.sh`: run this before saying anything is done.

## Hard rules

- No runtime dependencies in `cli/`. Node built-ins only.
- Nothing leaves the machine. No telemetry. The one network read the MCP
  process makes is a GET of the prototype's own URL, to read its title and
  headings. Nothing is sent.
- No AI model inside Canon. Automatic tags come from the page title, the
  headings, the agent's name, the repo and the branch.
- Stored data only grows. Every new field is optional, and a board saved
  before the field existed must load with nothing lost.
- Everything is MIT.

## Words

- No em dashes or en dashes in anything people read: interface text, tool
  descriptions, errors, docs, commit messages.
- Sentence case. No uppercase labels.
- Plain and direct. Errors say what happened and how to fix it.
- People read three nouns: project, prototype, version. "Frame" and "stack"
  stay in the code.
- Curly quotes in prose, straight quotes in code and commands.

## Git

- One project, one branch, one pull request.
- Commit with explicit paths. Never `git add -A` or `git add .`.
- Never restore files with `git checkout`, `git stash` or `git reset`.
- No "Co-Authored-By" or "Generated with" line, for any tool.
- Never push and never `npm publish`. Those are James's.

## Tests

- vitest, run from the repository root: `npx vitest run <file>`.
- Every "done when" has a test. Write the test first and watch it fail.
- Never bind ports 4410, 4321, 4400, 4500, 8091 or 8093. Tests that need a
  port ask for port 0.
- Never read anything under `~/.claude/projects/` or `~/.codex/`.

## When something is not covered

Do not invent policy. Write the question in `docs/PROPOSED.md`, take the
smallest reading, and ask James.
