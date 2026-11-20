/**
 * What a card shows for a link that has no screenshot. Canon cannot read
 * another site's page, and many sites refuse to load inside another page, so
 * a live picture of a link is often a plain white rectangle. The tile shows
 * the site's own name instead: its first letter and its host, on a tint.
 * Nothing here touches the network.
 */

/** The host of an address without "www.", or empty when the address is not one. */
export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}

/** One capital letter for a link: from its host, else its name. */
export function monogramOf(url: string | undefined, name: string): string {
  const source = hostOf(url) || name.trim();
  const letter = Array.from(source.replace(/^[^\p{L}\p{N}]+/u, ''))[0];
  return letter ? letter.toUpperCase() : '·';
}
