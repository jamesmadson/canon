import type { ThumbKey } from '../../lib/thumbs';

/**
 * Data for the two hidden hero concepts, /hero-c/ and /hero-d/. Text and
 * muted tints only: no real logos and no brand colours.
 */

type Tint = 'sand' | 'sage' | 'clay' | 'slate' | 'lilac' | 'warm';

/** Cards that appear loose around the page for /hero-c/, then fade out as the nine real cards file. [thumbnail, x as a fraction of the stage width, y in px, turn, scale, shown on phones] */
export const EXTRAS: Array<[ThumbKey, number, number, number, number, boolean]> = [
  ['w3', 0.3, 540, 4, 0.56, false],
  ['d2', 0.52, 330, -5, 0.62, false],
  ['m1', 0.5, 690, 5, 0.7, false],
  ['d1', 0.985, 440, 6, 0.8, false],
  ['w4', 1.1, 360, -5, 0.66, false],
  ['d3', 0.8, 640, -4, 0.6, false],
  ['w5', -0.08, 410, 4, 0.7, false],
  ['w2', 0.6, -330, -5, 0.56, false],
  ['w4', 1.1, 230, 5, 0.74, false],
  ['d3', 0.52, 250, -4, 0.8, true],
  ['m1', 0.5, 470, 5, 0.9, true],
];

/** The strip of tabs for /hero-d/, in order, each with the tint of its small square. */
export const TABS: Array<[string, Tint]> = [
  ['Checkout v3 · Lovable', 'sand'],
  ['localhost:3000', 'warm'],
  ['Onboarding final FINAL', 'sage'],
  ['pricing-v2.zip', 'clay'],
  ['v0 · Dashboard', 'slate'],
  ['Welcome flow · Figma Make', 'lilac'],
  ['localhost:5173', 'warm'],
  ['Invite teammate · Bolt', 'sage'],
  ['settings-new.zip', 'clay'],
  ['Untitled · Framer', 'sand'],
  ['Mobile nav · v0', 'slate'],
  ['Notes · Replit', 'lilac'],
  ['Empty state copy', 'sand'],
  ['Search results v2', 'sage'],
  ['localhost:4321', 'warm'],
  ['Sign up · Lovable', 'clay'],
  ['dashboard-old.zip', 'slate'],
  ['Table view · Codex', 'lilac'],
  ['Landing hero b', 'sand'],
  ['Billing · Vercel', 'sage'],
  ['Tab bar · Netlify', 'clay'],
  ['localhost:8080', 'warm'],
  ['Profile v4 final', 'slate'],
  ['Cards test · Bolt', 'lilac'],
  ['Notes by month', 'sand'],
  ['Filters · v0', 'sage'],
  ['Onboarding (2)', 'clay'],
  ['Pricing page · Lovable', 'slate'],
  ['mobile-sign-up.zip', 'lilac'],
  ['Share dialog · Figma Make', 'sand'],
  ['Overview · localhost:3000', 'warm'],
  ['Team page v2', 'sage'],
  ['Export flow · Claude Code', 'clay'],
  ['Empty dashboard · v0', 'slate'],
];

/**
 * Which tab each of the nine cards comes out of, in the order the cards
 * appear. The six cards a phone shows come from the first twelve tabs, the
 * ones a phone keeps.
 */
export const TAB_OF_CARD = [1, 3, 14, 5, 7, 19, 9, 11, 25];

/** A phone shows this many tabs. */
export const PHONE_TABS = 12;
