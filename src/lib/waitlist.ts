/** Whether the waitlist is open: only when there is an address to post to. */
export function waitlistOpen(url: string | undefined | null): url is string {
  return typeof url === 'string' && /^https?:\/\//.test(url.trim());
}
