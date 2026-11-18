/**
 * The prototype view: one prototype, full size, with every control that
 * belongs to it. Home, a project, search and a link from an agent all open
 * it. The board canvas and the page map open it too, over themselves.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame } from './db';
import { type Address, buildAddress, joinPath } from './lib/address';
import { leave, openHash, replaceAddress } from './lib/nav';
import { currentOf, isLocal, versionOf } from './lib/versions';
import { safeFrameUrl } from './lib/resolve';
import { FRAME_BLOCKED, NOT_SHOWING_AFTER_MS, clampZoom, fitZoom, neighbour, typingIn, versionTitle } from './lib/viewer';
import { PrototypeBar } from './bar';
import { ServerOff, useShown } from './live';
import { html, Icon, useStore, frameSrc, pageCount, pageName, previewUrl, SANDBOX, SIZES } from './shared';

export type FullAddress = Extract<Address, { name: 'full' }>;

/** Open a prototype from anywhere in the app. Back returns to where the person was. */
export const openPrototype = (f: Pick<Frame, 'id'>) => openHash(buildAddress({ name: 'full', frame: f.id, board: null, width: null, path: null }));

/** In place of a page that says it cannot be shown inside another page. */
function Blocked({ frame, href }: { frame: Frame; href: string }) {
  return html`<div class="frame-blocked" role="status">
    <h2>${FRAME_BLOCKED}</h2>
    <p>Canon shows a link to it instead, so open it in a new tab. To see it here, add a build folder or a zip as another version, and Canon keeps a copy that shows inside it.</p>
    <a class="btn primary" href=${href} target="_blank" rel="noopener"><${Icon} name="open" />Open in new tab</a>
  </div>`;
}

export function PrototypeView({ address }: { address: FullAddress }) {
  const s = useStore();
  const frame = s.frames.find((f) => f.id === address.frame);
  if (!s.ready) return html`<div class="main"></div>`;
  if (!frame) return html`<div class="focus"><div class="empty">That prototype is not in this browser. <a href="#/">All projects</a></div></div>`;
  return html`<${Focus} frame=${frame} address=${address} onClose=${() => leave(buildAddress({ name: 'project', project: frame.projectId, tab: 'prototypes' }))} />`;
}

/**
 * With an address, the view is a link: its width, path and version live in
 * the hash and change it in place, so Back leaves the view rather than
 * stepping through widths. Without one (the page map) it keeps its own state.
 */
export function Focus({ frame, page, onClose, address }: { frame: Frame; page?: string; onClose: () => void; address?: FullAddress }) {
  useStore();
  const [localWidth, setLocalWidth] = useState<number | null>(frame.w);
  const [localId, setLocalId] = useState(frame.id);
  const [pg, setPg] = useState(page);
  const [manual, setManual] = useState<number | null>(null);
  const [room, setRoom] = useState(0);
  const [slow, setSlow] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const fid = address ? frame.id : localId;
  const here = store.getState().frames.find((f) => f.id === fid) ?? frame;
  const stack = store.stackOf(here.id);
  const n = versionOf(stack, here.id);
  const total = stack.length;
  const current = total ? currentOf(stack) : here;
  const isCurrent = total < 2 || current.id === here.id;
  const width = address ? (address.width === 'fill' ? null : address.width ?? here.w) : localWidth;
  const setWidth = (w: number | null) => (address ? replaceAddress({ ...address, width: w ?? 'fill' }) : setLocalWidth(w));
  const show = (id: string) => (address ? replaceAddress({ ...address, frame: id }) : setLocalId(id));

  const shown = useShown(here);
  const multi = pageCount(here) > 1 && here.kind !== 'url';
  const src = shown.show === 'live' ? shown.url : address && here.kind === 'url' ? joinPath(safeFrameUrl(here.url), address.path) : frameSrc(here, pg);
  const newTab = here.kind === 'url' ? safeFrameUrl(here.url) : previewUrl(here, pg);
  const known = shown.show === 'link' && here.kind === 'url' && here.frameBlocked === true;
  const remote = shown.show === 'link' || shown.show === 'live';

  // The room the page has, so a wide page fits until the person picks a size.
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setRoom(Math.max(0, el.clientWidth - 40)));
    ro.observe(el);
    setRoom(Math.max(0, el.clientWidth - 40));
    return () => ro.disconnect();
  }, []);
  const z = manual ?? fitZoom(width, room);

  // Nothing says a page refused to load, so say only that it may have, and only after a pause.
  const loaded = useRef(false);
  useEffect(() => {
    loaded.current = false;
    setSlow(false);
    if (!remote || known) return;
    const t = setTimeout(() => !loaded.current && setSlow(true), NOT_SHOWING_AFTER_MS);
    return () => clearTimeout(t);
  }, [src, remote, known]);

  const prev = neighbour(stack, here.id, -1);
  const next = neighbour(stack, here.id, 1);
  const keys = useRef({ onClose, prev, next, show });
  keys.current = { onClose, prev, next, show };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = keys.current;
      if (e.key === 'Escape') now.onClose();
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typingIn(e.target)) {
        const to = e.key === 'ArrowLeft' ? now.prev : now.next;
        if (to) { e.preventDefault(); now.show(to.id); }
      }
    };
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
  const zoomBy = (f: number) => setManual(clampZoom(z * f));
  const fit = () => setManual(null);
  const inner = width ? `${width}px` : `${100 / z}%`;

  return html`<div class="focus" role="region" aria-label=${here.name}>
    <div class="topbar">
      <button type="button" class="btn ghost icon" aria-label="Back" onClick=${onClose} title="Back (Esc)"><${Icon} name="back" /></button>
      <h1>${here.name}${pg && pg !== here.entry ? html`<span class="faint"> · ${pageName(pg)}</span>` : ''}${total > 1 && html`<span class="ver-title" aria-live="polite">${versionTitle(n, total)}</span>`}</h1>
      ${total > 1 && html`<div class="bar-group" role="group" aria-label="Step through versions">
        <button type="button" class="btn ghost icon" disabled=${!prev} aria-label="Previous version" title="Previous version (Left arrow)" onClick=${() => prev && show(prev.id)}><${Icon} name="back" /></button>
        <button type="button" class="btn ghost icon next" disabled=${!next} aria-label="Next version" title="Next version (Right arrow)" onClick=${() => next && show(next.id)}><${Icon} name="back" /></button>
      </div>`}
      <span class="spacer"></span>
      ${multi && html`<select class="select" aria-label="Page" value=${pg ?? here.entry} onChange=${(e: Event) => setPg((e.target as HTMLSelectElement).value)}>
        ${(here.pages ?? []).map((p) => html`<option value=${p} selected=${p === (pg ?? here.entry)}>${pageName(p)}</option>`)}
      </select>
      <a class="btn ghost" href=${buildAddress({ name: 'bundle', frame: here.id, from: null, page: null })}><${Icon} name="pages" />Page map</a>`}
      <div class="seg" role="group" aria-label="Width">
        ${SIZES.map((sz) => html`<button type="button" aria-pressed=${width === sz.w} onClick=${() => { setManual(null); setWidth(sz.w); }}>${sz.name} ${sz.w}</button>`)}
        <button type="button" aria-pressed=${width === null} onClick=${() => { setManual(null); setWidth(null); }}>Fill</button>
      </div>
      ${address && html`<button type="button" class="btn ghost" onClick=${copy}><${Icon} name="link" />Copy link</button>`}
      <a class="btn ghost" href=${newTab} target="_blank" rel="noopener"><${Icon} name="open" />Open in new tab</a>
    </div>
    ${!isCurrent && html`<p class="hint view-note" role="status">This is ${versionTitle(n, total).toLowerCase()}, not the current version. Use Versions, below, to make it the current one.</p>`}
    ${address && here.kind === 'url' && !isCurrent && isLocal(here.url ?? '') && html`<p class="hint view-note" role="status">This is localhost, so it shows what is running now, not version ${n}.</p>`}
    <div class="focus-stage" ref=${stage}>
      ${shown.show === 'off'
        ? html`<${ServerOff} url=${shown.url} />`
        : known
          ? html`<${Blocked} frame=${here} href=${newTab} />`
          : shown.show === 'wait'
            ? null
            : html`<div class="focus-frame" style=${{ width: width ? `${width * z}px` : '100%' }}>
              <iframe key=${src} src=${src} title=${here.name} style=${{ width: inner, height: `${100 / z}%`, transform: `scale(${z})` }} sandbox=${SANDBOX} onLoad=${() => { loaded.current = true; setSlow(false); }}></iframe>
            </div>`}
    </div>
    ${slow && html`<p class="hint view-note slow" role="status">Not showing? Some sites refuse to load inside other pages. <a href=${newTab} target="_blank" rel="noopener">Open in new tab</a>.</p>`}
    <${PrototypeBar} frame=${here} stack=${stack} onShow=${show} zoom=${{ value: z, onOut: () => zoomBy(0.8), onIn: () => zoomBy(1.25), onReset: () => setManual(1), onFit: fit }} />
  </div>`;
}
