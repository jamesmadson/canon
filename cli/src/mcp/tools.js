/**
 * The seven Canon tools. Each one forwards to the open Canon tab through the
 * bridge, except canon_pair, which only touches the local pairing file.
 */

import { readPairings, rotatePairing, pairLink } from './pairing.js';

const BARE_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\]|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$/i;
const REFUSAL = 'Only http and https URLs can go on a board.';

/** Mirror of checkPrototypeUrl in src/app/lib/resolve.ts. */
export function checkPrototypeUrl(input) {
  const text = String(input ?? '').trim();
  const candidate = !text.includes('://') && BARE_HOST.test(text) ? `http://${text}` : text;
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? { ok: true, url: u.href } : { ok: false, message: REFUSAL };
  } catch {
    return { ok: false, message: REFUSAL };
  }
}

const str = (description) => ({ type: 'string', description });
const schema = (properties, required = []) => ({ type: 'object', properties, required });
const PROJECT = str('Project name or id. Add uses the project open in Canon when this is left out; other tools search every project.');
const OPEN_PROPS = {
  project: PROJECT,
  board: str('Board name or id.'),
  frame: str('Prototype name or id.'),
  full: { type: 'boolean', description: 'Open the frame full screen.' },
  width: { type: ['number', 'string'], description: 'phone, tablet, desktop, fill, or a width in pixels.' },
  path: str('Path inside the prototype.'),
  version: { type: 'integer', minimum: 1, description: 'Version to open. 1 is the oldest in its stack.' },
};

export const TOOL_DEFS = [
  { name: 'canon_status', description: 'Say whether Canon is connected, and which project and board are open.', inputSchema: schema({}) },
  { name: 'canon_pair', description: 'Make a new pairing link to approve this agent in Canon.', inputSchema: schema({}) },
  {
    name: 'canon_add',
    description: 'Put a prototype URL on a board as a frame.',
    inputSchema: schema(
      {
        url: str('An http or https URL.'),
        name: str('Frame name.'),
        project: PROJECT,
        board: str('Board name or id. A new board is made if none matches.'),
        width: OPEN_PROPS.width,
      },
      ['url'],
    ),
  },
  {
    name: 'canon_update',
    description: 'Change a frame: its URL, name or place.',
    inputSchema: schema(
      {
        project: PROJECT,
        frame: str('Prototype name or id.'),
        board: str('Board name or id, to narrow the search.'),
        url: str('A new http or https URL.'),
        name: str('A new name.'),
        moveTo: str('Board name or id to move the frame to.'),
      },
      ['frame'],
    ),
  },
  { name: 'canon_find', description: 'List boards and frames, or search them.', inputSchema: schema({ project: PROJECT, query: str('Text to look for.') }) },
  { name: 'canon_open', description: 'Show a board or frame in Canon.', inputSchema: schema(OPEN_PROPS) },
  { name: 'canon_link', description: 'Get a link to a board or frame.', inputSchema: schema(OPEN_PROPS) },
];

const MAX_STRING = 2000;
const WIDTHS = ['phone', 'tablet', 'desktop', 'fill'];
const ALLOWED = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, Object.keys(d.inputSchema.properties)]));
const REQUIRED = Object.fromEntries(TOOL_DEFS.map((d) => [d.name, d.inputSchema.required]));

/** Returns an error message, or null when the arguments are fine. */
function checkArgs(name, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return 'Arguments must be an object.';
  for (const key of Object.keys(args)) {
    if (!ALLOWED[name].includes(key)) return `${key} is not an option for ${name}.`;
  }
  for (const key of REQUIRED[name]) {
    if (args[key] === undefined) return `${key} is required.`;
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    if (key === 'full') {
      if (typeof value !== 'boolean') return 'full must be true or false.';
    } else if (key === 'version') {
      if (!Number.isInteger(value) || value < 1) return 'version must be a positive whole number.';
    } else if (key === 'width') {
      if (!(Number.isInteger(value) && value > 0) && !WIDTHS.includes(value)) {
        return 'width must be phone, tablet, desktop, fill, or a positive whole number.';
      }
    } else if (typeof value !== 'string') return `${key} must be text.`;
    else if (value.length > MAX_STRING) return `${key} is too long.`;
  }
  return null;
}

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

const LOOKUPS = { project: 'project', frame: 'frame', board: 'board', moveTo: 'moveTo board' };

/** "Which one?" in words, naming the lookup (frame, board or moveTo board) and the query when Canon says them. */
function candidateText(kind, names, what, query) {
  const list = Array.isArray(names) && names.length ? ` Candidates: ${names.map((n) => (typeof n === 'string' ? n : (n?.name ?? n?.id))).join(', ')}.` : '';
  const label = Object.hasOwn(LOOKUPS, what) ? LOOKUPS[what] : null;
  const asked = label && typeof query === 'string' ? ` ${label} "${query}"` : label ? ` ${label}` : '';
  return kind === 'many' ? `More than one match${asked ? ` for${asked}` : ''}.${list} Say which one.` : `Nothing matched${asked}.${list}`;
}

const FAILURES = {
  timeout: "Canon didn't answer in time. It may have done it anyway, so check with canon_find before trying again.",
  closed: 'The Canon connection closed. Try again.',
  lost: 'Canon closed before it answered. It may have done it anyway, so check with canon_find.',
};

/** The first line of an add or update result: what was done, and on which board. */
function doneText(op, res) {
  if (!res || typeof res !== 'object' || typeof res.frame !== 'string') return null;
  const board = typeof res.board === 'string' ? res.board : null;
  if (typeof res.project !== 'string') {
    if (board === null) return null;
    return op === 'add' ? `Added ${res.frame} to board ${board}.` : `Updated ${res.frame} on board ${board}.`;
  }
  let line;
  if (op === 'add') {
    line = board ? `Added ${res.frame} to board ${board} in project ${res.project}.` : `Added ${res.frame} to project ${res.project}. It isn't on a board.`;
  } else {
    line = board ? `Updated ${res.frame} on board ${board} in project ${res.project}.` : `Updated ${res.frame} in project ${res.project}.`;
    if (res.newVersion === true && Number.isInteger(res.version)) line += ` It is version ${res.version} now.`;
  }
  return line;
}

export function makeTools({ bridge, appBase, pairing }) {
  const link = (secret) => pairLink(appBase, { agentId: pairing.agentId, name: pairing.name, port: bridge.port, secret });

  function notConnected() {
    const entry = readPairings(pairing.file).agents[pairing.agentId];
    // Never approved here: the pairing link is what's missing.
    if (!entry || !entry.claimedBy) {
      let out = `Canon isn't connected. Open it: ${appBase}`;
      if (entry) out += `\nThen approve this agent: ${link(entry.secret)}`;
      return text(out, true);
    }
    // Approved before: most likely a background tab that hasn't knocked yet. canon_pair would
    // replace a working pairing, so it comes second.
    return text(
      `Canon isn't connected. If it's open, try again in a few seconds. Otherwise open it: ${appBase}\nIf you disconnected this agent in Canon, run canon_pair to connect again.`,
      true,
    );
  }

  async function forward(op, args) {
    const r = await bridge.send(op, args);
    if (!r.ok) {
      if (r.error === 'not-connected') return notConnected();
      if (r.error === 'many' || r.error === 'none') return text(candidateText(r.error), true);
      if (Object.hasOwn(FAILURES, r.error)) return text(FAILURES[r.error], true);
      return text(String(r.error), true);
    }
    const res = r.result;
    const kind = res && typeof res === 'object' ? (res.status ?? res.error) : null;
    if (kind === 'many' || kind === 'none') return text(candidateText(kind, res.candidates ?? res.names, res.what, res.query), true);
    const done = doneText(op, res);
    return text(done ? `${done}\n${show(res)}` : show(res ?? 'Done.'));
  }

  const lists = { canon_status: 'status', canon_find: 'find', canon_open: 'open', canon_link: 'link' };

  return {
    list: TOOL_DEFS,
    async call(name, args = {}) {
      try {
        return await run(name, args);
      } catch (error) {
        return text(`Canon could not do that: ${error.message}`, true);
      }
    },
  };

  async function run(name, args) {
      if (!Object.hasOwn(ALLOWED, name)) return text(`No tool called ${name}.`, true);
      const problem = checkArgs(name, args);
      if (problem) return text(problem, true);
      if (name === 'canon_pair') {
        const { secret } = rotatePairing(pairing.file, pairing.agentId, pairing.name);
        return text(`Open this link in Canon to approve this agent: ${link(secret)}`);
      }
      if (name === 'canon_add' || name === 'canon_update') {
        if (name === 'canon_add' || args.url !== undefined) {
          const checked = checkPrototypeUrl(args.url);
          if (!checked.ok) return text(checked.message, true);
          args = { ...args, url: checked.url };
        }
        return forward(name === 'canon_add' ? 'add' : 'update', args);
      }
      return forward(lists[name], args);
  }
}
