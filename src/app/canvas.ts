import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { BoardFrame } from './store';
import type { Frame, Note } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { type Camera, type Point, fitCamera, screenToWorld, tidyPositions, zoomAt } from './lib/layout';
import { iaLayout, splitNav, teaseSlots } from './lib/bundle';
import { sortPrototypes, type LibrarySort } from './lib/library';
import { currentOf, isLocal, versionOf } from './lib/versions';
import { safeFrameUrl } from './lib/resolve';
import { type Address, buildAddress, joinPath } from './lib/address';
import { Composer, CommentsPanel, Pin, Thread, isComment, type Draft } from './comments';
import {
  html, Icon, useStore, go, ago, frameSrc, previewUrl, pageCount, pageName, SANDBOX, KIND, SIZES, showsCover, coverSrc,
  addGroups, runWay, NoteItem, type Way,
} from './shared';

/* ── Camera: pinch or Cmd/Ctrl + scroll zooms at the pointer, scroll pans ── */
function useWheel(ref: { current: HTMLDivElement | null }, setCam: (fn: (c: Camera) => Camera) => void, live: string | null) {
  useEffect(() => {
    const el = ref.current;
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
}

/* ── The hover tease: up to four more pages, peeking out from behind ────── */
function Teases({ frame, onEnter }: { frame: Frame; onEnter: (page: string) => void }) {
  const others = (frame.pages ?? []).filter((p) => p !== frame.entry);
  const slots = teaseSlots(others.length);
  const { w, h } = frame;
  return html`${slots.map((slot, i) => {
    const page = others[i];
    const s = slot.depth === 1 ? 0.62 : 0.5;
    const cw = w * s;
    const ch = h * s;
    const peek = w * (slot.depth === 1 ? 0.2 : 0.34);
    const left = slot.side === 'right' ? w - cw + peek : -peek;
    const rot = (slot.side === 'right' ? 1 : -1) * slot.depth * 1.6;
    return html`<button class="tease" key=${page} title=${`Open ${pageName(page)}`}
      style=${{ left, top: (h - ch) / 2, width: cw, height: ch, zIndex: 3 - slot.depth, '--rot': `${rot}deg`, '--delay': `${i * 40}ms`, '--from': slot.side === 'right' ? '-30%' : '30%' }}
      onPointerDown=${(e: Event) => { e.stopPropagation(); onEnter(page); }}>
      <div class="tease-inner" style=${{ width: w, height: h, transform: `scale(${s})` }}>
        <iframe src=${frameSrc(frame, page)} tabindex="-1" sandbox=${SANDBOX} loading="lazy"></iframe>
      </div>
      <span class="tease-name">${pageName(page)}</span>
    </button>`;
  })}`;
}

/* ── Pick from the library ─────────────────────────────────────────────── */
function LibraryPicker({ projectId, boardId, onClose }: { projectId: string; boardId: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const placed = new Set(store.placementsOf(boardId).map((p) => p.frameId));
  const items = store.prototypesOf(projectId).filter((f) => !placed.has(f.id) && f.name.toLowerCase().includes(q.toLowerCase()));
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <div class="dialog" style="width:460px">
      <h3>Add from the library</h3>
      <input class="field" autofocus placeholder="Search prototypes" value=${q} onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} />
      <div class="pick-list">
        ${items.length === 0 && html`<p class="hint">Everything in this project is already on this board.</p>`}
        ${items.map((f) => html`<button onClick=${async () => { await store.placeOnBoard(boardId, f.id); store.toast(`Added ${f.name}.`); }}>
          <span>${f.name}</span><span class="faint mono" style="font-size:11px">${pageCount(f) > 1 ? `${pageCount(f)} pages · ` : ''}${f.w}×${f.h}</span><${Icon} name="plus" />
        </button>`)}
      </div>
      <div class="row" style="justify-content:flex-end"><button class="btn" onClick=${onClose}>Done</button></div>
    </div>
  </div>`;
}

/* ── Board ─────────────────────────────────────────────────────────────── */
export type FullAddress = Extract<Address, { name: 'full' }>;

/** Change the address without a history entry. replaceState fires no hashchange, so tell the router ourselves. */
const replaceAddress = (a: Address) => {
  history.replaceState(null, '', buildAddress(a));
  dispatchEvent(new HashChangeEvent('hashchange'));
};

export function BoardView({ id, frameId, full, askUrl }: { id: string; frameId: string | null; full: FullAddress | null; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const board = s.boards.find((b) => b.id === id);
  const project = s.projects.find((p) => p.id === board?.projectId);
  const allFrames = store.framesOf(id);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 80, y: 120, zoom: 0.5 });
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSpot = useRef<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'comment'>('select');
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [panning, setPanning] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('added');
  const fitted = useRef<string | null>(null);
  const centred = useRef<string | null>(null);
  const focus = full?.frame ?? null;
  const openFocus = (fid: string) => go(buildAddress({ name: 'full', board: id, frame: fid, width: null, path: null }));
  const closeFocus = () => go(buildAddress({ name: 'board', board: id, frame: null }));
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const tidy = board?.arrangement === 'tidy';
  // Tidy is a view: it sorts and lays out, and never writes over the hand layout.
  // The memo only keys the sort; frames themselves always come fresh, so a
  // refreshed or relocated prototype redraws even when its name and size did not change.
  const order = useMemo(() => {
    if (!tidy) return null;
    const counts = (f: BoardFrame) => store.allNotesOf(f.id).filter((n) => !n.resolved).length;
    const items = allFrames.map((f) => ({ ...f, kind: f.kind, pages: pageCount(f), boards: 1, comments: counts(f) }));
    return sortPrototypes(items, sort).map((i) => i.id);
  }, [tidy, sort, allFrames.map((f) => `${f.id}:${f.name}:${f.w}x${f.h}`).join(), s.notes.length]);
  const frames = order ? order.map((oid) => allFrames.find((f) => f.id === oid)!).filter(Boolean) : allFrames;
  const tidyPos = useMemo(
    () => (tidy ? tidyPositions(frames, { maxRow: Math.max(3200, ...frames.map((f) => f.w)), gap: 120 }) : {}),
    [tidy, frames.map((f) => `${f.id}:${f.w}x${f.h}`).join()]
  );
  const posOf = (f: Frame): Point => (tidy ? tidyPos[f.id] ?? f : f);
  const matches = (f: Frame) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase());

  const fit = () => {
    const el = canvasRef.current;
    if (!el) return;
    setCam(fitCamera(frames.map((f) => ({ ...posOf(f), w: f.w, h: f.h })), { w: el.clientWidth, h: el.clientHeight }));
  };
  // A layout effect, so it runs before a frame link selects its frame below rather than clearing it after.
  useLayoutEffect(() => {
    setSelected(null);
    setLive(null);
    setDraft(null);
    setOpenThread(null);
  }, [id]);
  useLayoutEffect(() => {
    if (fitted.current !== id && frames.length && canvasRef.current) {
      fitted.current = id;
      fit();
    }
  });
  // Turning tidy on, or re-sorting, on a board already on screen refits. A board that opens (or loads) tidy has
  // just been fitted above, and a frame link has just been centred, so refitting then would undo the centring.
  const tidyWas = useRef({ id, tidy, sort, shown: false });
  useEffect(() => {
    const was = tidyWas.current;
    tidyWas.current = { id, tidy, sort, shown: fitted.current === id };
    if (tidy && was.id === id && was.shown && (!was.tidy || was.sort !== sort)) fit();
  });
  // A link to a frame selects the spot showing any version of it and centres that spot once.
  // A frame that is not here leaves the board as it is.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!frameId || !el) return;
    const stack = store.stackOf(frameId);
    const f = frames.find((x) => x.id === frameId) ?? frames.find((x) => stack.some((m) => m.id === x.id));
    if (!f || centred.current === `${id}/${frameId}/${f.placementId}`) return;
    // Select first and centre on the next pass, once the inspector has taken its share of the width.
    if (selected !== f.id) return setSelected(f.id);
    centred.current = `${id}/${frameId}/${f.placementId}`;
    const p = posOf(f);
    setCam((c) => ({ ...c, x: el.clientWidth / 2 - (p.x + f.w / 2) * c.zoom, y: el.clientHeight / 2 - (p.y + f.h / 2) * c.zoom }));
  });
  useWheel(canvasRef, setCam, live);

  const zoomBy = (k: number) => {
    const el = canvasRef.current!;
    setCam((c) => zoomAt(c, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, c.zoom * k));
  };
  const removeSelected = async () => {
    const f = frames.find((x) => x.id === selected);
    if (!f) return;
    setSelected(null);
    await store.removeFromBoard(f.placementId);
    store.toast(`Took ${f.name} off this board. It is still in the library.`);
  };
  const enter = (f: Frame, page?: string) => go(`/f/${f.id}?from=${id}${page ? `&page=${encodeURIComponent(page)}` : ''}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') {
        if (draft) setDraft(null);
        else if (openThread) setOpenThread(null);
        else if (live) setLive(null);
        else if (tool === 'comment') setTool('select');
        else setSelected(null);
        return;
      }
      if (typing || focus) return;
      if (e.key === 'c' || e.key === 'n') setTool('comment');
      else if (e.key === 'v') setTool('select');
      else if (e.key === '!' || (e.shiftKey && e.key === '1')) fit();
      else if (e.key === '=' || e.key === '+') zoomBy(1.25);
      else if (e.key === '-') zoomBy(0.8);
      else if ((e.key === 'Backspace' || e.key === 'Delete') && selected) removeSelected();
      else if (e.key === 'Enter' && selected) {
        const f = frames.find((x) => x.id === selected);
        if (f && pageCount(f) > 1) enter(f);
        else openFocus(selected);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const drag = useRef<null | { kind: 'pan' | 'frame'; sx: number; sy: number; ox: number; oy: number; id?: string; pl?: string; moved: boolean }>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setMenu(false);
    const frameEl = (e.target as HTMLElement).closest('[data-frame]') as HTMLElement | null;
    const rect = canvasRef.current!.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, cam);
    setOpenThread(null);
    if (frameEl && e.button === 0) {
      const f = frames.find((x) => x.id === frameEl.dataset.frame)!;
      if (live === f.id) return;
      if (tool === 'comment') {
        const p = posOf(f);
        setDraft({ frameId: f.id, page: f.entry, fx: (world.x - p.x) / f.w, py: world.y - p.y, sx: screen.x, sy: screen.y });
        return;
      }
      setSelected(f.id);
      setLive(null);
      drag.current = { kind: 'frame', id: f.id, pl: f.placementId, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, moved: false };
    } else {
      setLive(null);
      if (tool === 'comment' && e.button === 0) {
        setDraft({ wx: world.x, wy: world.y, sx: screen.x, sy: screen.y });
        return;
      }
      setSelected(null);
      setDraft(null);
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
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      if (!d.moved) setHover(null);
      d.moved = true;
    }
    if (d.kind === 'pan') setCam((c) => ({ ...c, x: d.ox + dx, y: d.oy + dy }));
    else if (d.moved && !tidy) store.movePlacement(d.pl!, Math.round(d.ox + dx / cam.zoom), Math.round(d.oy + dy / cam.zoom), false);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind !== 'frame') return;
    const pl = store.getState().placements.find((p) => p.id === d.pl);
    const f = store.getState().frames.find((x) => x.id === d.id);
    if (!pl || !f) return;
    if (d.moved && !tidy) store.movePlacement(pl.id, pl.x, pl.y);
    // A click, not a drag, on a multi-page prototype goes into it.
    if (!d.moved && pageCount(f) > 1) enter(f);
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer || !board) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const at = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, cam);
    const { groups, skipped } = await groupsFromDrop(e.dataTransfer);
    if (skipped) store.toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that were not HTML, zip or a folder.`);
    await addGroups(board.projectId, groups, { boardId: id, at });
  };
  const way = async (w: Way) => {
    setMenu(false);
    if (board) await runWay(w, board.projectId, id, askUrl);
  };
  const onHover = (fid: string | null) => {
    clearTimeout(hoverTimer.current);
    if (fid) hoverTimer.current = setTimeout(() => setHover(fid), 140);
    else hoverTimer.current = setTimeout(() => setHover(null), 180);
  };

  if (!s.ready) return html`<div class="main"></div>`;
  if (!board) return html`<div class="main"><div class="empty">That board is not in this browser. <a href="#/">Back home</a></div></div>`;

  // Selection follows the board spot, so swapping in another version keeps its panel open.
  let sel = frames.find((f) => f.id === selected) ?? null;
  if (!sel && selected && selectedSpot.current) sel = frames.find((f) => f.placementId === selectedSpot.current) ?? null;
  selectedSpot.current = sel?.placementId ?? null;
  if (sel && sel.id !== selected) queueMicrotask(() => setSelected(sel!.id));
  const threads = store.threadsOnBoard(id);
  const openCount = threads.filter((n) => !n.resolved).length;
  const visible = (n: Note) => showResolved || !n.resolved || n.id === openThread;
  const canvasNotes = store.canvasNotesOf(id).filter(visible);
  // Focus shows the version the address names, even when the spot shows another.
  const focused = (focus && s.frames.find((f) => f.id === focus)) || null;
  const thread = s.notes.find((n) => n.id === openThread) ?? null;

  // Where a thread's pin sits on screen, for its popover and for jumping to it.
  const pinScreen = (n: Note): Point | null => {
    if (!n.frameId) return { x: cam.x + (n.wx ?? 0) * cam.zoom, y: cam.y + (n.wy ?? 0) * cam.zoom };
    const f = frames.find((x) => x.id === n.frameId);
    if (!f) return null;
    const p = posOf(f);
    return { x: cam.x + (p.x + (n.fx ?? 0) * f.w) * cam.zoom, y: cam.y + (p.y + Math.min(store.noteY(n, f.h), f.h)) * cam.zoom };
  };
  const jumpTo = (n: Note) => {
    const el = canvasRef.current;
    const f = frames.find((x) => x.id === n.frameId);
    if (el) {
      const wp = n.frameId && f ? { x: posOf(f).x + (n.fx ?? 0) * f.w, y: posOf(f).y + store.noteY(n, f.h) } : { x: n.wx ?? 0, y: n.wy ?? 0 };
      const zoom = Math.max(cam.zoom, 0.5);
      setCam({ zoom, x: el.clientWidth * 0.4 - wp.x * zoom, y: el.clientHeight * 0.4 - wp.y * zoom });
    }
    if (n.resolved) setShowResolved(true);
    setOpenThread(n.id);
  };
  const threadAt = thread ? pinScreen(thread) : null;

  return html`<div class="main">
    <div class="topbar">
      <div class="crumb">
        <a href="#/">Projects</a><span class="faint">/</span><a href=${`#/p/${board.projectId}`}>${project?.name ?? 'Project'}</a><span class="faint">/</span>
        <input value=${board.name} onChange=${(e: Event) => store.renameBoard(id, (e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Board name" />
      </div>
      <span class="spacer"></span>
      ${tidy && html`<label class="search small"><${Icon} name="search" /><input placeholder="Find on board" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} /></label>
        <select class="select" value=${sort} onChange=${(e: Event) => setSort((e.target as HTMLSelectElement).value as LibrarySort)} aria-label="Sort">
          <option value="added">Newest</option><option value="name">Name</option><option value="comments">Most notes</option><option value="updated">Last changed</option>
        </select>`}
      <div class="seg" role="group" aria-label="Arrangement">
        <button aria-pressed=${!tidy} onClick=${() => store.setArrangement(id, 'free')}>Free</button>
        <button aria-pressed=${tidy} onClick=${() => store.setArrangement(id, 'tidy')}>Tidy</button>
      </div>
      <button class=${`btn ghost${panel ? ' on' : ''}`} onClick=${() => setPanel(!panel)} title="Notes"><${Icon} name="comment" />${openCount}</button>
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
        onDragOver=${(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave=${(e: DragEvent) => e.target === e.currentTarget && setDragOver(false)}
        onDrop=${onDrop}
      >
        <div class="world" style=${{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`, '--inv': 1 / cam.zoom }}>
          ${frames.map((f) => {
            const p = posOf(f);
            const notes = store.notesOf(f.id).filter(visible);
            const multi = pageCount(f) > 1;
            const teasing = multi && hover === f.id && !panning && !drag.current?.moved && live !== f.id && tool === 'select';
            return html`<div key=${f.id} data-frame=${f.id}
              class=${`frame${selected === f.id ? ' selected' : ''}${live === f.id ? ' live' : ''}${teasing ? ' teasing' : ''}${multi ? ' multi' : ''}${matches(f) ? '' : ' dim'}`}
              style=${{ left: p.x, top: p.y, width: f.w, height: f.h }}
              onPointerEnter=${() => multi && onHover(f.id)} onPointerLeave=${() => multi && onHover(null)}>
              <div class="frame-label" style=${{ maxWidth: f.w * cam.zoom }}>
                <span class="frame-name">${f.name}</span>
                ${multi ? html`<span class="pages-chip"><${Icon} name="pages" size=${12} />${pageCount(f)} pages</span>` : null}
                ${versionChip(f)}
                ${(live === f.id || f.w * cam.zoom > 260) && html`<span class="kind">${live === f.id ? 'Live · Esc to leave' : `${f.w}×${f.h}`}</span>`}
              </div>
              ${teasing && html`<${Teases} frame=${f} onEnter=${(page: string) => enter(f, page)} />`}
              <div class="frame-body">
                ${showsCover(f)
                  ? html`<img class="frame-cover" src=${coverSrc(f)} alt=${`Screenshot of ${f.name}`} draggable=${false} />`
                  : html`<iframe src=${frameSrc(f)} title=${f.name} loading="lazy" sandbox=${f.kind === 'url' ? 'allow-scripts allow-same-origin allow-forms allow-popups' : SANDBOX}></iframe>`}
                <div class="frame-shield"></div>
              </div>
              ${notes.map((n, i) => html`<${Pin} key=${n.id} n=${i + 1} note=${n} left=${(n.fx ?? 0) * f.w} top=${Math.min(store.noteY(n, f.h), f.h)} active=${openThread === n.id} onOpen=${() => setOpenThread(n.id)} />`)}
              ${draft?.frameId === f.id && html`<span class="pin draft" style=${{ left: (draft.fx ?? 0) * f.w, top: draft.py }}>+</span>`}
            </div>`;
          })}
          ${canvasNotes.map((n, i) => html`<${Pin} key=${n.id} n=${i + 1} note=${n} left=${n.wx ?? 0} top=${n.wy ?? 0} active=${openThread === n.id} onOpen=${() => setOpenThread(n.id)} />`)}
          ${draft && !draft.frameId && html`<span class="pin draft" style=${{ left: draft.wx, top: draft.wy }}>+</span>`}
        </div>

        ${frames.length === 0 &&
        html`<div class="empty-board"><div>
          <h2>Drop prototypes here</h2>
          <p>HTML files, zipped builds or whole folders. Or pull in what the project already has.</p>
          <div class="row" style="justify-content:center;margin-top:14px">
            <button class="btn" onClick=${() => setPicker(true)}><${Icon} name="grid" />From the library</button>
            <button class="btn" onClick=${() => way('files')}><${Icon} name="file" />Choose files</button>
            ${canLinkFolders() && html`<button class="btn" onClick=${() => way('link')}><${Icon} name="link" />Link a folder</button>`}
          </div>
        </div></div>`}

        ${dragOver && html`<div class="dropzone">Drop to add to ${board.name}</div>`}
        ${draft && html`<${Composer} at=${draft} onCancel=${() => setDraft(null)} onSave=${async (n: Partial<Note>) => {
          const made = await store.addNote({ boardId: id, frameId: draft.frameId, page: draft.page, fx: draft.fx, py: draft.py, wx: draft.wx, wy: draft.wy, source: 'canvas', said: '', ...n });
          setDraft(null);
          setTool('select');
          setOpenThread(isComment(made) ? null : null);
          store.toast('Note added.');
        }} />`}
        ${thread && threadAt && html`<${Thread} note=${thread} sx=${threadAt.x} sy=${threadAt.y} onClose=${() => setOpenThread(null)} />`}

        <div class="toolbar" onPointerDown=${(e: Event) => e.stopPropagation()}>
          ${html`<div style="position:relative">
            <button class="btn" onClick=${() => setMenu(!menu)} title="Add prototypes"><${Icon} name="plus" />Add</button>
            ${menu && html`<div class="menu">
              <button onClick=${() => { setMenu(false); setPicker(true); }}><${Icon} name="grid" />From the library…</button>
              <button onClick=${() => way('files')}><${Icon} name="file" />HTML or zip files…</button>
              <button onClick=${() => way('folder')}><${Icon} name="folder" />A folder…</button>
              <button onClick=${() => way('link')} disabled=${!canLinkFolders()}><${Icon} name="link" />Link a folder on your machine…${!canLinkFolders() && html`<small>Chromium</small>`}</button>
              <button onClick=${() => way('url')}><${Icon} name="globe" />A running URL…</button>
            </div>`}
          </div>
          <span class="sep"></span>`}
          <button class="btn icon" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          ${html`<button class="btn icon" aria-pressed=${tool === 'comment'} onClick=${() => setTool('comment')} title="Note (N): click a prototype or the canvas"><${Icon} name="comment" /></button>`}
          <span class="sep"></span>
          <button class="btn icon" onClick=${() => zoomBy(0.8)} title="Zoom out (-)"><${Icon} name="minus" /></button>
          <button class="btn zoom" onClick=${() => setCam((c) => zoomAt(c, { x: canvasRef.current!.clientWidth / 2, y: canvasRef.current!.clientHeight / 2 }, 1))} title="Zoom to 100%">${Math.round(cam.zoom * 100)}%</button>
          <button class="btn icon" onClick=${() => zoomBy(1.25)} title="Zoom in (+)"><${Icon} name="plus" /></button>
          <button class="btn icon" onClick=${fit} title="Fit everything (Shift+1)"><${Icon} name="fit" /></button>
        </div>
      </div>

      ${panel
        ? html`<${CommentsPanel} notes=${threads} onPick=${jumpTo} onClose=${() => setPanel(false)} />`
        : sel && html`<${Inspector} frame=${sel} askUrl=${askUrl} onFocus=${() => openFocus(sel.id)} onEnter=${() => enter(sel)} onRemove=${removeSelected} onComment=${() => setTool('comment')} onOpenThread=${jumpTo} />`}
    </div>
    ${picker && html`<${LibraryPicker} projectId=${board.projectId} boardId=${id} onClose=${() => setPicker(false)} />`}
    ${focused && full && html`<${Focus} frame=${focused} address=${full} onClose=${closeFocus} />`}
  </div>`;
}

/** v2 of 3 on a board label; dimmed when it is not the current version. */
function versionChip(f: Frame) {
  const stack = store.stackOf(f.id);
  if (stack.length < 2) return null;
  const cur = currentOf(stack).id === f.id;
  return html`<span class=${`ver-chip${cur ? '' : ' old'}`} title=${cur ? 'The current version' : 'An older version. Select it to show the current one here.'}>v${versionOf(stack, f.id)}/${stack.length}${cur ? '' : ' · not current'}</span>`;
}

/**
 * Every version of this prototype, newest first. The board spot shows one of
 * them; Show here swaps it, Make current marks the one to use everywhere.
 */
function Versions({ frame, askUrl }: { frame: BoardFrame; askUrl: () => Promise<string | null> }) {
  const [menu, setMenu] = useState(false);
  const stack = store.stackOf(frame.id);
  const current = stack.length ? currentOf(stack) : frame;
  const add = async (w: Way) => {
    setMenu(false);
    const before = new Set(store.getState().frames.map((f) => f.id));
    await runWay(w, frame.projectId, undefined, askUrl);
    const added = store.getState().frames.filter((f) => !before.has(f.id));
    const next = added[added.length - 1];
    if (!next) return;
    await store.joinStack(next.id, frame.id);
    // A new round of the same thing takes the same space on the board.
    await store.updateFrame(next.id, { w: frame.w, h: frame.h });
    await store.swapOnBoard(frame.placementId, next.id);
    store.toast(`Version ${versionOf(store.stackOf(next.id), next.id)} added and shown here.`);
  };
  return html`<div class="insp-sec">
    <div class="label">Versions${stack.length > 1 ? ` · ${stack.length}` : ''}</div>
    ${stack.length > 1 && html`<ol class="versions">
      ${[...stack].reverse().map((v) => {
        const n = versionOf(stack, v.id);
        const here = v.id === frame.id;
        return html`<li class=${here ? 'here' : ''}>
          <span class="v-num">v${n}</span>
          <span class="v-name" title=${v.name}>${v.name}<small>${ago(v.createdAt)}${v.id === current.id ? ' · current' : ''}</small></span>
          <span class="v-acts">
            ${!here && html`<button class="link" onClick=${() => store.swapOnBoard(frame.placementId, v.id)}>Show here</button>`}
            ${v.id !== current.id && html`<button class="link" onClick=${() => store.makeCurrent(v.id)}>Make current</button>`}
          </span>
        </li>`;
      })}
    </ol>`}
    ${stack.length <= 1 && html`<p class="hint insp-hint" style="margin-top:0">Made a new round of this one? Add it as a version and it stacks here instead of becoming another tab.</p>`}
    <div class="row" style="margin-top:10px;position:relative">
      <button class="btn" onClick=${() => setMenu(!menu)}><${Icon} name="plus" />Add a version</button>
      ${stack.length > 1 && html`<button class="btn ghost" onClick=${() => store.unstack(frame.id)} title="Take this one out of the stack">Unstack</button>`}
      ${menu && html`<div class="menu" style="top:40px;left:0">
        <button onClick=${() => add('files')}><${Icon} name="file" />HTML or zip files…</button>
        <button onClick=${() => add('folder')}><${Icon} name="folder" />A folder…</button>
        ${canLinkFolders() && html`<button onClick=${() => add('link')}><${Icon} name="link" />Link a folder on your machine…</button>`}
        <button onClick=${() => add('url')}><${Icon} name="globe" />A running URL…</button>
      </div>`}
    </div>
  </div>`;
}

/** A link behind a work sign-in won't draw inside Canon; a screenshot stands in. */
function LinkDisplay({ frame }: { frame: Frame }) {
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => input.files?.[0] && store.setCover(frame.id, input.files[0]);
    input.click();
  };
  const onPaste = (e: ClipboardEvent) => {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) store.setCover(frame.id, file);
  };
  return html`<div class="insp-sec" tabindex="0" onPaste=${onPaste}>
    <div class="label">Shows as</div>
    <div class="seg">
      <button aria-pressed=${frame.display !== 'cover' || !frame.cover} onClick=${() => store.setDisplay(frame.id, 'live')}>Live page</button>
      <button aria-pressed=${frame.display === 'cover' && !!frame.cover} onClick=${() => (frame.cover ? store.setDisplay(frame.id, 'cover') : pick())}>Screenshot</button>
    </div>
    <p class="hint insp-hint">Blank, or asking you to sign in? Work sign-in pages won't show inside another site, even on your own machine. Open it in its own tab, and <button class="link" onClick=${pick}>${frame.cover ? 'replace the screenshot' : 'add a screenshot'}</button> (or paste one here) so the board still shows it.</p>
  </div>`;
}

function Inspector({ frame, askUrl, onFocus, onEnter, onRemove, onComment, onOpenThread }: { frame: BoardFrame; askUrl: () => Promise<string | null>; onFocus: () => void; onEnter: () => void; onRemove: () => void; onComment: () => void; onOpenThread: (n: Note) => void }) {
  const notes = store.notesOf(frame.id);
  const all = store.allNotesOf(frame.id);
  const multi = pageCount(frame) > 1;
  const onBoards = store.boardsHolding(frame.id);
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec">
      <div class="label">Prototype</div>
      <input class="insp-name" value=${frame.name} key=${frame.id} onChange=${(e: Event) => store.updateFrame(frame.id, { name: (e.target as HTMLInputElement).value || frame.name })} />
      <dl class="kv">
        <dt>Source</dt><dd>${KIND[frame.kind]}</dd>
        ${frame.kind === 'url' ? html`<dt>URL</dt><dd title=${frame.url}>${frame.url}</dd>` : html`<dt>Opens</dt><dd class="mono" title=${frame.entry}>${frame.entry}</dd><dt>Files</dt><dd>${frame.fileCount}</dd>`}
        ${multi && html`<dt>Pages</dt><dd>${pageCount(frame)} · ${frame.links?.length ?? 0} links</dd>`}
        <dt>On boards</dt><dd title=${onBoards.map((b) => b.name).join(', ')}>${onBoards.map((b) => b.name).join(', ')}</dd>
        <dt>Added</dt><dd>${ago(frame.createdAt)}</dd>
      </dl>
      <div class="row">
        ${multi
          ? html`<button class="btn primary" onClick=${onEnter}><${Icon} name="pages" />Open pages</button>`
          : frame.kind === 'url'
            ? html`<a class="btn primary" href=${safeFrameUrl(frame.url)} target="_blank" rel="noopener"><${Icon} name="open" />Open</a>`
            : html`<button class="btn primary" onClick=${onFocus}><${Icon} name="open" />Open</button>`}
        ${frame.kind === 'linked' && html`<button class="btn" onClick=${() => store.refreshLinked(frame.id)}><${Icon} name="refresh" />Refresh</button>`}
        ${frame.kind !== 'url' && html`<a class="btn ghost" href=${previewUrl(frame)} target="_blank" rel="noopener" title="Opens in its own tab, with notes"><${Icon} name="comment" />Preview link</a>`}
      </div>
      ${frame.kind === 'linked' && canLinkFolders() && html`<p class="hint insp-hint">Moved or renamed the folder? <button class="link" onClick=${() => store.relocate(frame.id)}>Relocate it</button></p>`}
      ${frame.kind === 'files' && canLinkFolders() && html`<p class="hint insp-hint">A copy, so it won't change. <button class="link" onClick=${() => store.relocate(frame.id)}>Link it to its folder</button> to refresh from disk.</p>`}
    </div>
    <${Versions} frame=${frame} askUrl=${askUrl} />
    ${frame.kind === 'url' && html`<${LinkDisplay} frame=${frame} />`}
    <div class="insp-sec">
      <div class="label">Size</div>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${frame.w === sz.w && frame.h === sz.h} onClick=${() => store.updateFrame(frame.id, { w: sz.w, h: sz.h })}>${sz.name}</button>`)}
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Threads · ${multi ? `${notes.length} here, ${all.length} in all` : notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd>, then click the prototype. Or add one from its preview link.</p>`}
      ${notes.map((n) => html`<button class="thread-row" onClick=${() => onOpenThread(n)}><${NoteItem} note=${n} /></button>`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onComment}><${Icon} name="comment" />Add a note</button>`}
    </div>
    <div class="insp-sec" style="border:0">
      <button class="btn ghost danger" onClick=${onRemove}><${Icon} name="x" />Take off this board</button>
    </div>
  </aside>`;
}

/* ── Bundle: a multi-page prototype as its IA ──────────────────────────── */
export function BundleView({ frameId, fromBoard, startPage }: { frameId: string; fromBoard?: string; startPage?: string }) {
  const s = useStore();
  const frame = s.frames.find((f) => f.id === frameId);
  const board = s.boards.find((b) => b.id === fromBoard) ?? store.boardsHolding(frameId)[0];
  const project = s.projects.find((p) => p.id === frame?.projectId);
  const back = board ? `#/b/${board.id}` : `#/p/${frame?.projectId}`;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 80, y: 120, zoom: 0.3 });
  const [selected, setSelected] = useState<string | null>(startPage ?? null);
  const [live, setLive] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'comment'>('select');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const fitted = useRef(false);

  const pages = frame?.pages ?? (frame?.entry ? [frame.entry] : []);
  const entry = frame?.entry ?? pages[0];
  const { flow, navigation } = useMemo(() => splitNav(pages, frame?.links ?? [], entry), [frameId, pages.join(), frame?.links?.length]);
  const links = showNav ? [...flow, ...navigation] : flow;
  const colGap = frame ? Math.max(220, frame.w * 0.3) : 220;
  const layout = useMemo(
    () => (frame ? iaLayout(pages, entry, flow, { w: frame.w, h: frame.h }, { colGap, rowGap: Math.max(180, frame.h * 0.32) }) : null),
    [frameId, frame?.w, frame?.h, pages.join(), flow.length]
  );

  const fit = (only?: string) => {
    const el = canvasRef.current;
    if (!el || !frame || !layout) return;
    const rects = (only ? [only] : pages).map((p) => ({ ...layout.positions[p], w: frame.w, h: frame.h }));
    setCam(fitCamera(rects, { w: el.clientWidth, h: el.clientHeight }, only ? 120 : 80));
  };
  useLayoutEffect(() => {
    if (!fitted.current && layout && canvasRef.current) {
      fitted.current = true;
      fit();
    }
  });
  useWheel(canvasRef, setCam, live);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') {
        if (focus) return;
        if (draft) setDraft(null);
        else if (openThread) setOpenThread(null);
        else if (live) setLive(null);
        else if (tool === 'comment') setTool('select');
        else if (selected) setSelected(null);
        else location.hash = back;
        return;
      }
      if (typing || focus) return;
      if (e.key === 'n' || e.key === 'c') setTool('comment');
      else if (e.key === 'v') setTool('select');
      else if (e.key === '!' || (e.shiftKey && e.key === '1')) fit();
      else if (e.key === 'Enter' && selected) setFocus(selected);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const drag = useRef<null | { sx: number; sy: number; ox: number; oy: number }>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (!frame || !layout) return;
    const pageEl = (e.target as HTMLElement).closest('[data-page]') as HTMLElement | null;
    const rect = canvasRef.current!.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, cam);
    setOpenThread(null);
    if (pageEl && e.button === 0) {
      const page = pageEl.dataset.page!;
      if (live === page) return;
      setSelected(page);
      if (tool === 'comment') {
        const p = layout.positions[page];
        setDraft({ frameId, page, fx: (world.x - p.x) / frame.w, py: world.y - p.y, sx: screen.x, sy: screen.y });
      }
      return;
    }
    setLive(null);
    if (tool === 'comment' && e.button === 0) {
      setDraft({ frameId, wx: world.x, wy: world.y, sx: screen.x, sy: screen.y });
      return;
    }
    setSelected(null);
    setDraft(null);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: cam.x, oy: cam.y };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) setCam((c) => ({ ...c, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setPanning(false);
  };

  if (!s.ready) return html`<div class="main"></div>`;
  if (!frame || !layout) return html`<div class="main"><div class="empty">That prototype is not in this browser. <a href="#/">Back home</a></div></div>`;

  const { w, h } = frame;
  const col = (p: string) => Math.round(layout.positions[p].x / (w + colGap));
  const unlinkedTop = layout.unlinked.length ? layout.positions[layout.unlinked[0]] : null;
  const thread = s.notes.find((n) => n.id === openThread) ?? null;
  const threadAt = (() => {
    if (!thread) return null;
    if (thread.wx !== undefined) return { x: cam.x + thread.wx * cam.zoom, y: cam.y + (thread.wy ?? 0) * cam.zoom };
    const p = layout.positions[thread.page ?? entry];
    if (!p) return null;
    return { x: cam.x + (p.x + (thread.fx ?? 0) * w) * cam.zoom, y: cam.y + (p.y + Math.min(store.noteY(thread, h), h)) * cam.zoom };
  })();

  return html`<div class="main">
    <div class="topbar">
      <div class="crumb">
        <a href="#/">Projects</a><span class="faint">/</span>
        <a href=${`#/p/${frame.projectId}`}>${project?.name ?? 'Project'}</a><span class="faint">/</span>
        ${board && html`<a href=${`#/b/${board.id}`}>${board.name}</a><span class="faint">/</span>`}
        <b style="font-weight:500;color:var(--text)">${frame.name}</b>
        <span class="pages-chip"><${Icon} name="pages" size=${12} />${pages.length} pages · ${flow.length} flow links</span>
      </div>
      <span class="spacer"></span>
      ${navigation.length > 0 && html`<div class="seg" role="group" aria-label="Links shown">
        <button aria-pressed=${!showNav} onClick=${() => setShowNav(false)} title="Links that move someone through the prototype">Flow</button>
        <button aria-pressed=${showNav} onClick=${() => setShowNav(true)} title=${`${navigation.length} links that most pages share, like a top nav`}>+ Nav links · ${navigation.length}</button>
      </div>`}
      <a class="btn ghost" href=${previewUrl(frame, selected ?? entry)} target="_blank" rel="noopener" title="Opens in its own tab, with notes"><${Icon} name="comment" />Preview link</a>
    </div>
    <div class="board">
      <div ref=${canvasRef}
        class=${`canvas tool-${tool}${panning ? ' panning' : ''}`}
        style=${{ backgroundSize: `${24 * cam.zoom}px ${24 * cam.zoom}px`, backgroundPosition: `${cam.x}px ${cam.y}px` }}
        onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp}
        onDblClick=${(e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest('[data-page]') as HTMLElement | null;
          if (el && tool === 'select') setLive(el.dataset.page!);
        }}>
        <div class="world" style=${{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`, '--inv': 1 / cam.zoom }}>
          <svg class="links" style=${{ overflow: 'visible', position: 'absolute', left: 0, top: 0, width: 1, height: 1 }}>
            <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
            ${links.map(([a, b]) => {
              const pa = layout.positions[a];
              const pb = layout.positions[b];
              if (!pa || !pb) return null;
              const hot = selected === a || selected === b;
              const isNav = navigation.some(([x, y]) => x === a && y === b);
              const forward = col(b) > col(a);
              let d: string;
              if (forward) {
                const x1 = pa.x + w, y1 = pa.y + h / 2, x2 = pb.x, y2 = pb.y + h / 2;
                const k = (x2 - x1) / 2;
                d = `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`;
              } else {
                const x1 = pa.x + w / 2, y1 = pa.y, x2 = pb.x + w / 2, y2 = pb.y;
                const lift = Math.max(140, Math.abs(x1 - x2) * 0.18);
                d = `M${x1} ${y1} C${x1} ${y1 - lift} ${x2} ${y2 - lift} ${x2} ${y2}`;
              }
              return html`<path d=${d} class=${`link${forward ? '' : ' back'}${isNav ? ' nav' : ''}${hot ? ' hot' : ''}`} marker-end="url(#arrow)" />`;
            })}
          </svg>
          ${unlinkedTop && html`<div class="col-label" style=${{ left: unlinkedTop.x, top: unlinkedTop.y }}>Not linked from anywhere</div>`}
          ${pages.map((page) => {
            const p = layout.positions[page];
            const notes = store.notesOf(frameId, page).filter((n) => !n.resolved || n.id === openThread);
            return html`<div key=${page} data-page=${page} class=${`frame${selected === page ? ' selected' : ''}${live === page ? ' live' : ''}`} style=${{ left: p.x, top: p.y, width: w, height: h }}>
              <div class="frame-label" style=${{ maxWidth: w * cam.zoom }}><span class="frame-name">${pageName(page)}</span>${page === entry && html`<span class="pages-chip">Entry</span>`}${(live === page || w * cam.zoom > 260) && html`<span class="kind">${live === page ? 'Live · Esc to leave' : page}</span>`}</div>
              <div class="frame-body">
                <iframe src=${frameSrc(frame, page)} title=${page} loading="lazy" sandbox=${SANDBOX}></iframe>
                <div class="frame-shield"></div>
              </div>
              ${notes.map((n, i) => html`<${Pin} key=${n.id} n=${i + 1} note=${n} left=${(n.fx ?? 0) * w} top=${Math.min(store.noteY(n, h), h)} active=${openThread === n.id} onOpen=${() => { setSelected(page); setOpenThread(n.id); }} />`)}
              ${draft?.page === page && html`<span class="pin draft" style=${{ left: (draft.fx ?? 0) * w, top: draft.py }}>+</span>`}
            </div>`;
          })}
          ${store.bundleCanvasNotesOf(frameId).filter((n) => !n.resolved || n.id === openThread).map((n, i) => html`<${Pin} key=${n.id} n=${i + 1} note=${n} left=${n.wx ?? 0} top=${n.wy ?? 0} active=${openThread === n.id} onOpen=${() => setOpenThread(n.id)} />`)}
          ${draft && draft.wx !== undefined && html`<span class="pin draft" style=${{ left: draft.wx, top: draft.wy }}>+</span>`}
        </div>

        ${draft && html`<${Composer} at=${draft} onCancel=${() => setDraft(null)} onSave=${async (n: Partial<Note>) => {
          const made = await store.addNote({ boardId: board?.id ?? '', frameId: draft.frameId, page: draft.page, fx: draft.fx, py: draft.py, wx: draft.wx, wy: draft.wy, source: 'canvas', said: '', ...n });
          setDraft(null);
          setTool('select');
          store.toast('Note added.');
        }} />`}
        ${thread && threadAt && html`<${Thread} note=${thread} sx=${threadAt.x} sy=${threadAt.y} onClose=${() => setOpenThread(null)} />`}

        <div class="toolbar" onPointerDown=${(e: Event) => e.stopPropagation()}>
          <a class="btn" href=${back} title="Back (Esc)"><${Icon} name="back" />${board ? board.name : 'Library'}</a>
          <span class="sep"></span>
          <button class="btn icon" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          <button class="btn icon" aria-pressed=${tool === 'comment'} onClick=${() => setTool('comment')} title="Note (N): click a page"><${Icon} name="comment" /></button>
          <span class="sep"></span>
          <button class="btn zoom" onClick=${() => fit()} title="Fit (Shift+1)">${Math.round(cam.zoom * 100)}%</button>
          <button class="btn icon" onClick=${() => fit()} title="Fit everything (Shift+1)"><${Icon} name="fit" /></button>
        </div>
      </div>
      ${selected && html`<${PageInspector} frame=${frame} page=${selected} onFocus=${() => setFocus(selected)} onPick=${(p: string) => { setSelected(p); fit(p); }} onComment=${() => setTool('comment')} onOpenThread=${(n: Note) => setOpenThread(n.id)} />`}
    </div>
    ${focus && html`<${Focus} frame=${frame} page=${focus} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function PageInspector({ frame, page, onFocus, onPick, onComment, onOpenThread }: { frame: Frame; page: string; onFocus: () => void; onPick: (p: string) => void; onComment: () => void; onOpenThread: (n: Note) => void }) {
  const links = frame.links ?? [];
  const out = links.filter(([a]) => a === page).map(([, b]) => b);
  const into = links.filter(([, b]) => b === page).map(([a]) => a);
  const notes = store.notesOf(frame.id, page);
  const list = (items: string[], empty: string) =>
    items.length
      ? html`<div class="page-links">${items.map((p) => html`<button onClick=${() => onPick(p)}>${pageName(p)}<span class="mono faint">${p}</span></button>`)}</div>`
      : html`<p class="hint" style="margin:0">${empty}</p>`;
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec">
      <div class="label">Page</div>
      <div style="font-size:15px;font-weight:500">${pageName(page)}</div>
      <div class="mono faint" style="font-size:11.5px">${page}</div>
      <div class="row">
        <button class="btn primary" onClick=${onFocus}><${Icon} name="open" />Open</button>
        <a class="btn ghost" href=${previewUrl(frame, page)} target="_blank" rel="noopener"><${Icon} name="comment" />Preview link</a>
      </div>
    </div>
    <div class="insp-sec"><div class="label">Links to · ${out.length}</div>${list(out, 'No links to other pages.')}</div>
    <div class="insp-sec"><div class="label">Linked from · ${into.length}</div>${list(into, page === frame.entry ? 'The entry page.' : 'Nothing links here. It may be orphaned.')}</div>
    <div class="insp-sec" style="border:0">
      <div class="label">Threads · ${notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd> and click this page, or add one from its preview link.</p>`}
      ${notes.map((n) => html`<button class="thread-row" onClick=${() => onOpenThread(n)}><${NoteItem} note=${n} /></button>`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onComment}><${Icon} name="comment" />Add a note</button>`}
    </div>
  </aside>`;
}

/* ── Focus: one page, full size ─────────────────────────────────────────── */
/**
 * With an address, Focus is a link: its width, path and version live in the
 * hash and change it in place, so Back leaves Focus rather than stepping
 * through widths. Without one (Library, ⌘K, a bundle page) it keeps its own state.
 */
export function Focus({ frame, page, onClose, address }: { frame: Frame; page?: string; onClose: () => void; address?: FullAddress }) {
  const [localWidth, setLocalWidth] = useState<number | null>(frame.w);
  const width = address ? (address.width === 'fill' ? null : address.width ?? frame.w) : localWidth;
  const setWidth = (w: number | null) => (address ? replaceAddress({ ...address, width: w ?? 'fill' }) : setLocalWidth(w));
  const stack = address ? store.stackOf(frame.id) : [];
  const v = versionOf(stack, frame.id);
  const isCurrent = stack.length < 2 || currentOf(stack).id === frame.id;
  const src = address && frame.kind === 'url' ? joinPath(safeFrameUrl(frame.url), address.path) : frameSrc(frame, page);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname + buildAddress(address));
      store.toast('Link copied.');
    } catch {
      store.toast('Could not copy the link. Copy it from the address bar.');
    }
  };
  return html`<div class="focus">
    <div class="topbar">
      <button class="btn ghost icon" onClick=${onClose} title="Back (Esc)"><${Icon} name="back" /></button>
      <h1>${frame.name}${page && page !== frame.entry ? html`<span class="faint"> · ${pageName(page)}</span>` : ''}</h1>
      <span class="spacer"></span>
      ${address && stack.length > 1 && html`<select class="select" aria-label="Version" value=${frame.id} onChange=${(e: Event) => replaceAddress({ ...address, frame: (e.target as HTMLSelectElement).value })}>
        ${[...stack].reverse().map((m) => html`<option value=${m.id} selected=${m.id === frame.id}>v${versionOf(stack, m.id)}${m.id === currentOf(stack).id ? ' · current' : ''}</option>`)}
      </select>`}
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${width === sz.w} onClick=${() => setWidth(sz.w)}>${sz.name} ${sz.w}</button>`)}
        <button aria-pressed=${width === null} onClick=${() => setWidth(null)}>Fill</button>
      </div>
      ${address && html`<button class="btn ghost" onClick=${copy}><${Icon} name="link" />Copy link</button>`}
      <a class="btn ghost" href=${previewUrl(frame, page)} target="_blank" rel="noopener"><${Icon} name="comment" />Preview link</a>
    </div>
    ${address && frame.kind === 'url' && !isCurrent && isLocal(frame.url ?? '') && html`<p class="hint" role="status" style="margin:8px 16px 0">This is localhost, so it shows what's running now, not v${v}.</p>`}
    <div class="focus-stage">
      <iframe src=${src} title=${frame.name} style=${{ width: width ? `${width}px` : '100%' }} sandbox=${SANDBOX}></iframe>
    </div>
  </div>`;
}
