import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame, Note } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { BoardView, BundleView, Focus } from './canvas';
import { filterPrototypes, sortPrototypes, type LibraryFilter, type LibrarySort } from './lib/library';
import { FilterMenu } from './home';
import { AddMenu, ProtoRow, StarButton, Tags } from './parts';
import { currentOf, stackKey, stacks as stacksOf, versionOf } from './lib/versions';
import { checkPrototypeUrl, safeFrameUrl } from './lib/resolve';
import { type Address, buildAddress, parseAddress } from './lib/address';
import { type PairLink, pairNotice, parsePairLink, saveAgent } from './bridge/client';
import { Home } from './home';
import { SearchHost } from './palette';
import { Sidebar, useBridge } from './sidebar';
import { type Card, type Scope, cardOf, cardsOf, scopeCards, tagCounts } from './lib/home';
import { Avatar } from './comments';
import { html, Icon, useStore, go, ago, pageCount, frameSrc, SANDBOX, KIND, addGroups, runWay, showsCover, coverSrc, type Way } from './shared';

export { BASE } from './shared';

type Route = Address;
const parseRoute = (): Route => parseAddress(location.hash);

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

const boardOf = (route: Route): string | null => (route.name === 'board' || route.name === 'full' ? route.board : null);
const projectOf = (route: Route): string | null => {
  const s = store.getState();
  if (route.name === 'project') return route.project;
  const board = boardOf(route);
  if (board) return s.boards.find((b) => b.id === board)?.projectId ?? null;
  if (route.name === 'bundle' || route.name === 'full') return s.frames.find((f) => f.id === route.frame)?.projectId ?? null;
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
    const checked = checkPrototypeUrl(value, location.origin);
    if (checked.ok) onClose(checked.url);
    else store.toast(checked.message);
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

/* ── Agents: pairing and the sidebar list ───────────────────────────────── */
function PairDialog({ pair, onClose }: { pair: PairLink; onClose: () => void }) {
  const notice = pairNotice(useBridge().agents.find((a) => a.id === pair.agentId), pair);
  const connect = async () => {
    try {
      await saveAgent(pair);
      store.toast(`Connected ${pair.name}.`);
    } catch {
      store.toast(`Could not save ${pair.name}. Try the link again.`);
    }
    onClose();
  };
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pair-title">
      <h3 id="pair-title">Connect ${pair.name} to Canon?</h3>
      <p class="soft" style="margin:0">It will be able to add prototypes to your projects, add versions, move them between boards and open views. It can't delete anything or read your files.</p>
      ${notice && html`<p role="alert" style="margin:0;color:var(--text)">${notice}</p>`}
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn ghost" autofocus onClick=${onClose}>Cancel</button>
        <button type="button" class="btn primary" onClick=${connect}>Connect</button>
      </div>
    </div>
  </div>`;
}

/* ── A board drawn as its prototypes' outlines ─────────────────────────── */
function BoardThumb({ rects }: { rects: { x: number; y: number; w: number; h: number; multi?: boolean }[] }) {
  if (!rects.length) return html`<div class="thumb"></div>`;
  const minX = Math.min(...rects.map((f) => f.x));
  const minY = Math.min(...rects.map((f) => f.y));
  const maxX = Math.max(...rects.map((f) => f.x + f.w));
  const maxY = Math.max(...rects.map((f) => f.y + f.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  return html`<div class="thumb"><svg viewBox=${`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${rects.map((f) => html`<g>
      ${f.multi && html`<rect class="sheet" x=${f.x + f.w * 0.06} y=${f.y - f.h * 0.05} width=${f.w * 0.88} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} />`}
      <rect class="page" x=${f.x} y=${f.y} width=${f.w} height=${f.h} rx=${Math.min(f.w, f.h) * 0.03} />
    </g>`)}
  </svg></div>`;
}
const boardRects = (boardId: string) => store.framesOf(boardId).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, multi: pageCount(f) > 1 }));

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
        <a href=${`#/p/${id}/comments`} aria-current=${tab === 'comments' ? 'page' : undefined}>Notes <span>${store.notesInProject(id).filter((n) => !n.resolved).length}</span></a>
      </div>
      <span class="spacer"></span>
      ${tab === 'boards' && html`<button class="btn primary" onClick=${newBoard}><${Icon} name="plus" />New board</button>`}
    </div>
    ${tab === 'prototypes' && html`<${Library} projectId=${id} askUrl=${askUrl} />`}
    ${tab === 'boards' && html`<div class="page"><div class="grid">
      ${store.boardsOf(id).map((b) => html`<a class="card" href=${`#/b/${b.id}`}>
        <${BoardThumb} rects=${boardRects(b.id)} />
        <div class="meta"><b>${b.name}</b><small>${store.placementsOf(b.id).length} prototypes · edited ${ago(b.updatedAt)}</small></div>
      </a>`)}
      <button class="card new" onClick=${newBoard}><span><${Icon} name="plus" /> New board</span></button>
    </div></div>`}
    ${tab === 'comments' && html`<${ProjectComments} projectId=${id} />`}
    ${drop && html`<div class="dropzone" style="position:absolute">Drop to add to ${project.name}</div>`}
  </div>`;
}

/* The library: every prototype in the project, searchable, sortable by update or star, filterable by tag, in a grid or a list. */
const VIEW_KEY = 'canon-project-view';
function useProjectView(): ['grid' | 'list', (v: 'grid' | 'list') => void] {
  const [view, set] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  return [view, (v) => {
    set(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice lasts this visit */ }
  }];
}

export function Library({ projectId, askUrl }: { projectId: string; askUrl: () => Promise<string | null> }) {
  useStore();
  const [view, setView] = useProjectView();
  const [filter, setFilter] = useState<LibraryFilter>({ source: 'all', tags: [] });
  const [sort, setSort] = useState<LibrarySort>('updated');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const all = store.libraryItems(projectId);
  const matched = sortPrototypes(filterPrototypes(all, filter), sort);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // One card per stack, showing its current version; expand a stack to see the rest.
  const items: ((typeof matched)[number] & { versions: number; v: number; isCurrent: boolean; stack: string; extra?: boolean })[] = [];
  const seen = new Set<string>();
  for (const i of matched) {
    const key = stackKey(i.frame);
    if (seen.has(key)) continue;
    seen.add(key);
    const stack = store.stackOf(i.id);
    const cur = stack.length ? currentOf(stack) : i.frame;
    const members = matched.filter((m) => stackKey(m.frame) === key);
    const lead = members.find((m) => m.id === cur.id) ?? members[0];
    const info = (m: typeof lead, extra?: boolean) => ({ ...m, versions: stack.length, v: versionOf(stack, m.id), isCurrent: m.id === cur.id, stack: key, extra });
    items.push(info(lead));
    if (expanded.has(key)) for (const m of [...members].reverse()) if (m.id !== lead.id) items.push(info(m, true));
  }
  const toggleStack = (key: string) => {
    const next = new Set(expanded);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpanded(next);
  };
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
    if (!confirm(`Delete ${picked.size} prototype${picked.size > 1 ? 's' : ''} from the project, every board, and their notes?`)) return;
    for (const fid of picked) await store.deleteFrame(fid);
    setPicked(new Set());
  };
  const way = (w: Way) => runWay(w, projectId, undefined, askUrl);
  const chip = (key: keyof LibraryFilter, label: string) =>
    html`<button type="button" class="chip-toggle" aria-pressed=${!!filter[key]} onClick=${() => setFilter({ ...filter, [key]: !filter[key] })}>${label}</button>`;
  const focused = all.find((i) => i.id === focus)?.frame;
  const clear = () => setFilter({ source: 'all', tags: [] });
  const tagList = tagCounts(scopeCards(cardsOf(all.map((i) => i.frame)), { kind: filter.archived ? 'archive' : 'home' }));
  const cardFor = (i: (typeof items)[number]) => ({ ...cardOf(i.frame), versions: i.versions });
  const filtering = !!(filter.query || filter.tags?.length || filter.multiPage || filter.hasComments || filter.unplaced || filter.archived || (filter.source && filter.source !== 'all'));

  const versionsSlot = (i: (typeof items)[number]) =>
    i.extra
      ? html`<span class="ver"><span class="ver-chip old">v${i.v}</span>${!i.isCurrent && html` <button type="button" class="link" onClick=${() => store.makeCurrent(i.id)}>Make current</button>`}</span>`
      : i.versions > 1
        ? html`<span class="ver"><button type="button" class="ver-chip ver-btn" onClick=${() => toggleStack(i.stack)} aria-expanded=${expanded.has(i.stack)} aria-label=${`${i.versions} versions of ${i.name}`}>${i.versions} versions ${expanded.has(i.stack) ? '▴' : '▾'}</button></span>`
        : html`<span class="ver"></span>`;

  return html`<div class="page library">
    <div class="lib-bar">
      <label class="search small"><${Icon} name="search" /><span class="sr">Search prototypes</span><input placeholder="Search prototypes" value=${filter.query ?? ''} onInput=${(e: Event) => setFilter({ ...filter, query: (e.target as HTMLInputElement).value })} /></label>
      <${FilterMenu} tags=${tagList} chosen=${filter.tags ?? []} onChange=${(t: string[]) => setFilter({ ...filter, tags: t })} />
      <select class="select" value=${filter.source} onChange=${(e: Event) => setFilter({ ...filter, source: (e.target as HTMLSelectElement).value as LibraryFilter['source'] })} aria-label="Source">
        <option value="all">All sources</option><option value="files">Files</option><option value="linked">Linked folders</option><option value="url">URLs</option>
      </select>
      ${chip('multiPage', 'Multi-page')}${chip('hasComments', 'Open notes')}${chip('unplaced', 'Not on a board')}${chip('archived', 'Archived')}
      <span class="spacer"></span>
      <select class="select" value=${sort} onChange=${(e: Event) => setSort((e.target as HTMLSelectElement).value as LibrarySort)} aria-label="Sort">
        <option value="updated">Updated</option><option value="starred">Starred first</option><option value="added">Newest</option><option value="name">Name</option><option value="comments">Most notes</option>
      </select>
      <div class="seg" role="group" aria-label="View"><button type="button" aria-pressed=${view === 'grid'} onClick=${() => setView('grid')}>Grid</button><button type="button" aria-pressed=${view === 'list'} onClick=${() => setView('list')}>List</button></div>
      <${AddMenu} primary label="Add" onWay=${way} />
    </div>

    ${picked.size > 0 && html`<div class="selection-bar">
      <b>${picked.size} selected</b>
      <span class="faint">Add to</span>
      ${boards.map((b) => html`<button type="button" class="btn" key=${b.id} onClick=${() => addTo(b.id)}>${b.name}</button>`)}
      <button type="button" class="btn" onClick=${() => addTo('new')}><${Icon} name="plus" />New board</button>
      <span class="spacer"></span>
      <button type="button" class="btn ghost danger" onClick=${remove}><${Icon} name="trash" />Delete</button>
      <button type="button" class="btn ghost" onClick=${() => setPicked(new Set())}>Clear</button>
    </div>`}

    <div class="drop-hint" data-drop-hint><b>Drop a prototype here:</b> HTML, a zip or a folder</div>
    ${all.length === 0 && html`<div class="empty-board" style="position:static;padding:40px 0"><div>
      <h2>No prototypes yet</h2><p>Or use Add, above, to pick files or link a folder.</p>
    </div></div>`}
    ${all.length > 0 && items.length === 0 && html`<div class="empty">${filter.archived && !filtering ? 'Nothing is archived.' : 'Nothing matches.'} <button type="button" class="btn ghost" onClick=${clear}>Clear filters</button></div>`}

    ${view === 'grid'
      ? html`<div class="lib-grid">
          ${items.map((i) => {
            const f = i.frame;
            const card = cardFor(i);
            const s = Math.min(240 / f.w, 160 / f.h);
            return html`<div class=${`lib-card${picked.has(i.id) ? ' picked' : ''}${i.extra ? ' older' : ''}`} key=${i.id} data-card=${i.id}>
              <button type="button" class="lib-thumb" onClick=${() => open(i.id)} aria-label=${`Open ${f.name}`}>
                ${(pageCount(f) > 1 || (i.versions > 1 && !i.extra)) && html`<span class="lib-sheet"></span>`}
                <span class="lib-frame" style=${{ width: f.w * s, height: f.h * s }}>
                  ${showsCover(f)
                    ? html`<img class="frame-cover" src=${coverSrc(f)} alt="" />`
                    : html`<iframe src=${frameSrc(f)} tabindex="-1" loading="lazy" sandbox=${SANDBOX} aria-hidden="true" style=${{ width: f.w, height: f.h, transform: `scale(${s})` }}></iframe>`}
                </span>
              </button>
              <label class="lib-check"><input type="checkbox" checked=${picked.has(i.id)} onChange=${() => toggle(i.id)} aria-label=${`Select ${f.name}`} /></label>
              <${StarButton} card=${card} />
              <div class="meta">
                <b>${f.name}</b>
                ${f.summary && html`<span class="lib-sum">${f.summary}</span>`}
                <small>${i.pages > 1 ? `${i.pages} pages · ` : ''}${i.boards ? `${i.boards} board${i.boards > 1 ? 's' : ''}` : 'Not on a board'}${i.comments ? ` · ${i.comments} open` : ''}</small>
                ${card.tags.length > 0 && html`<${Tags} tags=${card.tags} />`}
                ${i.versions > 1 && html`<div class="lib-ver">
                  ${i.extra
                    ? html`<span class="ver-chip old">v${i.v}</span>${!i.isCurrent && html`<button type="button" class="link" onClick=${() => store.makeCurrent(i.id)}>Make current</button>`}`
                    : html`<button type="button" class="ver-chip" onClick=${() => toggleStack(i.stack)} aria-expanded=${expanded.has(i.stack)}>v${i.v} · ${i.versions} versions ${expanded.has(i.stack) ? '▴' : '▾'}</button>`}
                </div>`}
              </div>
            </div>`;
          })}
        </div>`
      : html`<ul class="rows lib-rows">
          ${items.map((i) => html`<${ProtoRow} key=${i.id} card=${cardFor(i)} older=${i.extra} onOpen=${() => open(i.id)} versions=${versionsSlot(i)} pick=${{ checked: picked.has(i.id), onChange: () => toggle(i.id) }} />`)}
        </ul>`}
    ${focused && html`<${Focus} frame=${focused} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function ProjectComments({ projectId }: { projectId: string }) {
  const s = useStore();
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const notes = store.notesInProject(projectId)
    .filter((n) => (show === 'open' ? !n.resolved : n.resolved))
    .sort((a, b) => b.createdAt - a.createdAt);
  const where = (n: Note) => {
    const f = s.frames.find((x) => x.id === n.frameId);
    if (f) return { label: f.name, href: pageCount(f) > 1 ? `#/f/${f.id}${n.page ? `?page=${encodeURIComponent(n.page)}` : ''}` : `#/b/${store.boardsHolding(f.id)[0]?.id ?? ''}` };
    const b = s.boards.find((x) => x.id === n.boardId);
    return { label: `${b?.name ?? 'Board'} canvas`, href: `#/b/${n.boardId}` };
  };
  return html`<div class="page"><div class="record">
    <div class="row" style="margin-bottom:6px">
      <div class="seg"><button aria-pressed=${show === 'open'} onClick=${() => setShow('open')}>Open</button><button aria-pressed=${show === 'resolved'} onClick=${() => setShow('resolved')}>Resolved</button></div>
      <span class="spacer"></span>
    </div>
    ${notes.length === 0 && html`<div class="empty">${show === 'open' ? 'Nothing open. Press N on a board and click anywhere.' : 'Nothing resolved yet.'}</div>`}
    ${notes.map((n) => {
      const w = where(n);
      return html`<a class="comment-row" href=${w.href}>
        <${Avatar} name=${n.author || 'You'} size=${28} />
        <div style="flex:1;min-width:0">
          <div class="msg-meta"><b>${n.author || 'You'}</b><span>${ago(n.createdAt)}</span><span>${w.label}</span>${(n.replies?.length ?? 0) > 0 && html`<span>${n.replies!.length} ${n.replies!.length === 1 ? 'reply' : 'replies'}</span>`}</div>
          <div>${n.said}</div>
        </div>
      </a>`;
    })}
  </div></div>`;
}

/* ── A full-screen link with no board: the prototype's project, with Focus over it ── */
function FullOverProject({ address, askUrl }: { address: Extract<Address, { name: 'full' }>; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const frame = s.frames.find((f) => f.id === address.frame);
  if (!frame) return html`<div class="main"><div class="empty">That prototype is not in this browser. <a href="#/">All projects</a></div></div>`;
  const project = frame.projectId;
  return html`<${ProjectView} id=${project} tab="prototypes" askUrl=${askUrl} />
    <${Focus} frame=${frame} address=${address} onClose=${() => go(buildAddress({ name: 'project', project, tab: 'prototypes' }))} />`;
}

/* ── App ───────────────────────────────────────────────────────────────── */
export function openPrototype(f: Frame, focus: (id: string) => void) {
  if (f.kind === 'url') window.open(safeFrameUrl(f.url), '_blank', 'noopener');
  else if (pageCount(f) > 1) go(`/f/${f.id}`);
  else focus(f.id);
}

const SCOPES: Record<string, Scope> = { home: { kind: 'home' }, starred: { kind: 'starred' }, archive: { kind: 'archive' } };

export function App({ pairAtLoad = null }: { pairAtLoad?: PairLink | null }) {
  const s = useStore();
  const route = useRoute();
  const url = useUrlDialog();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pair, setPair] = useState<PairLink | null>(pairAtLoad);
  // A pairing link counts only when it opened this page (main.ts reads it). Anything
  // holding a reference to this tab can rewrite its hash, so a later #pair is cleared.
  useEffect(() => {
    const later = () => {
      if (parsePairLink(location.hash) === null) return;
      history.replaceState(null, '', location.pathname + location.search);
      dispatchEvent(new HashChangeEvent('hashchange'));
      store.toast('Open the pairing link in a new tab to connect an agent.');
    };
    addEventListener('hashchange', later);
    return () => removeEventListener('hashchange', later);
  }, []);
  const focused = focusId ? s.frames.find((f) => f.id === focusId) : undefined;
  const cards = useMemo(() => cardsOf(s.frames), [s.frames]);
  const projectName = (id: string) => s.projects.find((p) => p.id === id)?.name ?? '';
  const open = (c: Card) => openPrototype(c.frame, setFocusId);
  const scope: Scope | null = route.name === 'tag' ? { kind: 'tag', tag: route.tag } : SCOPES[route.name] ?? null;

  return html`<div class="shell">
    <${Sidebar} route=${route} activeProject=${projectOf(route)} />
    ${!s.ready
      ? html`<div class="main"></div>`
      : route.name === 'bundle'
        ? html`<${BundleView} key=${route.frame} frameId=${route.frame} fromBoard=${route.from ?? undefined} startPage=${route.page ?? undefined} />`
        : route.name === 'board' || (route.name === 'full' && route.board)
          ? html`<${BoardView} id=${route.board} frameId=${route.frame} full=${route.name === 'full' ? route : null} askUrl=${url.ask} />`
          : route.name === 'full'
            ? html`<${FullOverProject} address=${route} askUrl=${url.ask} />`
            : route.name === 'project'
              ? html`<${ProjectView} id=${route.project} tab=${route.tab} askUrl=${url.ask} />`
              : html`<${Home} scope=${scope ?? SCOPES.home} askUrl=${url.ask} onOpen=${open} />`}
    ${url.view}
    <${SearchHost} cards=${cards} projectName=${projectName} onPick=${open} />
    ${focused && html`<${Focus} frame=${focused} onClose=${() => setFocusId(null)} />`}
    ${pair && html`<${PairDialog} pair=${pair} onClose=${() => setPair(null)} />`}
    ${s.toast && html`<div class="toast" role="status">${s.toast}</div>`}
  </div>`;
}
