import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { serve } from '../src/mcp/protocol.js';
import { mcp } from '../src/mcp/index.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTools } from '../src/mcp/tools.js';

function run(lines) {
  const input = new PassThrough();
  const output = new PassThrough();
  let data = '';
  output.on('data', (c) => (data += c));
  const tools = makeTools({
    bridge: { port: 1, send: async () => ({ ok: true, result: 'x' }) },
    appBase: 'https://x/',
    pairing: { file: '/nonexistent/mcp.json', agentId: 'a', name: 'A' },
  });
  const done = serve({ input, output, log: () => {}, onInitialize: async () => {}, tools });
  for (const l of lines) input.write(`${typeof l === 'string' ? l : JSON.stringify(l)}\n`);
  input.end();
  return done.then(() => data.split('\n').filter(Boolean));
}

describe('mcp protocol', () => {
  it('answers initialize', async () => {
    const [raw] = await run([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', clientInfo: { name: 'c' } } }]);
    const r = JSON.parse(raw).result;
    expect(r.protocolVersion).toBe('2025-03-26');
    expect(r.serverInfo.name).toBe('canon');
  });
  it('lists seven tools', async () => {
    const [raw] = await run([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]);
    expect(JSON.parse(raw).result.tools).toHaveLength(7);
  });
  it('survives garbage and unknown methods, output is only JSON lines', async () => {
    const out = await run(['{nope', { jsonrpc: '2.0', id: 2, method: 'bogus' }, { jsonrpc: '2.0', id: 3, method: 'ping' }]);
    const msgs = out.map((l) => JSON.parse(l));
    expect(msgs[0].error.code).toBe(-32700);
    expect(msgs[1].error.code).toBe(-32601);
    expect(msgs[2].result).toEqual({});
  });

  it('reports an unwritable pairing file as a tool error, not a protocol error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'canon-bad-'));
    writeFileSync(join(dir, 'blocker'), 'x');
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    let data = '';
    stdout.on('data', (c) => (data += c));
    const done = mcp({ dev: false }, { stdin, stdout, err: () => {}, pairingFile: join(dir, 'blocker', 'mcp.json') });
    stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'T' } } })}\n`);
    stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'canon_status' } })}\n`);
    stdin.end();
    expect(await done).toBe(0);
    const msgs = data.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(msgs[0].result.serverInfo.name).toBe('canon');
    expect(msgs[1].result.isError).toBe(true);
    expect(msgs[1].result.content[0].text.length).toBeGreaterThan(0);
  });
});
