import type { ThumbKey } from '../../lib/thumbs';

/**
 * Data for the two hidden hero concepts, /hero-c/ and /hero-d/. Text and
 * muted tints only: no real logos and no brand colours.
 */

type Tint = 'sand' | 'sage' | 'clay' | 'slate' | 'lilac' | 'warm';

/** Cards that appear loose around the page for /hero-c/, then fade out as the eight real cards file. [thumbnail, x as a fraction of the stage width, y in px, turn, scale, shown on phones] */
export const EXTRAS: Array<[ThumbKey, number, number, number, number, boolean]> = [
  ['people', 0.3, 540, 4, 0.56, false],
  ['settings', 0.52, 330, -5, 0.62, false],
  ['today', 0.5, 690, 5, 0.7, false],
  ['dash', 0.985, 440, 6, 0.8, false],
  ['land', 1.1, 360, -5, 0.66, false],
  ['price', 0.8, 640, -4, 0.6, false],
  ['onb', -0.08, 410, 4, 0.7, false],
  ['prof', 0.6, -330, -5, 0.56, false],
  ['land', 1.1, 230, 5, 0.74, false],
  ['price', 0.52, 250, -4, 0.8, true],
  ['today', 0.5, 470, 5, 0.9, true],
];

/**
 * The strip of tabs for the tabs hero, in order, each with the tint of its
 * small square. The first eight are the ones the loop opens with, so they have
 * readable titles, and each is one of the eight prototypes (its tint is its
 * project's: Web app slate, Marketing site sand, iPhone app sage). The rest
 * crowd in after them.
 */
export const TABS: Array<[string, Tint]> = [
  ['Pricing · Lovable', 'sand'],
  ['Dashboard · v0', 'slate'],
  ['Onboarding · Figma Make', 'sage'],
  ['localhost:5173', 'slate'],
  ['Today · Claude Code', 'sage'],
  ['Landing page · Bolt', 'sand'],
  ['settings-new.zip', 'slate'],
  ['Profile · Codex', 'sage'],
  ['Team thread · Slack', 'warm'],
  ['localhost:3000', 'warm'],
  ['Checkout · Figma Make', 'lilac'],
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
  ['Invite teammate · Figma Make', 'lilac'],
  ['Share dialog · Figma Make', 'sand'],
  ['Overview · localhost:3000', 'warm'],
  ['Team page v2', 'sage'],
  ['Export flow · Claude Code', 'clay'],
  ['Empty dashboard · v0', 'slate'],
];

/**
 * Which tab each of the eight cards comes out of, in the order the cards
 * appear (Dashboard, People, Settings, Landing page, Pricing, Onboarding,
 * Today, Profile), matched to the card's source. All eight are among the first
 * eight tabs, so a phone keeps them.
 */
export const TAB_OF_CARD = [1, 3, 6, 5, 0, 2, 4, 7];

/** A phone shows this many tabs at most. */
export const PHONE_TABS = 12;
