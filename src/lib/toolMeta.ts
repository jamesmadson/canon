export const TOOL_META: Record<string, { label: string; color: string; abbr: string }> = {
  claude: { label: 'Claude', color: '#c1666b', abbr: 'CL' },
  'claude-code': { label: 'Claude Code', color: '#a65a6e', abbr: 'CC' },
  cursor: { label: 'Cursor', color: '#3b4252', abbr: 'CU' },
  codex: { label: 'Codex', color: '#2e86ab', abbr: 'CX' },
  copilot: { label: 'Copilot', color: '#1b998b', abbr: 'CP' },
  figma: { label: 'Figma', color: '#e1b16a', abbr: 'FG' },
  miro: { label: 'Miro', color: '#f2c14e', abbr: 'MR' },
  generic: { label: 'Any agent', color: '#8d99ae', abbr: 'GN' },
};
