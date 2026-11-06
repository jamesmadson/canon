// Small readers for the two preview files the homepage shows as cards. They
// read the file's own structure so the card carries the file's own words, and
// they throw when the structure is not there, so a reworded file fails the
// build instead of rendering an empty card.

export type StrataEntry = { date: string; about: string; said: string; meant: string };
export type PruneCut = { heading: string; reason: string };

const unix = (text: string) => text.replace(/\r\n?/g, '\n');

const section = (text: string, name: string): string => {
  const m = text.match(new RegExp(`^## ${name}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
};

export function parseStrataEntry(raw: string, file: string): StrataEntry {
  const text = unix(raw);
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const date = front.match(/^date:\s*(.+)$/m)?.[1].trim() ?? '';
  if (!date) throw new Error(`${file}: the front matter has no "date:" line.`);
  const about = (front.match(/^about:\s*\[(.*)\]$/m)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
  const said = section(text, 'Said')
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
  if (!said) throw new Error(`${file}: there is no "## Said" heading with a quote under it.`);
  const meant = section(text, 'Meant').split(/\n\s*\n/)[0].trim();
  if (!meant) throw new Error(`${file}: there is no "## Meant" heading with a line under it.`);
  return { date, about, said, meant };
}

// The first numbered item between the line that names removals and the next
// bold heading line.
export function parsePruneCut(raw: string, file: string): PruneCut {
  const lines = unix(raw).split('\n');
  const start = lines.findIndex((l) => /\bRemovals\b/.test(l));
  if (start < 0) throw new Error(`${file}: there is no heading that names the removals ("Removals").`);
  const after = lines.slice(start + 1);
  const end = after.findIndex((l) => /^\*\*\d+ ·/.test(l));
  const within = end < 0 ? after : after.slice(0, end);
  const item = within.find((l) => /^1[.)]\s/.test(l));
  if (!item) throw new Error(`${file}: there is no numbered first item under the "Removals" heading.`);
  const m = item.replace(/^1[.)]\s+/, '').match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (!m) throw new Error(`${file}: the first item under "Removals" does not start with a bold heading.`);
  return { heading: m[1].replace(/\.$/, ''), reason: m[2] };
}
