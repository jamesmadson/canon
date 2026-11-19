/** Home's row of tag chips: All, the most used tags that fit on one line, then More. Choosing a chip filters the list or shelf. */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CANDIDATES, SEARCH_AFTER, isChosen, layoutChips, matchTags, takeTagMenu, toggleTag } from './lib/tagbar';
import { html, Icon } from './shared';

type Counted = { tag: string; count: number };

/** Every tag on offer in the menu, plus any chosen tag that no prototype here carries, so it can always be switched off. */
function withChosen(tags: Counted[], chosen: string[]): Counted[] {
  const extra = chosen.filter((c) => !isChosen(tags.map((t) => t.tag), c));
  return [...tags, ...extra.map((tag) => ({ tag, count: 0 }))];
}

function MoreMenu({ tags, chosen, onChange, onClose, anchor }: { tags: Counted[]; chosen: string[]; onChange: (t: string[]) => void; onClose: () => void; anchor: { current: HTMLButtonElement | null } }) {
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const search = tags.length > SEARCH_AFTER;
  useEffect(() => {
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && !anchor.current?.contains(e.target as Node) && onClose();
    addEventListener('pointerdown', away);
    return () => removeEventListener('pointerdown', away);
  }, []);
  useEffect(() => { wrap.current?.querySelector<HTMLElement>(search ? 'input' : 'button')?.focus(); }, []);
  const shown = matchTags(tags, query);
  return html`<div class="menu tag-menu" ref=${wrap} id="tag-menu" role="group" aria-label="All tags"
    onKeyDown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); anchor.current?.focus(); } }}>
    ${search && html`<label class="tag-search"><${Icon} name="search" size=${14} /><span class="sr">Search tags</span><input type="search" placeholder="Search tags" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} /></label>`}
    <div class="tag-list">
      ${shown.map(({ tag, count }) => html`<button type="button" key=${tag} aria-pressed=${isChosen(chosen, tag)} onClick=${() => onChange(toggleTag(chosen, tag))}><span>${tag}</span><small>${count}</small></button>`)}
      ${shown.length === 0 && html`<p class="hint" role="status">No tag matches that.</p>`}
    </div>
  </div>`;
}

export function TagBar({ tags, chosen, onChange }: { tags: Counted[]; chosen: string[]; onChange: (t: string[]) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [room, setRoom] = useState(0);
  const [layout, setLayout] = useState<{ visible: string[] | null; overflow: boolean }>({ visible: null, overflow: false });
  const [open, setOpen] = useState(false);

  const all = withChosen(tags, chosen);
  const candidates = [...tags.slice(0, CANDIDATES), ...all.slice(tags.length)];
  const key = candidates.map((c) => c.tag).join('\n') + '|' + chosen.join('\n');

  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const read = () => setRoom(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The probe holds every candidate out of sight, so widths can be read without drawing them in the row.
  useLayoutEffect(() => {
    const p = probe.current;
    if (!p) return;
    const kids = Array.from(p.children) as HTMLElement[];
    const gap = parseFloat(getComputedStyle(p).columnGap) || 8;
    const chips = candidates.map((c, i) => ({ tag: c.tag, width: kids[i + 2]?.offsetWidth ?? 0, chosen: isChosen(chosen, c.tag) }));
    const next = layoutChips(chips, room, kids[0]?.offsetWidth ?? 0, kids[1]?.offsetWidth ?? 0, gap);
    setLayout((cur) => (cur.visible && cur.overflow === next.overflow && cur.visible.join('\n') === next.visible.join('\n') ? cur : next));
  }, [key, room]);

  // "See all" in the sidebar asks for the full list.
  useEffect(() => {
    const ask = () => { if (takeTagMenu()) setOpen(true); };
    ask();
    addEventListener('canon-tag-menu', ask);
    return () => removeEventListener('canon-tag-menu', ask);
  }, []);

  const visible = layout.visible ?? candidates.map((c) => c.tag);
  return html`<div class="tagbar" role="group" aria-label="Filter by tag">
    <div class="tagbar-row" ref=${row}>
      <button type="button" class="fchip" aria-pressed=${chosen.length === 0} onClick=${() => onChange([])}>All</button>
      ${visible.map((tag) => html`<button type="button" class="fchip" key=${tag} aria-pressed=${isChosen(chosen, tag)} onClick=${() => onChange(toggleTag(chosen, tag))}>${tag}</button>`)}
      ${(layout.overflow || open) && html`<div class="addwrap">
        <button type="button" ref=${more} class="fchip more" aria-haspopup="true" aria-expanded=${open} aria-controls="tag-menu" onClick=${() => setOpen(!open)}>More<${Icon} name="chevron" size=${14} /></button>
        ${open && html`<${MoreMenu} tags=${all} chosen=${chosen} onChange=${onChange} onClose=${() => setOpen(false)} anchor=${more} />`}
      </div>`}
    </div>
    <div class="tagbar-probe" ref=${probe} aria-hidden="true" inert>
      <span class="fchip">All</span><span class="fchip">More<${Icon} name="chevron" size=${14} /></span>
      ${candidates.map((c) => html`<span class="fchip" key=${c.tag} aria-pressed=${isChosen(chosen, c.tag)}>${c.tag}</span>`)}
    </div>
  </div>`;
}
