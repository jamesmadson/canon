/** The search palette: Command K, type, Enter. It works from the keyboard alone. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Card } from './lib/home';
import { isSearchHotkey, moveSelection } from './lib/keys';
import { searchCards } from './lib/search';
import { html, Icon } from './shared';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SEARCH_EVENT = 'canon:switcher';
export const openSearch = () => dispatchEvent(new Event(SEARCH_EVENT));

interface PaletteProps {
  cards: Card[];
  projectName: (projectId: string) => string;
  onPick: (card: Card) => void;
  onClose: () => void;
}

export function Palette({ cards, projectName, onPick, onClose }: PaletteProps) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => {
    input.current?.focus();
    const was = back.current as HTMLElement | null;
    return () => { if (was?.isConnected) was.focus?.(); };
  }, []);
  const rows = searchCards(cards, q, projectName);
  const here = Math.min(at, Math.max(rows.length - 1, 0));
  const pick = (c: Card) => { onClose(); onPick(c); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[here]) pick(rows[here]); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setAt(moveSelection(here, rows.length, e.key)); }
  };
  const id = (i: number) => `result-${i}`;
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <div class="switcher" role="dialog" aria-modal="true" aria-label="Search prototypes">
      <label class="search"><${Icon} name="search" /><span class="sr">Search prototypes</span>
        <input ref=${input} role="combobox" aria-expanded="true" aria-controls="results" aria-activedescendant=${rows.length ? id(here) : undefined} aria-autocomplete="list" placeholder="Search by name, tag, summary or project" value=${q}
          onInput=${(e: Event) => { setQ((e.target as HTMLInputElement).value); setAt(0); }} onKeyDown=${onKey} />
      </label>
      <ul id="results" role="listbox" aria-label="Results">
        ${rows.length === 0 && html`<li class="sw-empty" role="presentation">${cards.length ? `Nothing matches “${q.trim()}”. Try fewer words.` : 'No prototypes yet.'}</li>`}
        ${rows.map((c, i) => html`<li id=${id(i)} key=${c.id} role="option" aria-selected=${i === here} class=${i === here ? 'on' : ''} onMouseMove=${() => i !== here && setAt(i)} onClick=${() => pick(c)}>
          <span class="sw-main"><b>${c.name}</b><small>${projectName(c.projectId)}${' · '}${c.source}${c.versions > 1 ? ` · ${c.versions} versions` : ''}</small></span>
          ${c.starred && html`<span class="sw-star" role="img" aria-label="Starred"><${Icon} name="star" size=${13} fill /></span>`}
        </li>`)}
      </ul>
      <div class="sw-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> opens it</span><span><kbd>esc</kbd> to close</span></div>
    </div>
  </div>`;
}

/** Owns whether the palette is open: Command K or Control K toggles it, and so does the sidebar's search button. */
export function SearchHost(props: Omit<PaletteProps, 'onClose'>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isSearchHotkey(e)) { e.preventDefault(); setOpen((v) => !v); }
    };
    const show = () => setOpen(true);
    addEventListener('keydown', key);
    addEventListener(SEARCH_EVENT, show);
    return () => { removeEventListener('keydown', key); removeEventListener(SEARCH_EVENT, show); };
  }, []);
  return open ? html`<${Palette} ...${props} onClose=${() => setOpen(false)} />` : null;
}
