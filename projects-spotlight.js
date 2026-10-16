// Project spotlight: a 3D coverflow with a focus effect. The active project
// sits in the middle at full size; the previous/next ones are tilted, dimmed
// and blurred at the sides. Hovering a side card brings it into focus (tap or
// click it to bring it to the centre). It loops, autoplays while the section is
// on screen, and pauses on hover/focus. Arrows, keyboard and swipe all work.
(function () {
  const projects = [
    {
      type: 'Mobile app',
      title: 'LSPU Voting System',
      desc: 'A React Native student council election app with student sign-in, enrollment eligibility checks, human verification, and a live-updating results tally.',
      tags: ['React Native', 'Expo', 'TypeScript', 'Zod'],
      demoUrl: 'LSPU-Voting-System/index.html',
      preview:
        '<div class="mock-app">' +
          '<div class="mock-shot"><img src="assets/img/previews/Voting-preview.png" alt="LSPU Voting System login screen and vote flow" width="872" height="1018" loading="lazy" decoding="async"></div>' +
        '</div>'
    },
    {
      type: 'Console app',
      title: 'Simple ATM System',
      desc: 'A console-based ATM simulation with login, balance inquiry, deposit, and withdrawal, written to practice object-oriented design and input validation.',
      tags: ['C#', 'OOP', '.NET'],
      demoUrl: 'Simple ATM System/ATM.html',
      preview:
        '<div class="mock-app">' +
          '<div class="mock-titlebar">' +
            '<span class="mock-dot r"></span><span class="mock-dot y"></span><span class="mock-dot g"></span>' +
            '<span class="mock-name">atm-system</span>' +
          '</div>' +
          '<div class="mock-screen">' +
            '<p class="mock-line accent">=== Simple ATM System ===</p>' +
            '<p class="mock-line muted">Please enter your PIN to continue.</p>' +
            '<p class="mock-line warn">Demo PIN: 1234  |  Starting balance: PHP 5,000.00</p>' +
          '</div>' +
          '<div class="mock-controls">' +
            '<input type="text" placeholder="Enter 4-digit PIN" readonly tabindex="-1">' +
            '<div class="mock-btn-row"><button class="mock-btn primary" tabindex="-1">Enter</button></div>' +
          '</div>' +
        '</div>'
    },
    {
      type: 'Console app',
      title: 'Simple Calculator',
      desc: 'A C# calculator application designed to perform basic arithmetic operations with simple input validation.',
      tags: ['C#', 'OOP', '.NET'],
      demoUrl: 'Simple Calculator System/Calculator.html',
      preview:
        '<div class="mock-app">' +
          '<div class="mock-titlebar">' +
            '<span class="mock-dot r"></span><span class="mock-dot y"></span><span class="mock-dot g"></span>' +
            '<span class="mock-name">calculator</span>' +
          '</div>' +
          '<div class="mock-screen">' +
            '<p class="mock-line accent">=== Simple Calculator ===</p>' +
            '<p class="mock-line muted">Choose an operation to begin.</p>' +
          '</div>' +
          '<div class="mock-controls">' +
            '<div class="mock-btn-row">' +
              '<button class="mock-btn" tabindex="-1">Add</button>' +
              '<button class="mock-btn" tabindex="-1">Subtract</button>' +
              '<button class="mock-btn" tabindex="-1">Multiply</button>' +
              '<button class="mock-btn" tabindex="-1">Divide</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    }
  ];

  const els = {
    viewport: document.getElementById('spotlightViewport'),
    track: document.getElementById('spotlightTrack'),
    counter: document.getElementById('spotlightCounter'),
    prev: document.getElementById('spotlightPrev'),
    next: document.getElementById('spotlightNext')
  };
  if (!els.track) return;

  const N = projects.length;
  const HALF = Math.floor(N / 2);
  const AUTO_MS = 4800;
  const canHover = window.matchMedia('(hover: hover)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function pad(n) { return String(n).padStart(2, '0'); }

  function slideMarkup(p) {
    return (
      '<div class="spotlight-code"><div class="mockwin">' + p.preview + '</div></div>' +
      '<div class="spotlight-info">' +
        '<div>' +
          '<p class="spotlight-type mono">' + p.type + '</p>' +
          '<h3>' + p.title + '</h3>' +
        '</div>' +
        '<p class="spotlight-desc">' + p.desc + '</p>' +
        '<div class="spotlight-tags">' + p.tags.map((t) => '<span class="tag">' + t + '</span>').join('') + '</div>' +
        '<a href="' + p.demoUrl + '" class="btn btn-outline spotlight-demo-link" target="_blank">Live Demo</a>' +
      '</div>'
    );
  }

  let cur = 0;      // index of the project in focus (centre)
  let hov = null;   // index of the card under the mouse
  let timer = null;
  let paused = false;
  let inView = true;

  const cards = projects.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'spotlight-slide';
    el.innerHTML = slideMarkup(p);
    els.track.appendChild(el);

    el.addEventListener('mouseenter', () => { if (canHover.matches) { hov = i; render(); } });
    el.addEventListener('mouseleave', () => { if (hov === i) { hov = null; render(); } });
    el.addEventListener('click', (e) => {
      if (i === cur) return;           // the centre card only reacts through its Live Demo button
      e.preventDefault();
      cur = i; render(); restart();
    });
    return el;
  });

  // -1 = left of centre, 0 = centre, 1 = right of centre, anything else = hidden
  function rel(i) { return (((i - cur + HALF) % N) + N) % N - HALF; }

  function render(instant) {
    cards.forEach((el, i) => {
      const r = rel(i);
      // A card that jumps from one side to the other would fly across the
      // centre; instead it is moved while invisible and fades in at its new spot.
      const jumped = el._r !== undefined && Math.abs(r - el._r) >= 2;
      if (instant || jumped) el.classList.add('no-anim');
      if (jumped) el.classList.add('is-flip');

      el.classList.toggle('is-active', r === 0);
      el.classList.toggle('is-prev', r === -1);
      el.classList.toggle('is-next', r === 1);
      el.classList.toggle('is-far', Math.abs(r) > 1);
      el.classList.toggle('is-hover', hov === i);
      el.classList.toggle('is-dimmed', hov === cur && i !== cur);
      el.setAttribute('aria-hidden', r === 0 ? 'false' : 'true');
      const demo = el.querySelector('.spotlight-demo-link');
      if (demo) demo.tabIndex = r === 0 ? 0 : -1;

      if (instant || jumped) {
        void el.offsetWidth; // commit the new position before animations come back
        el.classList.remove('no-anim', 'is-flip');
      }
      el._r = r;
    });
    els.counter.textContent = pad(cur + 1) + ' / ' + pad(N);
  }

  // ---- autoplay ----
  function stop() { clearInterval(timer); timer = null; }
  function restart() {
    stop();
    if (N < 2 || paused || !inView || document.hidden || reduceMotion.matches) return;
    timer = setInterval(() => { cur = (cur + 1) % N; render(); }, AUTO_MS);
  }
  function go(dir) {
    if (N < 2) return;
    cur = (cur + dir + N) % N;
    render();
    restart();
  }

  function press(btn) {
    btn.classList.remove('pressed');
    void btn.offsetWidth;
    btn.classList.add('pressed');
  }

  els.prev.addEventListener('click', () => { press(els.prev); go(-1); });
  els.next.addEventListener('click', () => { press(els.next); go(1); });
  [els.prev, els.next].forEach((btn) => {
    btn.addEventListener('animationend', (e) => {
      if (e.animationName === 'navPress') btn.classList.remove('pressed');
    });
  });

  // pause while the mouse is over the carousel / arrows, or while something inside has focus
  const pauseZone = els.viewport.parentElement;
  pauseZone.addEventListener('mouseenter', () => { if (canHover.matches) { paused = true; stop(); } });
  pauseZone.addEventListener('mouseleave', () => { paused = false; restart(); });
  pauseZone.addEventListener('focusin', () => { paused = true; stop(); });
  pauseZone.addEventListener('focusout', () => { paused = false; restart(); });
  document.addEventListener('visibilitychange', restart);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      restart();
    }, { threshold: 0.25 }).observe(els.viewport);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const section = document.getElementById('projects');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    if (!(rect.top < window.innerHeight && rect.bottom > 0)) return;
    if (e.key === 'ArrowLeft') { press(els.prev); go(-1); }
    else { press(els.next); go(1); }
  });

  // Swipe left / right on touch screens
  let touchX = null, touchY = null;
  els.viewport.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchX = t.clientX; touchY = t.clientY;
  }, { passive: true });
  els.viewport.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX, dy = t.clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) { press(els.next); go(1); } else { press(els.prev); go(-1); }
  }, { passive: true });

  render(true);
  restart();
})();