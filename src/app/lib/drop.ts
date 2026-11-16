/** What a drop or a paste means on Home: links, zips, and which project gets them. */
import type { Project } from '../db';
import { isZipName } from './ingest';
import { checkPrototypeUrl } from './resolve';

/** Prototype links in dropped or pasted text. Only a line that is nothing but a link counts, so a sentence is never read as one. */
export function linksFromText(text: string, ownOrigin?: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /\s/.test(line)) continue;
    const checked = checkPrototypeUrl(line, ownOrigin);
    if (checked.ok) out.push(checked.url);
  }
  return out;
}

export const zipNames = (files: { name: string }[]): string[] => files.filter((f) => isZipName(f.name)).map((f) => f.name);

/** The project a drop goes to: the row it landed on, else the one with the latest work, else none. */
export function dropTarget(projects: Project[], hit: string | null): string | null {
  if (hit && projects.some((p) => p.id === hit)) return hit;
  const latest = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return latest?.id ?? null;
}
