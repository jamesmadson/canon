import { useState } from 'preact/hooks';
import * as store from './store';
import type { Note } from './db';
import { initials, personColor } from './lib/library';
import { html, Icon, ago, pageName } from './shared';

/** Where a new thread will go, plus where on screen to open the composer. */
export type Draft = { frameId?: string; page?: string; fx?: number; py?: number; wx?: number; wy?: number; sx: number; sy: number };

export const isComment = (n: Note) => n.kind === 'comment';
const authorOf = (n: Note) => n.author || 'You';

export const Avatar = ({ name, size = 22 }: { name: string; size?: number }) =>
  html`<span class="avatar" style=${{ width: size, height: size, background: personColor(name), fontSize: size * 0.42 }}>${initials(name)}</span>`;

/** Comments are round with the author's initials, Figma style; older notes without an author are numbered. */
export function Pin({ n, note, left, top, active, onOpen }: { n: number; note: Note; left: number; top: number; active?: boolean; onOpen: () => void }) {
  const comment = isComment(note);
  const cls = `pin${comment ? ' comment' : ''}${note.source === 'preview' && !comment ? ' from-preview' : ''}${note.resolved ? ' resolved' : ''}${active ? ' active' : ''}`;
  const style = comment ? { left, top, background: personColor(authorOf(note)) } : { left, top };
  return html`<button class=${cls} style=${style} title=${note.said}
    onPointerDown=${(e: Event) => { e.stopPropagation(); onOpen(); }}>${comment ? initials(authorOf(note)) : n}${(note.replies?.length ?? 0) > 0 && html`<i>${note.replies!.length + 1}</i>`}</button>`;
}

function NameField({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  return html`<div class="name-ask">
    <div class="label">First, your name</div>
    <div class="row" style="flex-wrap:nowrap">
      <input class="field" autofocus placeholder="How teammates see you" value=${name} onInput=${(e: Event) => setName((e.target as HTMLInputElement).value)}
        onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && name.trim() && (e.preventDefault(), store.setMyName(name), onDone())} />
      <button type="button" class="btn primary" disabled=${!name.trim()} onClick=${() => { store.setMyName(name); onDone(); }}>Save</button>
    </div>
  </div>`;
}

/** New note. */
export function Composer({ at, onCancel, onSave }: { at: Draft; onCancel: () => void; onSave: (n: Pick<Note, 'said' | 'kind' | 'author'>) => void }) {
  const [body, setBody] = useState('');
  const [, bump] = useState(0);
  const me = store.myName();
  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!body.trim()) return;
    onSave({ kind: 'comment', author: me || 'You', said: body.trim() });
  };
  return html`<form class="composer" style=${{ left: Math.max(12, at.sx + 16), top: Math.max(12, at.sy - 20) }} onSubmit=${submit} onPointerDown=${(e: Event) => e.stopPropagation()}>
    ${!me && html`<${NameField} onDone=${() => bump((n) => n + 1)} />`}
    <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
      <${Avatar} name=${me || 'You'} />
      <textarea class="field" rows="3" autofocus placeholder="Add a note" value=${body}
        onInput=${(e: Event) => setBody((e.target as HTMLTextAreaElement).value)}
        onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}></textarea>
    </div>
    <div class="row"><span class="hint" style="margin-right:auto">Enter to post</span><button type="button" class="btn ghost" onClick=${onCancel}>Cancel</button><button class="btn primary" disabled=${!body.trim()}>Post</button></div>
  </form>`;
}

/** A thread: the first message, replies, a reply box, resolve. */
export function Thread({ note, sx, sy, onClose }: { note: Note; sx: number; sy: number; onClose: () => void }) {
  const [text, setText] = useState('');
  const send = async (e?: Event) => {
    e?.preventDefault();
    if (!text.trim()) return;
    if (!store.myName()) store.setMyName('You');
    await store.reply(note.id, text);
    setText('');
  };
  return html`<div class="thread" style=${{ left: Math.max(12, sx + 18), top: Math.max(12, sy - 24) }} onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="thread-head">
      <span class="label">Note</span>
      <span class="spacer"></span>
      <button class="btn ghost icon" title=${note.resolved ? 'Reopen' : 'Resolve'} onClick=${() => store.setResolved(note.id, !note.resolved)}>${note.resolved ? html`<${Icon} name="refresh" />` : html`<${Icon} name="check" />`}</button>
      <button class="btn ghost icon" title="Delete thread" onClick=${() => confirm('Delete this thread?') && (store.deleteNote(note.id), onClose())}><${Icon} name="trash" /></button>
      <button class="btn ghost icon" title="Close (Esc)" onClick=${onClose}><${Icon} name="x" /></button>
    </div>
    <div class="msg">
      <${Avatar} name=${authorOf(note)} />
      <div>
        <div class="msg-meta"><b>${authorOf(note)}</b><span>${ago(note.createdAt)}</span>${note.page && html`<span>${pageName(note.page)}</span>`}</div>
        <p>${note.said}</p>
      </div>
    </div>
    ${(note.replies ?? []).map((r) => html`<div class="msg"><${Avatar} name=${r.author} /><div><div class="msg-meta"><b>${r.author}</b><span>${ago(r.createdAt)}</span></div><p>${r.body}</p></div></div>`)}
    ${note.resolved && html`<div class="hint" style="padding:0 2px">Resolved. Reopen to pick it back up.</div>`}
    <form class="reply" onSubmit=${send}>
      <${Avatar} name=${store.myName() || 'You'} />
      <input class="field" placeholder="Reply" value=${text} onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} />
      <button class="btn primary" disabled=${!text.trim()}>Reply</button>
    </form>
  </div>`;
}

/** The comments sidebar: every thread on this surface, open first. */
export function CommentsPanel({ notes, onPick, onClose }: { notes: Note[]; onPick: (n: Note) => void; onClose: () => void }) {
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const list = notes.filter((n) => (show === 'open' ? !n.resolved : n.resolved)).sort((a, b) => b.createdAt - a.createdAt);
  const frames = store.getState().frames;
  return html`<aside class="inspector" onPointerDown=${(e: Event) => e.stopPropagation()}>
    <div class="insp-sec" style="flex-direction:row;align-items:center">
      <div class="label" style="flex:1">Notes</div>
      <div class="seg"><button aria-pressed=${show === 'open'} onClick=${() => setShow('open')}>Open</button><button aria-pressed=${show === 'resolved'} onClick=${() => setShow('resolved')}>Resolved</button></div>
      <button class="btn ghost icon" onClick=${onClose} title="Close"><${Icon} name="x" /></button>
    </div>
    <div class="insp-sec" style="border:0;gap:8px">
      ${list.length === 0 && html`<p class="hint" style="margin:0">${show === 'open' ? 'No open threads. Press C and click anywhere to start one.' : 'Nothing resolved yet.'}</p>`}
      ${list.map((n) => {
        const f = frames.find((x) => x.id === n.frameId);
        return html`<button class="thread-row" onClick=${() => onPick(n)}>
          <${Avatar} name=${authorOf(n)} />
          <span class="thread-row-body">
            <span class="msg-meta"><b>${authorOf(n)}</b><span>${ago(n.createdAt)}</span></span>
            <span class="thread-row-text">${n.said}</span>
            <span class="faint" style="font-size:11.5px">${f ? f.name : 'On the canvas'}${(n.replies?.length ?? 0) > 0 ? ` · ${n.replies!.length} ${n.replies!.length === 1 ? 'reply' : 'replies'}` : ''}</span>
          </span>
        </button>`;
      })}
    </div>
  </aside>`;
}
