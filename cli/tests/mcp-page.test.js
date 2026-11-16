import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { extractPage, readPage } from '../src/mcp/page.js';

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

  it('gives null when fetch throws', async () => {
    const fetchImpl = async () => {
      throw new Error('boom');
    };
    expect(await readPage('http://x.invalid/', { fetchImpl })).toBeNull();
  });
});
