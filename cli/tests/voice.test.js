import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * D-38, made testable the way D-01 is.
 *
 * Product copy is clear, concise and professional. No en dash and no em dash
 * anywhere: restructure the sentence instead. No exclamation point. None of
 * the words that sound like a launch announcement.
 *
 * The rule is enforced on strings, not on code, so the two are separated
 * before anything is judged. In JavaScript that means the quoted literals; in
 * the template it means the literals inside the script plus the text a reader
 * actually sees on the page.
 */

const cliDir = fileURLToPath(new URL('..', import.meta.url));

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

const BANNED = [
  'powerful',
  'seamless',
  'seamlessly',
  'effortless',
  'effortlessly',
  'magic',
  'magical',
  'supercharge',
  'delight',
  'unlock',
];

function shippedFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : shippedFiles(path);
    return /\.(js|html|json)$/.test(entry.name) ? [path] : [];
  });
}

const files = shippedFiles(cliDir);

/** Quoted literals, which is where a user facing string lives in this codebase. */
function literals(source) {
  const pattern = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  return source.match(pattern) || [];
}

/** What a reader sees on the page: text with the markup and the script removed. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]*>/g, ' ');
}

function findings(strings) {
  const problems = [];
  for (const string of strings) {
    if (string.includes(EN_DASH)) problems.push(`en dash in ${string}`);
    if (string.includes(EM_DASH)) problems.push(`em dash in ${string}`);
    if (string.includes('!')) problems.push(`exclamation point in ${string}`);
    for (const word of BANNED) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(string)) problems.push(`${word} in ${string}`);
    }
  }
  return problems;
}

describe('the voice, per D-38', () => {
  it('finds the shipped files to read', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('keeps en and em dashes out of every file, comments included', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes(EN_DASH), `en dash in ${file}`).toBe(false);
      expect(source.includes(EM_DASH), `em dash in ${file}`).toBe(false);
    }
  });

  it('keeps the banned words and the exclamation point out of every string', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(findings(literals(source)), file).toEqual([]);
    }
  });

  it('keeps them out of the words a reader sees on the dashboard', () => {
    const html = readFileSync(join(cliDir, 'src', 'template.html'), 'utf8');
    expect(findings([visibleText(html)])).toEqual([]);
  });

  it('catches a violation, so the check is doing work', () => {
    expect(findings(["'a powerful and seamless thing'"])).toHaveLength(2);
    expect(findings([`'a ${EM_DASH} b'`])).toHaveLength(1);
    expect(findings(["'ship it!'"])).toHaveLength(1);
  });
});
