import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ puts: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async () => [],
  put: async (name: string, value: any) => { db.puts.push([name, value]); },
  remove: async () => {},
  replaceFiles: async () => {},
}));

import * as store from '../../src/app/store';
import { prepare } from '../../src/app/intake';

const page = '<title>Checkout | Shop</title><h1>Payment</h1><h2>Delivery</h2>';
const files = (html: string) => [{ path: 'index.html', blob: new Blob([html], { type: 'text/html' }) }];

describe('a dropped prototype', () => {
  it('is tagged from its entry page and its source', async () => {
    const p = (await prepare({ name: 'shop', files: files(page) }))!;
    const f = await store.addPrepared('p1', p, { autoTag: true });
    expect(f.tags).toEqual(['files', 'checkout', 'payment', 'delivery']);
  });
  it('is not tagged when nothing asks for it', async () => {
    const p = (await prepare({ name: 'shop', files: files(page) }))!;
    const f = await store.addPrepared('p1', p, {});
    expect(f.tags).toBeUndefined();
  });
  it('keeps tags the caller gave', async () => {
    const p = (await prepare({ name: 'shop', files: files(page) }))!;
    const f = await store.addPrepared('p1', p, { autoTag: true, meta: { tags: ['mine'] } });
    expect(f.tags).toEqual(['mine']);
  });
});
