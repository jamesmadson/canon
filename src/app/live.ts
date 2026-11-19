/**
 * The running version of a prototype made from code. A stored copy shows by
 * default; when the server it was built from answers, the person can switch
 * to the running version. The choice lives in this tab's memory and is never
 * stored. A link to a server on this machine says so when the server is off.
 */
import { useEffect, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame } from './db';
import { nameFromUrl, titleFromSameOrigin } from './lib/linkname';
import { html, Icon, frameSrc, SANDBOX } from './shared';
import { decideShown, hostsToProbe, loopbackHost, markOf, probeLoopback, serverOffMessage, type Reach, type Shown } from './lib/probe';
import { LIVE_HINT } from './lib/viewer';
import { record } from './lib/tester';

const running = new Set<string>(); // frame ids switched to the running version, this session only
const reach = new Map<string, 'up' | 'down'>(); // by host and port
const checking = new Set<string>();
const lastAt = new Map<string, number>(); // when each host was last asked, for the one-a-minute limit
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((fn) => fn());

export const isLive = (frameId: string) => running.has(frameId);

export function setLive(frameId: string, on: boolean) {
  if (on === running.has(frameId)) return;
  if (on) running.add(frameId);
  else running.delete(frameId);
  tell();
}

/** For tests: forget what was checked, and with all (the default) every switch and listener too. */
export function resetLive(all = true) {
  reach.clear();
  checking.clear();
  lastAt.clear();
  if (all) {
    running.clear();
    listeners.clear();
  }
}

/** Asks a loopback server once, and tells everyone watching when the answer changes. */
function check(url: string) {
  const host = loopbackHost(url);
  if (!host || checking.has(host)) return;
  checking.add(host);
  lastAt.set(host, Date.now());
  void probeLoopback(url).then((r) => {
    checking.delete(host);
    if (r === 'skipped' || reach.get(host) === r) return;
    reach.set(host, r);
    tell();
  });
}

function useChanges() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
}

/** Whether the server behind a localhost address answers. 'none' for any other address. Checked again when the tab regains focus. */
export function useReach(url: string | null | undefined): Reach {
  useChanges();
  const host = loopbackHost(url);
  useEffect(() => {
    if (!url || !host) return;
    check(url);
    const again = () => check(url);
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, [url]);
  return host ? (reach.get(host) ?? 'checking') : 'none';
}

/**
 * Home asks about the local servers its prototypes link to. It starts after
 * first paint, asks each host and port at most once a minute and never more
 * than 20 hosts at once, and only ever asks this machine.
 */
export function useHomeProbe(frames: Pick<Frame, 'kind' | 'url'>[]) {
  const key = frames.map((f) => (f.kind === 'url' ? loopbackHost(f.url) ?? '' : '')).join('|');
  useEffect(() => {
    const run = () => { for (const { url } of hostsToProbe(frames, lastAt, Date.now())) check(url); };
    const timer = setTimeout(run, 0);
    window.addEventListener('focus', run);
    return () => { clearTimeout(timer); window.removeEventListener('focus', run); };
  }, [key]);
}

/** The quiet label beside a prototype's name when it will not load right now: server off, or opens in a new tab. */
export function ReachNote({ frame }: { frame: Frame }) {
  useChanges();
  const host = frame.kind === 'url' ? loopbackHost(frame.url) : null;
  const mark = markOf(frame, host ? reach.get(host) ?? 'checking' : 'none');
  if (mark === 'server-off') return html`<span class="rnote" title=${serverOffMessage(frame.url!)}><i class="rdot" aria-hidden="true"></i>Server off</span>`;
  if (mark === 'new-tab') return html`<span class="rnote" title="This page refuses to load inside another page."><${Icon} name="open" size=${11} />Opens in a new tab</span>`;
  return null;
}

export function useLiveOn(frameId: string): boolean {
  useChanges();
  return running.has(frameId);
}

/** What this prototype's frame shows right now. */
export function useShown(f: Frame): Shown {
  const on = useLiveOn(f.id);
  const target = f.kind === 'url' ? f.url : on ? f.liveUrl : null;
  return decideShown(f, on, useReach(target));
}

/**
 * A link still named from its address takes the page's own title, when the page
 * is on the same origin as Canon and so can be read. Another origin is never read.
 * A name the person typed stays.
 */
export function adoptTitle(f: Frame, el: HTMLIFrameElement) {
  if (f.kind !== 'url' || !f.url || f.name !== nameFromUrl(f.url)) return;
  const title = titleFromSameOrigin(el, f.url, location.origin);
  if (title && title !== f.name) void store.updateFrame(f.id, { name: title });
}

/** In place of a frame whose server is not running. */
export function ServerOff({ url }: { url: string }) {
  return html`<div class="server-off" role="status"><p>${serverOffMessage(url)}</p></div>`;
}

/** The page inside a prototype's tile on the canvas: its stored copy, its running version, or a message. */
export function FrameBody({ frame }: { frame: Frame }) {
  const shown = useShown(frame);
  if (shown.show === 'wait') return null;
  if (shown.show === 'off') return html`<${ServerOff} url=${shown.url} />`;
  if (shown.show === 'live') return html`<iframe src=${shown.url} title=${frame.name} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  return html`<iframe src=${frameSrc(frame)} title=${frame.name} loading="lazy" sandbox=${frame.kind === 'url' ? 'allow-scripts allow-same-origin allow-forms allow-popups' : SANDBOX} onLoad=${(e: Event) => adoptTitle(frame, e.currentTarget as HTMLIFrameElement)}></iframe>`;
}

/** A rectangle switch in the prototype's panel. Offered only when the running version can be shown. */
export function LiveSwitch({ frame }: { frame: Frame }) {
  const on = useLiveOn(frame.id);
  const r = useReach(frame.kind === 'url' ? null : frame.liveUrl);
  if (frame.kind === 'url' || !frame.liveUrl) return null;
  // Not on this machine, nothing to check. On this machine, only while the server answers; once on it stays, so it can be switched off.
  if (!(on || r === 'up' || r === 'none')) return null;
  const hint = `hint-${frame.id}`;
  return html`<div class="insp-sec">
    <div class="label">Running version</div>
    <div class="seg live-seg"><button type="button" aria-pressed=${on} aria-describedby=${hint} onClick=${() => setLive(frame.id, !on)}>Live</button></div>
    <p class="hint insp-hint" id=${hint}>${LIVE_HINT} Not saved.</p>
  </div>`;
}

/** Whether to offer the Live switch: a stored copy with a live address, and a server that answers (or that is not on this machine, or Live is already on). */
export function useLiveOffer(frame: Frame): boolean {
  const on = useLiveOn(frame.id);
  const r = useReach(frame.kind === 'url' ? null : frame.liveUrl);
  if (frame.kind === 'url' || !frame.liveUrl) return false;
  return on || r === 'up' || r === 'none';
}

/** The same switch in the prototype view's bottom bar. Its description shows on hover and on keyboard focus. */
export function LiveToggle({ frame }: { frame: Frame }) {
  const on = useLiveOn(frame.id);
  const offered = useLiveOffer(frame);
  if (!offered) return null;
  const hint = `live-tip-${frame.id}`;
  return html`<span class="live-wrap">
    <button type="button" class="btn live-btn" aria-pressed=${on} aria-describedby=${hint} onClick=${() => { record('live_toggle', { on: !on }); setLive(frame.id, !on); }}>Live</button>
    <span class="tip" role="tooltip" id=${hint}>${LIVE_HINT}</span>
  </span>`;
}
