/**
 * Whether the server behind a localhost address is running, and what a
 * prototype shows because of it. The check only ever asks this machine: an
 * address that is not localhost, 127.0.0.1 or [::1] is never requested.
 * Pure over an injected fetch, so the rules are testable.
 */
import type { Frame } from '../db';

export type Reach = 'none' | 'checking' | 'up' | 'down';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The host and port of an http or https address on this machine, else null. */
export function loopbackHost(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return LOOPBACK.has(u.hostname) ? u.host : null;
  } catch {
    return null;
  }
}

/**
 * One GET of the server's root: no body, no cookies, no headers, and the
 * answer is never read. A browser cannot ask with mode no-cors and also
 * refuse redirects, so the first ask is a cors one that stops at a redirect
 * (an opaque redirect counts as up, and the redirect is never followed). A
 * server that sends no CORS headers fails that ask just as a stopped one
 * does, so it is asked once more with no-cors. A redirect would already have
 * been caught by the first ask. 'skipped' means the address is not on this
 * machine and nothing was requested.
 */
export async function probeLoopback(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 2500): Promise<'up' | 'down' | 'skipped'> {
  if (!loopbackHost(url)) return 'skipped';
  const root = `${new URL(url).origin}/`;
  const ask = async (mode: RequestMode, redirect?: RequestRedirect) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetchImpl(root, { method: 'GET', mode, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', ...(redirect ? { redirect } : {}), signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  return (await ask('cors', 'manual')) || (await ask('no-cors')) ? 'up' : 'down';
}

export const serverOffMessage = (url: string) =>
  `The server at ${loopbackHost(url) ?? new URL(url).host} is not running. Start it, or ask your agent to add a built copy.`;

export type Shown =
  | { show: 'stored' }
  | { show: 'link' }
  | { show: 'wait' }
  | { show: 'live'; url: string }
  | { show: 'off'; url: string };

/**
 * What a prototype's frame shows. A stored copy shows its files unless Live
 * is on. A link to this machine waits for the check and says so when the
 * server is off. Every other link shows as it always did.
 */
export function decideShown(f: Pick<Frame, 'kind' | 'url' | 'liveUrl'>, liveOn: boolean, reach: Reach): Shown {
  if (f.kind === 'url') {
    if (!loopbackHost(f.url)) return { show: 'link' };
    if (reach === 'down') return { show: 'off', url: f.url! };
    return reach === 'up' ? { show: 'link' } : { show: 'wait' };
  }
  if (liveOn && f.liveUrl) return reach === 'down' ? { show: 'off', url: f.liveUrl } : { show: 'live', url: f.liveUrl };
  return { show: 'stored' };
}

/* ── Marks on Home: which prototypes will not load right now ───────────── */
export type Mark = 'server-off' | 'new-tab' | null;

export const PROBE_EVERY_MS = 60_000;
export const PROBE_MAX_HOSTS = 20;

/**
 * The quiet label a prototype gets on Home. Only a linked address is ever
 * marked: a stored copy always shows its files. A server that is off wins
 * over a page known to refuse framing, since it would not load either way.
 */
export function markOf(f: Pick<Frame, 'kind' | 'url' | 'frameBlocked'>, reach: Reach): Mark {
  if (f.kind !== 'url') return null;
  if (loopbackHost(f.url) && reach === 'down') return 'server-off';
  return f.frameBlocked === true ? 'new-tab' : null;
}

/** The local servers to ask about now: one per host and port, none asked within a minute, at most 20. */
export function hostsToProbe(frames: Pick<Frame, 'kind' | 'url'>[], lastAt: Map<string, number>, now: number): { host: string; url: string }[] {
  const out = new Map<string, string>();
  for (const f of frames) {
    if (f.kind !== 'url' || !f.url) continue;
    const host = loopbackHost(f.url);
    if (!host || out.has(host)) continue;
    const last = lastAt.get(host);
    if (last !== undefined && now - last < PROBE_EVERY_MS) continue;
    out.set(host, f.url);
    if (out.size >= PROBE_MAX_HOSTS) break;
  }
  return [...out].map(([host, url]) => ({ host, url }));
}
