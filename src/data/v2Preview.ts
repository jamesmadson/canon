/**
 * Scripted data for the Canon v2 preview screens.
 *
 * Every name, repo, branch, quote and date below is invented for this preview.
 * There is no team called Fern Labs, no app called Fernwell, and no person
 * named here. Nothing in this file is drawn from any real project.
 *
 * Dates are fixed against PREVIEW_AS_OF so the walkthrough reads the same in a
 * year as it does today — a preview that slowly turns every card stale would be
 * lying in a different direction.
 */

export const PREVIEW_AS_OF = '2026-08-27';

export const PREVIEW_NOTE = 'A scripted preview, not the product. All names and data invented.';

/** Which wireframe ScreenArt draws for a prototype. */
export type ScreenKey = 'today' | 'streaks' | 'map' | 'onboarding';

export interface Prototype {
  slug: string;
  name: string;
  summary: string;
  /**
   * The screen this prototype is a version of — drives ScreenArt.
   *
   * `null` means Canon has never seen this one run: no branch deploy, no
   * attached preview URL, nothing to frame. An empty prototype borrowing
   * another screen's wireframe would be the one picture in here that lies, so
   * the empty case gets an empty frame that says what is missing.
   */
  screen: ScreenKey | null;
  /** Where Canon indexed it from. A prototype is a reference, never a copy. */
  origin: 'Git' | 'Figma';
  /** Branch name for Git prototypes, frame name for Figma ones. */
  ref: string;
  /**
   * True only for branches Canon opened itself, which is the one case where the
   * `prototype-` prefix appears. Everything else was selected as it was found.
   */
  createdInCanon: boolean;
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
  /** Shown in place of the thread when nothing has been filed yet. */
  emptyFeedbackNote: string;
  /**
   * Where "Run a review" goes from the empty run state, or null when this
   * preview scripts no run for it. A link to a screen that does not exist
   * would be the same lie as a disabled row pretending to be clickable.
   */
  runPath: string | null;
}

export const PROJECT = {
  name: 'Fernwell',
  team: 'Fern Labs',
  tagline: 'A daily dose of the outdoors, measured.',
  blurb:
    'A phone app for logging time outside: a daily target ring, a streak, and a quiet map of the green space nearby. Every prototype here is indexed from one repository and one Figma file.',
  repo: 'fern-labs/fernwell',
  /** The second repository, connected after onboarding. Also invented. */
  secondRepo: 'fern-labs/trailhead',
  figmaFile: 'Fernwell — concepts',
  account: 'ade@fernlabs.co',
  handle: '@ade-fernlabs',
  /** The signed-in person as the chrome shows them. Invented. */
  viewer: { name: 'Ade O.', initials: 'AO' },
};

export interface Branch {
  name: string;
  /** Selected branches become prototypes. Selection, not a prefix, is the rule. */
  selected: boolean;
  note: string;
}

/**
 * The repository as Canon found it: six branches, three conventions, no house
 * style. Canon does not ask anyone to rename anything — a person picks which
 * branches are prototypes, and the rest stay branches.
 */
export const BRANCHES: Branch[] = [
  { name: 'main', selected: false, note: 'What ships. Not a prototype.' },
  { name: 'develop', selected: false, note: 'Integration branch. Not a prototype.' },
  { name: 'feat/today-ring-v2', selected: true, note: 'Second pass at the daily ring.' },
  { name: 'exp/streak-cards', selected: true, note: 'Streaks, tried three ways.' },
  { name: 'fix/copy-pass', selected: false, note: 'Copy corrections. Nothing to review.' },
  { name: 'prototype-map-layers', selected: true, note: 'Opened from Canon, so Canon named it.' },
];

/**
 * The second repository, as the import flow finds it. A different product by
 * the same invented team — a route planner — so the branch names read as
 * somebody else's work rather than more Fernwell.
 *
 * Kept separate from BRANCHES on purpose: BRANCHES is the repo Canon saw at
 * onboarding, and folding a later import into it would quietly rewrite what
 * that screen showed.
 */
export const IMPORT_BRANCHES: Branch[] = [
  { name: 'main', selected: false, note: 'What ships. Not a prototype.' },
  { name: 'develop', selected: false, note: 'Integration branch. Not a prototype.' },
  { name: 'feat/route-editor', selected: true, note: 'Dragging a route by its points.' },
  { name: 'exp/elevation-profile', selected: true, note: 'The climb, drawn under the map.' },
  { name: 'fix/unit-labels', selected: false, note: 'Miles and kilometres. Nothing to review.' },
];

/**
 * The branch Canon opens for you in the create flow, and the one place the
 * `prototype-` prefix comes from: Canon is the thing doing the naming.
 */
export const NEW_PROTOTYPE = {
  name: 'Dawn mode',
  slug: 'dawn-mode',
  branch: 'prototype-dawn-mode',
  baseBranch: 'main',
};

export const PROTOTYPES: Prototype[] = [
  {
    slug: 'today-ring-v2',
    name: 'Today ring v2',
    summary:
      "The home screen: one ring for the day's minutes outside, the target under it, and the three numbers a person checks before deciding whether to go out again.",
    screen: 'today',
    origin: 'Git',
    ref: 'feat/today-ring-v2',
    createdInCanon: false,
    author: 'Ade O.',
    lastActivity: '2026-08-25',
    lastActivityNote: 'Commit — "hold the ring open until the target is met"',
    sources: [
      { label: 'Branch', detail: 'fern-labs/fernwell · feat/today-ring-v2' },
      { label: 'Preview', detail: 'today-ring-v2.preview.fernlabs.example' },
      { label: 'Figma frame', detail: 'Fernwell — concepts · Today v6' },
    ],
  },
  {
    slug: 'streak-cards',
    name: 'Streak cards',
    summary:
      'The week as seven dots and the month as a grid. An experiment in showing a streak without leaning on the fear of breaking it.',
    screen: 'streaks',
    origin: 'Git',
    ref: 'exp/streak-cards',
    createdInCanon: false,
    author: 'Ruth Vantine',
    lastActivity: '2026-08-22',
    lastActivityNote: 'Commit — "drop the flame, keep the count"',
    sources: [
      { label: 'Branch', detail: 'fern-labs/fernwell · exp/streak-cards' },
      { label: 'Preview', detail: 'streak-cards.preview.fernlabs.example' },
    ],
  },
  {
    slug: 'map-layers',
    name: 'Map layers',
    summary:
      'Green space near you, drawn as outlines rather than a photographic map, with layers you can turn on. Parked while the outdoor-legibility question is open.',
    screen: 'map',
    origin: 'Git',
    ref: 'prototype-map-layers',
    createdInCanon: true,
    author: 'Piet Halvorsen',
    lastActivity: '2026-08-01',
    lastActivityNote: 'Commit — "first pass at the parks layer"',
    sources: [
      { label: 'Branch', detail: 'fern-labs/fernwell · prototype-map-layers' },
      { label: 'Preview', detail: 'map-layers.preview.fernlabs.example' },
    ],
  },
  {
    slug: 'onboarding-concepts',
    name: 'Onboarding concepts',
    summary:
      'Three intro cards that explain the target before asking for a location permission. Figma only — no branch yet.',
    screen: 'onboarding',
    origin: 'Figma',
    ref: 'Fernwell — concepts · Onboarding 1–3',
    createdInCanon: false,
    author: 'Noor Ekelund',
    lastActivity: '2026-08-18',
    lastActivityNote: 'Figma edit — third card rewritten',
    sources: [{ label: 'Figma frame', detail: 'Fernwell — concepts · Onboarding 1–3' }],
  },
  {
    slug: NEW_PROTOTYPE.slug,
    name: NEW_PROTOTYPE.name,
    summary:
      'A low-light palette for the hour after sunrise, which is when most of the logging actually happens. Opened from Canon a moment ago — the branch exists and nothing has landed on it yet.',
    screen: null,
    origin: 'Git',
    ref: NEW_PROTOTYPE.branch,
    createdInCanon: true,
    author: PROJECT.viewer.name,
    lastActivity: PREVIEW_AS_OF,
    lastActivityNote: `Branch opened from ${NEW_PROTOTYPE.baseBranch} — no commits yet`,
    sources: [{ label: 'Branch', detail: `${PROJECT.repo} · ${NEW_PROTOTYPE.branch}` }],
  },
];

export const RECORDS: Record<string, PrototypeRecord> = {
  'today-ring-v2': {
    feedback: [
      {
        id: '2026-08-19-01',
        date: '2026-08-19',
        speaker: 'P-02',
        context: 'Moderated session, 35 minutes, own phone',
        said: 'It looked finished, so I went back inside. It was forty-eight minutes.',
        meant:
          'My reading: at four-fifths the ring closes far enough to read as done, and the number inside it loses the argument. One participant so far.',
        decided: null,
      },
      {
        id: '2026-08-20-01',
        date: '2026-08-20',
        speaker: 'P-07',
        context: 'Moderated session, 30 minutes, own phone',
        said: 'The gap is so small I just read it as a circle.',
        meant:
          'My reading: the same misread as P-02, arrived at from the shape rather than the number. Two participants, which is a possible pattern, not a pattern.',
        decided:
          '2026-08-25 — The ring now holds a visible gap until the target is actually met, and the minutes remaining print inside it. Shipped on feat/today-ring-v2.',
      },
      {
        id: '2026-08-21-01',
        date: '2026-08-21',
        speaker: 'S-01',
        context: 'Written note after a review',
        said: 'Could we put the weekly average on here too? This is the screen people actually open.',
        meant:
          'My reading: a stakeholder request, kept apart from the participant evidence above and not pooled with it. No participant has asked for a weekly average.',
        decided: null,
      },
    ],
    evidenceNote:
      'Three entries, two participants and one stakeholder. Two participants is a possible pattern and the count is said out loud; the stakeholder request stays out of that count.',
    review: {
      skill: 'deter',
      ranOn: '2026-08-26',
      target: 'feat/today-ring-v2 · today-ring-v2.preview.fernlabs.example',
      findings: [
        {
          remove: 'The "Great work today" banner above the ring',
          because:
            'It shows at every value, twelve minutes included, so it praises nothing in particular — and it costs the stat row its place above the fold on a 390pt screen.',
        },
        {
          remove: 'The second target readout beneath the stat row',
          because: 'The same figure is already printed inside the ring, a screen-height above it.',
        },
        {
          remove: 'The count-up animation on the minutes figure',
          because:
            'It withholds the one number the screen exists for by about a second, and the ring has already answered the question by the time it lands.',
        },
        {
          remove: 'The share button in the header',
          because:
            'It is the only control in the top corner and the least-used action on the screen. Log time outside — the reason the screen opens — sits in thumb reach and should stay the only button.',
        },
      ],
      kept: 'The gap in the ring stays. It is the one mark on the screen that tells forty-eight minutes apart from sixty.',
    },
    emptyFeedbackNote: 'Nothing filed against this prototype.',
    runPath: null,
  },
  'streak-cards': {
    feedback: [
      {
        id: '2026-08-16-01',
        date: '2026-08-16',
        speaker: 'P-05',
        context: 'Moderated session, 25 minutes, own phone',
        said: 'I missed a Tuesday and then I stopped opening it. It felt like being told off.',
        meant:
          'My reading: the broken streak reads as a verdict on the person rather than a record of a week. One participant.',
        decided: null,
      },
      {
        id: '2026-08-21-02',
        date: '2026-08-21',
        speaker: 'P-08',
        context: 'Moderated session, 30 minutes, own phone',
        said: 'Nine days is nice, but the card mostly tells me what I am about to lose.',
        meant:
          'My reading: the same pressure P-05 described, named directly rather than acted on. Two participants — a possible pattern, and the second one I have on this screen.',
        decided:
          '2026-08-22 — The flame glyph and the loss subtitle came off the card. The day count stays. Shipped on exp/streak-cards.',
      },
    ],
    evidenceNote:
      'Two entries, two participants. Two is a possible pattern, not a pattern — the count is on the card so the next reader can judge it themselves.',
    review: {
      skill: 'deter',
      ranOn: '2026-08-22',
      target: 'exp/streak-cards · streak-cards.preview.fernlabs.example',
      findings: [
        {
          remove: 'The flame glyph on every streak card',
          because: 'It sits on all seven cards, so it marks none of them out.',
        },
        {
          remove: 'The "Don\'t lose your streak" subtitle',
          because:
            'It restates the number above it, and two participants read it as pressure rather than as information.',
        },
      ],
      kept: 'The plain day count stays. It is the only thing on the card a person came to check.',
    },
    emptyFeedbackNote: 'Nothing filed against this prototype.',
    runPath: null,
  },
  'map-layers': {
    feedback: [
      {
        id: '2026-08-05-01',
        date: '2026-08-05',
        speaker: 'P-09',
        context: 'Field test, 20 minutes, bright overcast, own phone',
        said: 'Out here I cannot tell which layer is on. It is all grey on grey.',
        meant:
          'My reading: the layer chips carry their state in a fill that survives a desk and not a footpath. Legibility outdoors, not comprehension. One participant.',
        decided: null,
      },
    ],
    evidenceNote:
      'One entry, one participant. One participant is a quote, not a pattern — and it is the reason this branch is parked rather than abandoned.',
    review: null,
    emptyFeedbackNote: 'Nothing filed against this prototype.',
    runPath: '/v2-preview/map-layers/run/',
  },
  'onboarding-concepts': {
    feedback: [],
    evidenceNote: 'No entries. Nothing has been filed against this prototype.',
    review: null,
    emptyFeedbackNote: 'Nothing filed against this prototype.',
    runPath: null,
  },
  [NEW_PROTOTYPE.slug]: {
    feedback: [],
    evidenceNote:
      'No entries, because nothing has been shown to anyone yet. An empty record is the honest state of a prototype that is one minute old.',
    review: null,
    emptyFeedbackNote: "No feedback yet. Share the link once there's something to react to.",
    runPath: null,
  },
};

/**
 * The run the review flow produces, kept out of RECORDS on purpose.
 *
 * This preview has no state to keep, so a run "filed" on one screen cannot
 * show up on another. Rather than pretend otherwise, the result page carries
 * the run and says plainly that Map layers still reads as having none.
 */
export const SCRIPTED_RUN: ReviewRun = {
  skill: 'deter',
  ranOn: PREVIEW_AS_OF,
  target: 'prototype-map-layers · map-layers.preview.fernlabs.example',
  findings: [
    {
      remove: 'The compass rose above the layer chips',
      because:
        'North is up in every state this screen has, so the rose is a fixed answer to a question nobody asked. Where am I is the question, and the location dot has already answered it a thumb-length lower down.',
    },
    {
      remove: 'The solid fill on the active layer chips',
      because:
        'The fill is the heaviest mark on the screen and it sits directly over the path, which is the one line the map is drawn to show. A field test already found the chip states unreadable outdoors, so the fill is not buying the state it costs.',
    },
    {
      remove: 'The legend under the map',
      because:
        'It names the same three layers as the chips above it, in the same order, adding no word. On a 390pt screen that repetition costs the map a fifth of its height.',
    },
  ],
  kept: 'The chips themselves stay. Turning a layer off is the only thing a person can do on this screen, and the row is where they do it.',
};

export function prototypeBySlug(slug: string): Prototype | undefined {
  return PROTOTYPES.find((p) => p.slug === slug);
}

/** The one line a card shows under the name: a branch, or the Figma file. */
export function sourceLine(prototype: Prototype): { mono: boolean; text: string } {
  return prototype.origin === 'Git'
    ? { mono: true, text: prototype.ref }
    : { mono: false, text: `Figma · ${PROJECT.figmaFile}` };
}

/** Derived, never written down — the stat strip must not outlive the data. */
export const SELECTED_BRANCHES = BRANCHES.filter((b) => b.selected).length;
export const IMPORT_SELECTED = IMPORT_BRANCHES.filter((b) => b.selected).length;
export const REVIEW_RUNS = Object.values(RECORDS).filter((r) => r.review).length;
export const GIT_PROTOTYPES = PROTOTYPES.filter((p) => p.origin === 'Git').length;
export const FIGMA_PROTOTYPES = PROTOTYPES.length - GIT_PROTOTYPES;

/**
 * Prototypes Canon opened after the repository was connected, so they were
 * never in the branch list onboarding showed. Counting them separately is what
 * keeps the stat strip's arithmetic closable: branches picked at connect, plus
 * these, plus the Figma set, equals the number of prototypes.
 */
const CONNECTED_BRANCH_NAMES = new Set(BRANCHES.map((b) => b.name));
export const OPENED_SINCE = PROTOTYPES.filter(
  (p) => p.createdInCanon && !CONNECTED_BRANCH_NAMES.has(p.ref),
).length;

/** The prefixed branches, named in the dashboard's own sentence about them. */
export const CANON_NAMED_REFS = PROTOTYPES.filter((p) => p.createdInCanon).map((p) => p.ref);
