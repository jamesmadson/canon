/**
 * Versions of one prototype stack together, newest on top, one marked current.
 * Kept pure for tests: the store decides when to stack, these decide how.
 */

export interface Stackable {
  id: string;
  name: string;
  kind: 'files' | 'linked' | 'url';
  url?: string;
  stackId?: string;
  current?: boolean;
  createdAt: number;
}

// Trailing words and numbers people add to tell copies apart.
const MARKER =
  /[\s._()-]*(?:v\d+(?:\.\d+)*|version[\s_-]*\d+|\(\d+\)|copy|final|latest|old|new|wip|draft|alt|\d{4}-\d{2}-\d{2}|\d{6,8}|\d{1,3})[\s._()-]*$/i;

/** What a prototype's name looks like once version markers are taken off. */
export function nameStem(name: string): string {
  let s = name.trim().toLowerCase().replace(/\.(html?|zip)$/i, '');
  for (let i = 0; i < 6; i++) {
    const next = s.replace(MARKER, '');
    if (next === s || next.length < 2) break;
    s = next;
  }
  return s.replace(/[\s._-]+/g, ' ').trim();
}

/**
 * Which project a preview link belongs to, so every preview of one project
 * lands in one stack: Vercel and Netlify branch and deploy previews, and
 * localhost by port.
 */
export function urlStem(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.trim().toLowerCase();
  }
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return `localhost:${u.port || '80'}`;
  // my-app-git-feature-x-team.vercel.app, my-app-3k2j9x8ab-team.vercel.app
  const vercel = host.match(/^(.+?)-(?:git-[a-z0-9-]+|[a-z0-9]{9})-[a-z0-9-]+\.vercel\.app$/);
  if (vercel) return `${vercel[1]}.vercel.app`;
  // deploy-preview-12--site.netlify.app, my-branch--site.netlify.app
  const netlify = host.match(/^.+--(.+)\.netlify\.app$/);
  if (netlify) return `${netlify[1]}.netlify.app`;
  const first = u.pathname.split('/').filter(Boolean)[0];
  return first ? `${host}/${first.toLowerCase()}` : host;
}

/** The key two prototypes share when they are versions of one thing. */
export const stemOf = (p: Pick<Stackable, 'name' | 'kind' | 'url'>) =>
  p.kind === 'url' && p.url ? `url:${urlStem(p.url)}` : `name:${nameStem(p.name)}`;

export const stackKey = (p: Pick<Stackable, 'id' | 'stackId'>) => p.stackId ?? p.id;

/** Every stack, each oldest first. A prototype on its own is a stack of one. */
export function stacks<T extends Stackable>(items: T[]): T[][] {
  const by = new Map<string, T[]>();
  for (const p of items) by.set(stackKey(p), [...(by.get(stackKey(p)) ?? []), p]);
  return [...by.values()].map((s) => s.sort((a, b) => a.createdAt - b.createdAt));
}

/** The version to show: the one marked current, else the newest. */
export function currentOf<T extends Stackable>(stack: T[]): T {
  return stack.find((p) => p.current) ?? stack.reduce((a, b) => (b.createdAt >= a.createdAt ? b : a));
}

export function versionOf<T extends Stackable>(stack: T[], id: string) {
  const sorted = [...stack].sort((a, b) => a.createdAt - b.createdAt);
  return sorted.findIndex((p) => p.id === id) + 1;
}

/** An existing prototype a new one should stack with, if any. */
export function stackFor<T extends Stackable>(items: T[], incoming: Pick<Stackable, 'id' | 'name' | 'kind' | 'url'>): T | undefined {
  const key = stemOf(incoming);
  if (key === 'name:' || key === 'url:') return undefined;
  const matches = items.filter((p) => p.id !== incoming.id && stemOf(p) === key);
  if (!matches.length) return undefined;
  return matches.reduce((a, b) => (b.createdAt >= a.createdAt ? b : a));
}
