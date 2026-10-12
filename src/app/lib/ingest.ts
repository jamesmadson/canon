/**
 * Turning whatever someone drops into one prototype: a set of files keyed by
 * path, and the HTML file that opens it. Pure, so the rules are testable
 * without a browser.
 */

const isJunk = (path: string) => path.startsWith('__MACOSX/') || /(^|\/)\._/.test(path) || /(^|\/)\.DS_Store$/.test(path);

/** Drop the single folder a zip or a dropped folder wraps everything in. */
export function stripCommonRoot(paths: string[]): string[] {
  const real = paths.filter((p) => !isJunk(p));
  if (real.length === 0) return paths;
  const first = real[0].split('/')[0];
  const shared = real.every((p) => p.includes('/') && p.split('/')[0] === first);
  if (!shared) return paths;
  return paths.map((p) => (isJunk(p) || !p.startsWith(`${first}/`) ? p : p.slice(first.length + 1)));
}

/** The file that opens the prototype: index.html, shallowest first, else any HTML. */
export function pickEntry(paths: string[]): string | null {
  const html = paths.filter((p) => !isJunk(p) && /\.html?$/i.test(p));
  if (html.length === 0) return null;
  const depth = (p: string) => p.split('/').length;
  const indexes = html.filter((p) => /(^|\/)index\.html?$/i.test(p)).sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  if (indexes.length) return indexes[0];
  return [...html].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))[0];
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function titleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = match[1].replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]).replace(/\s+/g, ' ').trim();
  return title || null;
}

export function nameFromFile(fileName: string): string {
  return fileName.replace(/\.(zip|html?)$/i, '').replace(/[-_]+/g, ' ').trim();
}

const TYPES: Record<string, string> = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff',
  woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain',
  wasm: 'application/wasm',
};

export function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'application/octet-stream';
}

export const isZipName = (name: string) => /\.zip$/i.test(name);
