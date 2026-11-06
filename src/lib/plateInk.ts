// White or Canon's ink, whichever reads better on a prototype's own colour
// (D-124). The colour is the prototype's content, so the type on it must
// follow it rather than a theme.
const WHITE = '#FFFFFF';
const INK = '#1A1918';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function plateInk(colour: string): string {
  return contrast(colour, WHITE) >= contrast(colour, INK) ? WHITE : INK;
}
