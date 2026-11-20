// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { UrlDialog } from '../../src/app/ui';
import { clear, fire, key, mount, type } from './helpers/dom';
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

  it('opens with an empty address that has the cursor and a placeholder', async () => {
    const box = await mount(UrlDialog, { onClose: () => {} });
    const address = box.querySelector<HTMLInputElement>('#url-address')!;
    expect(document.activeElement).toBe(address);
    expect(address.value).toBe('');
    expect(address.placeholder).toBe('https://');
  });

  it('is called Add a link and says Canon keeps the link and shows the live page', async () => {
    const box = await mount(UrlDialog, { onClose: () => {} });
    expect(box.querySelector('h3')!.textContent).toBe('Add a link');
    const copy = box.querySelector('p')!.textContent!;
    expect(copy).toContain('Canon keeps the link and shows the live page.');
    expect(copy).not.toMatch(/no copy|running prototype/i);
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

describe('the address field in the add dialog', () => {
  afterEach(clear);
  const submit = (box: HTMLElement) => fire(box.querySelector('form')!, new Event('submit', { bubbles: true, cancelable: true }));
  const problem = (box: HTMLElement) => box.querySelector('#url-error');

  it('is a text field with a URL keyboard, so a bare host such as example.org is accepted', async () => {
    let closed: string | null = 'unset';
    const box = await mount(UrlDialog, { onClose: (v: string | null) => { closed = v; } });
    const address = box.querySelector<HTMLInputElement>('#url-address')!;
    expect(address.type).toBe('text');
    expect(address.getAttribute('inputmode')).toBe('url');
    await type(address, 'example.org');
    await submit(box);
    expect(closed).toBe('http://example.org/');
    expect(problem(box)).toBeNull();
  });

  it('shows a problem under the field, marks the field invalid, and sends no toast', async () => {
    let closed: string | null = 'unset';
    const box = await mount(UrlDialog, { onClose: (v: string | null) => { closed = v; } });
    const address = box.querySelector<HTMLInputElement>('#url-address')!;
    expect(address.getAttribute('aria-invalid')).toBeNull();
    await type(address, 'not an address');
    await submit(box);
    expect(closed).toBe('unset');
    expect(problem(box)!.textContent).toBe('Enter a web address, like example.com.');
    expect(address.getAttribute('aria-invalid')).toBe('true');
    expect(address.getAttribute('aria-describedby')).toBe('url-error');
    expect(address.nextElementSibling).toBe(problem(box));
    await type(address, 'example.com');
    expect(problem(box)).toBeNull();
    expect(address.getAttribute('aria-invalid')).toBeNull();
  });

  it('says so under the field when the address is Canon itself', async () => {
    const box = await mount(UrlDialog, { onClose: () => {} });
    await type(box.querySelector<HTMLInputElement>('#url-address')!, location.origin + '/canon/app/');
    await submit(box);
    expect(problem(box)!.textContent).toBe("That address is Canon itself. Add the prototype's own address.");
  });

  it('closes on Esc', async () => {
    let closed: string | null = 'unset';
    await mount(UrlDialog, { onClose: (v: string | null) => { closed = v; } });
    await key(window, 'Escape');
    expect(closed).toBeNull();
  });
});

describe('the Add menu', () => {
  it('says A link for an address and keeps Link a folder on your machine apart', async () => {
    const { AddMenu } = await import('../../src/app/parts');
    const box = await mount(AddMenu, { onWay: () => {}, label: 'Add', primary: true });
    await fire(box.querySelector('button.add')!, new MouseEvent('click', { bubbles: true }));
    const items = Array.from(box.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent);
    expect(items).toContain('A link…');
    expect(items.some((t) => t!.startsWith('Link a folder on your machine…'))).toBe(true);
    expect(items.join(' ')).not.toMatch(/running URL/i);
  });
});
