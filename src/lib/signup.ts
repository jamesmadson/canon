export type SignupResult = 'ok' | 'invalid' | 'failed';

type FetchLike = (
  url: string,
  init: { method: 'POST'; body: URLSearchParams }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const PLAUSIBLE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Send one address to the sign-up endpoint and say plainly what happened.
 *
 * The body is a plain form encoding with no custom headers, so the browser
 * sends it as a simple request and the Apps Script endpoint needs no CORS
 * preflight. Anything short of the endpoint answering { ok: true } is not a
 * success: the form never tells someone they are on a list they are not on.
 */
export async function submitSignup(
  endpoint: string,
  rawEmail: string,
  source: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<SignupResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!PLAUSIBLE_EMAIL.test(email)) return 'invalid';

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: new URLSearchParams({ email, source }),
    });
    if (!response.ok) return 'failed';
    const body = (await response.json()) as { ok?: unknown; error?: unknown } | null;
    if (body && typeof body === 'object') {
      if (body.ok === true) return 'ok';
      if (body.error === 'invalid') return 'invalid';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
