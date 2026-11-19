/**
 * Tester mode: an opt-in list of what a person did in Canon, kept in this
 * browser only. It records counts, durations, booleans and fixed codes, never
 * a name, a link, a file name, text the person typed or anything from a page.
 * The one door in is record(), and it refuses anything outside the allowlists
 * below. Nothing here sends anything: sending is a button in the panel.
 */

export const EVENT_NAMES = [
  'app_open', 'view', 'home_layout', 'search', 'add_start', 'add_done', 'add_error', 'prototype_open', 'version_step', 'versions_menu',
  'make_current', 'note_save', 'star', 'archive', 'live_toggle', 'open_new_tab', 'pair_start', 'pair_done', 'feedback_open', 'feedback_sent', 'error',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** The only words a detail may be. Anything else is dropped, so a name or a link cannot get in as a value. */
export const CODES = new Set([
  'home', 'project', 'board', 'prototype', 'search', 'starred', 'archive', 'tag',
  'list', 'shelf', 'link', 'file', 'folder', 'agent', 'stored',
  'invalid_url', 'no_html', 'too_large', 'failed', 'script', 'unhandled', 'storage',
  'prev', 'next', 'menu', 'key', 'on', 'off',
]);

export interface TesterEvent { t: number; e: EventName; d?: Record<string, number | boolean | string> }

export const CAP = 2000;
const LIST_KEY = 'canon-tester-events';
const MODE_KEY = 'canon-tester-on';
const KEY_NAME = /^[a-z][a-z_]{0,19}$/;

const names = new Set<string>(EVENT_NAMES);
const listeners = new Set<() => void>();
let on = false;
let events: TesterEvent[] = [];
let loaded = false;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the list stays in memory */ }
}
/** Read both keys again. Every stored event goes through the same allowlist as a new one, so edited storage cannot add free text. */
function refresh() {
  on = read<boolean>(MODE_KEY, false) === true;
  const stored = read<unknown>(LIST_KEY, []);
  events = Array.isArray(stored)
    ? (stored as TesterEvent[])
      .filter((x) => x && typeof x.t === 'number' && Number.isFinite(x.t) && names.has(x.e))
      .map((x) => { const d = cleanDetails(x.d); return { t: x.t, e: x.e, ...(d ? { d } : {}) }; })
      .slice(-CAP)
    : [];
}
function load() {
  if (loaded) return;
  loaded = true;
  refresh();
}
const tell = () => listeners.forEach((f) => f());

/** Another tab changed the mode or the list: follow it. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== MODE_KEY && e.key !== LIST_KEY) return;
    loaded = true;
    refresh();
    tell();
  });
}

/** Keep only numbers, booleans and fixed codes under plain keys. */
export function cleanDetails(d: Record<string, unknown> | undefined): TesterEvent['d'] {
  const out: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(d ?? {})) {
    if (!KEY_NAME.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(0, Math.min(1e9, Math.round(v)));
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && CODES.has(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Note that something happened. Does nothing while tester mode is off. */
export function record(name: EventName, details?: Record<string, unknown>) {
  load();
  if (!names.has(name)) return;
  // Read storage again, so another tab's stop, delete or new events are not overwritten.
  refresh();
  if (!on) { tell(); return; }
  const d = cleanDetails(details);
  events.push({ t: Date.now(), e: name, ...(d ? { d } : {}) });
  if (events.length > CAP) events = events.slice(-CAP);
  write(LIST_KEY, events);
  tell();
}

export const testerOn = () => (load(), on);
export const listEvents = (): TesterEvent[] => (load(), [...events].reverse());

export function setTester(next: boolean) {
  load();
  on = next;
  write(MODE_KEY, next);
  tell();
}

/** Turn the mode off and throw the list away. */
export function stopAndDelete() {
  load();
  on = false;
  events = [];
  write(MODE_KEY, false);
  try { localStorage.removeItem(LIST_KEY); } catch { /* nothing to remove */ }
  tell();
}

export function subscribeTester(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** For tests: forget what was read, so the next call reads storage again. */
export function resetTester() {
  loaded = false;
  on = false;
  events = [];
  listeners.clear();
}

/* ── What is sent ──────────────────────────────────────────────────────── */

export const SESSION_LIMIT = 60_000;

/** The events as the downloaded file holds them: oldest first. The list the app shows is newest first. */
export const sessionEvents = (newestFirst: TesterEvent[]): TesterEvent[] => [...newestFirst].reverse();

const size = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).length;

/** Largest count from 0 to max for which fits(count) holds, given that it holds for smaller counts. */
function mostThatFit(max: number, fits: (n: number) => boolean): number {
  let lo = 0;
  let hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/**
 * The fields a sent session adds: the readable lines, and the same events as
 * compact JSON so sessions can be tallied. With the rest of the payload the
 * total stays under the limit. The oldest events leave the JSON first, then
 * the oldest lines, and a note says what was dropped.
 */
export function sessionFields(newestFirst: TesterEvent[], base: Record<string, unknown> = {}, limit = SESSION_LIMIT) {
  const lines = newestFirst.map(describeEvent);
  const chrono = sessionEvents(newestFirst);
  const build = (jsonFrom: number, lineCount: number, note?: string) => ({
    ...base, session: lines.slice(0, lineCount), session_json: JSON.stringify(chrono.slice(jsonFrom)), ...(note ? { session_note: note } : {}),
  });
  const total = chrono.length;
  if (size(build(0, lines.length)) < limit) return pick(build(0, lines.length));
  const noteFor = (jsonDropped: number, linesDropped: number) =>
    `Over the 60 KB limit, so the oldest ${jsonDropped} ${jsonDropped === 1 ? 'event was' : 'events were'} left out of session_json${linesDropped ? ` and the oldest ${linesDropped} ${linesDropped === 1 ? 'line' : 'lines'} out of session` : ''}.`;
  // Keep the newest `keep` events in the JSON; the note's length is part of the size.
  const keep = mostThatFit(total, (k) => size(build(total - k, lines.length, noteFor(total - k, 0))) < limit);
  if (keep > 0) return pick(build(total - keep, lines.length, noteFor(total - keep, 0)));
  const kept = mostThatFit(lines.length, (k) => size(build(total, k, noteFor(total, lines.length - k))) < limit);
  return pick(build(total, kept, noteFor(total, lines.length - kept)));

  function pick(all: ReturnType<typeof build>) {
    const { session, session_json, session_note } = all;
    return { session, session_json, ...(session_note ? { session_note } : {}) };
  }
}

/* ── Lines a person can read ───────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const n = (v: unknown, one: string, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;

export function describeEvent(ev: TesterEvent): string {
  const d = ev.d ?? {};
  const ms = typeof d.ms === 'number' ? `, ${d.ms} ms` : '';
  const text: Record<EventName, string> = {
    app_open: `Opened Canon, ${d.first ? 'first run' : 'returning'}, ${n(d.projects ?? 0, 'project')}, ${n(d.prototypes ?? 0, 'prototype')}`,
    view: `Viewed ${d.view ?? 'a screen'}`,
    home_layout: `Chose the ${d.layout ?? ''} layout`,
    search: `Searched, ${n(d.length ?? 0, 'character')}, ${n(d.results ?? 0, 'result')}`,
    add_start: `Started adding a ${d.kind ?? ''}`,
    add_done: `Added a ${d.kind ?? ''}${ms}`,
    add_error: `Adding failed (${d.code ?? 'failed'})`,
    prototype_open: `Opened a ${d.kind ?? ''} prototype${d.blocked ? ', refuses framing' : ''}${typeof d.ms === 'number' ? `, loaded in ${d.ms} ms` : ''}`,
    version_step: `Stepped to the ${d.dir === 'prev' ? 'previous' : 'next'} version`,
    versions_menu: 'Opened the versions menu',
    make_current: 'Made a version the current one',
    note_save: `Saved a note, ${n(d.length ?? 0, 'character')}`,
    star: d.on ? 'Starred a prototype' : 'Removed a star',
    archive: d.on ? 'Archived a prototype' : 'Restored a prototype',
    live_toggle: d.on ? 'Switched Live on' : 'Switched Live off',
    open_new_tab: 'Opened a prototype in a new tab',
    pair_start: 'Started connecting an agent',
    pair_done: 'Connected an agent',
    feedback_open: 'Opened the feedback form',
    feedback_sent: 'Sent feedback',
    error: `Hit an error (${d.code ?? 'failed'})`,
  };
  return `${clock(ev.t)}  ${text[ev.e]}`;
}
