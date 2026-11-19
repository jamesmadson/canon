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
import { FRAME_BLOCKED, clampZoom, fitZoom, neighbour, typingIn, versionTitle } from './lib/viewer';
import { PrototypeBar } from './bar';
import { PageMap, START_CAMERA, type MapApi } from './map';
import { chooseView, isMulti, takeStartPage, viewOf, type PageView } from './lib/pageview';
import type { Camera } from './lib/layout';
import { record } from './lib/tester';
import { ServerOff, adoptTitle, useShown } from './live';
import { html, Icon, useStore, frameSrc, pageName, previewUrl, SANDBOX, SIZES } from './shared';

export type FullAddress = Extract<Address, { name: 'full' }>;

/** Open a prototype from anywhere in the app. Back returns to where the person was. */
export const openPrototype = (f: Pick<Frame, 'id'>) => openHash(buildAddress({ name: 'full', frame: f.id, board: null, width: null, path: null }));

/** In place of a page that says it cannot be shown inside another page. */
function Blocked({ href }: { href: string }) {
  return html`<div class="frame-blocked" role="status">
    <h2>${FRAME_BLOCKED}</h2>
    <p>Canon shows a link to it instead, so open it in a new tab. To see it here, add a build folder or a zip as another version, and Canon keeps a copy that shows inside it.</p>
    <a class="btn primary" href=${href} target="_blank" rel="noopener" onClick=${() => record('open_new_tab')}><${Icon} name="open" />Open in new tab</a>
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
  const [cam, setCam] = useState<Camera>(START_CAMERA);
  const [, bump] = useState(0);
  const map = useRef<MapApi | null>(null);
  const fromMap = useRef(false);
  const startPage = useRef<string | undefined>(undefined);
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
  const multi = isMulti(here);
  const view: PageView = multi ? viewOf(here) : 'page';
  const choose = (v: PageView) => { chooseView(here, v); fromMap.current = false; bump((n) => n + 1); };
  if (multi && view === 'map' && startPage.current === undefined) startPage.current = takeStartPage(here.id) ?? '';
  // A page picked in the map opens in the page view, and Back from it returns to the map.
  const pickPage = (p: string) => { setPg(p); chooseView(here, 'page'); fromMap.current = true; bump((n) => n + 1); };
  const goBack = () => {
    if (fromMap.current && multi && viewOf(here) === 'page') choose('map');
    else onClose();
  };
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
  }, [view]);
  const z = manual ?? fitZoom(width, room);

  // Every hint that applies goes in one line under the frame, whose room is always kept, so the frame never moves when one comes or goes.
  const wayOut = here.kind === 'url' && !known && shown.show !== 'off';
  const hints = [
    !isCurrent && `This is ${versionTitle(n, total).toLowerCase()}, not the current version. Use Versions, below, to make it the current one.`,
    address && here.kind === 'url' && !isCurrent && isLocal(here.url ?? '') && `This is localhost, so it shows what is running now, not version ${n}.`,
    wayOut && html`Blank? Some sites refuse to load inside other pages. <a href=${newTab} target="_blank" rel="noopener" onClick=${() => record('open_new_tab')}>Open in new tab</a>.`,
  ].filter(Boolean);

  const prev = neighbour(stack, here.id, -1);
  const next = neighbour(stack, here.id, 1);
  const step = (to: Frame | undefined, dir: 'prev' | 'next') => {
    if (!to) return;
    record('version_step', { dir });
    show(to.id);
  };
  const keys = useRef({ onClose: goBack, prev, next, step });
  keys.current = { onClose: goBack, prev, next, step };

  // How long the frame took to load, noted once per prototype shown. A page known to refuse framing never loads, so it is noted at once.
  const opening = useRef({ id: '', t0: 0, done: true });
  const noteOpen = (ms?: number) => {
    const o = opening.current;
    if (o.done) return;
    o.done = true;
    record('prototype_open', { kind: here.kind === 'url' ? 'link' : 'stored', blocked: known, ...(ms === undefined ? {} : { ms }) });
  };
  useEffect(() => {
    opening.current = { id: here.id, t0: performance.now(), done: false };
    if (known) noteOpen();
    return () => noteOpen();
  }, [here.id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = keys.current;
      if (e.key === 'Escape') now.onClose();
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typingIn(e.target)) {
        const left = e.key === 'ArrowLeft';
        if (left ? now.prev : now.next) { e.preventDefault(); now.step(left ? now.prev : now.next, left ? 'prev' : 'next'); }
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

  const pageName_ = view === 'page' && pg && pg !== here.entry ? pageName(pg) : '';
  return html`<div class="focus" role="region" aria-label=${here.name}>
    <div class="focus-panel">
    <div class="topbar">
      <h1 class="sr">${here.name}${pageName_ ? html`<span> · ${pageName_}</span>` : ''}${total > 1 && html`<span class="ver-title" aria-live="polite"> ${versionTitle(n, total)}</span>`}</h1>
      <button type="button" class="btn back" onClick=${goBack} title="Back (Esc)"><${Icon} name="back" />Back</button>
      <span class="spacer"></span>
      ${multi && html`<div class="seg" role="group" aria-label="View">
        <button type="button" aria-pressed=${view === 'page'} onClick=${() => choose('page')}>Page</button>
        <button type="button" aria-pressed=${view === 'map'} onClick=${() => choose('map')}>Map</button>
      </div>`}
      ${multi && html`<select class=${`select${view === 'map' ? ' away' : ''}`} aria-label="Page" inert=${view === 'map'} value=${pg ?? here.entry} onChange=${(e: Event) => setPg((e.target as HTMLSelectElement).value)}>
        ${(here.pages ?? []).map((p) => html`<option value=${p} selected=${p === (pg ?? here.entry)}>${pageName(p)}</option>`)}
      </select>`}
      <div class=${`seg${view === 'map' ? ' away' : ''}`} role="group" aria-label="Width" inert=${view === 'map'}>
        ${SIZES.map((sz) => html`<button type="button" aria-pressed=${width === sz.w} onClick=${() => { setManual(null); setWidth(sz.w); }}>${sz.name}<span class="w"> ${sz.w}</span></button>`)}
        <button type="button" aria-pressed=${width === null} onClick=${() => { setManual(null); setWidth(null); }}>Fill</button>
      </div>
      <span class="spacer"></span>
      ${address && html`<button type="button" class="btn" aria-label="Copy link" title="Copy link" onClick=${copy}><${Icon} name="link" /><span class="lbl">Copy link</span></button>`}
      <a class="btn" href=${newTab} target="_blank" rel="noopener" aria-label="Open in new tab" title="Open in new tab" onClick=${() => record('open_new_tab')}><span class="lbl">Open in new tab</span><${Icon} name="open" /></a>
    </div>
    ${view === 'map'
      ? html`<div class="focus-stage map-stage"><${PageMap} key=${here.id} frame=${here} cam=${cam} setCam=${(fn: (c: Camera) => Camera) => setCam(fn)} api=${map} startPage=${startPage.current || undefined} onPage=${pickPage} /></div>`
      : html`<div class="focus-stage" ref=${stage}>
      ${shown.show === 'off'
        ? html`<${ServerOff} url=${shown.url} />`
        : known
          ? html`<${Blocked} href=${newTab} />`
          : shown.show === 'wait'
            ? null
            : html`<div class="focus-frame" style=${{ width: width ? `${width * z}px` : '100%' }}>
              <iframe key=${src} src=${src} title=${here.name} style=${{ width: inner, height: `${100 / z}%`, transform: `scale(${z})` }} sandbox=${SANDBOX} onLoad=${(e: Event) => { noteOpen(Math.round(performance.now() - opening.current.t0)); adoptTitle(here, e.currentTarget as HTMLIFrameElement); }}></iframe>
            </div>`}
    </div>`}
    <p class="hint view-note view-hints" role="status">${hints.map((h, i) => html`${i ? ' ' : ''}${h}`)}</p>
    <${PrototypeBar} frame=${here} stack=${stack} onShow=${show} page=${pageName_} zoom=${view === 'map'
      ? { value: cam.zoom, onOut: () => map.current?.zoomBy(0.8), onIn: () => map.current?.zoomBy(1.25), onReset: () => map.current?.zoomTo(1), onFit: () => map.current?.fit() }
      : { value: z, onOut: () => zoomBy(0.8), onIn: () => zoomBy(1.25), onReset: () => setManual(1), onFit: fit }} />
    </div>
  </div>`;
}
