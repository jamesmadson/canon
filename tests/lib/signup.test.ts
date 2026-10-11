import { describe, expect, it } from 'vitest';
import { submitSignup } from '../../src/lib/signup';

function fakeFetch(response: { ok: boolean; json?: unknown } | Error) {
  const calls: { url: string; body: string }[] = [];
  const impl = async (url: string, init: { body: URLSearchParams }) => {
    calls.push({ url, body: init.body.toString() });
    if (response instanceof Error) throw response;
    return { ok: response.ok, json: async () => response.json };
  };
  return { impl, calls };
}

describe('submitSignup', () => {
  it('posts the address and where it came from, as a simple form body', async () => {
    const { impl, calls } = fakeFetch({ ok: true, json: { ok: true } });
    const result = await submitSignup('https://example.test/exec', ' Ada@Team.dev ', '/canon/', impl);
    expect(result).toBe('ok');
    expect(calls).toEqual([{ url: 'https://example.test/exec', body: 'email=ada%40team.dev&source=%2Fcanon%2F' }]);
  });

  it('refuses an address that is not one, without a request', async () => {
    const { impl, calls } = fakeFetch({ ok: true, json: { ok: true } });
    expect(await submitSignup('https://example.test/exec', 'not-an-address', '/', impl)).toBe('invalid');
    expect(calls).toEqual([]);
  });

  it('reports the endpoint rejecting the address as invalid', async () => {
    const { impl } = fakeFetch({ ok: true, json: { ok: false, error: 'invalid' } });
    expect(await submitSignup('https://example.test/exec', 'a@b.co', '/', impl)).toBe('invalid');
  });

  it('reports a network failure or a bad response as failed, never as ok', async () => {
    expect(await submitSignup('https://x.test', 'a@b.co', '/', fakeFetch(new Error('offline')).impl)).toBe('failed');
    expect(await submitSignup('https://x.test', 'a@b.co', '/', fakeFetch({ ok: false }).impl)).toBe('failed');
    expect(await submitSignup('https://x.test', 'a@b.co', '/', fakeFetch({ ok: true, json: 'nonsense' }).impl)).toBe('failed');
  });
});
