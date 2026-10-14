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
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); res(r.result); };
    r.onerror = () => rej(r.error);
  });
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('canon-app') : null;
  const myName = () => { try { return localStorage.getItem('canon-name') || ''; } catch { return ''; } };
  const initials = (n) => (n.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?');
  const color = (n) => { const c = ['#4d8dff', '#f26d5b', '#3ccf7f', '#c084fc', '#f5b041', '#22c3d6']; let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return c[h % c.length]; };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let boardId = '';

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
      background: rgba(28,28,28,.94); color: #ecebe4; box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 12px 32px rgba(0,0,0,.45); font-size: 13px; }
    .bar b { font-weight: 600; padding: 0 8px 0 10px; }
    button { font: inherit; cursor: pointer; border: 0; }
    .toggle { height: 32px; padding: 0 12px; border-radius: 8px; background: #30312a; color: #ecebe4; }
    .toggle[aria-pressed="true"] { background: #4d8dff; color: #fff; }
    .shield { position: fixed; inset: 0; cursor: crosshair; display: none; background: rgba(77,141,255,.04); }
    .shield.on { display: block; }
    .pin { position: absolute; width: 26px; height: 26px; margin-top: -26px; border-radius: 13px 13px 13px 2px; background: #7ee2a8; color: #111;
      font-size: 11px; font-weight: 700; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
    .pin.canvas { background: #ffd34d; }
    .pin.comment { border-radius: 50% 50% 50% 4px; color: #fff; box-shadow: 0 0 0 2px #fff, 0 3px 10px rgba(0,0,0,.35); }
    .seg { display: inline-flex; background: #22231e; border-radius: 6px; padding: 2px; gap: 2px; align-self: flex-start; }
    .seg button { height: 24px; padding: 0 9px; border-radius: 5px; background: none; color: #a7a597; font-size: 12px; }
    .seg button[aria-pressed="true"] { background: #30312a; color: #ecebe4; }
    .msg { display: flex; gap: 8px; } .msg b { font-size: 12.5px; } .msg p { margin: 2px 0 0; }
    .av { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 9.5px; font-weight: 700; flex: none; }
    .reply { display: flex; gap: 6px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 8px; }
    .reply input { flex: 1; }
    .pin.draft { background: #4d8dff; color: #fff; }
    .pop { position: absolute; width: 300px; padding: 12px; border-radius: 12px; background: #282923; color: #ecebe4;
      box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 18px 48px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .label { font: 500 10.5px ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: #8a8985; }
    textarea, input { width: 100%; font: inherit; color: #ecebe4; background: #22231e; border: 0; border-radius: 6px; padding: 8px 10px; resize: none; outline: none; }
    textarea:focus, input:focus { box-shadow: 0 0 0 1px #4d8dff; }
    .row { display: flex; justify-content: flex-end; gap: 6px; }
    .row button { height: 30px; padding: 0 12px; border-radius: 6px; background: none; color: #a7a597; }
    .row button.primary { background: #ecebe4; color: #171814; }
    .row button[disabled] { opacity: .45; cursor: default; }
    .meta { color: #8a8985; font: 500 10.5px ui-monospace, monospace; }
    q { quotes: none; }
  </style>
  <div class="shield"></div>
  <div class="layer"></div>
  <div class="bar"><b>Canon</b><button class="toggle" aria-pressed="false">Note</button></div>`;

  const shield = root.querySelector('.shield');
  const layer = root.querySelector('.layer');
  const toggle = root.querySelector('.toggle');
  const width = () => document.documentElement.clientWidth;

  const setCommenting = (on) => {
    commenting = on;
    shield.classList.toggle('on', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Click where it happened · Esc' : `Note${notes.length ? ` · ${notes.length}` : ''}`;
  };

  const render = () => {
    layer.innerHTML = '';
    notes.forEach((n, i) => {
      const pin = document.createElement('button');
      const isComment = n.kind === 'comment';
      pin.className = `pin ${isComment ? 'comment' : n.source === 'preview' ? '' : 'canvas'}`;
      pin.textContent = isComment ? initials(n.author || 'You') : String(i + 1);
      if (isComment) pin.style.background = color(n.author || 'You');
      pin.style.left = `${(n.fx || 0) * width()}px`;
      pin.style.top = `${n.py != null ? n.py : (n.fy || 0) * (frame ? frame.h : 800)}px`;
      pin.title = n.said;
      pin.onclick = (e) => { e.stopPropagation(); show(n, pin); };
      layer.appendChild(pin);
    });
    if (!commenting) setCommenting(false);
  };

  const closePop = () => root.querySelectorAll('.pop, .pin.draft').forEach((el) => el.remove());

  const save = async (note) => {
    const d = await db();
    await req(d.transaction('notes', 'readwrite').objectStore('notes').put(note));
    if (channel) channel.postMessage({ type: 'notes-changed' });
  };

  const show = (n, pin) => {
    closePop();
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.style.left = `${parseFloat(pin.style.left) + 16}px`;
    pop.style.top = `${parseFloat(pin.style.top) - 10}px`;
    const who = n.kind === 'comment' ? (n.author || 'You') : (/^P-\d+$/.test(n.participant || '') ? n.participant : 'Research note');
    const first = n.kind === 'comment' ? esc(n.said) : `<q>${esc(n.said)}</q>${n.meant ? `<div class="meta">Meant, a reading: ${esc(n.meant)}</div>` : ''}`;
    pop.innerHTML = `<div class="msg"><span class="av" style="background:${n.kind === 'comment' ? color(who) : '#ffd34d'};${n.kind === 'comment' ? '' : 'color:#111'}">${n.kind === 'comment' ? initials(who) : 'R'}</span><div><b>${esc(who)}</b> <span class="meta">${new Date(n.createdAt).toLocaleDateString()}</span><p>${first}</p></div></div>`
      + (n.replies || []).map((r) => `<div class="msg"><span class="av" style="background:${color(r.author)}">${initials(r.author)}</span><div><b>${esc(r.author)}</b><p>${esc(r.body)}</p></div></div>`).join('')
      + `<form class="reply"><input placeholder="Reply"><button class="primary" style="height:30px;padding:0 12px;border-radius:6px;background:#ecebe4;color:#171814">Reply</button></form>`;
    pop.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const input = pop.querySelector('input');
      if (!input.value.trim()) return;
      n.replies = [...(n.replies || []), { id: uid(), author: myName() || 'You', body: input.value.trim(), createdAt: Date.now() }];
      await save(n);
      show(n, pin);
    };
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
    let mode = 'comment';
    const draw = () => {
      pop.innerHTML = (mode === 'comment'
          ? `${myName() ? '' : '<input name="me" placeholder="Your name, how teammates see you">'}<textarea rows="3" name="said" placeholder="Add a comment"></textarea>`
          : `<div class="label">Said · word for word</div><textarea rows="3" name="said" placeholder="What they said, in their words"></textarea><input name="who" placeholder="Who, as a code: P-04 (never a name)"><textarea rows="2" name="meant" placeholder="What you think they meant (optional)"></textarea>`)
        + `<div class="row"><button type="button" class="cancel">Cancel</button><button class="primary" disabled>${mode === 'comment' ? 'Add' : 'File note'}</button></div>`;
      pop.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
      const said = pop.querySelector('[name=said]');
      const post = pop.querySelector('.primary');
      said.oninput = () => (post.disabled = !said.value.trim());
      said.onkeydown = (e) => { if (mode === 'comment' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pop.requestSubmit(); } };
      pop.querySelector('.cancel').onclick = () => closePop();
      said.focus();
    };
    pop.onsubmit = async (e) => {
      e.preventDefault();
      const said = pop.querySelector('[name=said]');
      if (!said.value.trim() || !frame) return;
      const me = pop.querySelector('[name=me]');
      if (me && me.value.trim()) { try { localStorage.setItem('canon-name', me.value.trim()); } catch {} }
      const base = { id: uid(), boardId, frameId, page, fx, py: Math.round(y), source: 'preview', said: said.value.trim(), createdAt: Date.now() };
      const note = mode === 'comment'
        ? { ...base, kind: 'comment', author: myName() || 'You' }
        : { ...base, kind: 'note', meant: pop.querySelector('[name=meant]').value.trim() || undefined, participant: pop.querySelector('[name=who]').value.trim() || undefined };
      await save(note);
      notes.push(note);
      closePop();
      render();
    };
    draw();
    layer.appendChild(pop);
    pop.querySelector('[name=said]').focus();
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
    if (d.objectStoreNames.contains('placements')) {
      const pls = await req(d.transaction('placements').objectStore('placements').getAll());
      boardId = (pls.find((p) => p.frameId === frameId) || {}).boardId || '';
    }
    const entry = frame && frame.entry;
    notes = all.filter((n) => n.frameId === frameId && n.wx === undefined && !n.resolved && (n.page || entry) === page).sort((a, b) => a.createdAt - b.createdAt);
    render();
  };
  if (channel) channel.onmessage = load;

  const mount = () => { document.body.appendChild(host); load(); };
  if (document.body) mount();
  else addEventListener('DOMContentLoaded', mount);
})();
