/**
 * The project page's filters. One Filter pill opens a popover with the source,
 * the quick filters and the tags. Whatever is on shows beside the pill as a chip
 * that removes itself, so nothing is hidden and the toolbar stays one row.
 */
import { useRef, useState } from 'preact/hooks';
import type { LibraryFilter } from './lib/library';
import { useDismiss } from './move';
import { html, Icon } from './shared';

const SOURCES = [['all', 'All sources'], ['files', 'Files'], ['linked', 'Linked folders'], ['url', 'URLs']] as const;
const QUICK = [['multiPage', 'Multi-page'], ['hasComments', 'Open notes'], ['unplaced', 'Not on a board'], ['archived', 'Archived']] as const;

type Change = (next: LibraryFilter) => void;

/** One entry per filter that is on, with the change that turns it off. */
export function activeFilters(f: LibraryFilter): { key: string; label: string; off: LibraryFilter }[] {
  const out: { key: string; label: string; off: LibraryFilter }[] = [];
  for (const [k, label] of QUICK) if (f[k]) out.push({ key: k, label, off: { ...f, [k]: false } });
  if (f.source && f.source !== 'all') out.push({ key: 'source', label: SOURCES.find(([v]) => v === f.source)![1], off: { ...f, source: 'all' } });
  for (const t of f.tags ?? []) out.push({ key: `tag:${t}`, label: t, off: { ...f, tags: (f.tags ?? []).filter((x) => x !== t) } });
  return out;
}

export function FilterPop({ filter, onChange, tags }: { filter: LibraryFilter; onChange: Change; tags: { tag: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), wrap, button);
  const on = activeFilters(filter).length;
  const chosen = filter.tags ?? [];
  const toggleTag = (t: string) => onChange({ ...filter, tags: chosen.includes(t) ? chosen.filter((x) => x !== t) : [...chosen, t] });
  return html`<div class="addwrap" ref=${wrap}>
    <button type="button" ref=${button} class="util" aria-expanded=${open} aria-controls="filter-panel" onClick=${() => setOpen(!open)}><${Icon} name="filter" size=${14} />Filter${on ? html`<span class="count">${on}</span>` : ''}</button>
    ${open && html`<div class="menu filter-pop" id="filter-panel" role="group" aria-label="Filters">
      <div class="pop-group" role="group" aria-label="Source">
        <span class="pop-label">Source</span>
        <div class="pop-chips">
          ${SOURCES.map(([v, label]) => html`<button type="button" class="chip-toggle" key=${v} aria-pressed=${(filter.source ?? 'all') === v} onClick=${() => onChange({ ...filter, source: v })}>${label}</button>`)}
        </div>
      </div>
      <div class="pop-group" role="group" aria-label="Show only">
        <span class="pop-label">Show only</span>
        <div class="pop-chips">
          ${QUICK.map(([k, label]) => html`<button type="button" class="chip-toggle" key=${k} aria-pressed=${!!filter[k]} onClick=${() => onChange({ ...filter, [k]: !filter[k] })}>${label}</button>`)}
        </div>
      </div>
      ${tags.length > 0 && html`<div class="pop-group" role="group" aria-label="Tags">
        <span class="pop-label">Tags</span>
        <div class="pop-chips">
          ${tags.map(({ tag, count }) => html`<button type="button" class="chip-toggle" key=${tag} aria-pressed=${chosen.includes(tag)} onClick=${() => toggleTag(tag)}>${tag}<small>${count}</small></button>`)}
        </div>
      </div>`}
      ${on > 0 && html`<button type="button" class="btn ghost pop-clear" onClick=${() => onChange({ query: filter.query, source: 'all', tags: [] })}>Clear filters</button>`}
    </div>`}
  </div>`;
}

/** The filters that are on, as chips beside the Filter pill. Each one removes itself. */
export function ActiveFilters({ filter, onChange }: { filter: LibraryFilter; onChange: Change }) {
  const list = activeFilters(filter);
  if (!list.length) return null;
  return html`<div class="active-filters" role="group" aria-label="Active filters">
    ${list.map((a) => html`<button type="button" class="chip-toggle chip-x" key=${a.key} aria-label=${`Remove filter: ${a.label}`} onClick=${() => onChange(a.off)}>${a.label}<${Icon} name="close" size=${12} /></button>`)}
  </div>`;
}
