import { describe, expect, it, vi } from 'vitest';
import { decideShown, loopbackHost, probeLoopback, serverOffMessage } from '../../src/app/lib/probe';

describe('loopbackHost', () => {
  it('names localhost, 127.0.0.1 and [::1] with their port', () => {
    expect(loopbackHost('http://localhost:5173/')).toBe('localhost:5173');
    expect(loopbackHost('http://127.0.0.1:3000/x?y=1')).toBe('127.0.0.1:3000');
    expect(loopbackHost('http://[::1]:8080')).toBe('[::1]:8080');
    expect(loopbackHost('https://localhost/')).toBe('localhost');
  });
  it('is null for everything else', () => {
    for (const u of [
      'https://example.com/', 'http://localhost.example.com/', 'http://127.0.0.1.example.com/', 'http://example.com/localhost',
      'http://user@evil.com/', 'http://evil.com#@localhost/', 'http://192.168.1.5:3000/', 'http://0.0.0.0:3000/', 'http://10.0.0.1/',
      'http://app.localhost:3000/', 'http://127.0.0.2/', 'http://[::2]/', 'http://localhost@evil.com/', 'ftp://localhost/', 'javascript:alert(1)', 'not a url', '', undefined, null,
    ]) {
      expect(loopbackHost(u as string), String(u)).toBeNull();
    }
  });
});

describe('probeLoopback only ever asks this machine', () => {
  const ok = () => vi.fn(async () => ({ type: 'opaque' }) as unknown as Response);

  it('never calls fetch for an address that is not loopback', async () => {
    const f = ok();
    for (const u of ['https://example.com/', 'http://localhost.evil.test/', 'http://192.168.0.2:3000/', 'http://[::2]/', 'http://evil.test/#@localhost']) {
      expect(await probeLoopback(u, f)).toBe('skipped');
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('asks the root of a loopback server once, with no body, no cookies and no readable answer', async () => {
    const f = ok();
    expect(await probeLoopback('http://localhost:5173/some/page?token=abc#x', f)).toBe('up');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:5173/');
    expect(init).toMatchObject({ method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' });
    expect(init).not.toHaveProperty('body');
    expect(init.headers).toBeUndefined();
  });

  it('does not follow a redirect and sends no referrer: an opaque redirect counts as up after one request', async () => {
    const f = vi.fn(async () => ({ type: 'opaqueredirect', status: 0 }) as unknown as Response);
    expect(await probeLoopback('http://localhost:5173/', f)).toBe('up');
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init).toMatchObject({ redirect: 'manual', referrerPolicy: 'no-referrer' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('a server with no CORS headers is asked a second time without reading the answer, still with no referrer', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('blocked'))
      .mockResolvedValueOnce({ type: 'opaque' });
    expect(await probeLoopback('http://localhost:5173/', f as unknown as typeof fetch)).toBe('up');
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1]).toMatchObject({ mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('says down when the server refuses, and when it does not answer in time', async () => {
    const refused = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await probeLoopback('http://127.0.0.1:9/', refused)).toBe('down');
    const silent = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))));
    expect(await probeLoopback('http://[::1]:9/', silent as unknown as typeof fetch, 20)).toBe('down');
  });
});

describe('the server-off message', () => {
  it('names the real host and port and says how to fix it', () => {
    expect(serverOffMessage('http://localhost:5173/')).toBe('The server at localhost:5173 is not running. Start it, or ask your agent to add a built copy.');
    expect(serverOffMessage('http://127.0.0.1:3000/a')).toBe('The server at 127.0.0.1:3000 is not running. Start it, or ask your agent to add a built copy.');
  });
});

describe('what a prototype shows', () => {
  const stored = { id: 'a', kind: 'files', liveUrl: 'http://localhost:5173/' } as const;
  const link = { id: 'b', kind: 'url', url: 'http://localhost:5173/' } as const;
  const hosted = { id: 'c', kind: 'url', url: 'https://x.example.com/' } as const;

  it('a stored copy shows its files by default, whatever the server is doing', () => {
    for (const reach of ['none', 'checking', 'up', 'down'] as const) expect(decideShown(stored as any, false, reach)).toEqual({ show: 'stored' });
  });
  it('with Live on it shows the live address, and says so when the server stopped', () => {
    expect(decideShown(stored as any, true, 'up')).toEqual({ show: 'live', url: 'http://localhost:5173/' });
    expect(decideShown(stored as any, true, 'checking')).toEqual({ show: 'live', url: 'http://localhost:5173/' });
    expect(decideShown(stored as any, true, 'down')).toEqual({ show: 'off', url: 'http://localhost:5173/' });
  });
  it('a stored copy with no live address ignores Live', () => {
    expect(decideShown({ id: 'd', kind: 'files' } as any, true, 'none')).toEqual({ show: 'stored' });
  });
  it('a link to this machine waits for the check, then shows or says the server is off', () => {
    expect(decideShown(link as any, false, 'checking')).toEqual({ show: 'wait' });
    expect(decideShown(link as any, false, 'up')).toEqual({ show: 'link' });
    expect(decideShown(link as any, false, 'down')).toEqual({ show: 'off', url: 'http://localhost:5173/' });
  });
  it('any other link shows as it does today', () => {
    for (const reach of ['none', 'checking', 'down'] as const) expect(decideShown(hosted as any, false, reach)).toEqual({ show: 'link' });
  });
});
