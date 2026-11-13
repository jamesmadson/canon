import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const index = read('src/pages/index.astro');
const mcp = read('src/components/McpWalkthrough.astro');

describe('the homepage setup line and feedback link', () => {
  it('gives the one-line agent setup in a copyable code block', () => {
    expect(mcp).toContain('claude mcp add canon -- npx -y usecanon mcp');
    expect(mcp).toMatch(/<pre[^>]*>\s*<code>claude mcp add canon -- npx -y usecanon mcp<\/code>\s*<\/pre>/);
    expect(mcp).not.toContain('Not released');
  });

  it('points Codex and Cursor readers at the README', () => {
    expect(mcp).toContain('https://github.com/jamesmadson/canon#connect-your-agent');
  });

  it('sends feedback to GitHub issues and shows no email address', () => {
    expect(index).toContain('https://github.com/jamesmadson/canon/issues');
    expect(index).toContain('Send feedback on&nbsp;GitHub');
    expect(index).not.toContain('mailto:');
    expect(index).not.toContain('ADDRESS');
    expect(index).not.toMatch(/@jamesmadson\.me/);
    expect(mcp).not.toContain('mailto:');
  });
});
