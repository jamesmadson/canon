import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame, Note } from './db';
import { canLinkFolders, groupsFromDrop } from './intake';
import { type Camera, type Point, fitCamera, screenToWorld, tidyPositions, zoomAt } from './lib/layout';
import { iaLayout, splitNav, teaseSlots } from './lib/bundle';
import {
  html, Icon, useStore, go, ago, frameSrc, previewUrl, pageCount, pageName, SANDBOX, KIND, SIZES,
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

/* ── Notes: the composer, and pins ──────────────────────────────────────── */
type Draft = { frameId?: string; page?: string; fx?: number; py?: number; wx?: number; wy?: number; sx: number; sy: number };

function NoteComposer({ at, onCancel, onSave }: { at: Draft; onCancel: () => void; onSave: (n: Pick<Note, 'said' | 'meant' | 'participant'>) => void }) {
  const [said, setSaid] = useState('');
  const [meant, setMeant] = useState('');
  const [who, setWho] = useState('');
  const submit = (e: Event) => {
    e.preventDefault();
    if (!said.trim()) return;
    onSave({ said: said.trim(), meant: meant.trim() || undefined, participant: who.trim() || undefined });
  };
  return html`<form class="composer" style=${{ left: Math.max(12, at.sx + 16), top: Math.max(12, at.sy - 20) }} onSubmit=${submit} onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="label">${at.page ? 'Said · word for word' : 'On the canvas · word for word'}</div>
    <textarea class="field" rows="3" autofocus placeholder="What they said, in their words" value=${said} onInput=${(e: Event) => setSaid((e.target as HTMLTextAreaElement).value)}></textarea>
    <input class="field" placeholder="Who, as a code: P-04 (never a name)" value=${who} onInput=${(e: Event) => setWho((e.target as HTMLInputElement).value)} />
    <textarea class="field" rows="2" placeholder="What you think they meant (optional, marked as yours)" value=${meant} onInput=${(e: Event) => setMeant((e.target as HTMLTextAreaElement).value)}></textarea>
    <div class="row"><button type="button" class="btn ghost" onClick=${onCancel}>Cancel</button><button class="btn primary" disabled=${!said.trim()}>File note</button></div>
  </form>`;
}

const Pin = ({ n, left, top, note, onPick }: { n: number; left: number; top: number; note: Note; onPick?: () => void }) =>
  html`<button class=${`pin${note.source === 'preview' ? ' from-preview' : ''}`} style=${{ left, top }} title=${note.said} onPointerDown=${(e: Event) => { e.stopPropagation(); onPick?.(); }}>${n}</button>`;

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

/* ── Board ─────────────────────────────────────────────────────────────── */
export function BoardView({ id, askUrl }: { id: string; askUrl: () => Promise<string | null> }) {
  const s = useStore();
  const board = s.boards.find((b) => b.id === id);
  const frames = store.framesOf(id);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 80, y: 120, zoom: 0.5 });
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'note'>('select');
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [panning, setPanning] = useState(false);
  const fitted = useRef<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const tidy = board?.arrangement === 'tidy';
  const tidyPos = useMemo(
    () => (tidy ? tidyPositions(frames, { maxRow: Math.max(3200, ...frames.map((f) => f.w)), gap: 120 }) : {}),
    [tidy, frames.map((f) => `${f.id}:${f.w}x${f.h}`).join()]
  );
  const posOf = (f: Frame): Point => (tidy ? tidyPos[f.id] ?? f : f);

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
    setDraft(null);
  }, [id]);
  useEffect(() => {
    if (tidy) fit();
  }, [tidy]);
  useWheel(canvasRef, setCam, live);

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
  const enter = (f: Frame, page?: string) => go(`/b/${id}/p/${f.id}${page ? `?page=${encodeURIComponent(page)}` : ''}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') {
        if (draft) setDraft(null);
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
      else if (e.key === 'Enter' && selected) {
        const f = frames.find((x) => x.id === selected);
        if (f && pageCount(f) > 1) enter(f);
        else setFocus(selected);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const drag = useRef<null | { kind: 'pan' | 'frame'; sx: number; sy: number; ox: number; oy: number; id?: string; moved: boolean }>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setMenu(false);
    const frameEl = (e.target as HTMLElement).closest('[data-frame]') as HTMLElement | null;
    const rect = canvasRef.current!.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, cam);
    if (frameEl && e.button === 0) {
      const f = frames.find((x) => x.id === frameEl.dataset.frame)!;
      if (live === f.id) return;
      if (tool === 'note') {
        const p = posOf(f);
        setDraft({ frameId: f.id, page: f.entry, fx: (world.x - p.x) / f.w, py: world.y - p.y, sx: screen.x, sy: screen.y });
        setSelected(f.id);
        return;
      }
      setSelected(f.id);
      setLive(null);
      drag.current = { kind: 'frame', id: f.id, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, moved: false };
    } else {
      setLive(null);
      if (tool === 'note' && e.button === 0) {
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
    else if (d.moved && !tidy) store.updateFrame(d.id!, { x: Math.round(d.ox + dx / cam.zoom), y: Math.round(d.oy + dy / cam.zoom) }, false);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind !== 'frame') return;
    const f = store.getState().frames.find((x) => x.id === d.id);
    if (!f) return;
    if (d.moved && !tidy) store.updateFrame(f.id, { x: f.x, y: f.y });
    // A click, not a drag, on a multi-page prototype goes into it.
    if (!d.moved && pageCount(f) > 1) enter(f);
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
  const onHover = (fid: string | null) => {
    clearTimeout(hoverTimer.current);
    if (fid) hoverTimer.current = setTimeout(() => setHover(fid), 140);
    else hoverTimer.current = setTimeout(() => setHover(null), 180);
  };

  if (!s.ready) return html`<div class="main"></div>`;
  if (!board) return html`<div class="main"><div class="empty">That board is not in this browser. <a href="#/">Back to boards</a></div></div>`;

  const sel = frames.find((f) => f.id === selected) ?? null;
  const boardNotes = s.notes.filter((n) => n.boardId === id);
  const canvasNotes = store.canvasNotesOf(id);
  const focused = frames.find((f) => f.id === focus) ?? null;

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
        onDragOver=${(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave=${(e: DragEvent) => e.target === e.currentTarget && setDragOver(false)}
        onDrop=${onDrop}
      >
        <div class="world" style=${{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`, '--inv': 1 / cam.zoom }}>
          ${frames.map((f) => {
            const p = posOf(f);
            const notes = store.notesOf(f.id);
            const multi = pageCount(f) > 1;
            const teasing = multi && hover === f.id && !panning && !drag.current?.moved && live !== f.id;
            return html`<div key=${f.id} data-frame=${f.id}
              class=${`frame${selected === f.id ? ' selected' : ''}${live === f.id ? ' live' : ''}${teasing ? ' teasing' : ''}${multi ? ' multi' : ''}`}
              style=${{ left: p.x, top: p.y, width: f.w, height: f.h }}
              onPointerEnter=${() => multi && onHover(f.id)} onPointerLeave=${() => multi && onHover(null)}>
              <div class="frame-label">
                <span>${f.name}</span>
                ${multi ? html`<span class="pages-chip"><${Icon} name="pages" size=${12} />${pageCount(f)} pages</span>` : null}
                <span class="kind">${live === f.id ? 'Live · Esc to leave' : `${f.w}×${f.h}`}</span>
              </div>
              ${teasing && html`<${Teases} frame=${f} onEnter=${(page: string) => enter(f, page)} />`}
              <div class="frame-body">
                <iframe src=${frameSrc(f)} title=${f.name} loading="lazy" sandbox=${f.kind === 'url' ? 'allow-scripts allow-same-origin allow-forms allow-popups' : SANDBOX}></iframe>
                <div class="frame-shield"></div>
              </div>
              ${notes.map((n, i) => html`<${Pin} n=${i + 1} note=${n} left=${(n.fx ?? 0) * f.w} top=${Math.min(store.noteY(n, f.h), f.h)} onPick=${() => setSelected(f.id)} />`)}
              ${draft?.frameId === f.id && html`<span class="pin draft" style=${{ left: (draft.fx ?? 0) * f.w, top: draft.py }}>+</span>`}
            </div>`;
          })}
          ${canvasNotes.map((n, i) => html`<${Pin} n=${i + 1} note=${n} left=${n.wx ?? 0} top=${n.wy ?? 0} />`)}
          ${draft && !draft.frameId && html`<span class="pin draft" style=${{ left: draft.wx, top: draft.wy }}>+</span>`}
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
        ${draft && html`<${NoteComposer} at=${draft} onCancel=${() => setDraft(null)} onSave=${async (n: Pick<Note, 'said' | 'meant' | 'participant'>) => {
          await store.addNote({ boardId: id, frameId: draft.frameId, page: draft.page, fx: draft.fx, py: draft.py, wx: draft.wx, wy: draft.wy, source: 'canvas', ...n });
          setDraft(null);
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
          <button class="btn icon" aria-pressed=${tool === 'note'} onClick=${() => setTool('note')} title="Comment (N): click a prototype or the canvas"><${Icon} name="comment" /></button>
          <span class="sep"></span>
          <button class="btn icon" onClick=${() => zoomBy(0.8)} title="Zoom out (-)"><${Icon} name="minus" /></button>
          <button class="btn zoom" onClick=${() => setCam((c) => zoomAt(c, { x: canvasRef.current!.clientWidth / 2, y: canvasRef.current!.clientHeight / 2 }, 1))} title="Zoom to 100%">${Math.round(cam.zoom * 100)}%</button>
          <button class="btn icon" onClick=${() => zoomBy(1.25)} title="Zoom in (+)"><${Icon} name="plus" /></button>
          <button class="btn icon" onClick=${fit} title="Fit everything (Shift+1)"><${Icon} name="fit" /></button>
        </div>
      </div>

      ${sel && html`<${Inspector} frame=${sel} onFocus=${() => setFocus(sel.id)} onEnter=${() => enter(sel)} onRemove=${removeSelected} onNote=${() => setTool('note')} />`}
    </div>
    ${focused && html`<${Focus} frame=${focused} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function Inspector({ frame, onFocus, onEnter, onRemove, onNote }: { frame: Frame; onFocus: () => void; onEnter: () => void; onRemove: () => void; onNote: () => void }) {
  const notes = store.notesOf(frame.id);
  const all = store.allNotesOf(frame.id);
  const multi = pageCount(frame) > 1;
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec">
      <div class="label">Prototype</div>
      <input class="insp-name" value=${frame.name} key=${frame.id} onChange=${(e: Event) => store.updateFrame(frame.id, { name: (e.target as HTMLInputElement).value || frame.name })} />
      <dl class="kv">
        <dt>Source</dt><dd>${KIND[frame.kind]}</dd>
        ${frame.kind === 'url' ? html`<dt>URL</dt><dd title=${frame.url}>${frame.url}</dd>` : html`<dt>Opens</dt><dd class="mono" title=${frame.entry}>${frame.entry}</dd><dt>Files</dt><dd>${frame.fileCount}</dd>`}
        ${multi && html`<dt>Pages</dt><dd>${pageCount(frame)} · ${frame.links?.length ?? 0} links</dd>`}
        <dt>Added</dt><dd>${ago(frame.createdAt)}</dd>
      </dl>
      <div class="row">
        ${multi ? html`<button class="btn primary" onClick=${onEnter}><${Icon} name="pages" />Open bundle</button>` : html`<button class="btn primary" onClick=${onFocus}><${Icon} name="open" />Open</button>`}
        ${frame.kind === 'linked' && html`<button class="btn" onClick=${() => store.refreshLinked(frame.id)}><${Icon} name="refresh" />Refresh</button>`}
        <a class="btn ghost" href=${previewUrl(frame)} target="_blank" rel="noopener" title="Opens in its own tab, with comments"><${Icon} name="comment" />Preview link</a>
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Size</div>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${frame.w === sz.w && frame.h === sz.h} onClick=${() => store.updateFrame(frame.id, { w: sz.w, h: sz.h })}>${sz.name}</button>`)}
      </div>
    </div>
    <div class="insp-sec">
      <div class="label">Notes · ${multi ? `${notes.length} here, ${all.length} in all` : notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd>, then click the prototype where it happened. Or comment from its preview link.</p>`}
      ${notes.map((n, i) => html`<${NoteItem} note=${n} n=${i + 1} />`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onNote}><${Icon} name="comment" />Add a note</button>`}
    </div>
    <div class="insp-sec" style="border:0">
      <button class="btn ghost danger" onClick=${onRemove}><${Icon} name="trash" />Remove from board</button>
    </div>
  </aside>`;
}

/* ── Bundle: a multi-page prototype as its IA ──────────────────────────── */
export function BundleView({ boardId, frameId, startPage }: { boardId: string; frameId: string; startPage?: string }) {
  const s = useStore();
  const board = s.boards.find((b) => b.id === boardId);
  const frame = s.frames.find((f) => f.id === frameId);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 80, y: 120, zoom: 0.3 });
  const [selected, setSelected] = useState<string | null>(startPage ?? null);
  const [live, setLive] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'note'>('select');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const fitted = useRef(false);

  const [showNav, setShowNav] = useState(false);
  const pages = frame?.pages ?? (frame?.entry ? [frame.entry] : []);
  const entry = frame?.entry ?? pages[0];
  const { flow, navigation } = useMemo(() => splitNav(pages, frame?.links ?? [], entry), [frameId, pages.join(), frame?.links?.length]);
  const links = showNav ? [...flow, ...navigation] : flow;
  const layout = useMemo(
    () => (frame ? iaLayout(pages, entry, flow, { w: frame.w, h: frame.h }, { colGap: Math.max(220, frame.w * 0.3), rowGap: Math.max(180, frame.h * 0.32) }) : null),
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
        else if (live) setLive(null);
        else if (tool === 'note') setTool('select');
        else if (selected) setSelected(null);
        else go(`/b/${boardId}`);
        return;
      }
      if (typing || focus) return;
      if (e.key === 'n' || e.key === 'c') setTool('note');
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
    if (pageEl && e.button === 0) {
      const page = pageEl.dataset.page!;
      if (live === page) return;
      setSelected(page);
      if (tool === 'note') {
        const p = layout.positions[page];
        setDraft({ frameId, page, fx: (world.x - p.x) / frame.w, py: world.y - p.y, sx: screen.x, sy: screen.y });
      }
      return;
    }
    setLive(null);
    if (tool === 'note' && e.button === 0) {
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
  if (!frame || !board || !layout) return html`<div class="main"><div class="empty">That prototype is not in this browser. <a href=${`#/b/${boardId}`}>Back to the board</a></div></div>`;

  const { w, h } = frame;
  const col = (p: string) => Math.round(layout.positions[p].x / (w + Math.max(220, w * 0.3)));
  const all = store.allNotesOf(frameId);
  const unlinkedTop = layout.unlinked.length ? layout.positions[layout.unlinked[0]] : null;

  return html`<div class="main">
    <div class="topbar">
      <div class="crumb">
        <a href="#/">Boards</a><span class="faint">/</span>
        <a href=${`#/b/${boardId}`}>${board.name}</a><span class="faint">/</span>
        <b style="font-weight:500;color:var(--text)">${frame.name}</b>
        <span class="pages-chip"><${Icon} name="pages" size=${12} />${pages.length} pages · ${flow.length} flow links</span>
      </div>
      <span class="spacer"></span>
      ${navigation.length > 0 && html`<div class="seg" role="group" aria-label="Links shown">
        <button aria-pressed=${!showNav} onClick=${() => setShowNav(false)} title="Links that move someone through the prototype">Flow</button>
        <button aria-pressed=${showNav} onClick=${() => setShowNav(true)} title=${`${navigation.length} links that most pages share, like a top nav`}>+ Nav links · ${navigation.length}</button>
      </div>`}
      <a class="btn ghost" href=${previewUrl(frame, selected ?? entry)} target="_blank" rel="noopener" title="Opens in its own tab, with comments"><${Icon} name="comment" />Preview link</a>
      <button class="btn ghost" disabled=${!all.length} onClick=${() => store.exportStrata(all)}><${Icon} name="download" />Notes · ${all.length}</button>
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
            const notes = store.notesOf(frameId, page);
            return html`<div key=${page} data-page=${page} class=${`frame${selected === page ? ' selected' : ''}${live === page ? ' live' : ''}`} style=${{ left: p.x, top: p.y, width: w, height: h }}>
              <div class="frame-label"><span>${pageName(page)}</span>${page === entry && html`<span class="pages-chip">Entry</span>`}<span class="kind">${live === page ? 'Live · Esc to leave' : page}</span></div>
              <div class="frame-body">
                <iframe src=${frameSrc(frame, page)} title=${page} loading="lazy" sandbox=${SANDBOX}></iframe>
                <div class="frame-shield"></div>
              </div>
              ${notes.map((n, i) => html`<${Pin} n=${i + 1} note=${n} left=${(n.fx ?? 0) * w} top=${Math.min(store.noteY(n, h), h)} onPick=${() => setSelected(page)} />`)}
              ${draft?.page === page && html`<span class="pin draft" style=${{ left: (draft.fx ?? 0) * w, top: draft.py }}>+</span>`}
            </div>`;
          })}
          ${store.bundleCanvasNotesOf(frameId).map((n, i) => html`<${Pin} n=${i + 1} note=${n} left=${n.wx ?? 0} top=${n.wy ?? 0} />`)}
          ${draft && draft.wx !== undefined && html`<span class="pin draft" style=${{ left: draft.wx, top: draft.wy }}>+</span>`}
        </div>

        ${draft && html`<${NoteComposer} at=${draft} onCancel=${() => setDraft(null)} onSave=${async (n: Pick<Note, 'said' | 'meant' | 'participant'>) => {
          await store.addNote({ boardId, frameId: draft.frameId, page: draft.page, fx: draft.fx, py: draft.py, wx: draft.wx, wy: draft.wy, source: 'canvas', ...n });
          setDraft(null);
          setTool('select');
          store.toast('Filed as a draft entry. Said is kept word for word.');
        }} />`}

        <div class="toolbar" onPointerDown=${(e: Event) => e.stopPropagation()}>
          <a class="btn" href=${`#/b/${boardId}`} title="Back to the board (Esc)"><${Icon} name="back" />Board</a>
          <span class="sep"></span>
          <button class="btn icon" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          <button class="btn icon" aria-pressed=${tool === 'note'} onClick=${() => setTool('note')} title="Comment (N): click a page"><${Icon} name="comment" /></button>
          <span class="sep"></span>
          <button class="btn zoom" onClick=${() => fit()} title="Fit (Shift+1)">${Math.round(cam.zoom * 100)}%</button>
          <button class="btn icon" onClick=${() => fit()} title="Fit everything (Shift+1)"><${Icon} name="fit" /></button>
        </div>
      </div>
      ${selected && html`<${PageInspector} frame=${frame} page=${selected} onFocus=${() => setFocus(selected)} onPick=${(p: string) => { setSelected(p); fit(p); }} onNote=${() => setTool('note')} />`}
    </div>
    ${focus && html`<${Focus} frame=${frame} page=${focus} onClose=${() => setFocus(null)} />`}
  </div>`;
}

function PageInspector({ frame, page, onFocus, onPick, onNote }: { frame: Frame; page: string; onFocus: () => void; onPick: (p: string) => void; onNote: () => void }) {
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
      <div class="label">Notes · ${notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd> and click this page, or comment from its preview link.</p>`}
      ${notes.map((n, i) => html`<${NoteItem} note=${n} n=${i + 1} />`)}
      ${notes.length > 0 && html`<button class="btn ghost" onClick=${onNote}><${Icon} name="comment" />Add a note</button>`}
    </div>
  </aside>`;
}

/* ── Focus: one page, full size ─────────────────────────────────────────── */
function Focus({ frame, page, onClose }: { frame: Frame; page?: string; onClose: () => void }) {
  const [width, setWidth] = useState<number | null>(frame.w);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return html`<div class="focus">
    <div class="topbar">
      <button class="btn ghost icon" onClick=${onClose} title="Back (Esc)"><${Icon} name="back" /></button>
      <h1>${frame.name}${page && page !== frame.entry ? html`<span class="faint"> · ${pageName(page)}</span>` : ''}</h1>
      <span class="spacer"></span>
      <div class="seg">
        ${SIZES.map((sz) => html`<button aria-pressed=${width === sz.w} onClick=${() => setWidth(sz.w)}>${sz.name} ${sz.w}</button>`)}
        <button aria-pressed=${width === null} onClick=${() => setWidth(null)}>Fill</button>
      </div>
      <a class="btn ghost" href=${previewUrl(frame, page)} target="_blank" rel="noopener"><${Icon} name="comment" />Preview link</a>
    </div>
    <div class="focus-stage">
      <iframe src=${frameSrc(frame, page)} title=${frame.name} style=${{ width: width ? `${width}px` : '100%' }} sandbox=${SANDBOX}></iframe>
    </div>
  </div>`;
}
