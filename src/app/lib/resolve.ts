import { SIZES } from './sizes';

export type Resolved<T> = { ok: true; item: T } | { ok: false; reason: 'none' | 'many'; matches: T[] };

/** Finds one item by id, then exact name, then unique substring (unless exact). Never guesses between several. */
export function resolveByName<T extends { id: string; name: string }>(items: T[], query: string, opts: { exact?: boolean } = {}): Resolved<T> {
  const q = query.trim().toLowerCase();
  if (!q) return { ok: false, reason: 'none', matches: [] };
  const byId = items.find((i) => i.id === query.trim());
  if (byId) return { ok: true, item: byId };
  const rules = [(n: string) => n === q, (n: string) => n.includes(q)];
  for (const match of opts.exact ? rules.slice(0, 1) : rules) {
    const found = items.filter((i) => match(i.name.trim().toLowerCase()));
    if (found.length === 1) return { ok: true, item: found[0] };
    if (found.length > 1) return { ok: false, reason: 'many', matches: found };
  }
  return { ok: false, reason: 'none', matches: [] };
}

/** Finds one stack by the id or name of any of its versions. Several versions of one stack are one match. */
export function resolveStack<T extends { id: string; name: string }>(stacks: T[][], query: string): Resolved<T[]> {
  const q = query.trim().toLowerCase();
  if (!q) return { ok: false, reason: 'none', matches: [] };
  const byId = stacks.find((s) => s.some((i) => i.id === query.trim()));
  if (byId) return { ok: true, item: byId };
  const rules = [(n: string) => n === q, (n: string) => n.includes(q)];
  for (const match of rules) {
    const found = stacks.filter((s) => s.some((i) => match(i.name.trim().toLowerCase())));
    if (found.length === 1) return { ok: true, item: found[0] };
    if (found.length > 1) return { ok: false, reason: 'many', matches: found };
  }
  return { ok: false, reason: 'none', matches: [] };
}

// host[:port][/…] where host is localhost, an IPv4, [ipv6] or a dotted name
const BARE_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\]|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$/i;

/** A prototype URL we are willing to frame: http or https only. A bare host gets http://. */
export function checkPrototypeUrl(input: string): { ok: true; url: string } | { ok: false; message: string } {
  const text = input.trim();
  const refuse = { ok: false as const, message: 'Only http and https URLs can go on a board.' };
  const candidate = !text.includes('://') && BARE_HOST.test(text) ? `http://${text}` : text;
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? { ok: true, url: u.href } : refuse;
  } catch {
    return refuse;
  }
}

/** A URL safe to frame or link: http(s) as is, anything else 'about:blank'. */
export function safeFrameUrl(url: string | undefined): string {
  if (!url) return 'about:blank';
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : 'about:blank';
  } catch {
    return 'about:blank';
  }
}

const NAMED_WIDTHS: Record<string, number> = Object.fromEntries(SIZES.map((s) => [s.name.toLowerCase(), s.w]));

/** A width from a name, 'fill', or a positive whole number. Anything else is null. */
export function parseWidth(w: unknown): number | 'fill' | null {
  if (w === 'fill') return 'fill';
  if (typeof w === 'string' && Object.hasOwn(NAMED_WIDTHS, w)) return NAMED_WIDTHS[w];
  return typeof w === 'number' && Number.isInteger(w) && w > 0 ? w : null;
}
