import { useEffect, useState } from 'preact/hooks';
import * as store from './store';
import type { Note, Role } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { BoardView, BundleView, Focus } from './canvas';
import { filterPrototypes, sortPrototypes, type LibraryFilter, type LibrarySort } from './lib/library';
import { Avatar, isComment } from './comments';
import { html, Icon, useStore, go, ago, pageCount, frameSrc, SANDBOX, KIND, addGroups, runWay, type Way } from './shared';

export { BASE } from './shared';

type Route =
  | { name: 'home' }
  | { name: 'project'; id: string; tab: 'prototypes' | 'boards' | 'comments' }
  | { name: 'board'; id: string }
  | { name: 'frame'; id: string; from?: string; page?: string }
  | { name: 'share'; id: string; role: Role };

function parseRoute(): Route {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query ?? '');
  let m = path.match(/^p\/([^/]+)(?:\/(boards|comments))?$/);
  if (m) return { name: 'project', id: m[1], tab: (m[2] as 'boards' | 'comments') ?? 'prototypes' };
  m = path.match(/^f\/([^/]+)$/);
  if (m) return { name: 'frame', id: m[1], from: q.get('from') ?? undefined, page: q.get('page') ?? undefined };
  m = path.match(/^share\/([^/]+)$/);
  if (m) return { name: 'share', id: m[1], role: (['view', 'comment', 'edit'].includes(q.get('role') ?? '') ? q.get('role') : 'view') as Role };
  m = path.match(/^b\/([^/]+)$/);
  if (m) return { name: 'board', id: m[1] };
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

const projectOf = (route: Route): string | null => {
  const s = store.getState();
  if (route.name === 'project') return route.id;
  if (route.name === 'board' || route.name === 'share') return s.boards.find((b) => b.id === route.id)?.projectId ?? null;
  if (route.name === 'frame') return s.frames.find((f) => f.id === route.id)?.projectId ?? null;
  return null;
};

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
        <button class="btn primary">Add</button>
      </div>
    </form>
  </div>`;
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
function Sidebar({ route }: { route: Route }) {
  const s = useStore();
  const active = projectOf(route);
  const projects = [...s.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const me = store.myName();
  return html`<aside class="rail">
    <a class="workspace" href="#/" style="text-decoration:none">
      <div class="mark"></div>
      <div><b>Canon</b><small>Local · this browser</small></div>
    </a>
    <a class="nav-item" href="#/" aria-current=${route.name === 'home' ? 'page' : undefined}><${Icon} name="project" />All projects<span class="count">${s.projects.length}</span></a>
    <div class="rail-section label">Projects</div>
    <div class="rail-boards">
      ${projects.map((p) => {
        const open = p.id === active;
        return html`<div>
          <a class="nav-item" href=${`#/p/${p.id}`} aria-current=${route.name === 'project' && route.id === p.id && route.tab === 'prototypes' ? 'page' : undefined}>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${open ? 'color:var(--text)' : ''}">${p.name}</span>
            <span class="count">${store.prototypesOf(p.id).length}</span>
          </a>
          ${open && html`<div class="rail-sub">
            <a class="nav-item" href=${`#/p/${p.id}`} aria-current=${route.name === 'project' && route.tab === 'prototypes' ? 'page' : undefined}><${Icon} name="grid" />Prototypes</a>
            ${store.boardsOf(p.id).map((b) => html`<a class="nav-item" href=${`#/b/${b.id}`} aria-current=${(route.name === 'board' || route.name === 'share') && route.id === b.id ? 'page' : undefined}><${Icon} name="boards" /><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.name}</span><span class="count">${store.placementsOf(b.id).length}</span></a>`)}
            <a class="nav-item" href=${`#/p/${p.id}/comments`} aria-current=${route.name === 'project' && route.tab === 'comments' ? 'page' : undefined}><${Icon} name="comment" />Comments<span class="count">${store.notesInProject(p.id).filter((n) => !n.resolved).length}</span></a>
          </div>`}
        </div>`;
      })}
    </div>
    <div class="rail-foot">
      ${me ? html`<div class="row" style="align-items:center;margin-bottom:8px;flex-wrap:nowrap"><${Avatar} name=${me} /><span style="color:var(--soft)">${me}</span></div>` : null}
      <span class="dot"></span>Stored in this browser. Nothing is uploaded.
    </div>
  </aside>`;
}

/* ── Home: projects ────────────────────────────────────────────────────── */
function Thumb({ rects }: { rects: { x: number; y: number; w: number; h: number; multi?: boolean }[] }) {
  if (!rects.length) return html`<div class="thumb"></div>`;
  const minX = Math.min(...rects.map((f) => f.x));
  const minY = Math.min(...rects.map((f) => f.y));
  const maxX = Math.max(...rects.map((f) => f.x + f.w));
  const maxY = Math.max(...rects.map((f) => f.y + f.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  return html`<div class="thumb"><svg viewBox=${`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} preserveAspectRatio="xMidYMid meet">
    ${rects.map((f) => html`<g>
      ${f.multi && html`<rect x=${f.x + f.w * 0.06} y=${f.y - f.h * 0.05} width=${f.w * 0.88} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} fill="#6b6a66" />`}
      <rect x=${f.x} y=${f.y} width=${f.w} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} fill="#ecebe6" />
    </g>`)}
  </svg></div>`;
}
const boardRects = (boardId: string) => store.framesOf(boardId).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, multi: pageCount(f) > 1 }));

function Home() {
  const s = useStore();
  const projects = [...s.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const newProject = async () => go(`/p/${(await store.createProject()).id}`);
  const sample = async () => {
    const { project } = await store.createSampleProject();
    go(`/p/${project.id}`);
  };
  return html`<div class="main">
    <div class="topbar"><h1>Projects</h1><span class="spacer"></span>
      <button class="btn primary" onClick=${newProject}><${Icon} name="plus" />New project</button>
    </div>
    <div class="page">
      ${!projects.length && html`<section class="connect">
        <div class="connect-head"><h2>Start a project</h2><span class="faint">A project holds every prototype for one product, and the boards you arrange them on.</span></div>
        <div class="ways" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <button class="way" onClick=${newProject}><span class="way-icon"><${Icon} name="plus" /></span><b>New project</b><span>Then drop in HTML, zips or folders, or link a folder on your machine.</span></button>
          <button class="way" onClick=${sample}><span class="way-icon"><${Icon} name="spark" /></span><b>Try the sample project</b><span>Fernwell: six prototypes including a six-page site, two boards, a comment thread and a research note.</span></button>
        </div>
      </section>`}
      ${projects.length > 0 && html`<div class="grid">
        ${projects.map((p) => {
          const boards = store.boardsOf(p.id);
          return html`<a class="card" href=${`#/p/${p.id}`}>
            <${Thumb} rects=${boards[0] ? boardRects(boards[0].id) : []} />
            <div class="meta"><b>${p.name}</b><small>${store.prototypesOf(p.id).length} prototypes · ${boards.length} boards · edited ${ago(p.updatedAt)}</small></div>
          </a>`;
        })}
        <button class="card new" onClick=${newProject}><span><${Icon} name="plus" /> New project</span></button>
        <button class="card new" onClick=${sample}><span><${Icon} name="spark" /> Sample project</span></button>
      </div>`}
    </div>
  </div>`;
}

/* ── Project ───────────────────────────────────────────────────────────── */
function ProjectView({ id, tab, askUrl }: { id: string; tab: 'prototypes' | 'boards' | 'comments'; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const project = s.projects.find((p) => p.id === id);
  const [drop, setDrop] = useState(false);
  if (!s.ready) return html`<div class="main"></div>`;
  if (!project) return html`<div class="main"><div class="empty">That project is not in this browser. <a href="#/">All projects</a></div></div>`;
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDrop(false);
    if (!e.dataTransfer) return;
    const { groups } = await groupsFromDrop(e.dataTransfer);
    await addGroups(id, groups);
  };
  const newBoard = async () => go(`/b/${(await store.createBoard(id)).id}`);
  return html`<div class="main" onDragOver=${(e: DragEvent) => { e.preventDefault(); setDrop(true); }} onDragLeave=${(e: DragEvent) => !e.relatedTarget && setDrop(false)} onDrop=${onDrop}>
    <div class="topbar">
      <div class="crumb"><a href="#/">Projects</a><span class="faint">/</span>
        <input value=${project.name} onChange=${(e: Event) => store.renameProject(id, (e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Project name" />
      </div>
      <div class="tabs">
        <a href=${`#/p/${id}`} aria-current=${tab === 'prototypes' ? 'page' : undefined}>Prototypes <span>${store.prototypesOf(id).length}</span></a>
        <a href=${`#/p/${id}/boards`} aria-current=${tab === 'boards' ? 'page' : undefined}>Boards <span>${store.boardsOf(id).length}</span></a>
        <a href=${`#/p/${id}/comments`} aria-current=${tab === 'comments' ? 'page' : undefined}>Comments <span>${store.notesInProject(id).filter((n) => !n.resolved).length}</span></a>
      </div>
      <span class="spacer"></span>
      ${tab === 'boards' && html`<button class="btn primary" onClick=${newBoard}><${Icon} name="plus" />New board</button>`}
    </div>
    ${tab === 'prototypes' && html`<${Library} projectId=${id} askUrl=${askUrl} />`}
    ${tab === 'boards' && html`<div class="page"><div class="grid">
      ${store.boardsOf(id).map((b) => html`<a class="card" href=${`#/b/${b.id}`}>
        <${Thumb} rects=${boardRects(b.id)} />
        <div class="meta"><b>${b.name}</b><small>${store.placementsOf(b.id).length} prototypes · edited ${ago(b.updatedAt)}${b.share && b.share.link !== 'off' ? ' · shared' : ''}</small></div>
      </a>`)}
      <button class="card new" onClick=${newBoard}><span><${Icon} name="plus" /> New board</span></button>
    </div></div>`}
    ${tab === 'comments' && html`<${ProjectComments} projectId=${id} />`}
    ${drop && html`<div class="dropzone" style="position:absolute">Drop to add to ${project.name}</div>`}
  </div>`;
}

/* The library: every prototype in the project, searchable, sortable, in a grid or a table. */
function Library({ projectId, askUrl }: { projectId: string; askUrl: () => Promise<string | null> }) {
  useStore();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [filter, setFilter] = useState<LibraryFilter>({ source: 'all' });
  const [sort, setSort] = useState<LibrarySort>('added');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const all = store.libraryItems(projectId);
  const items = sortPrototypes(filterPrototypes(all, filter), sort);
  const boards = store.boardsOf(projectId);
  const toggle = (fid: string) => {
    const next = new Set(picked);
    next.has(fid) ? next.delete(fid) : next.add(fid);
    setPicked(next);
  };
  const open = (fid: string) => {
    const f = all.find((i) => i.id === fid)!.frame;
    if (pageCount(f) > 1) go(`/f/${fid}`);
    else setFocus(fid);
  };
  const addTo = async (boardId: string | 'new') => {
    const bid = boardId === 'new' ? (await store.createBoard(projectId, 'New board')).id : boardId;
    for (const fid of picked) await store.placeOnBoard(bid, fid);
    store.toast(`Added ${picked.size} to ${store.getState().boards.find((b) => b.id === bid)?.name}.`);
    setPicked(new Set());
    if (boardId === 'new') go(`/b/${bid}`);
  };
  const remove = async () => {
    if (!confirm(`Delete ${picked.size} prototype${picked.size > 1 ? 's' : ''} from the project, every board, and their comments?`)) return;
    for (const fid of picked) await store.deleteFrame(fid);
    setPicked(new Set());
  };
  const way = async (w: Way) => {
    setMenu(false);
    await runWay(w, projectId, undefined, askUrl);
  };
  const chip = (key: keyof LibraryFilter, label: string) =>
    html`<button class="chip-toggle" aria-pressed=${!!filter[key]} onClick=${() => setFilter({ ...filter, [key]: !filter[key] })}>${label}</button>`;
  const focused = all.find((i) => i.id === focus)?.frame;

  return html`<div class="page library">
    <div class="lib-bar">
      <label class="search small"><${Icon} name="search" /><input placeholder="Search prototypes" value=${filter.query ?? ''} onInput=${(e: Event) => setFilter({ ...filter, query: (e.target as HTMLInputElement).value })} /></label>
      <select class="select" value=${filter.source} onChange=${(e: Event) => setFilter({ ...filter, source: (e.target as HTMLSelectElement).value as LibraryFilter['source'] })} aria-label="Source">
        <option value="all">All sources</option><option value="files">Files</option><option value="linked">Linked folders</option><option value="url">URLs</option>
      </select>
      ${chip('multiPage', 'Multi-page')}${chip('hasComments', 'Open comments')}${chip('unplaced', 'Not on a board')}
      <span class="spacer"></span>
      <select class="select" value=${sort} onChange=${(e: Event) => setSort((e.target as HTMLSelectElement).value as LibrarySort)} aria-label="Sort">
        <option value="added">Newest</option><option value="name">Name</option><option value="comments">Most comments</option><option value="updated">Last changed</option>
      </select>
      <div class="seg"><button aria-pressed=${view === 'grid'} onClick=${() => setView('grid')} title="Grid"><${Icon} name="grid" /></button><button aria-pressed=${view === 'table'} onClick=${() => setView('table')} title="Table"><${Icon} name="table" /></button></div>
      <div style="position:relative">
        <button class="btn primary" onClick=${() => setMenu(!menu)}><${Icon} name="plus" />Add</button>
        ${menu && html`<div class="menu" style="top:40px;bottom:auto;right:0;left:auto">
          <button onClick=${() => way('files')}><${Icon} name="file" />HTML or zip files…</button>
          <button onClick=${() => way('folder')}><${Icon} name="folder" />A folder…</button>
          <button onClick=${() => way('link')} disabled=${!canLinkFolders()}><${Icon} name="link" />Link a folder on your machine…</button>
          <button onClick=${() => way('url')}><${Icon} name="globe" />A running URL…</button>
        </div>`}
      </div>
    </div>

    ${picked.size > 0 && html`<div class="selection-bar">
      <b>${picked.size} selected</b>
      <span class="faint">Add to</span>
      ${boards.map((b) => html`<button class="btn" onClick=${() => addTo(b.id)}>${b.name}</button>`)}
      <button class="btn" onClick=${() => addTo('new')}><${Icon} name="plus" />New board</button>
      <span class="spacer"></span>
      <button class="btn ghost danger" onClick=${remove}><${Icon} name="trash" />Delete</button>
      <button class="btn ghost" onClick=${() => setPicked(new Set())}>Clear</button>
    </div>`}

    ${all.length === 0 && html`<div class="empty-board" style="position:static;padding:80px 0"><div>
      <h2>No prototypes yet</h2><p>Drop HTML files, zips or folders anywhere here.</p>
    </div></div>`}
    ${all.length > 0 && items.length === 0 && html`<div class="empty">Nothing matches. <button class="btn ghost" onClick=${() => setFilter({ source: 'all' })}>Clear filters</button></div>`}

    ${view === 'grid'
      ? html`<div class="lib-grid">
          ${items.map((i) => {
            const f = i.frame;
            const s = Math.min(240 / f.w, 160 / f.h);
            return html`<div class=${`lib-card${picked.has(i.id) ? ' picked' : ''}`}>
              <button class="lib-thumb" onClick=${() => open(i.id)} title="Open">
                ${pageCount(f) > 1 && html`<span class="lib-sheet"></span>`}
                <span class="lib-frame" style=${{ width: f.w * s, height: f.h * s }}>
                  <iframe src=${frameSrc(f)} tabindex="-1" loading="lazy" sandbox=${SANDBOX} style=${{ width: f.w, height: f.h, transform: `scale(${s})` }}></iframe>
                </span>
              </button>
              <label class="lib-check"><input type="checkbox" checked=${picked.has(i.id)} onChange=${() => toggle(i.id)} /></label>
              <div class="meta">
                <b>${f.name}</b>
                <small>${i.pages > 1 ? `${i.pages} pages · ` : ''}${i.boards ? `${i.boards} board${i.boards > 1 ? 's' : ''}` : 'Not on a board'}${i.comments ? ` · ${i.comments} open` : ''}</small>
              </div>
            </div>`;
          })}
        </div>`
      : html`<table class="lib-table">
          <thead><tr><th style="width:32px"></th><th>Name</th><th>Pages</th><th>Source</th><th>Boards</th><th>Open comments</th><th>Added</th><th>Changed</th></tr></thead>
          <tbody>${items.map((i) => html`<tr class=${picked.has(i.id) ? 'picked' : ''}>
            <td><input type="checkbox" checked=${picked.has(i.id)} onChange=${() => toggle(i.id)} /></td>
            <td><button class="link-btn" onClick=${() => open(i.id)}>${i.name}</button></td>
            <td class="mono">${i.pages}</td>
            <td>${KIND[i.kind]}</td>
            <td>${store.boardsHolding(i.id).map((b) => b.name).join(', ') || html`<span class="faint">None</span>`}</td>
            <td class="mono">${i.comments || ''}</td>
            <td>${ago(i.createdAt)}</td>
            <td>${ago(i.updatedAt)}</td>
          </tr>`)}</tbody>
        </table>`}
    ${focused && html`<${Focus} frame=${focused} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function ProjectComments({ projectId }: { projectId: string }) {
  const s = useStore();
  const [show, setShow] = useState<'open' | 'resolved' | 'research'>('open');
  const notes = store.notesInProject(projectId)
    .filter((n) => (show === 'research' ? !isComment(n) : isComment(n) && (show === 'open' ? !n.resolved : n.resolved)))
    .sort((a, b) => b.createdAt - a.createdAt);
  const where = (n: Note) => {
    const f = s.frames.find((x) => x.id === n.frameId);
    if (f) return { label: f.name, href: pageCount(f) > 1 ? `#/f/${f.id}${n.page ? `?page=${encodeURIComponent(n.page)}` : ''}` : `#/b/${store.boardsHolding(f.id)[0]?.id ?? ''}` };
    const b = s.boards.find((x) => x.id === n.boardId);
    return { label: `${b?.name ?? 'Board'} canvas`, href: `#/b/${n.boardId}` };
  };
  return html`<div class="page"><div class="record">
    <div class="row" style="margin-bottom:6px">
      <div class="seg"><button aria-pressed=${show === 'open'} onClick=${() => setShow('open')}>Open</button><button aria-pressed=${show === 'resolved'} onClick=${() => setShow('resolved')}>Resolved</button><button aria-pressed=${show === 'research'} onClick=${() => setShow('research')}>Research notes</button></div>
      <span class="spacer"></span>
      ${show === 'research' && html`<button class="btn" onClick=${() => store.exportStrata(store.notesInProject(projectId))}><${Icon} name="download" />Export .strata</button>`}
    </div>
    ${notes.length === 0 && html`<div class="empty">${show === 'research' ? 'No research notes yet. In the comment box, switch to Research note.' : 'Nothing here yet. Press C on a board and click anywhere.'}</div>`}
    ${notes.map((n) => {
      const w = where(n);
      return html`<a class="comment-row" href=${w.href}>
        ${isComment(n) ? html`<${Avatar} name=${n.author || 'You'} size=${28} />` : html`<span class="avatar note" style="width:28px;height:28px">R</span>`}
        <div style="flex:1;min-width:0">
          <div class="msg-meta"><b>${isComment(n) ? n.author || 'You' : n.participant ?? 'Research note'}</b><span>${ago(n.createdAt)}</span><span>${w.label}</span>${(n.replies?.length ?? 0) > 0 && html`<span>${n.replies!.length} ${n.replies!.length === 1 ? 'reply' : 'replies'}</span>`}</div>
          <div class="${isComment(n) ? '' : 'q'}">${n.said}</div>
        </div>
      </a>`;
    })}
  </div></div>`;
}

/* ── App ───────────────────────────────────────────────────────────────── */
export function App() {
  const s = useStore();
  const route = useRoute();
  const url = useUrlDialog();

  // A viewer arriving from a share link sees the board alone, without the rail.
  if (route.name === 'share') {
    return html`<div class="shell solo">
      ${s.ready ? html`<${BoardView} id=${route.id} askUrl=${url.ask} viewer=${route.role} />` : html`<div class="main"></div>`}
      ${s.toast && html`<div class="toast" role="status">${s.toast}</div>`}
    </div>`;
  }

  return html`<div class="shell">
    <${Sidebar} route=${route} />
    ${!s.ready
      ? html`<div class="main"></div>`
      : route.name === 'frame'
        ? html`<${BundleView} key=${route.id} frameId=${route.id} fromBoard=${route.from} startPage=${route.page} />`
        : route.name === 'board'
          ? html`<${BoardView} id=${route.id} askUrl=${url.ask} />`
          : route.name === 'project'
            ? html`<${ProjectView} id=${route.id} tab=${route.tab} askUrl=${url.ask} />`
            : html`<${Home} />`}
    ${url.view}
    ${s.toast && html`<div class="toast" role="status">${s.toast}</div>`}
  </div>`;
}

