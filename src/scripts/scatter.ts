/**
 * The alternate hero's cards. They are laid out in their final grid places;
 * this script gives each one a loose position as a transform (set as custom
 * properties the styles read), then cycles: loose, glide into the grid, hold,
 * fade out, reset while invisible, fade back in loose. Only transform and
 * opacity change. It pauses when the stage is off screen or the tab is hidden.
 * `?state=scattered` or `?state=filed` freezes the stage in one state.
 */

type Spot = [x: number, y: number, rot: number, scale: number];

/**
 * Where each card's centre goes while loose: x as a fraction of the stage's
 * width, y in pixels from its top (negative y drifts up beside the text), then
 * a turn in degrees and a scale. Indexed in the order the cards appear.
 */
const WIDE: Spot[] = [
  [0.07, 175, -6, 1.2],
  [0.17, 335, 5, 1.1],
  [0.285, 150, -3, 1.3],
  [0.43, 360, 7, 1.15],
  [0.57, 130, -5, 1.25],
  [0.77, 50, 4, 1.3],
  [0.88, 310, -4, 1.3],
  [0.91, -140, 7, 1.15],
  [0.68, 480, 3, 1.2],
];
/** Phone: six cards show, three are hidden (null). */
const PHONE: (Spot | null)[] = [
  [0.27, 110, -6, 1.06],
  [0.73, 215, 5, 1.0],
  null,
  null,
  [0.3, 345, 4, 1.1],
  [0.7, 440, -5, 1.0],
  null,
  [0.28, 545, -4, 1.04],
  [0.74, 610, 6, 1.0],
];

const TICK = 50; // ms
const HOLD_LOOSE = 50; // 2.5 seconds
const GLIDE = 18; // the last card lands and its name fades in
const HOLD_FILED = 90; // 4.5 seconds once everything has landed
const FADE = 7; // a little over the 300ms fade

function init(stage: HTMLElement) {
  const cards = [...stage.querySelectorAll<HTMLElement>('[data-card]')];
  const forced = new URLSearchParams(location.search).get('state');

  const place = () => {
    const phone = matchMedia('(max-width: 960px)').matches;
    const wide = matchMedia('(min-width: 1100px)').matches;
    const width = stage.clientWidth;
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
      const goalY = wide ? fy : Math.max(fy, halfH + margin);
      card.style.setProperty('--tx', `${(goalX - (x + thumb.offsetWidth / 2)).toFixed(1)}px`);
      card.style.setProperty('--ty', `${(goalY - (y + thumb.offsetHeight / 2)).toFixed(1)}px`);
      card.style.setProperty('--rot', `${rot}deg`);
      card.style.setProperty('--sc', String(scale));
      card.style.setProperty('--oy', `${thumb.offsetHeight / 2}px`);
    });
  };

  /** Runs a change with transitions off, so it lands in one frame. */
  const snap = (change: () => void) => {
    stage.classList.add('snap');
    change();
    void stage.offsetWidth;
    stage.classList.remove('snap');
  };

  stage.classList.add('live');
  snap(() => {
    place();
    stage.classList.toggle('is-filed', forced === 'filed');
  });
  requestAnimationFrame(() => stage.classList.add('ready'));
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => snap(place)).observe(stage);
  }
  if (forced === 'filed' || forced === 'scattered') return;

  let t = 0;
  let timer = 0;
  let visible = true;
  const tick = () => {
    t += 1;
    const filedAt = HOLD_LOOSE;
    const outAt = filedAt + GLIDE + HOLD_FILED;
    if (t === filedAt) stage.classList.add('is-filed');
    else if (t === outAt) stage.classList.add('out');
    else if (t === outAt + FADE) snap(() => stage.classList.remove('is-filed'));
    else if (t === outAt + FADE + 1) {
      stage.classList.remove('out');
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
