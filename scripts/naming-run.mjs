// Checks that an agent names prototypes to the rule from the tool
// descriptions alone. Starts a real agent (`claude -p`) with only the Canon
// tools, describes three prototypes without saying how to name them, and
// checks the three names it gives.
//   node scripts/naming-run.mjs [--model <name>]
// Needs the Claude command and a login, so it is not part of npm test.
// Canon is stood in for by an in-memory tab: no browser, no port, and the
// pages are never fetched. A temp working directory keeps the agent from
// reading this repository's own instructions.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../cli/src/mcp/protocol.js';
import { makeTools } from '../cli/src/mcp/tools.js';
import { followsNamingRule } from '../cli/src/mcp/naming.js';

const SELF = fileURLToPath(import.meta.url);

/** The tab's side of add, find and status, kept in memory. Each add is appended to the log file. */
function fakeBridge(logFile) {
  const prototypes = [];
  return {
    port: 0,
    async send(op, args) {
      if (op === 'status') return { ok: true, result: { projects: 1, boards: 0, prototypes: prototypes.length } };
      if (op === 'find') {
        return { ok: true, result: { projects: [{ id: 'p1', name: 'Acme store', boards: [], prototypes: prototypes.map((p, i) => ({ id: `f${i + 1}`, ...p })) }] } };
      }
      if (op === 'add') {
        const name = String(args.name ?? '').trim() || new URL(args.url).host;
        const names = prototypes.map((p) => p.name).reverse();
        const row = { name, url: args.url, ...(args.summary ? { summary: args.summary } : {}), tags: ['claude code', ...(args.tags ?? [])] };
        prototypes.push(row);
        appendFileSync(logFile, `${JSON.stringify(row)}\n`);
        return {
          ok: true,
          result: { frameId: `f${prototypes.length}`, frame: name, projectId: 'p1', project: 'Acme store', boardId: null, board: null, version: 1, versions: 1, tags: row.tags, names },
        };
      }
      return { ok: false, error: `Canon does not know how to ${op}.` };
    },
  };
}

async function serveStub() {
  const dir = mkdtempSync(join(tmpdir(), 'canon-naming-'));
  const tools = makeTools({
    bridge: fakeBridge(process.env.CANON_NAMING_LOG),
    appBase: 'https://example.test/canon/app/',
    pairing: { file: join(dir, 'mcp.json'), agentId: 'agent', name: 'Claude Code' },
    readPage: async () => null,
    readSource: () => ({}),
  });
  await serve({ input: process.stdin, output: process.stdout, tools });
}

const PROMPT = `Three prototypes are running on this machine. Put each one in Canon.

1. http://localhost:5173/pricing is our pricing page. In this one the billing switch starts on yearly.
2. http://localhost:5173/checkout is the checkout. This one puts every step on a single screen.
3. http://localhost:5173/onboarding is the sign-up flow. This one asks for the team name first.

When all three are in, reply with the word done.`;

async function run() {
  const i = process.argv.indexOf('--model');
  const model = i >= 0 ? process.argv[i + 1] : undefined;
  const dir = mkdtempSync(join(tmpdir(), 'canon-naming-run-'));
  const log = join(dir, 'adds.jsonl');
  const config = join(dir, 'mcp.json');
  writeFileSync(config, JSON.stringify({ mcpServers: { canon: { command: process.execPath, args: [SELF, '--serve'], env: { CANON_NAMING_LOG: log } } } }));
  const args = [
    '-p', PROMPT,
    '--mcp-config', config, '--strict-mcp-config',
    '--setting-sources', 'project',
    '--allowedTools', 'mcp__canon__canon_add', 'mcp__canon__canon_find', 'mcp__canon__canon_status',
    '--no-session-persistence',
    ...(model ? ['--model', model] : []),
  ];
  const child = spawn('claude', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const code = await new Promise((resolve) => {
    child.on('error', () => resolve(127));
    child.on('close', resolve);
  });
  if (code === 127) {
    console.log('FAIL  the claude command was not found. Install Claude Code, or run this where it is installed.');
    process.exit(1);
  }
  const names = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).name) : [];
  let bad = 0;
  if (names.length !== 3) {
    bad++;
    console.log(`FAIL  the agent added ${names.length} prototypes, and 3 were asked for`);
    if (!names.length) console.log(out.trim().slice(0, 600));
  }
  for (const name of names) {
    const ok = followsNamingRule(name);
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  "${name}"`);
  }
  console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--serve')) await serveStub();
else await run();
