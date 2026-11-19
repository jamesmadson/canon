/**
 * Moving between views by hash. A view the app opens itself is pushed with a
 * mark, so Back can go to exactly where the person came from; a view opened
 * from outside (a link from an agent, a pasted address) has no mark and
 * leaves for a fallback instead.
 */
import { type Address, buildAddress, canonicalAddress, parseAddress } from './address';

const MARK = 'canonFrom';

/** Open a view from inside the app and tell the router. pushState fires no hashchange, so dispatch one. */
export function openHash(hash: string) {
  history.pushState({ [MARK]: true }, '', hash);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Change the address without a history entry, keeping the mark. */
export function replaceAddress(a: Address) {
  history.replaceState(history.state, '', buildAddress(a));
  dispatchEvent(new HashChangeEvent('hashchange'));
}

export const cameFromApp = () => !!(history.state && (history.state as Record<string, unknown>)[MARK]);

/** The address in the location hash, with an older saved link moved to its current form in place. */
export function currentAddress(): Address {
  const a = parseAddress(location.hash);
  const to = canonicalAddress(a, cameFromApp());
  if (!to) return a;
  history.replaceState(history.state, '', buildAddress(to));
  return to;
}

/** Back to where the person came from, or to the fallback when they did not come from inside the app. */
export function leave(fallback: string) {
  if (cameFromApp()) history.back();
  else location.hash = fallback;
}
