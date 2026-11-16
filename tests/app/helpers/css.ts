import { readFileSync } from 'node:fs';

export const css = readFileSync(new URL('../../../src/app/app.css', import.meta.url), 'utf8');

/** The text between the braces of the first block that opens with the pattern. */
export function body(source: string, opener: RegExp): string {
  const m = opener.exec(source);
  if (!m) throw new Error(`no block for ${opener}`);
  let depth = 0;
  let i = source.indexOf('{', m.index);
  const start = i + 1;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) break;
  }
  return source.slice(start, i);
}
