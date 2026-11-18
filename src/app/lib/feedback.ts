/** Sending feedback, kept apart from the dialog so it can be tested. Nothing here runs until a person presses a button. */

/** Where feedback is posted. Empty until the owner supplies a Formspree endpoint. */
export const FEEDBACK_URL = '';
export const ISSUES_URL = 'https://github.com/jamesmadson/canon/issues/new';
export const CANON_VERSION = '0.1.0';

export interface Fields { tried: string; happened: string; email: string }

export type SendResult = { ok: true } | { ok: false; reason: 'rate' | 'refused' | 'server' | 'network'; status?: number };

export function payloadOf(f: Fields, extra: Record<string, unknown> = {}) {
  return {
    _subject: 'Canon feedback', _gotcha: '',
    tried: f.tried.trim(), happened: f.happened.trim(), ...(f.email.trim() ? { email: f.email.trim() } : {}),
    canon_version: CANON_VERSION, ...extra,
  };
}

/** Post JSON and sort the answer into something a message can be written for. */
export async function postJson(url: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  try {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    if (r.status === 429) return { ok: false, reason: 'rate', status: 429 };
    if (r.status >= 500) return { ok: false, reason: 'server', status: r.status };
    return { ok: false, reason: 'refused', status: r.status };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export function failureMessage(r: Extract<SendResult, { ok: false }>): string {
  switch (r.reason) {
    case 'rate': return 'Too many messages were sent just now. Wait a minute and press Send again. What you typed is still here.';
    case 'refused': return `The feedback service did not accept it (code ${r.status}). Check the email address and press Send again. What you typed is still here.`;
    case 'server': return `The feedback service had a problem (code ${r.status}). Try again in a few minutes. What you typed is still here.`;
    default: return 'Canon could not reach the feedback service. Check your connection and press Send again. What you typed is still here.';
  }
}

const URL_LIMIT = 6000;

/** A prefilled GitHub issue. The email is left out because issues are public. The body is cut so the whole address stays under the limit. */
export function issueUrl(f: Fields): string {
  const title = (f.tried.trim().split('\n')[0] || 'Feedback').slice(0, 80);
  const build = (body: string) => `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  const full = `### What were you trying to do?\n${f.tried.trim()}\n\n### What happened?\n${f.happened.trim() || 'Not said.'}\n\nCanon ${CANON_VERSION}`;
  if (build(full).length < URL_LIMIT) return build(full);
  let body = full;
  while (body.length > 0 && build(`${body}…`).length >= URL_LIMIT) body = body.slice(0, Math.floor(body.length * 0.9));
  return build(`${body}…`);
}
