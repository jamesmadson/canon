/**
 * The "Try it now" links on the site. They arrive as `#try`, or `#try/<name>`
 * to open one prototype of the sample project once it is loaded. Parsing is
 * kept apart from the app so it can be tested without a browser.
 */

/** The prototypes of the Fernwell sample that a link may point at, by the name used in the address. */
export const TRY_TARGETS: Record<string, { frame: string; view: 'board' | 'pages' }> = {
  'today-ring': { frame: 'Today ring', view: 'board' },
  'held-lane': { frame: 'Held lane, option B', view: 'board' },
  streak: { frame: 'Streak', view: 'board' },
  'fernwell-site': { frame: 'Fernwell site', view: 'pages' },
};

export type TryLink = { target: keyof typeof TRY_TARGETS | null };

/** Reads a location hash. Returns null when it is not a try link; an unknown target just opens the sample. */
export function parseTry(hash: string): TryLink | null {
  const m = /^#try(?:\/([^/?#]*))?$/.exec(hash);
  if (!m) return null;
  const name = m[1] ?? '';
  return { target: Object.prototype.hasOwnProperty.call(TRY_TARGETS, name) ? name : null };
}

/** The address to land on after the sample has loaded. `frameId` is the id of the target's frame, when it was found. */
export function tryDestination(project: string, board: string, link: TryLink, frameId: string | null): string {
  if (!link.target || !frameId) return `#/p/${encodeURIComponent(project)}`;
  return TRY_TARGETS[link.target].view === 'pages'
    ? `#/f/${encodeURIComponent(frameId)}`
    : `#/b/${encodeURIComponent(board)}/f/${encodeURIComponent(frameId)}`;
}
