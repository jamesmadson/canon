/**
 * Reads a prototype's own page, once, to get a title and headings for
 * automatic tags, and whether it refuses to be framed. Nothing is sent but a
 * GET with an accept header.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Drops tags in one forward pass. An unclosed tag drops the rest, so hostile input cannot make this slow. */
function stripTags(fragment) {
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

function clean(fragment) {
  return stripTags(fragment)
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, key) => ENTITIES[key])
    .replace(/\s+/g, ' ')
    .trim();
}

const AFTER_NAME = new Set(['>', ' ', '\n', '\t', '\r', '/']);

/**
 * The inside of the next <tag>...</tag> at or after from, or null. Every
 * search runs forward once, and a tag that never closes ends the search, so
 * the time taken grows with the length of the page and no faster.
 */
function element(lower, source, tag, from) {
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

export function extractPage(html) {
  const source = typeof html === 'string' ? html : '';
  const body = source
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '')
    .replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '');
  // ASCII only, so every index in lower is the same index in body.
  const lower = body.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const titleFound = element(lower, body, 'title', 0);
  const title = titleFound ? clean(titleFound.text).slice(0, 300) : '';
  const headings = [];
  const next = { h1: element(lower, body, 'h1', 0), h2: element(lower, body, 'h2', 0) };
  while (headings.length < 20 && (next.h1 || next.h2)) {
    const tag = !next.h2 || (next.h1 && next.h1.end < next.h2.end) ? 'h1' : 'h2';
    const found = next[tag];
    const text = clean(found.text).slice(0, 200);
    if (text) headings.push(text);
    next[tag] = element(lower, body, tag, found.end);
  }
  return { title, headings };
}

/** The directive's sources in one Content-Security-Policy header value, or null when it has no frame-ancestors. */
function frameAncestors(policy) {
  for (const part of String(policy).split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name && name.toLowerCase() === 'frame-ancestors') return sources;
  }
  return null;
}

/**
 * Whether the response says the page may not be shown inside other pages:
 * X-Frame-Options DENY or SAMEORIGIN, or a frame-ancestors directive that
 * lets no origin through. A wildcard, a scheme wildcard or a localhost origin
 * lets Canon's own address through, so those do not count.
 */
export function frameBlockedBy(headers) {
  const xfo = String(headers.get('x-frame-options') || '').trim().toUpperCase();
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN') return true;
  const csp = headers.get('content-security-policy');
  if (!csp) return false;
  // Several policies arrive joined with a comma, and each one applies.
  return csp.split(',').some((policy) => {
    const sources = frameAncestors(policy);
    if (!sources) return false;
    return !sources.some((s) => s === '*' || /^[a-z][a-z0-9+.-]*:$/i.test(s) || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(s));
  });
}

export async function readPage(url, { fetchImpl = globalThis.fetch, timeoutMs = 3000, maxBytes = 512 * 1024 } = {}) {
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const work = (async () => {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'text/html' },
      redirect: 'follow',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const blocked = frameBlockedBy(response.headers);
    const flagged = (page) => (blocked ? { ...page, frameBlocked: true } : page);
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') || !response.body) return blocked ? flagged({ title: '', headings: [] }) : null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return flagged(extractPage(text));
  })().catch(() => null);
  try {
    return await Promise.race([work, timedOut]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
