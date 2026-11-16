/**
 * What a good prototype name looks like, and how to tell a placeholder from a
 * real name. Pure functions, no I/O.
 */

export const NAMING_RULE = 'Name it for what it is, then what is different, such as "Pricing page, annual toggle".';

const PLACEHOLDER_WORDS = [
  'new prototype',
  'new page',
  'test',
  'untitled',
  'new',
  'demo',
  'prototype',
  'example',
  'sample',
  'draft',
  'temp',
  'tmp',
  'foo',
  'bar',
  'page',
  'frame',
  'screen',
];
const PLACEHOLDER = new RegExp(`^(?:${PLACEHOLDER_WORDS.join('|')})[ _-]?\\d*$`, 'i');
const FILE_NAME = /^[^\s/\\]+\.(?:html?|jsx?|tsx?|mjs|cjs|css|scss|vue|svelte|astro|md|mdx|json|php|py|rb|png|jpe?g|gif|svg|webp|pdf|fig|sketch)$/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const LOCALHOST = /^localhost(?::\d+)?(?:[/?#]|$)/i;
const HOST = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:[/?#]\S*)?$/i;

function kindOf(name) {
  if (SCHEME.test(name) || LOCALHOST.test(name)) return 'a web address';
  if (FILE_NAME.test(name)) return 'a file name';
  if (HOST.test(name)) return 'a web address';
  if (PLACEHOLDER.test(name)) return 'a placeholder';
  return null;
}

export function nameWarning(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return `This prototype has no name. ${NAMING_RULE} Rename it with canon_update.`;
  const kind = kindOf(text);
  if (!kind) return null;
  return `"${name}" reads like ${kind}. ${NAMING_RULE} Rename it with canon_update.`;
}

export function followsNamingRule(name) {
  if (typeof name !== 'string') return false;
  const at = name.indexOf(',');
  if (at < 0) return false;
  if (!name.slice(0, at).trim() || !name.slice(at + 1).trim()) return false;
  return nameWarning(name) === null;
}
