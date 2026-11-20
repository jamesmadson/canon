/** Sites known to refuse being shown in a frame. Their subdomains refuse too. */
export const FRAME_REFUSING_HOSTS = ['v0.app', 'v0.dev', 'lovable.dev', 'figma.com'];

/** True when the link is on a host known to refuse framing, so Canon can say so before anyone looks at a blank page. */
export function refusesFraming(url: string): boolean {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  return FRAME_REFUSING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
