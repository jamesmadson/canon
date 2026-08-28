/**
 * Evidence strength for the record.
 *
 * The rule the whole record hangs on: one voice is a quote, two is a possible
 * pattern, three or more is a pattern. A voice is a person, not an entry — two
 * entries from the same participant stay one voice, which is the difference
 * between counting evidence and counting paperwork.
 *
 * Stakeholder requests (S-nn) are filed the same way and counted separately.
 * Pooling a stakeholder's opinion with participant evidence is the quiet lie
 * this scale exists to prevent.
 */

export const STRENGTH_SCALE = '1 voice = a quote · 2 = a possible pattern · 3+ = a pattern';

export type Strength = 'quote' | 'possible' | 'pattern' | 'request';

/** The least an entry has to be for the counting to work. */
export interface EvidenceItem {
  speaker: string;
  theme: string;
  decided: string | null;
}

export interface ThemeEvidence<T extends EvidenceItem = EvidenceItem> {
  theme: string;
  entries: T[];
  /** Distinct participants. */
  voices: number;
  /** Distinct stakeholders, never added to the voice count. */
  requests: number;
  strength: Strength;
  /** The first dated decision on the theme, or null while it is still open. */
  decided: string | null;
}

export function isParticipant(speaker: string): boolean {
  return /^P-\d+$/.test(speaker);
}

export function strengthOf(voices: number): Strength {
  if (voices >= 3) return 'pattern';
  if (voices === 2) return 'possible';
  if (voices === 1) return 'quote';
  return 'request';
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  pattern: 'Pattern',
  possible: 'Possible pattern',
  quote: 'A quote',
  request: 'Stakeholder request',
};

/** How the tag on an entry reads: the label with the count that earned it. */
export function strengthTag(evidence: Pick<ThemeEvidence, 'voices' | 'strength'>): string {
  if (evidence.strength === 'request') return STRENGTH_LABEL.request;
  const voices = `${evidence.voices} ${evidence.voices === 1 ? 'voice' : 'voices'}`;
  return `${STRENGTH_LABEL[evidence.strength]} · ${voices}`;
}

/**
 * Groups entries by the question they are evidence about, strongest first.
 * Ties keep the order the themes were first filed in, so the list does not
 * reshuffle itself every time an entry lands.
 */
export function groupByTheme<T extends EvidenceItem>(entries: T[]): ThemeEvidence<T>[] {
  const order: string[] = [];
  const byTheme = new Map<string, T[]>();

  for (const entry of entries) {
    if (!byTheme.has(entry.theme)) {
      byTheme.set(entry.theme, []);
      order.push(entry.theme);
    }
    byTheme.get(entry.theme)!.push(entry);
  }

  return order
    .map((theme, index) => {
      const themeEntries = byTheme.get(theme)!;
      const voices = new Set(
        themeEntries.filter((e) => isParticipant(e.speaker)).map((e) => e.speaker),
      ).size;
      const requests = new Set(
        themeEntries.filter((e) => !isParticipant(e.speaker)).map((e) => e.speaker),
      ).size;
      return {
        theme,
        entries: themeEntries,
        voices,
        requests,
        strength: strengthOf(voices),
        decided: themeEntries.find((e) => e.decided)?.decided ?? null,
        index,
      };
    })
    .sort((a, b) => b.voices - a.voices || a.index - b.index)
    .map(({ index: _index, ...evidence }) => evidence);
}

/** Themes with something Said and nothing Decided — the open loops. */
export function openLoops<T extends EvidenceItem>(entries: T[]): ThemeEvidence<T>[] {
  return groupByTheme(entries).filter((evidence) => evidence.decided === null);
}
