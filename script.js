// ── State ────────────────────────────────────────────────────────
let mode       = 'stopwatch'; // 'stopwatch' | 'countdown'
let isRunning  = false;
let startTime  = 0;
let elapsed    = 0;           // ms accumulated (stopwatch)
let cdTotal    = 0;           // countdown total ms
let cdRemain   = 0;           // countdown remaining ms
let timerInterval = null;
let history    = [];

// ── DOM ──────────────────────────────────────────────────────────
const timeDisplay      = document.getElementById('timeDisplay');
const msDisplay        = document.getElementById('msDisplay');
const displayWrap      = document.getElementById('displayWrap');
const lcdModeLabel     = document.getElementById('lcdModeLabel');
const statusDot        = document.getElementById('statusDot');
const statusText       = document.getElementById('statusText');
const btnStart         = document.getElementById('btnStart');
const btnClear         = document.getElementById('btnClear');
const btnRow           = document.getElementById('btnRow');
const countdownInputs  = document.getElementById('countdownInputs');
const historyList      = document.getElementById('historyList');
const historyEmpty     = document.getElementById('historyEmpty');
const historyCount     = document.getElementById('historyCount');
const tabStopwatch     = document.getElementById('tabStopwatch');
const tabCountdown     = document.getElementById('tabCountdown');
const inputH           = document.getElementById('inputH');
const inputM           = document.getElementById('inputM');
const inputS           = document.getElementById('inputS');

// ── Helpers ──────────────────────────────────────────────────────
function formatTime(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatMs(ms) {
  return String(Math.floor(Math.abs(ms)) % 1000).padStart(3, '0');
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function clampInput(el, max) {
  let v = parseInt(el.value, 10);
  if (isNaN(v) || v < 0) v = 0;
  if (v > max) v = max;
  el.value = v;
}

function getCountdownMs() {
  const h = parseInt(inputH.value, 10) || 0;
  const m = parseInt(inputM.value, 10) || 0;
  const s = parseInt(inputS.value, 10) || 0;
  return (h * 3600 + m * 60 + s) * 1000;
}

// ── Mode Switch ──────────────────────────────────────────────────
function switchMode(newMode) {
  if (isRunning) handleClear(); // stop & reset before switching
  mode = newMode;

  if (mode === 'stopwatch') {
    tabStopwatch.classList.add('active');
    tabCountdown.classList.remove('active');
    countdownInputs.classList.remove('visible');
    lcdModeLabel.textContent = 'STOPWATCH';
    msDisplay.style.display  = '';
    resetDisplay('00:00:00', '000');
  } else {
    tabCountdown.classList.add('active');
    tabStopwatch.classList.remove('active');
    countdownInputs.classList.add('visible');
    lcdModeLabel.textContent = 'COUNTDOWN';
    msDisplay.style.display  = 'none';
    const total = getCountdownMs();
    resetDisplay(formatTime(total), '000');
  }

  setStatus('READY', '');
  displayWrap.className = 'display-wrap';
}

// ── Tick ─────────────────────────────────────────────────────────
function tick() {
  if (mode === 'stopwatch') {
    elapsed = Date.now() - startTime;
    timeDisplay.textContent = formatTime(elapsed);
    msDisplay.textContent   = formatMs(elapsed);
  } else {
    cdRemain = cdTotal - (Date.now() - startTime);

    if (cdRemain <= 0) {
      cdRemain = 0;
      timeDisplay.textContent = '00:00:00';
      onCountdownFinished();
      return;
    }

    timeDisplay.textContent = formatTime(cdRemain);

    // Warning: last 10 seconds
    if (cdRemain <= 10000) {
      displayWrap.className = 'display-wrap warning';
      setStatus('WARNING', 'warning');
    }
  }
}

function onCountdownFinished() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;

  addToHistory(cdTotal, 'cd');
  displayWrap.className = 'display-wrap finished flash';
  setStatus('FINISHED', 'finished');

  // Beep sound via AudioContext
  beep();

  // Reset buttons
  btnStart.textContent = 'Start';
  btnStart.classList.replace('btn-red', 'btn-green');
  btnClear.style.display = '';
  removeLapBtn();

  // Re-enable inputs
  setInputsDisabled(false);
}

// ── Controls ─────────────────────────────────────────────────────
function handleStart() {
  if (!isRunning) {
    // ── START ──
    if (mode === 'countdown') {
      cdTotal = getCountdownMs();
      if (cdTotal <= 0) return; // nothing to count down
      cdRemain = cdTotal;
      setInputsDisabled(true);
    }

    startTime = Date.now() - (mode === 'stopwatch' ? elapsed : (cdTotal - cdRemain));
    timerInterval = setInterval(tick, 16);
    isRunning = true;

    btnStart.textContent = 'Stop';
    btnStart.classList.replace('btn-green', 'btn-red');
    btnClear.style.display = 'none';

    // Add Lap button only for stopwatch
    if (mode === 'stopwatch') addLapBtn();

    displayWrap.className = 'display-wrap running';
    setStatus('RUNNING', 'running');

  } else {
    // ── STOP ──
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;

    if (mode === 'stopwatch') {
      elapsed = Date.now() - startTime;
      addToHistory(elapsed, 'sw');
    } else {
      cdRemain = cdTotal - (Date.now() - startTime);
      if (cdRemain < 0) cdRemain = 0;
      // Save how much time was consumed
      addToHistory(cdTotal - cdRemain, 'cd');
      setInputsDisabled(false);
    }

    btnStart.textContent = 'Start';
    btnStart.classList.replace('btn-red', 'btn-green');
    btnClear.style.display = '';
    removeLapBtn();

    displayWrap.className = 'display-wrap';
    setStatus('STOPPED', '');
  }
}

function handleClear() {
  if (isRunning) return;

  elapsed  = 0;
  cdRemain = 0;

  if (mode === 'stopwatch') {
    resetDisplay('00:00:00', '000');
  } else {
    const total = getCountdownMs();
    resetDisplay(formatTime(total), '000');
    setInputsDisabled(false);
  }

  displayWrap.className = 'display-wrap';
  setStatus('READY', '');
}

function handleLap() {
  if (!isRunning || mode !== 'stopwatch') return;
  const snap = Date.now() - startTime;
  addToHistory(snap, 'lap');
}

// ── UI helpers ───────────────────────────────────────────────────
function addLapBtn() {
  if (document.getElementById('btnLap')) return;
  const btn = document.createElement('button');
  btn.id        = 'btnLap';
  btn.className = 'btn btn-gray';
  btn.textContent = 'Lap';
  btn.onclick   = handleLap;
  btnRow.classList.add('three');
  btnRow.appendChild(btn);
}

function removeLapBtn() {
  const btn = document.getElementById('btnLap');
  if (btn) btn.remove();
  btnRow.classList.remove('three');
}

function setStatus(text, dotClass) {
  statusText.textContent = text;
  statusDot.className    = 'status-dot' + (dotClass ? ' ' + dotClass : '');
}

function resetDisplay(time, ms) {
  timeDisplay.textContent = time;
  msDisplay.textContent   = ms;
}

function setInputsDisabled(disabled) {
  inputH.disabled = disabled;
  inputM.disabled = disabled;
  inputS.disabled = disabled;
}

// ── Beep (Web Audio API) ─────────────────────────────────────────
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime  + offset + 0.18);
    });
  } catch (e) { /* AudioContext not available */ }
}

// ── History ──────────────────────────────────────────────────────
function addToHistory(ms, type) {
  history.unshift({
    index: history.length + 1,
    ms,
    time: formatTime(ms),
    milliseconds: formatMs(ms),
    stamp: formatTimestamp(),
    type  // 'sw' | 'cd' | 'lap'
  });
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historyEmpty.style.display = '';
    historyList.style.display  = 'none';
    historyCount.textContent   = '0 runs';
    return;
  }
  historyEmpty.style.display = 'none';
  historyList.style.display  = '';
  historyCount.textContent   = `${history.length} run${history.length !== 1 ? 's' : ''}`;

  historyList.innerHTML = '';
  const labels = { sw: ['SW','sw'], cd: ['CD','cd'], lap: ['LAP','lap'] };

  history.forEach(entry => {
    const [label, cls] = labels[entry.type] || ['?','sw'];
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <span class="row-index">#${String(entry.index).padStart(2,'0')}</span>
      <span class="mode-badge ${cls}">${label}</span>
      <span class="row-time">${entry.time}</span>
      <span class="row-ms">.${entry.milliseconds}</span>
      <span class="row-date">${entry.stamp}</span>
    `;
    historyList.appendChild(row);
  });
}

function clearHistory() {
  history = [];
  renderHistory();
}

// ── Live update of countdown display when inputs change ──────────
[inputH, inputM, inputS].forEach(el => {
  el.addEventListener('input', () => {
    if (!isRunning && mode === 'countdown') {
      const total = getCountdownMs();
      resetDisplay(formatTime(total), '000');
    }
  });
});
