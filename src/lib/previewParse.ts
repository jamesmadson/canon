// Small readers for the two preview files the homepage shows as cards. They
// read the file's own structure so the card carries the file's own words.

export type StrataEntry = { date: string; about: string; said: string; meant: string };
export type PruneCut = { heading: string; reason: string };

const section = (text: string, name: string): string => {
  const m = text.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
};

export function parseStrataEntry(text: string): StrataEntry {
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const date = front.match(/^date:\s*(.+)$/m)?.[1].trim() ?? '';
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
  const meant = section(text, 'Meant').split(/\n\s*\n/)[0].trim();
  return { date, about, said, meant };
}

// The first numbered item under the first heading that names removals.
export function parsePruneCut(text: string): PruneCut {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /\bRemovals\b/.test(l));
  const item = lines.slice(start < 0 ? 0 : start + 1).find((l) => /^1\.\s/.test(l)) ?? '';
  const m = item.replace(/^1\.\s+/, '').match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (!m) return { heading: item.replace(/^1\.\s+/, ''), reason: '' };
  return { heading: m[1].replace(/\.$/, ''), reason: m[2] };
}
