/** Home: every project with its latest prototypes, as a list or a shelf. A first run shows only the agent setup line and a drop target. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as store from './store';
import { groupsFromDrop } from './intake';
import { type Card, type Scope, cardsOf, filterByTags, groupByProject, scopeCards, tagCounts } from './lib/home';
import { dropTarget, linksFromText, zipNames } from './lib/drop';
import { moveSelection } from './lib/keys';
import { SETUP_COMMAND } from './lib/setup';
import { stackKey } from './lib/versions';
import { isMac } from './palette';
import { record } from './lib/tester';
import { AddMenu, BoardLinks, ProtoRow, ShelfCard } from './parts';
import { TagBar } from './tagbar';
import { useHomeProbe } from './live';
import { addGroups, html, Icon, runWay, useStore, type Way } from './shared';
import type { Project } from './db';

export type HomeView = 'list' | 'shelf';
export interface Arriving { stack: string; zip: string | null }

const VIEW_KEY = 'canon-home-view';
export function useHomeView(): [HomeView, (v: HomeView) => void] {
  const [view, set] = useState<HomeView>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'shelf' ? 'shelf' : 'list'; } catch { return 'list'; }
  });
  return [view, (v) => {
    set(v);
    record('home_layout', { layout: v });
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice lasts this visit */ }
  }];
}

/* ── First run: the setup line and a drop target, nothing else ─────────── */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand?.('copy') ?? false;
    area.remove();
    return ok;
  }
}

export function FirstRun({ onChoose, onLink }: { onChoose: () => void; onLink?: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    if (!(await copyText(SETUP_COMMAND))) return store.toast('Copying did not work. Select the line and copy it by hand.');
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return html`<div class="first">
    <div class="first-in">
      <p class="first-label" id="setup-label">Run this in your terminal to add Canon to your agent</p>
      <div class="setup">
        <code aria-labelledby="setup-label">${SETUP_COMMAND}</code>
        <button type="button" class="util" onClick=${copy}><${Icon} name=${copied ? 'check' : 'copy'} size=${14} />${copied ? 'Copied' : 'Copy'}</button>
      </div>
      <span class="sr" role="status">${copied ? 'Copied the setup line.' : ''}</span>
      <button type="button" class="first-drop" onClick=${onChoose}>
        <b>Drop a link or a zip here</b>${" "}
        <span>or choose files</span>
      </button>
      ${onLink && html`<div class="first-link">
        <button type="button" class="btn" onClick=${onLink}><${Icon} name="link" size=${14} />Add a link</button>
        <span>or paste one with <kbd>${isMac ? '⌘' : 'Ctrl '}V</kbd></span>
      </div>`}
    </div>
  </div>`;
}

/* ── Filter by tag ─────────────────────────────────────────────────────── */
export function FilterMenu({ tags, chosen, onChange }: { tags: { tag: string; count: number }[]; chosen: string[]; onChange: (t: string[]) => void }) {
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
  const toggle = (t: string) => onChange(chosen.includes(t) ? chosen.filter((x) => x !== t) : [...chosen, t]);
  return html`<div class="addwrap" ref=${wrap}>
    <button type="button" class="util" aria-expanded=${open} aria-controls="filter-panel" onClick=${() => setOpen(!open)}><${Icon} name="filter" size=${14} />Filter${chosen.length ? ` (${chosen.length})` : ''}</button>
    ${open && html`<div class="menu filter-panel" id="filter-panel" role="group" aria-label="Filter by tag">
      ${tags.length === 0 && html`<p class="hint" style="margin:6px 10px">No tags yet.</p>`}
      ${tags.map(({ tag, count }) => html`<button type="button" key=${tag} aria-pressed=${chosen.includes(tag)} onClick=${() => toggle(tag)}><span>${tag}</span><small>${count}</small></button>`)}
      ${chosen.length > 0 && html`<button type="button" class="clear" onClick=${() => onChange([])}>Clear filter</button>`}
    </div>`}
  </div>`;
}

/* ── The screen, from plain props ──────────────────────────────────────── */
export interface HomeBodyProps {
  scope: Scope;
  cards: Card[];
  projects: Project[];
  view: HomeView;
  onView: (v: HomeView) => void;
  chosenTags: string[];
  onTags: (t: string[]) => void;
  tagList: { tag: string; count: number }[];
  onOpen: (c: Card) => void;
  onWay: (w: Way, projectId: string | null) => void;
  arriving: Arriving | null;
  landed: string | null;
  now?: number;
}

const TITLES = { home: 'Home', starred: 'Starred', archive: 'Archive' } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SHELF_MAX = 5;

const EMPTY: Record<Scope['kind'], string> = {
  home: 'Nothing here yet.',
  starred: 'Nothing is starred. Use the star on a prototype to keep it here.',
  archive: 'Nothing is archived.',
  tag: 'No prototype has that tag.',
};

export function HomeBody(p: HomeBodyProps) {
  const [sel, setSel] = useState<string | null>(null);
  useHomeProbe(p.cards.map((c) => c.frame));
  const [shut, setShut] = useState<Set<string>>(new Set());
  useEffect(() => setSel(null), [p.landed]);
  const filtering = p.chosenTags.length > 0;
  const groups = groupByProject(p.cards, p.projects, { includeEmpty: p.scope.kind === 'home' && !filtering });
  const projectCount = groups.filter((g) => g.cards.length).length;
  const title = p.scope.kind === 'tag' ? p.scope.tag : TITLES[p.scope.kind];
  const landedId = p.landed ? p.cards.find((c) => c.stack === p.landed)?.id : undefined;
  const selected = sel ?? landedId ?? groups.find((g) => g.cards.length)?.cards[0]?.id ?? null;
  const toggleShut = (id: string) => setShut((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const onKeys = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (!t.matches?.('.nm, .card-main')) return;
    const key = ({ ArrowRight: 'ArrowDown', ArrowLeft: 'ArrowUp' } as Record<string, string>)[e.key] ?? e.key;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.nm, .card-main'));
    e.preventDefault();
    items[moveSelection(items.indexOf(t), items.length, key)]?.focus();
  };

  const arrivingOf = (c: Card) => (p.arriving && p.arriving.stack === c.stack ? p.arriving : null);

  return html`<main class="main" aria-label=${title}>
    <header class="bar">
      <h1>${title}<small>${plural(p.cards.length, 'prototype')} in ${plural(projectCount, 'project')}</small></h1>
      <div class="seg" role="group" aria-label="View">
        <button type="button" aria-pressed=${p.view === 'list'} onClick=${() => p.onView('list')}>List</button>
        <button type="button" aria-pressed=${p.view === 'shelf'} onClick=${() => p.onView('shelf')}>Shelf</button>
      </div>
      <${AddMenu} primary onWay=${(w: Way) => p.onWay(w, null)} />
    </header>
    ${(p.tagList.length > 0 || filtering) && html`<${TagBar} tags=${p.tagList} chosen=${p.chosenTags} onChange=${p.onTags} />`}
    <div class="body" onKeyDown=${onKeys}>
      ${p.cards.length === 0 && (filtering
        ? html`<div class="empty"><p>No prototypes have all of these tags.</p><button type="button" class="btn" onClick=${() => p.onTags([])}>Clear filters</button></div>`
        : html`<div class="empty">${EMPTY[p.scope.kind]}</div>`)}
      ${groups.map(({ project, cards }) => {
        const open = !shut.has(project.id);
        return p.view === 'list'
          ? html`<section class="grp-wrap" data-project=${project.id} aria-label=${project.name} key=${project.id}>
              <div class="grp">
                <button type="button" class="gbtn" aria-expanded=${open} onClick=${() => toggleShut(project.id)}><${Icon} name="chevron" size=${14} /><span>${project.name}</span><em>${cards.length}</em></button>
                <${BoardLinks} className="grp-boards" boards=${store.boardsOf(project.id)} label=${['Open board', 'Boards']} name=${project.name} />
                <${AddMenu} label=${`Add a prototype to ${project.name}`} onWay=${(w: Way) => p.onWay(w, project.id)} />
              </div>
              ${open && html`<ul class="rows">${cards.map((c) => html`<${ProtoRow} key=${c.id} card=${c} selected=${selected === c.id} arriving=${!!arrivingOf(c)} now=${p.now} onOpen=${p.onOpen} onSelect=${(x: Card) => setSel(x.id)} />`)}</ul>`}
            </section>`
          : html`<section class="srow" data-project=${project.id} aria-label=${project.name} key=${project.id}>
              <div class="shead"><h2>${project.name}</h2><span class="muted">${plural(cards.length, 'prototype')}</span><span class="shead-links"><${BoardLinks} boards=${store.boardsOf(project.id)} label=${['Open board', 'Boards']} name=${project.name} /><a href=${`#/p/${project.id}`}>Open project<span class="sr"> ${project.name}</span></a></span></div>
              <ul class=${`cards${p.arriving && cards.some((c) => arrivingOf(c)) ? ' arriving' : ''}`}>
                ${cards.slice(0, SHELF_MAX).map((c) => html`<${ShelfCard} key=${c.id} card=${c} selected=${selected === c.id} arriving=${arrivingOf(c)} showTags=${p.landed === c.stack} now=${p.now} onOpen=${p.onOpen} onSelect=${(x: Card) => setSel(x.id)} />`)}
              </ul>
            </section>`;
      })}
    </div>
    <div class="hint-bar">Paste a link with <kbd>${isMac ? '⌘' : 'Ctrl '}V</kbd> or drop a zip anywhere to add it</div>
  </main>`;
}

/* ── The container: reads the store, handles drops and pastes ──────────── */
export function Home({ scope, askUrl, onOpen, tags = [], onTags }: { scope: Scope; askUrl: () => Promise<string | null>; onOpen: (c: Card) => void; tags?: string[]; onTags: (t: string[]) => void }) {
  const s = useStore();
  const [view, setView] = useHomeView();
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ project: string | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const all = useMemo(() => cardsOf(s.frames), [s.frames]);
  const scoped = scopeCards(all, scope);
  const cards = filterByTags(scoped, tags);
  const tagList = tagCounts(scoped);

  /** Runs an intake and, if it added something, marks where it landed so the card can arrive. */
  const track = async (zip: string | null, run: () => Promise<unknown>) => {
    const before = new Set(store.getState().frames.map((f) => f.id));
    await run();
    const fresh = store.getState().frames.filter((f) => !before.has(f.id));
    const last = fresh[fresh.length - 1];
    if (!last) return;
    const stack = stackKey(last);
    setArriving({ stack, zip });
    setLanded(stack);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setArriving(null), 2400);
  };
  const ensureProject = async (id: string | null) => id ?? (await store.createProject('My prototypes')).id;

  const way = async (w: Way, projectId: string | null) => {
    const target = await ensureProject(projectId ?? dropTarget(store.getState().projects, null));
    await track(null, () => runWay(w, target, undefined, askUrl));
  };
  const addLinks = async (links: string[], projectId: string | null) => {
    const target = await ensureProject(projectId ?? dropTarget(store.getState().projects, null));
    const t0 = Date.now();
    record('add_start', { kind: 'link' });
    await track(null, async () => { for (const l of links) await store.addUrl(target, l); });
    record('add_done', { kind: 'link', ms: Date.now() - t0 });
  };

  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const links = linksFromText(e.clipboardData?.getData('text') ?? '', location.origin);
      if (!links.length) return;
      e.preventDefault();
      void addLinks(links, null);
    };
    addEventListener('paste', paste);
    return () => removeEventListener('paste', paste);
  });

  const accepts = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/plain');
  const hitOf = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-project]')?.getAttribute('data-project') ?? null;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(null);
    const dt = e.dataTransfer;
    if (!dt) return;
    // Everything the drop holds is read before the first await: the browser empties it afterwards.
    const hit = hitOf(e);
    const text = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
    const links = linksFromText(text, location.origin);
    const zips = zipNames(Array.from(dt.files));
    const dropped = Array.from(dt.items ?? []).some((i) => i.kind === 'file') ? groupsFromDrop(dt) : null;
    void (async () => {
      const target = await ensureProject(dropTarget(store.getState().projects, hit));
      await track(zips[0] ?? null, async () => {
        if (dropped) await addGroups(target, (await dropped).groups);
        for (const l of links) await store.addUrl(target, l);
      });
    })();
  };

  const first = s.frames.length === 0 && scope.kind === 'home';
  const dropName = drag?.project ? s.projects.find((p) => p.id === drag.project)?.name : null;
  const body = first
    ? html`<main class="main" aria-label="Home"><${FirstRun} onChoose=${() => way('files', null)} onLink=${() => way('url', null)} /></main>`
    : html`<${HomeBody} scope=${scope} cards=${cards} projects=${s.projects} view=${view} onView=${setView} chosenTags=${tags} onTags=${onTags}
        tagList=${tagList} onOpen=${onOpen} onWay=${way} arriving=${arriving} landed=${landed} />`;
  return html`<div class="home-drop" onDragOver=${(e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); setDrag({ project: hitOf(e) }); }}
      onDragLeave=${(e: DragEvent) => { if (!e.relatedTarget) setDrag(null); }} onDrop=${onDrop}>
    ${body}
    ${drag && html`<div class="dropzone" aria-hidden="true">${dropName ? `Drop to add to ${dropName}` : 'Drop a link or a zip to add it'}</div>`}
  </div>`;
}
