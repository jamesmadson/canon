export type ProjectTab = 'prototypes' | 'boards' | 'comments';
export type Width = number | 'fill' | null;
export type Address =
  | { name: 'home' }
  | { name: 'project'; project: string; tab: ProjectTab }
  | { name: 'board'; board: string; frame: string | null }
  | { name: 'bundle'; frame: string; from: string | null; page: string | null }
  | { name: 'full'; frame: string; board: string | null; width: Width; path: string | null };

const dec = (s: string) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/** Reads a location hash the way the app's router does: '#/…', '#…' or bare. Bad input falls back to home; it never throws. */
export function parseAddress(hash: string): Address {
  const raw = hash.replace(/^#\/?/, '');
  const cut = raw.indexOf('?');
  const [route, query] = cut < 0 ? [raw, ''] : [raw.slice(0, cut), raw.slice(cut + 1)];
  const seg = route.split('/');
  const q = new URLSearchParams(query);
  if (seg[0] === 'p' && seg[1] && seg.length <= 3) {
    const tab = seg[2];
    if (seg.length === 2) return { name: 'project', project: dec(seg[1]), tab: 'prototypes' };
    if (tab === 'boards' || tab === 'comments') return { name: 'project', project: dec(seg[1]), tab };
    return { name: 'home' };
  }
  if (seg[0] === 'f' && seg[1]) {
    if (seg.length === 2) return { name: 'bundle', frame: dec(seg[1]), from: q.get('from'), page: q.get('page') };
    if (seg.length === 3 && seg[2] === 'full') return { name: 'full', frame: dec(seg[1]), board: null, ...fullQuery(q) };
    return { name: 'home' };
  }
  if (seg[0] === 'b' && seg[1]) {
    const board = dec(seg[1]);
    if (seg.length === 2) return { name: 'board', board, frame: null };
    if (seg[2] === 'f' && seg[3]) {
      if (seg.length === 4) return { name: 'board', board, frame: dec(seg[3]) };
      if (seg.length === 5 && seg[4] === 'full') return { name: 'full', frame: dec(seg[3]), board, ...fullQuery(q) };
    }
  }
  return { name: 'home' };
}

function fullQuery(q: URLSearchParams): { width: Width; path: string | null } {
  const w = q.get('w');
  const p = q.get('path');
  return {
    width: w === 'fill' ? 'fill' : w && /^[1-9]\d*$/.test(w) ? Number(w) : null,
    path: p ? safePath(p) : null,
  };
}

const enc = encodeURIComponent;

/** The hash for an address, always '#/…' ('#/' for home). */
export function buildAddress(a: Address): string {
  switch (a.name) {
    case 'home':
      return '#/';
    case 'project':
      return `#/p/${enc(a.project)}${a.tab === 'prototypes' ? '' : `/${a.tab}`}`;
    case 'board':
      return `#/b/${enc(a.board)}${a.frame ? `/f/${enc(a.frame)}` : ''}`;
    case 'bundle': {
      const q = new URLSearchParams();
      if (a.from !== null) q.set('from', a.from);
      if (a.page !== null) q.set('page', a.page);
      const qs = q.toString();
      return `#/f/${enc(a.frame)}${qs ? `?${qs}` : ''}`;
    }
    case 'full': {
      const q = new URLSearchParams();
      if (a.width !== null) q.set('w', String(a.width));
      if (a.path !== null) q.set('path', a.path);
      const qs = q.toString();
      const base = a.board ? `#/b/${enc(a.board)}/f/${enc(a.frame)}` : `#/f/${enc(a.frame)}`;
      return `${base}/full${qs ? `?${qs}` : ''}`;
    }
  }
}

/** A path on the prototype's own origin, or null if it could point anywhere else. */
export function safePath(path: string): string | null {
  // URL parsers drop tabs and newlines, so '/\t/evil' would read as '//evil'.
  if (!path || /[\u0000-\u001f\u007f\\]/.test(path) || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  return path.startsWith('/') ? path : `/${path}`;
}

/** The frame's URL with a path applied. Same origin only; anything else returns the frame URL unchanged. */
export function joinPath(frameUrl: string, path: string | null): string {
  const safe = path === null ? null : safePath(path);
  if (safe === null) return frameUrl;
  try {
    const base = new URL(frameUrl);
    const next = new URL(safe, base);
    return next.origin === base.origin ? next.href : frameUrl;
  } catch {
    return frameUrl;
  }
}
