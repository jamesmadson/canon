#!/usr/bin/env node
/**
 * Argv in, exit code out. Everything else lives in src.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { init, index, note, open, USAGE } from '../src/commands.js';

const COMMANDS = { init, index, note, open };

/** A tiny flag reader. A CLI framework would be a dependency, and there are none. */
export function parseArgv(argv) {
  const parsed = { command: null, all: false, noOpen: false, help: false, version: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') parsed.help = true;
    else if (token === '--version' || token === '-v') parsed.version = true;
    else if (token === '--all') parsed.all = true;
    else if (token === '--no-open') parsed.noOpen = true;
    else if (token === '--about') parsed.about = argv[++i];
    else if (token === '--said') parsed.said = argv[++i];
    else if (token === '--as') parsed.as = argv[++i];
    else if (token.startsWith('-')) parsed.unknown = token;
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

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
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
