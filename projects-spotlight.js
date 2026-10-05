// Project spotlight — a peeking carousel. The current project sits in the
// viewport with a sliver of the next one visible at the edge, and the track
// slides smoothly between them. It does NOT use the infinite-loop clone trick:
// from the first project, "prev" slides the track through the middle projects
// all the way to the last one, and from the last project, "next" slides back
// through the middle projects to the first.
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
          '<div class="mock-shot"><img src="assets/img/previews/Voting-preview.png" alt="LSPU Voting System login screen and vote flow" loading="lazy"></div>' +
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

  // One slide per project, in order (no clones).
  projects.forEach((p) => {
    const slide = document.createElement('div');
    slide.className = 'spotlight-slide';
    slide.innerHTML = slideMarkup(p);
    els.track.appendChild(slide);
  });

  // "Coming soon" teaser: sits after the last project so the end of the
  // carousel doesn't look cut off. It is NOT a real project, so it isn't
  // counted in 03 / 03 and the arrows never navigate to it.
  const teaser = document.createElement('div');
  teaser.className = 'spotlight-slide is-teaser';
  teaser.setAttribute('aria-hidden', 'true');
  teaser.innerHTML =
    '<div class="spotlight-code"><div class="mockwin"><div class="mock-app">' +
      '<div class="mock-titlebar">' +
        '<span class="mock-dot r"></span><span class="mock-dot y"></span><span class="mock-dot g"></span>' +
        '<span class="mock-name">next-project</span>' +
      '</div>' +
      '<div class="mock-screen mock-soon"><p class="mock-line muted">coming soon<span class="mock-cursor"></span></p></div>' +
    '</div></div></div>' +
    '<div class="spotlight-info"></div>';
  els.track.appendChild(teaser);

  let position = 0; // index of the current project (0 = first)
  let animating = false;
  let settleTimer;

  const BASE_MS = 550;  // duration for moving one slide
  const EXTRA_MS = 260; // extra time per additional slide passed through

  function updateCounter() {
    els.counter.textContent = pad(position + 1) + ' / ' + pad(projects.length);
  }

  function step() {
    const first = els.track.children[0];
    const gap = parseFloat(getComputedStyle(first).marginRight) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  function apply(pos, animate, ms) {
    if (!animate) els.track.classList.add('no-anim');
    els.track.style.transitionDuration = animate && ms ? ms + 'ms' : '';
    els.track.style.transform = 'translateX(' + (-pos * step()) + 'px)';
    if (!animate) {
      void els.track.offsetWidth; // force reflow so the jump is instant
      els.track.classList.remove('no-anim');
    }
  }

  apply(position, false);
  updateCounter();

  function press(btn) {
    btn.classList.remove('pressed');
    void btn.offsetWidth;
    btn.classList.add('pressed');
  }

  function settle() {
    clearTimeout(settleTimer);
    updateCounter();
    animating = false;
  }

  function go(dir) {
    if (animating || projects.length < 2) return;
    // Past either end, travel the whole way across to the other end,
    // sliding through every project in between.
    let target = position + dir;
    if (target < 0) target = projects.length - 1;
    else if (target > projects.length - 1) target = 0;

    const steps = Math.abs(target - position);
    const ms = BASE_MS + (steps - 1) * EXTRA_MS;
    animating = true;
    position = target;
    apply(position, true, ms);
    settleTimer = setTimeout(settle, ms + 80); // safety net if transitionend never fires
  }

  els.track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform' || !animating) return;
    settle();
  });

  els.prev.addEventListener('click', () => { press(els.prev); go(-1); });
  els.next.addEventListener('click', () => { press(els.next); go(1); });
  [els.prev, els.next].forEach((btn) => {
    btn.addEventListener('animationend', (e) => {
      if (e.animationName === 'navPress') btn.classList.remove('pressed');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const section = document.getElementById('projects');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    if (e.key === 'ArrowLeft') { press(els.prev); go(-1); }
    else { press(els.next); go(1); }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => apply(position, false), 120);
  });
})();