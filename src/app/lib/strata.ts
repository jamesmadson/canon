/**
 * Canvas notes, written as Strata entries. Same discipline as the CLI:
 * Said is verbatim, Meant is a reading marked as one, Decided starts empty,
 * and only P codes count as participants. Names never enter the record.
 */

export interface NoteInput { said: string; meant?: string; participant?: string }

const isParticipant = (code?: string) => !!code && /^P-\d+$/.test(code.trim());

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entry';

export function noteToEntry(note: NoteInput, { date, about }: { date: string; about: string }): string {
  const codes = isParticipant(note.participant) ? [note.participant!.trim()] : [];
  const said = note.said.trim().split('\n').map((l) => `> ${l}`).join('\n');
  return [
    '---',
    `date: ${date}`,
    'source: canvas-note',
    `participants: [${codes.join(', ')}]`,
    `about: [${slugify(about)}]`,
    'assets: []',
    '---',
    '',
    '## Said',
    '',
    said,
    '',
    '## Meant',
    '',
    note.meant?.trim() || 'Not yet interpreted.',
    '',
    '## Decided',
    '',
    'Not yet decided.',
    '',
  ].join('\n');
}

export function entryFileName(date: string, about: string, repeat: number): string {
  return `${date}-${slugify(about)}${repeat > 0 ? `-${repeat + 1}` : ''}.md`;
}
