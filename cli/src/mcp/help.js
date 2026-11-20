/** The help screen: banner, setup, commands, and what the agent can do. */

import { TOOL_DEFS } from './tools.js';

const APP = 'https://jamesmadson.github.io/canon/app/';
const TAGLINE = 'Keeps every prototype in one place, by project.';

// Five rows, hand-tuned: every letter is six cells wide with a two cell gap.
const GLYPHS = {
  C: [' █████', '██    ', '██    ', '██    ', ' █████'],
  A: [' ████ ', '██  ██', '██████', '██  ██', '██  ██'],
  N: ['██  ██', '███ ██', '██████', '██ ███', '██  ██'],
  O: [' ████ ', '██  ██', '██  ██', '██  ██', ' ████ '],
};

export const BANNER_ROWS = [0, 1, 2, 3, 4].map((row) =>
  [...'CANON'].map((letter) => GLYPHS[letter][row]).join('  '),
);
export const BANNER_WIDTH = BANNER_ROWS[0].length;

const ORANGE = '\u001b[38;2;255;79;0m';
const RESET = '\u001b[0m';

/**
 * One line in plain words for each tool, with a request a person might type.
 * Keyed by tool name. The list below walks TOOL_DEFS, so a new tool with no
 * entry here fails the help test rather than going missing from the help.
 */
export const TOOL_HELP = {
  canon_status: ['Checks that Canon is connected and which project is open.', 'Is Canon connected?'],
  canon_pair: ['Makes a new link to connect this agent to Canon.', 'Give me a new link to connect to Canon.'],
  canon_add: ['Puts a prototype in a project, as a link or a stored build.', 'Put what you just built into Canon.'],
  canon_update: ['Renames, tags, stars, moves or adds a new version of a prototype.', 'Add this round as a new version of the pricing page.'],
  canon_find: ['Lists or searches your projects and prototypes.', 'What prototypes do I have in the onboarding project?'],
  canon_open: ['Shows a project or prototype in your Canon tab.', 'Show me the pricing page in Canon.'],
  canon_link: ['Gives you a link to a project or prototype.', 'Give me a link to the latest version of the pricing page.'],
};

const COMMANDS = [
  ['mcp', 'serve Canon to your agent over stdio'],
  ['help', 'show this screen (also --help and -h)'],
  ['--version', 'print the version'],
];

/**
 * Build the help text. tty and color come from the caller; the banner shows
 * only on a terminal wide enough for it.
 */
export function renderHelp({ version, tty = false, color = false, columns = 80 }) {
  const out = [];
  if (tty && columns >= BANNER_WIDTH + 2) {
    out.push('');
    for (const row of BANNER_ROWS) out.push(`  ${color ? ORANGE + row + RESET : row}`);
    out.push('');
    out.push(`  ${TAGLINE}`);
    out.push(`  Version ${version}`);
    out.push('');
  } else {
    out.push(`Canon ${version}. ${TAGLINE}`, '');
  }

  out.push('Set up', '');
  out.push('  Claude Code:  claude mcp add canon --scope user -- npx -y usecanon mcp');
  out.push('  Codex:        add a canon server to ~/.codex/config.toml');
  out.push('  Cursor:       add a canon server to .cursor/mcp.json');
  out.push('  The README has the exact lines for Codex and Cursor.', '');

  out.push('Commands', '');
  for (const [name, text] of COMMANDS) out.push(`  ${name.padEnd(12)}${text}`);
  out.push('  mcp --dev [--dev-port N]', '              talk to a Canon app on localhost', '');

  out.push('What your agent can do', '');
  for (const tool of TOOL_DEFS) {
    const [text, example] = TOOL_HELP[tool.name] ?? [];
    if (!text) continue;
    out.push(`  ${tool.name}`);
    out.push(`    ${text}`);
    out.push(`    Try: "${example}"`, '');
  }

  out.push('In Claude Code, /mcp shows Canon and its tools.');
  out.push(`Canon app: ${APP}`);
  out.push('It runs on your machine and sends nothing to a server.');
  return out.join('\n');
}
