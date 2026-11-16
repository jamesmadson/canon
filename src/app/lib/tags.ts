export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 40;

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'my', 'our', 'your', 'page', 'app', 'site']);
const SKIP_PHRASES = new Set([
  'document', 'untitled', 'home', 'index', 'welcome', 'hello world', 'react app', 'vite app',
  'vite + react', 'vite + react + ts', 'next app', 'create next app', 'localhost',
].map((p) => normalizeTag(p)));
const NO_BRANCH = new Set(['main', 'master', 'head', 'trunk', 'develop']);
const PAIRS = new Set(['co.uk', 'com.au', 'co.jp', 'co.nz', 'com.br']);

/** Lower case, punctuation other than - and / dropped, spaces collapsed, cut to MAX_TAG_LENGTH. '' when nothing is left. */
export function normalizeTag(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.toLowerCase().replace(/[^\p{L}\p{N}\s/-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();
}

function words(tag: string): string[] {
  const all = tag.split(' ').filter(Boolean);
  const sig = all.filter((w) => !STOP.has(w));
  return (sig.length ? sig : all).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

function sameWords(a: string, b: string): boolean {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  const inY = x.every((w) => y.includes(w));
  const inX = y.every((w) => x.includes(w));
  return inY || inX;
}

/** The existing tag to use in place of candidate, or candidate. Words match when one tag's significant words are all in the other's. */
export function reuseTag(candidate: string, existing: string[]): string {
  const c = normalizeTag(candidate);
  if (!c) return '';
  const pool = existing.map(normalizeTag).filter(Boolean);
  if (pool.includes(c)) return c;
  return pool.find((e) => sameWords(c, e)) ?? c;
}

export interface TagSources { title?: string; headings?: string[]; tool?: string; repo?: string; branch?: string }

function phraseTag(raw: string): string {
  const n = normalizeTag(raw);
  if (!n || SKIP_PHRASES.has(n) || SKIP_PHRASES.has(raw.trim().toLowerCase())) return '';
  const sig = n.split(' ').filter((w) => w && !STOP.has(w));
  if (sig.length < 1 || sig.length > 3) return '';
  return sig.join(' ');
}

/** Candidate tags in order: tool, repo, branch, title, headings. Not yet matched against a project. */
export function autoTags(src: TagSources): string[] {
  const out: string[] = [];
  const push = (t: string) => { if (t && !out.includes(t) && out.length < 6) out.push(t); };
  if (src.tool) push(normalizeTag(src.tool));
  if (src.repo) push(normalizeTag(src.repo));
  if (src.branch && !NO_BRANCH.has(src.branch.trim().toLowerCase())) push(normalizeTag(src.branch));
  if (src.title) push(phraseTag(src.title.split(/\s+\|\s+|\s+-\s+|\s+·\s+|:\s+/)[0] ?? ''));
  let heads = 0;
  for (const h of src.headings ?? []) {
    if (heads >= 3 || out.length >= 6) break;
    const t = phraseTag(h);
    if (t && !out.includes(t)) { push(t); heads++; }
  }
  return out;
}

/** The tags a prototype ends with after an add or an update. */
export function mergeTags(input: { current?: string[]; removed?: string[]; auto?: string[]; passed?: string[]; projectTags?: string[] }): { tags: string[]; removedTags: string[] } {
  const tags = (input.current ?? []).filter(Boolean);
  let removed = [...new Set((input.removed ?? []).map(normalizeTag).filter(Boolean))];
  const pool = () => [...tags, ...(input.projectTags ?? [])];
  for (const p of input.passed ?? []) {
    const n = normalizeTag(p);
    if (!n) continue;
    const r = reuseTag(n, pool());
    removed = removed.filter((x) => x !== n && x !== r);
    if (!tags.includes(r) && tags.length < MAX_TAGS) tags.push(r);
  }
  for (const a of input.auto ?? []) {
    const n = normalizeTag(a);
    if (!n || removed.includes(n)) continue;
    const r = reuseTag(n, [...pool(), ...removed]);
    if (removed.includes(r) || tags.includes(r)) continue;
    if (tags.length < MAX_TAGS) tags.push(r);
  }
  return { tags, removedTags: removed };
}

/** A person adds or removes one tag. Removing records it so automatic tagging does not bring it back. */
export function addTag(meta: { tags?: string[]; removedTags?: string[] }, tag: string, projectTags: string[] = []): { tags: string[]; removedTags: string[] } {
  const tags = [...(meta.tags ?? [])];
  const removed = meta.removedTags ?? [];
  const n = normalizeTag(tag);
  if (!n) return { tags, removedTags: [...removed] };
  const r = reuseTag(n, [...tags, ...projectTags]);
  if (!tags.includes(r)) tags.push(r);
  return { tags, removedTags: removed.filter((x) => x !== n && x !== r) };
}

export function removeTag(meta: { tags?: string[]; removedTags?: string[] }, tag: string): { tags: string[]; removedTags: string[] } {
  const tags = [...(meta.tags ?? [])];
  const removed = [...(meta.removedTags ?? [])];
  const n = normalizeTag(tag);
  if (!n || !tags.includes(n)) return { tags, removedTags: removed };
  return { tags: tags.filter((t) => t !== n), removedTags: removed.includes(n) ? removed : [...removed, n] };
}

/** A source tag for a link added by hand: 'localhost', or the name before the public suffix ('foo.vercel.app' gives 'vercel'). '' if unreadable. */
export function hostTag(url: string): string {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
  host = host.replace(/^www\./, '');
  if (!host) return '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '0.0.0.0') return 'localhost';
  const labels = host.split('.');
  if (labels.length < 2 || labels.every((l) => /^\d+$/.test(l))) return '';
  const pair = labels.slice(-2).join('.');
  const at = PAIRS.has(pair) ? labels.length - 3 : labels.length - 2;
  return at >= 0 ? normalizeTag(labels[at]) : '';
}
