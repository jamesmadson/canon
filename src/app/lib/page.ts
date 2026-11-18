/**
 * A prototype page's title and headings, for automatic tags. The same reader
 * as cli/src/mcp/page.js (a test keeps the two equal), so a dropped zip is
 * tagged by the rules a link is.
 */
import { autoTags, mergeTags } from './tags';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Drops tags in one forward pass. An unclosed tag drops the rest, so hostile input cannot make this slow. */
function stripTags(fragment: string): string {
  let out = '';
  let at = 0;
  for (;;) {
    const open = fragment.indexOf('<', at);
    if (open < 0) return out + fragment.slice(at);
    out += fragment.slice(at, open);
    const close = fragment.indexOf('>', open);
    if (close < 0) return out;
    at = close + 1;
  }
}

function clean(fragment: string): string {
  return stripTags(fragment)
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, key: string) => ENTITIES[key])
    .replace(/\s+/g, ' ')
    .trim();
}

const AFTER_NAME = new Set(['>', ' ', '\n', '\t', '\r', '/']);

/** The inside of the next <tag>...</tag> at or after from, or null. Every search runs forward once. */
function element(lower: string, source: string, tag: string, from: number): { text: string; end: number } | null {
  let open = from;
  for (;;) {
    open = lower.indexOf(`<${tag}`, open);
    if (open < 0) return null;
    if (AFTER_NAME.has(lower[open + tag.length + 1])) break;
    open += 1;
  }
  const start = lower.indexOf('>', open);
  if (start < 0) return null;
  const close = lower.indexOf(`</${tag}`, start);
  if (close < 0) return null;
  return { text: source.slice(start + 1, close), end: close };
}

export interface Page { title: string; headings: string[] }

export function extractPage(html: string): Page {
  const source = typeof html === 'string' ? html : '';
  const body = source
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '')
    .replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '');
  // ASCII only, so every index in lower is the same index in body.
  const lower = body.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const titleFound = element(lower, body, 'title', 0);
  const title = titleFound ? clean(titleFound.text).slice(0, 300) : '';
  const headings: string[] = [];
  const next = { h1: element(lower, body, 'h1', 0), h2: element(lower, body, 'h2', 0) };
  while (headings.length < 20 && (next.h1 || next.h2)) {
    const tag = !next.h2 || (next.h1 && next.h1.end < next.h2.end) ? 'h1' : 'h2';
    const found = next[tag]!;
    const text = clean(found.text).slice(0, 200);
    if (text) headings.push(text);
    next[tag] = element(lower, body, tag, found.end);
  }
  return { title, headings };
}

/** Where a dropped prototype came from, as a tag: 'files' for a zip or files, 'folder' for a linked folder. */
export type DropSource = 'files' | 'folder';

/**
 * The tags for a prototype dropped in the app, from its entry page: the
 * source first, then the title and headings, by the same rules as a link.
 * Tags in removed stay out, and a tag the project already has is reused.
 */
export function dropTags(entryHtml: string, source: DropSource, projectTags: string[], removed: string[] = []): string[] {
  const page = extractPage(entryHtml);
  return mergeTags({ auto: autoTags({ title: page.title, headings: page.headings, tool: source }), removed, projectTags }).tags;
}
