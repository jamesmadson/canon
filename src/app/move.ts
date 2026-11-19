/**
 * Moving prototypes to another project: the picker, the row menu that opens it,
 * and the drag that carries prototypes to a project in the sidebar. The move
 * itself, and its undo, are in the store.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import { html, Icon, useStore } from './shared';

/** What a dragged row or card carries: the ids of the prototypes. */
export const DRAG_TYPE = 'application/x-canon-prototypes';

export const carries = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(DRAG_TYPE);
export function startDrag(e: DragEvent, ids: string[]) {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = 'move';
}
export const draggedIds = (e: DragEvent): string[] => {
  try {
    const ids = JSON.parse(e.dataTransfer?.getData(DRAG_TYPE) ?? '[]');
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Move, and say what happened. The toast with Undo comes from the store. */
export async function moveTo(ids: string[], target: { id: string } | { name: string }): Promise<boolean> {
  try {
    const r = await store.moveToProject(ids, target);
    if (!r) {
      const name = 'id' in target ? store.getState().projects.find((p) => p.id === target.id)?.name : '';
      store.toast(`Already in ${name || 'that project'}.`);
    }
    return !!r;
  } catch (err) {
    store.toast(err instanceof Error && /name/.test(err.message) ? err.message : 'Could not move it. Nothing was lost, so try again.');
    return false;
  }
}

/** The project list with a search field, the current project marked, and a way to make a new one. */
export function MoveMenu({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const s = useStore();
  const [query, setQuery] = useState('');
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { (making ? field.current : search.current)?.focus(); }, [making]);
  const frames = s.frames.filter((f) => ids.includes(f.id));
  const here = (id: string) => frames.length > 0 && frames.every((f) => f.projectId === id);
  const q = query.trim().toLowerCase();
  const projects = useMemo(
    () => [...s.projects].sort((a, b) => b.updatedAt - a.updatedAt).filter((p) => !q || p.name.toLowerCase().includes(q)),
    [s.projects, q],
  );
  const choose = async (id: string) => { onDone(); await moveTo(ids, { id }); };
  const create = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return store.toast('Give the new project a name.');
    onDone();
    await moveTo(ids, { name });
  };
  if (making) {
    return html`<form class="move-menu" onSubmit=${create} onKeyDown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMaking(false); } }}>
      <label class="sr" for="move-new-name">New project name</label>
      <input id="move-new-name" class="field" ref=${field} placeholder="New project name" value=${name} onInput=${(e: Event) => setName((e.target as HTMLInputElement).value)} />
      <div class="row"><button type="button" class="btn ghost" onClick=${() => setMaking(false)}>Back</button><button class="btn primary">Create and move</button></div>
    </form>`;
  }
  return html`<div class="move-menu">
    <label class="sr" for="move-search">Search projects</label>
    <input id="move-search" class="field" ref=${search} type="search" placeholder="Search projects" autocomplete="off" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} />
    <ul class="move-list" aria-label="Projects">
      ${projects.map((p) => html`<li key=${p.id}><button type="button" class="move-item" disabled=${here(p.id)} aria-current=${here(p.id) ? 'true' : undefined} onClick=${() => choose(p.id)}>
        <${Icon} name="project" size=${14} /><span>${p.name}</span>${here(p.id) && html`<small>Current</small>`}
      </button></li>`)}
      ${projects.length === 0 && html`<li class="hint">No project matches.</li>`}
    </ul>
    <button type="button" class="move-item move-new" onClick=${() => { setName(query.trim()); setMaking(true); }}><${Icon} name="plus" size=${14} /><span>New project…</span></button>
  </div>`;
}

/** Closes a popover on a press outside it or on Escape, and gives focus back to what opened it. */
export function useDismiss(open: boolean, close: () => void, wrap: { current: HTMLElement | null }, back?: { current: HTMLElement | null }) {
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
      back?.current?.focus();
    };
    addEventListener('pointerdown', away);
    wrap.current?.addEventListener('keydown', esc);
    const node = wrap.current;
    return () => { removeEventListener('pointerdown', away); node?.removeEventListener('keydown', esc); };
  }, [open]);
}

/** A small icon button on a row or card whose menu holds "Move to project". */
export function RowMenu({ ids, name, className = '' }: { ids: string[]; name: string; className?: string }) {
  const [stage, setStage] = useState<'closed' | 'menu' | 'move'>('closed');
  const [at, setAt] = useState<Record<string, string>>({});
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(stage !== 'closed', () => setStage('closed'), wrap, button);
  useEffect(() => { if (stage === 'menu') wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [stage]);
  const toggle = (e: Event) => {
    e.stopPropagation();
    if (stage !== 'closed') return setStage('closed');
    const r = button.current!.getBoundingClientRect();
    // Fixed, so a list's own scrolling never clips it; above the button when there is no room below.
    setAt(r.bottom + 330 > innerHeight && r.top > 330
      ? { position: 'fixed', left: 'auto', top: 'auto', right: `${innerWidth - r.right}px`, bottom: `${innerHeight - r.top + 6}px` }
      : { position: 'fixed', left: 'auto', bottom: 'auto', right: `${innerWidth - r.right}px`, top: `${r.bottom + 6}px` });
    setStage('menu');
  };
  return html`<div class=${`rowmenu ${className}${stage !== 'closed' ? ' open' : ''}`} ref=${wrap} onClick=${(e: Event) => e.stopPropagation()}>
    <button type="button" ref=${button} class="more" aria-haspopup="menu" aria-expanded=${stage !== 'closed'} aria-label=${`More actions for ${name}`} title="More actions" onClick=${toggle}><${Icon} name="more" size=${16} /></button>
    ${stage === 'menu' && html`<div class="menu rowmenu-pop" role="menu" style=${at}>
      <button type="button" role="menuitem" onClick=${() => setStage('move')}><${Icon} name="move" />Move to project</button>
    </div>`}
    ${stage === 'move' && html`<div class="bar-pop move-pop" role="dialog" aria-label=${`Move ${name} to a project`} style=${at}><${MoveMenu} ids=${ids} onDone=${() => setStage('closed')} /></div>`}
  </div>`;
}
