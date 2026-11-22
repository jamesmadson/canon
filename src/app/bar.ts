/** The bar under a prototype: its name, version and tags on the left, Note, Star, Versions, Archive, zoom and the Live switch on the right. The canvas toolbar shares the buttons. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame } from './db';
import { html, Icon, WayButtons, type Way } from './shared';
import { currentOf, versionOf } from './lib/versions';
import { neighbour, tagsForBar, versionLine, versionTitle } from './lib/viewer';
import { LiveToggle } from './live';
import { record } from './lib/tester';
import { MoveMenu, useDismiss } from './move';
import { askRename } from './rename';

const NONE = 'select a prototype first';

/**
 * Note, Star and Archive for a prototype, with whatever the caller puts between Star and Archive
 * (the prototype view puts Versions there). Each has a word beside its icon. The stylesheet drops
 * the words as the bar narrows, Archive first and Note last, and a compact bar (the canvas
 * toolbar) never shows them. The accessible name and the tooltip stay either way.
 */
export function PrototypeActions({ frame, compact = false, children }: { frame: Frame | undefined; compact?: boolean; children?: ComponentChildren }) {
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
    if (save && frame && draft.trim() !== noteText) { void store.setNote(frame.id, draft.trim()); record('note_save', { length: draft.trim().length }); }
    setOpen(false);
    button.current?.focus();
  };
  const star = () => { if (!frame) return; record('star', { on: !frame.starred }); void store.setStarred(frame.id, !frame.starred); };
  const archive = async () => {
    if (!frame) return;
    const next = !frame.archived;
    record('archive', { on: next });
    await store.setArchived(frame.id, next);
    store.toast(next ? `Archived ${frame.name}. It is out of Home and the project list until you bring it back.` : `${frame.name} is back in Home and the project list.`);
  };

  const starred = !!frame?.starred;
  const archived = !!frame?.archived;
  const word = (text: string, cls: string) => (compact ? null : html`<span class=${`lbl ${cls}`}>${text}</span>`);
  return html`<div class="bar-group" role="group" aria-label="Prototype">
    <div class="bar-note">
      <button type="button" ref=${button} class=${`btn vb-note${compact ? ' icon' : ''}`} disabled=${!frame} aria-expanded=${open} aria-haspopup="dialog" aria-label=${frame ? `Note, ${name}${noteText ? ', has text' : ''}` : `Note: ${NONE}`} title=${frame ? 'Note' : `Note: ${NONE}`} onClick=${toggleNote}>
        <${Icon} name="note" />${word('Note', 'lbl-note')}${noteText && html`<i class="badge" aria-hidden="true"></i>`}
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
    <button type="button" class=${`btn vb-star${compact ? ' icon' : ''}`} disabled=${!frame} aria-pressed=${starred} aria-label=${frame ? `Star, ${name}` : `Star: ${NONE}`} title=${frame ? (starred ? 'Starred' : 'Star') : `Star: ${NONE}`} onClick=${star}><${Icon} name="star" fill=${starred} />${word(starred ? 'Starred' : 'Star', 'lbl-star')}</button>
    ${children}
    <button type="button" class=${`btn vb-archive${compact ? ' icon' : ''}`} disabled=${!frame} aria-pressed=${archived} aria-label=${frame ? `Archive, ${name}` : `Archive: ${NONE}`} title=${frame ? (archived ? 'Archived' : 'Archive') : `Archive: ${NONE}`} onClick=${archive}><${Icon} name="archive" />${word(archived ? 'Archived' : 'Archive', 'lbl-archive')}</button>
    ${!compact && frame && html`<${MoveButton} frame=${frame} />`}
  </div>`;
}

/** Move: opens the project picker above the bar. Its word drops just after Archive's does. */
function MoveButton({ frame }: { frame: Frame }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), wrap, button);
  useEffect(() => setOpen(false), [frame.id]);
  return html`<div class="bar-note" ref=${wrap}>
    <button type="button" ref=${button} class="btn vb-move" aria-expanded=${open} aria-haspopup="dialog" aria-label=${`Move ${frame.name} to a project`} title="Move to project" onClick=${() => setOpen(!open)}><${Icon} name="move" /><span class="lbl lbl-move">Move</span></button>
    ${open && html`<div class="bar-pop move-pop" role="dialog" aria-label=${`Move ${frame.name} to a project`}><${MoveMenu} ids=${[frame.id]} onDone=${() => setOpen(false)} /></div>`}
  </div>`;
}

export function ZoomControls({ zoom, onOut, onIn, onReset, onFit }: { zoom: number; onOut?: () => void; onIn?: () => void; onReset?: () => void; onFit: () => void }) {
  const pct = `${Math.round(zoom * 100)}%`;
  return html`<div class="bar-group zoom-group" role="group" aria-label="Zoom">
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
export function VersionsMenu({ frame, stack, onShow, onAdd }: { frame: Frame; stack: Frame[]; onShow: (id: string) => void; onAdd?: (w: Way) => void }) {
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
  const label = many ? `Versions of ${frame.name}, ${versionTitle(n, stack.length)}` : onAdd ? `Versions of ${frame.name}, one so far` : 'Versions: this prototype has only one';
  return html`<div class="bar-note" ref=${wrap}>
    <button type="button" ref=${button} class="btn vb-versions" disabled=${!many && !onAdd} aria-expanded=${open} aria-haspopup="true" aria-label=${label} title=${many || onAdd ? 'Versions' : 'Only one version so far'} onClick=${() => { if (!open) record('versions_menu'); setOpen(!open); }}><${Icon} name="versions" /><span class="lbl lbl-versions">Versions</span>${many ? html`<span class="count">${stack.length}</span>` : null}</button>
    ${open && (many || onAdd) && html`<div class="bar-pop versions-pop" role="group" aria-label="Versions">
      ${!many && html`<p class="hint">Only one version so far.</p>`}
      ${many && html`<ol>
        ${[...stack].reverse().map((v) => html`<li key=${v.id}><button type="button" class="vrow" aria-current=${v.id === frame.id ? 'true' : undefined} onClick=${() => { setOpen(false); onShow(v.id); }}>${versionLine(versionOf(stack, v.id), v, v.id === current.id)}</button></li>`)}
      </ol>`}
      ${many && (isCurrent
        ? html`<p class="hint">Version ${n} is the current version, the one Home and the project show.</p>`
        : html`<button type="button" class="btn" onClick=${() => { record('make_current'); void store.makeCurrent(frame.id); store.toast(`Version ${n} is now the current version.`); setOpen(false); }}>Make this the current version</button>`)}
      ${onAdd && html`<div class="add-version" role="menu" aria-label="Add a version"><p class="hint">Add a version</p><${WayButtons} pick=${(w: Way) => { setOpen(false); onAdd(w); }} /></div>`}
    </div>`}
  </div>`;
}

/** "Version 2 of 3" between the previous and next controls. Nothing for a prototype with one version. */
function VersionStep({ frame, stack, onShow }: { frame: Frame; stack: Frame[]; onShow: (id: string) => void }) {
  if (stack.length < 2) return null;
  const prev = neighbour(stack, frame.id, -1);
  const next = neighbour(stack, frame.id, 1);
  const step = (to: Frame | undefined, dir: 'prev' | 'next') => {
    if (!to) return;
    record('version_step', { dir });
    onShow(to.id);
  };
  return html`<div class="vb-ver" role="group" aria-label="Step through versions">
    <button type="button" class="btn ghost icon" disabled=${!prev} aria-label="Previous version" title="Previous version (Left arrow)" onClick=${() => step(prev, 'prev')}><${Icon} name="back" /></button>
    <span class="vb-vtext">${versionTitle(versionOf(stack, frame.id), stack.length)}</span>
    <button type="button" class="btn ghost icon next" disabled=${!next} aria-label="Next version" title="Next version (Right arrow)" onClick=${() => step(next, 'next')}><${Icon} name="back" /></button>
  </div>`;
}

/** The first three tags as quiet tags with "+N" for the rest, and a count that stands in for them when the bar is narrow. */
function BarTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  const { shown, more } = tagsForBar(tags);
  return html`<span class="vb-tags-wrap">
    <span class="vb-tags" role="list" aria-label="Tags">${shown.map((t) => html`<span class="tag" role="listitem" key=${t}>${t}</span>`)}${more > 0 && html`<span class="tag more" role="listitem" title=${tags.slice(shown.length).join(', ')}>+${more}</span>`}</span>
    <span class="tag vb-tagcount" title=${tags.join(', ')}>${tags.length === 1 ? '1 tag' : `${tags.length} tags`}</span>
  </span>`;
}

/**
 * The whole bar under a prototype, shared by the page view and the map. Left: the name, the version
 * line with its step controls, the tags. Right: Note, Star, Versions, Archive, zoom, and the Live switch
 * when it applies. All outlined, because the view has no solid primary of its own.
 */
export function PrototypeBar({ frame, stack, onShow, onAdd, zoom, page }: { frame: Frame; stack: Frame[]; onShow: (id: string) => void; onAdd?: (w: Way) => void; page?: string; zoom: { value: number; onOut: () => void; onIn: () => void; onReset: () => void; onFit: () => void } }) {
  return html`<div class="viewer-bar" role="group" aria-label="Prototype controls">
    <div class="vb-id">
      <h2 class="vb-name" title=${frame.name}>${frame.name}${page ? html`<span class="faint"> · ${page}</span>` : null}</h2>
      <button type="button" class="btn icon vb-rename" aria-label=${`Rename ${frame.name}`} title="Rename" onClick=${() => askRename(frame.id)}><${Icon} name="edit" /></button>
      <${VersionStep} frame=${frame} stack=${stack} onShow=${onShow} />
      <${BarTags} tags=${frame.tags ?? []} />
    </div>
    <div class="vb-acts">
      <${PrototypeActions} frame=${frame}><${VersionsMenu} frame=${frame} stack=${stack} onShow=${onShow} onAdd=${onAdd} /><//>
      <${ZoomControls} zoom=${zoom.value} onOut=${zoom.onOut} onIn=${zoom.onIn} onReset=${zoom.onReset} onFit=${zoom.onFit} />
      <${LiveToggle} frame=${frame} />
    </div>
  </div>`;
}
