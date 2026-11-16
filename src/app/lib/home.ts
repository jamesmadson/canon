/** What Home and the project view show: one card per prototype, grouped, scoped, sorted and filtered. Pure, so tests can run it without a browser. */
import type { Frame, Project } from '../db';
import { normalizeTag } from './tags';
import { currentOf, stackKey, stacks } from './versions';

export interface Card {
  /** The current version's id. It is what opens and what star, note and archive are written through. */
  id: string;
  stack: string;
  projectId: string;
  name: string;
  summary: string;
  tags: string[];
  versions: number;
  source: string;
  kind: Frame['kind'];
  starred: boolean;
  archived: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
  frame: Frame;
}

export type Scope = { kind: 'home' } | { kind: 'starred' } | { kind: 'archive' } | { kind: 'tag'; tag: string };
export type Sort = 'updated' | 'starred';

/** Where a prototype came from: the agent that added it, else how it came in. */
export function sourceOf(f: Pick<Frame, 'tool' | 'kind' | 'url'>): string {
  if (f.tool?.trim()) return f.tool.trim();
  if (f.kind === 'linked') return 'Folder';
  if (f.kind === 'files') return 'Files';
  try {
    return new URL(f.url ?? '').host.replace(/^www\./, '') || 'Link';
  } catch {
    return 'Link';
  }
}

export function cardsOf(frames: Frame[]): Card[] {
  return stacks(frames).map((stack) => {
    const f = currentOf(stack);
    return {
      id: f.id, stack: stackKey(f), projectId: f.projectId, name: f.name,
      summary: f.summary ?? '', tags: f.tags ?? [], versions: stack.length, source: sourceOf(f), kind: f.kind,
      starred: !!f.starred, archived: !!f.archived, note: f.note ?? '',
      createdAt: Math.min(...stack.map((x) => x.createdAt)), updatedAt: Math.max(...stack.map((x) => x.updatedAt)), frame: f,
    };
  });
}

export function scopeCards(cards: Card[], scope: Scope): Card[] {
  switch (scope.kind) {
    case 'archive': return cards.filter((c) => c.archived);
    case 'starred': return cards.filter((c) => c.starred && !c.archived);
    case 'tag': {
      const want = normalizeTag(scope.tag);
      return cards.filter((c) => !c.archived && c.tags.some((t) => normalizeTag(t) === want));
    }
    default: return cards.filter((c) => !c.archived);
  }
}

const byUpdated = (a: Card, b: Card) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);

export function sortCards(cards: Card[], by: Sort): Card[] {
  const list = [...cards];
  if (by === 'starred') return list.sort((a, b) => Number(b.starred) - Number(a.starred) || byUpdated(a, b));
  return list.sort(byUpdated);
}

/** Cards that carry every chosen tag. */
export function filterByTags(cards: Card[], tags: string[]): Card[] {
  const want = tags.map(normalizeTag).filter(Boolean);
  if (!want.length) return cards;
  return cards.filter((c) => {
    const have = c.tags.map(normalizeTag);
    return want.every((t) => have.includes(t));
  });
}

export function tagCounts(cards: Card[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of cards) for (const t of new Set(c.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** A row per project, the one with the latest prototype first and each project's prototypes newest first. */
export function groupByProject(cards: Card[], projects: Project[], opts: { includeEmpty?: boolean } = {}): { project: Project; cards: Card[] }[] {
  const groups = projects.map((project) => ({ project, cards: cards.filter((c) => c.projectId === project.id).sort(byUpdated) }));
  const filled = groups.filter((g) => g.cards.length).sort((a, b) => b.cards[0].updatedAt - a.cards[0].updatedAt);
  if (!opts.includeEmpty) return filled;
  return [...filled, ...groups.filter((g) => !g.cards.length).sort((a, b) => b.project.updatedAt - a.project.updatedAt)];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** A short date the way people say it: Just now, Today, Yesterday, Thursday, 2 Nov. */
export function whenLabel(t: number, now = Date.now()): string {
  const s = (now - t) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  const days = Math.round((dayStart(now) - dayStart(t)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return DAYS[new Date(t).getDay()];
  const d = new Date(t);
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? label : `${label} ${d.getFullYear()}`;
}
