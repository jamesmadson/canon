/**
 * The seven Canon tools. Each one forwards to the open Canon tab through the
 * bridge, except canon_pair, which only touches the local pairing file.
 */

import { readPairings, rotatePairing, pairLink } from './pairing.js';
import { readPage as realReadPage } from './page.js';
import { readSource as realReadSource } from './source.js';
import { readBuildFolder as realReadBuildFolder, BUILD_LIMITS } from './folder.js';
import { stageBuild } from './upload.js';
import { extractPage } from './page.js';
import { NAMING_RULE, nameWarning } from './naming.js';

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

/** The host and port of an address on this machine (localhost, 127.0.0.1 or [::1]), else null. */
export function loopbackHost(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ? u.host : null;
  } catch {
    return null;
  }
}

const str = (description) => ({ type: 'string', description });
const schema = (properties, required = []) => ({ type: 'object', properties, required });
const TAGS = (description) => ({ type: 'array', items: { type: 'string' }, description });
const PROJECT = str('Project name or id. Add uses the project open in Canon when this is left out; other tools search every project.');
const FOLDER = str(`Absolute path to a build folder: static files with an index.html at its top, such as dist, build or out. Canon keeps a copy of at most ${BUILD_LIMITS.maxFiles} files and ${BUILD_LIMITS.maxBytes / (1024 * 1024)} MB. Folders named node_modules, folders starting with a dot and links that leave the folder are skipped.`);
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
    description: `Put a prototype on a board so it can be found again. ${NAMING_RULE} The reply lists the names already in the project: match their style. Add a one-sentence summary. Canon tags the prototype from its page, this agent, the repo and the branch; pass tags only to add your own. For a prototype made from code, build the project first and pass folder, the absolute path of the build output, so Canon keeps a copy that shows without a server. Pass the localhost address as url too, and it becomes the live address: Canon offers a Live switch while that server runs. To add a later round, call canon_update with the same prototype and a new folder; it becomes a new version and the older ones stay. Pass only a url for a page that is already hosted. A localhost address with no folder shows only while its server runs.`,
    inputSchema: schema(
      {
        url: str('An http or https URL. With folder, this is the live address, usually the localhost address of the dev server. Without folder it is the prototype itself.'),
        folder: FOLDER,
        name: str('What it is, then what is different.'),
        summary: str('One sentence on what this prototype shows.'),
        tags: TAGS('Extra tags. Canon adds its own.'),
        repo: str('Read from the working directory when left out.'),
        branch: str('Read from the working directory when left out.'),
        starred: { type: 'boolean', description: 'Star the prototype.' },
        note: str('A note to the person, kept with the prototype.'),
        project: PROJECT,
        board: str('Board name or id. A new board is made if none matches.'),
        width: OPEN_PROPS.width,
      },
      [],
    ),
  },
  {
    name: 'canon_update',
    description: 'Change a prototype: its URL, name, summary, tags, star, note, archive or place. Pass folder, the absolute path of a new build, to add it as the next version of the prototype; the older versions stay. For a prototype that is a link, pass url for the next version: a new address becomes the next version and the older ones stay. Pass newVersion: true with url to add that address as the next version even when it is the same as the current one, for example a dev server that now shows new work. A stack can mix link versions and stored copies.',
    inputSchema: schema(
      {
        project: PROJECT,
        frame: str('Prototype name or id.'),
        board: str('Board name or id, to narrow the search.'),
        url: str('An http or https URL. A new address is added as the next version. With folder, this is the new live address.'),
        folder: FOLDER,
        newVersion: { type: 'boolean', description: 'With url: add it as the next version even when it matches the current address.' },
        name: str('A new name.'),
        summary: str('One sentence on what this prototype shows.'),
        repo: str('The repo it came from.'),
        branch: str('The branch it came from.'),
        starred: { type: 'boolean', description: 'Star or unstar the prototype.' },
        note: str('A note to the person, kept with the prototype.'),
        archived: { type: 'boolean', description: 'Archive or restore the prototype.' },
        tags: TAGS('Tags to add.'),
        removeTags: TAGS('Tags to remove. They stay removed.'),
        moveTo: str('Board name or id to move the prototype to.'),
      },
      ['frame'],
    ),
  },
  {
    name: 'canon_find',
    description: 'List projects, boards and prototypes, or search them by name, summary and tag.',
    inputSchema: schema({
      project: PROJECT,
      query: str('Text to look for.'),
      tag: str('Only prototypes with this tag.'),
      starred: { type: 'boolean', description: 'Only starred prototypes.' },
      archived: { type: 'boolean', description: 'Show archived prototypes instead of live ones.' },
    }),
  },
  { name: 'canon_open', description: 'Show a board or frame in Canon.', inputSchema: schema(OPEN_PROPS) },
  { name: 'canon_link', description: 'Get a link to a board or frame.', inputSchema: schema(OPEN_PROPS) },
];

const MAX_STRING = 2000;
const MAX_TAGS = 20;
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
  if (name === 'canon_add' && args.url === undefined && args.folder === undefined) return 'url or folder is required.';
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    if (key === 'full' || key === 'starred' || key === 'archived' || key === 'newVersion') {
      if (typeof value !== 'boolean') return `${key} must be true or false.`;
    } else if (key === 'tags' || key === 'removeTags') {
      if (!Array.isArray(value) || value.some((t) => typeof t !== 'string')) return `${key} must be a list of text.`;
      if (value.length > MAX_TAGS) return `${key} can hold at most ${MAX_TAGS}.`;
      if (value.some((t) => t.length > MAX_STRING)) return `${key} has an entry that is too long.`;
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

export function makeTools({ bridge, appBase, pairing, readPage = realReadPage, readSource = realReadSource, readBuildFolder = realReadBuildFolder }) {
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

  /** A failed bridge reply, in words for the agent. */
  function failed(r) {
    if (r.error === 'not-connected') return notConnected();
    if (r.error === 'many' || r.error === 'none') return text(candidateText(r.error), true);
    if (Object.hasOwn(FAILURES, r.error)) return text(FAILURES[r.error], true);
    return text(String(r.error), true);
  }

  async function forward(op, args, warnings = []) {
    const r = await bridge.send(op, args);
    if (!r.ok) return failed(r);
    const res = r.result;
    const kind = res && typeof res === 'object' ? (res.status ?? res.error) : null;
    if (kind === 'many' || kind === 'none') return text(candidateText(kind, res.candidates ?? res.names, res.what, res.query), true);
    let shown = res;
    const lines = [];
    if (op === 'add' && res && typeof res === 'object' && !Array.isArray(res)) {
      const warning = nameWarning(res.frame);
      if (warning) lines.push(`Warning: ${warning}`);
      if (Array.isArray(res.names) && res.names.length) lines.push(`Names already in this project: ${res.names.map((n) => `"${n}"`).join(', ')}.`);
      const { names, ...rest } = res;
      shown = rest;
    }
    lines.push(...warnings);
    const done = doneText(op, res);
    return text(done ? [done, ...lines, show(shown)].join('\n') : [...lines, show(shown ?? 'Done.')].join('\n'));
  }

  /** Nothing read is not an error: a reader that throws or finds nothing gives null. */
  async function safely(read) {
    try {
      return (await read()) ?? null;
    } catch {
      return null;
    }
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
        if (args.url !== undefined) {
          const checked = checkPrototypeUrl(args.url);
          if (!checked.ok) return text(checked.message, true);
          args = { ...args, url: checked.url };
        }
        let warnings = [];
        if (args.folder !== undefined) {
          const read = await readBuildFolder(args.folder);
          if (!read.ok) return text(read.message, true);
          const sent = await stageBuild((op, a) => bridge.send(op, a), read);
          if (!sent.ok) return failed(sent.reply);
          const { folder, ...rest } = args;
          args = { ...rest, build: sent.build };
          // A folder-only add has no server to read, so the title and headings come from the stored index.html.
          if (args.url === undefined) {
            const index = read.files.find((f) => f.path === 'index.html');
            const page = index ? extractPage(Buffer.from(index.data).toString('utf8')) : null;
            if (page && (page.title || page.headings.length)) args = { ...args, page };
          }
        } else {
          const host = loopbackHost(args.url);
          if (host) {
            warnings = [`Warning: This prototype will only show while the server at ${host} is running. Build the project and pass the build folder as folder, in canon_add or canon_update, so Canon keeps a copy that shows without the server.`];
          }
        }
        if (name === 'canon_add') {
          const [page, source] = await Promise.all([args.url === undefined ? null : safely(() => readPage(args.url)), safely(() => readSource())]);
          if (page) args = { ...args, page };
          if (source && args.repo === undefined && args.branch === undefined) {
            if (source.repo) args = { ...args, repo: source.repo };
            if (source.branch) args = { ...args, branch: source.branch };
          }
        } else if (args.url !== undefined) {
          const page = await safely(() => readPage(args.url));
          if (page) args = { ...args, page };
        }
        return forward(name === 'canon_add' ? 'add' : 'update', args, warnings);
      }
      return forward(lists[name], args);
  }
}
