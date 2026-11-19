/**
 * What a paired agent can do to this tab: add, update, find, open, link and
 * status, over projects, boards, the library, placements and version stacks.
 * Pure over a state snapshot and injected store actions, so it can be tested
 * without IndexedDB. The store actions tell other tabs themselves.
 *
 * "Which one?" is a successful reply, { status: 'many' | 'none', candidates,
 * what, query }, because the bridge keeps only the message of a failed one.
 * what says which lookup it was: 'project', 'board', 'moveTo' or 'frame'.
 * Real failures (a refused URL, an unknown op) are { ok: false, error }.
 * Everything that can fail is settled before the first write, including the
 * checks on summary, tags, star, note and archive.
 */

import type * as store from '../store';
import type { State } from '../store';
import type { Board, Frame, FrameMeta, Placement, Project } from '../db';
import { type Address, buildAddress, safePath } from '../lib/address';
import { checkPrototypeUrl, parseWidth, resolveByName, resolveStack } from '../lib/resolve';
import { metaOf } from '../lib/meta';
import { SIZES } from '../lib/sizes';
import { autoTags, mergeTags, normalizeTag, removeTag, reuseTag } from '../lib/tags';
import { currentOf, stacks, versionOf } from '../lib/versions';
import type { BuildFile, Staging } from '../lib/stage';

export interface OpsDeps {
  state(): State;
  /** The route in the Canon tab the person last focused. */
  route(): Address;
  createProject(name: string): Promise<Project>;
  createBoard(projectId: string, name: string): Promise<Board>;
  /** Always called with stack:false: an agent's add never joins a stack on its own. */
  addUrl: typeof store.addUrl;
  addUrlVersion: typeof store.addUrlVersion;
  /** Pieces of a build folder wait here until an add or update names them. */
  staging: Staging;
  /** A build stored like a dropped folder, with the url kept as its live address. Always stack:false. */
  addBuild: typeof store.addBuild;
  addBuildVersion: typeof store.addBuildVersion;
  updateFrame(id: string, patch: Partial<Frame>): Promise<void>;
  /** Sets metadata on every version of the prototype. */
  updateMeta(frameId: string, patch: FrameMeta): Promise<void>;
  placeOnBoard(boardId: string, frameId: string): Promise<void>;
  moveToBoard(placementId: string, boardId: string): Promise<void>;
  /** Moves the whole prototype to another project, off the old project's boards and onto the new one's first, or onto boardId. Toasts with Undo. */
  moveToProject(frameIds: string[], target: { id: string } | { name: string }, opts?: { boardId?: string; message?: string }): Promise<{ project: Project } | null>;
  navigate(hash: string): void;
  appBase: string;
  agentName: string;
  toast(msg: string): void;
}

export type OpResult = { ok: true; result: any } | { ok: false; error: string };

const MAX_NAME = 200;
const MAX_WIDTH = 3840;
const MAX_FOUND = 200;
const MAX_SUMMARY = 300;
const MAX_NOTE = 2000;
const MAX_SHORT = 200;
const MAX_LIST = 20;
const MAX_TITLE = 300;
const MAX_HEADINGS = 20;
const MAX_NAMES = 50;
const DEFAULT_PROJECT = 'My prototypes';
const DEFAULT_BUILD_NAME = 'Prototype';

type Lookup = 'project' | 'board' | 'moveTo' | 'frame';
class Ambiguous {
  constructor(readonly status: 'many' | 'none', readonly candidates: string[], readonly what: Lookup, readonly query?: string) {}
}
class Refused extends Error {}

type Args = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const nameText = (v: unknown) => text(v).slice(0, MAX_NAME).trim();

/** parseWidth, with pixel widths held to something a screen could show. Absent is null; anything unreadable is refused. */
function widthOf(v: unknown): number | 'fill' | null {
  if (v === undefined) return null;
  const w = parseWidth(typeof v === 'string' ? v.trim().toLowerCase() : v);
  if (w === null) throw new Refused('width must be phone, tablet, desktop, fill, or a width in pixels.');
  return typeof w === 'number' ? Math.min(w, MAX_WIDTH) : w;
}

function checkedUrl(v: unknown, appBase: string): string {
  let own: string | undefined;
  try {
    own = new URL(appBase).origin;
  } catch {
    own = undefined;
  }
  const c = checkPrototypeUrl(typeof v === 'string' ? v : '', own);
  if (!c.ok) throw new Refused(c.message);
  return c.url;
}

/* ── Metadata ──────────────────────────────────────────────────────────── */

const projectTagsOf = (s: State, projectId: string) => s.frames.filter((f) => f.projectId === projectId).flatMap((f) => f.tags ?? []);

/** A list of at most MAX_LIST pieces of text, or undefined when absent. Anything else is refused. */
function textList(v: unknown, field: string): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Refused(`${field} must be a list of text.`);
  if (v.length > MAX_LIST) throw new Refused(`${field} can hold at most ${MAX_LIST} entries.`);
  return v as string[];
}

function flag(v: unknown, field: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new Refused(`${field} must be true or false.`);
  return v;
}

/** What the MCP process read from the page. A page that is not shaped right is ignored, never refused. */
function pageOf(v: unknown): { title?: string; headings: string[]; frameBlocked?: boolean } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { title, headings, frameBlocked } = v as { title?: unknown; headings?: unknown; frameBlocked?: unknown };
  return {
    ...(frameBlocked === true ? { frameBlocked: true } : {}),
    ...(typeof title === 'string' ? { title: title.slice(0, MAX_TITLE) } : {}),
    headings: Array.isArray(headings) ? headings.filter((h): h is string => typeof h === 'string').slice(0, MAX_HEADINGS).map((h) => h.slice(0, MAX_SHORT)) : [],
  };
}

/** Text fields an agent may set, cut to their limits. A field not given is absent. */
function textFields(args: Args) {
  const cut = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max).trim() : undefined);
  return {
    summary: cut(args.summary, MAX_SUMMARY), note: cut(args.note, MAX_NOTE),
    repo: cut(args.repo, MAX_SHORT), branch: cut(args.branch, MAX_SHORT),
  };
}

/** Everything an add or update takes in, checked before anything is written. */
function metaArgs(args: Args) {
  return {
    ...textFields(args),
    tags: textList(args.tags, 'tags'),
    removeTags: textList(args.removeTags, 'removeTags'),
    starred: flag(args.starred, 'starred'),
    archived: flag(args.archived, 'archived'),
    page: pageOf(args.page),
  };
}

/* ── Where the person is ───────────────────────────────────────────────── */

/** The project a route shows: a project page, a board, or a prototype in a bundle or full screen. */
export function openProjectId(route: Address, s: State): string | null {
  switch (route.name) {
    case 'project':
      return s.projects.some((p) => p.id === route.project) ? route.project : null;
    case 'board':
      return s.boards.find((b) => b.id === route.board)?.projectId ?? null;
    case 'bundle':
      return s.frames.find((f) => f.id === route.frame)?.projectId ?? null;
    case 'full': {
      const b = route.board ? s.boards.find((x) => x.id === route.board) : undefined;
      return b?.projectId ?? s.frames.find((f) => f.id === route.frame)?.projectId ?? null;
    }
    default:
      return null;
  }
}

function openBoardOf(route: Address, s: State): Board | undefined {
  const id = route.name === 'board' ? route.board : route.name === 'full' ? route.board : null;
  return id ? s.boards.find((b) => b.id === id) : undefined;
}

/* ── Lookups ───────────────────────────────────────────────────────────── */

const projectName = (s: State, id: string) => s.projects.find((p) => p.id === id)?.name ?? '';
const boardLabel = (s: State, b: Board) => `${b.name} (${projectName(s, b.projectId)})`;

/** A project by exact name, then a unique substring. */
function pickProject(s: State, query: string): Project {
  const r = resolveByName(s.projects, query);
  if (r.ok) return r.item;
  throw new Ambiguous(r.reason, r.matches.map((p) => p.name), 'project', query);
}

/** A board in scope by exact name, then a unique substring. Outside one project, candidates name their project. */
function pickBoard(s: State, query: string, scope: Project | null, what: Lookup = 'board'): Board {
  const pool = scope ? s.boards.filter((b) => b.projectId === scope.id) : s.boards;
  const r = resolveByName(pool, query);
  if (r.ok) return r.item;
  throw new Ambiguous(r.reason, r.matches.map((b) => (scope ? b.name : boardLabel(s, b))), what, query);
}

const placementsOfStack = (s: State, stack: Frame[]) => {
  const ids = new Set(stack.map((f) => f.id));
  return s.placements.filter((p) => ids.has(p.frameId));
};

interface Target { stack: Frame[]; project: Project; board: Board | null }

/** A prototype stack by any version's id or name, within the project and board given. */
function pickStack(s: State, args: Args): Target {
  const projectQ = text(args.project);
  const scope = projectQ ? pickProject(s, projectQ) : null;
  const boardQ = text(args.board);
  const board = boardQ ? pickBoard(s, boardQ, scope) : null;
  let pool = stacks(scope ? s.frames.filter((f) => f.projectId === scope.id) : s.frames);
  if (board) pool = pool.filter((st) => placementsOfStack(s, st).some((p) => p.boardId === board.id));
  const query = text(args.frame);
  const r = resolveStack(pool, query);
  if (!r.ok) throw new Ambiguous(r.reason, r.matches.map((st) => currentOf(st).name), 'frame', query);
  const project = s.projects.find((p) => p.id === r.item[0].projectId) ?? { id: r.item[0].projectId, name: '', createdAt: 0, updatedAt: 0 };
  return { stack: r.item, project, board };
}

/** The board a link to a stack shows: the one asked for, else the open board if it holds the stack, else the latest that does. */
function linkBoard(s: State, deps: OpsDeps, stack: Frame[], asked: Board | null): Board | null {
  if (asked) return asked;
  const holding = new Set(placementsOfStack(s, stack).map((p) => p.boardId));
  const open = openBoardOf(deps.route(), s);
  if (open && holding.has(open.id)) return open;
  const boards = s.boards.filter((b) => holding.has(b.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  return boards[0] ?? null;
}

const linkTo = (deps: OpsDeps, a: Address) => deps.appBase + buildAddress(a);
/** Every link to a prototype opens the prototype view, whether or not it sits on a board. A link to a board still opens the board. */
const frameLink = (deps: OpsDeps, frameId: string) =>
  linkTo(deps, { name: 'full', frame: frameId, board: null, width: null, path: null });

/** Where an agent's add lands, settled without writing: what to make, and what already exists. */
type Plan<T> = { have: T } | { make: string };

function stackNow(s: State, id: string): Frame[] {
  const f = s.frames.find((x) => x.id === id);
  if (!f) return [];
  const key = f.stackId ?? f.id;
  return s.frames.filter((x) => (x.stackId ?? x.id) === key).sort((a, b) => a.createdAt - b.createdAt);
}

function summary(deps: OpsDeps, frameId: string, board: Board | null) {
  const s = deps.state();
  const f = s.frames.find((x) => x.id === frameId)!;
  const stack = stackNow(s, frameId);
  return {
    frameId, frame: f.name, projectId: f.projectId, project: projectName(s, f.projectId),
    boardId: board?.id ?? null, board: board?.name ?? null,
    version: versionOf(stack, frameId), versions: stack.length,
  };
}

/** The files of an upload, and the page to open when the agent named one (a page of a built site). */
function takeBuild(deps: OpsDeps, raw: unknown): { files: BuildFile[] | null; entry?: string } {
  if (raw === undefined) return { files: null };
  const files = deps.staging.take(raw);
  const entry = (raw as { entry?: unknown }).entry;
  if (entry === undefined) return { files };
  if (typeof entry !== 'string' || !/\.html?$/i.test(entry) || !files.some((f) => f.path === entry)) throw new Refused('build.entry must be the path of an HTML file in the build.');
  return { files, entry };
}

/* ── add ───────────────────────────────────────────────────────────────── */

async function add(args: Args, deps: OpsDeps) {
  // With a build, the url is optional: it is the live address.
  const url = args.url === undefined && args.build !== undefined ? null : checkedUrl(args.url, deps.appBase);
  const width = widthOf(args.width);
  const name = nameText(args.name);
  const s = deps.state();
  const route = deps.route();
  const m = metaArgs(args);

  // Project and board are exact name or id only: a near name makes a new one rather than landing on someone else's.
  const projectQ = text(args.project);
  let project: Plan<Project> | null = null;
  if (projectQ) {
    const r = resolveByName(s.projects, projectQ, { exact: true });
    if (r.ok) project = { have: r.item };
    else if (r.reason === 'many') throw new Ambiguous('many', r.matches.map((p) => p.name), 'project', projectQ);
    else project = { make: projectQ.slice(0, MAX_NAME).trim() };
  }

  const boardQ = text(args.board);
  let board: Plan<Board> | null = null;
  if (boardQ) {
    const inProject = project && 'have' in project ? project.have.id : null;
    const pool = project === null ? s.boards : inProject ? s.boards.filter((b) => b.projectId === inProject) : [];
    const r = resolveByName(pool, boardQ, { exact: true });
    if (r.ok) board = { have: r.item };
    else if (r.reason === 'many') throw new Ambiguous('many', r.matches.map((b) => (project ? b.name : boardLabel(s, b))), 'board', boardQ);
    else board = { make: boardQ.slice(0, MAX_NAME).trim() };
  }

  if (project === null) {
    const openId = openProjectId(route, s);
    const boardProject = board && 'have' in board ? board.have.projectId : null;
    const fromBoard = boardProject ? s.projects.find((p) => p.id === boardProject) : undefined;
    const open = s.projects.find((p) => p.id === openId);
    if (fromBoard ?? open) project = { have: (fromBoard ?? open)! };
    else if (s.projects.length === 1) project = { have: s.projects[0] };
    else if (s.projects.length === 0) project = { make: DEFAULT_PROJECT };
    else throw new Ambiguous('many', s.projects.map((p) => p.name), 'project');
  }

  if (board === null && 'have' in project) {
    const open = openBoardOf(route, s);
    if (open && open.projectId === project.have.id) board = { have: open };
  }

  // Tags and the names already in the project, settled from what exists now.
  const mine = 'have' in project ? s.frames.filter((f) => f.projectId === project.have.id) : [];
  const { tags } = mergeTags({
    auto: autoTags({ title: m.page?.title, headings: m.page?.headings, tool: deps.agentName, repo: m.repo, branch: m.branch }),
    passed: m.tags,
    projectTags: mine.flatMap((f) => f.tags ?? []),
  });
  const names = stacks(mine)
    .sort((a, b) => b[b.length - 1].createdAt - a[a.length - 1].createdAt)
    .slice(0, MAX_NAMES)
    .map((st) => currentOf(st).name);
  const meta: FrameMeta = {
    ...(m.summary ? { summary: m.summary } : {}), ...(m.repo ? { repo: m.repo } : {}), ...(m.branch ? { branch: m.branch } : {}),
    tool: deps.agentName, tags,
    ...(m.starred ? { starred: true } : {}), ...(m.note ? { note: m.note } : {}), ...(m.archived ? { archived: true } : {}),
  };

  // The build's files are checked before anything is written.
  const { files: build, entry } = takeBuild(deps, args.build);

  // Writes start here.
  const p = 'have' in project ? project.have : await deps.createProject(project.make);
  const b = board === null ? null : 'have' in board ? board.have : await deps.createBoard(p.id, board.make);
  const size = typeof width === 'number' ? { w: width, h: SIZES.find((x) => x.w === width)?.h ?? 800 } : undefined;
  const frame = build
    ? await deps.addBuild(p.id, build, {
      boardId: b?.id, ...(name ? { name } : {}), ...(size ? { size } : {}), meta, ...(url ? { liveUrl: url } : {}), ...(entry ? { entry } : {}),
      fallbackName: url ? new URL(url).host : DEFAULT_BUILD_NAME,
    })
    : await deps.addUrl(p.id, url!, { boardId: b?.id, ...(name ? { name } : {}), ...(size ? { size } : {}), stack: false, meta });
  // The page said, in its headers, that it cannot be shown inside another page. Only a link needs to know.
  if (!build && m.page?.frameBlocked) await deps.updateFrame(frame.id, { frameBlocked: true });
  deps.toast(`${deps.agentName} added ${frame.name}`);
  const stored = build ? { storedFiles: build.length, ...(url ? { liveUrl: url } : {}) } : {};
  return { ...summary(deps, frame.id, b), ...(m.summary ? { summary: m.summary } : {}), tags, names, ...stored, link: frameLink(deps, frame.id) };
}

/* ── update ────────────────────────────────────────────────────────────── */

async function update(args: Args, deps: OpsDeps) {
  const s = deps.state();
  const url = args.url === undefined ? null : checkedUrl(args.url, deps.appBase);
  const { stack, project, board } = pickStack(s, args);
  const name = nameText(args.name);
  const m = metaArgs(args);

  // A move to another project comes from moveToProject, or from a moveTo board that sits in one.
  let toProject: Plan<Project> | null = null;
  const toProjectQ = text(args.moveToProject);
  if (toProjectQ) {
    const r = resolveByName(s.projects, toProjectQ, { exact: true });
    if (r.ok) toProject = r.item.id === project.id ? null : { have: r.item };
    else if (r.reason === 'many') throw new Ambiguous('many', r.matches.map((p) => p.name), 'project', toProjectQ);
    else toProject = { make: toProjectQ.slice(0, MAX_NAME).trim() };
  }
  let target: Board | null = null;
  let makeBoard: string | null = null;
  let move: Placement | null = null;
  const moveQ = text(args.moveTo);
  if (moveQ) {
    const scope = toProject ? ('have' in toProject ? toProject.have : null) : project;
    if (scope === null) {
      makeBoard = moveQ.slice(0, MAX_NAME).trim();
    } else {
      try {
        target = pickBoard(s, moveQ, scope, 'moveTo');
      } catch (e) {
        if (!(e instanceof Ambiguous) || e.status !== 'none' || toProjectQ) throw e;
        const elsewhere = resolveByName(s.boards.filter((b) => b.projectId !== project.id), moveQ);
        if (elsewhere.ok) target = elsewhere.item;
        else if (elsewhere.reason === 'many') throw new Ambiguous('many', elsewhere.matches.map((b) => boardLabel(s, b)), 'moveTo', moveQ);
        else throw e;
      }
      const there = target && target.projectId !== project.id ? s.projects.find((p) => p.id === target!.projectId) : undefined;
      if (there) toProject = { have: there };
    }
    if (!toProject) {
      const spots = placementsOfStack(s, stack).filter((p) => !board || p.boardId === board.id);
      if (spots.length > 1) {
        const names = spots.map((p) => s.boards.find((b) => b.id === p.boardId)?.name ?? p.boardId);
        throw new Ambiguous('many', names, 'board');
      }
      move = spots[0] ?? null;
    }
  }

  // What changes in the metadata, settled from the current version before anything is written.
  const before = metaOf(currentOf(stack));
  const patch: FrameMeta = {};
  for (const k of ['summary', 'note', 'repo', 'branch'] as const) {
    if (m[k] !== undefined && m[k] !== (before[k] ?? '')) patch[k] = m[k] || undefined;
  }
  if (m.starred !== undefined && m.starred !== !!before.starred) patch.starred = m.starred;
  if (m.archived !== undefined && m.archived !== !!before.archived) patch.archived = m.archived;
  const hasBuild = args.build !== undefined;
  const forceVersion = flag(args.newVersion, 'newVersion') === true;
  if (forceVersion && url === null && !hasBuild) {
    throw new Refused('newVersion needs url. Pass the address of the new version, or pass folder to add a build.');
  }
  const auto = (url !== null || hasBuild) && m.page
    ? autoTags({ title: m.page.title, headings: m.page.headings, repo: m.repo ?? before.repo, branch: m.branch ?? before.branch })
    : [];
  const merged = mergeTags({ current: before.tags, removed: before.removedTags, auto, passed: m.tags, projectTags: projectTagsOf(s, project.id) });
  let next = { tags: merged.tags, removedTags: merged.removedTags };
  for (const t of m.removeTags ?? []) next = removeTag(next, t);
  if (next.tags.join('\n') !== (before.tags ?? []).join('\n')) patch.tags = next.tags;
  if (next.removedTags.join('\n') !== (before.removedTags ?? []).join('\n')) patch.removedTags = next.removedTags;
  const metaChanged = Object.keys(patch).length > 0;

  const { files: build, entry } = takeBuild(deps, args.build);

  // Writes start here.
  let current = currentOf(stack);
  let newVersion = false;
  if (build) {
    const r = await deps.addBuildVersion(current.id, build, url ?? undefined, entry);
    current = r.frame;
    newVersion = r.added;
  } else if (url !== null) {
    const r = await deps.addUrlVersion(current.id, url, forceVersion ? { force: true } : undefined);
    current = r.frame;
    newVersion = r.added;
  }
  // A link read again says whether it still refuses to be framed. A stored copy shows either way.
  if (!build && url !== null && m.page && current.kind === 'url' && !!current.frameBlocked !== !!m.page.frameBlocked) {
    await deps.updateFrame(current.id, { frameBlocked: m.page.frameBlocked ? true : undefined });
  }
  let renamed = false;
  if (name && name !== current.name) {
    await deps.updateFrame(current.id, { name });
    renamed = true;
  }
  if (metaChanged) await deps.updateMeta(current.id, patch);
  let moved = false;
  let movedTo: string | null = null;
  if (toProject) {
    const label = name || current.name;
    const to = 'have' in toProject ? toProject.have.name : toProject.make;
    const r = await deps.moveToProject([current.id], 'have' in toProject ? { id: toProject.have.id } : { name: toProject.make }, {
      ...(target ? { boardId: target.id } : {}), message: `${deps.agentName} moved ${label} to ${to}.`,
    });
    if (r && makeBoard) await deps.placeOnBoard((await deps.createBoard(r.project.id, makeBoard)).id, current.id);
    moved = true;
    movedTo = r?.project.name ?? to;
  } else if (target) {
    if (!move) {
      await deps.placeOnBoard(target.id, current.id);
      moved = true;
    } else if (move.boardId !== target.id) {
      await deps.moveToBoard(move.id, target.id);
      moved = true;
    }
  }

  const after = deps.state();
  const shown = target ?? linkBoard(after, deps, stackNow(after, current.id), movedTo ? null : board);
  const result = summary(deps, current.id, shown);
  // A move to another project says so itself, with Undo.
  if (!movedTo && (newVersion || renamed || moved || metaChanged)) deps.toast(`${deps.agentName} updated ${result.frame}`);
  return { ...result, newVersion, ...(movedTo ? { movedToProject: movedTo } : {}), tags: next.tags, ...(build ? { storedFiles: build.length } : {}), link: frameLink(deps, current.id) };
}

/* ── find and status ───────────────────────────────────────────────────── */

function find(args: Args, deps: OpsDeps) {
  const s = deps.state();
  const projectQ = text(args.project);
  const scope = projectQ ? [pickProject(s, projectQ)] : [...s.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const q = text(args.query).toLowerCase();
  const has = (v: string | undefined) => !q || (v ?? '').toLowerCase().includes(q);
  const tagQ = typeof args.tag === 'string' ? normalizeTag(args.tag) : '';
  const starred = flag(args.starred, 'starred');
  const archived = flag(args.archived, 'archived');
  const filtering = (args.tag !== undefined) || starred !== undefined || archived !== undefined;
  let left = MAX_FOUND;
  let truncated = false;
  const projects = [];
  for (const p of scope) {
    const allBoards = s.boards.filter((b) => b.projectId === p.id).sort((a, b) => b.updatedAt - a.updatedAt);
    const whole = has(p.name);
    const boards = whole ? allBoards : allBoards.filter((b) => has(b.name));
    const shownBoards = new Set(boards.map((b) => b.id));
    const rows = [];
    const inProject = s.frames.filter((f) => f.projectId === p.id);
    const wanted = tagQ ? new Set([tagQ, reuseTag(tagQ, projectTagsOf(s, p.id))]) : null;
    const all = stacks(inProject).sort((a, b) => b[b.length - 1].createdAt - a[a.length - 1].createdAt);
    for (const st of all) {
      const cur = currentOf(st);
      const meta = metaOf(cur);
      if (archived === true ? !meta.archived : !!meta.archived) continue;
      if (wanted && !(meta.tags ?? []).some((t) => wanted.has(t))) continue;
      if (starred !== undefined && !!meta.starred !== starred) continue;
      const spots = placementsOfStack(s, st);
      const own = st.some((f) => has(f.name) || has(f.url)) || has(meta.summary) || (meta.tags ?? []).some((t) => has(t));
      // Under a filter, a project or board name match no longer pulls in every prototype.
      const hit = own || (!filtering && (whole || spots.some((pl) => shownBoards.has(pl.boardId))));
      if (!hit) continue;
      if (left === 0) { truncated = true; break; }
      left--;
      const on = [...new Set(spots.map((pl) => pl.boardId))].map((id) => s.boards.find((b) => b.id === id)?.name).filter((n): n is string => !!n);
      rows.push({
        id: cur.id, name: cur.name, kind: cur.kind, url: cur.kind === 'url' ? cur.url ?? null : null, boards: on, version: versionOf(st, cur.id), versions: st.length,
        ...(cur.kind !== 'url' && cur.liveUrl ? { liveUrl: cur.liveUrl } : {}),
        ...(meta.summary ? { summary: meta.summary } : {}),
        ...(meta.tags?.length ? { tags: meta.tags } : {}),
        ...(meta.starred ? { starred: true } : {}),
        ...(meta.note ? { note: meta.note } : {}),
        ...(meta.archived ? { archived: true } : {}),
        ...(meta.repo ? { repo: meta.repo } : {}),
        ...(meta.branch ? { branch: meta.branch } : {}),
        created: new Date(st[0].createdAt).toISOString(),
        updated: new Date(Math.max(...st.map((f) => f.updatedAt))).toISOString(),
      });
    }
    if (filtering ? !rows.length : !whole && !boards.length && !rows.length) continue;
    projects.push({ id: p.id, name: p.name, boards: boards.map((b) => ({ id: b.id, name: b.name })), prototypes: rows });
  }
  return { projects, ...(truncated ? { truncated: true } : {}) };
}

function status(deps: OpsDeps) {
  const s = deps.state();
  const route = deps.route();
  const project = s.projects.find((p) => p.id === openProjectId(route, s));
  const board = openBoardOf(route, s);
  return {
    projects: s.projects.length, boards: s.boards.length, prototypes: stacks(s.frames).length,
    ...(project ? { openProject: project.name } : {}), ...(board ? { openBoard: board.name } : {}),
  };
}

/* ── open and link ─────────────────────────────────────────────────────── */

function address(args: Args, deps: OpsDeps): Address {
  const s = deps.state();
  const wantsFull = args.full === true || args.width !== undefined || args.path !== undefined || args.version !== undefined;
  if (!text(args.frame)) {
    const projectQ = text(args.project);
    const scope = projectQ ? pickProject(s, projectQ) : null;
    const boardQ = text(args.board);
    if (!boardQ && !scope) throw new Refused('Say which project, board or prototype.');
    if (wantsFull) throw new Refused('Full screen needs a prototype.');
    if (boardQ) return { name: 'board', board: pickBoard(s, boardQ, scope).id, frame: null };
    return { name: 'project', project: scope!.id, tab: 'prototypes' };
  }
  const width = widthOf(args.width);
  let version: number | null = null;
  if (args.version !== undefined) {
    if (!Number.isInteger(args.version) || (args.version as number) < 1) throw new Refused('version must be a positive whole number.');
    version = args.version as number;
  }
  const { stack, board } = pickStack(s, args);
  if (version !== null && version > stack.length) {
    throw new Refused(`That prototype has ${stack.length === 1 ? 'only 1 version' : `${stack.length} versions`}, so there is no version ${version}.`);
  }
  const member = version === null ? currentOf(stack) : stack[version - 1];
  let path: string | null = null;
  if (args.path !== undefined) {
    if (member.kind !== 'url') throw new Refused('Paths only work on URL prototypes.');
    path = safePath(text(args.path));
    if (path === null) throw new Refused('That path points off the prototype.');
  }
  return { name: 'full', frame: member.id, board: null, width, path };
}

/* ── The one way in ────────────────────────────────────────────────────── */

/** Copies the agent's arguments to a plain object: own keys only, nothing from a prototype chain. */
function plain(args: unknown): Args {
  const out: Args = Object.create(null);
  if (!args || typeof args !== 'object' || Array.isArray(args)) return out;
  for (const key of Object.keys(args)) if (Object.hasOwn(args, key)) out[key] = (args as Args)[key];
  return out;
}

export async function runOp(op: string, args: unknown, deps: OpsDeps): Promise<OpResult> {
  const a = plain(args);
  try {
    switch (op) {
      case 'add':
        return { ok: true, result: await add(a, deps) };
      case 'update':
        return { ok: true, result: await update(a, deps) };
      case 'stage':
        deps.staging.part(a);
        return { ok: true, result: { staged: true } };
      case 'find':
        return { ok: true, result: find(a, deps) };
      case 'status':
        return { ok: true, result: status(deps) };
      case 'link':
        return { ok: true, result: { link: linkTo(deps, address(a, deps)) } };
      case 'open': {
        const hash = buildAddress(address(a, deps));
        deps.navigate(hash);
        return { ok: true, result: { link: deps.appBase + hash } };
      }
      default:
        return { ok: false, error: `Canon does not know how to ${String(op).slice(0, 40)}.` };
    }
  } catch (e) {
    if (e instanceof Ambiguous) {
      return { ok: true, result: { status: e.status, candidates: e.candidates, what: e.what, ...(e.query !== undefined ? { query: e.query } : {}) } };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Canon could not do that.' };
  }
}
