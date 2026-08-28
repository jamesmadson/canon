/**
 * Scripted data for the Canon v2 preview screens.
 *
 * Every name, repo, branch, quote and date below is invented for this preview.
 * There is no team called Nine Mile, no product called Harbor Loop, and no
 * person named here. Nothing in this file is drawn from any real project.
 *
 * Dates are fixed against PREVIEW_AS_OF so the walkthrough reads the same in a
 * year as it does today — a preview that slowly turns every card stale would be
 * lying in a different direction.
 */

export const PREVIEW_AS_OF = '2026-08-27';

export const PREVIEW_NOTE = 'A scripted preview, not the product. All names and data invented.';

export interface Prototype {
  slug: string;
  name: string;
  summary: string;
  /** Where Canon indexed it from. A prototype is a reference, never a copy. */
  origin: 'Git' | 'Figma';
  /** Branch name for Git prototypes, frame name for Figma ones. */
  ref: string;
  author: string;
  lastActivity: string;
  lastActivityNote: string;
  sources: { label: string; detail: string }[];
}

export interface FeedbackEntry {
  id: string;
  date: string;
  /** P-nn for participants, S-nn for stakeholders. Never a name. */
  speaker: string;
  context: string;
  said: string;
  meant: string;
  decided: string | null;
}

export interface ReviewFinding {
  remove: string;
  because: string;
}

export interface ReviewRun {
  skill: string;
  ranOn: string;
  target: string;
  findings: ReviewFinding[];
  kept: string;
}

export interface PrototypeRecord {
  feedback: FeedbackEntry[];
  /** What the evidence adds up to, said out loud with its counts. */
  evidenceNote: string;
  review: ReviewRun | null;
}

export const PROJECT = {
  name: 'Harbor Loop',
  team: 'Nine Mile',
  blurb:
    'A ferry and bus planner for a coastal city. Four prototypes indexed from one repository and one Figma file.',
  repo: 'nine-mile/harbor-loop',
  figmaFile: 'Harbor Loop — concepts',
};

export const PROTOTYPES: Prototype[] = [
  {
    slug: 'trip-recap',
    name: 'Trip recap',
    summary:
      'The screen a rider sees after a journey ends: what it cost, what connected, and what to do about a missed transfer.',
    origin: 'Git',
    ref: 'prototype-trip-recap',
    author: 'Mira Halloway',
    lastActivity: '2026-08-25',
    lastActivityNote: 'Commit — "cut the second confirm step"',
    sources: [
      { label: 'Branch', detail: 'nine-mile/harbor-loop · prototype-trip-recap' },
      { label: 'Preview', detail: 'trip-recap.preview.nine-mile.example' },
      { label: 'Figma frame', detail: 'Harbor Loop — concepts · Recap v4' },
    ],
  },
  {
    slug: 'fare-sheet',
    name: 'Fare sheet',
    summary:
      'A bottom sheet that explains a fare before the rider pays it — caps, transfers, and the off-peak discount.',
    origin: 'Git',
    ref: 'prototype-fare-sheet',
    author: 'Dov Renner',
    lastActivity: '2026-08-22',
    lastActivityNote: 'Commit — "flatten the breakdown rows"',
    sources: [
      { label: 'Branch', detail: 'nine-mile/harbor-loop · prototype-fare-sheet' },
      { label: 'Preview', detail: 'fare-sheet.preview.nine-mile.example' },
    ],
  },
  {
    slug: 'stop-picker',
    name: 'Stop picker',
    summary:
      'Choosing a departure pier on a phone, one-handed, standing up. Figma prototype only — no branch yet.',
    origin: 'Figma',
    ref: 'Harbor Loop — concepts · Stop picker',
    author: 'Yusra Belkin',
    lastActivity: '2026-08-18',
    lastActivityNote: 'Figma edit — three frames renamed',
    sources: [{ label: 'Figma frame', detail: 'Harbor Loop — concepts · Stop picker' }],
  },
  {
    slug: 'night-map',
    name: 'Night map',
    summary:
      'A late-service map that dropped daytime routes entirely. Parked after the summer timetable changed under it.',
    origin: 'Git',
    ref: 'prototype-night-map',
    author: 'Tomasz Ferrell',
    lastActivity: '2026-08-01',
    lastActivityNote: 'Commit — "rough pass at the 1am view"',
    sources: [
      { label: 'Branch', detail: 'nine-mile/harbor-loop · prototype-night-map' },
      { label: 'Preview', detail: 'night-map.preview.nine-mile.example' },
    ],
  },
];

export const RECORDS: Record<string, PrototypeRecord> = {
  'trip-recap': {
    feedback: [
      {
        id: '2026-08-19-01',
        date: '2026-08-19',
        speaker: 'P-02',
        context: 'Moderated session, 35 minutes, own phone',
        said: 'I already know I missed it. I want to know what the next one is, not read about the one I missed.',
        meant:
          'My reading: the recap leads with the failed connection and buries the recovery. P-02 wanted the next departure first. One participant so far.',
        decided: null,
      },
      {
        id: '2026-08-20-01',
        date: '2026-08-20',
        speaker: 'P-05',
        context: 'Moderated session, 30 minutes, own phone',
        said: 'Why is it asking me twice? I said yes on the last screen.',
        meant:
          'My reading: the second confirm step reads as a mistake rather than a safeguard. This is the same complaint as the confirm note in the fare sheet record — two participants, which is a possible pattern, not a pattern.',
        decided:
          '2026-08-25 — Second confirm step removed on prototype-trip-recap. One tap now completes the rebooking.',
      },
      {
        id: '2026-08-21-01',
        date: '2026-08-21',
        speaker: 'S-01',
        context: 'Written note after a review',
        said: 'Can we get the loyalty points on this screen too? It is the one screen everyone actually reads.',
        meant:
          'My reading: a stakeholder request, kept apart from the participant evidence above and not pooled with it. No participant has asked for points.',
        decided: null,
      },
    ],
    evidenceNote:
      'Three entries, two participants and one stakeholder. Two participants is a possible pattern and the count is said out loud; the stakeholder request stays out of that count.',
    review: {
      skill: 'deter',
      ranOn: '2026-08-26',
      target: 'prototype-trip-recap · trip-recap.preview.nine-mile.example',
      findings: [
        {
          remove: 'The "Recommended" badge on every connection row',
          because: 'It appears on all six rows, so it sorts nothing and ranks nothing.',
        },
        {
          remove: 'The fare breakdown accordion',
          because: 'Every row it hides is already printed in the receipt directly beneath it.',
        },
        {
          remove: 'The second "Plan another trip" button in the header',
          because: 'The same action already sits in the bottom bar, within thumb reach.',
        },
        {
          remove: 'The loading skeleton on the connection list',
          because: 'The list renders from cache in well under a tenth of a second; the skeleton is the only flicker on the screen.',
        },
      ],
      kept: 'The missed-transfer banner stays. It is the one element on the screen that changes what a rider does next.',
    },
  },
  'fare-sheet': {
    feedback: [
      {
        id: '2026-08-14-01',
        date: '2026-08-14',
        speaker: 'P-03',
        context: 'Moderated session, 25 minutes, own phone',
        said: 'The cap thing at the bottom is the only bit I care about and it is the smallest text on there.',
        meant:
          'My reading: the daily cap is the fare rule riders reason with; the sheet treats it as a footnote. One participant.',
        decided: null,
      },
    ],
    evidenceNote: 'One entry, one participant. One participant is a quote, not a pattern.',
    review: null,
  },
  'stop-picker': {
    feedback: [
      {
        id: '2026-08-12-01',
        date: '2026-08-12',
        speaker: 'P-01',
        context: 'Hallway test with the Figma prototype, 10 minutes',
        said: 'I would need two hands for that and I have a bag in one of them.',
        meant:
          'My reading: the pier list puts its primary control at the top of a tall phone screen. Reach, not comprehension. One participant.',
        decided: null,
      },
    ],
    evidenceNote: 'One entry, one participant. Not yet enough to call anything.',
    review: null,
  },
  'night-map': {
    feedback: [],
    evidenceNote: 'No entries. Nothing has been filed against this prototype.',
    review: null,
  },
};

export function prototypeBySlug(slug: string): Prototype | undefined {
  return PROTOTYPES.find((p) => p.slug === slug);
}
