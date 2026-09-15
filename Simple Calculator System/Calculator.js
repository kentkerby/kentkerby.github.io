// If this tab was opened from the portfolio's "Live Demo" link, clicking
// "back to portfolio" should just close this tab and refocus that one,
// instead of opening yet another portfolio tab.
(function () {
  const backLink = document.querySelector('.back-link');
  if (!backLink) return;
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

function log(text, cls){
  const p = document.createElement('p');
  p.className = 'line' + (cls ? ' ' + cls : '');
  p.textContent = text;
  screen.appendChild(p);
  screen.scrollTop = screen.scrollHeight;
}

const ops = {
  add:      { label: 'Add',      symbol: '+', fn: (a,b) => a + b },
  subtract: { label: 'Subtract', symbol: '-', fn: (a,b) => a - b },
  multiply: { label: 'Multiply', symbol: '*', fn: (a,b) => a * b },
  divide:   { label: 'Divide',   symbol: '/', fn: (a,b) => a / b }
};

function renderMenu(){
  controls.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'btn-row';
  Object.entries(ops).forEach(([key, op], i) => {
    const btn = document.createElement('button');
    btn.textContent = op.label;
    btn.onclick = () => renderInputs(key);
    row.appendChild(btn);
  });
  controls.appendChild(row);
}

function renderInputs(key){
  controls.innerHTML = '';
  const op = ops[key];

  const a = document.createElement('input');
  a.type = 'number';
  a.placeholder = 'First number';

  const b = document.createElement('input');
  b.type = 'number';
  b.placeholder = 'Second number';

  const row = document.createElement('div');
  row.className = 'btn-row';

  const confirm = document.createElement('button');
  confirm.className = 'primary';
  confirm.textContent = 'Compute';
  confirm.onclick = () => {
    const x = parseFloat(a.value);
    const y = parseFloat(b.value);
    if(isNaN(x) || isNaN(y)){
      log('Enter two valid numbers.', 'err');
      return;
    }
    if(key === 'divide' && y === 0){
      log('Cannot divide by zero.', 'err');
      return;
    }
    const result = op.fn(x, y);
    log(op.label + ': ' + x + ' ' + op.symbol + ' ' + y, 'muted');
    log('Result: ' + result, 'accent');
    renderMenu();
  };

  const cancel = document.createElement('button');
  cancel.textContent = 'Back';
  cancel.onclick = () => renderMenu();

  b.addEventListener('keydown', (e) => { if(e.key === 'Enter') confirm.click(); });

  row.appendChild(confirm);
  row.appendChild(cancel);
  controls.appendChild(a);
  controls.appendChild(b);
  controls.appendChild(row);
  a.focus();
}

log('=== Simple Calculator ===', 'accent');
log('Choose an operation to begin.', 'muted');
renderMenu();