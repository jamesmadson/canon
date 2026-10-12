import { describe, expect, it } from 'vitest';
import { tidyPositions, clampZoom, screenToWorld, zoomAt } from '../../src/app/lib/layout';

const f = (id: string, w = 1280, h = 800) => ({ id, w, h });

describe('tidyPositions', () => {
  it('flows frames left to right with a gap, in order', () => {
    const pos = tidyPositions([f('a', 390, 844), f('b', 390, 844)], { maxRow: 3000, gap: 100 });
    expect(pos).toEqual({ a: { x: 0, y: 0 }, b: { x: 490, y: 0 } });
  });
  it('wraps when the next frame would pass the row width, under the tallest frame', () => {
    const pos = tidyPositions([f('a', 390, 844), f('b'), f('c')], { maxRow: 2000, gap: 100 });
    expect(pos.b).toEqual({ x: 490, y: 0 });
    expect(pos.c).toEqual({ x: 0, y: 944 });
  });
  it('never leaves a row empty for a frame wider than the row', () => {
    const pos = tidyPositions([f('a', 5000, 800)], { maxRow: 2000, gap: 100 });
    expect(pos.a).toEqual({ x: 0, y: 0 });
  });
});

describe('camera', () => {
  it('keeps zoom in range', () => {
    expect(clampZoom(0.001)).toBe(0.05);
    expect(clampZoom(40)).toBe(4);
  });
  it('maps a screen point into the world', () => {
    expect(screenToWorld({ x: 200, y: 100 }, { x: 100, y: 50, zoom: 0.5 })).toEqual({ x: 200, y: 100 });
  });
  it('zooms around the pointer so the point under it stays put', () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const next = zoomAt(cam, { x: 300, y: 200 }, 2);
    expect(screenToWorld({ x: 300, y: 200 }, next)).toEqual(screenToWorld({ x: 300, y: 200 }, cam));
    expect(next.zoom).toBe(2);
  });
});
