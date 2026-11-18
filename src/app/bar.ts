/** The bottom bar's own controls: star, note and archive for a prototype, its versions, the Live switch and zoom. The canvas and the prototype view share them. */
import { useEffect, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame } from './db';
import { html, Icon } from './shared';
import { currentOf, versionOf } from './lib/versions';
import { versionLine, versionTitle } from './lib/viewer';
import { LiveToggle } from './live';

const NONE = 'select a prototype first';

export function PrototypeActions({ frame }: { frame: Frame | undefined }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const live = useRef({ open, draft });
  live.current = { open, draft };

  // A different prototype closes the note and keeps what was typed for the one it belonged to.
  useEffect(() => {
    const id = frame?.id;
    const saved = frame?.note ?? '';
    return () => {
      if (id && live.current.open && live.current.draft !== saved) void store.setNote(id, live.current.draft.trim());
      setOpen(false);
    };
  }, [frame?.id]);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);

  const name = frame?.name ?? '';
  const noteText = frame?.note ?? '';
  const toggleNote = () => {
    if (!frame) return;
    if (open) return close(true);
    setDraft(noteText);
    setOpen(true);
  };
  const close = (save: boolean) => {
    if (save && frame && draft.trim() !== noteText) void store.setNote(frame.id, draft.trim());
    setOpen(false);
    button.current?.focus();
  };
  const star = () => frame && store.setStarred(frame.id, !frame.starred);
  const archive = async () => {
    if (!frame) return;
    const next = !frame.archived;
    await store.setArchived(frame.id, next);
    store.toast(next ? `Archived ${frame.name}. It is out of Home and the project list until you bring it back.` : `${frame.name} is back in Home and the project list.`);
  };

  return html`<div class="bar-group" role="group" aria-label="Prototype">
    <button type="button" class="btn icon" disabled=${!frame} aria-pressed=${!!frame?.starred} aria-label=${frame ? `Star ${name}` : `Star: ${NONE}`} title=${frame ? 'Star' : `Star: ${NONE}`} onClick=${star}><${Icon} name="star" fill=${!!frame?.starred} /></button>
    <div class="bar-note">
      <button type="button" ref=${button} class="btn icon" disabled=${!frame} aria-expanded=${open} aria-haspopup="dialog" aria-label=${frame ? `Prototype note for ${name}${noteText ? ', has text' : ''}` : `Prototype note: ${NONE}`} title=${frame ? 'Prototype note' : `Prototype note: ${NONE}`} onClick=${toggleNote}>
        <${Icon} name="note" />${noteText && html`<i class="badge" aria-hidden="true"></i>`}
      </button>
      ${open && frame && html`<div class="bar-pop" role="dialog" aria-label=${`Prototype note for ${name}`}>
        <label class="sr" for="proto-note">Prototype note for ${name}</label>
        <textarea id="proto-note" ref=${field} class="field" rows="4" placeholder="A note on this prototype, for you and your agent" value=${draft}
          onInput=${(e: Event) => setDraft((e.target as HTMLTextAreaElement).value)}
          onKeyDown=${(e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(true); }
          }}></textarea>
        <div class="row"><button type="button" class="btn ghost" onClick=${() => close(false)}>Cancel</button><button type="button" class="btn" onClick=${() => close(true)}>Save</button></div>
      </div>`}
    </div>
    <button type="button" class="btn icon" disabled=${!frame} aria-pressed=${!!frame?.archived} aria-label=${frame ? `Archive ${name}` : `Archive: ${NONE}`} title=${frame ? 'Archive' : `Archive: ${NONE}`} onClick=${archive}><${Icon} name="archive" /></button>
  </div>`;
}

export function ZoomControls({ zoom, onOut, onIn, onReset, onFit }: { zoom: number; onOut?: () => void; onIn?: () => void; onReset?: () => void; onFit: () => void }) {
  const pct = `${Math.round(zoom * 100)}%`;
  return html`<div class="bar-group" role="group" aria-label="Zoom">
    ${onOut && html`<button type="button" class="btn icon" aria-label="Zoom out" title="Zoom out (-)" onClick=${onOut}><${Icon} name="minus" /></button>`}
    <button type="button" class="btn zoom" aria-label=${`Zoom ${pct}${onReset ? ', press for 100%' : ', press to fit'}`} title=${onReset ? 'Zoom to 100%' : 'Fit (Shift+1)'} onClick=${onReset ?? onFit}>${pct}</button>
    ${onIn && html`<button type="button" class="btn icon" aria-label="Zoom in" title="Zoom in (+)" onClick=${onIn}><${Icon} name="plus" /></button>`}
    <button type="button" class="btn icon" aria-label="Fit everything" title="Fit everything (Shift+1)" onClick=${onFit}><${Icon} name="fit" /></button>
  </div>`;
}

/**
 * Every version of a prototype, newest first, with its date and kind. Choosing
 * one shows it. Making one the current version is a separate action, so
 * looking never changes what Home and the project show.
 */
export function VersionsMenu({ frame, stack, onShow }: { frame: Frame; stack: Frame[]; onShow: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    addEventListener('pointerdown', away);
    wrap.current?.addEventListener('keydown', esc);
    const node = wrap.current;
    return () => { removeEventListener('pointerdown', away); node?.removeEventListener('keydown', esc); };
  }, [open]);
  const many = stack.length > 1;
  const current = stack.length ? currentOf(stack) : frame;
  const isCurrent = current.id === frame.id;
  const n = versionOf(stack, frame.id);
  const label = many ? `Versions of ${frame.name}, ${versionTitle(n, stack.length)}` : 'Versions: this prototype has only one';
  return html`<div class="bar-note" ref=${wrap}>
    <button type="button" ref=${button} class="btn" disabled=${!many} aria-expanded=${open} aria-haspopup="true" aria-label=${label} title=${many ? 'Versions' : 'Only one version so far'} onClick=${() => setOpen(!open)}>Versions${many ? html`<span class="count">${stack.length}</span>` : null}</button>
    ${open && many && html`<div class="bar-pop versions-pop" role="group" aria-label="Versions">
      <ol>
        ${[...stack].reverse().map((v) => html`<li key=${v.id}><button type="button" class="vrow" aria-current=${v.id === frame.id ? 'true' : undefined} onClick=${() => { setOpen(false); onShow(v.id); }}>${versionLine(versionOf(stack, v.id), v, v.id === current.id)}</button></li>`)}
      </ol>
      ${isCurrent
        ? html`<p class="hint">Version ${n} is the current version, the one Home and the project show.</p>`
        : html`<button type="button" class="btn" onClick=${() => { void store.makeCurrent(frame.id); store.toast(`Version ${n} is now the current version.`); setOpen(false); }}>Make this the current version</button>`}
    </div>`}
  </div>`;
}

/** The whole bottom bar of a prototype: its actions, versions, the Live switch and zoom. */
export function PrototypeBar({ frame, stack, onShow, zoom }: { frame: Frame; stack: Frame[]; onShow: (id: string) => void; zoom: { value: number; onOut: () => void; onIn: () => void; onReset: () => void; onFit: () => void } }) {
  return html`<div class="toolbar viewer-bar" role="group" aria-label="Prototype controls">
    <${PrototypeActions} frame=${frame} />
    <span class="sep"></span>
    <${VersionsMenu} frame=${frame} stack=${stack} onShow=${onShow} />
    <${LiveToggle} frame=${frame} />
    <span class="sep"></span>
    <${ZoomControls} zoom=${zoom.value} onOut=${zoom.onOut} onIn=${zoom.onIn} onReset=${zoom.onReset} onFit=${zoom.onFit} />
  </div>`;
}
