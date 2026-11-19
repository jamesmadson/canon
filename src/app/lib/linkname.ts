/**
 * Naming a link added by hand. Canon cannot read another site's HTML, so the
 * name comes from the address: its last meaningful path segment in words,
 * else the host without www. A page served from Canon's own origin is the one
 * case where its title can be read, and only then.
 */

const WORDLESS = /^(index|default|home|main|html?)$/i;
const IDLIKE = /^(\d+|[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const safeDecode = (s: string) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

export function nameFromUrl(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url.trim(); }
  const segments = u.pathname.split('/').map((s) => safeDecode(s).replace(/\.(html?|php|aspx?)$/i, '').trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (WORDLESS.test(seg) || IDLIKE.test(seg)) continue;
    const words = seg.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (words) return words[0].toUpperCase() + words.slice(1);
  }
  return u.host.replace(/^www\./, '') || url;
}

/* The name typed in the add dialog, held until the add reads it. */
const typed = new Map<string, string>();
export function rememberLinkName(url: string, name: string) {
  if (name.trim()) typed.set(url, name.trim());
  else typed.delete(url);
}
export function takeLinkName(url: string): string | undefined {
  const name = typed.get(url);
  typed.delete(url);
  return name;
}

/** The page's title, read only when it is on the same origin as Canon. Another origin's document is never touched. */
export function titleFromSameOrigin(frame: HTMLIFrameElement, pageUrl: string, ownOrigin: string): string | null {
  try {
    if (new URL(pageUrl).origin !== ownOrigin) return null;
    return frame.contentDocument?.title?.trim() || null;
  } catch {
    return null;
  }
}
