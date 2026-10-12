/*
 * Canon's comment layer for a prototype opened from its preview link.
 * The app's service worker adds this script to top-level pages only. Notes
 * keep Strata's rules (Said word for word, a P code never a name, Meant as an
 * optional reading) and land in the same IndexedDB record the app reads.
 */
(() => {
  const me = document.currentScript;
  const frameId = me && me.dataset.frame;
  const page = me && me.dataset.page;
  if (!frameId || window.top !== window) return;

  const db = () => new Promise((res, rej) => {
    const r = indexedDB.open('canon-app');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('canon-app') : null;

  let frame = null;
  let notes = [];
  let commenting = false;

  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    .bar { position: fixed; right: 18px; bottom: 18px; display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 12px;
      background: rgba(28,28,28,.94); color: #ececea; box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 12px 32px rgba(0,0,0,.45); font-size: 13px; }
    .bar b { font-weight: 600; padding: 0 8px 0 10px; }
    button { font: inherit; cursor: pointer; border: 0; }
    .toggle { height: 32px; padding: 0 12px; border-radius: 8px; background: #2a2a2a; color: #ececea; }
    .toggle[aria-pressed="true"] { background: #4d8dff; color: #fff; }
    .shield { position: fixed; inset: 0; cursor: crosshair; display: none; background: rgba(77,141,255,.04); }
    .shield.on { display: block; }
    .pin { position: absolute; width: 26px; height: 26px; margin-top: -26px; border-radius: 13px 13px 13px 2px; background: #7ee2a8; color: #111;
      font-size: 11px; font-weight: 700; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
    .pin.canvas { background: #ffd34d; }
    .pin.draft { background: #4d8dff; color: #fff; }
    .pop { position: absolute; width: 300px; padding: 12px; border-radius: 12px; background: #222; color: #ececea;
      box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 18px 48px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .label { font: 500 10.5px ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: #8a8985; }
    textarea, input { width: 100%; font: inherit; color: #ececea; background: #1b1b1b; border: 0; border-radius: 6px; padding: 8px 10px; resize: none; outline: none; }
    textarea:focus, input:focus { box-shadow: 0 0 0 1px #4d8dff; }
    .row { display: flex; justify-content: flex-end; gap: 6px; }
    .row button { height: 30px; padding: 0 12px; border-radius: 6px; background: none; color: #a3a29d; }
    .row button.primary { background: #ececea; color: #141414; }
    .row button[disabled] { opacity: .45; cursor: default; }
    .meta { color: #8a8985; font: 500 10.5px ui-monospace, monospace; }
    q { quotes: none; }
  </style>
  <div class="shield"></div>
  <div class="layer"></div>
  <div class="bar"><b>Canon</b><button class="toggle" aria-pressed="false">Comment</button></div>`;

  const shield = root.querySelector('.shield');
  const layer = root.querySelector('.layer');
  const toggle = root.querySelector('.toggle');
  const width = () => document.documentElement.clientWidth;

  const setCommenting = (on) => {
    commenting = on;
    shield.classList.toggle('on', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Click where it happened · Esc' : `Comment${notes.length ? ` · ${notes.length}` : ''}`;
  };

  const render = () => {
    layer.innerHTML = '';
    notes.forEach((n, i) => {
      const pin = document.createElement('button');
      pin.className = `pin ${n.source === 'preview' ? '' : 'canvas'}`;
      pin.textContent = String(i + 1);
      pin.style.left = `${(n.fx || 0) * width()}px`;
      pin.style.top = `${n.py != null ? n.py : (n.fy || 0) * (frame ? frame.h : 800)}px`;
      pin.title = n.said;
      pin.onclick = (e) => { e.stopPropagation(); show(n, pin); };
      layer.appendChild(pin);
    });
    if (!commenting) setCommenting(false);
  };

  const closePop = () => root.querySelectorAll('.pop, .pin.draft').forEach((el) => el.remove());

  const show = (n, pin) => {
    closePop();
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.style.left = `${parseFloat(pin.style.left) + 16}px`;
    pop.style.top = `${parseFloat(pin.style.top) - 10}px`;
    const q = document.createElement('q');
    q.textContent = n.said;
    pop.appendChild(q);
    if (n.meant) {
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = `Meant, a reading: ${n.meant}`;
      pop.appendChild(m);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${/^P-\d+$/.test(n.participant || '') ? n.participant : 'No participant'} · ${new Date(n.createdAt).toLocaleDateString()}`;
    pop.appendChild(meta);
    layer.appendChild(pop);
  };

  const compose = (x, y) => {
    closePop();
    const fx = x / width();
    const draft = document.createElement('span');
    draft.className = 'pin draft';
    draft.textContent = '+';
    draft.style.left = `${x}px`;
    draft.style.top = `${y}px`;
    layer.appendChild(draft);
    const pop = document.createElement('form');
    pop.className = 'pop';
    pop.style.left = `${Math.min(x + 16, width() - 316)}px`;
    pop.style.top = `${Math.max(8, y - 10)}px`;
    pop.innerHTML = `<div class="label">Said · word for word</div>
      <textarea rows="3" name="said" placeholder="What they said, in their words"></textarea>
      <input name="who" placeholder="Who, as a code: P-04 (never a name)">
      <textarea rows="2" name="meant" placeholder="What you think they meant (optional)"></textarea>
      <div class="row"><button type="button" class="cancel">Cancel</button><button class="primary" disabled>File note</button></div>`;
    const said = pop.querySelector('[name=said]');
    const save = pop.querySelector('.primary');
    said.oninput = () => (save.disabled = !said.value.trim());
    pop.querySelector('.cancel').onclick = () => { closePop(); };
    pop.onsubmit = async (e) => {
      e.preventDefault();
      if (!said.value.trim() || !frame) return;
      const note = {
        id: uid(), boardId: frame.boardId, frameId, page, fx, py: Math.round(y), source: 'preview',
        said: said.value.trim(),
        meant: pop.querySelector('[name=meant]').value.trim() || undefined,
        participant: pop.querySelector('[name=who]').value.trim() || undefined,
        createdAt: Date.now(),
      };
      const d = await db();
      await req(d.transaction('notes', 'readwrite').objectStore('notes').put(note));
      notes.push(note);
      if (channel) channel.postMessage({ type: 'notes-changed' });
      closePop();
      render();
    };
    layer.appendChild(pop);
    said.focus();
  };

  shield.addEventListener('click', (e) => {
    setCommenting(false);
    compose(e.clientX + scrollX, e.clientY + scrollY);
  });
  toggle.addEventListener('click', () => { closePop(); setCommenting(!commenting); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); setCommenting(false); } });
  addEventListener('resize', render);

  const load = async () => {
    const d = await db();
    frame = await req(d.transaction('frames').objectStore('frames').get(frameId));
    const all = await req(d.transaction('notes').objectStore('notes').getAll());
    const entry = frame && frame.entry;
    notes = all.filter((n) => n.frameId === frameId && (n.page || entry) === page).sort((a, b) => a.createdAt - b.createdAt);
    render();
  };
  if (channel) channel.onmessage = load;

  const mount = () => { document.body.appendChild(host); load(); };
  if (document.body) mount();
  else addEventListener('DOMContentLoaded', mount);
})();
