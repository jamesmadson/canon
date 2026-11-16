import { describe, it, expect } from 'vitest';
import { NAMING_RULE, nameWarning, followsNamingRule } from '../src/mcp/naming.js';

describe('NAMING_RULE', () => {
  it('is the exact sentence', () => {
    expect(NAMING_RULE).toBe('Name it for what it is, then what is different, such as "Pricing page, annual toggle".');
  });
});

describe('nameWarning', () => {
  it.each(['Pricing page, annual toggle', 'Checkout', 'Test results table, sortable'])('accepts %j', (name) => {
    expect(nameWarning(name)).toBeNull();
  });

  it.each(['http://localhost:3000/pricing', 'localhost:5173', 'acme.vercel.app'])('calls %j a web address', (name) => {
    expect(nameWarning(name)).toBe(`"${name}" reads like a web address. ${NAMING_RULE} Rename it with canon_update.`);
  });

  it.each(['index.html', 'pricing-v2.tsx'])('calls %j a file name', (name) => {
    expect(nameWarning(name)).toBe(`"${name}" reads like a file name. ${NAMING_RULE} Rename it with canon_update.`);
  });

  it.each(['test', 'Test 2', 'test-3', 'untitled', 'New prototype', 'demo1', 'Prototype 4', 'new page 2', 'tmp_5'])(
    'calls %j a placeholder',
    (name) => {
      expect(nameWarning(name)).toBe(`"${name}" reads like a placeholder. ${NAMING_RULE} Rename it with canon_update.`);
    },
  );

  it('says an empty name has no name', () => {
    expect(nameWarning('')).toBe(`This prototype has no name. ${NAMING_RULE} Rename it with canon_update.`);
  });

  it('treats a non-string as no name', () => {
    expect(nameWarning(undefined)).toBe(`This prototype has no name. ${NAMING_RULE} Rename it with canon_update.`);
  });
});

describe('followsNamingRule', () => {
  it('is true for two parts around a comma', () => {
    expect(followsNamingRule('Pricing page, annual toggle')).toBe(true);
  });
  it('is false for one part', () => {
    expect(followsNamingRule('Pricing page')).toBe(false);
  });
  it('is true when only the parts, not the whole name, look like placeholders', () => {
    expect(followsNamingRule('test 2, new')).toBe(true);
  });
  it('is false for an empty first part', () => {
    expect(followsNamingRule(', annual')).toBe(false);
  });
  it('is false for an empty second part', () => {
    expect(followsNamingRule('Pricing page, ')).toBe(false);
  });
  it('is false for a file name', () => {
    expect(followsNamingRule('index.html')).toBe(false);
  });
});
