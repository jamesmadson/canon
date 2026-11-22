import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Board, Frame, Note } from './db';
import { groupsFromDrop } from './intake';
import { BoardView } from './canvas';
import { PrototypeView, openPrototype } from './prototype';
import { filterPrototypes, sortPrototypes, type LibraryFilter, type LibrarySort } from './lib/library';
import { Home } from './home';
import { ActiveFilters, FilterPop } from './libfilter';
import { AddMenu, LinkTile, ProtoRow, StarButton, Tags, metaOf } from './parts';
import { MoveMenu, RowMenu, carries, startDrag, useDismiss, useMenuKeys } from './move';
import { pagesOf } from './lib/pageview';
import { currentOf, stackKey } from './lib/versions';
import { ENTER_ADDRESS, OWN_ORIGIN_MESSAGE, checkPrototypeUrl } from './lib/resolve';
import { nameFromUrl, rememberLinkName } from './lib/linkname';
import { takeProjectNameAsk } from './lib/naming';
import { type Address, buildAddress } from './lib/address';
import { currentAddress, openHash, replaceAddress } from './lib/nav';
import { chooseView, setStartPage } from './lib/pageview';
import { CHROME_BLOCKED, type PairLink, pairNotice, parsePairLink, saveAgent, waitForConnection } from './bridge/client';
import { SearchHost } from './palette';
import { RenameHost } from './rename';
import { Sidebar, useBridge } from './sidebar';
import { type Card, type Scope, cardOf, cardsOf, countPrototypes, scopeCards, tagCounts } from './lib/home';
import { Avatar } from './comments';
import { ReachNote, useHomeProbe } from './live';
import { record } from './lib/tester';
import { html, Icon, useStore, go, ago, pageCount, frameSrc, SANDBOX, addGroups, runWay, showsCover, coverSrc, type Way } from './shared';
import { Modal } from './feedback';

export { BASE } from './shared';

type Route = Address;
const parseRoute = (): Route => currentAddress();

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

export function UrlDialog({ onClose }: { onClose: (v: string | null) => void }) {
  const [value, setValue] = useState('');
  // The name follows the address until the person types one of their own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const addressBox = useRef<HTMLInputElement>(null);
  // Shown under the address after Add is pressed, until the address changes.
  const [problem, setProblem] = useState<string | null>(null);
  const checked = checkPrototypeUrl(value, location.origin);
  const name = typedName ?? nameFromUrl(checked.ok ? checked.url : value);
  // The address comes first, empty, so a paste lands in it. The name follows the address.
  useEffect(() => { addressBox.current?.focus(); }, []);
  useEffect(() => {
    // Captured, so the view behind the dialog never sees this Esc and stays where it is.
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(null); } };
    addEventListener('keydown', esc, true);
    return () => removeEventListener('keydown', esc, true);
  }, [onClose]);
  const submit = (e: Event) => {
    e.preventDefault();
    if (checked.ok) {
      rememberLinkName(checked.url, name);
      onClose(checked.url);
    } else setProblem(checked.message === OWN_ORIGIN_MESSAGE ? OWN_ORIGIN_MESSAGE : ENTER_ADDRESS);
  };
  return html`<${Modal} id="url-title" title="Add a link" onClose=${() => onClose(null)}>
    <form onSubmit=${submit} style="display:flex;flex-direction:column;gap:12px">
      <p class="soft" style="margin:0">Paste the address of a page that is already online, such as a Lovable or v0 link, or one running on your machine. Canon keeps the link and shows the live page. A site that does not allow being shown inside other pages gets an Open in a new tab button instead.</p>
      <label class="fb-label" for="url-address">Address</label>
      <input class="field" id="url-address" ref=${addressBox} type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://" value=${value} aria-invalid=${problem ? 'true' : undefined} aria-describedby=${problem ? 'url-error' : undefined} onInput=${(e: Event) => { setValue((e.target as HTMLInputElement).value); setProblem(null); }} />
      ${problem && html`<p class="field-error" id="url-error" role="alert">${problem}</p>`}
      <label class="fb-label" for="url-name">Name</label>
      <input class="field" id="url-name" value=${name} onInput=${(e: Event) => setTypedName((e.target as HTMLInputElement).value)} />
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn ghost" onClick=${() => onClose(null)}>Cancel</button>
        <button class="btn primary">Add</button>
      </div>
    </form>
  <//>`;
}

/* ── Agents: pairing and the sidebar list ───────────────────────────────── */
export function PairDialog({ pair, onClose }: { pair: PairLink; onClose: () => void }) {
  useEffect(() => { record('pair_start'); }, []);
  const notice = pairNotice(useBridge().agents.find((a) => a.id === pair.agentId), pair);
  const connect = async () => {
    try {
      await saveAgent(pair);
      record('pair_done');
      // Connected means a signed answer came back from the agent, so the toast waits for one.
      store.toast(`Saved ${pair.name}. Waiting for it to answer.`);
      void waitForConnection(pair.agentId).then((out) => {
        if (out === 'connected') store.toast(`Connected ${pair.name}.`);
        else if (out === 'blocked') store.toast(CHROME_BLOCKED);
        else store.toast("Canon couldn't reach your agent. Check that it is running and that Chrome allows local network access for this site, then reload.");
      });
    } catch {
      store.toast(`Could not save ${pair.name}. Try the link again.`);
    }
    onClose();
  };
  return html`<${Modal} id="pair-title" title=${`Connect ${pair.name} to Canon?`} onClose=${onClose}>
    <p class="soft" style="margin:0">It will be able to add prototypes to your projects, add versions, move them between boards and open views. It can't delete anything or read your files.</p>
    ${notice && html`<p role="alert" style="margin:0;color:var(--text)">${notice}</p>`}
    <div class="row" style="justify-content:flex-end">
      <button type="button" class="btn ghost" onClick=${onClose}>Cancel</button>
      <button type="button" class="btn primary" onClick=${connect}>Connect</button>
    </div>
  <//>`;
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

/** The project page's "more" menu. It holds one item that pins the project to the top of the sidebar, or unpins it. */
export const pinLabel = (pinned: boolean) => (pinned ? 'Unpin' : 'Pin to top');
export function ProjectMenu({ id, name, pinned }: { id: string; name: string; pinned: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), wrap, button);
  useMenuKeys(open, wrap);
  return html`<div class=${`rowmenu${open ? ' open' : ''}`} ref=${wrap} style="position:relative">
    <button type="button" ref=${button} class="more" aria-haspopup="menu" aria-expanded=${open} aria-label=${`More actions for ${name}`} title="More actions" onClick=${() => setOpen(!open)}><${Icon} name="more" size=${16} /></button>
    ${open && html`<div class="menu rowmenu-pop" role="menu" style="top:calc(100% + 6px);bottom:auto;left:auto;right:0">
      <button type="button" role="menuitem" onClick=${() => { setOpen(false); void store.pinProject(id, !pinned); }}><${Icon} name="pin" />${pinLabel(pinned)}</button>
    </div>`}
  </div>`;
}

/* ── Project ───────────────────────────────────────────────────────────── */
export function ProjectView({ id, tab, askUrl }: { id: string; tab: 'prototypes' | 'boards' | 'comments'; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const project = s.projects.find((p) => p.id === id);
  const [drop, setDrop] = useState(false);
  const nameBox = useRef<HTMLInputElement>(null);
  const escaped = useRef(false);
  // A project that was just made asks for its name: the cursor goes in, with the default selected.
  useEffect(() => {
    if (project && takeProjectNameAsk(project.id)) { nameBox.current?.focus(); nameBox.current?.select(); }
  }, [project?.id]);
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
  return html`<div class="main" onDragOver=${(e: DragEvent) => { if (carries(e)) return; e.preventDefault(); setDrop(true); }} onDragLeave=${(e: DragEvent) => !e.relatedTarget && setDrop(false)} onDrop=${onDrop}>
    <div class="topbar">
      <div class="crumb"><a href="#/">Projects</a><span class="faint">/</span>
        <input ref=${nameBox} value=${project.name} aria-label="Project name"
          onChange=${(e: Event) => {
            const input = e.target as HTMLInputElement;
            if (escaped.current) { escaped.current = false; return; }
            if (input.value.trim()) { void store.renameProject(id, input.value); return; }
            input.value = project.name;
            store.toast('A project needs a name. Type one and press Enter.');
          }}
          onKeyDown=${(e: KeyboardEvent) => {
            const input = e.target as HTMLInputElement;
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') { escaped.current = true; input.value = project.name; input.blur(); }
          }} />
      </div>
      <div class="tabs">
        <a href=${`#/p/${id}`} aria-current=${tab === 'prototypes' ? 'page' : undefined}>Prototypes <span>${countPrototypes(store.getState().frames, { projectId: id })}</span></a>
        <a href=${`#/p/${id}/boards`} aria-current=${tab === 'boards' ? 'page' : undefined}>Boards <span>${store.boardsOf(id).length}</span></a>
        <a href=${`#/p/${id}/comments`} aria-current=${tab === 'comments' ? 'page' : undefined}>Notes <span>${store.notesInProject(id).filter((n) => !n.resolved).length}</span></a>
      </div>
      <span class="spacer"></span>
      <${ProjectMenu} id=${id} name=${project.name} pinned=${!!project.pinned} />
      ${tab === 'prototypes' && html`<${AddMenu} primary label="Add" onWay=${(w: Way) => runWay(w, id, undefined, askUrl)} />`}
      ${tab === 'boards' && html`<button class="btn primary" onClick=${newBoard}><${Icon} name="plus" />New board</button>`}
    </div>
    ${tab === 'prototypes' && html`<${Library} projectId=${id} askUrl=${askUrl} />`}
    ${tab === 'boards' && html`<div class="page"><p class="hint boards-note">Boards lay prototypes side by side. Agents file new prototypes onto a\u00a0board.</p><div class="grid">
      ${store.boardsOf(id).map((b) => html`<a class="card" href=${`#/b/${b.id}`}>
        <${BoardThumb} rects=${boardRects(b.id)} />
        <div class="meta"><b>${b.name}</b><small>${countPrototypes(store.framesOf(b.id), { archived: 'any' })} prototypes · edited ${ago(b.updatedAt)}</small></div>
      </a>`)}
      <button class="card new" onClick=${newBoard}><span><${Icon} name="plus" /> New board</span></button>
    </div></div>`}
    ${tab === 'comments' && html`<${ProjectComments} projectId=${id} />`}
    ${drop && html`<div class="dropzone" style="position:absolute">Drop to add to ${project.name}</div>`}
  </div>`;
}

/** "Move to project" in the selection bar, for every prototype picked. */
function MoveSelected({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), wrap, button);
  return html`<div class="bar-note" ref=${wrap}>
    <button type="button" ref=${button} class="btn" aria-haspopup="dialog" aria-expanded=${open} onClick=${() => setOpen(!open)}><${Icon} name="move" />Move to project</button>
    ${open && html`<div class="bar-pop move-pop move-below" role="dialog" aria-label="Move the selected prototypes to a project"><${MoveMenu} ids=${ids} onDone=${() => { setOpen(false); onDone(); }} /></div>`}
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
  const [board, setBoard] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const all = store.libraryItems(projectId);
  const matched = sortPrototypes(filterPrototypes(all, filter), sort);
  // One item per prototype, showing its current version. Its versions are opened from the prototype view.
  const items: ((typeof matched)[number] & { versions: number })[] = [];
  const seen = new Set<string>();
  for (const i of matched) {
    const key = stackKey(i.frame);
    if (seen.has(key)) continue;
    seen.add(key);
    const stack = store.stackOf(i.id);
    const cur = stack.length ? currentOf(stack) : i.frame;
    const lead = matched.find((m) => stackKey(m.frame) === key && m.id === cur.id) ?? i;
    items.push({ ...lead, versions: stack.length });
  }
  const boards = store.boardsOf(projectId);
  // Board names show only when there is more than one board to tell apart.
  const manyBoards = boards.length > 1;
  const boardsOfItem = (i: (typeof items)[number]): Board[] => {
    const stack = store.stackOf(i.id);
    const ids = new Set((stack.length ? stack : [i.frame]).flatMap((f) => store.boardsHolding(f.id).map((b) => b.id)));
    return boards.filter((b) => ids.has(b.id));
  };
  const shownBoard = manyBoards && board && boards.some((b) => b.id === board) ? board : null;
  const shown = shownBoard ? items.filter((i) => boardsOfItem(i).some((b) => b.id === shownBoard)) : items;
  useHomeProbe(shown.map((i) => i.frame));
  const toggle = (fid: string) => {
    const next = new Set(picked);
    next.has(fid) ? next.delete(fid) : next.add(fid);
    setPicked(next);
  };
  const open = (fid: string) => openPrototype(all.find((i) => i.id === fid)!.frame);
  // A row that is part of the selection carries the whole selection; any other carries itself.
  const dragIds = (fid: string) => (picked.has(fid) ? [...picked] : [fid]);
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
  const clear = () => { setFilter({ source: 'all', tags: [] }); setBoard(null); };
  const tagList = tagCounts(scopeCards(cardsOf(all.map((i) => i.frame)), { kind: filter.archived ? 'archive' : 'home' }));
  const cardFor = (i: (typeof items)[number]) => ({ ...cardOf(i.frame), versions: i.versions });
  const filtering = !!(shownBoard || filter.query || filter.tags?.length || filter.multiPage || filter.hasComments || filter.unplaced || filter.archived || (filter.source && filter.source !== 'all'));

  const versionsSlot = (i: (typeof items)[number]) =>
    html`<span class="ver">${metaOf({ pages: pagesOf(i.frame), versions: i.versions })}</span>`;
  const boardText = (i: (typeof items)[number]) => boardsOfItem(i).map((b) => b.name).join(', ');

  return html`<div class="page library">
    <div class="lib-bar">
      <label class="search small"><${Icon} name="search" /><span class="sr">Search prototypes</span><input placeholder="Search prototypes" value=${filter.query ?? ''} onInput=${(e: Event) => setFilter({ ...filter, query: (e.target as HTMLInputElement).value })} /></label>
      <${FilterPop} filter=${filter} onChange=${setFilter} tags=${tagList} />
      <${ActiveFilters} filter=${filter} onChange=${setFilter} />
      <span class="spacer"></span>
      ${manyBoards && html`<select class="select" value=${shownBoard ?? ''} onChange=${(e: Event) => setBoard((e.target as HTMLSelectElement).value || null)} aria-label="Board">
        <option value="">All boards</option>${boards.map((b) => html`<option key=${b.id} value=${b.id}>${b.name}</option>`)}
      </select>`}
      <select class="select" value=${sort} onChange=${(e: Event) => setSort((e.target as HTMLSelectElement).value as LibrarySort)} aria-label="Sort">
        <option value="updated">Updated</option><option value="starred">Starred first</option><option value="added">Newest</option><option value="name">Name</option><option value="comments">Most notes</option>
      </select>
      <div class="seg" role="group" aria-label="View"><button type="button" aria-pressed=${view === 'grid'} onClick=${() => setView('grid')}>Grid</button><button type="button" aria-pressed=${view === 'list'} onClick=${() => setView('list')}>List</button></div>
    </div>

    ${picked.size > 0 && html`<div class="selection-bar">
      <b>${picked.size} selected</b>
      <span class="faint">Add to</span>
      ${boards.map((b) => html`<button type="button" class="btn" key=${b.id} onClick=${() => addTo(b.id)}>${b.name}</button>`)}
      <button type="button" class="btn" onClick=${() => addTo('new')}><${Icon} name="plus" />New board</button>
      <${MoveSelected} ids=${[...picked]} onDone=${() => setPicked(new Set())} />
      <span class="spacer"></span>
      <button type="button" class="btn ghost danger" onClick=${remove}><${Icon} name="trash" />Delete</button>
      <button type="button" class="btn ghost" onClick=${() => setPicked(new Set())}>Clear</button>
    </div>`}

    ${all.length === 0 && html`<div class="drop-hint" data-drop-hint><b>Drop a prototype here:</b> HTML, a zip or a folder</div>`}
    ${all.length === 0 && html`<div class="empty-board" style="position:static;padding:40px 0"><div>
      <h2>No prototypes yet</h2><p>Or use Add, above, to pick files or link a folder.</p>
    </div></div>`}
    ${all.length > 0 && shown.length === 0 && html`<div class="empty">${filter.archived && !filtering ? 'Nothing is archived.' : 'Nothing matches.'} <button type="button" class="btn ghost" onClick=${clear}>Clear filters</button></div>`}

    ${view === 'grid'
      ? html`<div class="lib-grid">
          ${shown.map((i) => {
            const f = i.frame;
            const card = cardFor(i);
            const s = Math.min(240 / f.w, 160 / f.h);
            return html`<div class=${`lib-card${picked.has(i.id) ? ' picked' : ''}`} key=${i.id} data-card=${i.id} draggable="true" onDragStart=${(e: DragEvent) => startDrag(e, dragIds(i.id))}>
              <button type="button" class="lib-thumb" onClick=${() => open(i.id)} aria-label=${`Open ${f.name}`}>
                ${(pageCount(f) > 1 || i.versions > 1) && html`<span class="lib-sheet"></span>`}
                <span class="lib-frame" style=${{ width: f.w * s, height: f.h * s }}>
                  ${showsCover(f)
                    ? html`<img class="frame-cover" src=${coverSrc(f)} alt="" />`
                    : f.kind === 'url'
                    ? html`<${LinkTile} frame=${f} />`
                    : html`<iframe src=${frameSrc(f)} tabindex="-1" loading="lazy" sandbox=${SANDBOX} aria-hidden="true" style=${{ width: f.w, height: f.h, transform: `scale(${s})` }}></iframe>`}
                </span>
              </button>
              <label class="lib-check"><input type="checkbox" checked=${picked.has(i.id)} onChange=${() => toggle(i.id)} aria-label=${`Select ${f.name}`} /></label>
              <${StarButton} card=${card} />
              <${RowMenu} ids=${dragIds(i.id)} name=${f.name} />
              <div class="meta">
                <b>${f.name}</b>
                <${ReachNote} frame=${f} />
                ${f.summary && html`<span class="lib-sum">${f.summary}</span>`}
                <small>${manyBoards ? boardText(i) || 'Not on a board' : i.boards ? `${i.boards} board${i.boards > 1 ? 's' : ''}` : 'Not on a board'}${i.comments ? ` · ${i.comments} open` : ''}</small>
                ${card.tags.length > 0 && html`<${Tags} tags=${card.tags} />`}
                ${metaOf(card) && html`<div class="lib-ver"><span class="ver-chip">${metaOf(card)}</span></div>`}
              </div>
            </div>`;
          })}
        </div>`
      : html`<ul class="rows lib-rows">
          ${shown.map((i) => html`<${ProtoRow} key=${i.id} card=${cardFor(i)} onOpen=${() => open(i.id)} versions=${versionsSlot(i)} board=${manyBoards ? boardText(i) : undefined} drag=${dragIds(i.id)} pick=${{ checked: picked.has(i.id), onChange: () => toggle(i.id) }} />`)}
        </ul>`}
  </div>`;
}

/**
 * An old link to a prototype's page map. The map is now the Map side of the
 * prototype view, so this opens it there and moves the address on in place.
 */
function OpenMap({ frame, from, page }: { frame: string; from: string | null; page: string | null }) {
  const f = useStore().frames.find((x) => x.id === frame);
  useEffect(() => {
    if (!f) return;
    chooseView(f, 'map');
    if (page) setStartPage(f.id, page);
    replaceAddress({ name: 'full', frame, board: from, width: null, path: null });
  }, [f?.id]);
  return html`<div class="main"></div>`;
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
    ${notes.length === 0 && html`<div class="empty">${show === 'open' ? (s.boards.some((b) => b.projectId === projectId) ? 'Nothing open. Press N on a board and click anywhere.' : 'Nothing open yet.') : 'Nothing resolved yet.'}</div>`}
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

/* ── App ───────────────────────────────────────────────────────────────── */
const SCOPES: Record<string, Scope> = { home: { kind: 'home' }, starred: { kind: 'starred' }, archive: { kind: 'archive' } };

/** What a window under 760px shows in place of the app: one plain screen, no menu. */
function NarrowScreen() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname);
      setCopied(true);
    } catch { /* the button stays as it was */ }
  };
  return html`<div class="narrow">
    <h1>Canon needs a wider\u00a0window</h1>
    <p>Widen the window or open Canon on a\u00a0laptop.</p>
    <button type="button" class="btn" onClick=${copy}>${copied ? 'Copied' : 'Copy link'}</button>
  </div>`;
}

export function App({ pairAtLoad = null }: { pairAtLoad?: PairLink | null }) {
  const s = useStore();
  const route = useRoute();
  const url = useUrlDialog();
  useEffect(() => { record('view', { view: ({ full: 'prototype', bundle: 'prototype' } as Record<string, string>)[route.name] ?? route.name }); }, [route.name]);
  const [pair, setPair] = useState<PairLink | null>(pairAtLoad);
  // A pairing link that arrives while Canon is open is read like one at load: cleared from the
  // address at once, then asked about in the dialog. Nothing connects until the person says so.
  useEffect(() => {
    const later = () => {
      const link = parsePairLink(location.hash);
      if (link === null) return;
      history.replaceState(null, '', location.pathname + location.search);
      dispatchEvent(new HashChangeEvent('hashchange'));
      if (link === 'bad') store.toast('That pairing link is incomplete, so nothing was connected. Ask the agent for a new one.');
      else setPair(link);
    };
    addEventListener('hashchange', later);
    return () => removeEventListener('hashchange', later);
  }, []);
  const cards = useMemo(() => cardsOf(s.frames), [s.frames]);
  const projectName = (id: string) => s.projects.find((p) => p.id === id)?.name ?? '';
  const open = (c: Card) => openPrototype(c.frame);
  const scope: Scope | null = route.name === 'tag' ? { kind: 'tag', tag: route.tag } : SCOPES[route.name] ?? null;
  // The chosen tags live in the address, so Back undoes a choice and a link carries it.
  const tags = route.name === 'home' || route.name === 'starred' || route.name === 'archive' ? route.tags ?? [] : [];
  const chooseTags = (next: string[]) => openHash(buildAddress({ name: route.name === 'starred' || route.name === 'archive' ? route.name : 'home', tags: next }));

  return html`<${Fragment}><div class="shell">
    <${Sidebar} route=${route} activeProject=${projectOf(route)} />
    ${!s.ready
      ? html`<div class="main"></div>`
      : route.name === 'bundle'
        ? html`<${OpenMap} key=${route.frame} frame=${route.frame} from=${route.from} page=${route.page} />`
        : route.name === 'board' || (route.name === 'full' && route.board)
          ? html`<${BoardView} id=${route.board} frameId=${route.name === 'board' ? route.frame ?? route.show ?? null : route.frame} full=${route.name === 'full' ? route : null} askUrl=${url.ask} />`
          : route.name === 'full'
            ? html`<${PrototypeView} address=${route} askUrl=${url.ask} />`
            : route.name === 'project'
              ? html`<${ProjectView} id=${route.project} tab=${route.tab} askUrl=${url.ask} />`
              : html`<${Home} scope=${scope ?? SCOPES.home} askUrl=${url.ask} onOpen=${open} tags=${tags} onTags=${chooseTags} />`}
    ${url.view}
    <${RenameHost} />
    <${SearchHost} cards=${cards} projectName=${projectName} onPick=${open} />
    ${pair && html`<${PairDialog} pair=${pair} onClose=${() => setPair(null)} />`}
    ${s.toast && html`<div class="toast" role="status"><span>${s.toast}</span>${s.toastAction && html`<button type="button" class="toast-act" onClick=${() => { const run = s.toastAction!.run; store.dismissToast(); run(); }}>${s.toastAction.label}</button>`}</div>`}
  </div><${NarrowScreen} /><//>`;
}
