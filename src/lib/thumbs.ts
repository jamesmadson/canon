/**
 * The small drawn pages the homepage uses as prototypes. They are pictures,
 * made of HTML and sized in container units, so one drawing reads at 64px and
 * at 600px. Nothing in them is read out: the cards that hold them carry the
 * names. Each has one muted tint from the palette in thumbTints.ts, as its page background.
 */
import type { Tint } from './thumbTints';

/**
 * The hero's eight prototypes, for the invented company Fieldnote, in three
 * projects: Web app (dash, people, settings), Marketing site (land, price) and
 * iPhone app (onb, today, prof). The older w, d and m drawings are still used
 * by the sections lower on the page.
 */
export type HeroThumbKey = 'dash' | 'people' | 'settings' | 'land' | 'price' | 'onb' | 'today' | 'prof';
export type ThumbKey = 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'd1' | 'd2' | 'd3' | 'm1' | HeroThumbKey;

const nav = (...links: string[]) =>
  `<div class="tp-nav"><b>Fieldnote</b>${links.map((l) => `<span>${l}</span>`).join('')}</div>`;
const btn = (label: string, cls = '') => `<div class="tp-btn${cls ? ` ${cls}` : ''}">${label}</div>`;
const field = (label: string) => `<div class="tp-in">${label}</div>`;
const lines = (...rows: string[]) => rows.map((r) => `<div class="tp-t">${r}</div>`).join('');

const person = (name: string, mail: string, role: string) =>
  `<div class="tp-who"><i></i><div><b>${name}</b><span>${mail}</span></div><u>${role}</u></div>`;
const stat = (label: string, value: string) => `<div class="tp-stat"><span>${label}</span><b>${value}</b></div>`;
const bars = (heights: number[], hot: number) =>
  `<div class="tp-bars">${heights.map((h, i) => `<i${i === hot ? ' class="hot"' : ''} style="height:${h}%"></i>`).join('')}</div>`;
const side = `<div class="tp-side"><b>Fieldnote</b><u class="on">Overview</u><u>Notebooks</u><u>People</u><u>Billing</u></div>`;

/* The hero's drawings. Small type, one muted tint per project, a few real words. */
const sbar = (active: string) =>
  `<div class="tq-side"><b>Fieldnote</b>${['Overview', 'Notebooks', 'People', 'Settings'].map((t) => `<u${t === active ? ' class="on"' : ''}>${t}</u>`).join('')}</div>`;
const av = (initials: string) => `<i class="tq-av">${initials}</i>`;
const row = (name: string, role: string, seen: string, initials: string) =>
  `<div class="tq-row">${av(initials)}<b>${name}</b><span>${role}</span><span>${seen}</span></div>`;
const toggle = (label: string, hint: string, on: boolean) =>
  `<div class="tq-opt"><div><b>${label}</b><span>${hint}</span></div><i class="tq-sw${on ? ' on' : ''}"></i></div>`;
const plan = (name: string, price: string, cta: string, feats: string[], pick = false) =>
  `<div class="tq-plan${pick ? ' pick' : ''}"><b>${name}</b><strong>${price}<small>/mo</small></strong><u>${cta}</u>${feats.map((f) => `<em>${f}</em>`).join('')}</div>`;
const tick = (label: string, done: boolean) => `<div class="tq-task${done ? ' done' : ''}"><i></i><span>${label}</span></div>`;
const phone = (inner: string) => `<div class="tq-phone"><div class="tq-island"></div>${inner}</div>`;
const spark = `<svg viewBox="0 0 100 32" preserveAspectRatio="none"><path d="M0 26 L14 21 L28 23 L42 14 L56 17 L70 8 L84 11 L100 3 L100 32 L0 32 Z" class="a"/><path d="M0 26 L14 21 L28 23 L42 14 L56 17 L70 8 L84 11 L100 3" class="l" vector-effect="non-scaling-stroke"/></svg>`;

const T: Record<ThumbKey, [Tint, string]> = {
  // Web app: a dashboard with a sidebar, three figures and a chart.
  dash: [
    'slate',
    `<div class="tq-app">${sbar('Overview')}<div class="tq-main"><div class="tq-top"><div class="tq-h">Overview</div><div class="tq-chip">Last 7 days</div></div><div class="tq-stats"><div class="tq-stat"><span>Notebooks</span><b>128</b><em>+6</em></div><div class="tq-stat"><span>Notes</span><b>2,431</b><em>+212</em></div><div class="tq-stat"><span>People</span><b>36</b><em>+2</em></div></div><div class="tq-chart"><span>Notes written</span>${spark}</div></div></div>`,
  ],
  // Web app: a table of people with a search box and an invite button.
  people: [
    'slate',
    `<div class="tq-app">${sbar('People')}<div class="tq-main"><div class="tq-top"><div class="tq-h">People<small>36</small></div><div class="tq-find">Search people</div><div class="tq-btn">Invite</div></div><div class="tq-table"><div class="tq-th"><span>Name</span><span>Role</span><span>Last active</span></div>${row('Maya Ortiz', 'Admin', 'Today', 'MO')}${row('Sam Chen', 'Editor', 'Today', 'SC')}${row('Lee Park', 'Editor', 'Tuesday', 'LP')}${row('Ana Silva', 'Viewer', '2 Nov', 'AS')}</div></div></div>`,
  ],
  // Web app: settings, with a form and two switches.
  settings: [
    'slate',
    `<div class="tq-app">${sbar('Settings')}<div class="tq-main"><div class="tq-top"><div class="tq-h">Settings</div><div class="tq-btn">Save changes</div></div><div class="tq-tabs2"><u class="on">Profile</u><u>Notifications</u><u>Billing</u></div><div class="tq-form"><div class="tq-lbl">Name</div><div class="tq-lbl">Role</div><div class="tq-in">Maya Ortiz</div><div class="tq-in">Design lead</div></div>${toggle('Weekly digest', 'A summary on Monday', true)}${toggle('Mentions', 'When someone tags you', false)}</div></div>`,
  ],
  // Marketing site: a landing page, with the product below the fold.
  land: [
    'sand',
    `${nav('Product', 'Pricing', 'Docs')}<div class="tq-hero"><div class="tq-h lg">Notes that keep up with your work</div><div class="tq-t">One place for every notebook your team writes.</div><div class="tq-btns">${btn('Start free')}${btn('See how it works', 'o')}</div></div><div class="tq-shot"><div class="tq-shot-side"></div><div class="tq-shot-main"><i></i><i></i><i></i></div></div>`,
  ],
  // Marketing site: the pricing page the hero's browser shows, in small.
  price: [
    'sand',
    `${nav('Product', 'Pricing', 'Docs')}<div class="tq-hero tight"><div class="tq-h">Simple pricing for small teams</div><div class="tq-switch"><u class="on">Monthly</u><u>Yearly</u></div></div><div class="tq-plans">${plan('Free', '$0', 'Start free', ['3 notebooks', 'Search'])}${plan('Team', '$12', 'Start a trial', ['Unlimited notebooks', 'Shared folders'], true)}${plan('Company', '$24', 'Talk to us', ['Single sign-on', 'Audit log'])}</div>`,
  ],
  // iPhone app: welcome screen, one big idea and a button.
  onb: [
    'sage',
    phone(`<div class="tq-art"><i></i><i></i><i></i></div><div class="tq-h">Every project, in one place</div><div class="tq-t">Notes, links and sketches, filed for you.</div><div class="tq-dots"><i class="on"></i><i></i><i></i></div>${btn('Get started')}`),
  ],
  // iPhone app: today's list.
  today: [
    'sage',
    phone(`<div class="tq-cap">Tuesday 12 November</div><div class="tq-h">Today</div><div class="tq-card2"><b>3 of 5 done</b><div class="tq-bar"><i style="width:60%"></i></div></div>${tick('Review the brief', true)}${tick('Send notes to Sam', true)}${tick('Plan the sprint', false)}${tick('Book a room', false)}`),
  ],
  // iPhone app: a profile with an avatar, three figures and a list.
  prof: [
    'sage',
    phone(`<div class="tq-me">${av('MO')}<b>Maya Ortiz</b><span>Design, Fieldnote</span></div><div class="tq-nums"><div><b>128</b><span>Notes</span></div><div><b>12</b><span>Projects</span></div><div><b>36</b><span>Friends</span></div></div><div class="tq-li"><span>Account</span><em></em></div><div class="tq-li"><span>Notifications</span><em></em></div><div class="tq-li"><span>Privacy</span><em></em></div>`),
  ],

  // Welcome, three steps: copy on the left, a picture on the right.
  w1: [
    'sage',
    `${nav('Help', 'Skip')}<div class="tp-split"><div class="tp-col"><div class="tp-steps"><i class="on"></i><i></i><i></i></div><div class="tp-cap">Step 1 of 3</div><div class="tp-h">Welcome to Fieldnote</div>${lines('Keep notes, links and sketches', 'for each project in one place.')}${btn('Continue')}</div><div class="tp-img"><i></i><i></i><i></i></div></div>`,
  ],
  // Welcome, single screen: one centred form.
  w2: [
    'sand',
    `${nav('Help')}<div class="tp-mid"><div class="tp-h">Start your first notebook</div>${lines('Name it and pick a starting point.')}<div class="tp-card">${field('Notebook name')}<div class="tp-chips"><u class="on">Research</u><u>Meetings</u><u>Ideas</u></div>${btn('Create notebook')}</div></div>`,
  ],
  // Invite a teammate: a list of people and a send button.
  w3: [
    'lilac',
    `${nav('Settings')}<div class="tp-body"><div class="tp-h">Invite your team</div>${lines('They get a link by email.')}<div class="tp-list">${person('Maya Ortiz', 'Design', 'Editor')}${person('Sam Chen', 'Product', 'Viewer')}${person('Lee Park', 'Engineering', 'Editor')}</div><div class="tp-foot">${field('Add a name')}${btn('Send invites')}</div></div>`,
  ],
  // Empty dashboard, with sample data: stats at zero and a ghosted chart.
  w4: [
    'warm',
    `<div class="tp-dash">${side}<div class="tp-main"><div class="tp-top"><div class="tp-h">Overview</div>${btn('Load sample data', 'o')}</div><div class="tp-stats">${stat('Notebooks', '0')}${stat('Notes', '0')}${stat('People', '0')}</div><div class="tp-chart ghost">${bars([34, 52, 40, 66, 58, 78, 70], 5)}<span>No data yet</span></div></div></div>`,
  ],
  // Mobile sign-up: a phone on a grey ground, because it came as a zip of a phone layout.
  w5: [
    'clay',
    `<div class="tp-phone"><div class="tp-pn"><b>Fieldnote</b></div><div class="tp-h">Create your account</div>${field('Email')}${field('Password')}${btn('Continue')}<div class="tp-cap c">Already a member?</div></div>`,
  ],
  // Bottom tab bar: a phone with a list and a bar of four tabs.
  m1: [
    'sage',
    `<div class="tp-phone tp-tabbed"><div class="tp-pn"><b>Fieldnote</b></div><div class="tp-h">Notebooks</div>${lines('Research', 'Meetings', 'Ideas')}<div class="tp-tabs"><i class="on"></i><i></i><i></i><i></i></div></div>`,
  ],
  d1: [
    'slate',
    `<div class="tp-dash">${side}<div class="tp-main"><div class="tp-top"><div class="tp-h">This week</div>${btn('Export', 'o')}</div><div class="tp-stats">${stat('Notebooks', '128')}${stat('Notes', '2,431')}${stat('People', '36')}</div><div class="tp-chart">${bars([30, 46, 40, 62, 55, 80, 72], 5)}</div></div></div>`,
  ],
  d2: [
    'sand',
    `${nav('Overview', 'People')}<div class="tp-body"><div class="tp-top"><div class="tp-h">People</div>${btn('Invite')}</div><div class="tp-list">${person('Maya Ortiz', 'Design', '12 notes')}${person('Sam Chen', 'Product', '9 notes')}${person('Lee Park', 'Engineering', '4 notes')}</div></div>`,
  ],
  d3: [
    'slate',
    `${nav('Overview', 'Reports')}<div class="tp-body"><div class="tp-h">Notes by month</div>${lines('Grouped by notebook.')}<div class="tp-chart wide">${bars([22, 30, 38, 34, 50, 58, 52, 70, 64, 82], 7)}</div></div>`,
  ],
};

export function thumbTint(key: ThumbKey): Tint {
  return T[key][0];
}

export function thumbHtml(key: ThumbKey): string {
  return T[key][1];
}
