// About section: reading fill.
// Splits the About paragraphs into words so about-me.css can light them
// up one by one when the section scrolls into view. The timeline and the
// kerby.info panel are handled by CSS only. The reading fill loops in sync with
// the timeline (see the loop block at the bottom).
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const paras = document.querySelectorAll('.about-text > p');
  if (!paras.length) return;

  let index = 0;
  paras.forEach((p) => {
    const words = p.textContent.trim().split(/\s+/);
    const frag = document.createDocumentFragment();
    words.forEach((word, k) => {
      const span = document.createElement('span');
      span.className = 'rf-w';
      span.style.setProperty('--i', index++);
      span.textContent = word;
      frag.appendChild(span);
      if (k < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    p.textContent = '';
    p.appendChild(frag);
  });

  // Loop: the timeline (CSS) runs a 10.6s cycle (eduFade). Every time that cycle
  // starts, reset the words just before the paragraphs come back (they are hidden
  // during the last ~0.25s of the cycle) so the reading fill plays again.
  const CYCLE_MS = 10600;
  const RESET_BEFORE_END_MS = 150;
  const box = document.querySelector('.about-text');
  const timeline = box && box.querySelector('.edu-timeline');
  if (!timeline) return;

  let timer = null;
  function scheduleReset() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      box.classList.add('rf-reset');
      void box.offsetWidth;            // force reflow so the animation restarts
      box.classList.remove('rf-reset');
    }, CYCLE_MS - RESET_BEFORE_END_MS);
  }
  const onCycle = (e) => {
    if (e.target === timeline && e.animationName === 'eduFade') scheduleReset();
  };
  timeline.addEventListener('animationstart', onCycle);
  timeline.addEventListener('animationiteration', onCycle);
})();