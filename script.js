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

// Background: flowing wave lines (canvas)
// Light on the GPU: ~10 thin lines, redrawn each frame, paused when the tab is hidden.
(function () {
  const canvas = document.getElementById('bgWaves');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const DPR = 1; // faint thin lines don't need retina resolution; keeps the canvas cheap

  let w = 0, h = 0, teal = '#3EC9A7', copper = '#C17F45', isLight = false;
  let lastW = 0, lastH = 0;

  function readTheme() {
    const cs = getComputedStyle(root);
    teal = cs.getPropertyValue('--teal').trim() || teal;
    copper = cs.getPropertyValue('--copper').trim() || copper;
    isLight = root.getAttribute('data-theme') === 'light';
  }

  function resize() {
    const nw = window.innerWidth, nh = window.innerHeight;
    // ignore small height changes (mobile address bar) so the canvas isn't reallocated while scrolling
    if (w && nw === lastW && Math.abs(nh - lastH) < 150) return;
    lastW = nw; lastH = nh;
    w = nw; h = nh;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (reduceMotion) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const small = w < 700;
    const lines = small ? 6 : 10;
    const step = small ? 14 : 12;
    const k1 = (Math.PI * 2) / (w * (small ? 1.1 : 0.65));
    const k2 = (Math.PI * 2) / (w * (small ? 2.2 : 1.5));
    const spacing = h * 0.045;
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      const baseY = h * 0.5 + (i - (lines - 1) / 2) * spacing;
      const amp1 = h * (0.024 + i * 0.0028);
      const amp2 = h * 0.014;
      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) {
        const y = baseY + Math.sin(x * k1 + t * 0.0009 + i * 0.55) * amp1 + Math.sin(x * k2 - t * 0.0006 + i) * amp2;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 3 === 0 ? copper : teal;
      ctx.globalAlpha = (isLight ? 0.10 : 0.12) + i * (isLight ? 0.022 : 0.03);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ~30fps is plenty for slow waves and halves the work
  let lastDraw = 0;
  function loop(t) {
    if (t - lastDraw >= 32) { lastDraw = t; draw(t); }
    requestAnimationFrame(loop);
  }

  readTheme();
  resize();
  window.addEventListener('resize', resize);
  new MutationObserver(() => { readTheme(); if (reduceMotion) draw(0); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (!reduceMotion) requestAnimationFrame(loop);
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
//
// The pinned hero is taller than the animation needs: the intro plays during the
// first ~90vh of scrolling, then the finished hero stays pinned for the rest
// (a "hold" zone) so a fast scroll can't fly past it into the About section.
//
// On phones / small tablets / short windows (same query as the CSS) there is no
// intro: the hero is just a normal stacked section.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactMQ = window.matchMedia('(max-width: 820px), (max-height: 540px)');
  const headerEl = document.querySelector('header');
  const heroScroll = document.getElementById('heroScroll');
  const heroSection = document.getElementById('heroSection');
  const introCenter = document.getElementById('introCenter');
  const heroHeading = document.getElementById('heroHeading');
  const revealItems = Array.from(document.querySelectorAll('.reveal-item'));
  const scrollCue = document.getElementById('scrollCue');
  if (!heroScroll || !heroHeading) return;

  function setHeaderHeightVar() {
    if (headerEl) document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  setHeaderHeightVar();

  // CSS fallback (prefers-reduced-motion) shows the final state
  if (reduceMotion) return;

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
  let scrollable = 1;   // scroll distance that drives the intro animation
  function measureScroll() {
    heroTopAbs = heroScroll.getBoundingClientRect().top + window.scrollY;
    const total = heroScroll.offsetHeight - window.innerHeight;       // whole pinned distance
    scrollable = Math.max(Math.min(window.innerHeight * 0.9, total), 0); // animation part; the rest is the hold zone
  }

  function getProgress() {
    if (scrollable <= 0) return 1;
    return Math.min(Math.max((window.scrollY - heroTopAbs) / scrollable, 0), 1);
  }

  const local = (p, s, e) => Math.min(Math.max((p - s) / (e - s), 0), 1);
  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  let mode = null;      // 'full' (scroll-driven intro) or 'compact' (plain stacked hero)
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

    if (scrollCue) scrollCue.style.opacity = String(1 - local(p, 0, 0.08));

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
    if (mode !== 'full') { running = false; return; }
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
    if (running || mode !== 'full') return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // Remove everything the intro wrote inline so the CSS (compact layout) takes over
  function clearInline() {
    introLines.forEach((el) => { el.style.transform = ''; });
    introCenter.style.opacity = '';
    introCenter.style.visibility = '';
    introCenter.style.transform = '';
    heroHeading.style.opacity = '';
    revealItems.forEach((el) => { el.style.opacity = ''; el.style.transform = ''; });
    if (scrollCue) scrollCue.style.opacity = '';
  }

  // Runs on load, resize, rotate and font load: picks the mode and re-measures
  function sync() {
    setHeaderHeightVar();
    if (compactMQ.matches) {
      if (mode !== 'compact') {
        mode = 'compact';
        clearInline();
        lastApplied = -1;
        landed = false;
        window.dispatchEvent(new Event('hero:landed')); // start the name typing effect
      }
      return;
    }
    mode = 'full';
    measureScroll();
    recomputeDelta();
    lastApplied = -1;
    currentP = getProgress();
    applyProgress(currentP);
  }

  let resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(sync);
  }

  sync();
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('load', sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
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
  }, { threshold: 0, rootMargin: '0px 0px -4% 0px' });

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

// Copy email button
(function () {
  const btn = document.getElementById('copyEmail');
  if (!btn) return;
  let timer;
  btn.addEventListener('click', async () => {
    const email = btn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = email;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
    btn.classList.add('copied');
    clearTimeout(timer);
    timer = setTimeout(() => btn.classList.remove('copied'), 1600);
  });
})();

// Custom cursor: copper center dot + 4 teal satellites that orbit it.
// Satellites lag behind elastically, spin faster (and widen) over interactive
// elements, and get a short spin burst on click. Extras: a copper shockwave ring
// on click and a trail of fading stardust while the mouse moves.
//
// Built so it can't take the page down:
//  - only runs for a real mouse/trackpad (hover + fine pointer); a touch switches it off
//  - the canvas pixel count is capped (no giant canvas on 4K / high-DPI screens)
//  - each frame clears only the small area it drew in, not the whole screen
//  - the loop sleeps when the mouse is outside the window
//  - if the device is too slow, or anything throws, it turns itself off for good
//    and the normal cursor comes back (the native cursor is only hidden while
//    html has the .orbit-cursor-on class)
(function () {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!finePointer.matches) return;

  const canvas = document.querySelector('.cursor-orbit-canvas');
  if (!canvas) return;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (err) { ctx = null; }
  if (!ctx) return;

  const root = document.documentElement;
  const hoverSelector = 'a, button, .skill-card, .proj-card, input, textarea, [role="button"]';

  // Tuning (in px at 100% root size; scaled by the site's rem scale)
  const N = 4;            // number of satellites
  const R_NORMAL = 22;    // orbit radius
  const R_HOVER = 40;     // orbit radius over interactive elements
  const SPEED = 2;        // rad/s
  const HOVER_BOOST = 4;  // spin multiplier on hover
  const DOT = 3;          // satellite radius
  const TRAIL = 6;        // trail length (frames)
  const DUST_MIN_SPEED = 120; // px/s before stardust starts shedding
  const DUST_CHANCE = 0.3;    // per satellite, per frame
  const MAX_PARTS = 100;      // safety cap
  const MAX_WAVES = 5;        // safety cap
  const WAVE_MS = 650;        // click shockwave duration
  const MAX_CANVAS_PX = 4200000; // canvas pixel budget (~1080p at 2x)

  let alive = true;   // false once switched off for good
  let rafId = 0;

  // ---- sizing --------------------------------------------------------------
  let cw = 0, ch = 0, needFull = true;
  let unit = 1, tealC = '#3EC9A7', copperC = '#C17F45';
  let tealRGB = [62, 201, 167], copperRGB = [193, 127, 69];
  const parseHex = (v, fb) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (!m) return fb;
    let x = m[1];
    if (x.length === 3) x = x.split('').map((ch2) => ch2 + ch2).join('');
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
  };
  function readTheme() {
    const cs = getComputedStyle(root);
    unit = parseFloat(cs.fontSize) / 16 || 1;
    tealC = cs.getPropertyValue('--cursor-accent').trim() || tealC;
    copperC = cs.getPropertyValue('--copper').trim() || copperC;
    tealRGB = parseHex(tealC, tealRGB);
    copperRGB = parseHex(copperC, copperRGB);
  }
  function resize() {
    cw = window.innerWidth; ch = window.innerHeight;
    const wanted = Math.min(window.devicePixelRatio || 1, 2);
    const budget = Math.sqrt(MAX_CANVAS_PX / Math.max(cw * ch, 1));
    const d = Math.max(1, Math.min(wanted, budget));
    canvas.width = Math.round(cw * d);
    canvas.height = Math.round(ch * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    needFull = true;
    readTheme();
  }

  // ---- state ---------------------------------------------------------------
  let mx = -100, my = -100, pmx = -100, pmy = -100;
  let cx = -100, cy = -100;
  let hover = false, hc = 0, vel = 0, impulse = 0, vis = 0, inside = true, seen = false;
  let radius = R_NORMAL, spin = SPEED, angle = 0;
  const dots = Array.from({ length: N }, () => ({ x: -100, y: -100, h: [] }));
  let parts = [];  // stardust
  let waves = [];  // click shockwaves

  // ---- dirty rectangle: remember what was drawn so only that is cleared ----
  let prevBox = null, box = null;
  function mark(x, y, r) {
    if (!box) { box = { x0: x - r, y0: y - r, x1: x + r, y1: y + r }; return; }
    if (x - r < box.x0) box.x0 = x - r;
    if (y - r < box.y0) box.y0 = y - r;
    if (x + r > box.x1) box.x1 = x + r;
    if (y + r > box.y1) box.y1 = y + r;
  }
  function dot(x, y, r, color, alpha) {
    const rr = Math.max(r, 0.1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    mark(x, y, rr);
  }

  // ---- on / off ------------------------------------------------------------
  function kill() {
    if (!alive) return;
    alive = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    root.classList.remove('orbit-cursor-on'); // native cursor comes back, canvas hides
    canvas.width = 1; canvas.height = 1;      // release the canvas memory
  }
  function wake() {
    if (!alive || rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  // ---- events --------------------------------------------------------------
  document.addEventListener('mousemove', (e) => {
    if (!alive) return;
    mx = e.clientX; my = e.clientY;
    const t = e.target;
    hover = !!(t && t.closest && t.closest(hoverSelector));
    if (!seen) {
      seen = true;
      cx = pmx = mx; cy = pmy = my;
      dots.forEach((d) => { d.x = mx; d.y = my; d.h.length = 0; });
    }
    inside = true;
    wake();
  }, { passive: true });
  document.addEventListener('mousedown', () => {
    if (!alive) return;
    impulse = 9;
    if (seen && waves.length < MAX_WAVES) waves.push({ x: mx, y: my, t: performance.now() });
    wake();
  });
  root.addEventListener('mouseleave', () => { inside = false; wake(); });
  root.addEventListener('mouseenter', () => { inside = true; wake(); });

  // A real touch means this isn't a mouse-only device: give the native cursor back.
  window.addEventListener('touchstart', kill, { once: true, passive: true });
  if (finePointer.addEventListener) {
    finePointer.addEventListener('change', (e) => { if (!e.matches) kill(); });
  }

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (!alive) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { if (alive) { resize(); wake(); } });
  });
  new MutationObserver(() => { if (alive) readTheme(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ---- main loop -----------------------------------------------------------
  let last = performance.now();
  let sampled = 0, slow = 0, strikes = 0; // tiny frame-rate watchdog

  function frame(now) {
    rafId = 0;
    if (!alive) return;
    try {
      const raw = (now - last) / 1000;
      const dt = Math.min(raw, 0.05);
      last = now;

      // Watchdog: ~4s of bad frame rate (<20fps) in a row => switch the effect off.
      // (Long gaps are a hidden tab, not a slow device, so they are ignored.)
      if (raw > 0 && raw < 0.25) {
        sampled++;
        if (raw > 0.05) slow++;
        if (sampled >= 120) {
          strikes = slow > 60 ? strikes + 1 : 0;
          sampled = 0; slow = 0;
          if (strikes >= 2) { kill(); return; }
        }
      }

      vel += (Math.hypot(mx - pmx, my - pmy) / Math.max(dt, 0.001) - vel) * Math.min(1, dt * 10);
      pmx = mx; pmy = my;
      hc += ((hover ? 1 : 0) - hc) * Math.min(1, dt * 10);
      const visTarget = inside && seen ? 1 : 0;
      vis += (visTarget - vis) * Math.min(1, dt * 12);
      impulse *= Math.pow(0.02, dt);
      cx += (mx - cx) * Math.min(1, dt * 22);
      cy += (my - cy) * Math.min(1, dt * 22);

      radius += ((hover ? R_HOVER : R_NORMAL) - radius) * Math.min(1, dt * 8);
      const target = SPEED * (1 + (HOVER_BOOST - 1) * hc) + Math.min(vel / 500, 2) + impulse;
      spin += (target - spin) * Math.min(1, dt * 7);
      angle += spin * dt;

      // clear only what the last frame drew
      if (needFull) { ctx.clearRect(0, 0, cw, ch); needFull = false; }
      else if (prevBox) ctx.clearRect(prevBox.x0 - 2, prevBox.y0 - 2, prevBox.x1 - prevBox.x0 + 4, prevBox.y1 - prevBox.y0 + 4);
      box = null;

      const hidden = vis < 0.004;
      if (!hidden) {
        // satellites blend teal -> copper while hovering something interactive
        const orbC = 'rgb(' + tealRGB.map((v, k) => Math.round(v + (copperRGB[k] - v) * hc)).join(',') + ')';
        const trailLen = Math.round(TRAIL * (1 + hc * 0.8));
        const sz = DOT * unit * (1 + hc * 0.35);

        for (let i = 0; i < N; i++) {
          const d = dots[i];
          const a = angle + i * Math.PI * 2 / N;
          const tx = cx + Math.cos(a) * radius * unit;
          const ty = cy + Math.sin(a) * radius * unit;
          const f = Math.min(1, dt * (7 + i * 1.5)); // each satellite lags a bit differently
          d.x += (tx - d.x) * f; d.y += (ty - d.y) * f;

          d.h.push({ x: d.x, y: d.y });
          while (d.h.length > trailLen) d.h.shift();
          for (let j = 0; j < d.h.length; j++) {
            const q = j / d.h.length;
            dot(d.h[j].x, d.h[j].y, sz * q * 0.8, orbC, q * 0.45 * vis);
          }
          dot(d.x, d.y, sz * 2.2, orbC, 0.12 * vis); // soft halo
          dot(d.x, d.y, sz, orbC, vis);

          // stardust: shed tiny particles while the mouse is moving
          if (vel > DUST_MIN_SPEED && parts.length < MAX_PARTS && Math.random() < DUST_CHANCE) {
            parts.push({
              x: d.x, y: d.y,
              vx: (Math.random() - 0.5) * 40 * unit, vy: (Math.random() - 0.5) * 40 * unit,
              l: 0, m: 0.7 + Math.random() * 0.5, r: 1.6 * unit
            });
          }
        }

        // update + draw stardust
        parts = parts.filter((p) => (p.l += dt) < p.m);
        const drag = Math.pow(0.05, dt);
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= drag; p.vy *= drag;
          const life = 1 - p.l / p.m;
          dot(p.x, p.y, p.r * (0.5 + life * 0.5), orbC, life * vis);
        }

        // click shockwave rings
        waves = waves.filter((w) => now - w.t < WAVE_MS);
        for (let i = 0; i < waves.length; i++) {
          const w = waves[i], k = (now - w.t) / WAVE_MS;
          const lw = (2.2 * (1 - k) + 0.4) * unit;
          const wr = (8 + k * 60) * unit;
          ctx.globalAlpha = (1 - k) * vis;
          ctx.strokeStyle = copperC;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.arc(w.x, w.y, wr, 0, Math.PI * 2);
          ctx.stroke();
          mark(w.x, w.y, wr + lw);
        }

        // copper center dot (exactly at the pointer)
        dot(mx, my, (3.2 + hc * 1.3) * unit * 1.6, copperC, 0.18 * vis); // glow
        dot(mx, my, (3.2 + hc * 1.3) * unit, copperC, vis);
        ctx.globalAlpha = 1;
      } else {
        parts.length = 0;
        waves.length = 0;
      }
      prevBox = box;

      // Mouse is outside the window and everything has faded out: sleep until it comes back
      if (visTarget === 0 && hidden) return;
    } catch (err) {
      kill();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  resize();
  root.classList.add('orbit-cursor-on');
  // the loop starts on the first mouse move (wake)
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