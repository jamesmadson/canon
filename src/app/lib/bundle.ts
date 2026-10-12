/**
 * A multi-page prototype, read as a site: its pages, the links between them,
 * and a layout that shows its IA. Pure, so the rules are testable.
 */
import type { Point } from './layout';

export type Edge = [string, string];

/** A link's target as a page path inside the prototype, or null if it leaves it. */
export function resolveHref(fromPath: string, href: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  const parts = clean.startsWith('/') ? [] : fromPath.split('/').slice(0, -1);
  for (const seg of clean.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(decodeURIComponent(seg));
  }
  let path = parts.join('/');
  if (clean.endsWith('/') || path === '') path = path ? `${path}/index.html` : 'index.html';
  return path;
}

export function linksFrom(html: string): string[] {
  const out: string[] = [];
  const re = /<(?:a|area)\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function linkGraph(pages: string[], htmlByPath: Record<string, string>): Edge[] {
  const set = new Set(pages);
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const from of pages) {
    for (const href of linksFrom(htmlByPath[from] ?? '')) {
      const to = resolveHref(from, href);
      if (!to || to === from || !set.has(to)) continue;
      const key = `${from}\n${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([from, to]);
    }
  }
  return edges;
}

/** Entry first, then pages in the order links reach them, then the rest A to Z. */
export function orderPages(pages: string[], entry: string, edges: Edge[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = pages.includes(entry) ? [entry] : [];
  while (queue.length) {
    const p = queue.shift()!;
    if (seen.has(p)) continue;
    seen.add(p);
    order.push(p);
    for (const [a, b] of edges) if (a === p && !seen.has(b)) queue.push(b);
  }
  return [...order, ...pages.filter((p) => !seen.has(p)).sort((a, b) => a.localeCompare(b))];
}

/**
 * The IA view: the entry in the first column, each page one column right of
 * the shallowest page that links to it, and anything unreachable gathered in
 * a last column. Every page is drawn at the same size.
 */
export function iaLayout(
  pages: string[],
  entry: string,
  edges: Edge[],
  size: { w: number; h: number },
  gaps: { colGap: number; rowGap: number }
): { positions: Record<string, Point>; unlinked: string[]; columns: number } {
  const depth: Record<string, number> = {};
  const queue: string[] = [];
  if (pages.includes(entry)) {
    depth[entry] = 0;
    queue.push(entry);
  }
  const order: string[] = [];
  while (queue.length) {
    const p = queue.shift()!;
    order.push(p);
    for (const [a, b] of edges) if (a === p && depth[b] === undefined) {
      depth[b] = depth[p] + 1;
      queue.push(b);
    }
  }
  const unlinked = pages.filter((p) => depth[p] === undefined).sort((a, b) => a.localeCompare(b));
  const maxDepth = order.length ? Math.max(...order.map((p) => depth[p])) : -1;
  const rows: Record<number, number> = {};
  const positions: Record<string, Point> = {};
  const place = (p: string, col: number) => {
    const row = rows[col] ?? 0;
    rows[col] = row + 1;
    positions[p] = { x: col * (size.w + gaps.colGap), y: row * (size.h + gaps.rowGap) };
  };
  for (const p of order) place(p, depth[p]);
  for (const p of unlinked) place(p, maxDepth + 1);
  return { positions, unlinked, columns: maxDepth + 1 + (unlinked.length ? 1 : 0) };
}

export interface TeaseSlot { side: 'right' | 'left'; depth: number }

/** Where the hover tease puts each extra page: right first, then alternating, four at most. */
export function teaseSlots(extra: number): TeaseSlot[] {
  return Array.from({ length: Math.min(4, extra) }, (_, i) => ({ side: i % 2 === 0 ? 'right' : 'left', depth: Math.floor(i / 2) + 1 }));
}

/**
 * Global navigation turns an IA into a mesh: every page links to every
 * section. A target that most pages link to is navigation; drawing those
 * links hides the flow. The entry's own links stay as flow, so the first
 * column still fans out to the sections. Prototypes under four pages are
 * left as they are.
 */
export function splitNav(pages: string[], edges: Edge[], entry?: string): { flow: Edge[]; navigation: Edge[] } {
  if (pages.length < 4) return { flow: edges, navigation: [] };
  const inbound: Record<string, number> = {};
  for (const [, b] of edges) inbound[b] = (inbound[b] ?? 0) + 1;
  const threshold = Math.ceil((pages.length - 1) * 0.6);
  const isNav = (b: string) => (inbound[b] ?? 0) >= threshold;
  const flow: Edge[] = [];
  const navigation: Edge[] = [];
  for (const e of edges) (isNav(e[1]) && e[0] !== entry ? navigation : flow).push(e);
  return { flow, navigation };
}
