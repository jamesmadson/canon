import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import * as store from './store';
import type { Frame, Note } from './db';
import { groupsFromFiles, linkFolder, prepare, type Group } from './intake';

export const html = htm.bind(h);
export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/* ── Icons: one stroke weight, 16px ─────────────────────────────────────── */
const P: Record<string, string> = {
  boards: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  record: 'M3 3.5h10M3 6.5h10M3 9.5h6M3 12.5h8',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
  cursor: 'M4 2.5l8 5.2-3.6.8-1.6 3.6z',
  pin: 'M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 10-9 0C3.5 9.8 8 14 8 14z M8 8.2a1.7 1.7 0 100-3.4 1.7 1.7 0 000 3.4z',
  fit: 'M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10',
  file: 'M4 1.5h5.5L12.5 4.5v10h-8.5zM9.5 1.5v3h3',
  folder: 'M1.8 4.2h4.3l1.4 1.5h6.7v7.8H1.8z',
  link: 'M6.5 9.5l3-3M5.2 7.8L3.8 9.2a2.5 2.5 0 003.5 3.5l1.4-1.4M10.8 8.2l1.4-1.4a2.5 2.5 0 00-3.5-3.5L7.3 4.7',
  globe: 'M8 14A6 6 0 108 2a6 6 0 000 12zM2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14M8 2C6.2 3.7 5.4 5.7 5.4 8S6.2 12.3 8 14',
  spark: 'M8 1.8v3.4M8 10.8v3.4M1.8 8h3.4M10.8 8h3.4M3.6 3.6l2.4 2.4M10 10l2.4 2.4M3.6 12.4L6 10M10 6l2.4-2.4',
  open: 'M9.5 2.5h4v4M13.5 2.5L8 8M12 9.5v4H2.5V4h4',
  refresh: 'M13 3.5v3h-3M3 12.5v-3h3M12.3 6.5A5 5 0 003.8 5M3.7 9.5a5 5 0 008.5 1.5',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9',
  search: 'M7 12A5 5 0 107 2a5 5 0 000 10zM10.6 10.6l3 3',
  download: 'M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10',
  x: 'M4 4l8 8M12 4l-8 8',
  back: 'M10 3L5 8l5 5',
  pages: 'M5 2.5h7.5v9H5zM3.5 4.5v9H11',
  comment: 'M2.5 3h11v7.5H7l-3 2.5v-2.5H2.5z',
  play: 'M5 3l8 5-8 5z',
  check: 'M3 8.5l3.2 3L13 4.5',
  share: 'M8 2.5v8M5 5.5l3-3 3 3M3.5 9v4.5h9V9',
  grid: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  table: 'M2.5 3h11v10h-11zM2.5 6.5h11M2.5 10h11M6.5 3v10',
  project: 'M2 4.5h4.5l1.5 1.5H14v7.5H2z',
};
export const Icon = ({ name, size = 16 }: { name: string; size?: number }) =>
  html`<svg width=${size} height=${size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name]} /></svg>`;

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  return store.getState();
}

export const go = (to: string) => (location.hash = to);

export const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const pageCount = (f: Frame) => f.pages?.length ?? 1;
export const pageName = (path: string) => path.replace(/\.html?$/i, '').replace(/\/index$/i, '/') || 'index';

/** Where a prototype page is served from, inside the app. */
export const frameSrc = (f: Frame, page?: string) =>
  f.kind === 'url' ? f.url! : `${BASE}app/p/${f.id}/${encodeURI(page ?? f.entry ?? 'index.html')}?v=${f.rev}`;
/** A link shown as its screenshot rather than live. */
export const showsCover = (f: Frame) => f.kind === 'url' && f.display === 'cover' && !!f.cover;
export const coverSrc = (f: Frame) => `${BASE}app/p/${f.id}/${encodeURIComponent(f.cover ?? '')}?v=${f.rev}`;
/** The same page opened in its own tab, where the comment layer appears. */
export const previewUrl = (f: Frame, page?: string) =>
  f.kind === 'url' ? f.url! : `${BASE}app/p/${f.id}/${encodeURI(page ?? f.entry ?? 'index.html')}`;

export const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
export const KIND: Record<Frame['kind'], string> = { files: 'Files', linked: 'Linked folder', url: 'URL' };
export const SIZES = [
  { name: 'Phone', w: 390, h: 844 },
  { name: 'Tablet', w: 834, h: 1112 },
  { name: 'Desktop', w: 1280, h: 800 },
];

/* ── Intake: picks and drops into a project, optionally onto a board ───── */
export async function addGroups(projectId: string, groups: Group[], opts: { boardId?: string; at?: { x: number; y: number } } = {}) {
  let added = 0;
  let stacked = 0;
  let x = opts.at?.x;
  for (const g of groups) {
    const p = await prepare(g);
    if (!p) {
      store.toast(`${g.name} has no HTML file, so there is nothing to show.`);
      continue;
    }
    const f = await store.addPrepared(projectId, p, { boardId: opts.boardId, at: x !== undefined && opts.at ? { x, y: opts.at.y } : undefined });
    if (x !== undefined) x += f.w + 120;
    added++;
    if (store.getState().frames.find((fr) => fr.id === f.id)?.stackId) stacked++;
  }
  // A single prototype that stacked already said so.
  if (added && !(added === 1 && stacked === 1)) store.toast(added === 1 ? 'Added one prototype.' : `Added ${added} prototypes${stacked ? `, ${stacked} as new versions` : ''}.`);
  return added;
}

function pickFiles(opts: { folder?: boolean }): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (opts.folder) (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    else {
      input.multiple = true;
      input.accept = '.html,.htm,.zip';
    }
    input.onchange = () => resolve(input.files);
    input.click();
  });
}

export type Way = 'files' | 'folder' | 'link' | 'url';
/** Runs one way in. Returns how many prototypes were added. */
export async function runWay(way: Way, projectId: string, boardId: string | undefined, askUrl: () => Promise<string | null>): Promise<number> {
  if (way === 'url') {
    const url = await askUrl();
    if (!url) return 0;
    await store.addUrl(projectId, url, { boardId });
    return 1;
  }
  let groups: Group[] = [];
  if (way === 'files' || way === 'folder') {
    const list = await pickFiles({ folder: way === 'folder' });
    if (!list?.length) return 0;
    const res = await groupsFromFiles(list);
    groups = res.groups;
    if (res.skipped) store.toast(`Skipped ${res.skipped} file${res.skipped > 1 ? 's' : ''} that were not HTML or zip.`);
  } else if (way === 'link') {
    const g = await linkFolder();
    if (!g) return 0;
    groups = [g];
  }
  if (!groups.length) return 0;
  return addGroups(projectId, groups, { boardId });
}

/* ── A note, wherever it is listed ──────────────────────────────────────── */
export function NoteItem({ note, n, about }: { note: Note; n?: number; about?: string }) {
  const frame = store.getState().frames.find((f) => f.id === note.frameId);
  const onPage = frame && note.page && note.page !== frame.entry ? pageName(note.page) : null;
  return html`<div class="note-item">
    <q>${note.said}</q>
    ${note.meant && html`<div class="meant">Meant, your reading: ${note.meant}</div>`}
    <div class="foot">
      ${n !== undefined && html`<span>#${n}</span>`}
      <span>${note.participant && /^P-\d+$/.test(note.participant) ? note.participant : 'No participant'}</span>
      ${about && html`<span>${about}</span>`}
      ${onPage && html`<span>${onPage}</span>`}
      ${note.source === 'preview' && html`<span>from preview</span>`}
      <span>${ago(note.createdAt)}</span>
      <button title="Delete note" onClick=${() => confirm('Delete this note?') && store.deleteNote(note.id)}><${Icon} name="x" size=${14} /></button>
    </div>
  </div>`;
}
