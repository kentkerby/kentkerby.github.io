// Project spotlight — a peeking carousel. The current project sits in the
// viewport with a sliver of the next/previous one visible at the edge, and
// the track slides smoothly between them (looping in both directions).
(function () {
  const projects = [
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

  // Slide order includes a clone of the last project up front and a clone
  // of the first project at the end — the classic infinite-carousel trick.
  // That lets "next" from the last project and "prev" from the first keep
  // sliding smoothly instead of snapping backwards.
  const order = [projects[projects.length - 1], ...projects, projects[0]];
  order.forEach((p) => {
    const slide = document.createElement('div');
    slide.className = 'spotlight-slide';
    slide.innerHTML = slideMarkup(p);
    els.track.appendChild(slide);
  });

  let position = 1; // index into `order` / track children — 1 is the first real project
  let animating = false;

  function updateCounter() {
    const realIndex = position - 1;
    els.counter.textContent = pad(realIndex + 1) + ' / ' + pad(projects.length);
  }

  function step() {
    const first = els.track.children[0];
    const gap = parseFloat(getComputedStyle(first).marginRight) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  function apply(pos, animate) {
    if (!animate) els.track.classList.add('no-anim');
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

  function go(dir) {
    if (animating || projects.length < 2) return;
    animating = true;
    position += dir;
    apply(position, true);
  }

  els.track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    // Landed on a clone at either end — jump silently to the matching
    // real slide so the loop feels continuous.
    if (position === order.length - 1) { position = 1; apply(position, false); }
    else if (position === 0) { position = order.length - 2; apply(position, false); }
    updateCounter();
    animating = false;
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