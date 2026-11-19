import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const binPath = fileURLToPath(new URL('../bin/canon.js', import.meta.url));
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
);

const run = (args) => spawnSync('node', [binPath, ...args], { encoding: 'utf8' });

describe('the canon binary', () => {
  it('prints help that names mcp and none of the parked commands', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('mcp');
    for (const name of ['init', 'index', 'note', 'open']) {
      expect(result.stdout).not.toMatch(new RegExp(`^\\s+${name}\\b`, 'm'));
      expect(result.stdout).not.toContain(`canon ${name}`);
    }
  });

  it('refuses init and says mcp is the only command', () => {
    const result = run(['init']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('init is not a command');
    expect(result.stderr).toContain('canon mcp is the only one');
  });

  it('prints the version in package.json', () => {
    const result = run(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(manifest.version);
  });

  it('does not import the parked commands', () => {
    expect(readFileSync(binPath, 'utf8')).not.toContain('../src/commands.js');
  });
});

describe('the usage text', () => {
  it('speaks of the Canon app and prototypes, not boards, and uses no dashes', () => {
    const text = run(['--help']).stdout;
    expect(text).toContain('prototypes');
    expect(text).not.toMatch(/boards/i);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });

  it('prints usage and exits 1 with no command', () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Usage: canon mcp');
  });

  it('names an unknown option and exits 1', () => {
    const result = run(['mcp', '--bogus']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--bogus is not an option');
  });
});

describe('the manifest', () => {
  it('names the issues page, the site and what the package does now', () => {
    expect(manifest.bugs.url).toBe('https://github.com/jamesmadson/canon/issues');
    expect(manifest.homepage).toBe('https://jamesmadson.github.io/canon/');
    expect(manifest.description).toContain('prototypes');
  });
});

describe('the package', () => {
  it('is usecanon, MIT, and ships only the binary and the MCP server', () => {
    expect(manifest.name).toBe('usecanon');
    expect(manifest.license).toBe('MIT');
    expect(manifest.files).toEqual(['bin', 'src/mcp', 'LICENSE']);
  });
});
