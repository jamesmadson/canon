import type { Project } from '../db';

/** The sidebar order: pinned projects first, then the rest, each group by most recent change. */
export function orderProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
}
