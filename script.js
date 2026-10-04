// Loading screen
// Shows on first load AND every time you come back to this tab after leaving it.
(function () {
  const loaderScreen = document.getElementById('loaderScreen');
  const loaderBarFill = document.getElementById('loaderBarFill');
  const loaderStatus = document.getElementById('loaderStatus');

  const params = new URLSearchParams(window.location.search);
  const skipFirst = params.get('fromdemo') === '1';

  let busy = !skipFirst;     // true while the loader is on screen
  let wasHidden = false;

  // Don't let the page scroll behind the loader while it's showing
  const stop = (e) => { if (busy) e.preventDefault(); };
  loaderScreen.addEventListener('wheel', stop, { passive: false });
  loaderScreen.addEventListener('touchmove', stop, { passive: false });

  // ---- Return-to-tab replay ----
  const REPLAY_MS = 1200;

  function replayLoader() {
    if (busy) return;
    busy = true;

    loaderBarFill.style.transition = 'none';
    loaderBarFill.style.width = '0%';
    loaderStatus.textContent = 'loading...';
    void loaderBarFill.offsetWidth;          // restart the bar from 0
    loaderBarFill.style.transition = '';
    loaderScreen.classList.remove('hidden'); // fade the loader back in

    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(p + (90 / (REPLAY_MS / 150)) * (0.7 + Math.random() * 0.6), 90);
      loaderBarFill.style.width = p + '%';
    }, 150);

    setTimeout(() => {
      clearInterval(timer);
      loaderBarFill.style.width = '100%';
      loaderStatus.textContent = 'ready';
      setTimeout(() => {
        loaderScreen.classList.add('hidden');
        busy = false;
      }, 350);
    }, REPLAY_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true;
    } else if (wasHidden) {
      wasHidden = false;
      replayLoader();
    }
  });

  // Back/forward cache restore counts as "coming back" too
  window.addEventListener('pageshow', (e) => { if (e.persisted) replayLoader(); });

  // ---- First load ----
  // Skip loading screen when arriving via ?fromdemo=1
  if (skipFirst) {
    document.body.classList.remove('loading');
    loaderScreen.classList.add('hidden');
    params.delete('fromdemo');
    const cleanSearch = params.toString();
    const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
    return;
  }

  const MIN_DISPLAY_MS = 1500;
  const startTime = Date.now();
  let progress = 0;

  const progressTimer = setInterval(() => {
    progress += (90 / (MIN_DISPLAY_MS / 150)) * (0.7 + Math.random() * 0.6);
    if (progress > 90) progress = 90; // hold near the end until we're ready to reveal
    loaderBarFill.style.width = progress + '%';
  }, 150);

  function finishLoading() {
    clearInterval(progressTimer);
    loaderBarFill.style.width = '100%';
    loaderStatus.textContent = 'ready';
    setTimeout(() => {
      loaderScreen.classList.add('hidden');
      document.body.classList.remove('loading');
      busy = false;
    }, 350);
  }

  function readyWhenPageLoaded() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(MIN_DISPLAY_MS - elapsed, 0);
    setTimeout(finishLoading, remaining);
  }

  if (document.readyState === 'complete') {
    readyWhenPageLoaded();
  } else {
    window.addEventListener('load', readyWhenPageLoaded);
  }
})();

// Back to top: only scrolls to the top when the button is clicked
(function () {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault(); // no "#top" jump / no URL hash change
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// Name heading: typing effect
// The heading starts fully typed. It only starts its type/erase loop once the
// intro has glided into place (the hero script fires "hero:landed"), so the
// intro text always lands on identical, fully-visible text.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nameEls = document.querySelectorAll('#heroHeading h1.name');
  if (!nameEls.length || reduceMotion) return;

  const lines = ['Kent Kerby', 'Mahipos'];
  const TYPE_SPEED = 130;
  const ERASE_SPEED = 70;
  const HOLD_AFTER_TYPE = 2000;
  const HOLD_AFTER_ERASE = 400;

  nameEls.forEach((el) => {
    let html = '';
    lines.forEach((line, li) => {
      html += '<span class="ln">';
      for (const ch of line) {
        html += `<span class="tc">${ch === ' ' ? '&nbsp;' : ch}</span>`;
      }
      html += '</span>';
      if (li < lines.length - 1) html += '<br>';
    });
    el.innerHTML = html;

    const chars = Array.from(el.querySelectorAll('.tc'));
    let i = chars.length;
    let typingIn = false;
    let timer = null;

    function showAll() {
      chars.forEach((c) => { c.classList.remove('tc-hide'); c.classList.remove('tc-active'); });
      i = chars.length;
      typingIn = false;
    }

    function tick() {
      if (typingIn) {
        if (i < chars.length) {
          chars.forEach((c) => c.classList.remove('tc-active'));
          chars[i].classList.remove('tc-hide');
          chars[i].classList.add('tc-active');
          i++;
          timer = setTimeout(tick, TYPE_SPEED);
        } else {
          chars.forEach((c) => c.classList.remove('tc-active'));
          typingIn = false;
          timer = setTimeout(tick, HOLD_AFTER_TYPE);
        }
      } else {
        if (i > 0) {
          i--;
          chars[i].classList.add('tc-hide');
          chars[i].classList.remove('tc-active');
          timer = setTimeout(tick, ERASE_SPEED);
        } else {
          typingIn = true;
          timer = setTimeout(tick, HOLD_AFTER_ERASE);
        }
      }
    }

    window.addEventListener('hero:landed', () => {
      clearTimeout(timer);
      showAll();
      timer = setTimeout(tick, HOLD_AFTER_TYPE);
    });
    window.addEventListener('hero:left', () => {
      clearTimeout(timer);
      showAll();
    });
  });
})();

// Hero intro transition
// The big centered name glides line-by-line and lands exactly on top of the
// real heading (same size, same spot), then the two swap invisibly. Scroll only
// drives a target value; the animation catches up with a frame-rate-independent
// ease, so it stays smooth with a mouse wheel, trackpad, or fast flick.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width:820px)').matches;
  const headerEl = document.querySelector('header');
  const heroScroll = document.getElementById('heroScroll');
  const heroSection = document.getElementById('heroSection');
  const introCenter = document.getElementById('introCenter');
  const heroHeading = document.getElementById('heroHeading');
  const revealItems = Array.from(document.querySelectorAll('.reveal-item'));
  if (!heroScroll || !heroHeading) return;

  function setHeaderHeightVar() {
    if (headerEl) document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  setHeaderHeightVar();

  // CSS fallback (prefers-reduced-motion / max-width:820px) shows the final state
  if (reduceMotion || isMobile) {
    if (!reduceMotion) window.dispatchEvent(new Event('hero:landed'));
    return;
  }

  // Each intro line is paired with the matching line of the real heading
  const introLines = Array.from(introCenter.querySelectorAll('.ln'));
  const heroLines = Array.from(heroHeading.querySelectorAll('.ln'));
  const deltas = introLines.map(() => ({ dx: 0, dy: 0 }));

  function recomputeDelta() {
    const prev = introLines.map((el) => el.style.transform);
    introLines.forEach((el) => { el.style.transform = 'none'; });
    introCenter.style.transform = 'none';
    const headerH = headerEl ? headerEl.offsetHeight : 0;
    const heroTop = heroSection.getBoundingClientRect().top;
    introLines.forEach((el, i) => {
      const target = heroLines[i];
      if (!target) return;
      const ir = el.getBoundingClientRect();
      const hr = target.getBoundingClientRect();
      deltas[i].dx = hr.left - ir.left;
      // measure relative to the hero section so it is correct at any scroll position
      deltas[i].dy = (hr.top - heroTop) + headerH - ir.top;
    });
    introLines.forEach((el, i) => { el.style.transform = prev[i]; });
  }

  // Measured once (and on resize) so scrolling never forces a layout read
  let heroTopAbs = 0;
  let scrollable = 1;
  function measureScroll() {
    heroTopAbs = heroScroll.getBoundingClientRect().top + window.scrollY;
    scrollable = heroScroll.offsetHeight - window.innerHeight;
  }

  function getProgress() {
    if (scrollable <= 0) return 1;
    return Math.min(Math.max((window.scrollY - heroTopAbs) / scrollable, 0), 1);
  }

  const local = (p, s, e) => Math.min(Math.max((p - s) / (e - s), 0), 1);
  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  let landed = false;

  let lastApplied = -1;
  function applyProgress(p) {
    if (p === lastApplied) return;
    lastApplied = p;
    // 1) Intro lines glide to their final spot, slightly staggered
    introLines.forEach((el, i) => {
      const e = easeInOutCubic(local(p, i * 0.04, 0.58 + i * 0.04));
      el.style.transform = `translate3d(${deltas[i].dx * e}px, ${deltas[i].dy * e}px, 0)`;
    });

    // 2) Swap: the real heading is already underneath, pixel-identical
    heroHeading.style.opacity = String(local(p, 0.64, 0.70));
    const introOpacity = 1 - local(p, 0.68, 0.72);
    introCenter.style.opacity = String(introOpacity);
    introCenter.style.visibility = introOpacity <= 0 ? 'hidden' : 'visible';

    // 3) Rest of the hero cascades in as the name settles
    revealItems.forEach((el) => {
      const d = parseFloat(el.dataset.d || '0');
      const s = 0.58 + d * 0.06;
      const l = easeInOutCubic(local(p, s, s + 0.3));
      el.style.opacity = String(l);
      el.style.transform = `translate3d(0, ${22 * (1 - l)}px, 0)`;
    });

    // Tell the typing effect when to start / stop
    if (!landed && p >= 0.72) { landed = true; window.dispatchEvent(new Event('hero:landed')); }
    else if (landed && p < 0.6) { landed = false; window.dispatchEvent(new Event('hero:left')); }
  }

  // Frame-rate independent smoothing; the loop only runs while catching up
  const CATCH_UP = 7; // higher = snappier, lower = floatier
  let currentP = 0;
  let running = false;
  let last = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const target = getProgress();
    currentP += (target - currentP) * (1 - Math.exp(-dt * CATCH_UP));
    if (Math.abs(target - currentP) < 0.0005) currentP = target;
    applyProgress(currentP);
    if (currentP !== target) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function onResize() {
    setHeaderHeightVar();
    measureScroll();
    recomputeDelta();
    lastApplied = -1;
    currentP = getProgress();
    applyProgress(currentP);
  }

  measureScroll();
  recomputeDelta();
  currentP = getProgress();
  applyProgress(currentP);
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
})();

// Theme toggle
(function () {
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement;

  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();

// Scroll reveal
(function () {
  const revealEls = document.querySelectorAll('.scroll-reveal');
  if (!revealEls.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      } else {
        entry.target.classList.remove('visible'); // re-play next time it scrolls into view
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  revealEls.forEach((el) => observer.observe(el));
})();

// Scrollspy
(function () {
  const sections = Array.from(document.querySelectorAll('#about, #skills, #projects, #contact'));
  const navLinks = document.querySelectorAll('.navlinks a');
  if (!sections.length || !navLinks.length) return;

  const linkMap = {};
  navLinks.forEach((link) => {
    const id = link.getAttribute('href').replace('#', '');
    linkMap[id] = link;
  });

  function setActive(id) {
    navLinks.forEach((l) => l.classList.remove('active'));
    const link = linkMap[id];
    if (link) link.classList.add('active');
  }

  let tops = [];
  let spyLine = 80;
  function measureSections() {
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    spyLine = headerH + 8; // a little past the header edge
    const y = window.scrollY;
    tops = sections.map((sec) => ({ id: sec.id, top: sec.getBoundingClientRect().top + y }));
  }

  function updateActiveSection() {
    const y = window.scrollY;
    let current = null;
    tops.forEach((s) => {
      if (s.top - y - spyLine <= 0) current = s.id; // last section whose top has crossed the line wins
    });

    if (current) setActive(current);
    else navLinks.forEach((l) => l.classList.remove('active'));
  }

  let ticking = false;
  function onSpyScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveSection();
      ticking = false;
    });
  }

  function remeasure() { measureSections(); updateActiveSection(); }
  window.addEventListener('scroll', onSpyScroll, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  remeasure();
})();

// Mobile nav toggle
(function () {
  const navToggle = document.getElementById('navToggle');
  const navlinks = document.getElementById('navlinks');
  navToggle.addEventListener('click', () => navlinks.classList.toggle('open'));
  navlinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navlinks.classList.remove('open')));
})();

// Skills marquee: one scrolling row per category
(function () {
  const skillGroups = [
    { label: 'Languages', skills: ['C#', 'Java', 'Python', 'JavaScript', 'TypeScript'] },
    { label: 'Frontend',  skills: ['HTML', 'CSS', 'React', 'React Native', 'Expo'] },
    { label: 'Backend',   skills: ['Supabase', 'Node.js'] },
    { label: 'Tools',     skills: ['VS Code', 'Git'] }
  ];

  const skillIcons = {
    'C#': 'assets/logos/csharp.png',
    'Java': 'assets/logos/java.png',
    'Python': 'assets/logos/python.png',
    'JavaScript': 'assets/logos/javascript.png',
    'TypeScript': 'assets/logos/typescript.png',
    'HTML': 'assets/logos/html.png',
    'CSS': 'assets/logos/css.png',
    'React': 'assets/logos/react.png',
    'React Native': 'assets/logos/reactnative.png',
    'Expo': 'assets/logos/expo.png',
    'Supabase': 'assets/logos/supabase.png',
    'Node.js': 'assets/logos/nodejs.png',
    'VS Code': 'assets/logos/vscode.png',
    'Git': 'assets/logos/git.png'
  };

  const skillDescriptions = {
    'C#': 'Object-oriented language used for console apps like the ATM system and calculator projects.',
    'Java': 'General-purpose OOP language used for building structured, class-based applications.',
    'Python': 'Versatile language used for scripting, automation, and general programming practice.',
    'JavaScript': 'Scripting language used to add interactivity, like this site\u2019s theme toggle and cursor effects.',
    'TypeScript': 'Typed superset of JavaScript that catches bugs early, used in the LSPU Voting System.',
    'HTML': 'Markup language used to structure the content and layout of web pages.',
    'CSS': 'Stylesheet language used to design, layout, and theme web pages like this portfolio.',
    'React': 'JavaScript library for building component-based user interfaces.',
    'React Native': 'Framework for building mobile apps with React, used for the LSPU Voting System.',
    'Expo': 'Toolkit for building, running, and testing React Native apps, used for the LSPU Voting System.',
    'Supabase': 'Open-source backend with authentication and a Postgres database, used for sign-in and vote storage in the LSPU Voting System.',
    'Node.js': 'JavaScript runtime that powers development tools like npm and Expo.',
    'VS Code': 'Main code editor used for writing, debugging, and running projects.',
    'Git': 'Version control system used to track changes and manage project history.'
  };

  // Skills section: filter pills (All / Languages / Frontend / ...) over one grid of cards
  const marquee = document.querySelector('.skills-marquee');
  if (!marquee) return;

  const allSkills = [];
  skillGroups.forEach((group) => {
    group.skills.forEach((name) => allSkills.push({ name, group: group.label }));
  });

  marquee.innerHTML =
    '<div class="skills-filters" id="skillsFilters"></div>' +
    '<div class="skills-grid" id="skillsGrid"></div>';
  const filters = document.getElementById('skillsFilters');
  const grid = document.getElementById('skillsGrid');

  let currentFilter = 'All';

  function renderFilters() {
    filters.innerHTML = ['All', ...skillGroups.map((g) => g.label)].map((label) =>
      `<button type="button" class="skills-pill${label === currentFilter ? ' active' : ''}" data-filter="${label}" aria-pressed="${label === currentFilter}">${label}</button>`
    ).join('');
  }

  function renderCards() {
    const list = allSkills.filter((s) => currentFilter === 'All' || s.group === currentFilter);
    grid.innerHTML = list.map((s, i) =>
      `<div class="skill-card" data-skill="${s.name}" style="--i:${i}"><img src="${skillIcons[s.name]}" alt="${s.name} logo"><span>${s.name}</span></div>`
    ).join('');
  }

  filters.addEventListener('click', (e) => {
    const pill = e.target.closest('.skills-pill');
    if (!pill || pill.dataset.filter === currentFilter) return;
    currentFilter = pill.dataset.filter;
    hideSkillTooltip();
    renderFilters();
    renderCards();
  });

  renderFilters();
  renderCards();

  // Tooltip: shows a short description above whichever card is hovered/tapped
  const skillTooltip = document.getElementById('skillTooltip');
  function positionSkillTooltip(card) {
    const rect = card.getBoundingClientRect();
    skillTooltip.style.left = (rect.left + rect.width / 2) + 'px';
    skillTooltip.style.top = rect.top + 'px';
  }

  const isTouchDevice = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let activeSkillCard = null;

  function showSkillTooltip(card) {
    const name = card.dataset.skill;
    const desc = skillDescriptions[name];
    if (!desc) return;
    skillTooltip.innerHTML = `<strong>${name}</strong>${desc}`;
    positionSkillTooltip(card);
    skillTooltip.classList.add('visible');
  }
  function hideSkillTooltip() {
    skillTooltip.classList.remove('visible');
    activeSkillCard = null;
  }

  if (isTouchDevice) {
    // First tap opens the tooltip, tapping the same card again closes it.
    marquee.addEventListener('click', (e) => {
      const card = e.target.closest('.skill-card');
      if (!card) return;
      if (activeSkillCard === card) {
        hideSkillTooltip();
      } else {
        showSkillTooltip(card);
        activeSkillCard = card;
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.skill-card')) hideSkillTooltip();
    });
  } else {
    marquee.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.skill-card');
      if (!card) return;
      showSkillTooltip(card);
    });
    marquee.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.skill-card');
      if (!card) return;
      hideSkillTooltip();
    });
  }
})();


// Live Demo links: open via window.open() so the demo tab can self-close
(function () {
  // Delegated on document so it still works for the spotlight's demo
  // links, which are created dynamically after this script runs.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.card-demo-badge, .spotlight-demo-link');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    window.open(link.href, '_blank');
  });
})();

// Contact form: submits to Formspree via fetch
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const statusEl = document.getElementById('cfStatus');
  const submitBtn = document.getElementById('cfSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (form.action.includes('YOUR_FORM_ID')) {
      statusEl.textContent = 'Contact form is not set up yet (missing Formspree ID).';
      statusEl.className = 'form-status err';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        statusEl.textContent = 'Message sent!';
        statusEl.className = 'form-status ok';
        form.reset();
      } else {
        statusEl.textContent = 'Something went wrong. Please try again.';
        statusEl.className = 'form-status err';
      }
    } catch (err) {
      statusEl.textContent = 'Network error. Please try again.';
      statusEl.className = 'form-status err';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
})();

// Custom cursor
// Uses transforms (compositor only) and only runs its loop while the cursor is
// still catching up, so it never forces layout or repaints during scrolling.
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cDot = document.querySelector('.cursor-dot');
  const cRing = document.querySelector('.cursor-ring');
  const cGlow = document.querySelector('.cursor-glow');

  let mx = -100, my = -100;
  let ringX = -100, ringY = -100;
  let glowX = -100, glowY = -100;
  let running = false;

  const place = (el, x, y) => {
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  };

  function tick() {
    ringX += (mx - ringX) * 0.18;
    ringY += (my - ringY) * 0.18;
    glowX += (mx - glowX) * 0.09;
    glowY += (my - glowY) * 0.09;
    place(cRing, ringX, ringY);
    place(cGlow, glowX, glowY);

    const settled = Math.abs(mx - ringX) < 0.2 && Math.abs(my - ringY) < 0.2 &&
                    Math.abs(mx - glowX) < 0.2 && Math.abs(my - glowY) < 0.2;
    if (settled) { running = false; return; }
    requestAnimationFrame(tick);
  }

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    place(cDot, mx, my);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: true });

  const hoverSelector = 'a, button, .skill-card, .proj-card, input, textarea, [role="button"]';
  document.querySelectorAll(hoverSelector).forEach((el) => {
    el.addEventListener('mouseenter', () => cRing.classList.add('hovering'));
    el.addEventListener('mouseleave', () => cRing.classList.remove('hovering'));
  });
})();

// Hero photo tilt
(function () {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reduceMotion) return;

  const photoFrame = document.querySelector('.hero .photo-frame');
  const photoTiltImg = document.querySelector('#photoTilt img');
  if (!photoFrame || !photoTiltImg) return;

  const MAX_TILT = 8; // degrees, kept subtle
  let targetX = 0, targetY = 0;
  let curX = 0, curY = 0;

  // Listen on the whole frame so tilt responds near the edges
  let tiltRunning = false;
  function startTilt() { if (!tiltRunning) { tiltRunning = true; requestAnimationFrame(tiltTick); } }

  photoFrame.addEventListener('mousemove', (e) => {
    startTilt();
    const rect = photoFrame.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    targetY = (px - 0.5) * MAX_TILT * 2;  // left/right cursor -> rotateY
    targetX = -(py - 0.5) * MAX_TILT * 2; // up/down cursor -> rotateX
  });

  photoFrame.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
    startTilt();
  });

  function tiltTick() {
    curX += (targetX - curX) * 0.12;
    curY += (targetY - curY) * 0.12;
    photoTiltImg.style.transform = `rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg)`;
    const settled = Math.abs(targetX - curX) < 0.01 && Math.abs(targetY - curY) < 0.01;
    if (settled) { tiltRunning = false; return; }
    requestAnimationFrame(tiltTick);
  }
})();