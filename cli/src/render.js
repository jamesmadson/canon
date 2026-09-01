/**
 * Data plus template to one HTML file.
 *
 * The file is standalone by construction. There is no stylesheet link, no font
 * link, no image URL and no fetch anywhere in the template, and a thumbnail is
 * inlined as a data URI rather than referenced, so the page renders the same
 * on a laptop with the network switched off. The suite greps the rendered
 * output for a request rather than trusting this paragraph.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { isAbsolute, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveFamilies } from './families.js';
import { stalenessOf } from './staleness.js';
import { openReport, STRENGTH_SCALE } from './record.js';

export const PLACEHOLDER = '__CANON_DATA__';

const TEMPLATE_PATH = fileURLToPath(new URL('./template.html', import.meta.url));

/** Raster only at alpha. A vector file would need parsing to be trusted. */
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const MAX_THUMBNAIL_BYTES = 1_500_000;

// Valid JSON, invalid JavaScript. Both separators are written by codepoint so
// this file stays plain ASCII and nothing can flatten them into a space.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const SEPARATORS = new RegExp(`[${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g');

/**
 * JSON that is safe to sit inside a script element. The angle brackets are the
 * whole point: without escaping them a commit subject carrying a closing
 * script tag would end the block early.
 */
export function encodeData(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(SEPARATORS, (ch) => (ch === LINE_SEPARATOR ? '\\u2028' : '\\u2029'));
}

/**
 * Reads a person set thumbnail into a data URI. Returns null for anything it
 * cannot read, so the card falls back to the drawn mark and never shows a
 * broken image.
 */
export function inlineThumbnail(root, relativePath) {
  if (!relativePath) return null;
  const path = isAbsolute(relativePath) ? relativePath : join(root, relativePath);
  const type = IMAGE_TYPES[extname(path).toLowerCase()];
  if (!type || !existsSync(path)) return null;
  try {
    if (statSync(path).size > MAX_THUMBNAIL_BYTES) return null;
    return `data:${type};base64,${readFileSync(path).toString('base64')}`;
  } catch {
    return null;
  }
}

function excerpt(said, limit = 320) {
  const quoted = said
    .split('\n')
    .filter((line) => line.startsWith('>'))
    .map((line) => line.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
  const text = quoted || said.split('\n').filter(Boolean).join(' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
}

/**
 * Everything the page needs, and nothing it does not. Pure: takes what the
 * commands already read and returns the blob the template renders.
 */
export function buildDashboardData({
  repo,
  defaultBranch,
  branches,
  config,
  entries,
  generatedAt,
  root = '.',
  forkDates = {},
}) {
  const families = deriveFamilies(branches, {
    defaultBranch,
    selected: config.prototypes ?? null,
    familyRoots: config.familyRoots || {},
  }).map((family) => ({
    root: family.root,
    name: family.name,
    size: family.size,
    maxDepth: family.maxDepth,
    lastCommit: family.lastCommit,
    staleness: stalenessOf(family.lastCommit || generatedAt, generatedAt),
    forkedFrom: forkDates[family.root] || null,
    thumbnail: inlineThumbnail(root, (config.thumbnails || {})[family.root]),
    nodes: family.nodes.map((node) => ({
      name: node.name,
      label: node.label,
      parent: node.parent,
      depth: node.depth,
      sha: node.sha || '',
      subject: node.subject || '',
      lastCommit: node.lastCommit || null,
      orphaned: Boolean(node.orphaned),
      staleness: stalenessOf(node.lastCommit || generatedAt, generatedAt),
    })),
  }));

  const open = openReport(entries);

  return {
    generatedAt,
    repo,
    defaultBranch,
    scale: STRENGTH_SCALE,
    counts: {
      families: families.length,
      branches: families.reduce((total, family) => total + family.size, 0),
      entries: entries.length,
      open: open.length,
    },
    families,
    record: {
      dir: config.recordDir || '.strata',
      entries: entries.map((entry) => ({
        date: entry.date,
        slug: entry.slug,
        about: entry.about,
        participants: entry.participants,
        open: entry.open,
        quote: excerpt(entry.said || ''),
      })),
      open,
    },
  };
}

export function readTemplate() {
  return readFileSync(TEMPLATE_PATH, 'utf8');
}

export function renderDashboard(data, template = readTemplate()) {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`The template has lost its ${PLACEHOLDER} placeholder.`);
  }
  return template.replace(PLACEHOLDER, () => encodeData(data));
}
