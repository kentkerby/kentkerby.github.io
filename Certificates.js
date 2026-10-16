// Certificates: hover focus effect + a viewer that zooms out of the clicked card.
(function () {
  const grid = document.getElementById('certGrid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.cert-card'));
  const canHover = window.matchMedia('(hover: hover)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- focus effect: only while the pointer is on a card (or it has keyboard focus) ----
  function preload(card) { new Image().src = card.dataset.img; }
  function focusCard(card) {
    grid.classList.add('is-focusing');
    cards.forEach((c) => c.classList.toggle('is-focus', c === card));
  }
  function clearFocus() {
    grid.classList.remove('is-focusing');
    cards.forEach((c) => c.classList.remove('is-focus'));
  }
  cards.forEach((card) => {
    card.addEventListener('mouseenter', () => { if (canHover.matches) { preload(card); focusCard(card); } });
    card.addEventListener('mouseleave', clearFocus);
    card.addEventListener('focus', () => { if (card.matches(':focus-visible')) { preload(card); focusCard(card); } });
    card.addEventListener('blur', clearFocus);
    card.addEventListener('click', () => openViewer(card));
  });

  // ---- viewer ----
  const lb = document.createElement('div');
  lb.className = 'cert-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Certificate viewer');
  lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML =
    '<div class="cert-backdrop"></div>' +
    '<figure class="cert-box"><img alt=""><figcaption><strong></strong><span></span></figcaption></figure>' +
    '<button type="button" class="cert-close" aria-label="Close certificate">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>';
  document.body.appendChild(lb);

  const box = lb.querySelector('.cert-box');
  const img = box.querySelector('img');
  const capTitle = box.querySelector('strong');
  const capMeta = box.querySelector('span');
  const closeBtn = lb.querySelector('.cert-close');
  let current = null;
  let open = false;

  // transform that makes the viewer box sit exactly over the card
  function fromCard(card) {
    const a = card.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return 'translate(' + dx + 'px,' + dy + 'px) scale(' + a.width / b.width + ')';
  }

  function openViewer(card) {
    current = card;
    open = true;
    img.src = card.dataset.img;
    img.alt = card.dataset.title + ' certificate';
    capTitle.textContent = card.dataset.title;
    capMeta.textContent = card.dataset.issuer + ' · ' + card.dataset.date;

    box.style.transition = 'none';
    box.style.transform = 'none';
    box.style.opacity = '1';
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    if (!reduceMotion.matches) {
      box.style.transform = fromCard(card);
      box.style.opacity = '0';
      void box.offsetWidth;            // commit the start position
      box.style.transition = '';
      box.style.transform = 'none';
      box.style.opacity = '1';
    } else {
      box.style.transition = '';
    }
    closeBtn.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!open) return;
    open = false;
    if (!reduceMotion.matches && current) {
      box.style.transform = fromCard(current);
      box.style.opacity = '0';
    }
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    if (current) current.focus({ preventScroll: true });
  }

  lb.addEventListener('click', (e) => { if (!box.contains(e.target)) closeViewer(); });
  closeBtn.addEventListener('click', closeViewer);
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus({ preventScroll: true }); }
  });
  // keep the page still behind the viewer
  lb.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  lb.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
})();