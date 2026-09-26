// Loading screen
(function () {
  const loaderScreen = document.getElementById('loaderScreen');
  const loaderBarFill = document.getElementById('loaderBarFill');
  const loaderStatus = document.getElementById('loaderStatus');

  // Skip loading screen when arriving via ?fromdemo=1
  const params = new URLSearchParams(window.location.search);
  if (params.get('fromdemo') === '1') {
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

// Name heading: typing effect
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
      for (const ch of line) {
        html += `<span class="tc tc-hide">${ch === ' ' ? '&nbsp;' : ch}</span>`;
      }
      if (li < lines.length - 1) html += '<br>';
    });
    el.innerHTML = html;

    const chars = Array.from(el.querySelectorAll('.tc'));
    let i = 0;
    let typingIn = true;

    function tick() {
      if (typingIn) {
        if (i < chars.length) {
          chars.forEach((c) => c.classList.remove('tc-active'));
          chars[i].classList.remove('tc-hide');
          chars[i].classList.add('tc-active');
          i++;
          setTimeout(tick, TYPE_SPEED);
        } else {
          chars.forEach((c) => c.classList.remove('tc-active'));
          typingIn = false;
          setTimeout(tick, HOLD_AFTER_TYPE);
        }
      } else {
        if (i > 0) {
          i--;
          chars[i].classList.add('tc-hide');
          chars[i].classList.remove('tc-active');
          setTimeout(tick, ERASE_SPEED);
        } else {
          typingIn = true;
          setTimeout(tick, HOLD_AFTER_ERASE);
        }
      }
    }
    tick();
  });
})();

// Hero intro transition
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width:820px)').matches;
  const headerEl = document.querySelector('header');
  const heroScroll = document.getElementById('heroScroll');
  const introCenter = document.getElementById('introCenter');
  const introInner = document.getElementById('introInner');
  const heroHeading = document.getElementById('heroHeading');
  const revealItems = Array.from(document.querySelectorAll('.reveal-item'));
  if (!heroScroll || !heroHeading) return;

  function setHeaderHeightVar() {
    if (headerEl) document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  setHeaderHeightVar();

  // CSS fallback (prefers-reduced-motion / max-width:820px) handles the static state
  if (reduceMotion || isMobile) return;

  // Delta between intro text and real heading position
  let dx = 0, dy = 0;
  function recomputeDelta() {
    if (!introInner) return;
    const prevTransform = introCenter.style.transform;
    introCenter.style.transform = 'none'; // measure from the untransformed baseline
    const introRect = introInner.getBoundingClientRect();
    const heroRect = heroHeading.getBoundingClientRect();
    dx = heroRect.left - introRect.left;
    dy = heroRect.top - introRect.top;
    introCenter.style.transform = prevTransform;
  }

  function getProgress() {
    const rect = heroScroll.getBoundingClientRect();
    const scrollable = heroScroll.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 1;
    const scrolled = -rect.top;
    return Math.min(Math.max(scrolled / scrollable, 0), 1);
  }

  // Maps progress p (0-1) into a local 0-1 value over [start, end]
  function localProgress(p, start, end) {
    return Math.min(Math.max((p - start) / (end - start), 0), 1);
  }

  function applyProgress(p) {
    // Centered intro slides toward the real heading's spot while fading out
    const introP = localProgress(p, 0, 0.45);
    if (introCenter) {
      const eased = introP * introP * (3 - 2 * introP); // smoothstep for a natural glide
      introCenter.style.opacity = String(1 - introP);
      introCenter.style.transform = `translate(${dx * eased}px, ${dy * eased}px) scale(${1 - eased * 0.1})`;
      introCenter.style.pointerEvents = introP >= 1 ? 'none' : 'auto';
    }

    // Real heading (already in its correct final spot) fades in right after
    const headingP = localProgress(p, 0.25, 0.5);
    heroHeading.style.opacity = String(headingP);

    // Rest of the hero cascades in immediately after, slightly staggered
    revealItems.forEach((el) => {
      const delayIndex = parseFloat(el.dataset.d || '0');
      const start = 0.45 + delayIndex * 0.08;
      const local = localProgress(p, start, 1);
      el.style.opacity = String(local);
      el.style.transform = `translateY(${18 * (1 - local)}px)`;
    });
  }

  // Smoothly interpolate toward the scroll-driven target instead of snapping
  // straight to it every frame — this is what makes the intro glide instead
  // of jump when the user scrolls fast.
  let currentP = 0;
  let targetP = 0;
  const SMOOTHING = 0.09; // lower = smoother/slower catch-up, higher = snappier

  function raf() {
    targetP = getProgress();
    currentP += (targetP - currentP) * SMOOTHING;
    // Snap once the gap is imperceptible so it doesn't keep animating forever
    if (Math.abs(targetP - currentP) < 0.0008) currentP = targetP;
    applyProgress(currentP);
    requestAnimationFrame(raf);
  }

  function onResize() {
    setHeaderHeightVar();
    recomputeDelta();
    applyProgress(currentP);
  }

  recomputeDelta();
  currentP = getProgress();
  applyProgress(currentP);
  requestAnimationFrame(raf);
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
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

  function updateActiveSection() {
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const line = headerH + 8; // a little past the header edge

    let current = null;
    sections.forEach((sec) => {
      if (sec.getBoundingClientRect().top - line <= 0) {
        current = sec.id; // last section whose top has crossed the line wins
      }
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

  window.addEventListener('scroll', onSpyScroll, { passive: true });
  window.addEventListener('resize', onSpyScroll);
  window.addEventListener('load', updateActiveSection);
  updateActiveSection();
})();

// Mobile nav toggle
(function () {
  const navToggle = document.getElementById('navToggle');
  const navlinks = document.getElementById('navlinks');
  navToggle.addEventListener('click', () => navlinks.classList.toggle('open'));
  navlinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navlinks.classList.remove('open')));
})();

// Skills marquee
(function () {
  const skillIcons = {
    'C#': 'assets/logos/csharp.png',
    'Java': 'assets/logos/java.png',
    'Python': 'assets/logos/python.png',
    'HTML': 'assets/logos/html.png',
    'CSS': 'assets/logos/css.png',
    'JavaScript': 'assets/logos/javascript.png',
    'VS Code': 'assets/logos/vscode.png',
    'Git': 'assets/logos/git.png'
  };

  const skillDescriptions = {
    'C#': 'Object-oriented language used for console apps like the ATM system and calculator projects.',
    'Java': 'General-purpose OOP language used for building structured, class-based applications.',
    'Python': 'Versatile language used for scripting, automation, and general programming practice.',
    'HTML': 'Markup language used to structure the content and layout of web pages.',
    'CSS': 'Stylesheet language used to design, layout, and theme web pages like this portfolio.',
    'JavaScript': 'Scripting language used to add interactivity, like this site\u2019s theme toggle and cursor effects.',
    'VS Code': 'Main code editor used for writing, debugging, and running projects.',
    'Git': 'Version control system used to track changes and manage project history.'
  };

  const skillsTrack = document.getElementById('skillsTrack');
  const skillNames = Object.keys(skillIcons);

  function buildSkillCards() {
    let html = '';
    [...skillNames, ...skillNames].forEach((name) => { // duplicated so the -50% loop is seamless
      html += `<div class="skill-card" data-skill="${name}"><img src="${skillIcons[name]}" alt="${name} logo" loading="lazy"><span>${name}</span></div>`;
    });
    skillsTrack.innerHTML = html;
  }
  buildSkillCards();

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
    skillsTrack.addEventListener('click', (e) => {
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
    skillsTrack.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.skill-card');
      if (!card) return;
      showSkillTooltip(card);
    });
    skillsTrack.addEventListener('mouseout', (e) => {
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
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cDot = document.querySelector('.cursor-dot');
  const cRing = document.querySelector('.cursor-ring');
  const cGlow = document.querySelector('.cursor-glow');

  let mx = 0, my = 0;
  let ringX = 0, ringY = 0;
  let glowX = 0, glowY = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    cDot.style.left = mx + 'px';
    cDot.style.top = my + 'px';
  });

  function tick() {
    ringX += (mx - ringX) * 0.16;
    ringY += (my - ringY) * 0.16;
    cRing.style.left = ringX + 'px';
    cRing.style.top = ringY + 'px';

    glowX += (mx - glowX) * 0.08;
    glowY += (my - glowY) * 0.08;
    cGlow.style.left = glowX + 'px';
    cGlow.style.top = glowY + 'px';

    requestAnimationFrame(tick);
  }
  tick();

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
  photoFrame.addEventListener('mousemove', (e) => {
    const rect = photoFrame.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    targetY = (px - 0.5) * MAX_TILT * 2;  // left/right cursor -> rotateY
    targetX = -(py - 0.5) * MAX_TILT * 2; // up/down cursor -> rotateX
  });

  photoFrame.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
  });

  function tiltTick() {
    curX += (targetX - curX) * 0.12;
    curY += (targetY - curY) * 0.12;
    photoTiltImg.style.transform = `rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg)`;
    requestAnimationFrame(tiltTick);
  }
  tiltTick();
})();