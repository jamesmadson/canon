/**
 * Keeps a loose card off the hero's prompt box. A card may overlap another
 * card but never the box: it goes above the box (shrinking to fit under the
 * panel's top edge) or below it, whichever its wished place is nearer. All
 * numbers are pixels in the stage's own coordinates.
 */
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Loose {
  /** Centre the card is headed for. */
  x: number;
  y: number;
  /** Half the thumbnail's size at scale 1. */
  halfW: number;
  halfH: number;
  scale: number;
  /** Turn in degrees. */
  rot: number;
  /** Where the card wished to sit vertically, before any clamping. */
  wishedY: number;
}

/** A card's reach once turned: its half sizes plus the turn's overhang. */
const reach = (halfW: number, halfH: number, rot: number) => {
  const a = (Math.abs(rot) * Math.PI) / 180;
  return { rw: halfW * Math.cos(a) + halfH * Math.sin(a), rh: halfW * Math.sin(a) + halfH * Math.cos(a) };
};

/** Where the card's reach lies. */
export function extent(c: Loose, scale = c.scale, y = c.y): Rect {
  const { rw, rh } = reach(c.halfW * scale, c.halfH * scale, c.rot);
  return { x0: c.x - rw, x1: c.x + rw, y0: y - rh, y1: y + rh };
}

export const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** The card's centre y and scale once it keeps clear of the box. `box` already includes its clearance. */
export function avoidBox(c: Loose, box: Rect, panelTop: number): { y: number; scale: number } {
  if (!overlaps(extent(c), box)) return { y: c.y, scale: c.scale };
  if (c.wishedY >= (box.y0 + box.y1) / 2) return { y: box.y1 + reach(c.halfW * c.scale, c.halfH * c.scale, c.rot).rh, scale: c.scale };
  const top = panelTop + 12;
  let scale = c.scale;
  let { rh } = reach(c.halfW * scale, c.halfH * scale, c.rot);
  const room = box.y0 - top;
  if (2 * rh > room) {
    scale = Math.max(0.5, (scale * room) / (2 * rh));
    ({ rh } = reach(c.halfW * scale, c.halfH * scale, c.rot));
  }
  return { y: Math.max(Math.min(box.y0 - rh, c.y), top + rh), scale };
}
