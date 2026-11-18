/**
 * The alternate hero. The cards are laid out in their final grid places; this
 * script gives each one a loose position as a transform (custom properties the
 * styles read). The cycle: loose cards hold, the prompt types its request, the
 * reply appears, the cards glide into the grid, hold, everything fades, resets
 * while invisible, and fades back in loose. Only transform and opacity change.
 * It pauses when the stage is off screen or the tab is hidden.
 * `?state=scattered` or `?state=filed` freezes the hero in one state.
 */

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

const TICK = 50; // ms
const TYPE_AT = 30; // 1.5 seconds of loose cards, then the prompt types
const TYPE_TICKS = 32; // about 1.6 seconds
const REPLY_AT = TYPE_AT + TYPE_TICKS + 2;
const FILED_AT = REPLY_AT + 8; // the reply is read, then the cards glide
const GLIDE = 18; // the last card lands and its name fades in
const HOLD_FILED = 90; // 4.5 seconds once everything has landed
const FADE = 7; // a little over the 300ms fade

function init(stage: HTMLElement) {
  const cards = [...stage.querySelectorAll<HTMLElement>('[data-card]')];
  const box = document.querySelector<HTMLElement>('[data-prompt]');
  const chars = box ? [...box.querySelectorAll<HTMLElement>('.pc')] : [];
  const caret = box?.querySelector<HTMLElement>('.pcaret') ?? null;
  const reply = box?.querySelector<HTMLElement>('.preply') ?? null;
  const line = box?.querySelector<HTMLElement>('.ptext') ?? null;
  const forced = new URLSearchParams(location.search).get('state');
  const parts = box ? [stage, box] : [stage];

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
      const spot = (phone ? PHONE : WIDE)[i];
      const thumb = card.querySelector<HTMLElement>('.thumb');
      if (!spot || !thumb || card.offsetParent === null) return;
      const [fx, fy, rot, scale] = spot;
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
      const goalX = Math.min(Math.max(fx * width, halfW + margin), width - halfW - margin);
      // Below 1100px the text spans the width, so nothing drifts above the stage.
      // Beside the text, no card may rise above the grey panel: the text column
      // is shorter or taller as the hero's lines change, and the stage moves with it.
      const goalY = wide ? Math.max(fy, panelTop + halfH + 24) : Math.max(fy, halfH + margin);
      card.style.setProperty('--tx', `${(goalX - (x + thumb.offsetWidth / 2)).toFixed(1)}px`);
      card.style.setProperty('--ty', `${(goalY - (y + thumb.offsetHeight / 2)).toFixed(1)}px`);
      card.style.setProperty('--rot', `${rot}deg`);
      card.style.setProperty('--sc', String(scale));
      card.style.setProperty('--oy', `${thumb.offsetHeight / 2}px`);
    });
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
    stage.classList.toggle('is-filed', forced === 'filed');
    type(forced === 'filed' ? chars.length : 0);
    reply?.classList.toggle('on', forced === 'filed');
  });
  requestAnimationFrame(() => parts.forEach((p) => p.classList.add('ready')));
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => snap(place)).observe(stage);
    // The hero text opening or closing its panel resizes the backdrop; the cards follow it smoothly.
    const backdrop = document.querySelector<HTMLElement>('.hpanel');
    if (backdrop) new ResizeObserver(() => place()).observe(backdrop);
  }
  if (forced === 'filed' || forced === 'scattered') return;

  let t = 0;
  let timer = 0;
  let visible = true;
  const tick = () => {
    t += 1;
    const outAt = FILED_AT + GLIDE + HOLD_FILED;
    if (t >= TYPE_AT && t <= TYPE_AT + TYPE_TICKS) type(Math.ceil(((t - TYPE_AT) / TYPE_TICKS) * chars.length));
    else if (t === REPLY_AT) reply?.classList.add('on');
    else if (t === FILED_AT) stage.classList.add('is-filed');
    else if (t === outAt) mark('out', true);
    else if (t === outAt + FADE) {
      snap(() => {
        stage.classList.remove('is-filed');
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
