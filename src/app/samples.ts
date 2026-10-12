/**
 * A sample board, so the first run has something to touch. Fernwell is the
 * invented project the v2 preview already uses; nothing here is real.
 */

const page = (title: string, body: string, extra = '') => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#f4f2ec;color:#1d1c19;min-height:100vh}
.top{display:flex;justify-content:space-between;align-items:center;padding:20px 22px;font-size:14px;color:#6d6a62}
h1{font-size:30px;font-weight:300;letter-spacing:-.02em;padding:0 22px}
.card{background:#fff;margin:14px 16px;border-radius:18px;padding:18px}
.muted{color:#6d6a62;font-size:14px}
button{font:inherit;border:0;border-radius:999px;padding:14px 20px;background:#1d1c19;color:#f4f2ec;width:100%}
${extra}
</style></head><body>${body}</body></html>`;

export const SAMPLES: { name: string; w: number; h: number; html: string }[] = [
  {
    name: 'Today ring',
    w: 390,
    h: 844,
    html: page(
      'Today ring',
      `<div class="top"><span>Fernwell</span><span>Mon 12</span></div>
<h1>Today</h1>
<div class="card" style="display:grid;place-items:center;padding:36px 18px">
<svg width="210" height="210" viewBox="0 0 210 210"><circle cx="105" cy="105" r="88" fill="none" stroke="#e7e3d9" stroke-width="18"/>
<circle cx="105" cy="105" r="88" fill="none" stroke="#3f6b4f" stroke-width="18" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="111" transform="rotate(-90 105 105)"/>
<text x="105" y="102" text-anchor="middle" font-size="40" font-weight="300" fill="#1d1c19">48</text>
<text x="105" y="128" text-anchor="middle" font-size="13" fill="#6d6a62">of 60 minutes</text></svg></div>
<div class="card"><div class="muted">Nearest green space</div><div style="font-size:18px;margin-top:6px">Alder Park · 6 min walk</div></div>
<div style="padding:8px 16px"><button>Start a walk</button></div>`
    ),
  },
  {
    name: 'Streak',
    w: 390,
    h: 844,
    html: page(
      'Streak',
      `<div class="top"><span>Fernwell</span><span>Streak</span></div>
<h1>11 days outside</h1>
<div class="card"><div class="grid">${Array.from({ length: 28 }, (_, i) => `<i class="${i % 9 === 4 ? '' : i < 22 ? 'on' : ''}"></i>`).join('')}</div></div>
<div class="card"><div class="muted">Longest streak</div><div style="font-size:18px;margin-top:6px">19 days, in June</div></div>`,
      `.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.grid i{aspect-ratio:1;border-radius:8px;background:#e7e3d9}.grid i.on{background:#3f6b4f}`
    ),
  },
  {
    name: 'Held lane, option B',
    w: 390,
    h: 844,
    html: page(
      'Held lane, option B',
      `<div class="top"><span>Book a lane</span><span>Pool 2</span></div>
<h1>Pick a lane</h1>
<div class="card lanes">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="lane ${n === 3 ? 'held' : n === 5 ? 'booked' : ''}">Lane ${n}<span>${n === 3 ? 'Held for you · 4:52' : n === 5 ? 'Booked' : 'Free'}</span></div>`).join('')}</div>
<div style="padding:8px 16px"><button>Confirm lane 3</button></div>`,
      `.lanes{display:flex;flex-direction:column;gap:8px}.lane{display:flex;justify-content:space-between;padding:14px;border-radius:12px;background:#f4f2ec}.lane span{color:#6d6a62;font-size:14px}.lane.held{outline:2px dashed #3f6b4f;background:#fff}.lane.booked{opacity:.45}`
    ),
  },
  {
    name: 'Fernwell landing',
    w: 1280,
    h: 800,
    html: page(
      'Fernwell landing',
      `<div class="top" style="padding:28px 56px"><b style="color:#1d1c19">Fernwell</b><span>Download</span></div>
<section style="padding:96px 56px;display:grid;grid-template-columns:1.2fr 1fr;gap:56px;align-items:center">
<div><h1 style="font-size:72px;padding:0;line-height:1">A daily dose of the outdoors, measured.</h1>
<p class="muted" style="font-size:20px;margin-top:24px;max-width:34ch">A target ring, a streak, and a quiet map of the green space near you.</p>
<div style="margin-top:32px;width:220px"><button>Get the app</button></div></div>
<div class="card" style="height:420px;display:grid;place-items:center;font-size:96px;font-weight:200;color:#3f6b4f">48/60</div></section>`
    ),
  },
];

/** A multi-page sample: a small site with real links and one orphaned page. */
const sitePage = (title: string, current: string, body: string) => page(
  title,
  `<nav class="nav"><a href="index.html"><b>Fernwell</b></a><span>${[
    ['about.html', 'About'],
    ['pricing.html', 'Pricing'],
    ['download.html', 'Download'],
  ].map(([href, label]) => `<a href="${href}"${href === current ? ' class="on"' : ''}>${label}</a>`).join('')}</span></nav>${body}`,
  `.nav{display:flex;justify-content:space-between;align-items:center;padding:24px 48px}.nav span{display:flex;gap:28px}.nav a{color:#6d6a62;text-decoration:none}.nav a.on,.nav b{color:#1d1c19}
section{padding:72px 48px}h1{font-size:60px;padding:0;line-height:1.05;max-width:16ch}.lede{font-size:19px;color:#6d6a62;margin-top:20px;max-width:40ch}
.tiers{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:40px}.tiers .card{margin:0;padding:28px}.cta{display:inline-block;margin-top:28px;padding:14px 22px;border-radius:999px;background:#1d1c19;color:#f4f2ec;text-decoration:none}`
);

export const SAMPLE_SITE: { name: string; files: Record<string, string> } = {
  name: 'Fernwell site',
  files: {
    'index.html': sitePage('Fernwell site', 'index.html', `<section><h1>A daily dose of the outdoors, measured.</h1><p class="lede">A target ring, a streak, and a quiet map of the green space near you.</p><a class="cta" href="download.html">Get the app</a></section>`),
    'about.html': sitePage('About', 'about.html', `<section><h1>Why we built a ring for time outside.</h1><p class="lede">Twenty minutes in a park changes a day. We wanted a way to count it that did not feel like a workout.</p><a class="cta" href="index.html">Back home</a></section>`),
    'pricing.html': sitePage('Pricing', 'pricing.html', `<section><h1>Free, with a plus.</h1><div class="tiers"><div class="card"><b>Free</b><p class="muted">Ring, streak, map.</p></div><div class="card"><b>Plus · $3/mo</b><p class="muted">Family rings and trail notes.</p><a class="cta" href="checkout.html">Choose Plus</a></div></div></section>`),
    'download.html': sitePage('Download', 'download.html', `<section><h1>On your phone in a minute.</h1><p class="lede">iPhone and Android. No account needed to start.</p></section>`),
    'checkout.html': sitePage('Checkout', 'pricing.html', `<section><h1>Fernwell Plus</h1><p class="lede">$3 a month, cancel any time.</p><a class="cta" href="index.html">Pay and start</a></section>`),
    'old-home.html': sitePage('Old home', '', `<section><h1>Get outside more.</h1><p class="lede">The first homepage, kept for comparison. Nothing links here any more.</p></section>`),
  },
};
