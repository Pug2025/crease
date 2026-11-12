// Lights: tap when the light comes on. 10 lights, each after a random 1.5 to 4 s wait.
// Score: the median tap in ms. A tap before the light (or faster than a person can react)
// shows "Early." and that light goes again. 3 counted rounds a day; more are practice.
// Every round is saved with its date. It never counts as a session.
import { esc, on } from '../ui.js';
import { dayKey } from '../plan/decide.js';

export const TAPS = 10;
export const COUNTED_PER_DAY = 3;
const WAIT = [1500, 4000];
const TOO_FAST = 100; // under 100 ms is a guess, not a reaction
const BOUNCE = 250; // a second touch this soon after a counted tap is the same finger

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// His best counted score, and how many counted rounds are left today.
export function lightsStats(lights = [], now = new Date()) {
  const counted = lights.filter((l) => l.counted && Number.isFinite(l.ms));
  const best = counted.length ? Math.min(...counted.map((l) => l.ms)) : null;
  const today = counted.filter((l) => dayKey(new Date(l.date)) === dayKey(now)).length;
  return { best, today, left: Math.max(0, COUNTED_PER_DAY - today) };
}

// Adds one finished round to the save. Returns what the result screen shows.
export function recordRound(save, taps, now = new Date()) {
  const before = lightsStats(save.lights, now);
  const ms = median(taps);
  const counted = before.left > 0;
  save.lights.push({ date: now.toISOString(), ms, counted, taps: taps.map((t) => Math.round(t)) });
  return {
    ms,
    counted,
    round: before.today + 1,
    first: counted && before.best === null,
    best: counted && before.best !== null && ms < before.best,
    was: before.best,
    fastest: Math.round(Math.min(...taps)),
  };
}

export function render(root, app, { first = false } = {}) {
  const s = app.save;
  let timer = null;
  let lit = false;
  let litAt = 0;
  let lastTap = -1e9;
  let taps = [];
  let running = false;

  root.innerHTML = `
  <div class="lights" data-state="intro">
    <div class="lt-top">
      <button class="lt-back" data-act="back">${first ? 'Later' : 'Back'}</button>
      <span class="lt-kicker"></span>
    </div>
    <h1 class="lt-title">Lights</h1>
    <div class="lt-stage">
      <div class="lt-light" aria-live="polite"><span class="lt-num"></span><span class="lt-unit"></span></div>
    </div>
    <div class="lt-pips" aria-hidden="true">${'<i></i>'.repeat(TAPS)}</div>
    <div class="lt-info"></div>
    <div class="lt-buttons"></div>
  </div>`;

  const $ = (q) => root.querySelector(q);
  const board = $('.lights');
  const light = $('.lt-light');
  const num = $('.lt-num');
  const unit = $('.lt-unit');
  const info = $('.lt-info');
  const buttons = $('.lt-buttons');
  const pips = [...root.querySelectorAll('.lt-pips i')];

  const kicker = $('.lt-kicker');
  const show = (n = '', u = '') => { num.textContent = n; unit.textContent = u; };
  const setKicker = () => {
    const { best } = lightsStats(s.lights);
    kicker.textContent = best !== null ? `Best ${best} ms` : first ? 'First score' : '';
  };
  const setPips = () => pips.forEach((p, k) => p.classList.toggle('on', k < taps.length));

  function intro() {
    running = false;
    clearTimeout(timer);
    lit = false;
    taps = [];
    setPips();
    board.dataset.state = 'intro';
    light.classList.remove('on', 'best');
    show();
    setKicker();
    const st = lightsStats(s.lights);
    const status = st.left === 0
      ? 'Today\'s 3 rounds are done. This one is practice.'
      : `Round ${st.today + 1} of ${COUNTED_PER_DAY} today`;
    info.innerHTML = `
      <p>Tap when the light comes on. ${TAPS} lights.</p>
      <p>Your score is your middle time. Lower is faster.</p>
      <p class="lt-status">${esc(status)}</p>`;
    buttons.innerHTML = '<button class="btn btn-go" data-act="go">Start</button>';
  }

  function wait() {
    lit = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      requestAnimationFrame((t) => {
        if (!running) return;
        show();
        light.classList.add('on');
        litAt = t;
        lit = true;
      });
    }, WAIT[0] + Math.random() * (WAIT[1] - WAIT[0]));
  }

  function go() {
    taps = [];
    setPips();
    running = true;
    board.dataset.state = 'run';
    light.classList.remove('on', 'best');
    const st = lightsStats(s.lights);
    info.innerHTML = `<p class="lt-status">${st.left ? `Round ${st.today + 1} of ${COUNTED_PER_DAY} today` : 'Practice round'}</p>`;
    // Keep Start's space while the round runs, so the light doesn't jump when it starts.
    buttons.innerHTML = '<button class="btn btn-go" tabindex="-1" aria-hidden="true" style="visibility:hidden">Start</button>';
    show();
    wait();
  }

  function early() {
    light.classList.remove('on');
    show('Early.');
    wait(); // the same light goes again
  }

  function onDown(e) {
    if (!running || !e.isPrimary || e.button > 0 || e.target.closest('button')) return;
    e.preventDefault();
    // The tap's own time, on the same clock as the light. An older browser may give epoch time: fall back.
    const now = e.timeStamp > 0 && e.timeStamp < 1e12 ? e.timeStamp : performance.now();
    if (now - lastTap < BOUNCE) return;
    if (!lit) { early(); return; }
    const ms = now - litAt;
    if (ms < TOO_FAST) { early(); return; }
    lastTap = now;
    lit = false;
    light.classList.remove('on');
    taps.push(ms);
    setPips();
    show(String(Math.round(ms)), 'ms');
    if (taps.length < TAPS) wait();
    else { running = false; timer = setTimeout(result, 700); }
  }

  function result() {
    const r = recordRound(s, taps);
    app.persist();
    setKicker();
    board.dataset.state = 'result';
    light.classList.toggle('best', r.best);
    show(String(r.ms), r.best ? 'Best' : 'ms');
    const line = !r.counted ? 'Practice round. Only 3 rounds a day count.'
      : r.best ? `New best. Your old best was ${r.was} ms.`
      : r.first ? 'Your first score.'
      : `Best: ${r.was} ms.`;
    info.innerHTML = `
      <p class="lt-line${r.best ? ' lt-gold' : ''}">${esc(line)}</p>
      <p class="lt-status">Middle of ${TAPS} taps · fastest ${r.fastest} ms${r.counted ? ` · round ${r.round} of ${COUNTED_PER_DAY} today` : ''}</p>`;
    buttons.innerHTML = `
      <button class="btn lt-again" data-act="again">Go again</button>
      <button class="btn btn-primary lt-home" data-act="home">${first ? 'Go to Today' : 'Back to Today'}</button>`;
  }

  // Leaving the app mid-round throws the round away: a wait that ran in the background isn't fair.
  function onHide() { if (document.hidden && running) intro(); }

  board.addEventListener('pointerdown', onDown);
  document.addEventListener('visibilitychange', onHide);
  on(root, {
    back: () => app.go('home'),
    home: () => app.go('home'),
    go: () => go(),
    again: () => go(),
  });
  intro();

  return () => {
    running = false;
    clearTimeout(timer);
    board.removeEventListener('pointerdown', onDown);
    document.removeEventListener('visibilitychange', onHide);
  };
}
