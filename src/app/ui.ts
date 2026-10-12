import { h } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import * as store from './store';
import type { Board, Frame, Note } from './db';
import { canLinkFolders, groupsFromDrop, groupsFromFiles, linkFolder, prepare, type Group } from './intake';
import { type Camera, clampZoom, fitCamera, screenToWorld, tidyPositions, zoomAt } from './lib/layout';

const html = htm.bind(h);
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
  tidy: 'M2.5 2.5h5v5h-5zM9.5 2.5h4v3h-4zM9.5 7.5h4v6h-4zM2.5 9.5h5v4h-5z',
  search: 'M7 12A5 5 0 107 2a5 5 0 000 10zM10.6 10.6l3 3',
  download: 'M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10',
  x: 'M4 4l8 8M12 4l-8 8',
  back: 'M10 3L5 8l5 5',
};
const Icon = ({ name, size = 16 }: { name: string; size?: number }) =>
  html`<svg width=${size} height=${size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name]} /></svg>`;

/* ── Store hook and routing ─────────────────────────────────────────────── */
function useStore() {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
  return store.getState();
}

type Route = { name: 'home' } | { name: 'board'; id: string } | { name: 'record' };
function parseRoute(): Route {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('b/')) return { name: 'board', id: hash.slice(2) };
  if (hash === 'record') return { name: 'record' };
  return { name: 'home' };
}
const go = (to: string) => (location.hash = to);

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const frameSrc = (f: Frame) => (f.kind === 'url' ? f.url! : `${BASE}app/p/${f.id}/${encodeURI(f.entry ?? 'index.html')}?v=${f.rev}`);
const KIND: Record<Frame['kind'], string> = { files: 'Files', linked: 'Linked folder', url: 'URL' };
const SIZES = [
  { name: 'Phone', w: 390, h: 844 },
  { name: 'Tablet', w: 834, h: 1112 },
  { name: 'Desktop', w: 1280, h: 800 },
];

/* ── Shared intake: turn picks and drops into frames on a board ─────────── */
async function addGroups(boardId: string, groups: Group[], at?: { x: number; y: number }) {
  let added = 0;
  let x = at?.x;
  for (const g of groups) {
    const p = await prepare(g);
    if (!p) {
      store.toast(`${g.name} has no HTML file, so there is nothing to show.`);
      continue;
    }
    const f = await store.addPrepared(boardId, p, x !== undefined && at ? { x, y: at.y } : undefined);
    if (x !== undefined) x += f.w + 120;
    added++;
  }
  if (added) store.toast(added === 1 ? 'Added one prototype.' : `Added ${added} prototypes.`);
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

export type Way = 'files' | 'folder' | 'link' | 'url' | 'sample';
async function runWay(way: Way, boardId: string | null, askUrl: () => Promise<string | null>): Promise<string | null> {
  if (way === 'sample') return (await store.createSampleBoard()).id;
  let groups: Group[] = [];
  if (way === 'files' || way === 'folder') {
    const list = await pickFiles({ folder: way === 'folder' });
    if (!list?.length) return null;
    const res = await groupsFromFiles(list);
    groups = res.groups;
    if (res.skipped) store.toast(`Skipped ${res.skipped} file${res.skipped > 1 ? 's' : ''} that were not HTML or zip.`);
  } else if (way === 'link') {
    const g = await linkFolder();
    if (!g) return null;
    groups = [g];
  }
  if (way === 'url') {
    const url = await askUrl();
    if (!url) return null;
    const id = boardId ?? (await store.createBoard('Untitled board')).id;
    await store.addUrl(id, url);
    return id;
  }
  if (!groups.length) return null;
  const id = boardId ?? (await store.createBoard(groups[0].name)).id;
  await addGroups(id, groups);
  return id;
}

/* ── URL dialog ─────────────────────────────────────────────────────────── */
function useUrlDialog() {
  const [open, setOpen] = useState<null | ((v: string | null) => void)>(null);
  const ask = () => new Promise<string | null>((resolve) => setOpen(() => resolve));
  const close = (v: string | null) => {
    open?.(v);
    setOpen(null);
  };
  const view = open
    ? html`<${UrlDialog} onClose=${close} />`
    : null;
  return { ask, view };
}

function UrlDialog({ onClose }: { onClose: (v: string | null) => void }) {
  const [value, setValue] = useState('http://localhost:5173/');
  const submit = (e: Event) => {
    e.preventDefault();
    try {
      onClose(new URL(value).href);
    } catch {
      store.toast('That is not a full URL. Start it with http:// or https://');
    }
  };
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose(null)}>
    <form class="dialog" onSubmit=${submit}>
      <h3>Link a running prototype</h3>
      <p class="soft" style="margin:0">A dev server or a preview deploy. Canon frames the page and keeps no copy. Some sites refuse to be framed and stay blank.</p>
      <input class="field" autofocus value=${value} onInput=${(e: Event) => setValue((e.target as HTMLInputElement).value)} />
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn ghost" onClick=${() => onClose(null)}>Cancel</button>
        <button class="btn primary">Add to board</button>
      </div>
    </form>
  </div>`;
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
function Sidebar({ route, query, setQuery }: { route: Route; query: string; setQuery: (q: string) => void }) {
  const s = useStore();
  const boards = [...s.boards].sort((a, b) => b.updatedAt - a.updatedAt).filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));
  return html`<aside class="rail">
    <div class="workspace">
      <div class="mark"></div>
      <div><b>Canon</b><small>Local · this browser</small></div>
    </div>
    <label class="search">
      <${Icon} name="search" />
      <input placeholder="Search boards" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} />
      <kbd>/</kbd>
    </label>
    <a class="nav-item" href="#/" aria-current=${route.name === 'home' ? 'page' : undefined}><${Icon} name="boards" />Boards<span class="count">${s.boards.length}</span></a>
    <a class="nav-item" href="#/record" aria-current=${route.name === 'record' ? 'page' : undefined}><${Icon} name="record" />Record<span class="count">${s.notes.length}</span></a>
    <div class="rail-section label">Recent</div>
    <div class="rail-boards">
      ${boards.map(
        (b) => html`<a class="nav-item" href=${`#/b/${b.id}`} aria-current=${route.name === 'board' && route.id === b.id ? 'page' : undefined}>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.name}</span>
          <span class="count">${store.framesOf(b.id).length}</span>
        </a>`
      )}
    </div>
    <div class="rail-foot"><span class="dot"></span>Stored in this browser. Nothing is uploaded.</div>
  </aside>`;
}

/* ── Home ──────────────────────────────────────────────────────────────── */
function Ways({ onWay, compact }: { onWay: (w: Way) => void; compact?: boolean }) {
  const linkable = canLinkFolders();
  return html`<section class="connect">
    <div class="connect-head">
      <h2>${compact ? 'Add prototypes' : 'Add your first prototypes'}</h2>
      <span class="faint">Or drop HTML files, zips or folders anywhere on this page.</span>
    </div>
    <div class="ways">
      <button class="way" onClick=${() => onWay('files')}>
        <span class="way-icon"><${Icon} name="file" /></span><b>HTML or a zip</b>
        <span>One file, or a zipped build with its CSS, scripts and images.</span>
      </button>
      <button class="way" onClick=${() => onWay('folder')}>
        <span class="way-icon"><${Icon} name="folder" /></span><b>A folder</b>
        <span>A build folder like dist/. Copied into this browser once.</span>
      </button>
      <button class="way" onClick=${() => onWay('link')} disabled=${!linkable}>
        <span class="way-icon"><${Icon} name="link" /></span><b>Link a folder on your machine</b>
        <span>Stays connected to your repo. Refresh to pick up a new build.</span>
        <span class="chip">${linkable ? html`<span class="dot"></span>Ready` : 'Chrome, Edge or Arc'}</span>
      </button>
      <button class="way" onClick=${() => onWay('sample')}>
        <span class="way-icon"><${Icon} name="spark" /></span><b>Try a sample board</b>
        <span>Four invented prototypes and one filed note, to get the feel.</span>
      </button>
    </div>
  </section>`;
}

function BoardThumb({ boardId }: { boardId: string }) {
  const frames = store.framesOf(boardId);
  if (!frames.length) return html`<div class="thumb"></div>`;
  const minX = Math.min(...frames.map((f) => f.x));
  const minY = Math.min(...frames.map((f) => f.y));
  const maxX = Math.max(...frames.map((f) => f.x + f.w));
  const maxY = Math.max(...frames.map((f) => f.y + f.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  return html`<div class="thumb"><svg viewBox=${`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} preserveAspectRatio="xMidYMid meet">
    ${frames.map((f) => html`<rect x=${f.x} y=${f.y} width=${f.w} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} fill="#ecebe6" />`)}
  </svg></div>`;
}

function Home({ query, onWay }: { query: string; onWay: (w: Way) => void }) {
  const s = useStore();
  const boards = [...s.boards].sort((a, b) => b.updatedAt - a.updatedAt).filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));
  const newBoard = async () => go(`/b/${(await store.createBoard()).id}`);
  return html`<div class="main">
    <div class="topbar"><h1>Boards</h1><span class="spacer"></span>
      <button class="btn primary" onClick=${newBoard}><${Icon} name="plus" />New board</button>
    </div>
    <div class="page">
      <${Ways} onWay=${onWay} compact=${s.boards.length > 0} />
      ${s.boards.length > 0 &&
      html`<div class="label" style="margin:0 0 12px">All boards</div>
        <div class="grid">
          ${boards.map(
            (b) => html`<a class="card" href=${`#/b/${b.id}`}>
              <${BoardThumb} boardId=${b.id} />
              <div class="meta"><b>${b.name}</b><small>${store.framesOf(b.id).length} prototypes · edited ${ago(b.updatedAt)}</small></div>
            </a>`
          )}
          <button class="card new" onClick=${newBoard}><span><${Icon} name="plus" /> New board</span></button>
        </div>`}
    </div>
  </div>`;
}

/* ── Board ─────────────────────────────────────────────────────────────── */
type Composer = { frameId: string; fx: number; fy: number; sx: number; sy: number };

function BoardView({ id, askUrl }: { id: string; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const board = s.boards.find((b) => b.id === id);
  const frames = store.framesOf(id);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 80, y: 120, zoom: 0.5 });
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'note'>('select');
  const [menu, setMenu] = useState(false);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [panning, setPanning] = useState(false);
  const fitted = useRef<string | null>(null);

  const tidy = board?.arrangement === 'tidy';
  const tidyPos = useMemo(
    () => (tidy ? tidyPositions(frames, { maxRow: Math.max(3200, ...frames.map((f) => f.w)), gap: 120 }) : {}),
    [tidy, frames.map((f) => `${f.id}:${f.w}x${f.h}`).join()]
  );
  const posOf = (f: Frame) => (tidy ? tidyPos[f.id] ?? f : f);

  const fit = () => {
    const el = canvasRef.current;
    if (!el) return;
    setCam(fitCamera(frames.map((f) => ({ ...posOf(f), w: f.w, h: f.h })), { w: el.clientWidth, h: el.clientHeight }));
  };
  useLayoutEffect(() => {
    if (fitted.current !== id && frames.length && canvasRef.current) {
      fitted.current = id;
      fit();
    }
  });
  useEffect(() => {
    setSelected(null);
    setLive(null);
    setComposer(null);
  }, [id]);
  useEffect(() => {
    if (tidy) fit();
  }, [tidy]);

  // Wheel: pinch or ctrl/cmd zooms at the pointer, two-finger scroll pans.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (live && (e.target as HTMLElement).tagName === 'IFRAME') return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCam((c) => (e.ctrlKey || e.metaKey ? zoomAt(c, pt, c.zoom * Math.exp(-e.deltaY * 0.01)) : { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [live]);

  // Keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') {
        if (composer) setComposer(null);
        else if (live) setLive(null);
        else if (tool === 'note') setTool('select');
        else setSelected(null);
        return;
      }
      if (typing || focus) return;
      if (e.key === 'n' || e.key === 'c') setTool('note');
      else if (e.key === 'v') setTool('select');
      else if (e.key === '!' || (e.shiftKey && e.key === '1')) fit();
      else if (e.key === '=' || e.key === '+') zoomBy(1.25);
      else if (e.key === '-') zoomBy(0.8);
      else if ((e.key === 'Backspace' || e.key === 'Delete') && selected) removeSelected();
      else if (e.key === 'Enter' && selected) setFocus(selected);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const zoomBy = (k: number) => {
    const el = canvasRef.current!;
    setCam((c) => zoomAt(c, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, c.zoom * k));
  };
  const removeSelected = async () => {
    const f = frames.find((x) => x.id === selected);
    if (!f || !confirm(`Remove "${f.name}" and its notes from this board?`)) return;
    setSelected(null);
    await store.deleteFrame(f.id);
  };

  // Pointer: drag a frame, pan the canvas, or place a note.
  const drag = useRef<null | { kind: 'pan' | 'frame'; sx: number; sy: number; ox: number; oy: number; id?: string; moved: boolean }>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setMenu(false);
    const target = e.target as HTMLElement;
    const frameEl = target.closest('[data-frame]') as HTMLElement | null;
    const rect = canvasRef.current!.getBoundingClientRect();
    if (frameEl && e.button === 0) {
      const f = frames.find((x) => x.id === frameEl.dataset.frame)!;
      if (live === f.id) return;
      if (tool === 'note') {
        const w = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, cam);
        const p = posOf(f);
        setComposer({ frameId: f.id, fx: (w.x - p.x) / f.w, fy: (w.y - p.y) / f.h, sx: e.clientX - rect.left, sy: e.clientY - rect.top });
        setSelected(f.id);
        return;
      }
      setSelected(f.id);
      setLive(null);
      if (tidy) return;
      drag.current = { kind: 'frame', id: f.id, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, moved: false };
    } else {
      setSelected(null);
      setLive(null);
      setComposer(null);
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: cam.x, oy: cam.y, moved: false };
      setPanning(true);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    if (d.kind === 'pan') setCam((c) => ({ ...c, x: d.ox + dx, y: d.oy + dy }));
    else store.updateFrame(d.id!, { x: Math.round(d.ox + dx / cam.zoom), y: Math.round(d.oy + dy / cam.zoom) }, false);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind === 'frame' && d.moved) {
      const f = store.getState().frames.find((x) => x.id === d.id);
      if (f) store.updateFrame(f.id, { x: f.x, y: f.y });
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const at = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, cam);
    const { groups, skipped } = await groupsFromDrop(e.dataTransfer);
    if (skipped) store.toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that were not HTML, zip or a folder.`);
    await addGroups(id, groups, at);
  };

  const way = async (w: Way) => {
    setMenu(false);
    await runWay(w, id, askUrl);
  };

  if (!s.ready) return html`<div class="main"></div>`;
  if (!board) return html`<div class="main"><div class="empty">That board is not in this browser. <a href="#/">Back to boards</a></div></div>`;

  const sel = frames.find((f) => f.id === selected) ?? null;
  const boardNotes = s.notes.filter((n) => n.boardId === id);
  const focused = frames.find((f) => f.id === focus) ?? null;
  const inv = 1 / cam.zoom;

  return html`<div class="main">
    <div class="topbar">
      <div class="crumb">
        <a href="#/">Boards</a><span class="faint">/</span>
        <input value=${board.name} onChange=${(e: Event) => store.renameBoard(id, (e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Board name" />
      </div>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Arrangement">
        <button aria-pressed=${!tidy} onClick=${() => store.setArrangement(id, 'free')}>Free</button>
        <button aria-pressed=${tidy} onClick=${() => store.setArrangement(id, 'tidy')}>Tidy</button>
      </div>
      <button class="btn ghost" disabled=${!boardNotes.length} onClick=${() => store.exportStrata(boardNotes)} title="Download this board's notes as .strata entries">
        <${Icon} name="download" />Notes · ${boardNotes.length}
      </button>
    </div>
    <div class="board">
      <div
        ref=${canvasRef}
        class=${`canvas tool-${tool}${panning ? ' panning' : ''}`}
        style=${{ backgroundSize: `${24 * cam.zoom}px ${24 * cam.zoom}px`, backgroundPosition: `${cam.x}px ${cam.y}px` }}
        onPointerDown=${onPointerDown}
        onPointerMove=${onPointerMove}
        onPointerUp=${onPointerUp}
        onDblClick=${(e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest('[data-frame]') as HTMLElement | null;
          if (el && tool === 'select') setLive(el.dataset.frame!);
        }}
        onDragOver=${(e: DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave=${(e: DragEvent) => e.target === e.currentTarget && setDragOver(false)}
        onDrop=${onDrop}
      >
        <div class="world" style=${{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`, '--inv': inv }}>
          ${frames.map((f) => {
            const p = posOf(f);
            const notes = store.notesOf(f.id);
            return html`<div key=${f.id} data-frame=${f.id} class=${`frame${selected === f.id ? ' selected' : ''}${live === f.id ? ' live' : ''}`} style=${{ left: p.x, top: p.y, width: f.w, height: f.h }}>
              <div class="frame-label"><span>${f.name}</span><span class="kind">${live === f.id ? 'Live · Esc to leave' : `${f.w}×${f.h}`}</span></div>
              <div class="frame-body">
                <iframe src=${frameSrc(f)} title=${f.name} loading="lazy" sandbox=${f.kind === 'url' ? 'allow-scripts allow-same-origin allow-forms allow-popups' : 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'}></iframe>
                <div class="frame-shield"></div>
              </div>
              ${notes.map((n, i) => html`<button class="pin" style=${{ left: n.fx * f.w, top: n.fy * f.h }} title=${n.said} onPointerDown=${(e: Event) => { e.stopPropagation(); setSelected(f.id); }}>${i + 1}</button>`)}
              ${composer?.frameId === f.id && html`<span class="pin draft" style=${{ left: composer.fx * f.w, top: composer.fy * f.h }}>+</span>`}
            </div>`;
          })}
        </div>

        ${frames.length === 0 &&
        html`<div class="empty-board"><div>
          <h2>Drop prototypes here</h2>
          <p>HTML files, zipped builds or whole folders. They stay in this browser.</p>
          <div class="row" style="justify-content:center;margin-top:14px">
            <button class="btn" onClick=${() => way('files')}><${Icon} name="file" />Choose files</button>
            <button class="btn" onClick=${() => way('folder')}><${Icon} name="folder" />Choose a folder</button>
            ${canLinkFolders() && html`<button class="btn" onClick=${() => way('link')}><${Icon} name="link" />Link a folder</button>`}
          </div>
        </div></div>`}

        ${dragOver && html`<div class="dropzone">Drop to add to ${board.name}</div>`}
        ${composer && html`<${NoteComposer} at=${composer} onCancel=${() => setComposer(null)} onSave=${async (n: Pick<Note, 'said' | 'meant' | 'participant'>) => {
          await store.addNote({ boardId: id, frameId: composer.frameId, fx: composer.fx, fy: composer.fy, ...n });
          setComposer(null);
          setTool('select');
          store.toast('Filed as a draft entry. Said is kept word for word.');
        }} />`}

        <div class="toolbar" onPointerDown=${(e: Event) => e.stopPropagation()}>
          <div style="position:relative">
            <button class="btn" onClick=${() => setMenu(!menu)} title="Add prototypes"><${Icon} name="plus" />Add</button>
            ${menu && html`<div class="menu">
              <button onClick=${() => way('files')}><${Icon} name="file" />HTML or zip files…</button>
              <button onClick=${() => way('folder')}><${Icon} name="folder" />A folder…</button>
              <button onClick=${() => way('link')} disabled=${!canLinkFolders()}><${Icon} name="link" />Link a folder on your machine…${!canLinkFolders() && html`<small>Chromium</small>`}</button>
              <button onClick=${() => way('url')}><${Icon} name="globe" />A running URL…</button>
            </div>`}
          </div>
          <span class="sep"></span>
          <button class="btn icon" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          <button class="btn icon" aria-pressed=${tool === 'note'} onClick=${() => setTool('note')} title="Note (N): click a prototype to pin what someone said"><${Icon} name="pin" /></button>
          <span class="sep"></span>
          <button class="btn icon" onClick=${() => zoomBy(0.8)} title="Zoom out (-)"><${Icon} name="minus" /></button>
          <button class="btn zoom" onClick=${() => setCam((c) => zoomAt(c, { x: canvasRef.current!.clientWidth / 2, y: canvasRef.current!.clientHeight / 2 }, 1))} title="Zoom to 100%">${Math.round(cam.zoom * 100)}%</button>
          <button class="btn icon" onClick=${() => zoomBy(1.25)} title="Zoom in (+)"><${Icon} name="plus" /></button>
          <button class="btn icon" onClick=${fit} title="Fit everything (Shift+1)"><${Icon} name="fit" /></button>
        </div>
      </div>

      ${sel && html`<${Inspector} frame=${sel} onFocus=${() => setFocus(sel.id)} onRemove=${removeSelected} onNote=${() => setTool('note')} />`}
    </div>
    ${focused && html`<${Focus} frame=${focused} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function NoteComposer({ at, onCancel, onSave }: { at: Composer; onCancel: () => void; onSave: (n: Pick<Note, 'said' | 'meant' | 'participant'>) => void }) {
  const [said, setSaid] = useState('');
  const [meant, setMeant] = useState('');
  const [who, setWho] = useState('');
  const left = Math.max(12, at.sx + 16);
  const top = Math.max(12, at.sy - 20);
  const submit = (e: Event) => {
    e.preventDefault();
    if (!said.trim()) return;
    onSave({ said: said.trim(), meant: meant.trim() || undefined, participant: who.trim() || undefined });
  };
  return html`<form class="composer" style=${{ left, top }} onSubmit=${submit} onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="label">Said · word for word</div>
    <textarea class="field" rows="3" autofocus placeholder="What they said, in their words" value=${said} onInput=${(e: Event) => setSaid((e.target as HTMLTextAreaElement).value)}></textarea>
    <input class="field" placeholder="Who, as a code: P-04 (never a name)" value=${who} onInput=${(e: Event) => setWho((e.target as HTMLInputElement).value)} />
    <textarea class="field" rows="2" placeholder="What you think they meant (optional, marked as yours)" value=${meant} onInput=${(e: Event) => setMeant((e.target as HTMLTextAreaElement).value)}></textarea>
    <div class="row"><button type="button" class="btn ghost" onClick=${onCancel}>Cancel</button><button class="btn primary" disabled=${!said.trim()}>File note</button></div>
  </form>`;
}

function Inspector({ frame, onFocus, onRemove, onNote }: { frame: Frame; onFocus: () => void; onRemove: () => void; onNote: () => void }) {
  const notes = store.notesOf(frame.id);
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec">
      <div class="label">Prototype</div>
      <input class="insp-name" value=${frame.name} key=${frame.id} onChange=${(e: Event) => store.updateFrame(frame.id, { name: (e.target as HTMLInputElement).value || frame.name })} />
      <dl class="kv">
        <dt>Source</dt><dd>${KIND[frame.kind]}</dd>
        ${frame.kind === 'url' ? html`<dt>URL</dt><dd title=${frame.url}>${frame.url}</dd>` : html`<dt>Opens</dt><dd class="mono" title=${frame.entry}>${frame.entry}</dd><dt>Files</dt><dd>${frame.fileCount}</dd>`}
        <dt>Added</dt><dd>${ago(frame.createdAt)}</dd>
      </dl>
      <div class="row">
        <button class="btn primary" onClick=${onFocus}><${Icon} name="open" />Open</button>
        ${frame.kind === 'linked' && html`<button class="btn" onClick=${() => store.refreshLinked(frame.id)}><${Icon} name="refresh" />Refresh</button>`}
        <a class="btn ghost" href=${frameSrc(frame)} target="_blank" rel="noopener">New tab</a>
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Size</div>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${frame.w === sz.w && frame.h === sz.h} onClick=${() => store.updateFrame(frame.id, { w: sz.w, h: sz.h })}>${sz.name}</button>`)}
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Notes · ${notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd> or the pin, then click the prototype where it happened.</p>`}
      ${notes.map((n, i) => html`<${NoteItem} note=${n} n=${i + 1} />`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onNote}><${Icon} name="pin" />Add a note</button>`}
    </div>
    <div class="insp-sec" style="border:0">
      <button class="btn ghost danger" onClick=${onRemove}><${Icon} name="trash" />Remove from board</button>
    </div>
  </aside>`;
}

function NoteItem({ note, n, about }: { note: Note; n?: number; about?: string }) {
  return html`<div class="note-item">
    <q>${note.said}</q>
    ${note.meant && html`<div class="meant">Meant, your reading: ${note.meant}</div>`}
    <div class="foot">
      ${n !== undefined && html`<span>#${n}</span>`}
      <span>${note.participant && /^P-\d+$/.test(note.participant) ? note.participant : 'No participant'}</span>
      ${about && html`<span>${about}</span>`}
      <span>${ago(note.createdAt)}</span>
      <button title="Delete note" onClick=${() => confirm('Delete this note?') && store.deleteNote(note.id)}><${Icon} name="x" size=${14} /></button>
    </div>
  </div>`;
}

function Focus({ frame, onClose }: { frame: Frame; onClose: () => void }) {
  const [width, setWidth] = useState<number | null>(frame.w);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return html`<div class="focus">
    <div class="topbar">
      <button class="btn ghost icon" onClick=${onClose} title="Back to the board (Esc)"><${Icon} name="back" /></button>
      <h1>${frame.name}</h1>
      <span class="spacer"></span>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${width === sz.w} onClick=${() => setWidth(sz.w)}>${sz.name} ${sz.w}</button>`)}
        <button aria-pressed=${width === null} onClick=${() => setWidth(null)}>Fill</button>
      </div>
    </div>
    <div class="focus-stage">
      <iframe src=${frameSrc(frame)} title=${frame.name} style=${{ width: width ? `${width}px` : '100%' }} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>
    </div>
  </div>`;
}

/* ── Record ────────────────────────────────────────────────────────────── */
function Record() {
  const s = useStore();
  const byFrame = new Map<string, Note[]>();
  for (const n of [...s.notes].sort((a, b) => b.createdAt - a.createdAt)) byFrame.set(n.frameId, [...(byFrame.get(n.frameId) ?? []), n]);
  const voices = new Set(s.notes.map((n) => n.participant).filter((p) => p && /^P-\d+$/.test(p)));
  return html`<div class="main">
    <div class="topbar"><h1>Record</h1><span class="faint">${s.notes.length} notes · ${voices.size} voices</span><span class="spacer"></span>
      <button class="btn" disabled=${!s.notes.length} onClick=${() => store.exportStrata(s.notes)}><${Icon} name="download" />Export .strata</button>
    </div>
    <div class="page"><div class="record">
      ${s.notes.length === 0 && html`<div class="empty">Nothing filed yet. Open a board, press N, and click a prototype where something was said.</div>`}
      ${[...byFrame.entries()].map(([frameId, notes]) => {
        const f = s.frames.find((x) => x.id === frameId);
        const b = s.boards.find((x) => x.id === f?.boardId);
        return html`<h2>${f?.name ?? 'Removed prototype'} <a class="faint" href=${b ? `#/b/${b.id}` : '#/'} style="font-weight:400;text-decoration:none">${b?.name ?? ''}</a></h2>
          ${notes.map((n) => html`<${NoteItem} note=${n} />`)}`;
      })}
    </div></div>
  </div>`;
}

/* ── App ───────────────────────────────────────────────────────────────── */
export function App() {
  const s = useStore();
  const route = useRoute();
  const [query, setQuery] = useState('');
  const [homeDrop, setHomeDrop] = useState(false);
  const url = useUrlDialog();

  const onWay = async (w: Way) => {
    const id = await runWay(w, null, url.ask);
    if (id) go(`/b/${id}`);
  };
  const homeDropProps =
    route.name !== 'board'
      ? {
          onDragOver: (e: DragEvent) => {
            e.preventDefault();
            setHomeDrop(true);
          },
          onDragLeave: (e: DragEvent) => !e.relatedTarget && setHomeDrop(false),
          onDrop: async (e: DragEvent) => {
            e.preventDefault();
            setHomeDrop(false);
            if (!e.dataTransfer) return;
            const { groups } = await groupsFromDrop(e.dataTransfer);
            if (!groups.length) return store.toast('Nothing to add. Drop HTML files, zips or folders.');
            const board = await store.createBoard(groups.length === 1 ? groups[0].name : 'Dropped prototypes');
            await addGroups(board.id, groups);
            go(`/b/${board.id}`);
          },
        }
      : {};

  return html`<div class="shell" ...${homeDropProps}>
    <${Sidebar} route=${route} query=${query} setQuery=${setQuery} />
    ${!s.ready
      ? html`<div class="main"></div>`
      : route.name === 'board'
        ? html`<${BoardView} id=${route.id} askUrl=${url.ask} />`
        : route.name === 'record'
          ? html`<${Record} />`
          : html`<${Home} query=${query} onWay=${onWay} />`}
    ${homeDrop && html`<div class="dropzone" style="position:fixed">Drop to start a new board</div>`}
    ${url.view}
    ${s.toast && html`<div class="toast" role="status">${s.toast}</div>`}
  </div>`;
}

export const _clampZoom = clampZoom;
