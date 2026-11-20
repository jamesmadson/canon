/** Rename a prototype: one small dialog, opened from a row menu or the prototype view. */
import { useEffect, useRef, useState } from 'preact/hooks';
import * as store from './store';
import type { Frame } from './db';
import { html, useStore } from './shared';

let asked: string | null = null;
const listeners = new Set<() => void>();

/** Ask for the rename dialog for a prototype. Any version's id will do. */
export function askRename(frameId: string) {
  asked = frameId;
  listeners.forEach((fn) => fn());
}

/** Draws the dialog when one was asked for. The app mounts it once. */
export function RenameHost() {
  const s = useStore();
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  const frame = asked ? s.frames.find((f) => f.id === asked) : undefined;
  if (!frame) return null;
  return html`<${RenameDialog} key=${frame.id} frame=${frame} onClose=${() => { asked = null; force((n) => n + 1); }} />`;
}

function RenameDialog({ frame, onClose }: { frame: Frame; onClose: () => void }) {
  const [value, setValue] = useState(frame.name);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); box.current?.select(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const save = async (e: Event) => {
    e.preventDefault();
    if (!(await store.renameFrame(frame.id, value))) return setProblem('Enter a name, then save.');
    onClose();
  };
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <form class="dialog" role="dialog" aria-modal="true" aria-label="Rename prototype" onSubmit=${save}>
      <h3>Rename prototype</h3>
      <label class="fb-label" for="rename-name">Name</label>
      <input class="field" id="rename-name" ref=${box} autocomplete="off" value=${value} aria-invalid=${problem ? 'true' : undefined} aria-describedby=${problem ? 'rename-error' : undefined}
        onInput=${(e: Event) => { setValue((e.target as HTMLInputElement).value); setProblem(null); }} />
      ${problem && html`<p class="field-error" id="rename-error" role="alert">${problem}</p>`}
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn ghost" onClick=${onClose}>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  </div>`;
}
