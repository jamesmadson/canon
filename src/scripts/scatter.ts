/**
 * The alternate hero. The cards are laid out in their final grid places; this
 * script gives each one a loose position as a transform (custom properties the
 * styles read). The cycle: loose cards hold, the terminal types its request, the
 * reply lines appear, the cards glide into the grid, hold, everything fades, resets
 * while invisible, and fades back in loose. Only transform and opacity change.
 * It pauses when the stage is off screen or the tab is hidden.
 * `?state=scattered` or `?state=filed` freezes the hero in one state.
 */

import { avoidBox } from '../lib/scatterAvoid';

type Spot = [x: number, y: number, rot: number, scale: number];

/**
 * Where each card's centre goes while loose: x as a fraction of the stage's
 * width, y in pixels from its top (negative y drifts up beside the text and the
 * prompt), then a turn in degrees and a scale. Indexed in the order the cards
 * appear. Four sit around the prompt, above the fold.
 */
const WIDE: Spot[] = [
  [0.08, 140, -6, 0.72],
  [0.2, 400, 5, 0.68],
  [0.31, 200, -3, 0.78],
  [0.45, 480, 7, 0.7],
  [0.69, -70, -5, 0.74],
  [0.71, -380, -6, 0.7],
  [0.905, -65, 4, 0.76],
  [0.9, -385, 5, 0.68],
  [0.8, 260, -4, 0.74],
];
/** Phone: six cards show, three are hidden (null). */
const PHONE: (Spot | null)[] = [
  [0.27, 100, -6, 1.0],
  [0.73, 195, 5, 0.96],
  null,
  [0.3, 310, 4, 1.0],
  [0.7, 400, -5, 0.96],
  null,
  [0.28, 490, -4, 1.0],
  [0.74, 560, 6, 0.96],
  null,
];

/**
 * The "cards" variant (/hero-c/): cards sit around and beyond the content
 * container, some crossing its edges and the viewport's, at a few depths. The
 * fractions here run below 0 and above 1 on purpose; the page clips what
 * crosses the viewport. The last number is the depth: bigger is nearer, so it
 * stacks higher and casts a stronger shadow.
 */
const CARDS_WIDE: Spot[] = [
  [-0.1, 70, -6, 0.8],
  [0.17, 340, 4, 0.92],
  [0.03, 600, -3, 0.68],
  [0.4, 90, 5, 0.6],
  [0.74, -130, -5, 0.8],
  [0.9, -255, 4, 0.66],
  [1.07, -60, 6, 0.94],
  [0.94, 170, -4, 0.86],
  [0.66, 430, 3, 0.74],
];
const CARDS_PHONE: (Spot | null)[] = [
  [0.02, 70, -6, 1.0],
  [1.0, 150, 5, 0.9],
  null,
  [0.06, 300, 4, 0.92],
  [0.98, 400, -5, 1.0],
  null,
  [0.0, 540, -4, 0.96],
  [0.98, 610, 6, 0.9],
  null,
];

/** How far a loose card stays from the prompt box, in pixels. */
const CLEAR = 14;

const TICK = 50; // ms
const TYPE_AT = 30; // 1.5 seconds of loose cards, then the prompt types
const TYPE_TICKS = 32; // about 1.6 seconds
const REPLY_AT = TYPE_AT + TYPE_TICKS + 2;
const FILED_AT = REPLY_AT + 8; // the reply is read, then the cards glide
const GLIDE = 18; // the last card lands and its name fades in
const HOLD_FILED = 90; // 4.5 seconds once everything has landed
const HOLD_LOOSE = 56; // without a prompt, the loose cards are held for 2.8 seconds
const FADE = 7; // a little over the 300ms fade

/**
 * The tabs variant opens on a few readable tabs and a page, then more tabs
 * open until they are slivers, then the prompt types and the tabs file into
 * Canon. How many tabs show at each step of the squeeze, on a laptop and on a
 * phone (which keeps twelve tabs at most). The last step is every tab.
 */
const CROWD_WIDE = [8, 11, 15, 20, 26, 34];
const CROWD_PHONE = [4, 5, 7, 9, 12];
const CROWD_AT = 44; // 2.2 seconds with the first tabs readable
const CROWD_STEP = 4; // 200ms between steps
/** The tabs variant starts its prompt after the squeeze: the crowding steps, then a beat. */
const TABS_LAG = CROWD_AT + CROWD_WIDE.length * CROWD_STEP + 6 - TYPE_AT;

function init(stage: HTMLElement) {
  const cards = [...stage.querySelectorAll<HTMLElement>('[data-card]')];
  const box = document.querySelector<HTMLElement>('[data-prompt]');
  const chars = box ? [...box.querySelectorAll<HTMLElement>('.pc')] : [];
  const caret = box?.querySelector<HTMLElement>('.pcaret') ?? null;
  const reply = box?.querySelector<HTMLElement>('.preply') ?? null;
  const line = box?.querySelector<HTMLElement>('.ptext') ?? null;
  const variant = stage.dataset.variant ?? 'scatter';
  const forced = new URLSearchParams(location.search).get('state');
  const frozen = forced === 'filed' ? 'filed' : forced === 'squeeze' ? 'squeeze' : forced === 'scattered' || forced === 'start' ? 'start' : null;
  const parts = box ? [stage, box] : [stage];
  const tabs = [...stage.querySelectorAll<HTMLElement>('.btab:not(.canon-tab)')];
  const crowd = () => (matchMedia('(max-width: 960px)').matches ? CROWD_PHONE : CROWD_WIDE);

  /** Shows the first n tabs. A tab that has just opened fades in. */
  const openTabs = (n: number) => {
    const fresh: HTMLElement[] = [];
    tabs.forEach((tab, i) => {
      const gone = i >= n;
      if (!gone && tab.classList.contains('gone')) fresh.push(tab);
      tab.classList.toggle('gone', gone);
    });
    if (!fresh.length) return;
    fresh.forEach((tab) => tab.classList.add('pre'));
    void stage.offsetWidth;
    fresh.forEach((tab) => tab.classList.remove('pre'));
  };
  const squeezed = () => crowd()[crowd().length - 1];
  const opening = () => crowd()[0];

  /** Reveals the first n characters and moves the cursor after them. */
  const type = (n: number) => {
    chars.forEach((c, i) => c.classList.toggle('on', i < n));
    if (!caret || !line) return;
    const next = chars[n];
    if (next) next.parentElement!.insertBefore(caret, next);
    else line.appendChild(caret);
  };

  const place = () => {
    const phone = matchMedia('(max-width: 960px)').matches;
    const wide = matchMedia('(min-width: 1100px)').matches;
    const width = stage.clientWidth;
    const panel = document.querySelector<HTMLElement>('.hpanel');
    // Layout offsets, so a glide in flight does not skew them.
    const panelTop = panel ? panel.offsetTop - stage.offsetTop : -Infinity;
    cards.forEach((card, i) => {
      const spots = variant === 'cards' ? (phone ? CARDS_PHONE : CARDS_WIDE) : phone ? PHONE : WIDE;
      const thumb = card.querySelector<HTMLElement>('.thumb');
      if (variant === 'tabs') {
        // The cards start from where their tabs are once every tab is open.
        const was = tabs.map((t) => t.classList.contains('gone'));
        tabs.forEach((t) => t.classList.remove('gone'));
        placeOnTab(card, thumb, i);
        tabs.forEach((t, k) => t.classList.toggle('gone', was[k]));
        return;
      }
      const spot = spots[i];
      if (!spot || !thumb || card.offsetParent === null) return;
      const [fx, fy, rot, wished] = spot;
      let scale = wished;
      // Layout position of the thumbnail's centre, which ignores transforms.
      let x = 0;
      let y = 0;
      for (let el: HTMLElement | null = card; el && el !== stage; el = el.offsetParent as HTMLElement | null) {
        x += el.offsetLeft;
        y += el.offsetTop;
      }
      const halfW = (thumb.offsetWidth * scale) / 2;
      const halfH = (thumb.offsetHeight * scale) / 2;
      const margin = 10;
      const spread = variant === 'cards';
      const goalX = spread ? fx * width : Math.min(Math.max(fx * width, halfW + margin), width - halfW - margin);
      // Below 1100px the text spans the width, so nothing drifts above the stage.
      // Beside the text, no card may rise above the grey panel: the text column
      // is shorter or taller as the hero's lines change, and the stage moves with it.
      let goalY = spread ? fy : wide ? Math.max(fy, panelTop + halfH + 24) : Math.max(fy, halfH + margin);
      // Beside the text, the prompt box sits on the stage, and no card may overlap it.
      if (wide && box) {
        const left = box.offsetLeft - stage.offsetLeft;
        const top = box.offsetTop - stage.offsetTop;
        const kept = avoidBox(
          { x: goalX, y: goalY, halfW: thumb.offsetWidth / 2, halfH: thumb.offsetHeight / 2, scale, rot, wishedY: fy },
          { x0: left - CLEAR, y0: top - CLEAR, x1: left + box.offsetWidth + CLEAR, y1: top + box.offsetHeight + CLEAR },
          panelTop,
        );
        goalY = kept.y;
        scale = kept.scale;
      }
      card.style.setProperty('--tx', `${(goalX - (x + thumb.offsetWidth / 2)).toFixed(1)}px`);
      card.style.setProperty('--ty', `${(goalY - (y + thumb.offsetHeight / 2)).toFixed(1)}px`);
      card.style.setProperty('--rot', `${rot}deg`);
      card.style.setProperty('--sc', String(scale));
      card.style.setProperty('--oy', `${thumb.offsetHeight / 2}px`);
      if (spread) {
        // Nearer cards stack higher and throw a stronger shadow.
        card.parentElement!.style.zIndex = String(Math.round(scale * 10));
        card.style.setProperty('--dep', String(Math.min(1, Math.max(0.35, (scale - 0.5) * 2.2)).toFixed(2)));
      }
    });
  };

  /** The tabs variant: a card starts as the tab it came from, then grows into its place. */
  const placeOnTab = (card: HTMLElement, thumb: HTMLElement | null, i: number) => {
    const tab = stage.querySelector<HTMLElement>(`[data-tab-of="${i}"]`);
    if (!thumb || !tab || card.offsetParent === null || tab.offsetParent === null) return;
    const s = stage.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    let x = 0;
    let y = 0;
    for (let el: HTMLElement | null = card; el && el !== stage; el = el.offsetParent as HTMLElement | null) {
      x += el.offsetLeft;
      y += el.offsetTop;
    }
    const goalX = t.left - s.left + t.width / 2;
    const goalY = t.top - s.top + t.height / 2;
    card.style.setProperty('--tx', `${(goalX - (x + thumb.offsetWidth / 2)).toFixed(1)}px`);
    card.style.setProperty('--ty', `${(goalY - (y + thumb.offsetHeight / 2)).toFixed(1)}px`);
    card.style.setProperty('--rot', '0deg');
    card.style.setProperty('--sc', String(Math.max(0.08, (t.width / thumb.offsetWidth) * 0.9).toFixed(3)));
    card.style.setProperty('--oy', `${thumb.offsetHeight / 2}px`);
  };

  /** Runs a change with transitions off, so it lands in one frame. */
  const snap = (change: () => void) => {
    parts.forEach((p) => p.classList.add('snap'));
    change();
    void stage.offsetWidth;
    parts.forEach((p) => p.classList.remove('snap'));
  };
  const mark = (name: string, on: boolean) => parts.forEach((p) => p.classList.toggle(name, on));

  parts.forEach((p) => p.classList.add('live'));
  snap(() => {
    place();
    stage.classList.toggle('is-filed', frozen === 'filed');
    if (variant === 'tabs') openTabs(frozen === 'start' || !frozen ? opening() : squeezed());
    type(0);
    reply?.classList.toggle('on', frozen === 'filed');
  });
  requestAnimationFrame(() => parts.forEach((p) => p.classList.add('ready')));
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => snap(place)).observe(stage);
    // The hero text opening or closing its panel resizes the backdrop; the cards follow it smoothly.
    const backdrop = document.querySelector<HTMLElement>('.hpanel');
    if (backdrop) new ResizeObserver(() => place()).observe(backdrop);
  }
  if (frozen) return;

  let t = 0;
  let timer = 0;
  let visible = true;
  const tick = () => {
    t += 1;
    const lag = variant === 'tabs' ? TABS_LAG : 0;
    const typeAt = TYPE_AT + lag;
    const replyAt = REPLY_AT + lag;
    const filedAt = box ? FILED_AT + lag : HOLD_LOOSE;
    const outAt = filedAt + GLIDE + HOLD_FILED;
    const steps = crowd();
    if (variant === 'tabs' && t >= CROWD_AT && (t - CROWD_AT) % CROWD_STEP === 0 && (t - CROWD_AT) / CROWD_STEP < steps.length) openTabs(steps[(t - CROWD_AT) / CROWD_STEP]);
    if (box && t >= typeAt && t <= typeAt + TYPE_TICKS) type(Math.ceil(((t - typeAt) / TYPE_TICKS) * chars.length));
    else if (box && t === replyAt) {
      // Sent: the input box empties and its text moves up into the transcript.
      type(0);
      reply?.classList.add('on');
    }
    else if (t === filedAt) stage.classList.add('is-filed');
    else if (t === outAt) mark('out', true);
    else if (t === outAt + FADE) {
      snap(() => {
        stage.classList.remove('is-filed');
        if (variant === 'tabs') openTabs(opening());
        type(0);
        reply?.classList.remove('on');
      });
    } else if (t === outAt + FADE + 1) {
      mark('out', false);
      t = 0;
    }
  };
  const sync = () => {
    const go = visible && !document.hidden;
    if (go && !timer) timer = window.setInterval(tick, TICK);
    if (!go && timer) {
      clearInterval(timer);
      timer = 0;
    }
  };
  document.addEventListener('visibilitychange', sync);
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    }).observe(stage);
  }
  sync();
}

const stage = document.querySelector<HTMLElement>('[data-scatter]');
if (stage && !matchMedia('(prefers-reduced-motion: reduce)').matches) init(stage);
