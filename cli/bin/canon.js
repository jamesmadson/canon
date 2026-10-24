#!/usr/bin/env node
/**
 * Argv in, exit code out. Everything else lives in src.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { init, index, note, open, USAGE } from '../src/commands.js';
import { mcp } from '../src/mcp/index.js';

const COMMANDS = { init, index, note, open, mcp };

/** The flags that take a value, and the key each one lands under. */
const VALUE_FLAGS = { '--about': 'about', '--said': 'said', '--as': 'as', '--dev-port': 'devPort' };

/**
 * A tiny flag reader. A CLI framework would be a dependency, and there are none.
 *
 * A value flag at the end of the line, or followed by another flag, has no
 * value. Taking the next token anyway turns `canon note --about --said "x"`
 * into an entry filed about the literal string "--said", so a typo becomes a
 * wrong record entry. The flag is named and the run stops instead.
 *
 * Only a leading `--` disqualifies a value, so a quote that opens with a dash
 * is still a quote.
 */
export function parseArgv(argv) {
  const parsed = {
    command: null,
    all: false,
    choose: false,
    noOpen: false,
    dev: false,
    help: false,
    version: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') parsed.help = true;
    else if (token === '--version' || token === '-v') parsed.version = true;
    else if (token === '--all') parsed.all = true;
    else if (token === '--choose') parsed.choose = true;
    else if (token === '--no-open') parsed.noOpen = true;
    else if (token === '--dev') parsed.dev = true;
    else if (VALUE_FLAGS[token]) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        if (!parsed.missingValue) parsed.missingValue = token;
        continue;
      }
      parsed[VALUE_FLAGS[token]] = value;
      i += 1;
    } else if (token.startsWith('-')) parsed.unknown = token;
    else rest.push(token);
  }
  parsed.command = rest[0] ?? null;
  return parsed;
}

function version() {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  );
  return manifest.version;
}

export async function main(argv, io) {
  const parsed = parseArgv(argv);

  if (parsed.version) {
    io.out(version());
    return 0;
  }
  if (parsed.help || !parsed.command) {
    io.out(USAGE);
    return parsed.command || parsed.help ? 0 : 1;
  }
  if (parsed.missingValue) {
    io.err(`${parsed.missingValue} needs a value.`);
    return 1;
  }
  if (parsed.unknown) {
    io.err(`${parsed.unknown} is not an option. Run canon --help for the list.`);
    return 1;
  }
  const command = COMMANDS[parsed.command];
  if (!command) {
    io.err(`${parsed.command} is not a command. Run canon --help for the list.`);
    return 1;
  }
  return command(parsed, io);
}

/**
 * Was this file run, rather than imported by a test?
 *
 * A global install puts a symlink on PATH and points it at the real file under
 * node_modules, so argv[1] is the link while import.meta.url is the target.
 * Comparing the two as written strings is false in exactly the case every
 * person installing the package lands in, which left the whole CLI silent.
 * Both sides go through realpath so the link and its target compare equal.
 */
function wasRun() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  try {
    return realpathSync(process.argv[1]) === realpathSync(self);
  } catch {
    return process.argv[1] === self;
  }
}

if (wasRun()) {
  const io = {
    cwd: process.cwd(),
    stdin: process.stdin,
    stdout: process.stdout,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  };
  main(process.argv.slice(2), io).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      io.err(`canon stopped: ${error.message}`);
      process.exitCode = 1;
    },
  );
}
