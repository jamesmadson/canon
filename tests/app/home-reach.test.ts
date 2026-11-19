import { describe, expect, it } from 'vitest';
import { PROBE_EVERY_MS, PROBE_MAX_HOSTS, hostsToProbe, markOf } from '../../src/app/lib/probe';

const link = (url: string, over: object = {}) => ({ kind: 'url' as const, url, ...over });

describe('markOf', () => {
  it('marks a localhost link whose server is down', () => {
    expect(markOf(link('http://localhost:5173/'), 'down')).toBe('server-off');
    expect(markOf(link('http://127.0.0.1:3000/'), 'down')).toBe('server-off');
    expect(markOf(link('http://[::1]:3000/'), 'down')).toBe('server-off');
  });
  it('says nothing while a check is running or the server answers', () => {
    expect(markOf(link('http://localhost:5173/'), 'checking')).toBeNull();
    expect(markOf(link('http://localhost:5173/'), 'up')).toBeNull();
  });
  it('never marks a remote link as server off', () => {
    expect(markOf(link('https://example.com/'), 'down')).toBeNull();
  });
  it('marks a version known to refuse framing, on any address', () => {
    expect(markOf(link('https://example.com/', { frameBlocked: true }), 'none')).toBe('new-tab');
    expect(markOf(link('http://localhost:5173/', { frameBlocked: true }), 'up')).toBe('new-tab');
  });
  it('lets server off win over refusing framing', () => {
    expect(markOf(link('http://localhost:5173/', { frameBlocked: true }), 'down')).toBe('server-off');
  });
  it('never marks a stored copy, even with a live address that is down', () => {
    expect(markOf({ kind: 'files', liveUrl: 'http://localhost:5173/' } as never, 'down')).toBeNull();
    expect(markOf({ kind: 'linked', frameBlocked: true } as never, 'down')).toBeNull();
  });
});

describe('hostsToProbe', () => {
  it('only picks local addresses, once per host and port', () => {
    const list = hostsToProbe([link('http://localhost:5173/a'), link('http://localhost:5173/b'), link('http://localhost:3000/'), link('https://example.com/'), { kind: 'files' } as never], new Map(), 0);
    expect(list.map((x) => x.host)).toEqual(['localhost:5173', 'localhost:3000']);
  });
  it('skips a host asked less than a minute ago', () => {
    const last = new Map([['localhost:5173', 1000]]);
    expect(hostsToProbe([link('http://localhost:5173/')], last, 1000 + PROBE_EVERY_MS - 1)).toEqual([]);
    expect(hostsToProbe([link('http://localhost:5173/')], last, 1000 + PROBE_EVERY_MS)).toHaveLength(1);
  });
  it('never takes more than 20 hosts at once', () => {
    const many = Array.from({ length: 50 }, (_, i) => link(`http://localhost:${4000 + i}/`));
    expect(hostsToProbe(many, new Map(), 0)).toHaveLength(PROBE_MAX_HOSTS);
  });
});
