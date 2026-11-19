/**
 * The page map: a multi-page prototype as a flow chart of its pages and the
 * links between them. It fills the prototype view's stage. The top bar and the
 * bottom bar belong to that view, so they stay the same on Page and on Map.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame, Note } from './db';
import { type Camera, fitCamera, screenToWorld, zoomAt } from './lib/layout';
import { iaLayout, splitNav } from './lib/bundle';
import { Composer, Pin, Thread, type Draft } from './comments';
import { html, Icon, useStore, frameSrc, previewUrl, pageName, SANDBOX, NoteItem } from './shared';

/* ── Camera: pinch or Cmd/Ctrl + scroll zooms at the pointer, scroll pans ── */
export function useWheel(ref: { current: HTMLDivElement | null }, setCam: (fn: (c: Camera) => Camera) => void, live: string | null) {
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

/** What the bottom bar's zoom controls call on the map. */
export interface MapApi {
  fit: () => void;
  zoomBy: (k: number) => void;
  zoomTo: (z: number) => void;
}

export const START_CAMERA: Camera = { x: 80, y: 120, zoom: 0.3 };

interface MapProps {
  frame: Frame;
  cam: Camera;
  setCam: (fn: (c: Camera) => Camera) => void;
  api: { current: MapApi | null };
  startPage?: string;
  /** Show this page in the page view. */
  onPage: (page: string) => void;
}

export function PageMap({ frame, cam, setCam, api, startPage, onPage }: MapProps) {
  const s = useStore();
  const frameId = frame.id;
  const board = store.boardsHolding(frameId)[0];
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(startPage ?? null);
  const [live, setLive] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'comment'>('select');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const fitted = useRef(false);

  const pages = frame.pages ?? (frame.entry ? [frame.entry] : []);
  const entry = frame.entry ?? pages[0];
  const { flow, navigation } = useMemo(() => splitNav(pages, frame.links ?? [], entry), [frameId, pages.join(), frame.links?.length]);
  const links = showNav ? [...flow, ...navigation] : flow;
  const colGap = Math.max(220, frame.w * 0.3);
  const layout = useMemo(
    () => iaLayout(pages, entry, flow, { w: frame.w, h: frame.h }, { colGap, rowGap: Math.max(180, frame.h * 0.32) }),
    [frameId, frame.w, frame.h, pages.join(), flow.length]
  );

  const fit = (only?: string) => {
    const el = canvasRef.current;
    if (!el || !layout) return;
    const rects = (only ? [only] : pages).map((p) => ({ ...layout.positions[p], w: frame.w, h: frame.h }));
    setCam(() => fitCamera(rects, { w: el.clientWidth, h: el.clientHeight }, only ? 120 : 80));
  };
  const zoomTo = (z: number) => {
    const el = canvasRef.current;
    if (el) setCam((c) => zoomAt(c, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, z));
  };
  api.current = { fit: () => fit(), zoomBy: (k) => { const el = canvasRef.current; if (el) setCam((c) => zoomAt(c, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, c.zoom * k)); }, zoomTo };
  useEffect(() => () => { api.current = null; }, []);
  useLayoutEffect(() => {
    if (!fitted.current && canvasRef.current) {
      fitted.current = true;
      fit(startPage);
    }
  });
  useWheel(canvasRef, setCam, live);

  // Escape closes the innermost thing first. Only when nothing is left does it fall through to the view, which leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') {
        const took = draft || openThread || live || tool === 'comment' || selected;
        if (!took) return;
        e.preventDefault();
        if (draft) setDraft(null);
        else if (openThread) setOpenThread(null);
        else if (live) setLive(null);
        else if (tool === 'comment') setTool('select');
        else setSelected(null);
        return;
      }
      if (typing) return;
      if (e.key === 'n' || e.key === 'c') setTool('comment');
      else if (e.key === 'v') setTool('select');
      else if (e.key === '!' || (e.shiftKey && e.key === '1')) fit();
      else if (e.key === 'Enter' && selected) onPage(selected);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const drag = useRef<null | { sx: number; sy: number; ox: number; oy: number }>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (!layout) return;
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

  const { w, h } = frame;
  const unlinkedTop = layout.unlinked.length ? layout.positions[layout.unlinked[0]] : null;
  const thread = s.notes.find((n) => n.id === openThread) ?? null;
  const threadAt = (() => {
    if (!thread) return null;
    if (thread.wx !== undefined) return { x: cam.x + thread.wx * cam.zoom, y: cam.y + (thread.wy ?? 0) * cam.zoom };
    const p = layout.positions[thread.page ?? entry];
    if (!p) return null;
    return { x: cam.x + (p.x + (thread.fx ?? 0) * w) * cam.zoom, y: cam.y + (p.y + Math.min(store.noteY(thread, h), h)) * cam.zoom };
  })();
  const col = (p: string) => Math.round(layout.positions[p].x / (w + colGap));

  return html`<div class="board map-board">
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
          await store.addNote({ boardId: board?.id ?? '', frameId: draft.frameId, page: draft.page, fx: draft.fx, py: draft.py, wx: draft.wx, wy: draft.wy, source: 'canvas', said: '', ...n });
          setDraft(null);
          setTool('select');
          store.toast('Note added.');
        }} />`}
        ${thread && threadAt && html`<${Thread} note=${thread} sx=${threadAt.x} sy=${threadAt.y} onClose=${() => setOpenThread(null)} />`}

        <div class="toolbar map-tools" onPointerDown=${(e: Event) => e.stopPropagation()}>
          <button type="button" class="btn icon" aria-label="Select tool" aria-pressed=${tool === 'select'} onClick=${() => setTool('select')} title="Select (V)"><${Icon} name="cursor" /></button>
          <button type="button" class="btn icon" aria-label="Pin a note on the page" aria-pressed=${tool === 'comment'} onClick=${() => setTool('comment')} title="Pin a note (N): click a page"><${Icon} name="comment" /></button>
          ${navigation.length > 0 && html`<span class="sep"></span>
          <div class="seg" role="group" aria-label="Links shown">
            <button type="button" aria-pressed=${!showNav} onClick=${() => setShowNav(false)} title="Links that move someone through the prototype">Flow</button>
            <button type="button" aria-pressed=${showNav} onClick=${() => setShowNav(true)} title=${`${navigation.length} links that most pages share, like a top nav`}>+ Nav links · ${navigation.length}</button>
          </div>`}
        </div>
      </div>
      ${selected && html`<${PageInspector} frame=${frame} page=${selected} onFocus=${() => onPage(selected)} onPick=${(p: string) => { setSelected(p); fit(p); }} onComment=${() => setTool('comment')} onOpenThread=${(n: Note) => setOpenThread(n.id)} />`}
    </div>`;
}

function PageInspector({ frame, page, onFocus, onPick, onComment, onOpenThread }: { frame: Frame; page: string; onFocus: () => void; onPick: (p: string) => void; onComment: () => void; onOpenThread: (n: Note) => void }) {
  const links = frame.links ?? [];
  const out = links.filter(([a]) => a === page).map(([, b]) => b);
  const into = links.filter(([, b]) => b === page).map(([a]) => a);
  const notes = store.notesOf(frame.id, page);
  const list = (items: string[], empty: string) =>
    items.length
      ? html`<div class="page-links">${items.map((p) => html`<button type="button" onClick=${() => onPick(p)}>${pageName(p)}<span class="mono faint">${p}</span></button>`)}</div>`
      : html`<p class="hint" style="margin:0">${empty}</p>`;
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec">
      <div class="label">Page</div>
      <div style="font-size:15px;font-weight:500">${pageName(page)}</div>
      <div class="mono faint" style="font-size:11.5px">${page}</div>
      <div class="row">
        <button type="button" class="btn primary" onClick=${onFocus}><${Icon} name="open" />Open</button>
        <a class="btn ghost" href=${previewUrl(frame, page)} target="_blank" rel="noopener"><${Icon} name="open" />Open in new tab</a>
      </div>
    </div>
    <div class="insp-sec"><div class="label">Links to · ${out.length}</div>${list(out, 'No links to other pages.')}</div>
    <div class="insp-sec"><div class="label">Linked from · ${into.length}</div>${list(into, page === frame.entry ? 'The entry page.' : 'Nothing links here. It may be orphaned.')}</div>
    <div class="insp-sec" style="border:0">
      <div class="label">Threads · ${notes.length}</div>
      ${notes.length === 0 && html`<p class="hint" style="margin:0">Press <kbd>N</kbd> and click this page, or use Note in the bottom bar.</p>`}
      ${notes.map((n) => html`<button type="button" class="thread-row" onClick=${() => onOpenThread(n)}><${NoteItem} note=${n} /></button>`)}
      ${notes.length > 0 && html`<button type="button" class="btn ghost" onClick=${onComment}><${Icon} name="comment" />Add a note</button>`}
    </div>
  </aside>`;
}
