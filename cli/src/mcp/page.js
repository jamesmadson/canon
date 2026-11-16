/**
 * Reads a prototype's own page, once, to get a title and headings for
 * automatic tags. Nothing is sent but a GET with an accept header.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

function clean(fragment) {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, key) => ENTITIES[key])
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPage(html) {
  const source = typeof html === 'string' ? html : '';
  const body = source
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '')
    .replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '');
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(body);
  const title = titleMatch ? clean(titleMatch[1]).slice(0, 300) : '';
  const headings = [];
  const pattern = /<(h[12])\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let match;
  while (headings.length < 20 && (match = pattern.exec(body))) {
    const text = clean(match[2]).slice(0, 200);
    if (text) headings.push(text);
  }
  return { title, headings };
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
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') || !response.body) return null;
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
    return extractPage(text);
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
