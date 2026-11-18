/**
 * The section pill: shows after 200px of scroll on the homepage, marks the
 * section in view, and steps away while the footer's links are on screen.
 * Without script it is simply there, and its links still work.
 */

const pill = document.querySelector<HTMLElement>('[data-pill]');

if (pill) {
  const links = [...pill.querySelectorAll<HTMLAnchorElement>('a[data-section]')];
  const home = pill.hasAttribute('data-home');

  // Let the segment glide only after its first position is set.
  requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.add('ready')));

  /* Away: the footer's links keep clear of the pill. */
  const footerLinks = document.querySelector('.foot .links');
  if (footerLinks && typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver((entries) => {
      pill.classList.toggle('is-away', entries.some((e) => e.isIntersecting));
    }).observe(footerLinks);
  }

  if (home) {
    /* On: after the first 200px of scroll. */
    const onScroll = () => pill.classList.toggle('is-on', window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* Which section is in view: the one that holds the line a little above the middle. */
    const sections = links
      .map((a) => ({ a, el: document.getElementById(a.dataset.section ?? '') }))
      .filter((s): s is { a: HTMLAnchorElement; el: HTMLElement } => !!s.el);
    // The open band belongs to Search, which it follows.
    const extra = document.getElementById('open');
    const search = sections.find((s) => s.a.dataset.section === 'find');
    const owner = (el: HTMLElement) => (el === extra && search ? search : sections.find((s) => s.el === el));

    let shown = -2;
    const mark = (index: number) => {
      if (index === shown) return;
      shown = index;
      if (index >= 0) pill.style.setProperty('--i', String(index));
      pill.toggleAttribute('data-none', index < 0);
      links.forEach((a, i) => (i === index ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    };
    const pick = () => {
      const line = window.innerHeight * 0.45;
      const all = [...sections.map((s) => s.el), ...(extra ? [extra] : [])];
      const hit = all.find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      });
      if (hit) {
        const s = owner(hit);
        if (s) mark(links.indexOf(s.a));
      } else if (all[0].getBoundingClientRect().top > line) {
        mark(-1);
      }
    };
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(pick, { rootMargin: '-45% 0px -54% 0px' });
      sections.forEach((s) => io.observe(s.el));
      if (extra) io.observe(extra);
    }
    pick();
  }
}
