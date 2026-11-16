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
 * answer is never read. 'skipped' means the address is not on this machine
 * and nothing was requested.
 */
export async function probeLoopback(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 2500): Promise<'up' | 'down' | 'skipped'> {
  if (!loopbackHost(url)) return 'skipped';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(`${new URL(url).origin}/`, { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store', redirect: 'manual', referrerPolicy: 'no-referrer', signal: controller.signal });
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
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
