import { describe, expect, it } from 'vitest';
import { stripCommonRoot, pickEntry, titleFromHtml, nameFromFile, mimeFor, isZipName } from '../../src/app/lib/ingest';

describe('stripCommonRoot', () => {
  it('drops the one folder a zip wraps everything in', () => {
    expect(stripCommonRoot(['site/index.html', 'site/css/a.css'])).toEqual(['index.html', 'css/a.css']);
  });
  it('leaves paths alone when they do not share a root', () => {
    expect(stripCommonRoot(['index.html', 'css/a.css'])).toEqual(['index.html', 'css/a.css']);
  });
  it('ignores macOS metadata when deciding the root', () => {
    expect(stripCommonRoot(['__MACOSX/site/._index.html', 'site/index.html'])).toEqual(['__MACOSX/site/._index.html', 'index.html']);
  });
});

describe('pickEntry', () => {
  it('prefers a top-level index.html', () => {
    expect(pickEntry(['about.html', 'index.html', 'deep/index.html'])).toBe('index.html');
  });
  it('takes the shallowest index.html when there is none at the top', () => {
    expect(pickEntry(['a/b/index.html', 'dist/index.html'])).toBe('dist/index.html');
  });
  it('falls back to the first HTML file, alphabetically', () => {
    expect(pickEntry(['zeta.html', 'Homepage.dc.html', 'style.css'])).toBe('Homepage.dc.html');
  });
  it('returns null when there is no HTML at all', () => {
    expect(pickEntry(['a.css', 'b.png'])).toBeNull();
  });
  it('never picks macOS metadata', () => {
    expect(pickEntry(['__MACOSX/._index.html', 'home.html'])).toBe('home.html');
  });
});

describe('naming', () => {
  it('reads the page title', () => {
    expect(titleFromHtml('<html><head><title> Checkout &amp; pay </title></head></html>')).toBe('Checkout & pay');
  });
  it('returns null for a missing or empty title', () => {
    expect(titleFromHtml('<p>hi</p>')).toBeNull();
    expect(titleFromHtml('<title>  </title>')).toBeNull();
  });
  it('turns a file name into a readable name', () => {
    expect(nameFromFile('checkout-v3_final.zip')).toBe('checkout v3 final');
    expect(nameFromFile('Homepage.dc.html')).toBe('Homepage.dc');
  });
});

describe('file types', () => {
  it('knows the types a prototype is made of', () => {
    expect(mimeFor('a/b.HTML')).toBe('text/html');
    expect(mimeFor('x.mjs')).toBe('text/javascript');
    expect(mimeFor('x.svg')).toBe('image/svg+xml');
    expect(mimeFor('x.unknown')).toBe('application/octet-stream');
  });
  it('spots a zip by name', () => {
    expect(isZipName('proto.ZIP')).toBe(true);
    expect(isZipName('proto.html')).toBe(false);
  });
});
