/** Whether the waitlist is open: only when there is an address to post to. */
export function waitlistOpen(url: string | undefined | null): url is string {
  return typeof url === 'string' && /^https?:\/\//.test(url.trim());
}

export const WAITLIST_THANKS = 'You are on the list. One email when hosting opens, and nothing else.';
export const WAITLIST_FAILED = 'Your sign-up did not go through. Check your connection and try again in a minute.';
export const WAITLIST_INVALID = 'That address did not go through. Check it and try again.';
export const WAITLIST_BUSY = 'Too many sign-ups right now. Try again in a few minutes.';
export const WAITLIST_SUBJECT = 'Canon hosted waitlist';

export type WaitlistResult = { ok: boolean; message: string };

/**
 * Posts the email to Formspree as JSON and says it worked only when the
 * server answers with an ok status. A bad address, a rate limit and a failure
 * each get their own message, so the person knows what to do next.
 *
 * The form has a hidden field named _gotcha that people leave empty. When it
 * is filled in, nothing is sent.
 */
export async function submitWaitlist(url: string, body: FormData, fetcher: typeof fetch = fetch): Promise<WaitlistResult> {
  if (String(body.get('_gotcha') ?? '') !== '') return { ok: true, message: WAITLIST_THANKS };
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(body.get('email') ?? '').trim(), _subject: WAITLIST_SUBJECT }),
    });
    if (res.ok) return { ok: true, message: WAITLIST_THANKS };
    if (res.status === 429) return { ok: false, message: WAITLIST_BUSY };
    if (res.status >= 400 && res.status < 500 && (await hasErrors(res))) return { ok: false, message: WAITLIST_INVALID };
    return { ok: false, message: WAITLIST_FAILED };
  } catch {
    return { ok: false, message: WAITLIST_FAILED };
  }
}

async function hasErrors(res: Response): Promise<boolean> {
  try {
    const data = await res.json();
    return Array.isArray(data?.errors) && data.errors.length > 0;
  } catch {
    return false;
  }
}
