// Glove or Blocker: two pads, left and right. After a random 1.2 to 3 s wait one pad lights and
// he taps that pad. 12 lights a round, 6 a side in random order. Score: the median tap in ms.
// A tap before the light (or faster than a person can react) shows "Early." and that light goes
// again. A tap on the other pad shows "Wrong side." and that light goes again after a new wait,
// in a reshuffled order. Three wrong sides end the round with nothing saved, so mashing both pads
// never scores. 3 counted rounds a day; more are practice. It never counts as a session.
import { esc, on } from '../ui.js';
import { median, lightsStats, maskLinesHtml, wearFrom, COUNTED_PER_DAY, trainedToday, gameLocked, useFree, LOCK_WORDS } from './lights.js';
import { claimMasks } from '../plan/card.js';
import { celebrate } from '../celebrate.js';

export const TAPS = 12;
export const MAX_WRONG = 3;
const WAIT = [1200, 3000];
const TOO_FAST = 100; // under 100 ms is a guess, not a reaction
const BOUNCE = 250; // any touch this soon after a counted tap is the same hand

export const handsStats = (hands = [], now = new Date()) => lightsStats(hands, now);

function shuffle(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A new round: 6 lefts and 6 rights in random order. queue[0] is the pad that lights next.
export function newRound(rand = Math.random) {
  return { queue: shuffle([...Array(TAPS / 2).fill('L'), ...Array(TAPS / 2).fill('R')], rand), taps: [], wrong: 0, rand };
}

// One tap. lit: the pad is on; side: the pad he tapped; ms: since it lit.
// Returns 'early', 'wrong', 'over' (too many wrong sides), 'hit', or 'done' (12 hits).
export function judge(r, { lit, side, ms = 0 }) {
  if (!lit) return 'early';
  if (ms < TOO_FAST) { r.queue = shuffle(r.queue, r.rand); return 'early'; }
  if (side !== r.queue[0]) {
    r.wrong++;
    if (r.wrong >= MAX_WRONG) return 'over';
    r.queue = shuffle(r.queue, r.rand);
    return 'wrong';
  }
  r.taps.push(ms);
  r.queue.shift();
  return r.queue.length ? 'hit' : 'done';
}

// Adds one finished round to the save. Returns what the result screen shows.
export function recordHands(save, taps, now = new Date()) {
  save.hands = Array.isArray(save.hands) ? save.hands : [];
  const before = handsStats(save.hands, now);
  const ms = median(taps);
  const counted = before.left > 0;
  save.hands.push({ date: now.toISOString(), ms, counted, taps: taps.map((t) => Math.round(t)) });
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

// The end of a round. Only 12 hits with fewer than 3 wrong sides is saved; anything else saves
// nothing and returns null, so it never uses up a counted round.
export function finish(save, r, now = new Date()) {
  if (r.wrong >= MAX_WRONG || r.taps.length < TAPS) return null;
  return recordHands(save, r.taps, now);
}

export function render(root, app) {
  const s = app.save;
  s.hands = Array.isArray(s.hands) ? s.hands : [];
  let timer = null;
  let lit = false;
  let litAt = 0;
  let lastTap = -1e9;
  let round = newRound();
  let running = false;

  root.innerHTML = `
  <div class="lights hands" data-state="intro">
    <div class="lt-top">
      <button class="lt-back" data-act="back">Back</button>
      <span class="lt-kicker"></span>
    </div>
    <h1 class="lt-title gb-title">Glove or Blocker</h1>
    <div class="gb-stage">
      <p class="gb-read" aria-live="polite"><span class="lt-num gb-num"></span><span class="lt-unit"></span></p>
      <div class="gb-pads">
        <div class="gb-pad" data-side="L"></div>
        <div class="gb-pad" data-side="R"></div>
      </div>
    </div>
    <div class="lt-pips gb-pips" aria-hidden="true">${'<i></i>'.repeat(TAPS)}</div>
    <div class="lt-info"></div>
    <div class="lt-buttons"></div>
  </div>`;

  const $ = (q) => root.querySelector(q);
  const board = $('.hands');
  const read = $('.gb-read');
  const num = $('.gb-num');
  const unit = $('.gb-read .lt-unit');
  const info = $('.lt-info');
  const buttons = $('.lt-buttons');
  const kicker = $('.lt-kicker');
  const pads = { L: $('.gb-pad[data-side="L"]'), R: $('.gb-pad[data-side="R"]') };
  const pips = [...root.querySelectorAll('.gb-pips i')];

  // Numbers show big; words ("Early.", "Wrong side.") a size smaller so they fit one line.
  const show = (n = '', u = '') => { num.textContent = n; unit.textContent = u; read.classList.toggle('word', /[a-z]/i.test(n)); };
  const dark = () => { pads.L.classList.remove('on'); pads.R.classList.remove('on'); };
  const setKicker = () => {
    const { best } = handsStats(s.hands);
    kicker.textContent = best !== null ? `Best ${best} ms` : '';
  };
  const setPips = () => pips.forEach((p, k) => p.classList.toggle('on', k < round.taps.length));
  const status = () => {
    const st = handsStats(s.hands);
    return st.left ? `Round ${st.today + 1} of ${COUNTED_PER_DAY} today` : 'Practice round';
  };

  function intro() {
    running = false;
    clearTimeout(timer);
    lit = false;
    round = newRound();
    setPips();
    board.dataset.state = 'intro';
    read.classList.remove('best');
    dark();
    show();
    setKicker();
    const st = handsStats(s.hands);
    const line = st.left === 0 ? 'You\'ve played your 3 rounds for today. This one is practice and won\'t count.' : `Round ${st.today + 1} of ${COUNTED_PER_DAY} today`;
    info.innerHTML = `
      <p>One side will light up ${TAPS} times. Tap that side as fast as you can each time.</p>
      <p>Your score is how fast you usually tap. A lower number is faster.</p>
      <p class="lt-status">${esc(line)}</p>
      ${trainedToday(s) ? '' : `<p class="lt-status lt-lock">${esc(LOCK_WORDS.free)}</p>`}`;
    buttons.innerHTML = '<button class="btn btn-go" data-act="go">Start</button>';
    if (gameLocked(s, 'hands')) lockedView();
  }

  // He has used today's free round and hasn't trained yet.
  function lockedView() {
    board.dataset.state = 'intro';
    info.innerHTML = `<p class="lt-line">${esc(LOCK_WORDS.locked)}</p>`;
    buttons.innerHTML = `<button class="btn btn-primary lt-home" data-act="home">Back to Today</button>`;
  }

  function wait() {
    lit = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      requestAnimationFrame((t) => {
        if (!running) return;
        show();
        pads[round.queue[0]].classList.add('on');
        litAt = t;
        lit = true;
      });
    }, WAIT[0] + Math.random() * (WAIT[1] - WAIT[0]));
  }

  function go() {
    if (gameLocked(s, 'hands')) { lockedView(); return; }
    useFree(s, 'hands');
    app.persist();
    round = newRound();
    setPips();
    running = true;
    board.dataset.state = 'run';
    read.classList.remove('best');
    dark();
    info.innerHTML = `<p class="lt-status">${esc(status())}</p>`;
    // Keep Start's space while the round runs, so the pads don't jump when it starts.
    buttons.innerHTML = '<button class="btn btn-go" tabindex="-1" aria-hidden="true" style="visibility:hidden">Start</button>';
    show();
    wait();
  }

  function onDown(e) {
    if (!running || e.button > 0 || e.target.closest('button')) return;
    const pad = e.target.closest('.gb-pad');
    if (!pad) return;
    e.preventDefault();
    // The tap's own time, on the same clock as the light. An older browser may give epoch time: fall back.
    const now = e.timeStamp > 0 && e.timeStamp < 1e12 ? e.timeStamp : performance.now();
    if (now - lastTap < BOUNCE) return;
    const ms = now - litAt;
    const what = judge(round, { lit, side: pad.dataset.side, ms });
    lit = false;
    dark();
    if (what === 'early') { show('Early.'); wait(); return; }
    if (what === 'wrong') { show('Wrong side.'); wait(); return; }
    if (what === 'over') { running = false; clearTimeout(timer); over(); return; }
    lastTap = now;
    setPips();
    show(String(Math.round(ms)), 'ms');
    if (what === 'hit') wait();
    else { running = false; timer = setTimeout(result, 700); }
  }

  // Three wrong sides: nothing saved, and it doesn't use up a counted round.
  function over() {
    board.dataset.state = 'result';
    if (masks.length) celebrate({ big: true }); else if (r.best) celebrate();
    show();
    info.innerHTML = `
      <p class="lt-line">You tapped the wrong side three times.</p>
      <p class="lt-status">This round doesn't count.</p>
      ${gameLocked(s, 'hands') ? `<p class="lt-status lt-lock">${esc(LOCK_WORDS.after)}</p>` : ''}`;
    buttons.innerHTML = `
      ${gameLocked(s, 'hands') ? '' : '<button class="btn lt-again" data-act="again">Go again</button>'}
      <button class="btn btn-primary lt-home" data-act="home">Back to Today</button>`;
  }

  function result() {
    const r = finish(s, round);
    if (!r) { over(); return; }
    const masks = r.counted ? claimMasks(s) : [];
    app.persist();
    setKicker();
    board.dataset.state = 'result';
    read.classList.toggle('best', r.best);
    show(String(r.ms), r.best ? 'Best' : 'ms');
    const line = !r.counted ? 'This was a practice round. Your first 3 rounds each day are the ones that count.'
      : r.best ? `New best. Your old best was ${r.was} ms.`
      : r.first ? 'Your first score.'
      : `Best: ${r.was} ms.`;
    info.innerHTML = `
      <p class="lt-line${r.best ? ' lt-gold' : ''}">${esc(line)}</p>
      <p class="lt-status">Your fastest tap was ${r.fastest} ms${r.counted ? ` · round ${r.round} of ${COUNTED_PER_DAY} today` : ''}</p>
      ${maskLinesHtml(masks)}
      ${gameLocked(s, 'hands') ? `<p class="lt-status lt-lock">${esc(LOCK_WORDS.after)}</p>` : ''}`;
    buttons.innerHTML = `
      ${gameLocked(s, 'hands') ? '' : '<button class="btn lt-again" data-act="again">Go again</button>'}
      <button class="btn btn-primary lt-home" data-act="home">Back to Today</button>`;
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
    wear: (id, el) => wearFrom(app, id, el),
  });
  intro();

  return () => {
    running = false;
    clearTimeout(timer);
    board.removeEventListener('pointerdown', onDown);
    document.removeEventListener('visibilitychange', onHide);
  };
}
