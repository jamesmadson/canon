import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { BoardFrame } from './store';
import type { Frame, Note } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { type Camera, type Point, fitCamera, screenToWorld, tidyPositions, zoomAt } from './lib/layout';
import { iaLayout, splitNav, teaseSlots } from './lib/bundle';
import { sortPrototypes, type LibrarySort } from './lib/library';
import { currentOf, versionOf } from './lib/versions';
import { safeFrameUrl } from './lib/resolve';
import { buildAddress } from './lib/address';
import { openHash } from './lib/nav';
import { Focus, type FullAddress } from './prototype';
import { useWheel } from './map';
import { Composer, CommentsPanel, Pin, Thread, isComment, type Draft } from './comments';
import { PrototypeActions, ZoomControls } from './bar';
import { FrameBody, LiveSwitch } from './live';
import {
  html, Icon, useStore, go, ago, frameSrc, previewUrl, pageCount, pageName, SANDBOX, KIND, SIZES, showsCover, coverSrc,
  addGroups, runWay, NoteItem, type Way,
} from './shared';

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
          <span>${f.name}</span><span class="faint mono" style="font-size:var(--fs-meta)">${pageCount(f) > 1 ? `${pageCount(f)} pages · ` : ''}${f.w}×${f.h}</span><${Icon} name="plus" />
        </button>`)}
      </div>
      <div class="row" style="justify-content:flex-end"><button class="btn" onClick=${onClose}>Done</button></div>
    </div>
  </div>`;
}

/* ── Board ─────────────────────────────────────────────────────────────── */

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
  const openFocus = (fid: string) => openHash(buildAddress({ name: 'full', board: id, frame: fid, width: null, path: null }));
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
  // A frame that is not here leaves the board as it is, and so does opening it full screen: Focus covers the board.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!frameId || full || !el) return;
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
                  : html`<${FrameBody} frame=${f} />`}
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
          <button type="button" class="btn icon" aria-label="Select tool" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          ${html`<button type="button" class="btn icon" aria-label="Pin a note on the page" aria-pressed=${tool === 'comment'} onClick=${() => setTool('comment')} title="Pin a note (N): click a prototype or the canvas"><${Icon} name="comment" /></button>`}
          <span class="sep"></span>
          <${PrototypeActions} frame=${sel ?? undefined} />
          <span class="sep"></span>
          <${ZoomControls} zoom=${cam.zoom} onOut=${() => zoomBy(0.8)} onIn=${() => zoomBy(1.25)} onFit=${fit}
            onReset=${() => setCam((c) => zoomAt(c, { x: canvasRef.current!.clientWidth / 2, y: canvasRef.current!.clientHeight / 2 }, 1))} />
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
        ${frame.kind === 'url' ? html`<dt>URL</dt><dd title=${frame.url}>${frame.url}</dd>` : html`<dt>Opens</dt><dd class="mono" title=${frame.entry}>${frame.entry}</dd><dt>Files</dt><dd>${frame.fileCount}</dd>${frame.liveUrl ? html`<dt>Live address</dt><dd class="mono" title=${frame.liveUrl}>${frame.liveUrl}</dd>` : null}`}
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
        ${frame.kind !== 'url' && html`<a class="btn ghost" href=${previewUrl(frame)} target="_blank" rel="noopener" title="Opens in its own tab, with notes"><${Icon} name="open" />Open in new tab</a>`}
      </div>
      ${frame.kind === 'linked' && canLinkFolders() && html`<p class="hint insp-hint">Moved or renamed the folder? <button class="link" onClick=${() => store.relocate(frame.id)}>Relocate it</button></p>`}
      ${frame.kind === 'files' && canLinkFolders() && html`<p class="hint insp-hint">A copy, so it won't change. <button class="link" onClick=${() => store.relocate(frame.id)}>Link it to its folder</button> to refresh from disk.</p>`}
    </div>
    <${Versions} frame=${frame} askUrl=${askUrl} />
    <${LiveSwitch} frame=${frame} />
    ${frame.kind === 'url' && html`<${LinkDisplay} frame=${frame} />`}
    <div class="insp-sec">
      <div class="label">Size</div>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${frame.w === sz.w && frame.h === sz.h} onClick=${() => store.updateFrame(frame.id, { w: sz.w, h: sz.h })}>${sz.name}</button>`)}
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Threads · ${multi ? `${notes.length} here, ${all.length} in all` : notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd>, then click the prototype. Or use Note in the prototype view.</p>`}
      ${notes.map((n) => html`<button class="thread-row" onClick=${() => onOpenThread(n)}><${NoteItem} note=${n} /></button>`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onComment}><${Icon} name="comment" />Add a note</button>`}
    </div>
    <div class="insp-sec" style="border:0">
      <button class="btn ghost danger" onClick=${onRemove}><${Icon} name="x" />Take off this board</button>
    </div>
  </aside>`;
}
