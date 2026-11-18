import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { extractPage, frameBlockedBy, readPage } from '../src/mcp/page.js';

describe('extractPage', () => {
  it('reads the title and h1 and h2 text, ignoring scripts and other headings', () => {
    const html =
      '<title>Pricing &amp; plans</title><h1>Choose <em>a</em> plan</h1><script>var h="<h1>no</h1>"</script><h3>skip</h3><h2>FAQ</h2>';
    expect(extractPage(html)).toEqual({ title: 'Pricing & plans', headings: ['Choose a plan', 'FAQ'] });
  });
  it('gives nothing for an empty page', () => {
    expect(extractPage('')).toEqual({ title: '', headings: [] });
  });
  it('ignores comments and style, decodes entities, collapses whitespace', () => {
    const html =
      '<!-- <h1>hidden</h1> --><style>h1{}</style><h1>  A &lt;b&gt;\n  &quot;q&quot; &#39;s&#39;&nbsp;x </h1>';
    expect(extractPage(html).headings).toEqual(['A <b> "q" \'s\' x']);
  });
  it('does not decode twice', () => {
    expect(extractPage('<title>&amp;lt;</title>').title).toBe('&lt;');
  });
  it('caps headings at 20 of 200 characters and the title at 300', () => {
    const many = Array.from({ length: 30 }, () => `<h2>${'x'.repeat(250)}</h2>`).join('');
    const out = extractPage(`<title>${'t'.repeat(400)}</title>${many}`);
    expect(out.headings).toHaveLength(20);
    expect(out.headings[0]).toHaveLength(200);
    expect(out.title).toHaveLength(300);
  });
  it('skips empty headings', () => {
    expect(extractPage('<h1> </h1><h2>Real</h2>').headings).toEqual(['Real']);
  });
});

describe('readPage', () => {
  let server;
  let sockets;

  async function serve(handler) {
    sockets = new Set();
    server = createServer(handler);
    server.on('connection', (s) => {
      sockets.add(s);
      s.on('close', () => sockets.delete(s));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}/`;
  }

  afterEach(async () => {
    if (!server) return;
    for (const s of sockets) s.destroy();
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  });

  it('reads a normal page and sends only an accept header', async () => {
    let seen;
    const url = await serve((req, res) => {
      seen = req.headers;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<title>Home</title><h1>Welcome</h1>');
    });
    expect(await readPage(url)).toEqual({ title: 'Home', headings: ['Welcome'] });
    expect(seen.accept).toBe('text/html');
    expect(seen.cookie).toBeUndefined();
    expect(seen.authorization).toBeUndefined();
  });

  it('follows redirects', async () => {
    const url = await serve((req, res) => {
      if (req.url === '/') {
        res.writeHead(302, { location: '/next' });
        res.end();
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<title>Next</title>');
      }
    });
    expect((await readPage(url)).title).toBe('Next');
  });

  it('gives null when the page never answers', async () => {
    const url = await serve(() => {});
    const start = Date.now();
    expect(await readPage(url, { timeoutMs: 200 })).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('gives null when the body never ends', async () => {
    const url = await serve((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('<title>Slow</title>');
    });
    const start = Date.now();
    expect(await readPage(url, { timeoutMs: 200 })).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('gives null for a PNG', async () => {
    const url = await serve((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(Buffer.from([137, 80, 78, 71]));
    });
    expect(await readPage(url)).toBeNull();
  });

  it('gives null for a 404', async () => {
    const url = await serve((req, res) => {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<title>Gone</title>');
    });
    expect(await readPage(url)).toBeNull();
  });

  it('reads the title when the body is larger than maxBytes', async () => {
    const url = await serve((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<title>Big</title>${'a'.repeat(200000)}`);
    });
    expect(await readPage(url, { maxBytes: 1000 })).toEqual({ title: 'Big', headings: [] });
  });

  it('records that a page refuses to be framed, from the response headers', async () => {
    const refusing = [
      { 'x-frame-options': 'DENY' },
      { 'x-frame-options': 'sameorigin' },
      { 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" },
      { 'content-security-policy': "frame-ancestors 'self' https://app.example.com" },
    ];
    for (const headers of refusing) {
      const url = await serve((req, res) => {
        res.writeHead(200, { 'content-type': 'text/html', ...headers });
        res.end('<title>Members</title>');
      });
      expect(await readPage(url), JSON.stringify(headers)).toEqual({ title: 'Members', headings: [], frameBlocked: true });
      await new Promise((resolve) => server.close(resolve));
      server = undefined;
    }
  });

  it('records nothing for a page that allows framing', async () => {
    const url = await serve((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': 'frame-ancestors *', 'x-frame-options': 'ALLOWALL' });
      res.end('<title>Open</title>');
    });
    expect(await readPage(url)).toEqual({ title: 'Open', headings: [] });
  });

  it('reads the headers with GET, since some hosts refuse HEAD', async () => {
    let method;
    const url = await serve((req, res) => {
      method = req.method;
      res.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'DENY' });
      res.end('<title>x</title>');
    });
    await readPage(url);
    expect(method).toBe('GET');
  });

  it('gives null when fetch throws', async () => {
    const fetchImpl = async () => {
      throw new Error('boom');
    };
    expect(await readPage('http://x.invalid/', { fetchImpl })).toBeNull();
  });
});

describe('extractPage on hostile HTML', () => {
  const cases = {
    'many unclosed titles': '<title>'.repeat(73000),
    'many h1 tags that never end': '<h1 '.repeat(131000),
    'a heading full of unclosed tags': `<h1>${'<a '.repeat(170000)}</h1>`,
    'many unclosed headings': '<h1>a'.repeat(100000),
  };
  for (const [name, html] of Object.entries(cases)) {
    it(`reads ${name} in well under a second`, () => {
      const started = Date.now();
      extractPage(html);
      expect(Date.now() - started).toBeLessThan(500);
    });
  }
  it('keeps headings in page order across h1 and h2', () => {
    expect(extractPage('<h2>One</h2><H1 class="x">Two</H1><h2>Three</h2>').headings).toEqual(['One', 'Two', 'Three']);
  });
});

describe('frameBlockedBy', () => {
  const h = (o) => new Headers(o);
  it('reads X-Frame-Options', () => {
    expect(frameBlockedBy(h({ 'x-frame-options': 'DENY' }))).toBe(true);
    expect(frameBlockedBy(h({ 'x-frame-options': ' SameOrigin ' }))).toBe(true);
    expect(frameBlockedBy(h({ 'x-frame-options': 'ALLOW-FROM https://a.example' }))).toBe(false);
  });
  it('reads frame-ancestors, and lets a wildcard or a scheme wildcard through', () => {
    expect(frameBlockedBy(h({ 'content-security-policy': "frame-ancestors 'none'" }))).toBe(true);
    expect(frameBlockedBy(h({ 'content-security-policy': 'frame-ancestors *' }))).toBe(false);
    expect(frameBlockedBy(h({ 'content-security-policy': 'frame-ancestors https:' }))).toBe(false);
    expect(frameBlockedBy(h({ 'content-security-policy': "script-src 'self'" }))).toBe(false);
    expect(frameBlockedBy(h({}))).toBe(false);
  });
  it('lets a localhost origin through, since that is where Canon runs', () => {
    expect(frameBlockedBy(h({ 'content-security-policy': 'frame-ancestors http://localhost:*' }))).toBe(false);
  });
});
