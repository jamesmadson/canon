/** The sidebar foot's two dialogs: Send feedback, and the Help test Canon panel for tester mode. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import * as store from './store';
import { FEEDBACK_URL, CANON_VERSION, failureMessage, issueUrl, payloadOf, postJson, type Fields } from './lib/feedback';
import { describeEvent, listEvents, record, setTester, stopAndDelete, subscribeTester, testerOn } from './lib/tester';
import { html } from './shared';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A dialog that keeps focus inside, closes on Escape and hands focus back to what opened it. */
export function Modal({ id, title, onClose, returnTo, children }: { id: string; title: string; onClose: () => void; returnTo: HTMLElement | null; children: ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = box.current?.querySelector<HTMLElement>('textarea, input, button');
    first?.focus();
    return () => { if (returnTo?.isConnected) returnTo.focus(); };
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !box.current.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !box.current.contains(active))) { e.preventDefault(); first.focus(); }
  };
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby=${id} ref=${box} onKeyDown=${onKey}>
      <h3 id=${id}>${title}</h3>
      ${children}
    </div>
  </div>`;
}

export function useTester() {
  const [, force] = useState(0);
  useEffect(() => subscribeTester(() => force((n) => n + 1)), []);
  return { on: testerOn(), events: listEvents() };
}

/* ── Send feedback ─────────────────────────────────────────────────────── */
export function FeedbackDialog({ onClose, returnTo, onSeeList, url = FEEDBACK_URL }: { onClose: () => void; returnTo: HTMLElement | null; onSeeList: () => void; url?: string }) {
  const { on } = useTester();
  const [f, setF] = useState<Fields>({ tried: '', happened: '', email: '' });
  const [withSession, setWithSession] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const tried = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { record('feedback_open'); }, []);
  const set = (k: keyof Fields) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!f.tried.trim()) {
      setProblem('Say what you were trying to do, so the report makes sense.');
      tried.current?.focus();
      return;
    }
    if (!url) {
      window.open(issueUrl(f), '_blank', 'noopener');
      return;
    }
    setBusy(true);
    setProblem('');
    const extra = on && withSession ? { session: listEvents().map(describeEvent) } : {};
    const r = await postJson(url, payloadOf(f, extra));
    setBusy(false);
    if (r.ok) {
      record('feedback_sent');
      store.toast('Thanks. Your feedback was sent.');
      onClose();
    } else setProblem(failureMessage(r));
  };

  return html`<${Modal} id="fb-title" title="Send feedback" onClose=${onClose} returnTo=${returnTo}>
    <form class="fb-form" onSubmit=${submit} noValidate>
      <label class="fb-label" for="fb-tried">What were you trying to do?</label>
      <textarea id="fb-tried" ref=${tried} class="field" rows="3" required aria-required="true" aria-invalid=${problem && !f.tried.trim() ? 'true' : undefined} aria-describedby=${problem ? 'fb-problem' : undefined} value=${f.tried} onInput=${set('tried')}></textarea>
      <label class="fb-label" for="fb-happened">What happened?</label>
      <textarea id="fb-happened" class="field" rows="3" value=${f.happened} onInput=${set('happened')}></textarea>
      ${url && html`<label class="fb-label" for="fb-email">Email, if you want a reply</label>
      <input id="fb-email" class="field" type="email" autocomplete="email" value=${f.email} onInput=${set('email')} />`}
      <p class="soft fb-line">This sends only what you typed here, plus Canon's version.</p>
      ${on && html`<div class="fb-session">
        <label class="fb-check"><input type="checkbox" checked=${withSession} onChange=${(e: Event) => setWithSession((e.target as HTMLInputElement).checked)} />Include my session list</label>
        <button type="button" class="link" onClick=${onSeeList}>See what is in it</button>
      </div>`}
      ${problem && html`<p id="fb-problem" class="fb-problem" role="alert">${problem}</p>`}
      <div class="row fb-actions">
        <button type="button" class="btn ghost" onClick=${onClose}>Cancel</button>
        <button type="submit" class="btn primary" disabled=${busy}>${url ? (busy ? 'Sending' : 'Send') : 'Open a GitHub issue'}</button>
      </div>
      ${!url && html`<p class="hint fb-line">This opens GitHub in a new tab. Issues there are public, so your email is left out.</p>`}
    </form>
  <//>`;
}

/* ── Help test Canon ───────────────────────────────────────────────────── */
function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function TesterPanel({ onClose, returnTo, url = FEEDBACK_URL }: { onClose: () => void; returnTo: HTMLElement | null; url?: string }) {
  const { on, events } = useTester();
  const [note, setNote] = useState('');
  const lines = events.map(describeEvent);
  const sendable = () => ({ _subject: 'Canon tester session', _gotcha: '', canon_version: CANON_VERSION, session: lines });

  const send = async () => {
    setNote('');
    const r = await postJson(url, sendable());
    setNote(r.ok ? 'Sent. Thank you.' : failureMessage(r).replace(' What you typed is still here.', ' Your list is still here.'));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); setNote('Copied.'); } catch { setNote('Copying did not work. Use Download as a file instead.'); }
  };
  const saveFile = () => download('canon-session.json', JSON.stringify({ canon_version: CANON_VERSION, events: [...events].reverse() }, null, 2));
  const stop = () => {
    if (confirm('Stop keeping the list and delete it from this browser? This cannot be undone.')) { stopAndDelete(); onClose(); }
  };

  return html`<${Modal} id="tester-title" title="Help test Canon" onClose=${onClose} returnTo=${returnTo}>
    <ul class="tester-says">
      <li>Canon notes what you do, such as opening a prototype or searching, as counts and times. Never names, links or anything you type.</li>
      <li>The list stays in this browser.</li>
      <li>Nothing is sent unless you press Send.</li>
    </ul>
    <label class="fb-check"><input type="checkbox" role="switch" checked=${on} onChange=${(e: Event) => setTester((e.target as HTMLInputElement).checked)} />Keep a list of what I do</label>
    ${on || events.length ? html`<ol class="session-list" aria-label="Your session list, newest first" tabindex="0">
      ${lines.length === 0 ? html`<li class="faint">Nothing yet.</li>` : lines.map((l, i) => html`<li key=${i}>${l}</li>`)}
    </ol>` : null}
    ${note && html`<p class="hint" role="status">${note}</p>`}
    <div class="row fb-actions">
      ${events.length > 0 && html`<button type="button" class="btn ghost danger" onClick=${stop}>Stop and delete the list</button>`}
      <span class="spacer"></span>
      ${events.length > 0 && html`<button type="button" class="btn" onClick=${saveFile}>Download as a file</button>`}
      ${events.length > 0 && !url && html`<button type="button" class="btn" onClick=${copy}>Copy</button>`}
      ${events.length > 0 && url && html`<button type="button" class="btn primary" onClick=${send}>Send my session</button>`}
      <button type="button" class="btn ghost" onClick=${onClose}>Close</button>
    </div>
  <//>`;
}

/** The two links at the foot of the sidebar, and the dialogs they open. */
export function FeedbackFoot() {
  const { on } = useTester();
  const [open, setOpen] = useState<null | 'feedback' | 'tester'>(null);
  const back = useRef<HTMLElement | null>(null);
  const show = (which: 'feedback' | 'tester') => { back.current = document.activeElement as HTMLElement; setOpen(which); };
  return html`<div class="foot-links">
    <button type="button" onClick=${() => show('feedback')}>Send feedback</button>
    ${on
      ? html`<button type="button" class="keeping" onClick=${() => show('tester')}><i aria-hidden="true"></i>Keeping a list</button>`
      : html`<button type="button" onClick=${() => show('tester')}>Help test Canon</button>`}
    ${open === 'feedback' && html`<${FeedbackDialog} onClose=${() => setOpen(null)} returnTo=${back.current} onSeeList=${() => setOpen('tester')} />`}
    ${open === 'tester' && html`<${TesterPanel} onClose=${() => setOpen(null)} returnTo=${back.current} />`}
  </div>`;
}
