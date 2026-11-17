/**
 * The small drawn pages the homepage uses as prototypes. They are pictures,
 * made of HTML and sized in container units, so one drawing reads at 64px and
 * at 600px. Nothing in them is read out: the cards that hold them carry the
 * names. Near monochrome warm greys, and at most one muted tint each.
 */
export type ThumbKey = 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'd1' | 'd2' | 'd3';

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

const T: Record<ThumbKey, [string, string]> = {
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
    'slate',
    `${nav('Settings')}<div class="tp-body"><div class="tp-h">Invite your team</div>${lines('They get a link by email.')}<div class="tp-list">${person('Maya Ortiz', 'Design', 'Editor')}${person('Sam Chen', 'Product', 'Viewer')}${person('Lee Park', 'Engineering', 'Editor')}</div><div class="tp-foot">${field('Add a name')}${btn('Send invites')}</div></div>`,
  ],
  // Empty dashboard, with sample data: stats at zero and a ghosted chart.
  w4: [
    'stone',
    `<div class="tp-dash">${side}<div class="tp-main"><div class="tp-top"><div class="tp-h">Overview</div>${btn('Load sample data', 'o')}</div><div class="tp-stats">${stat('Notebooks', '0')}${stat('Notes', '0')}${stat('People', '0')}</div><div class="tp-chart ghost">${bars([34, 52, 40, 66, 58, 78, 70], 5)}<span>No data yet</span></div></div></div>`,
  ],
  // Mobile sign-up: a phone on a grey ground, because it came as a zip of a phone layout.
  w5: [
    'clay',
    `<div class="tp-phone"><div class="tp-pn"><b>Fieldnote</b></div><div class="tp-h">Create your account</div>${field('Email')}${field('Password')}${btn('Continue')}<div class="tp-cap c">Already a member?</div></div>`,
  ],
  d1: [
    'slate',
    `<div class="tp-dash">${side}<div class="tp-main"><div class="tp-top"><div class="tp-h">This week</div>${btn('Export', 'o')}</div><div class="tp-stats">${stat('Notebooks', '128')}${stat('Notes', '2,431')}${stat('People', '36')}</div><div class="tp-chart">${bars([30, 46, 40, 62, 55, 80, 72], 5)}</div></div></div>`,
  ],
  d2: [
    'stone',
    `${nav('Overview', 'People')}<div class="tp-body"><div class="tp-top"><div class="tp-h">People</div>${btn('Invite')}</div><div class="tp-list">${person('Maya Ortiz', 'Design', '12 notes')}${person('Sam Chen', 'Product', '9 notes')}${person('Lee Park', 'Engineering', '4 notes')}</div></div>`,
  ],
  d3: [
    'sage',
    `${nav('Overview', 'Reports')}<div class="tp-body"><div class="tp-h">Notes by month</div>${lines('Grouped by notebook.')}<div class="tp-chart wide">${bars([22, 30, 38, 34, 50, 58, 52, 70, 64, 82], 7)}</div></div>`,
  ],
};

export function thumbTint(key: ThumbKey): string {
  return T[key][0];
}

export function thumbHtml(key: ThumbKey): string {
  return T[key][1];
}
