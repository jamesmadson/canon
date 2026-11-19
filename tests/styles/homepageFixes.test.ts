import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { submitWaitlist, WAITLIST_FAILED, WAITLIST_THANKS } from '../../src/lib/waitlist';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('text on the ink panel', () => {
  const css = read('src/components/home/HomeStyles.astro');
  const tint = css.match(/\.tint \{[^}]*\}/)![0];
  const ground = tint.match(/--pbg:\s*(#[0-9a-f]{6})/i)![1];
  const colours = {
    ink: tint.match(/--pink:\s*(#[0-9a-f]{6})/i)![1],
    muted: tint.match(/--pmuted:\s*(#[0-9a-f]{6})/i)![1],
  };

  // The panel carries its own colours, so both themes see the same ones.
  it('has ink and muted colours at 4.5:1 or more on the panel', () => {
    expect(ratio(colours.ink, ground)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colours.muted, ground)).toBeGreaterThanOrEqual(4.5);
  });

  // Mutation: remove the .tint .pmeta override, so the source lines use the page's muted colour again.
  it('gives every muted class used inside the panel the panel muted colour', () => {
    const agent = read('src/components/home/AgentBand.astro');
    const panel = agent.slice(agent.indexOf('class="tint"'), agent.indexOf('<div class="after">'));
    const used = new Set([...panel.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' ')));
    const mutedClasses = ['muted', 'pmeta', 'say', 'dim'].filter((c) => used.has(c));
    expect(mutedClasses).toEqual(expect.arrayContaining(['say']));
    for (const sel of ['\\.mvhead span', '\\.mvrow span', '\\.mvempty']) {
      expect(css.match(new RegExp(`${sel} \\{[^}]*color: var\\(--pmuted\\)`)), sel).toBeTruthy();
    }
    for (const cls of mutedClasses) {
      const rule = css.match(new RegExp(`\\.tint \\.${cls} \\{[^}]*color: var\\(--pmuted\\)`)) ?? (cls === 'say' ? css.match(/\.say \{[^}]*color: var\(--pmuted\)/) : null);
      expect(rule, `.${cls} inside .tint`).toBeTruthy();
    }
  });
});

describe('submitWaitlist', () => {
  const data = new FormData();
  data.set('email', 'a@example.test');
  const ok = (status = 200) => (async () => new Response('', { status })) as typeof fetch;

  it('posts as a normal cors request and reports success only for an ok answer', async () => {
    let seen: RequestInit | undefined;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      seen = init;
      return new Response('', { status: 200 });
    }) as typeof fetch;
    const result = await submitWaitlist('https://example.test/join', data, fetcher);
    expect(result).toEqual({ ok: true, message: WAITLIST_THANKS });
    expect(seen?.method).toBe('POST');
    expect(seen?.mode).not.toBe('no-cors');
  });

  it('reports a failure for a 500 answer', async () => {
    const result = await submitWaitlist('https://example.test/join', data, ok(500));
    expect(result).toEqual({ ok: false, message: WAITLIST_FAILED });
  });

  it('reports a failure for a network error', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const result = await submitWaitlist('https://example.test/join', data, down);
    expect(result).toEqual({ ok: false, message: WAITLIST_FAILED });
  });

  it('says what happened and how to fix it', () => {
    expect(WAITLIST_FAILED).toMatch(/did not go through/);
    expect(WAITLIST_FAILED).toMatch(/try again/i);
  });
});

describe('submitWaitlist against Formspree answers', () => {
  const URL = 'https://formspree.io/f/xrpqqjqb';
  const form = (gotcha = '') => {
    const d = new FormData();
    d.set('email', ' a@example.test ');
    d.set('_gotcha', gotcha);
    return d;
  };
  const answer = (status: number, json?: unknown) => (async () => new Response(json === undefined ? '' : JSON.stringify(json), { status })) as typeof fetch;

  it('sends json with an Accept header, the email and the subject', async () => {
    let seen: RequestInit | undefined;
    let seenUrl = '';
    const fetcher = (async (u: string, init?: RequestInit) => {
      seenUrl = u;
      seen = init;
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;
    expect(await submitWaitlist(URL, form(), fetcher)).toEqual({ ok: true, message: WAITLIST_THANKS });
    expect(seenUrl).toBe(URL);
    expect(seen?.method).toBe('POST');
    const headers = seen?.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(seen?.body as string)).toEqual({ email: 'a@example.test', _subject: 'Canon hosted waitlist' });
  });

  it('does not send when the honeypot is filled', async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      return new Response('', { status: 200 });
    }) as typeof fetch;
    await submitWaitlist(URL, form('bot'), fetcher);
    expect(calls).toBe(0);
  });

  it('says the address did not go through for a 422 with errors', async () => {
    const r = await submitWaitlist(URL, form(), answer(422, { errors: [{ field: 'email', message: 'invalid' }] }));
    expect(r).toEqual({ ok: false, message: 'That address did not go through. Check it and try again.' });
  });

  it('keeps the retry message for a 4xx without errors', async () => {
    expect(await submitWaitlist(URL, form(), answer(403, { error: 'nope' }))).toEqual({ ok: false, message: WAITLIST_FAILED });
    expect(await submitWaitlist(URL, form(), answer(400))).toEqual({ ok: false, message: WAITLIST_FAILED });
  });

  it('says there are too many sign-ups for a 429', async () => {
    const r = await submitWaitlist(URL, form(), answer(429, { errors: [{ message: 'slow down' }] }));
    expect(r).toEqual({ ok: false, message: 'Too many sign-ups right now. Try again in a few minutes.' });
  });

  it('keeps the retry message for a 500 and for a thrown network error', async () => {
    expect(await submitWaitlist(URL, form(), answer(500, { errors: [{ message: 'boom' }] }))).toEqual({ ok: false, message: WAITLIST_FAILED });
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await submitWaitlist(URL, form(), down)).toEqual({ ok: false, message: WAITLIST_FAILED });
  });
});

describe('the form script', () => {
  const script = read('src/scripts/home.ts');
  // Mutation: show the thanks before checking the result, clear the form, or leave the button disabled on failure.
  it('shows the thanks only for ok, re-enables the button otherwise, and keeps what was typed', () => {
    expect(script).toContain('submitWaitlist(form.action');
    expect(script).not.toContain('no-cors');
    expect(script).not.toMatch(/form\.reset\(\)/);
    expect(script).toMatch(/if \(!result\.ok\) \{?[\s\S]*submit\.disabled = false/);
  });
  it('notes beside WAITLIST_URL that it must allow cross-origin posts', () => {
    expect(read('src/lib/site.ts')).toMatch(/cross-origin/);
  });
});
