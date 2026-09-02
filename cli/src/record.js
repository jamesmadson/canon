/**
 * The record: reading and writing .strata entries.
 *
 * Two disciplines carried straight from the skill and not softened here:
 *
 *   Said, Meant and Decided stay separate. Verbatim, interpretation and
 *   action are different epistemic states, and an empty Decided is
 *   information rather than an omission, because it powers the open report.
 *
 *   Evidence counts people, not entries. The same participant twice is
 *   persistence, not a pattern. Anything that is not a P code is not a voice.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** What a new entry carries under Decided until a person fills it in. */
export const DECIDED_PLACEHOLDER = 'Not yet decided.';
const MEANT_PLACEHOLDER = 'Not yet interpreted.';

export function isParticipant(code) {
  return /^P-\d+$/.test(code);
}

/**
 * Is this Decided body a person saying "nothing here yet"?
 *
 * Three spellings mean the same thing. The placeholder this tool writes, an
 * empty section, and a bare dash on its own, which is what a person types when
 * filling an entry in by hand. The dashes are written by codepoint so this file
 * stays plain ASCII, per D-38.
 *
 * A dash that starts a real sentence is a decision, so the whole body has to be
 * the dash and nothing else.
 */
const BARE_DASH = new RegExp(`^[-${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]$`);

export function isUndecided(body) {
  const trimmed = String(body || '').trim();
  return trimmed === '' || trimmed === DECIDED_PLACEHOLDER || BARE_DASH.test(trimmed);
}

/**
 * A bracketed frontmatter list, split on the commas that separate items.
 *
 * A comma inside quotes belongs to the item, not to the list. Splitting on
 * every comma turned ["review, surface", "P-01"] into three items, two of them
 * fragments of a topic that then indexed under the wrong name.
 */
export function parseList(value) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];

  const items = [];
  let current = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);

  return items.map((item) => item.trim()).filter(Boolean);
}

/** The body under one heading, read by splitting rather than by lookahead. */
function sectionBody(text, heading) {
  const section = text.split(/^## /m).find((part) => part.trimEnd() === heading || part.startsWith(`${heading}\n`));
  return section === undefined ? '' : section.slice(heading.length).trim();
}

/**
 * Frontmatter and the three sections out of one entry file. Deliberately
 * forgiving: a hand written entry that is missing a key is still readable,
 * because the record predates this tool and must keep working without it.
 */
export function parseEntry(text, file) {
  const front = text.startsWith('---') ? text.slice(3).split(/^---\s*$/m)[0] : '';
  const fields = {};
  for (const line of front.split('\n')) {
    const cut = line.indexOf(':');
    if (cut === -1) continue;
    fields[line.slice(0, cut).trim()] = line.slice(cut + 1).trim();
  }

  const fromName = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  const decidedRaw = sectionBody(text, 'Decided');
  const decided = isUndecided(decidedRaw) ? '' : decidedRaw;
  const meantRaw = sectionBody(text, 'Meant');

  return {
    file,
    slug: fromName ? fromName[2] : file.replace(/\.md$/, ''),
    date: fields.date || (fromName ? fromName[1] : ''),
    source: fields.source || 'field-note',
    participants: fields.participants ? parseList(fields.participants) : [],
    about: fields.about ? parseList(fields.about) : [],
    assets: fields.assets ? parseList(fields.assets) : [],
    said: sectionBody(text, 'Said'),
    meant: meantRaw === MEANT_PLACEHOLDER ? '' : meantRaw,
    decided,
    open: decided === '',
  };
}

/** Every entry in a record directory, newest first. */
export function readRecord(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseEntry(readFileSync(join(dir, name), 'utf8'), name))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.file < b.file ? 1 : -1));
}

export function slugify(topic) {
  const slug = String(topic)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'entry';
}

/** The file a new entry lands in, numbered rather than overwriting a sibling. */
export function entryFileName(date, slug, existing) {
  const taken = new Set(existing);
  const first = `${date}-${slug}.md`;
  if (!taken.has(first)) return first;
  for (let n = 2; ; n += 1) {
    const candidate = `${date}-${slug}-${n}.md`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Wraps the verbatim into blockquote lines without rewording any of it. */
function quoteLines(said, width = 72) {
  const lines = [];
  for (const paragraph of String(said).split('\n')) {
    let current = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (current && `${current} ${word}`.length > width) {
        lines.push(`> ${current}`);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    lines.push(`> ${current}`);
  }
  return lines;
}

export function renderEntry({ date, about, participants, said, source = 'field-note' }) {
  const codes = (participants || []).filter(isParticipant);
  return [
    '---',
    `date: ${date}`,
    `source: ${source}`,
    `participants: [${codes.join(', ')}]`,
    `about: [${(about || []).join(', ')}]`,
    'assets: []',
    '---',
    '',
    '## Said',
    '',
    `*Filed at the terminal with canon note, ${date}.*`,
    '',
    ...quoteLines(said),
    '',
    '## Meant',
    '',
    MEANT_PLACEHOLDER,
    '',
    '## Decided',
    '',
    DECIDED_PLACEHOLDER,
    '',
  ].join('\n');
}

const STRENGTH = ['none', 'a quote', 'a possible pattern', 'a pattern'];

/** The scale, said out loud wherever a count is shown. */
export const STRENGTH_SCALE = '1 voice is a quote, 2 is a possible pattern, 3 or more is a pattern';

export function strengthOf(voices) {
  return STRENGTH[Math.min(voices, 3)];
}

/**
 * Topics with something Said and nothing Decided, strongest first. Strength is
 * the number of distinct participants, never the number of entries.
 */
export function openReport(entries) {
  const byTopic = new Map();
  for (const entry of entries) {
    if (!entry.open) continue;
    for (const topic of entry.about) {
      if (!byTopic.has(topic)) byTopic.set(topic, { topic, entries: 0, people: new Set(), latest: '' });
      const bucket = byTopic.get(topic);
      bucket.entries += 1;
      for (const code of entry.participants) if (isParticipant(code)) bucket.people.add(code);
      if (entry.date > bucket.latest) bucket.latest = entry.date;
    }
  }

  /**
   * A topic is open when the most recent thing said about it is open.
   *
   * A decision is a fact about a moment, not about a topic forever. Treating
   * any decided entry as closing the topic for good means a question reopened
   * after a decision never comes back to the report, which is exactly the case
   * the report exists to catch. On the same date the decision is taken as the
   * later word, because a decision is filed in response to what was said.
   */
  const latestWord = new Map();
  for (const entry of entries) {
    for (const topic of entry.about) {
      const held = latestWord.get(topic);
      const newer = !held || entry.date > held.date || (entry.date === held.date && held.open);
      if (newer) latestWord.set(topic, { date: entry.date, open: entry.open });
    }
  }

  return [...byTopic.values()]
    .filter((bucket) => latestWord.get(bucket.topic)?.open)
    .map((bucket) => ({
      topic: bucket.topic,
      entries: bucket.entries,
      voices: bucket.people.size,
      strength: strengthOf(bucket.people.size),
      latest: bucket.latest,
    }))
    .sort((a, b) => b.voices - a.voices || (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}
