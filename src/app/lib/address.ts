export type ProjectTab = 'prototypes' | 'boards' | 'comments';
export type Width = number | 'fill' | null;
export type Address =
  | { name: 'home'; tags?: string[] }
  | { name: 'starred'; tags?: string[] }
  | { name: 'archive'; tags?: string[] }
  | { name: 'tag'; tag: string }
  | { name: 'project'; project: string; tab: ProjectTab }
  | { name: 'board'; board: string; frame: string | null; /** Open the board centred on this prototype, selected. Set only by the app. */ show?: string }
  | { name: 'bundle'; frame: string; from: string | null; page: string | null }
  | { name: 'full'; frame: string; board: string | null; width: Width; path: string | null };

/** The tags chosen in the address, in order, without blanks or repeats. */
const tagsOf = (q: URLSearchParams): string[] => [...new Set(q.getAll('tag').map((t) => t.trim()).filter(Boolean))];
const withTags = <A extends Address>(a: A, tags: string[]): A => (tags.length ? { ...a, tags } : a);
const tagQuery = (tags?: string[]) => (tags?.length ? `?${tags.map((t) => `tag=${encodeURIComponent(t)}`).join('&')}` : '');

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
  const tags = tagsOf(q);
  if (seg.length === 1 && seg[0] === '') return withTags({ name: 'home' }, tags);
  if (seg.length === 1 && seg[0] === 'starred') return withTags({ name: 'starred' }, tags);
  if (seg.length === 1 && seg[0] === 'archive') return withTags({ name: 'archive' }, tags);
  if (seg[0] === 't' && seg[1] && seg.length === 2) return { name: 'tag', tag: dec(seg[1]) };
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
    if (seg.length === 2) return q.get('show') ? { name: 'board', board, frame: null, show: q.get('show')! } : { name: 'board', board, frame: null };
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
      return `#/${tagQuery(a.tags)}`;
    case 'starred':
      return `#/starred${tagQuery(a.tags)}`;
    case 'archive':
      return `#/archive${tagQuery(a.tags)}`;
    case 'tag':
      return `#/t/${enc(a.tag)}`;
    case 'project':
      return `#/p/${enc(a.project)}${a.tab === 'prototypes' ? '' : `/${a.tab}`}`;
    case 'board':
      return `#/b/${enc(a.board)}${a.frame ? `/f/${enc(a.frame)}` : a.show ? `?show=${enc(a.show)}` : ''}`;
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

/**
 * Where an older saved link should go. Links to a prototype used to open it on
 * its board; they now open the prototype view. A board's own full-screen view
 * is marked as opened by the app, so only a link from outside is moved.
 */
export function canonicalAddress(a: Address, openedByApp: boolean): Address | null {
  if (a.name === 'tag') return { name: 'home', tags: [a.tag] };
  if (a.name === 'board' && a.frame) return { name: 'full', frame: a.frame, board: null, width: null, path: null };
  if (a.name === 'full' && a.board && !openedByApp) return { ...a, board: null };
  return null;
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
