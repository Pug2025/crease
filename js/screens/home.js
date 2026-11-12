// Today: one Start button. The check-in that follows decides the session; he never picks it.
// Also here: the streak, the card tile, and the week strip that Done shows too.
import { esc, on, CREASE_MARK, today } from '../ui.js';
import { SESSIONS } from '../../data/sessions.js';
import { ROOM_HINT } from '../../data/copy.js';
import { doneByDay, dayKey, counts } from '../plan/decide.js';
import { splitsState, settleSplits } from '../plan/splits.js';
import { lightsStats } from './lights.js';
import { streakStats } from '../plan/streak.js';
import { cardStats, maskState } from '../plan/card.js';
import { maskSrc } from '../../data/masks.js';

// ---- His record (pure: tests.mjs runs these in Node) ----

// Dad's test runs. New ones never reach save.log; older saves may still hold some.
export const isTest = (e) => !!(e.test || (e.dad && e.extra));

const dayAt = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => dayAt(d, -((d.getDay() + 6) % 7));

// Monday to Sunday: a box for each day with a counted session, G or P on hockey days, and the
// days a save covered. Missed days stay blank.
export function weekStats(log, days = {}, now = new Date(), savedDays = []) {
  const by = doneByDay(log.filter((e) => !isTest(e)));
  const saved = new Set(savedDays);
  const mon = mondayOf(now);
  const todayKey = dayKey(now);
  const boxes = [];
  for (let i = 0; i < 7; i++) {
    const d = dayAt(mon, i);
    const k = dayKey(d);
    const ice = days[k]?.today || days[dayKey(dayAt(d, -1))]?.tomorrow || null;
    const filled = !!by[k]?.length;
    boxes.push({
      key: k,
      letter: 'MTWTFSS'[i],
      name: d.toLocaleDateString('en-CA', { weekday: 'long' }),
      filled,
      saved: !filled && saved.has(k),
      mark: ice === 'game' ? 'G' : ice === 'practice' ? 'P' : '',
      today: k === todayKey,
      future: k > todayKey,
    });
  }
  return { boxes, count: boxes.filter((b) => b.filled).length };
}

// The season starts on 1 September.
export function seasonStats(log, now = new Date()) {
  const from = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1).getTime();
  const es = log.filter((e) => counts(e) && Date.parse(e.date) >= from);
  return { sessions: es.length, mins: Math.round(es.reduce((n, e) => n + (e.secs || 0), 0) / 60) };
}

export function weekStripHtml(w) {
  const days = w.boxes.map((b) => {
    const cls = ['wk-day', b.filled && 'filled', b.saved && 'saved', b.today && 'today', b.future && 'future'].filter(Boolean).join(' ');
    const what = b.filled ? 'session done' : b.saved ? 'saved' : 'no session';
    const label = `${b.name}: ${what}${b.mark === 'G' ? ', game' : b.mark === 'P' ? ', practice' : ''}`;
    return `<li class="${cls}" aria-label="${esc(label)}"><span class="wk-box">${b.mark}</span><span class="wk-letter">${b.letter}</span></li>`;
  }).join('');
  return `
  <section class="week">
    <div class="wk-head">
      <span class="wk-count">This week: <b>${w.count}</b></span>
    </div>
    <ol class="wk-days">${days}</ol>
  </section>`;
}

// The streak at the top of Today: the number, his saves, and one line.
export function streakLine(st) {
  if (st.todayDone) return '';
  return st.days > 0 ? `Train today to make it ${st.days + 1}.` : 'Train today to start your streak.';
}

export function streakHtml(st) {
  const line = streakLine(st);
  return `
  <section class="streak" aria-label="${st.days} day streak, ${st.saves} ${st.saves === 1 ? 'save' : 'saves'}">
    <div class="st-num"><b>${st.days}</b><span>day streak</span></div>
    <p class="st-saves">Saves: <b>${st.saves}</b></p>
    ${line ? `<p class="st-line">${esc(line)}</p>` : ''}
  </section>`;
}

// The small card on Today: the mask he wears, his Overall and tier. Opens the Card screen.
export function cardTileHtml(card, mask) {
  return `
  <button class="card-tile tier-${card.tierId}" data-act="card" aria-label="Your card: ${card.overall} overall, ${esc(card.tier)}">
    <span class="ct-mask">${maskImg(mask)}</span>
    <span class="ct-ovr">${card.overall}</span>
    <span class="ct-tier">${esc(card.tier)}</span>
  </button>`;
}

// A mask picture. If the file isn't there yet, the empty frame shows instead of a broken image.
export const maskImg = (m, cls = '') => `<img class="mask-img${cls ? ` ${cls}` : ''}" src="${esc(maskSrc(m.id))}" alt="" onerror="this.hidden=true">`;

// "Splits · Split · 3 cushions" on Today, with a dot when Dad has one to watch.
export function splitsLineHtml(st) {
  const what = st.top ? 'done' : st.waiting ? 'ready for Dad' : st.r.name;
  return `<button class="mini-tile splits-line${st.waiting ? ' waiting' : ''}" data-act="splits">
    <span class="mt-label">Splits</span><b>${esc(what)}</b></button>`;
}

export function lightsLineHtml(lights) {
  const { best } = lightsStats(lights);
  return `<button class="mini-tile" data-act="lights"><span class="mt-label">Lights${best === null ? '' : ' · best'}</span><b>${best === null ? 'No score yet' : `${best} ms`}</b></button>`;
}

function lastSession(save) {
  for (let i = save.log.length - 1; i >= 0; i--) {
    const e = save.log[i];
    if (counts(e) && SESSIONS[e.type]) {
      const d = new Date(e.date);
      const days = Math.round((new Date(dayKey(new Date())) - new Date(dayKey(d))) / 86400000);
      const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : d.toLocaleDateString('en-CA', { weekday: 'long' });
      return `${SESSIONS[e.type].name}, ${when}`;
    }
  }
  return null;
}

// ---- The screen ----

export function render(root, app) {
  const s = app.save;
  const now = new Date();
  if (settleSplits(s, now)) app.persist();
  const splits = splitsState(s, now);
  if (!app.room) app.room = now.getHours() < 9 ? 'bedroom' : 'big';
  const doneToday = (doneByDay(s.log)[dayKey(now)] || []).length > 0;
  const last = lastSession(s);
  const card = cardStats(s, now);
  const st = card.streak;
  const masks = maskState(s, now, st.best);

  root.innerHTML = `
  <main class="screen home">
    <header class="home-head">
      ${CREASE_MARK}
      <div><h1>Crease</h1><p class="date">${esc(today())}</p></div>
    </header>
    <div class="home-top">
      ${streakHtml(st)}
      ${cardTileHtml(card, masks.wearing)}
    </div>
    ${doneToday ? `
      <section class="today-done">
        <h2>Done for today.</h2>
        <p>Next session tomorrow.</p>
        <button class="link" data-act="stretch">Do an extra Stretch</button>
      </section>` : `
      <section class="room">
        <h2 class="label">Where are you training?</h2>
        <div class="seg" role="group">
          <button data-act="room" data-arg="bedroom" aria-pressed="${app.room === 'bedroom'}">Bedroom</button>
          <button data-act="room" data-arg="big" aria-pressed="${app.room === 'big'}">Big room</button>
        </div>
        <p class="hint">${esc(ROOM_HINT[app.room] || ROOM_HINT.big)}</p>
      </section>
      <button class="btn btn-go btn-start" data-act="start">Start today's training</button>
      <p class="small center">A few quick questions, then your session.</p>`}
    <div class="mini-tiles">${lightsLineHtml(s.lights)}${splitsLineHtml(splits)}</div>
    ${weekStripHtml(weekStats(s.log, s.days, now, st.savedDays))}
    <footer class="home-foot">
      <span>${last ? `Last: <b>${esc(last)}</b>` : 'No sessions yet'}</span>
      <button class="link" data-act="settings">Settings</button>
    </footer>
  </main>`;

  on(root, {
    room: (r) => { app.room = r; render(root, app); },
    start: () => app.go('checkin', { step: 0, answers: {} }),
    stretch: () => app.go('preview', { type: 'stretch', reason: 'Extra stretching. It doesn\'t count as a session.', extra: true }),
    lights: () => app.go('lights'),
    splits: () => app.go('splits'),
    card: () => app.go('card'),
    settings: () => app.go('settings'),
  });
}
