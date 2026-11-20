import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHelp, BANNER_ROWS, BANNER_WIDTH, TOOL_HELP } from '../src/mcp/help.js';
import { TOOL_DEFS } from '../src/mcp/tools.js';

const binPath = fileURLToPath(new URL('../bin/canon.js', import.meta.url));
const ORANGE = '\u001b[38;2;255;79;0m';

const tty = { version: '1.2.3', tty: true, color: true, columns: 100 };

describe('the banner', () => {
  it('is five even rows of block letters', () => {
    expect(BANNER_ROWS).toHaveLength(5);
    for (const row of BANNER_ROWS) expect(row).toHaveLength(BANNER_WIDTH);
    expect(BANNER_ROWS.join('')).toMatch(/█/);
  });

  it('shows in Canon orange with the description and version on a colour terminal', () => {
    const text = renderHelp(tty);
    expect(text).toContain(`${ORANGE}${BANNER_ROWS[0]}`);
    expect(text).toContain('Keeps every prototype in one place, by project.');
    expect(text).toContain('Version 1.2.3');
  });

  it('has no colour codes without colour, and no banner off a terminal', () => {
    expect(renderHelp({ ...tty, color: false })).not.toContain('\u001b');
    expect(renderHelp({ ...tty, color: false })).toContain('█');
    const piped = renderHelp({ version: '1.2.3' });
    expect(piped).not.toContain('█');
    expect(piped).not.toContain('\u001b');
  });

  it('is skipped on a terminal narrower than the banner', () => {
    expect(renderHelp({ ...tty, columns: BANNER_WIDTH })).not.toContain('█');
  });
});

describe('the help text', () => {
  const text = renderHelp({ version: '1.2.3' });

  it('lists every tool from the tool definitions, with an example', () => {
    for (const tool of TOOL_DEFS) {
      expect(TOOL_HELP[tool.name], `${tool.name} needs a help entry`).toBeDefined();
      expect(text).toContain(tool.name);
      expect(text).toContain(TOOL_HELP[tool.name][1]);
    }
    expect(Object.keys(TOOL_HELP).sort()).toEqual(TOOL_DEFS.map((t) => t.name).sort());
  });

  it('names the three setups, the commands and the closing pointers', () => {
    expect(text).toContain('claude mcp add canon --scope user -- npx -y usecanon mcp');
    expect(text).toContain('~/.codex/config.toml');
    expect(text).toContain('.cursor/mcp.json');
    expect(text).toContain('/mcp shows Canon');
    expect(text).toContain('https://jamesmadson.github.io/canon/app/');
  });

  it('fits 80 columns and follows the copy rules', () => {
    for (const line of renderHelp(tty).replace(/\u001b\[[0-9;]*m/g, '').split('\n')) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
    expect(text).not.toMatch(/[–—!]/);
  });
});

describe('the binary', () => {
  const run = (args, env = {}) => spawnSync('node', [binPath, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

  it('prints the same help for no arguments, help, --help and -h, with no banner when piped', () => {
    const base = run(['help']);
    expect(base.status).toBe(0);
    expect(base.stdout).not.toContain('█');
    for (const args of [[], ['--help'], ['-h']]) {
      const result = run(args);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(base.stdout);
    }
  });

  it('says how to get help for an unknown command and exits 1', () => {
    const result = run(['frobnicate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('frobnicate is not a command. Run canon help');
    expect(result.stdout).toBe('');
  });
});

describe('canon mcp', () => {
  it('writes nothing but protocol to stdout', async () => {
    const home = mkdtempSync(join(tmpdir(), 'canon-help-'));
    const child = spawn('node', [binPath, 'mcp'], { env: { ...process.env, HOME: home, NO_COLOR: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', () => {});
    const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', clientInfo: { name: 'T' } } });
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/list' });
    const closed = new Promise((resolve) => child.on('close', resolve));
    await new Promise((resolve) => setTimeout(resolve, 800));
    child.stdin.end();
    await closed;

    const lines = stdout.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) expect(JSON.parse(line).jsonrpc).toBe('2.0');
    expect(stdout).not.toContain('█');
    expect(stdout).not.toContain('\u001b');
  }, 15000);
});
