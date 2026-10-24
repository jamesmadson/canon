# Canon CLI

## Connect an agent

`canon mcp` runs a small local server that your coding agent talks to. It passes the agent's requests to the Canon tab you have open, so the agent can put prototypes on your boards.

The npm package name is not picked yet. Where you see `<package-name>`, use the real name once it exists. From a checkout, run `node /path/to/cli/bin/canon.js mcp` instead.

### Set up

Claude Code:

```
claude mcp add canon -- npx <package-name> mcp
```

From a checkout of this repo instead:

```
claude mcp add canon -- node /path/to/cli/bin/canon.js mcp
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.canon]
command = "npx"
args = ["<package-name>", "mcp"]
```

Cursor, in `.cursor/mcp.json`:

```json
{ "mcpServers": { "canon": { "command": "npx", "args": ["<package-name>", "mcp"] } } }
```

Add `--dev` to the args to talk to a Canon app on `http://localhost:4321`.

### Pairing

The first time an agent uses a tool, it gets a link. Open it in the browser where Canon lives. Canon asks "Connect <agent name> to Canon?" and you choose Connect or Cancel. Each agent pairs on its own. You can disconnect one from the Agents list in Canon's sidebar.

Canon has to be open. If it isn't, the tool says so and gives you the link to open it.

Verified in Chrome. Chrome asks to allow Canon to reach your local network the first time; allow it, or the agent can't connect. Safari and Firefox are untested.

`canon_open` acts on the Canon tab that's connected, which may be behind others.

### What it can't do

- It can't delete anything.
- It can't read your files or load your prototypes.
- It can't upload anything. Nothing leaves your machine.
- It only reaches Canon on your own machine, through a local port.

### The tools

- `canon_status`: says whether Canon is connected and which board is open.
- `canon_pair`: makes a new pairing link for this agent.
- `canon_add`: puts a prototype URL on a board as a frame.
- `canon_update`: changes a frame's URL, name or board. A new URL keeps the old one as a version.
- `canon_find`: lists boards and frames, or searches them.
- `canon_open`: shows a board or frame in your Canon tab.
- `canon_link`: gives you a link to a board, a frame, a full-screen view or a version.

### Try it end to end

`scripts/mcp-e2e.mjs` plays the agent against a running dev Canon and headless Chrome. Start `npm run dev -- --host 127.0.0.1`, then run `node scripts/mcp-e2e.mjs`. It uses a temporary home folder and is not part of `npm test`.
