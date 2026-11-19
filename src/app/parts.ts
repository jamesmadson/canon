/** The small pieces Home and the project view share: thumbnail, star, tags, a list row, a shelf card, the Add menu. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import * as store from './store';
import type { Frame } from './db';
import { type Card, whenLabel } from './lib/home';
import { tintOf } from '../lib/thumbTints';
import { canLinkFolders } from './intake';
import { ReachNote } from './live';
import { html, Icon, frameSrc, SANDBOX, showsCover, coverSrc, type Way } from './shared';

/* ── Thumbnails: the cover if there is one, a live page for files kept here, else a neutral drawing ── */
function LiveThumb({ frame, big }: { frame: Frame; big: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(big ? 0.2 : 0.03);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Fill the box, cropping from the top: the page's width sets the scale unless the box is taller than it.
    const ro = new ResizeObserver(() => el.clientWidth && setScale(Math.max(el.clientWidth / frame.w, el.clientHeight / frame.h)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.w, frame.h]);
  return html`<div class=${`th${big ? ' big' : ''} live`} ref=${box} aria-hidden="true">
    <iframe src=${frameSrc(frame)} tabindex="-1" loading="lazy" sandbox=${SANDBOX} style=${{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}></iframe>
  </div>`;
}

export function Thumb({ card, big = false }: { card: Card; big?: boolean }) {
  const f = card.frame;
  if (showsCover(f)) return html`<div class=${`th${big ? ' big' : ''}`} aria-hidden="true"><img src=${coverSrc(f)} alt="" loading="lazy" /></div>`;
  if (f.kind !== 'url') return html`<${LiveThumb} frame=${f} big=${big} />`;
  return html`<div class=${`th${big ? ' big' : ''} tint-${tintOf(f.id)}`} aria-hidden="true"><i class="hd"></i><i class="ln"></i><i class="ln s"></i><i class="bt"></i></div>`;
}

/* ── Star ───────────────────────────────────────────────────────────────── */
export function StarButton({ card }: { card: Card }) {
  const toggle = (e: Event) => {
    e.stopPropagation();
    void store.setStarred(card.id, !card.starred);
  };
  return html`<button type="button" class=${`st${card.starred ? ' on' : ''}`} aria-pressed=${card.starred} aria-label=${`Star ${card.name}`} onClick=${toggle}><${Icon} name="star" size=${13} fill=${card.starred} /></button>`;
}

export const Tags = ({ tags, max = 3 }: { tags: string[]; max?: number }) =>
  tags.length ? html`<span class="tags">${tags.slice(0, max).map((t) => html`<span class="tag" key=${t}>${t}</span>`)}</span>` : html`<span class="tags"></span>`;

/** The quiet count beside a prototype's other meta: "5 pages", "3 versions", or both. */
export const metaOf = (c: Pick<Card, 'pages' | 'versions'>): string =>
  [c.pages > 1 ? `${c.pages} pages` : '', c.versions > 1 ? `${c.versions} versions` : ''].filter(Boolean).join(' · ');

/* ── One row of the list ───────────────────────────────────────────────── */
export interface RowProps {
  card: Card;
  selected?: boolean;
  arriving?: boolean;
  onOpen: (c: Card) => void;
  onSelect?: (c: Card) => void;
  /** Replaces the plain "3 versions" text, so a project view can make it a button. */
  versions?: VNode | null;
  /** A leading checkbox, for picking prototypes in a project. */
  pick?: { checked: boolean; onChange: () => void } | null;
  older?: boolean;
  now?: number;
  /** The board names a project view shows when its project has several. Undefined leaves the column out. */
  board?: string;
}

export function ProtoRow({ card, selected, arriving, onOpen, onSelect, versions, pick, older, now, board }: RowProps) {
  const label = metaOf(card);
  return html`<li class=${`prow${selected ? ' sel' : ''}${arriving ? ' arriving' : ''}${older ? ' older' : ''}`} data-card=${card.id}>
    ${pick && html`<label class="pick"><input type="checkbox" checked=${pick.checked} onChange=${pick.onChange} aria-label=${`Select ${card.name}`} /></label>`}
    <${Thumb} card=${card} />
    <button type="button" class="nm" onClick=${() => onOpen(card)} onFocus=${() => onSelect?.(card)}>${card.name}</button>
    <${ReachNote} frame=${card.frame} />
    <span class="sm">${card.summary}</span>
    <${Tags} tags=${card.tags} />
    ${versions !== undefined ? versions : label ? html`<span class="ver">${label}</span>` : html`<span class="ver"></span>`}
    ${board !== undefined && html`<span class="brd" title=${board}>${board}</span>`}
    <span class="src">${card.source}</span>
    <${StarButton} card=${card} />
    <span class="when">${whenLabel(card.updatedAt, now)}</span>
  </li>`;
}

/* ── One card of the shelf ─────────────────────────────────────────────── */
export interface CardProps {
  card: Card;
  selected?: boolean;
  /** The card just landed from a drop. zip names the file whose zipper plays. */
  arriving?: { zip: string | null } | null;
  showTags?: boolean;
  onOpen: (c: Card) => void;
  onSelect?: (c: Card) => void;
  now?: number;
}

export function ShelfCard({ card, selected, arriving, showTags, onOpen, onSelect, now }: CardProps) {
  return html`<li class=${`scard${selected ? ' sel' : ''}${arriving ? ' arriving' : ''}${arriving?.zip ? ' zipped' : ''}`} data-card=${card.id}>
    <button type="button" class="card-main" onClick=${() => onOpen(card)} onFocus=${() => onSelect?.(card)}>
      <span class="th-wrap">
        <${Thumb} card=${card} big />
        ${arriving?.zip && html`<span class="zip" aria-hidden="true"><i class="zl"></i><i class="zr"></i><i class="teeth"></i><i class="pull"></i><span class="zname">${arriving.zip}</span></span>`}
      </span>
      <b class="cname">${card.name}</b>
      <small class="cmeta">${card.source}${' · '}${whenLabel(card.updatedAt, now)}</small>
      ${metaOf(card) && html`<small class="cver">${metaOf(card)}</small>`}
      <${ReachNote} frame=${card.frame} />
    </button>
    ${showTags && card.tags.length > 0 && html`<${Tags} tags=${card.tags} />`}
    <${StarButton} card=${card} />
  </li>`;
}

/* ── The Add menu: the four ways in ────────────────────────────────────── */
export function AddMenu({ onWay, label = 'Add prototype', primary = false }: { onWay: (w: Way) => void; label?: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (w: Way) => { setOpen(false); onWay(w); };
  return html`<div class="addwrap" ref=${wrap}>
    ${primary
      ? html`<button type="button" class="add" aria-haspopup="menu" aria-expanded=${open} onClick=${() => setOpen(!open)}><${Icon} name="plus" size=${14} />${label}</button>`
      : html`<button type="button" class="ibtn" aria-haspopup="menu" aria-expanded=${open} aria-label=${label} onClick=${() => setOpen(!open)}><${Icon} name="plus" size=${14} /></button>`}
    ${open && html`<div class="menu" role="menu">
      <button type="button" role="menuitem" onClick=${() => pick('files')}><${Icon} name="file" />HTML or zip files…</button>
      <button type="button" role="menuitem" onClick=${() => pick('folder')}><${Icon} name="folder" />A folder…</button>
      <button type="button" role="menuitem" onClick=${() => pick('link')} disabled=${!canLinkFolders()}><${Icon} name="link" />Link a folder on your machine…</button>
      <button type="button" role="menuitem" onClick=${() => pick('url')}><${Icon} name="globe" />A running URL…</button>
    </div>`}
  </div>`;
}
