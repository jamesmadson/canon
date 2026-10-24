/** `canon mcp`: serve the Canon tools to an agent over stdio. */

import { serve } from './protocol.js';
import { makeTools, TOOL_DEFS } from './tools.js';
import { startBridge } from './bridge.js';
import { pairingPath, ensurePairing, agentIdFor } from './pairing.js';

const PROD = 'https://jamesmadson.github.io/canon/app/';
const DEV = 'http://localhost:4321/canon/app/';

export async function mcp(parsed, io) {
  const dev = Boolean(parsed.dev);
  const appBase = dev ? DEV : PROD;
  const log = (line) => io.err(line);
  const output = io.stdout ?? process.stdout;
  const file = io.pairingFile ?? pairingPath();
  let bridge = null;
  let ready = null;
  let failure = null;

  async function start(clientInfo) {
    const name = String(clientInfo?.name || 'Agent').slice(0, 64);
    const agentId = agentIdFor(name);
    try {
      ensurePairing(file, agentId, name);
      bridge = await startBridge({ agentId, name, pairingFile: file, dev });
      log(`canon mcp: bridge on port ${bridge.port}`);
    } catch (error) {
      failure = error.message;
      log(`canon mcp: ${error.message}`);
      return;
    }
    return { agentId, name };
  }

  const tools = {
    list: TOOL_DEFS,
    async call(name, args) {
      const who = await ready;
      if (!bridge || !who) {
        return { content: [{ type: 'text', text: failure ?? 'Canon is not ready.' }], isError: true };
      }
      return makeTools({ bridge, appBase, pairing: { file, ...who } }).call(name, args);
    },
  };

  try {
    await serve({
      input: io.stdin,
      output,
      log,
      onInitialize: async (clientInfo) => {
        ready ??= start(clientInfo);
        await ready;
      },
      tools,
    });
  } finally {
    if (bridge) await bridge.close();
  }
  return 0;
}
