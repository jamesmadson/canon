/**
 * The small drawn pages the homepage uses as prototypes. They are pictures,
 * made of HTML: no text in them is read out, so the cards that hold them carry
 * the names. Each has one accent colour.
 */
export type ThumbKey = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'c1' | 'o1' | 'o2' | 'o3' | 'o4';

const nav = '<div class="nv"><i></i><u></u><u></u><u></u></div>';
const tx = (w?: number) => `<div class="tx"${w ? ` style="width:${w}%"` : ''}></div>`;
const bt = (label: string, cls = '', style = '') =>
  `<div class="bt${cls ? ` ${cls}` : ''}"${style ? ` style="${style}"` : ''}>${label}</div>`;
const tier = (price: string, label: string, opts: { hot?: boolean; outline?: boolean; lines?: number[] } = {}) =>
  `<div class="tier${opts.hot ? ' hot' : ''}"><div class="pr">${price}</div>${(opts.lines ?? [0]).map((w) => tx(w || undefined)).join('')}${bt(label, opts.outline ? 'o' : '')}</div>`;
const row = '<div class="rowi"><i></i><u></u><u></u></div>';

const T: Record<ThumbKey, [string, string]> = {
  p1: [
    'blue',
    `${nav}<div class="hd">Pricing</div><div class="tog"><b>Monthly</b><b class="on">Yearly</b></div><div class="cols">${tier('$96', 'Choose', { outline: true })}${tier('$240', 'Choose', { hot: true })}</div>`,
  ],
  p2: [
    'violet',
    `${nav}<div class="hd">Plans</div><div class="cols">${tier('$0', 'Start', { outline: true })}${tier('$12', 'Start', { hot: true })}${tier('$29', 'Start', { outline: true })}</div>`,
  ],
  p3: [
    'green',
    `${nav}<div class="hd">One plan, everything in it</div><div class="cols">${tier('$15 a month', 'Start free', { hot: true, lines: [80, 60] })}</div>`,
  ],
  p4: ['coral', `${nav}<div class="hd">Compare plans</div>${row}${row}${row}${bt('See all features', '', 'width:50%')}`],
  p5: ['ink', `<div class="hd">Upgrade</div><div class="img"></div>${tx(70)}${bt('Go yearly, save $48')}`],
  c1: [
    'blue',
    `<div class="hd">Checkout</div><div class="inp"></div><div class="cols" style="flex:0 0 10px"><div class="inp" style="flex:1"></div><div class="inp" style="flex:1"></div></div><div class="inp"></div>${bt('Pay $24')}`,
  ],
  o1: ['green', `<div class="steps"><i class="on"></i><i></i><i></i></div><div class="hd">Welcome</div>${tx(80)}<div class="img"></div>${bt('Next', '', 'width:40%;align-self:flex-end')}`],
  o2: ['coral', `<div class="img"></div><div class="hd">Welcome to Shop</div>${tx(70)}${bt('Get started')}`],
  o3: ['violet', `<div class="hd">Invite your team</div><div class="rowi"><i></i><u></u></div><div class="rowi"><i></i><u></u></div><div class="inp"></div>${bt('Send', 'o', 'width:44%')}`],
  o4: ['ink', `${nav}<div class="img"></div><div class="hd" style="text-align:center">No orders yet</div>${bt('Add a sample', '', 'width:60%;align-self:center')}`],
};

export function thumbAccent(key: ThumbKey): string {
  return T[key][0];
}

export function thumbHtml(key: ThumbKey): string {
  return T[key][1];
}
