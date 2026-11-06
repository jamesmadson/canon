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

// The custom property that holds each skill's dot colour (D-125). The values
// live in global.css, in a light and a dark set, so no component spells a hex.
export const SKILL_DOT: Record<string, string> = {
  strata: '--skill-strata',
  lath: '--skill-lath',
  prune: '--skill-prune',
  graft: '--skill-graft',
};

// The step of the work each skill belongs to, shown on the homepage. The last
// two words are joined so a label never ends on a lone word.
export const SKILL_STEPS: Record<string, string> = {
  strata: 'When people tell you&nbsp;something',
  lath: 'Before you&nbsp;design',
  prune: 'Before a&nbsp;review',
  graft: 'When you lose your&nbsp;way',
};
