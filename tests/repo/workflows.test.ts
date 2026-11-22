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
