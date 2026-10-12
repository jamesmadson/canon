import { useEffect, useState } from 'preact/hooks';
import * as store from './store';
import type { Note } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { BoardView, BundleView } from './canvas';
import { html, Icon, useStore, go, ago, pageCount, addGroups, runWay, NoteItem, type Way } from './shared';

export { BASE } from './shared';

type Route =
  | { name: 'home' }
  | { name: 'board'; id: string }
  | { name: 'bundle'; boardId: string; frameId: string; page?: string }
  | { name: 'record' };

function parseRoute(): Route {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const bundle = path.match(/^b\/([^/]+)\/p\/([^/]+)$/);
  if (bundle) return { name: 'bundle', boardId: bundle[1], frameId: bundle[2], page: new URLSearchParams(query ?? '').get('page') ?? undefined };
  if (path.startsWith('b/')) return { name: 'board', id: path.slice(2) };
  if (path === 'record') return { name: 'record' };
  return { name: 'home' };
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

/* ── URL dialog ─────────────────────────────────────────────────────────── */
function useUrlDialog() {
  const [open, setOpen] = useState<null | ((v: string | null) => void)>(null);
  const ask = () => new Promise<string | null>((resolve) => setOpen(() => resolve));
  const close = (v: string | null) => {
    open?.(v);
    setOpen(null);
  };
  return { ask, view: open ? html`<${UrlDialog} onClose=${close} />` : null };
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
  const activeBoard = route.name === 'board' ? route.id : route.name === 'bundle' ? route.boardId : null;
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
        (b) => html`<a class="nav-item" href=${`#/b/${b.id}`} aria-current=${activeBoard === b.id ? 'page' : undefined}>
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
        <span>One file, or a zipped build with its pages, CSS, scripts and images.</span>
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
        <span>Invented prototypes, a six-page site, and a filed note, to get the feel.</span>
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
    ${frames.map((f) => html`<g>
      ${pageCount(f) > 1 && html`<rect x=${f.x + f.w * 0.06} y=${f.y - f.h * 0.05} width=${f.w * 0.88} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} fill="#6b6a66" />`}
      <rect x=${f.x} y=${f.y} width=${f.w} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} fill="#ecebe6" />
    </g>`)}
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

/* ── Record ────────────────────────────────────────────────────────────── */
function Record() {
  const s = useStore();
  const groups = new Map<string, { title: string; href: string; sub: string; notes: Note[] }>();
  for (const n of [...s.notes].sort((a, b) => b.createdAt - a.createdAt)) {
    const f = s.frames.find((x) => x.id === n.frameId);
    const b = s.boards.find((x) => x.id === n.boardId);
    const key = f ? f.id : `canvas:${n.boardId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        title: f ? f.name : 'On the canvas',
        sub: b?.name ?? '',
        href: f && pageCount(f) > 1 ? `#/b/${f.boardId}/p/${f.id}` : b ? `#/b/${b.id}` : '#/',
        notes: [],
      });
    }
    groups.get(key)!.notes.push(n);
  }
  const voices = new Set(s.notes.map((n) => n.participant).filter((p) => p && /^P-\d+$/.test(p)));
  return html`<div class="main">
    <div class="topbar"><h1>Record</h1><span class="faint">${s.notes.length} notes · ${voices.size} voices</span><span class="spacer"></span>
      <button class="btn" disabled=${!s.notes.length} onClick=${() => store.exportStrata(s.notes)}><${Icon} name="download" />Export .strata</button>
    </div>
    <div class="page"><div class="record">
      ${s.notes.length === 0 && html`<div class="empty">Nothing filed yet. Open a board, press N, and click a prototype where something was said.</div>`}
      ${[...groups.values()].map(
        (g) => html`<h2>${g.title} <a class="faint" href=${g.href} style="font-weight:400;text-decoration:none">${g.sub}</a></h2>
          ${g.notes.map((n) => html`<${NoteItem} note=${n} />`)}`
      )}
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
  const onCanvas = route.name === 'board' || route.name === 'bundle';
  const homeDropProps = !onCanvas
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
      : route.name === 'bundle'
        ? html`<${BundleView} key=${route.frameId} boardId=${route.boardId} frameId=${route.frameId} startPage=${route.page} />`
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
