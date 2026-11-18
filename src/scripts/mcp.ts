/**
 * "Try the MCP": opens and closes the panel under the hero buttons.
 *
 * The height change is played by transform (D-114). The browser lays the page
 * out in its final state at once; everything that sits below the panel is then
 * moved back to where it was with a transform and glides to its real place on
 * the one curve. The panel itself fades, scales and unblurs with CSS.
 * With reduced motion nothing moves and the panel only fades.
 */

const OPEN_MS = 360;
const CLOSE_MS = 200;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Every element after the panel, at each level up to the page, that its height pushes down. */
function movers(from: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let node: HTMLElement | null = from; node && node !== document.body; node = node.parentElement) {
    for (let sib = node.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (sib instanceof HTMLElement && !['SCRIPT', 'STYLE'].includes(sib.tagName)) out.push(sib);
    }
  }
  return out;
}

function glide(items: HTMLElement[], before: DOMRect[], ms: number) {
  items.forEach((el, i) => {
    const was = before[i];
    const now = el.getBoundingClientRect();
    const dy = was.top - now.top;
    const scale = now.height > 0 ? was.height / now.height : 1;
    // A backdrop that spans the hero grows with it; it is played by scale from its top edge.
    const grows = Math.abs(scale - 1) > 0.002;
    if (Math.abs(dy) < 0.5 && !grows) return;
    el.style.transformOrigin = '50% 0';
    const from = grows ? `translateY(${dy}px) scaleY(${scale})` : `translateY(${dy}px)`;
    const run = el.animate([{ transform: from }, { transform: 'none' }], { duration: ms, easing: EASE });
    run.onfinish = run.oncancel = () => el.style.removeProperty('transform-origin');
  });
}

document.querySelectorAll<HTMLElement>('[data-mcp]').forEach((scope) => {
  const button = scope.querySelector<HTMLButtonElement>('[data-mcp-toggle]');
  const box = scope.querySelector<HTMLElement>('.mcp');
  if (!button || !box) return;

  const isOpen = () => box.classList.contains('is-open');

  function set(open: boolean) {
    if (open === isOpen()) return;
    const items = still ? [] : movers(box!);
    // Where everything is on screen now, including anything still gliding.
    const before = items.map((el) => el.getBoundingClientRect());
    items.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    box!.classList.toggle('is-open', open);
    button!.setAttribute('aria-expanded', String(open));
    if (!still) glide(items, before, open ? OPEN_MS : CLOSE_MS);
  }

  button.addEventListener('click', () => set(!isOpen()));

  scope.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    const inside = box.contains(document.activeElement);
    set(false);
    // The panel is about to be hidden, so focus goes back to the button that opened it.
    if (inside) button.focus();
  });
});
