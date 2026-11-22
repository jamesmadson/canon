/** Sites known to refuse being shown in a frame. Their subdomains refuse too. */
export const FRAME_REFUSING_HOSTS = [
  'v0.app', 'v0.dev', 'lovable.dev', 'bolt.new', 'figma.com', 'framer.com',
  'replit.com', 'stackblitz.com', 'claude.ai', 'chatgpt.com', 'notion.so',
];

/** True when the link is on a host known to refuse framing, so Canon can say so before anyone looks at a blank page. */
export function refusesFraming(url: string): boolean {
  return framingHost(url) !== null;
}

/** The listed host a link is on (itself or a subdomain of it), or null. */
function framingHost(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; }
  return FRAME_REFUSING_HOSTS.find((h) => host === h || host.endsWith(`.${h}`)) ?? null;
}

const NBSP = '\u00a0';
const TIPS: Record<string, string> = {
  'v0.app': `This is v0’s editor. Publish it and add the vercel.app link to see it${NBSP}here.`,
  'v0.dev': `This is v0’s editor. Publish it and add the vercel.app link to see it${NBSP}here.`,
  'lovable.dev': `This is Lovable’s editor. Publish it and add the lovable.app link to see it${NBSP}here.`,
  'bolt.new': `This is Bolt’s editor. Deploy it and add the published link to see it${NBSP}here.`,
  'figma.com': `This is a Figma file. Publish your Make and add the published link to see it${NBSP}here.`,
  'framer.com': `This is Framer’s editor. Publish it and add the site link to see it${NBSP}here.`,
  'replit.com': `This is an editor. Add the running app’s link to see it${NBSP}here.`,
  'stackblitz.com': `This is an editor. Add the running app’s link to see it${NBSP}here.`,
};
const GENERIC_TIP = `To see it here, add a build folder or a zip as another${NBSP}version.`;

/** A tool-specific suggestion for a link that cannot be shown, keyed off its host. */
export function framingTip(url: string): string {
  const h = framingHost(url);
  return (h && TIPS[h]) || GENERIC_TIP;
}
