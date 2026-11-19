import { describe, expect, it } from 'vitest';
import { avoidBox, extent, overlaps, type Loose } from '../../src/lib/scatterAvoid';

// The prompt box with its clearance, in stage pixels, below a panel whose top is 0.
const box = { x0: 700, y0: 140, x1: 1140, y1: 270 };
const card = (over: Partial<Loose> = {}): Loose => ({ x: 900, y: 60, halfW: 150, halfH: 84, scale: 0.7, rot: -5, wishedY: -380, ...over });

describe('a loose card and the prompt box', () => {
  it('goes untouched when it is clear of the box', () => {
    const c = card({ x: 200, y: 100 });
    expect(avoidBox(c, box, 0)).toEqual({ y: 100, scale: 0.7 });
  });

  it('goes above the box when it wished to be above, never tucked behind its top edge', () => {
    const c = card({ y: 100 });
    expect(overlaps(extent(c), box)).toBe(true);
    const r = avoidBox(c, box, 0);
    expect(overlaps(extent(c, r.scale, r.y), box)).toBe(false);
    expect(extent(c, r.scale, r.y).y1).toBeLessThanOrEqual(box.y0);
  });

  it('shrinks to fit under the panel top when there is not room above the box at its wished size', () => {
    const c = card({ y: 90, halfH: 110 });
    const r = avoidBox(c, box, 0);
    expect(r.scale).toBeLessThan(c.scale);
    const e = extent(c, r.scale, r.y);
    expect(e.y1).toBeLessThanOrEqual(box.y0);
    expect(e.y0).toBeGreaterThanOrEqual(0);
  });

  it('goes below the box when it wished to be nearer the bottom, clear of its lower edge', () => {
    const c = card({ y: 250, wishedY: 300 });
    const r = avoidBox(c, box, 0);
    expect(r.scale).toBe(c.scale);
    expect(extent(c, r.scale, r.y).y0).toBeGreaterThanOrEqual(box.y1);
  });

  it('may overlap other cards: only the box counts', () => {
    const a = card({ x: 300, y: 100 });
    const b = card({ x: 330, y: 110 });
    expect(overlaps(extent(a), extent(b))).toBe(true);
    expect(avoidBox(a, box, 0).y).toBe(100);
    expect(avoidBox(b, box, 0).y).toBe(110);
  });
});
