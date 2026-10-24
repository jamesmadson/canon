/**
 * JSON-RPC 2.0 over stdio, one message per line. Hand-rolled: the server has
 * five methods and no dependencies. Output carries JSON lines only; anything
 * else goes through `log` (stderr).
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

function packageVersion() {
  try {
    const url = new URL('../../package.json', import.meta.url);
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

export function serve({ input, output, log = () => {}, onInitialize = async () => {}, tools }) {
  const reply = (id, body) => output.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...body })}\n`);
  const fail = (id, code, message) => reply(id, { error: { code, message } });

  async function handle(message) {
    const { id, method, params } = message;
    const isRequest = id !== undefined && id !== null;
    if (typeof method !== 'string') {
      if (isRequest) fail(id, -32600, 'Invalid request.');
      return;
    }
    if (!isRequest) return; // notifications get no reply
    try {
      if (method === 'initialize') {
        const asked = params?.protocolVersion;
        await onInitialize(params?.clientInfo ?? {});
        reply(id, {
          result: {
            protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
            capabilities: { tools: {} },
            serverInfo: { name: 'canon', version: packageVersion() },
          },
        });
      } else if (method === 'ping') {
        reply(id, { result: {} });
      } else if (method === 'tools/list') {
        reply(id, { result: { tools: tools.list } });
      } else if (method === 'tools/call') {
        const name = params?.name;
        if (!tools.list.some((t) => t.name === name)) {
          fail(id, -32602, `No tool called ${String(name).slice(0, 64)}.`);
          return;
        }
        reply(id, { result: await tools.call(name, params.arguments ?? {}) });
      } else {
        fail(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      log(`canon mcp: ${error.message}`);
      fail(id, -32603, 'Canon hit an error.');
    }
  }

  return new Promise((resolve) => {
    const lines = createInterface({ input, crlfDelay: Infinity });
    let chain = Promise.resolve();
    lines.on('line', (line) => {
      if (!line.trim()) return;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        fail(null, -32700, 'Parse error.');
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        fail(null, -32600, 'Invalid request.');
        return;
      }
      chain = chain.then(() => handle(message));
    });
    lines.on('close', () => chain.then(resolve));
  });
}
