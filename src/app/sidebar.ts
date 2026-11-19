/** The left rail: search, Home, Starred, Archive, projects with counts, tags with counts, and the paired agent. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import * as store from './store';
import * as vault from './vault';
import { type Address, buildAddress } from './lib/address';
import { askTagMenu, sameTag } from './lib/tagbar';
import { cardsOf, countPrototypes, scopeCards, tagCounts } from './lib/home';
import { bridgeView, removeAgent, subscribeBridge } from './bridge/client';
import { Avatar } from './comments';
import { html, Icon, go, ago, useStore } from './shared';
import { isMac, openSearch } from './palette';
import { askProjectName } from './lib/naming';
import { FeedbackFoot } from './feedback';
import { carries, draggedIds, moveTo } from './move';

export function useBridge(): ReturnType<typeof bridgeView> {
  const [, force] = useState(0);
  useEffect(() => subscribeBridge(() => force((n) => n + 1)), []);
  return bridgeView();
}

export function pickBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.canon,.zip';
  input.onchange = () => input.files?.[0] && vault.restoreFromFile(input.files[0]);
  input.click();
}

/* ── Where the library is kept ─────────────────────────────────────────── */
function Storage() {
  const { vault: v } = useStore();
  const tools = html`<div class="store-tools">
    <button type="button" onClick=${() => vault.downloadBackup()}>Back up</button><button type="button" onClick=${pickBackup}>Restore</button>
    ${v.status === 'connected' && html`<button type="button" onClick=${() => vault.forgetFolder()}>Stop saving</button>`}
  </div>`;
  if (v.status === 'connected') {
    const when = v.saving ? 'Saving…' : v.savedAt ? `Saved ${ago(v.savedAt)}` : 'Connected';
    return html`<div class="store">
      <div class=${`store-line${v.error ? ' warn' : ''}`}><span class="dot"></span><span><b>${v.name}</b> folder · ${v.error ?? when}</span></div>
      ${tools}
    </div>`;
  }
  if (v.status === 'needs-permission') {
    return html`<div class="store">
      <button type="button" class="store-cta" onClick=${() => vault.reconnect()}><b>Reconnect “${v.name}”</b><small>The browser needs your OK to keep saving there.</small></button>
      ${tools}
    </div>`;
  }
  if (v.status === 'none') {
    return html`<div class="store">
      <button type="button" class="store-cta" onClick=${() => vault.chooseFolder()}><b>Save to a folder</b><small>Only in this browser right now. A folder keeps it safe if the browser is cleared.</small></button>
      ${tools}
    </div>`;
  }
  return html`<div class="store">
    <div class="store-line warn"><span class="dot"></span><span>Only in this browser. Back up now and then.</span></div>
    ${tools}
  </div>`;
}

/* ── The paired agent ──────────────────────────────────────────────────── */
function Agents() {
  const { agents, connected, connecting } = useBridge();
  if (!agents.length) return null;
  const disconnect = (id: string, name: string) => {
    if (confirm(`Disconnect ${name}? It will stop adding prototypes to Canon, and nothing already here is deleted. To connect it again, ask it to run canon_pair and open the link it gives you.`)) removeAgent(id).catch(() => store.toast(`Could not disconnect ${name}.`));
  };
  return html`<div class="agents" role="group" aria-label="Connected agents">
    ${[...agents].sort((a, b) => a.name.localeCompare(b.name)).map((a) => {
      const state = connected.has(a.id) ? 'on' : connecting.has(a.id) ? 'wait' : 'off';
      const label = { on: 'connected', wait: 'connecting', off: 'not connected' }[state];
      return html`<div class="agent" key=${a.id}>
        <span class="dot" data-state=${state} aria-hidden="true"></span>
        <span class="agent-name"><b>${a.name}</b> ${label}</span>
        <button type="button" class="btn ghost" aria-label=${`Disconnect ${a.name}`} onClick=${() => disconnect(a.id, a.name)}>Disconnect</button>
      </div>`;
    })}
  </div>`;
}

/* ── The rail ──────────────────────────────────────────────────────────── */
const here = (on: boolean) => (on ? 'page' : undefined);

export function Sidebar({ route, activeProject }: { route: Address; activeProject: string | null }) {
  const s = useStore();
  const [dropOn, setDropOn] = useState<string | null>(null);
  // A drag that ends anywhere else leaves no project lit.
  useEffect(() => { const off = () => setDropOn(null); addEventListener('dragend', off); addEventListener('drop', off); return () => { removeEventListener('dragend', off); removeEventListener('drop', off); }; }, []);
  const cards = useMemo(() => cardsOf(s.frames), [s.frames]);
  const live =scopeCards(cards, { kind: 'home' });
  const starred = scopeCards(cards, { kind: 'starred' }).length;
  const allTags = tagCounts(live);
  const tags = allTags.slice(0, 8);
  const projects = [...s.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const countIn = (id: string) => countPrototypes(s.frames, { projectId: id });
  const me = store.myName();
  const sample = async () => {
    const { project } = await store.createSampleProject();
    go(`/p/${project.id}`);
  };
  const newProject = async () => {
    const made = await store.createProject();
    askProjectName(made.id);
    go(`/p/${made.id}`);
  };
  return html`<aside class="rail" aria-label="Canon">
    <a class="workspace" href="#/"><span class="mark" aria-hidden="true"></span><b>Canon</b></a>
    <button type="button" class="find" aria-label="Search prototypes" aria-keyshortcuts=${isMac ? 'Meta+K' : 'Control+K'} onClick=${openSearch}>
      <${Icon} name="search" size=${14} />Search<kbd aria-hidden="true">${isMac ? '⌘' : 'Ctrl '}K</kbd>
    </button>
    <div class="rail-scroll">
      <nav aria-label="Library">
        <a class="ni" href="#/" aria-current=${here(route.name === 'home' && !route.tags?.length)}><${Icon} name="home" size=${14} /><span>Home</span><em>${countPrototypes(s.frames)}</em></a>
        <a class="ni" href="#/starred" aria-current=${here(route.name === 'starred')}><${Icon} name="star" size=${14} /><span>Starred</span><em>${starred}</em></a>
        <a class="ni" href="#/archive" aria-current=${here(route.name === 'archive')}><${Icon} name="archive" size=${14} /><span>Archive</span></a>
      </nav>
      <div class="sh"><span>Projects</span><button type="button" class="ibtn" aria-label="New project" onClick=${newProject}><${Icon} name="plus" size=${14} /></button></div>
      <nav aria-label="Projects">
        ${projects.map((p) => html`<a class=${`ni${dropOn === p.id ? ' drop' : ''}`} key=${p.id} href=${`#/p/${p.id}`} data-drop-project=${p.id} aria-current=${route.name === 'project' && route.project === p.id ? 'page' : activeProject === p.id ? 'true' : undefined}
          onDragOver=${(e: DragEvent) => { if (!carries(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; setDropOn(p.id); }}
          onDragLeave=${(e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropOn((on) => (on === p.id ? null : on)); }}
          onDrop=${(e: DragEvent) => { if (!carries(e)) return; e.preventDefault(); e.stopPropagation(); setDropOn(null); void moveTo(draggedIds(e), { id: p.id }); }}>
          <${Icon} name="project" size=${14} /><span>${p.name}</span><em>${countIn(p.id)}</em>
        </a>`)}
        ${projects.length === 0 && html`<button type="button" class="ni sample" onClick=${sample}><${Icon} name="spark" size=${14} /><span>Try the sample project</span></button>`}
      </nav>
      ${tags.length > 0 && html`<div class="sh"><span>Tags</span></div>
        <nav aria-label="Tags">
          ${tags.map(({ tag, count }) => html`<a class="ni tg" key=${tag} href=${buildAddress({ name: 'home', tags: [tag] })} aria-current=${here(route.name === 'home' && route.tags?.length === 1 && sameTag(route.tags[0], tag))}><i aria-hidden="true"></i><span>${tag}</span><em>${count}</em></a>`)}
          ${allTags.length > tags.length && html`<a class="ni see-all" href="#/" onClick=${askTagMenu}><span>See all ${allTags.length} tags</span></a>`}
        </nav>`}
    </div>
    ${!store.isInstalled() && store.canInstall() && html`<button type="button" class="install" onClick=${() => store.install()}>
      <img src="/canon/icons/canon-192.png" alt="" width="28" height="28" />
      <span><b>Install Canon</b><small>Its own window, in your Dock or taskbar</small></span>
    </button>`}
    ${!store.isInstalled() && !store.canInstall() && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent) && html`<div class="install hint">
      <img src="/canon/icons/canon-192.png" alt="" width="28" height="28" />
      <span><b>Install Canon</b><small>In Safari: File, then Add to Dock</small></span>
    </div>`}
    <div class="rail-foot">
      ${me ? html`<div class="me"><${Avatar} name=${me} /><span>${me}</span></div>` : null}
      <${Storage} />
      <${Agents} />
      <${FeedbackFoot} />
    </div>
  </aside>`;
}
