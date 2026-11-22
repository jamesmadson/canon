import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const checks = readFileSync(new URL('../../.github/workflows/checks.yml', import.meta.url), 'utf8');

describe('checks workflow', () => {
  it('is named Checks', () => {
    expect(checks).toMatch(/^name:\s*Checks\s*$/m);
  });

  it('runs on pull requests, pushes to main and workflow calls', () => {
    expect(checks).toMatch(/^\s*pull_request:/m);
    expect(checks).toMatch(/^\s*workflow_call:/m);
    expect(checks).toMatch(/^\s*push:\s*\n\s*branches:\s*\[\s*main\s*\]/m);
  });

  it('never uses pull_request_target', () => {
    expect(checks).not.toMatch(/pull_request_target/);
  });

  it('has a job with id checks that installs, tests and type checks', () => {
    expect(checks).toMatch(/^jobs:\s*\n\s+checks:\s*$/m);
    expect(checks).toMatch(/run:\s*npm ci\b/);
    expect(checks).toMatch(/run:\s*npx vitest run\b/);
    expect(checks).toMatch(/run:\s*npx astro check\b/);
  });

  it('grants contents read and nothing broader', () => {
    const block = checks.match(/^permissions:\s*\n((?:[ \t]+\S.*\n?)+)/m);
    expect(block).not.toBeNull();
    const lines = block![1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toEqual(['contents: read']);
  });

  it('uses setup-node 22 with the npm cache', () => {
    expect(checks).toMatch(/uses:\s*actions\/checkout@v4/);
    expect(checks).toMatch(/uses:\s*actions\/setup-node@v4/);
    expect(checks).toMatch(/node-version:\s*22\b/);
    expect(checks).toMatch(/cache:\s*npm\b/);
  });

  it('cancels superseded runs per ref', () => {
    expect(checks).toMatch(/group:\s*checks-\$\{\{\s*github\.ref\s*\}\}/);
    expect(checks).toMatch(/cancel-in-progress:\s*true/);
  });
});

const release = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');

const publishSplit = release.split(/^ {2}publish:\s*$/m);
const beforePublish = publishSplit[0];
const publishJob = publishSplit[1] ?? '';

function blockAfter(text: string, header: RegExp): string[] {
  const m = text.match(header);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function inOrder(text: string, parts: string[]) {
  let at = -1;
  for (const part of parts) {
    const next = text.indexOf(part, at + 1);
    expect(next, `${part} should appear after the previous step`).toBeGreaterThan(at);
    at = next;
  }
}

describe('release workflow', () => {
  it('runs on pushed version tags only', () => {
    expect(release).toMatch(/^on:\s*\n\s+push:\s*\n\s+tags:\s*\[\s*['"]?v\*['"]?\s*\]/m);
    expect(release).not.toMatch(/pull_request/);
  });

  it('calls the checks workflow before publishing', () => {
    expect(release).toMatch(/^jobs:\s*\n\s+checks:\s*\n\s+uses:\s*\.\/\.github\/workflows\/checks\.yml/m);
    expect(publishJob).toMatch(/needs:\s*checks\b/);
  });

  it('grants contents read at the top and id-token write only to publish', () => {
    const top = blockAfter(release, /^permissions:\s*\n((?:[ \t]+\S.*\n?)+)/m);
    expect(top).toEqual(['contents: read']);
    expect(beforePublish).not.toMatch(/id-token/);
    const jobPerms = blockAfter(publishJob, /^ {4}permissions:\s*\n((?: {6,}\S.*\n?)+)/m);
    expect(jobPerms.sort()).toEqual(['contents: write', 'id-token: write']);
    expect(release.match(/id-token:\s*write/g)).toHaveLength(1);
  });

  it('has its own concurrency group that never cancels a release', () => {
    expect(release).toMatch(/group:\s*release-\$\{\{\s*github\.ref\s*\}\}/);
    expect(release).toMatch(/cancel-in-progress:\s*false/);
    expect(release).not.toMatch(/group:\s*checks-/);
  });

  it('uses no npm token', () => {
    expect(release).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN/);
  });

  it('fails fast in multi-line shell steps', () => {
    const blocks = release.match(/run:\s*\|/g) ?? [];
    const strict = release.match(/set -euo pipefail/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    expect(strict.length).toBe(blocks.length);
  });

  it('never interpolates expressions into shell scripts', () => {
    const scripts = release.match(/run:\s*\|\n(?: {10,}.*\n?)+/g) ?? [];
    for (const s of scripts) expect(s).not.toMatch(/\$\{\{/);
  });

  it('checks out full history, sets up node 22 and a current npm', () => {
    expect(publishJob).toMatch(/fetch-depth:\s*0/);
    expect(publishJob).toMatch(/node-version:\s*22\b/);
    expect(publishJob).toMatch(/registry-url:\s*https:\/\/registry\.npmjs\.org/);
    expect(publishJob).toMatch(/npm install -g npm@\^11\.5\.1/);
  });

  it('refuses with the documented messages', () => {
    expect(release).toContain('This tag is not on main. Tag a commit that has landed on main.');
    expect(release).toContain('is already on npm. Bump the version for a new release.');
  });

  it('refuses unless the npm lookup is a clean not found', () => {
    expect(release).toMatch(/E404/);
  });

  it('checks, versions, guards, notes, publishes and releases in order', () => {
    inOrder(publishJob, [
      'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
      'node scripts/release-version.mjs "$GITHUB_REF_NAME"',
      'npm view "usecanon@$version" version',
      'node scripts/release-notes.mjs "$version" > notes.md',
      'npm publish --access public',
      'gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --notes-file notes.md',
    ]);
    expect(publishJob).toMatch(/working-directory:\s*cli\b/);
    expect(publishJob).toMatch(/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  });
});
