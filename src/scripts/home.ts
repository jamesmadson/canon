/**
 * The homepage's small scripts: copy buttons, the hero demo that loops, the
 * agent demo that plays once and rests on its last frame, and the waitlist form. The page is complete
 * without any of it: the markup is the last frame of each demo.
 */

import { submitWaitlist } from '../lib/waitlist';
import { track } from '../lib/events';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Copy buttons */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    ok ? resolve() : reject(new Error('copy failed'));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  const label = button.textContent ?? 'Copy';
  const name = button.getAttribute('aria-label') ?? label;
  let timer = 0;
  button.addEventListener('click', async () => {
    try {
      await copyText(button.dataset.copy ?? '');
      const where = button.dataset.gaCopy;
      if (where === 'hero' || where === 'agents') track(window, 'copy_setup', { location: where });
      button.textContent = 'Copied';
      button.setAttribute('aria-label', 'Copied');
    } catch {
      button.textContent = 'Press Cmd or Ctrl+C';
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.textContent = label;
      button.setAttribute('aria-label', name);
    }, 1800);
  });
});

/* Demos. One tick is 100ms; a demo runs 140 ticks and stops. */
const TICKS = 140;

function prepare(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-type]').forEach((el) => (el.textContent = ''));
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => (el.textContent = el.dataset.from ?? ''));
  root.querySelectorAll<HTMLElement>('[data-caret]').forEach((el) => (el.style.opacity = '1'));
}

function frame(root: HTMLElement, t: number) {
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => el.classList.toggle('on', t >= Number(el.dataset.step)));
  root.querySelectorAll<HTMLElement>('[data-tidy]').forEach((el) => el.classList.toggle('tidy', t >= Number(el.dataset.tidy)));
  root.querySelectorAll<HTMLElement>('[data-type]').forEach((el) => {
    const text = el.dataset.type ?? '';
    const start = Number(el.dataset.typeStart ?? 0);
    el.textContent = text.slice(0, Math.min(text.length, Math.max(0, (t - start) * 2)));
  });
  root.querySelectorAll<HTMLElement>('[data-caret]').forEach((el) => {
    const end = Number(el.dataset.caret);
    el.style.opacity = t >= end ? '0' : Math.floor(t / 4) % 2 ? '1' : '0.25';
  });
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    el.textContent = (t >= Number(el.dataset.at) ? el.dataset.to : el.dataset.from) ?? '';
  });
}

function play(root: HTMLElement) {
  let t = 0;
  const timer = setInterval(() => {
    t += 1;
    frame(root, Math.min(t, TICKS));
    if (t >= TICKS) clearInterval(timer);
  }, 100);
}

/**
 * The hero demo is a cycle: play, hold the finished frame, fade the changed
 * parts out, reset while they are invisible, play again. It pauses when the
 * hero is off screen or the tab is hidden.
 */
function loop(root: HTMLElement) {
  const PLAY = 70; // the last step lands at 56
  const HOLD = 40; // 4 seconds on the finished frame
  const FADE = 4; // 400ms, matching the fade in the styles
  let t = 0;
  let visible = true;
  let timer = 0;
  const tick = () => {
    t += 1;
    if (t <= PLAY) frame(root, t);
    else if (t === PLAY + HOLD) root.classList.add('fading');
    else if (t === PLAY + HOLD + FADE) {
      prepare(root);
      frame(root, 0);
    } else if (t === PLAY + HOLD + FADE + 1) {
      root.classList.remove('fading');
      t = 0;
    }
  };
  const sync = () => {
    const go = visible && !document.hidden;
    if (go && !timer) timer = window.setInterval(tick, 100);
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
    }).observe(root);
  }
  sync();
}

if (!still) {
  document.querySelectorAll<HTMLElement>('[data-demo]').forEach((root) => {
    prepare(root);
    frame(root, 0);
    if (root.dataset.demo === 'hero') {
      loop(root);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      play(root);
      return;
    }
    // The agent demo waits until it is on screen, then plays once.
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        watcher.disconnect();
        play(root);
      },
      { threshold: 0.4 },
    );
    watcher.observe(root);
  });
}

/* The waitlist form posts to the address it was given, and says what happened. */
const form = document.querySelector<HTMLFormElement>('[data-waitlist]');
if (form) {
  const note = form.querySelector<HTMLElement>('[data-waitlist-note]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    track(window, 'waitlist_submit');
    const result = await submitWaitlist(form.action, new FormData(form));
    if (note) note.textContent = result.message;
    if (result.ok) track(window, 'waitlist_done');
    // A failure leaves what the person typed and lets them send again.
    if (!result.ok) {
      if (submit) submit.disabled = false;
    }
  });
}
