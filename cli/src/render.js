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

import { deriveFamilies, isCandidate } from './families.js';
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

/**
 * The verbatim out of a Said section.
 *
 * The blockquote is the words themselves and is preferred. Where an entry has
 * none, the prose underneath stands in, minus the italic provenance line: that
 * line says where the words came from, which is not something anybody said,
 * and it is where the source links live.
 */
/**
 * Is this paragraph the italic provenance line?
 *
 * Markdown already draws the line this needs. An asterisk followed by a space
 * opens a list item; an asterisk followed by anything else opens emphasis. So a
 * paragraph that opens with emphasis, closes with it, and contains no bullet is
 * the provenance, and a bullet list never is.
 *
 * The test is on the paragraph rather than the line because the provenance in
 * this repository wraps over three lines and carries the source URL on the
 * second. A line by line rule leaves that URL in the page.
 */
function isProvenance(paragraph) {
  const text = paragraph.trim();
  if (!text) return false;
  const opensEmphasis = /^\*[^\s*]/.test(text);
  const closesEmphasis = /[^\s*]\*$/.test(text);
  const hasBullet = /^[ \t]*\*[ \t]/m.test(text);
  return opensEmphasis && closesEmphasis && !hasBullet;
}

export function excerpt(said, limit = 320) {
  const lines = said.split('\n');
  const quoted = lines
    .filter((line) => line.startsWith('>'))
    .map((line) => line.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
  // The provenance is dropped a paragraph at a time. Matching across newlines
  // without that boundary ran from the first asterisk to the last one anywhere
  // below it, so a bullet list, which is how a summary is ordinarily written,
  // was eaten whole and the entry showed an empty quote.
  const prose = said
    .split(/\n[ \t]*\n/)
    .filter((paragraph) => !isProvenance(paragraph))
    .join('\n')
    .split('\n')
    .filter(Boolean)
    .join(' ')
    .trim();
  const text = quoted || prose;
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
}

/**
 * Everything the page needs, and nothing it does not. Pure: takes what the
 * commands already read and returns the blob the template renders.
 */
/**
 * The description under the repository name.
 *
 * package.json first, because a description written there was written to be
 * one. The README's opening paragraph next, because it is the closest thing a
 * repository without a manifest has. Nothing after that: a made up sentence
 * would be the one line on the page nobody could check.
 */
export function describeRepo(root) {
  try {
    const manifest = join(root, 'package.json');
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        return parsed.description.trim();
      }
    }
  } catch {
    // A manifest that will not parse is not a description.
  }

  try {
    const readme = join(root, 'README.md');
    if (existsSync(readme)) {
      const paragraphs = readFileSync(readme, 'utf8')
        .split(/\n[ \t]*\n/)
        .map((block) => block.trim())
        // The title, the badges and the rules are not the description.
        .filter((block) => block && !block.startsWith('#') && !block.startsWith('---'))
        .filter((block) => !/^[[!]/.test(block));
      if (paragraphs.length) {
        return paragraphs[0].replace(/\s*\n\s*/g, ' ').trim();
      }
    }
  } catch {
    // Unreadable is the same as absent.
  }

  return null;
}

export function buildDashboardData({
  repo,
  defaultBranch,
  branches,
  config,
  entries,
  generatedAt,
  root = '.',
  forkDates = {},
  remote = null,
  viewer = null,
  people = [],
  description = null,
}) {
  const families = deriveFamilies(branches, {
    defaultBranch,
    selected: config.prototypes ?? null,
    familyRoots: config.familyRoots || {},
  }).map((family) => ({
    root: family.root,
    name: family.name,
    // A family whose root is a shared prefix rather than a branch. The card
    // says prefix instead of branch, because calling it a branch would name
    // something you could not check out.
    virtualRoot: Boolean(family.virtualRoot),
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

  const branchCount = families.reduce((total, family) => total + family.size, 0);

  return {
    generatedAt,
    repo,
    defaultBranch,
    // Owner and repo from the origin URL where there is one. Reading the
    // configured URL is not contacting it, and nothing on the page links out.
    remote,
    description,
    viewer,
    // Everyone who has committed here. There is no member list in a
    // repository, so the page says where this came from rather than
    // presenting it as a roster somebody maintains.
    people,
    scale: STRENGTH_SCALE,
    counts: {
      families: families.length,
      branches: branchCount,
      // Every branch beside the default, so the strip can say how many of them
      // were chosen without the page doing arithmetic of its own.
      candidates: branches.filter((b) => isCandidate(b, defaultBranch)).length,
      stale: families.filter((f) => f.staleness.state === 'stale').length,
      entries: entries.length,
      open: open.length,
      people: people.length,
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
