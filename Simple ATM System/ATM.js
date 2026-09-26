// If this tab was opened from the portfolio's "Live Demo" link, clicking
// "back to portfolio" should just close this tab and refocus that one,
// instead of opening yet another portfolio tab.
(function () {
  const backLink = document.querySelector('.back-link');
  if (!backLink) return;
  // Embedded inside the portfolio's project spotlight preview — no need
  // for a back link, and we don't want it navigating the iframe.
  if (window.self !== window.top) {
    backLink.style.display = 'none';
    return;
  }
  backLink.addEventListener('click', (e) => {
    if (window.opener && !window.opener.closed) {
      e.preventDefault();
      // Tell the portfolio tab directly to hide/suppress its hover preview
      // before we focus it — more reliable than waiting on its own
      // focus/blur handling to catch up.
      if (typeof window.opener.hidePortfolioPreviews === 'function') {
        window.opener.hidePortfolioPreviews();
      }
      window.opener.focus();
      window.close();
    }
    // No opener (opened directly/bookmarked) — let the link navigate normally.
  });
})();

const screen = document.getElementById('screen');
const controls = document.getElementById('controls');
const balanceTag = document.getElementById('balanceTag');

const PIN = '1234';
let balance = 5000.00;
let loggedIn = false;
let attempts = 0;

function fmt(n){
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function log(text, cls){
  const p = document.createElement('p');
  p.className = 'line' + (cls ? ' ' + cls : '');
  p.textContent = text;
  screen.appendChild(p);
  screen.scrollTop = screen.scrollHeight;
}
function updateBalanceTag(){ balanceTag.textContent = loggedIn ? 'PHP ' + fmt(balance) : ''; }

function renderLogin(){
  controls.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'password';
  input.inputMode = 'numeric';
  input.maxLength = 4;
  input.placeholder = 'Enter 4-digit PIN';
  const row = document.createElement('div');
  row.className = 'btn-row';
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = 'Enter';
  const tryLogin = () => {
    if(input.value === PIN){
      loggedIn = true;
      attempts = 0;
      updateBalanceTag();
      log('PIN accepted.', 'accent');
      log('Welcome back.', '');
      renderMenu();
    } else {
      attempts++;
      log('Incorrect PIN. Attempt ' + attempts + ' of 3.', 'err');
      input.value = '';
      if(attempts >= 3){
        log('Too many attempts. Card retained.', 'err');
        controls.innerHTML = '<p class="hint">Refresh the page to try again.</p>';
      }
    }
  };
  btn.onclick = tryLogin;
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') tryLogin(); });
  row.appendChild(btn);
  controls.appendChild(input);
  controls.appendChild(row);
  input.focus();
}

function renderMenu(){
  controls.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'btn-row';

  const balBtn = document.createElement('button');
  balBtn.textContent = 'Balance Inquiry';
  balBtn.onclick = () => log('Current balance: PHP ' + fmt(balance), 'accent');

  const depBtn = document.createElement('button');
  depBtn.textContent = 'Deposit';
  depBtn.onclick = () => renderAmountPrompt('deposit');

  const witBtn = document.createElement('button');
  witBtn.textContent = 'Withdraw';
  witBtn.onclick = () => renderAmountPrompt('withdraw');

  const outBtn = document.createElement('button');
  outBtn.className = 'danger';
  outBtn.textContent = 'Logout';
  outBtn.onclick = () => {
    loggedIn = false;
    updateBalanceTag();
    log('Logged out. Thank you.', 'muted');
    renderLogin();
  };

  [balBtn, depBtn, witBtn, outBtn].forEach(b => row.appendChild(b));
  controls.appendChild(row);
}

function renderAmountPrompt(kind){
  controls.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.step = '0.01';
  input.placeholder = kind === 'deposit' ? 'Amount to deposit' : 'Amount to withdraw';

  const row = document.createElement('div');
  row.className = 'btn-row';

  const confirm = document.createElement('button');
  confirm.className = 'primary';
  confirm.textContent = 'Confirm';
  confirm.onclick = () => {
    const amt = parseFloat(input.value);
    if(isNaN(amt) || amt <= 0){
      log('Enter a valid amount.', 'err');
      return;
    }
    if(kind === 'deposit'){
      balance += amt;
      log('Deposited PHP ' + fmt(amt) + '.', 'accent');
      log('New balance: PHP ' + fmt(balance), 'accent');
    } else {
      if(amt > balance){
        log('Insufficient funds.', 'err');
        return;
      }
      balance -= amt;
      log('Withdrew PHP ' + fmt(amt) + '.', 'warn');
      log('New balance: PHP ' + fmt(balance), 'accent');
    }
    updateBalanceTag();
    renderMenu();
  };

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.onclick = () => renderMenu();

  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') confirm.click(); });

  row.appendChild(confirm);
  row.appendChild(cancel);
  controls.appendChild(input);
  controls.appendChild(row);
  input.focus();
}

log('=== Simple ATM System ===', 'accent');
log('Please enter your PIN to continue.', 'muted');
log('Demo PIN: 1234  |  Starting balance: PHP ' + fmt(balance), 'warn');
renderLogin();