// Smooth scrolling (mouse wheel / trackpad): the page glides with inertia instead of jumping.
// Touch screens keep their own native scrolling. Other code can call window.smoothScrollTo(y).
(function () {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enabled = fine && !reduce;
  const TAU = 130;            // ms; bigger = longer, silkier glide
  const WHEEL_SPEED = 1;      // 1 = same distance as a normal wheel
  const root = document.documentElement;

  let target = window.scrollY, current = window.scrollY, running = false, last = 0;
  const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);
  const clamp = (v) => Math.max(0, Math.min(maxScroll(), v));
  const setY = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });

  function frame(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    current += (target - current) * (1 - Math.exp(-dt / TAU));
    if (Math.abs(target - current) < 0.4) {
      current = target;
      running = false;
    }
    setY(current);
    if (running) requestAnimationFrame(frame);
  }
  function run() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function sync() { target = current = window.scrollY; running = false; }

  window.smoothScrollTo = function (y) {
    y = Math.max(0, y);
    if (!enabled) { window.scrollTo({ top: y, behavior: 'smooth' }); return; }
    if (!running) sync();
    target = clamp(y);
    run();
  };
  if (!enabled) return;

  window.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;           // pinch-zoom / browser zoom
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;                // sideways swipes stay native
    if (document.body.classList.contains('loading')) return;            // loading screen
    if (e.target.closest && e.target.closest('textarea, select, .modal-overlay, [data-native-scroll]')) return;
    e.preventDefault();
    if (!running) sync();
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    target = clamp(target + e.deltaY * unit * WHEEL_SPEED);
    run();
  }, { passive: false });

  // Scrollbar drag, keyboard, links, tab switches: follow whatever moved the page
  window.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - current) > 3) sync();
  }, { passive: true });
  window.addEventListener('about:toggled', sync);
  window.addEventListener('resize', () => { target = clamp(target); });
})();

// Top bar (Home only): hidden at the very top, drops down when you start scrolling.
// On the About page it stays visible so you can always go back.
(function () {
  const root = document.documentElement;
  const aboutView = document.getElementById('aboutView');
  const SHOW_AFTER = 40; // px scrolled before the bar drops down

  function updateNavBar() {
    const onHome = !aboutView || aboutView.hidden;
    root.classList.toggle('nav-hidden', onHome && window.scrollY < SHOW_AFTER);
  }
  window.addEventListener('scroll', updateNavBar, { passive: true });
  window.addEventListener('about:toggled', updateNavBar);
  window.addEventListener('load', updateNavBar);
  updateNavBar();
})();

// Loading screen
// Shows only on first load / hard refresh (Ctrl+Shift+R). Switching tabs does NOT replay it.
(function () {
  const loaderScreen = document.getElementById('loaderScreen');
  const loaderBarFill = document.getElementById('loaderBarFill');
  const loaderStatus = document.getElementById('loaderStatus');

  const params = new URLSearchParams(window.location.search);
  const skipFirst = params.get('fromdemo') === '1';

  let busy = !skipFirst;     // true while the loader is on screen

  // Don't let the page scroll behind the loader while it's showing
  const stop = (e) => { if (busy) e.preventDefault(); };
  loaderScreen.addEventListener('wheel', stop, { passive: false });
  loaderScreen.addEventListener('touchmove', stop, { passive: false });

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
    window.smoothScrollTo(0);
  });
})();

// Home / About view
// Home is just the intro screen. The hero + About block stays hidden until
// "About" is clicked; clicking "Home" hides it again.
(function () {
  const headerEl = document.querySelector('header');
  const aboutView = document.getElementById('aboutView');

  function setHeaderHeightVar() {
    if (headerEl) document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  setHeaderHeightVar();
  window.addEventListener('resize', setHeaderHeightVar);
  window.addEventListener('load', setHeaderHeightVar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHeaderHeightVar);
  if (!aboutView) return;

  const homeEl = document.getElementById('home');
  const mainView = document.getElementById('mainView');
  let open = false;
  // About is its own "page": when open, Home + What I Use/Projects/Contact are hidden
  function setOpen(v) {
    if (v === open) return;
    open = v;
    aboutView.hidden = !v;
    if (homeEl) homeEl.hidden = v;
    if (mainView) mainView.hidden = v;
    window.dispatchEvent(new Event(v ? 'hero:landed' : 'hero:left')); // name typing effect
    window.dispatchEvent(new Event('about:toggled'));                  // scrollspy re-measure
  }

  function scrollToAbout() {
    const headerH = headerEl ? headerEl.offsetHeight : 0;
    const top = aboutView.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  document.querySelectorAll('a[href="#about"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(true);
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  // Any other link closes About first, then goes to its target
  function jumpTo(selector, smooth) {
    const el = selector === '#home' ? null : document.querySelector(selector);
    const headerH = headerEl ? headerEl.offsetHeight : 0;
    const top = el ? el.getBoundingClientRect().top + window.scrollY - headerH : 0;
    if (smooth) window.smoothScrollTo(Math.max(top, 0));
    else window.scrollTo({ top: Math.max(top, 0), behavior: 'instant' });
  }
  document.querySelectorAll('a[href="#home"], a[href="#skills"], a[href="#projects"], a[href="#contact"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('href');
      if (open) {
        setOpen(false);                       // layout shrinks, so jump instantly
        requestAnimationFrame(() => jumpTo(target, false));
      } else {
        jumpTo(target, true);
      }
    });
  });

  // "Get in Touch" (in About) scrolls down to the contact section at the end of About
  document.querySelectorAll('a[href="#aboutContact"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById('aboutContact');
      if (!el) return;
      const headerH = headerEl ? headerEl.offsetHeight : 0;
      const top = el.getBoundingClientRect().top + window.scrollY - headerH;
      window.smoothScrollTo(Math.max(top, 0));
    });
  });

  // Opened directly with kentkerby.me/#about
  if (window.location.hash === '#about') {
    setOpen(true);
    window.addEventListener('load', () => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
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
  const sections = Array.from(document.querySelectorAll('#home, #aboutView, #about, #skills, #projects, #contact'));
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
    tops = sections
      .filter((sec) => sec.offsetParent !== null) // skip About while it is hidden
      .map((sec) => ({ id: sec.id === 'aboutView' ? 'about' : sec.id, top: sec.getBoundingClientRect().top + y }));
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
  window.addEventListener('about:toggled', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  remeasure();
})();

// Mobile nav toggle
(function () {
  const navToggle = document.getElementById('navToggle');
  const navlinks = document.getElementById('navlinks');
  function setOpen(open) {
    navlinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  navToggle.addEventListener('click', () => setOpen(!navlinks.classList.contains('open')));
  navlinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navlinks.classList.contains('open')) { setOpen(false); navToggle.focus(); }
  });
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
  document.querySelectorAll('.contact-form').forEach(setupContactForm);
})();

function setupContactForm(form) {
  const statusEl = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

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
}

// Copy email button
(function () {
  document.querySelectorAll('.copy-btn').forEach(setupCopyBtn);
  function setupCopyBtn(btn) {
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
  }
})();

// Hero photo: "comet card" effect (3D tilt + lift on hover)
(function () {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reduceMotion) return;

  const photoFrame = document.querySelector('.hero .photo-frame');
  const card = document.getElementById('photoTilt');
  if (!photoFrame || !card) return;

  const MAX_TILT = 14;   // degrees (raise for a stronger tilt)
  const LIFT = 28;       // px the card rises toward you on hover
  const SCALE = 1.04;    // how much the card grows on hover
  let tX = 0, tY = 0, tZ = 0, tS = 1;   // targets
  let cX = 0, cY = 0, cZ = 0, cS = 1;   // current (eased)
  let running = false;

  function start() { if (!running) { running = true; requestAnimationFrame(tick); } }

  // Listen on the outer frame (it doesn't move), so the hit area stays stable while the card tilts
  photoFrame.addEventListener('mouseenter', () => {
    card.classList.add('is-hover');
    tZ = LIFT; tS = SCALE;
    start();
  });

  photoFrame.addEventListener('mousemove', (e) => {
    const rect = photoFrame.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    tY = (px - 0.5) * MAX_TILT * 2;    // left/right -> rotateY
    tX = -(py - 0.5) * MAX_TILT * 2;   // up/down -> rotateX
    start();
  });

  photoFrame.addEventListener('mouseleave', () => {
    card.classList.remove('is-hover');
    tX = 0; tY = 0; tZ = 0; tS = 1;
    start();
  });

  function tick() {
    cX += (tX - cX) * 0.12;
    cY += (tY - cY) * 0.12;
    cZ += (tZ - cZ) * 0.12;
    cS += (tS - cS) * 0.12;
    card.style.transform =
      `rotateX(${cX.toFixed(2)}deg) rotateY(${cY.toFixed(2)}deg) translateZ(${cZ.toFixed(1)}px) scale(${cS.toFixed(3)})`;
    const settled = Math.abs(tX - cX) < 0.01 && Math.abs(tY - cY) < 0.01 &&
                    Math.abs(tZ - cZ) < 0.05 && Math.abs(tS - cS) < 0.0005;
    if (settled) { running = false; return; }
    requestAnimationFrame(tick);
  }
})();


// "Let's work together" heading: letters rise in a wave, tied to scroll position
(function () {
  const titles = Array.from(document.querySelectorAll('.wave-title'));
  if (!titles.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPREAD = 1.3; // how far the wave is spread across the letters (bigger = slower, more visible wave)

  const items = titles.map((title) => {
    const letters = [];
    title.querySelectorAll('.cta-line, .cta-accent').forEach((line, li) => {
      const text = line.textContent;
      line.setAttribute('aria-hidden', 'true');
      line.textContent = '';
      const chars = Array.from(text);
      chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'wch';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        line.appendChild(span);
        letters.push({ el: span, idx: (i / Math.max(chars.length - 1, 1)) + li * 0.15 });
      });
    });
    return { title, letters };
  });

  function render(item) {
    const r = item.title.getBoundingClientRect();
    if (!r.height) return; // hidden (the other page)
    const vh = window.innerHeight;
    // The wave runs while the heading travels from just entering the screen up to ~30% from the top.
    // If the page can't scroll that far, it ends exactly at the bottom of the page (no sudden jump).
    const maxScroll = document.documentElement.scrollHeight - vh;
    const topAtMax = r.top + window.scrollY - maxScroll;
    const end = Math.max(vh * 0.3, topAtMax + 4);
    const start = Math.max(vh * 1.0, end + 300);
    let p = (start - r.top) / (start - end);
    if (reduce) p = 1;
    p = Math.max(0, Math.min(1, p));
    item.letters.forEach((l) => {
      const t = Math.max(0, Math.min(1, p * (1 + SPREAD) - l.idx * SPREAD));
      const e = 1 - Math.pow(1 - t, 3);
      l.el.style.transform = 'translateY(' + ((1 - e) * 105).toFixed(1) + '%)';
      l.el.style.opacity = (0.15 + 0.85 * e).toFixed(2);
    });
  }

  let ticking = false;
  function update() { items.forEach(render); }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  window.addEventListener('about:toggled', update);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  update();
})();

// Home enter animation: when you come back to Home, the social pills drop in from the right
// (sliding left) and the name letters rise from right to left, with a soft blur-to-sharp.
(function () {
  const home = document.getElementById('home');
  if (!home) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  home.querySelectorAll('.social-pill').forEach((pill, i, all) => {
    pill.style.setProperty('--p', all.length - 1 - i);   // rightmost pill goes first
  });
  const lines = home.querySelectorAll('h1.name .ln');
  lines.forEach((line, li) => {
    const chars = Array.from(line.textContent);
    line.setAttribute('aria-hidden', 'true');
    line.textContent = '';
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'hc';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.setProperty('--d', (chars.length - 1 - i) + li * 2); // rightmost letter goes first
      line.appendChild(span);
    });
  });
  const h1 = home.querySelector('h1.name');
  if (h1) h1.setAttribute('aria-label', 'Kent Kerby Mahipos');

  let timer;
  function play() {
    if (reduce) return;
    clearTimeout(timer);
    home.classList.remove('home-enter');
    void home.offsetWidth;                 // restart the animation
    home.classList.add('home-enter');
    timer = setTimeout(() => home.classList.remove('home-enter'), 3200);
  }
  window.addEventListener('hero:left', play);   // fired when About closes and Home shows again

  // First load / hard reload (Ctrl+Shift+R): play it once the loading screen is gone
  function whenLoaded(cb) {
    if (!document.body.classList.contains('loading')) { cb(); return; }
    const mo = new MutationObserver(() => {
      if (!document.body.classList.contains('loading')) { mo.disconnect(); cb(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  whenLoaded(play);
})();

// Home role line ("Aspiring Full Stack Web Developer"): encrypted-text effect.
// Every time the Home button (or the <Kerby/> logo) is clicked, the text shows as gibberish
// and gets revealed letter by letter, left to right.
(function () {
  const el = document.querySelector('#home .role .ln');
  const aboutView = document.getElementById('aboutView');
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const FINAL = el.textContent.trim();
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=<>?/';
  const REVEAL_MS = 35;   // time between each letter being revealed (lower = faster)
  const FLIP_MS = 30;     // how fast the gibberish letters change
  const rand = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];

  el.setAttribute('aria-label', FINAL);
  let raf = 0, startTimer = 0;

  function render(revealed, scrambled) {
    let html = '';
    for (let i = 0; i < FINAL.length; i++) {
      const ch = FINAL[i];
      if (ch === ' ' || i < revealed) html += ch === ' ' ? ' ' : ch;
      else html += '<span class="enc-x">' + scrambled[i] + '</span>';
    }
    el.innerHTML = html;
  }

  function play(delay) {
    cancelAnimationFrame(raf);
    clearTimeout(startTimer);
    const scrambled = Array.from(FINAL, rand);
    render(0, scrambled);                      // gibberish right away, no flash of the real text
    startTimer = setTimeout(() => {
      const t0 = performance.now();
      let lastFlip = 0;
      (function frame(now) {
        const t = now - t0;
        const revealed = Math.min(FINAL.length, Math.floor(t / REVEAL_MS));
        if (t - lastFlip >= FLIP_MS) {
          for (let i = 0; i < scrambled.length; i++) scrambled[i] = rand();
          lastFlip = t;
        }
        if (revealed >= FINAL.length) { el.textContent = FINAL; return; }
        render(revealed, scrambled);
        raf = requestAnimationFrame(frame);
      })(t0);
    }, delay);
  }

  // Capture phase: read whether About was open BEFORE the nav handlers close it
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href="#home"]');
    if (!link) return;
    const comingFromAbout = aboutView && !aboutView.hidden;
    // from About, the role line slides in after 1s (home-enter), so wait for that
    play(comingFromAbout ? 1000 : 0);
  }, true);

  // First load / hard reload: scramble now (hidden under the loader), reveal once it is gone
  function whenLoaded(cb) {
    if (!document.body.classList.contains('loading')) { cb(); return; }
    const mo = new MutationObserver(() => {
      if (!document.body.classList.contains('loading')) { mo.disconnect(); cb(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  whenLoaded(() => play(1000));
})();

// Home name: "text hover" effect.
// The name is an outlined SVG text. Hovering it reveals a teal -> copper gradient outline
// that follows the cursor. The outline also draws itself in when the page loads and
// every time Home is clicked.
(function () {
  const svg = document.getElementById('htName');
  if (!svg) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aboutView = document.getElementById('aboutView');
  const outlines = Array.from(svg.querySelectorAll('.ht-outline'));
  const gradients = [svg.querySelector('#htGrad'), svg.querySelector('#htReveal')];

  // ---- cursor-following reveal (positions are % of the svg box) ----
  let tx = 50, ty = 50, cx = 50, cy = 50, running = false;
  function apply() {
    gradients.forEach((g) => { g.setAttribute('cx', cx.toFixed(2) + '%'); g.setAttribute('cy', cy.toFixed(2) + '%'); });
  }
  function tick() {
    cx += (tx - cx) * 0.28;
    cy += (ty - cy) * 0.28;
    apply();
    if (Math.abs(tx - cx) < 0.05 && Math.abs(ty - cy) < 0.05) { running = false; return; }
    requestAnimationFrame(tick);
  }
  function aim(e) {
    const r = svg.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 100;
    ty = ((e.clientY - r.top) / r.height) * 100;
  }
  svg.addEventListener('pointerenter', (e) => {
    aim(e); cx = tx; cy = ty; apply();        // start right under the cursor
    svg.classList.add('is-hover');
  });
  svg.addEventListener('pointermove', (e) => {
    aim(e);
    if (!running) { running = true; requestAnimationFrame(tick); }
  });
  svg.addEventListener('pointerleave', () => svg.classList.remove('is-hover'));

  // ---- outline draws itself in ----
  function drawIn(delay) {
    if (reduce) return;
    outlines.forEach((t) => {
      if (!t.animate) return;
      t.animate(
        [
          { strokeDasharray: '1000', strokeDashoffset: 1000 },
          { strokeDasharray: '1000', strokeDashoffset: 0 }
        ],
        { duration: 2800, delay: delay, easing: 'ease-in-out', fill: 'backwards' }
      );
    });
  }

  // first load: wait until the loading screen is gone
  if (document.body.classList.contains('loading')) {
    const mo = new MutationObserver(() => {
      if (!document.body.classList.contains('loading')) { mo.disconnect(); drawIn(600); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } else {
    drawIn(600);
  }

  // every Home click (capture phase: read whether About was open before it closes)
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href="#home"]');
    if (!link) return;
    const fromAbout = aboutView && !aboutView.hidden;
    drawIn(fromAbout ? 600 : 0);
  }, true);
})();