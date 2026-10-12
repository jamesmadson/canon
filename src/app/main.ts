import { render, h } from 'preact';
import './app.css';
import { App, BASE } from './ui';
import { load, reloadNotes } from './store';

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
  // A preview tab files comments straight into IndexedDB and says so here.
  if ('BroadcastChannel' in window) new BroadcastChannel('canon-app').onmessage = () => reloadNotes();
  render(h(App, {}), document.getElementById('app')!);
}

boot();
