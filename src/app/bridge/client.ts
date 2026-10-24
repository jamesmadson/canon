/**
 * The tab side of the bridge. One Canon tab (the holder of the Web Lock
 * 'canon-bridge') long-polls each local port a `canon mcp` might be on, runs
 * the commands it gets back, and sends the replies on its next poll.
 *
 * /who only says which agent claims a port; anything can answer it. What
 * proves an answer came from the paired MCP is checkResponse: a MAC with the
 * agent's secret, role 'mcp', and the nonce this tab just sent.
 *
 * The holder may be a background tab, so every Canon tab reports where it is
 * ('here') and the commands act on the tab the person looked at last.
 */

import * as db from '../db';
import type { Agent } from '../db';
import * as store from '../store';
import { type Address, parseAddress } from '../lib/address';
import { sign, verify, newNonce } from './auth';
import { runOp, type OpsDeps } from './ops';

export const BRIDGE_PORTS = Array.from({ length: 10 }, (_, i) => 47800 + i);
const AGENT_ID = /^[a-z0-9-]{1,64}$/;
const SECRET = /^[0-9a-f]{64}$/;
const MAX_SKEW = 30_000;
const PROBE_VISIBLE = 2_000; // how often an empty port is knocked on while Canon is in view
const PROBE_HIDDEN = 10_000; // and while it is in a background tab
const MIN_POLL = 1_000; // an empty answer sooner than this waits out the rest
const POLL_TIMEOUT = 40_000; // the MCP holds a poll for 25 s
const REPLY_BUDGET = 56 * 1024; // the MCP takes 64 KB per poll body

export interface Command { id: string; op: string; args: unknown }
export interface PairLink { agentId: string; port: number; secret: string; name: string }

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export const newTabId = () => hex(crypto.getRandomValues(new Uint8Array(16)));

/** A pairing link in the hash: null when there is none, 'bad' when it is malformed. */
export function parsePairLink(hash: string): PairLink | 'bad' | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith('pair=')) return null;
  const params = new URLSearchParams(raw);
  const parts = (params.get('pair') ?? '').split('.');
  if (parts.length !== 3) return 'bad';
  const [agentId, portText, secret] = parts;
  const port = /^\d{5}$/.test(portText) ? Number(portText) : NaN;
  if (!AGENT_ID.test(agentId) || !BRIDGE_PORTS.includes(port) || !SECRET.test(secret)) return 'bad';
  const name = (params.get('name') ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || agentId;
  return { agentId, port, secret, name };
}

const TOO_LARGE = 'The answer is too large. Narrow it down.';
const STALE = 'Canon could not read the latest changes from its other tabs. Try again.';
const encoder = new TextEncoder();
/** Bytes a reply adds to the poll body: it travels as JSON inside the payload string, so it is escaped twice. */
const replyCost = (r: object) => encoder.encode(JSON.stringify(JSON.stringify(r))).length;

/** Keep one poll's replies under budget: once the running total passes it, later replies become a too-large error. */
export function fitReplies(replies: { id: string; [k: string]: unknown }[], budget = REPLY_BUDGET): object[] {
  let used = 0;
  return replies.map((r) => {
    const cost = replyCost(r);
    if (used + cost <= budget) {
      used += cost;
      return r;
    }
    const small = { id: r.id, ok: false, error: TOO_LARGE };
    used += replyCost(small);
    return small;
  });
}

/** What the pairing dialog must add: a warning when this replaces a different, existing pairing. */
export function pairNotice(existing: Pick<Agent, 'name' | 'secret'> | undefined, link: PairLink): string | null {
  return existing && existing.secret !== link.secret ? `This replaces the existing connection for ${existing.name}.` : null;
}

/** The commands in a /poll answer, or null unless the paired MCP signed it for this very poll. */
export async function checkResponse(
  body: unknown,
  want: { secret: string; agentId: string; nonce: string; now: number },
): Promise<Command[] | null> {
  if (!body || typeof body !== 'object') return null;
  const { ts, nonce, mac, payload } = body as Record<string, unknown>;
  if (typeof ts !== 'number' || !Number.isInteger(ts) || Math.abs(want.now - ts) > MAX_SKEW) return null;
  if (nonce !== want.nonce || typeof mac !== 'string' || typeof payload !== 'string') return null;
  if (!(await verify({ secret: want.secret, role: 'mcp', agentId: want.agentId, ts, nonce, payload, mac }))) return null;
  let commands: unknown;
  try {
    commands = JSON.parse(payload).commands;
  } catch {
    return null;
  }
  if (!Array.isArray(commands)) return null;
  const ok = commands.every((c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.op === 'string');
  return ok ? (commands as Command[]) : null;
}

/* ── What the sidebar shows: paired agents and which are connected ─────── */
let agents: Agent[] = [];
let connected = new Set<string>(); // a verified answer came back
let connecting = new Set<string>(); // polling, nothing verified yet
let holding = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export const bridgeView = () => ({ agents, connected, connecting });
export function subscribeBridge(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Pairing and disconnecting can happen in any tab; the holder may be another one.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('canon-bridge');
type Msg =
  | { type: 'agents' }
  | { type: 'ask' }
  | { type: 'status'; connected: string[]; connecting: string[] }
  | { type: 'here'; tab: string; hash: string; at: number }
  | { type: 'gone'; tab: string }
  | { type: 'navigate'; tab: string; hash: string };
const post = (m: Msg) => channel?.postMessage(m);

/* ── Where the person is looking: the Canon tab focused last ───────────── */
type Report = { hash: string; at: number };

/** The tab the person looked at last, and its hash: the latest `at` wins, and this tab wins a tie. */
export function activeHash(reports: Map<string, Report>, own: { tab: string; hash: string; at: number }): { tab: string; hash: string } {
  let best = { tab: own.tab, hash: own.hash, at: own.at };
  for (const [tab, r] of reports) if (r.at > best.at) best = { tab, hash: r.hash, at: r.at };
  return { tab: best.tab, hash: best.hash };
}

/** Whether a hash another tab asks this one to show is one of the app's own routes. Pair links and anything else are refused. */
export function acceptNavigate(hash: string): boolean {
  if (typeof hash !== 'string' || hash.length > MAX_HASH || !hash.startsWith('#/') || hash.indexOf('#', 1) >= 0) return false;
  if (parsePairLink(hash) !== null) return false;
  // parseAddress falls back to home on anything it can't read, so home counts only when it was asked for.
  return parseAddress(hash).name !== 'home' || hash === '#/';
}

const MAX_HASH = 2048;
const MAX_AHEAD = 5_000; // how far into the future another tab's `at` may claim

/** The hash a tab may tell the others: one of the app's routes, else home. A pairing link (its secret) never leaves the tab. */
export const reportHash = (hash: string) => (acceptNavigate(hash) ? hash : '#/');

/** Store another tab's 'here' report, sanitised: its hash as reportHash, its `at` no later than a moment from now. */
export function takeReport(reports: Map<string, Report>, m: { tab?: unknown; hash?: unknown; at?: unknown }, self: string, now: number) {
  if (typeof m.tab !== 'string' || m.tab === self || typeof m.hash !== 'string' || typeof m.at !== 'number' || !Number.isFinite(m.at)) return;
  reports.set(m.tab, { hash: reportHash(m.hash), at: Math.min(m.at, now + MAX_AHEAD) });
}

/** This page, as the other tabs know it. Not an agent's tabId, which stays the same for the whole browser. */
const pageId = newTabId();
let lookedAt = 0; // when the person last focused or revealed this tab
const reports = new Map<string, Report>(); // the other Canon tabs
const ownHash = () => (typeof location === 'undefined' ? '#/' : reportHash(location.hash));
const here = () => activeHash(reports, { tab: pageId, hash: ownHash(), at: lookedAt });
const postHere = () => post({ type: 'here', tab: pageId, hash: ownHash(), at: lookedAt });

/** Show a hash in this tab, if it is one of the app's routes. */
function showHere(hash: string) {
  if (!acceptNavigate(hash)) return;
  location.hash = hash;
  try {
    window.focus();
  } catch {
    // best effort: browsers may refuse to raise a background tab
  }
}

/** The route the commands act on. */
const activeRoute = (): Address => parseAddress(here().hash);
/** Open a hash in the tab the person looked at last: this one, or another through the channel. */
function navigateActive(hash: string) {
  const target = here().tab;
  if (target === pageId) showHere(hash);
  else post({ type: 'navigate', tab: target, hash });
}

const changeWaiters = new Set<() => void>();
function agentsChanged() {
  [...changeWaiters].forEach((fn) => fn());
}
// Ports waiting to knock again: coming back into view or focus knocks at once.
const probeWaiters = new Set<() => void>();
function wakeProbes() {
  [...probeWaiters].forEach((fn) => fn());
}

/** How long an empty port waits before the next knock. A hidden tab knocks less, and the browser throttles it anyway. */
export const probeDelay = (hidden: boolean) => (hidden ? PROBE_HIDDEN : PROBE_VISIBLE);
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

// One controller per port's poll loop, so removing or re-pairing an agent ends every held poll it has at once,
// even when two sessions of the same agent sit on two ports.
const pollAborts = new Map<number, { ctl: AbortController; agent: Agent }>();

/** The ports whose poll belongs to a pairing that is no longer in the list. */
export function stalePolls(polls: Map<number, { agent: Pick<Agent, 'id' | 'secret' | 'tabId'> }>, list: Pick<Agent, 'id' | 'secret' | 'tabId'>[]): number[] {
  const live = (p: Pick<Agent, 'id' | 'secret' | 'tabId'>) => list.some((a) => a.id === p.id && a.secret === p.secret && a.tabId === p.tabId);
  return [...polls].filter(([, p]) => !live(p.agent)).map(([port]) => port);
}

async function refreshAgents() {
  try {
    agents = await db.getAll<Agent>('agents');
    for (const port of stalePolls(pollAborts, agents)) pollAborts.get(port)?.ctl.abort();
  } catch (err) {
    console.warn('Canon: could not read paired agents.', err);
  }
  emit();
  agentsChanged();
}

export async function saveAgent(link: PairLink) {
  // Re-pairing the same agent keeps this browser's tabId, so a claim the MCP already holds still matches.
  const tabId = (await db.get<Agent>('agents', link.agentId))?.tabId ?? newTabId();
  await db.put('agents', { id: link.agentId, name: link.name, secret: link.secret, tabId, pairedAt: Date.now() } satisfies Agent);
  post({ type: 'agents' });
  await refreshAgents();
}

export async function removeAgent(id: string) {
  await db.remove('agents', id);
  post({ type: 'agents' });
  await refreshAgents();
}

const byPort = new Map<number, { id: string; verified: boolean }>();
const postStatus = () => post({ type: 'status', connected: [...connected], connecting: [...connecting] });
function setLink(port: number, agentId: string | null, verified = false) {
  const was = byPort.get(port);
  if ((was?.id ?? null) === agentId && (was?.verified ?? false) === verified) return;
  if (agentId) byPort.set(port, { id: agentId, verified });
  else byPort.delete(port);
  const links = [...byPort.values()];
  connected = new Set(links.filter((l) => l.verified).map((l) => l.id));
  connecting = new Set(links.filter((l) => !l.verified && !connected.has(l.id)).map((l) => l.id));
  emit();
  postStatus();
}

/* ── Polling ───────────────────────────────────────────────────────────── */
interface Ctx {
  stopped: boolean;
  signal: AbortSignal;
  appBase: string;
}

/** Resolves after ms, or sooner when the agent list changes or the client stops. A probe wait also ends on wakeProbes. */
function sleep(ctx: Ctx, ms: number, probe = false) {
  return new Promise<void>((resolve) => {
    if (ctx.stopped) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      changeWaiters.delete(done);
      probeWaiters.delete(done);
      ctx.signal.removeEventListener('abort', done);
      resolve();
    }
    changeWaiters.add(done);
    if (probe) probeWaiters.add(done);
    ctx.signal.addEventListener('abort', done);
  });
}
const untilChanged = (ctx: Ctx) => sleep(ctx, 2 ** 31 - 1);
const untilProbe = (ctx: Ctx) => sleep(ctx, probeDelay(isHidden()), true);

let warned = false;
function warnOnce(port: number) {
  if (warned) return;
  warned = true;
  console.warn(`Canon: ignored an answer on port ${port} that was not signed by the paired agent.`);
}

const currentAgent = (a: Agent) => agents.find((x) => x.id === a.id && x.secret === a.secret && x.tabId === a.tabId);

function opsDeps(ctx: Ctx, agent: Agent): OpsDeps {
  return {
    state: store.getState,
    route: activeRoute,
    createProject: (name) => store.createProject(name),
    createBoard: (projectId, name) => store.createBoard(projectId, name),
    addUrl: store.addUrl,
    addUrlVersion: store.addUrlVersion,
    updateFrame: (id, patch) => store.updateFrame(id, patch),
    placeOnBoard: (boardId, frameId) => store.placeOnBoard(boardId, frameId),
    moveToBoard: store.moveToBoard,
    navigate: navigateActive,
    appBase: ctx.appBase,
    agentName: agent.name,
    toast: store.toast,
  };
}

async function who(port: number, ctx: Ctx): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/who`, { cache: 'no-store', signal: ctx.signal });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.agentId === 'string' ? body.agentId : null;
  } catch {
    return null;
  }
}

type End = 'refused' | 'unauthorized' | 'bad' | 'changed';

async function pollLoop(port: number, agent: Agent, ctx: Ctx): Promise<End> {
  const mine = { ctl: new AbortController(), agent };
  pollAborts.set(port, mine);
  try {
    return await pollLoopInner(port, agent, ctx, mine.ctl.signal);
  } finally {
    if (pollAborts.get(port) === mine) pollAborts.delete(port);
  }
}

async function pollLoopInner(port: number, agent: Agent, ctx: Ctx, own: AbortSignal): Promise<End> {
  let replies: object[] = [];
  while (!ctx.stopped) {
    if (!currentAgent(agent)) return 'changed';
    const nonce = newNonce();
    const ts = Date.now();
    const payload = JSON.stringify({ replies });
    const mac = await sign({ secret: agent.secret, role: 'tab', agentId: agent.id, ts, nonce, payload });
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`http://127.0.0.1:${port}/poll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, tabId: agent.tabId, ts, nonce, mac, payload }),
        cache: 'no-store',
        signal: typeof AbortSignal.any === 'function' ? AbortSignal.any([ctx.signal, own, AbortSignal.timeout(POLL_TIMEOUT)]) : ctx.signal,
      });
    } catch {
      return own.aborted ? 'changed' : 'refused';
    }
    replies = [];
    if (res.status === 401) return 'unauthorized';
    if (!res.ok) return 'bad';
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return 'bad';
    }
    const commands = await checkResponse(body, { secret: agent.secret, agentId: agent.id, nonce, now: Date.now() });
    if (!commands) {
      warnOnce(port);
      return 'bad';
    }
    setLink(port, agent.id, true);
    // Disconnected while the poll was out: run nothing.
    if (!currentAgent(agent) || ctx.stopped) return 'changed';
    const deps = opsDeps(ctx, agent);
    const done: { id: string; [k: string]: unknown }[] = [];
    if (commands.length) {
      // This tab may be behind another tab's writes: catch up before acting, or run nothing.
      try {
        await store.refreshIfStale();
      } catch {
        if (!currentAgent(agent) || ctx.stopped) return 'changed';
        replies = fitReplies(commands.map((c) => ({ id: c.id, ok: false, error: STALE })));
        continue;
      }
    }
    for (const c of commands) {
      // Disconnected mid-batch: stop here, and send nothing back on a pairing that is gone.
      if (!currentAgent(agent) || ctx.stopped) return 'changed';
      done.push({ id: c.id, ...(await runOp(c.op, c.args, deps)) });
    }
    replies = fitReplies(done);
    if (!commands.length && Date.now() - started < MIN_POLL) await sleep(ctx, MIN_POLL);
  }
  return 'changed';
}

async function portWorker(port: number, ctx: Ctx) {
  while (!ctx.stopped) {
    if (!agents.length) {
      await untilChanged(ctx);
      continue;
    }
    const id = await who(port, ctx);
    const agent = agents.find((a) => a.id === id);
    if (!agent) {
      await untilProbe(ctx);
      continue;
    }
    setLink(port, agent.id);
    const end = await pollLoop(port, agent, ctx);
    setLink(port, null);
    // The MCP turned this tab away: wait for a new pairing rather than knock again.
    if (end === 'unauthorized') await untilChanged(ctx);
    else if (end !== 'changed') await untilProbe(ctx);
  }
}

/** Start the bridge in this tab. Returns stop. */
export function startBridgeClient(opts: { appBase: string; ports?: number[] }): () => void {
  const ports = opts.ports ?? BRIDGE_PORTS;
  const abort = new AbortController();
  const ctx: Ctx = { stopped: false, signal: abort.signal, appBase: opts.appBase };

  if (channel) {
    channel.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m?.type === 'agents') refreshAgents();
      else if (m?.type === 'ask') {
        if (holding) postStatus();
        postHere();
      } else if (m?.type === 'here') {
        takeReport(reports, m, pageId, Date.now());
      } else if (m?.type === 'gone') {
        if (typeof m.tab === 'string') reports.delete(m.tab);
      } else if (m?.type === 'navigate') {
        if (m.tab === pageId && typeof m.hash === 'string') showHere(m.hash);
      } else if (m?.type === 'status' && !holding) {
        const ids = (v: unknown) => new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
        connected = ids(m.connected);
        connecting = ids(m.connecting);
        emit();
      }
    };
  }
  refreshAgents();
  lookedAt = isHidden() ? 0 : Date.now();
  post({ type: 'ask' });
  postHere();

  const looked = () => {
    lookedAt = Date.now();
    postHere();
  };
  // A background tab's timers are throttled, so knock at once when Canon comes back into view.
  const onVisible = () => {
    if (isHidden()) return;
    wakeProbes();
    looked();
  };
  const onFocus = () => {
    wakeProbes();
    looked();
  };
  const onHash = () => {
    if (typeof document !== 'undefined' && document.hasFocus()) lookedAt = Date.now();
    postHere();
  };
  const onPageHide = () => post({ type: 'gone', tab: pageId });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocus);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('pagehide', onPageHide);
  }

  const run = async () => {
    holding = true;
    // A new holder asks every tab where it is.
    post({ type: 'ask' });
    try {
      await refreshAgents();
      await Promise.all(ports.map((p) => portWorker(p, ctx)));
    } finally {
      holding = false;
      for (const p of ports) setLink(p, null);
    }
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    navigator.locks.request('canon-bridge', { signal: abort.signal }, run).catch(() => {
      // aborted while waiting in line
    });
  } else {
    console.info('Canon: this browser has no Web Locks, so this tab polls the agent bridge without checking for other Canon tabs.');
    run();
  }
  return () => {
    ctx.stopped = true;
    abort.abort();
    reports.clear();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pagehide', onPageHide);
    }
  };
}
