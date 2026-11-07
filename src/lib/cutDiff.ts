// What a skill's one cut changed, read at build time from the page it
// reviewed and the page after the cut. Nothing here is written by hand, so
// the list and the outlines cannot disagree with the two files.

export type DiffLine = {
  kind: 'removed' | 'added';
  /** 1-based, in the file the line comes from. */
  line: number;
  /** The element the line opens, such as "tr", or "" for a line that opens none. */
  tag: string;
  /** The first text on the line, such as a row's heading. */
  label: string;
};

const OPENS = /^\s*<([a-zA-Z][\w-]*)/;

function describe(text: string): { tag: string; label: string } {
  const tag = text.match(OPENS)?.[1].toLowerCase() ?? '';
  const first = text.match(/>\s*([^<>\s][^<>]*?)\s*</)?.[1] ?? text.replace(/<[^>]*>/g, ' ');
  return { tag, label: first.replace(/\s+/g, ' ').trim() };
}

// A plain longest-common-subsequence diff by line. The pages are a few
// hundred lines, so the table stays small.
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r/g, '').split('\n');
  const b = after.replace(/\r/g, '').split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) {
      if (a[i].trim()) out.push({ kind: 'removed', line: i + 1, ...describe(a[i]) });
      i++;
    } else {
      if (b[j].trim()) out.push({ kind: 'added', line: j + 1, ...describe(b[j]) });
      j++;
    }
  }
  return out;
}

export const CUT_OUTLINE = '#FF4F00';

// The page as it was, with every removed line that opens an element marked
// and outlined in Canon's orange, the colour of a pin. Neighbouring cut lines
// form one run, marked "start" and "end", so a run of table rows draws as one
// box. Rows take their outline from their cells, which a row cannot carry.
export function markRemoved(before: string, diff: DiffLine[]): string {
  const removed = new Set(diff.filter((d) => d.kind === 'removed').map((d) => d.line));
  const lines = before.replace(/\r/g, '').split('\n').map((text, n) => {
    const line = n + 1;
    if (!removed.has(line)) return text;
    const ends = [!removed.has(line - 1) && 'start', !removed.has(line + 1) && 'end'].filter(Boolean).join(' ');
    return text.replace(OPENS, (open) => `${open} data-cut="${ends}"`);
  });
  const c = CUT_OUTLINE;
  const style =
    `<style>[data-cut]:not(tr){outline:2px solid ${c};outline-offset:-2px}` +
    `tr[data-cut]>*{--t:0px;--b:0px;--l:0px;--r:0px}` +
    `tr[data-cut~=start]>*{--t:2px}tr[data-cut~=end]>*{--b:2px}` +
    `tr[data-cut]>:first-child{--l:2px}tr[data-cut]>:last-child{--r:2px}` +
    `tr[data-cut]>*{box-shadow:inset 0 var(--t) 0 ${c},inset 0 calc(-1*var(--b)) 0 ${c},inset var(--l) 0 0 ${c},inset calc(-1*var(--r)) 0 0 ${c}}</style>`;
  const html = lines.join('\n');
  return html.includes('</head>') ? html.replace('</head>', `${style}\n</head>`) : style + html;
}
