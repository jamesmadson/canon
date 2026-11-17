/** Joins the last two words with a non-breaking space, so no line ends on one word. */
export function tie(text: string): string {
  const i = text.lastIndexOf(' ');
  return i < 0 ? text : `${text.slice(0, i)} ${text.slice(i + 1)}`;
}
