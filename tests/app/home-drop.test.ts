import { describe, expect, it } from 'vitest';
import type { Project } from '../../src/app/db';
import { dropTarget, linksFromText, zipNames } from '../../src/app/lib/drop';
import { SETUP_COMMAND } from '../../src/app/lib/setup';

const project = (id: string, updatedAt: number): Project => ({ id, name: id, createdAt: 1, updatedAt });

describe('linksFromText', () => {
  it('reads links out of a dropped or pasted line', () => {
    expect(linksFromText('https://app.example.com/pricing')).toEqual(['https://app.example.com/pricing']);
    expect(linksFromText('localhost:5173')).toEqual(['http://localhost:5173/']);
  });
  it('reads a list of links and skips comments and blank lines, as a dropped link list has them', () => {
    expect(linksFromText('# from a browser\nhttps://a.example.com\n\nhttps://b.example.com/x\n')).toEqual(['https://a.example.com/', 'https://b.example.com/x']);
  });
  it('ignores ordinary words and sentences', () => {
    expect(linksFromText('hello')).toEqual([]);
    expect(linksFromText('Pricing page, annual toggle. See https://a.example.com')).toEqual([]);
    expect(linksFromText('javascript:alert(1)')).toEqual([]);
  });
  it('refuses Canon itself', () => {
    expect(linksFromText('https://canon.test/app', 'https://canon.test')).toEqual([]);
  });
});

describe('zipNames', () => {
  it('returns the names of dropped zips, in order', () => {
    expect(zipNames([{ name: 'checkout-flow.zip' }, { name: 'a.html' }, { name: 'B.ZIP' }])).toEqual(['checkout-flow.zip', 'B.ZIP']);
  });
});

describe('dropTarget', () => {
  const projects = [project('old', 1), project('new', 9)];
  it('uses the project row the drop landed on', () => {
    expect(dropTarget(projects, 'old')).toBe('old');
  });
  it('falls back to the project with the latest work', () => {
    expect(dropTarget(projects, null)).toBe('new');
    expect(dropTarget(projects, 'gone')).toBe('new');
  });
  it('is null when there is no project yet', () => {
    expect(dropTarget([], null)).toBeNull();
  });
});

describe('the agent setup line', () => {
  it('is the command that adds Canon to an agent', () => {
    expect(SETUP_COMMAND).toBe('claude mcp add canon -- npx -y usecanon mcp');
  });
});
