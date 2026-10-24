// Drives the real `canon mcp --dev` over stdio, as an agent would, against a
// Canon dev server and headless Chrome (raw CDP, no dependencies).
//   npm run dev -- --host 127.0.0.1   (in another shell)
//   node scripts/mcp-e2e.mjs
// Chrome maps localhost to 127.0.0.1 so a dev server on IPv4 counts as the
// dev origin. A temp HOME keeps your real ~/.canon untouched. Not part of npm test.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = 'http://localhost:4321/canon/app/';
const BIN = new URL('../cli/bin/canon.js', import.meta.url).pathname;
const HOME = mkdtempSync(join(tmpdir(), 'canon-home-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`); };

class Agent {
  constructor(name) { this.name = name; this.id = 0; this.waiting = new Map(); this.port = null; }
  async start() {
    this.proc = spawn('node', [BIN, 'mcp', '--dev'], { env: { ...process.env, HOME }, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    this.proc.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); this.waiting.get(m.id)?.(m); } });
    this.proc.stderr.on('data', (d) => { const m = /port (\d+)/.exec(String(d)); if (m) this.port = Number(m[1]); });
    await this.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: this.name, version: '1' } });
    return this;
  }
  rpc(method, params) { return new Promise((r) => { const id = ++this.id; this.waiting.set(id, r); this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); }); }
  async call(name, args = {}) { const t = Date.now(); const r = (await this.rpc('tools/call', { name, arguments: args })).result; return { text: r.content[0].text, error: Boolean(r.isError), ms: Date.now() - t }; }
  stop() { this.proc.kill(); }
}

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9340', '--host-resolver-rules=MAP localhost 127.0.0.1', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cc-'))}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let targets; for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch('http://127.0.0.1:9340/json')).json(); } catch { await sleep(250); } }

class Page {
  async open(url) {
    const t = await (await fetch(`http://127.0.0.1:9340/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
    this.target = t.id; this.seq = 0; this.waiting = new Map();
    this.ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (this.ws.onopen = r));
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) this.waiting.get(m.id)?.(m); else if (m.method === 'Page.javascriptDialogOpening') this.cdp('Page.handleJavaScriptDialog', { accept: true }); };
    await this.cdp('Page.enable'); await this.cdp('Page.navigate', { url });
  }
  cdp(method, params = {}) { return new Promise((r) => { const id = ++this.seq; this.waiting.set(id, r); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async ev(x) { return (await this.cdp('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value; }
  async until(x, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await this.ev(x); if (v) return v; await sleep(150); } return null; }
  async close() { await this.cdp('Page.close'); this.ws.close(); }
}
const linkOf = (t) => /https?:\/\/\S+#pair=\S+/.exec(t)?.[0];
const connectNow = (p) => p.ev(`[...document.querySelectorAll('.dialog button')].find(b => b.textContent === 'Connect')?.click()`);
const connected = async (agent) => { for (let i = 0; i < 60; i++) { const r = await agent.call('canon_status'); if (!r.error) return r; await sleep(1000); } return null; };

try {
  const a = await new Agent('Claude Code').start();
  console.log(`MCP A on port ${a.port}`);
  const tool = await a.rpc('tools/list', {});
  check('tools/list has seven tools', tool.result.tools.length === 7, tool.result.tools.map((t) => t.name).join(','));

  const first = await a.call('canon_add', { url: 'http://localhost:4321/canon/', board: 'MCP test', name: 'Canon home' });
  const pairUrl = linkOf(first.text);
  check('unpaired add returns a pairing link', first.error && Boolean(pairUrl), first.text.replace(/\n/g, ' | '));

  const page = new Page(); await page.open(pairUrl);
  check('pair dialog names the agent', Boolean(await page.until(`document.querySelector('#pair-title')?.textContent?.includes('Claude Code')`)));
  await connectNow(page);
  check('connect toast', Boolean(await page.until(`document.querySelector('.toast')?.textContent?.includes('Connected Claude Code')`)));
  check('status answers once the tab is connected', Boolean(await connected(a)));

  const add = await a.call('canon_add', { url: 'http://localhost:4321/canon/', board: 'MCP test', name: 'Canon home' });
  check('add succeeds', !add.error, add.text.replace(/\s+/g, ' ').slice(0, 160));
  check('add toasts and the board exists', Boolean(await page.until(`document.querySelector('.toast')?.textContent?.includes('added Canon home') || document.body.innerText.includes('MCP test')`)));

  const ren = await a.call('canon_update', { frame: 'Canon home', name: 'Home page' });
  check('rename succeeds', !ren.error, ren.text.replace(/\s+/g, ' ').slice(0, 160));
  const upd = await a.call('canon_update', { frame: 'Home page', url: 'http://localhost:4321/canon/app/' });
  check('URL change succeeds', !upd.error, upd.text.replace(/\s+/g, ' ').slice(0, 200));
  const found = await a.call('canon_find', { query: 'Home' });
  check('find shows version 2', /"version": 2/.test(found.text), found.text.replace(/\s+/g, ' ').slice(0, 200));

  const open = await a.call('canon_open', { board: 'MCP test', frame: 'Home page', full: true, width: 'phone' });
  const hash = await page.until(`location.hash.includes('/full') && location.hash`);
  check('open full screen navigates the tab at phone width', !open.error && Boolean(hash) && /w=390/.test(hash), `${hash} | ${open.text.replace(/\s+/g, ' ').slice(0, 160)}`);
  const link = await a.call('canon_link', { board: 'MCP test', frame: 'Home page', version: 1 });
  const v1 = /https?:\/\/[^\s"]+#[^\s"]+/.exec(link.text)?.[0];
  check('link to v1 carries v=1', !link.error && /v=1/.test(v1 ?? ''), v1);
  const p2 = new Page(); await p2.open(v1);
  await p2.until(`document.querySelector('.focus iframe')?.src`); await sleep(1500);
  const src = await p2.ev(`document.querySelector('.focus iframe')?.src + ' | ' + location.hash + ' | ' + document.querySelector('select[aria-label=Version]')?.value`);
  check('v1 link opens the v1 URL', src.startsWith('http://localhost:4321/canon/ |'), String(src));
  await p2.close();

  // Failure paths
  await page.close();
  await sleep(200); const gone = await a.call('canon_status');
  check('Canon closed: answers within 3 s with the open link', gone.error && gone.ms < 3000 && gone.text.includes(APP), `${gone.ms} ms | ${gone.text.replace(/\n/g, ' | ')}`);

  const page2 = new Page(); await page2.open(APP);
  check('reopened Canon reconnects on its own', Boolean(await connected(a)));
  const b = await new Agent('Codex').start();
  console.log(`MCP B on port ${b.port}`);
  check('two MCP processes use different ports', a.port !== b.port && [a.port, b.port].every((p) => p >= 47800), `${a.port}, ${b.port}`);
  const bl = linkOf((await b.call('canon_status')).text);
  await page2.cdp('Page.navigate', { url: 'about:blank' }); await sleep(300); await page2.cdp('Page.navigate', { url: bl });
  await page2.until(`document.querySelector('#pair-title')`); await connectNow(page2);
  await page2.until(`document.querySelector('.agent')`);
  check('B connects', Boolean(await connected(b)));
  const [sa, sb] = await Promise.all([a.call('canon_status'), b.call('canon_status')]);
  check('both work against the one tab', !sa.error && !sb.error, `${sa.text.replace(/\s+/g, ' ')} || ${sb.text.replace(/\s+/g, ' ')}`);
  const [fa, fb] = await Promise.all([a.call('canon_find'), b.call('canon_find')]);
  check('both can read the same board', fa.text.includes('MCP test') && fb.text.includes('MCP test'));

  await page2.ev(`[...document.querySelectorAll('.agent')].find(n => n.textContent.includes('Claude Code'))?.querySelector('button')?.click()`);
  await sleep(1500);
  const after = await a.call('canon_status');
  check('after Disconnect, the next call answers within 3 s and says to run canon_pair', after.error && after.ms < 3000 && after.text.includes('run canon_pair'), `${after.ms} ms | ${after.text.replace(/\n/g, ' | ')}`);
  const again = await a.call('canon_pair');
  const relink = linkOf(again.text);
  check('canon_pair gives a link', Boolean(relink));
  await page2.cdp('Page.navigate', { url: 'about:blank' }); await sleep(300); await page2.cdp('Page.navigate', { url: relink });
  await page2.until(`document.querySelector('#pair-title')`); await connectNow(page2);
  check('the new link pairs again', Boolean(await connected(a)));
  const stillB = await b.call('canon_status');
  check('the other agent is unaffected', !stillB.error);
  a.stop(); b.stop();
} finally {
  chrome.kill();
  const bad = results.filter((r) => !r).length;
  console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
  process.exit(bad ? 1 : 0);
}
