// The skills go to the same agent the MCP connects. Each gets one plain line
// on the homepage and on /skills/; its own page carries the rest and shows
// what it made on a real run. They run in the order work does: hear users,
// sketch, cut, look back.
export const SKILL_LINES: Record<string, string> = {
  strata: 'A record of what users said, in dated layers, with their words kept apart from your reading of&nbsp;them.',
  lath: 'Wireframes from a fixed kit, with real copy, every state listed and numbered notes for&nbsp;review.',
  prune: 'A review that removes. Each finding is weighed against what the screen is for, and one thing is&nbsp;kept.',
  graft: 'Your Claude Code session as a timeline. Find the turn where you made a call, and go back to&nbsp;it.',
};

export const ORDER = Object.keys(SKILL_LINES);
