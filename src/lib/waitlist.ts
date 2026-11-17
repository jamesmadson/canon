/** Whether the waitlist is open: only when there is an address to post to. */
export function waitlistOpen(url: string | undefined | null): url is string {
  return typeof url === 'string' && /^https?:\/\//.test(url.trim());
}

export const WAITLIST_THANKS = 'You are on the list. One email when hosting opens, and nothing else.';
export const WAITLIST_FAILED = 'Your sign-up did not go through. Check your connection and try again in a minute.';

export type WaitlistResult = { ok: boolean; message: string };

/**
 * Posts the form as a normal cors request and says it worked only when the
 * server answers with an ok status. A failed status and a network error both
 * come back as a failure, so the person can try again.
 */
export async function submitWaitlist(url: string, body: FormData, fetcher: typeof fetch = fetch): Promise<WaitlistResult> {
  try {
    const res = await fetcher(url, { method: 'POST', body });
    return res.ok ? { ok: true, message: WAITLIST_THANKS } : { ok: false, message: WAITLIST_FAILED };
  } catch {
    return { ok: false, message: WAITLIST_FAILED };
  }
}
