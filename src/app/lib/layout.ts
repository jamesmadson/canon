export interface Camera { x: number; y: number; zoom: number }
export interface Point { x: number; y: number }

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Camera x/y is where the world origin sits on screen. */
export const screenToWorld = (p: Point, cam: Camera): Point => ({ x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom });

export function zoomAt(cam: Camera, screen: Point, nextZoom: number): Camera {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(screen, cam);
  return { zoom, x: screen.x - world.x * zoom, y: screen.y - world.y * zoom };
}

/**
 * The tidy arrangement: frames in board order, flowing left to right and
 * wrapping when a row would pass maxRow wide, each row as tall as its tallest
 * frame. A computed view, never saved over the hand layout.
 */
export function tidyPositions(
  frames: { id: string; w: number; h: number }[],
  { maxRow, gap }: { maxRow: number; gap: number }
): Record<string, Point> {
  const out: Record<string, Point> = {};
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const fr of frames) {
    if (x > 0 && x + fr.w > maxRow) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    out[fr.id] = { x, y };
    x += fr.w + gap;
    rowH = Math.max(rowH, fr.h);
  }
  return out;
}

/** The camera that fits a set of rectangles inside a viewport, with margin. */
export function fitCamera(rects: { x: number; y: number; w: number; h: number }[], view: { w: number; h: number }, margin = 80): Camera {
  if (rects.length === 0) return { x: view.w / 2, y: view.h / 2, zoom: 1 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const zoom = clampZoom(Math.min((view.w - margin * 2) / (maxX - minX), (view.h - margin * 2) / (maxY - minY), 1));
  return { zoom, x: (view.w - (maxX - minX) * zoom) / 2 - minX * zoom, y: (view.h - (maxY - minY) * zoom) / 2 - minY * zoom };
}
