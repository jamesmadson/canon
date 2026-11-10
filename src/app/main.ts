import { render, h } from 'preact';
import './app.css';
import { App, BASE } from './ui';
import { load, watchOtherTabs, setInstallPrompt, toast, createSampleProject, getState, type InstallPromptEvent } from './store';
import { parseTry, tryDestination, TRY_TARGETS, type TryLink } from './lib/tryout';
import { askPersistence, initVault } from './vault';
import { type PairLink, parsePairLink, startBridgeClient } from './bridge/client';

/**
 * Read a pairing link out of the address and clear it at once, before anything
 * awaits, so the secret never sits in history while the app boots.
 */
function takePairLink(): PairLink | 'bad' | null {
  const p = parsePairLink(location.hash);
  if (p !== null) history.replaceState(null, '', location.pathname + location.search);
  return p;
}
const pairAtLoad = takePairLink();

/** A "Try it now" link from the site, cleared from the address at once like a pairing link. */
function takeTryLink(): TryLink | null {
  const t = parseTry(location.hash);
  if (t) history.replaceState(null, '', location.pathname + location.search);
  return t;
}
const tryAtLoad = takeTryLink();

/**
 * Load the Fernwell sample and land on the prototype the link names, but only
 * into an empty library. A returning person's own work is never replaced or
 * mixed with it: they just land where the app opens.
 */
async function openTry(link: TryLink) {
  if (getState().projects.length > 0) return;
  const { project, board } = await createSampleProject();
  const name = link.target ? TRY_TARGETS[link.target].frame : null;
  const frame = name ? getState().frames.find((f) => f.projectId === project.id && f.name === name) : undefined;
  history.replaceState(null, '', location.pathname + location.search + tryDestination(project.id, board.id, link, frame?.id ?? null));
}

// Chromium offers installing as an app through this event; keep it for the Install button.
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setInstallPrompt(e as InstallPromptEvent);
});
addEventListener('appinstalled', () => setInstallPrompt(null));

async function boot() {
  // The worker serves dropped prototypes out of IndexedDB. Frames need it
  // active before they load, so the app waits for it rather than racing it.
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(`${BASE}app-sw.js`, { scope: `${BASE}app/` });
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn('Canon: the prototype server did not start, so dropped files will not render.', err);
    }
  }
  await load();
  // Ask the browser not to evict the library, then pick up the Canon folder if there is one.
  void askPersistence();
  await initVault();
  if (tryAtLoad) await openTry(tryAtLoad);
  // A preview tab files comments straight into IndexedDB and says so here.
  watchOtherTabs();
  // Before render, so the first paint already shows it.
  if (pairAtLoad === 'bad') toast('That pairing link is incomplete, so nothing was connected. Ask the agent for a new one.');
  render(h(App, { pairAtLoad: pairAtLoad === 'bad' ? null : pairAtLoad }), document.getElementById('app')!);
  // Links handed to agents point at this page, wherever it is served from.
  startBridgeClient({ appBase: location.origin + location.pathname });
}

boot();
