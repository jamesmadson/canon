# Canon for coding agents

Canon is a place to keep the prototypes you make with a coding agent, so you can find them, compare them and come back to them. This package, `usecanon`, is a small local server that lets your agent put prototypes into Canon, which you keep open in your browser.

Site: https://jamesmadson.github.io/canon/
App: https://jamesmadson.github.io/canon/app/

## Set up

You need Node 20 or newer.

Claude Code:

```
claude mcp add canon --scope user -- npx -y usecanon mcp
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.canon]
command = "npx"
args = ["-y", "usecanon", "mcp"]
```

Cursor, in `.cursor/mcp.json`:

```json
{ "mcpServers": { "canon": { "command": "npx", "args": ["-y", "usecanon", "mcp"] } } }
```

## Pairing

The first time an agent uses a tool, it gets a link. Open it in the browser where Canon lives. Canon asks "Connect <agent name> to Canon?" and you choose Connect or Cancel. Each agent pairs on its own. You can disconnect one from the Agents list in Canon's sidebar. The pairings are kept in `~/.canon/mcp.json`.

Canon has to be open in a tab. If it isn't, the tool says so and gives you the link to open it. After upgrading this package, reload any open Canon tabs.

## What it reads and what it never does

When the agent names a build folder, the server reads that folder: static files with an `index.html` at its top, up to 2000 files and 25 MB. It skips `node_modules`, folders that start with a dot, and links that leave the folder. With `page`, it keeps one page of a built site and only the files that page uses. It hands the files to the Canon tab in your own browser, over a port on your machine (47800 to 47809, on 127.0.0.1). Canon keeps the copy in your browser.

When the agent gives a link, the server fetches that page once, without cookies, to read its title and headings and to see whether it allows itself to be shown inside other pages. It also reads the agent's working directory for the repo and branch.

It never deletes anything, never sends anything to a server of ours, and has no telemetry. It listens only on 127.0.0.1 and only answers requests that come from Canon's own address, signed with the key from your pairing.

## The tools

- `canon_status`: says whether Canon is connected and which project and board are open.
- `canon_pair`: makes a new pairing link for this agent.
- `canon_add`: puts a prototype in a project. Give it a `url`, a `folder` (a build), or a `folder` with a `page` (one page of a built site). It also takes a name, a summary, tags, a star and a note. It tags the prototype from its page, the agent, the repo and the branch, and warns when the name reads like a web address, a file name or a placeholder. With a folder and a `url`, the address becomes the live address while that server runs.
- `canon_update`: changes a prototype's name, summary, tags, star, note, archive flag, board or project. `moveToProject` moves the whole prototype, every version, to another project, and the person can undo it for a few seconds. A new `url`, or a new `folder` (with `page` for a site), adds the next version and keeps the older ones. `newVersion: true` with a `url` adds a version even when the address is the same.
- `canon_find`: lists projects, boards and prototypes, or searches them by name, summary and tag.
- `canon_open`: shows a project, board or prototype in your Canon tab, which may be behind other tabs.
- `canon_link`: gives you a link to a project, board, prototype, full-screen view or version. Links open the prototype view.

## Browser support

Verified in Chrome. Chrome asks to allow Canon to reach your local network the first time; allow it, or the agent can't connect. Safari and Firefox are untested.

## Problems

Report them at https://github.com/jamesmadson/canon/issues.

## Licence

MIT.

## Working on Canon

From a checkout of the repository, run `node /path/to/cli/bin/canon.js mcp` instead of `npx -y usecanon mcp`. Add `--dev` to talk to a Canon app on `http://localhost:4321`, or `--dev --dev-port <n>` for another port. `scripts/mcp-e2e.mjs` in the repository plays an agent against a running dev Canon. It is not part of this package.
