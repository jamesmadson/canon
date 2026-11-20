// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { UrlDialog } from '../../src/app/ui';
import { clear, fire, mount, type } from './helpers/dom';
import { nameFromUrl, rememberLinkName, takeLinkName, titleFromSameOrigin } from '../../src/app/lib/linkname';

describe('nameFromUrl', () => {
  it('turns the last meaningful path segment into words', () => {
    expect(nameFromUrl('https://example.com/designs/pricing-page')).toBe('Pricing page');
    expect(nameFromUrl('https://example.com/work/checkout_flow/')).toBe('Checkout flow');
    expect(nameFromUrl('https://example.com/a/Onboarding%20v2.html')).toBe('Onboarding v2');
  });
  it('skips index pages and ids', () => {
    expect(nameFromUrl('https://example.com/pricing/index.html')).toBe('Pricing');
    expect(nameFromUrl('https://example.com/pricing/12345')).toBe('Pricing');
    expect(nameFromUrl('https://example.com/pricing/3f2a9c1e8b7d')).toBe('Pricing');
    expect(nameFromUrl('https://example.com/pricing/123e4567-e89b-12d3-a456-426614174000')).toBe('Pricing');
  });
  it('falls back to the host without www', () => {
    expect(nameFromUrl('https://www.example.com/')).toBe('example.com');
    expect(nameFromUrl('https://example.com')).toBe('example.com');
    expect(nameFromUrl('https://www.example.com/index.html')).toBe('example.com');
    expect(nameFromUrl('http://localhost:5173/')).toBe('localhost:5173');
  });
  it('never throws on something that is not an address', () => {
    expect(nameFromUrl('nope')).toBe('nope');
  });
});

describe('the name a person typed in the add dialog', () => {
  it('is handed to the add once', () => {
    rememberLinkName('https://example.com/x', 'My name');
    expect(takeLinkName('https://example.com/x')).toBe('My name');
    expect(takeLinkName('https://example.com/x')).toBeUndefined();
  });
  it('is ignored when blank', () => {
    rememberLinkName('https://example.com/y', '   ');
    expect(takeLinkName('https://example.com/y')).toBeUndefined();
  });
});

describe('titleFromSameOrigin', () => {
  const frameOf = (doc: unknown) => ({ get contentDocument() { if (doc instanceof Error) throw doc; return doc; } }) as unknown as HTMLIFrameElement;
  it('reads the title only when the page is on the same origin as Canon', () => {
    expect(titleFromSameOrigin(frameOf({ title: ' Pricing ' }), 'http://localhost:4792/x', 'http://localhost:4792')).toBe('Pricing');
  });
  it('never reads another origin, and does not even touch its document', () => {
    let touched = false;
    const el = { get contentDocument() { touched = true; return { title: 'Secret' }; } } as unknown as HTMLIFrameElement;
    expect(titleFromSameOrigin(el, 'https://example.com/', 'http://localhost:4792')).toBeNull();
    expect(touched).toBe(false);
  });
  it('is null for an empty title or a document that cannot be read', () => {
    expect(titleFromSameOrigin(frameOf({ title: '' }), 'http://a.test/', 'http://a.test')).toBeNull();
    expect(titleFromSameOrigin(frameOf(new Error('blocked')), 'http://a.test/', 'http://a.test')).toBeNull();
    expect(titleFromSameOrigin(frameOf(null), 'http://a.test/', 'http://a.test')).toBeNull();
  });
});

describe('the add dialog', () => {
  afterEach(clear);

  it('puts the cursor in the address with the example selected, so a pasted link replaces it', async () => {
    const box = await mount(UrlDialog, { onClose: () => {} });
    const address = box.querySelector<HTMLInputElement>('#url-address')!;
    expect(document.activeElement).toBe(address);
    expect(address.selectionStart).toBe(0);
    expect(address.selectionEnd).toBe(address.value.length);
    expect(box.querySelector<HTMLInputElement>('#url-name')!.value).toBe('localhost:5173');
  });

  it('suggests a name from the address until one is typed, and hands it on', async () => {
    let closed: string | null = 'unset';
    const box = await mount(UrlDialog, { onClose: (v: string | null) => { closed = v; } });
    const address = box.querySelector<HTMLInputElement>('#url-address')!;
    await type(address, 'https://example.com/work/pricing-page');
    const name = box.querySelector<HTMLInputElement>('#url-name')!;
    expect(name.value).toBe('Pricing page');
    await type(name, 'Mine');
    await type(address, 'https://example.com/work/other-page');
    expect(name.value).toBe('Mine');
    await fire(box.querySelector('form')!, new Event('submit', { bubbles: true, cancelable: true }));
    expect(closed).toBe('https://example.com/work/other-page');
    expect(takeLinkName('https://example.com/work/other-page')).toBe('Mine');
  });
});
