// Today: one Start button. The check-in that follows decides the session; he never picks it.
// Also here: the pain records Dad's screen reads, and the week strip that Done shows too.
import { esc, on, CREASE_MARK, today } from '../ui.js';
import { SESSIONS } from '../../data/sessions.js';
import { ROOM_HINT, spotOf, zoneWord } from '../../data/copy.js';
import { doneByDay, dayKey, counts } from '../plan/decide.js';
import { splitsState, settleSplits } from '../plan/splits.js';
import { lightsStats } from './lights.js';

// ---- His record (pure: tests.mjs runs these in Node) ----

// Dad's test runs. New ones never reach save.log; older saves may still hold some.
export const isTest = (e) => !!(e.test || (e.dad && e.extra));

// The spots a log entry reports as hurting: a pain stop, "hurts" before training, an "It hurts" skip.
export function painZones(e) {
  if (!e || isTest(e)) return [];
  const z = [];
  if (e.stopped && (e.stopped.why === 'pain' || e.stopped.why === 'hurt-before')) z.push(e.stopped.zone || 'other');
  for (const sk of e.skipped || []) if (sk.zone) z.push(sk.zone);
  return z;
}
export const isPain = (e) => painZones(e).length > 0;

// Anything that hurt today and Dad hasn't cleared locks Today, the same as a "hurts" check-in.
export const hurtToday = (log, now = new Date()) =>
  log.filter((e) => isPain(e) && !e.cleared && dayKey(new Date(e.date)) === dayKey(now));

// The newest pain report Dad hasn't marked Seen. It stays on Today until he does.
export function unseenPain(log) {
  for (let i = log.length - 1; i >= 0; i--) if (isPain(log[i]) && !log[i].dadSeen) return log[i];
  return null;
}

const dayAt = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => dayAt(d, -((d.getDay() + 6) % 7));
export const FULL_WEEK = 4;

// Monday to Sunday: a box for each day with a counted session, G or P on hockey days.
// Missed days stay blank. Full weeks (4 or more) in a row, and the best run.
export function weekStats(log, days = {}, now = new Date()) {
  const by = doneByDay(log);
  const mon = mondayOf(now);
  const todayKey = dayKey(now);
  const boxes = [];
  for (let i = 0; i < 7; i++) {
    const d = dayAt(mon, i);
    const k = dayKey(d);
    const ice = days[k]?.today || days[dayKey(dayAt(d, -1))]?.tomorrow || null;
    boxes.push({
      key: k,
      letter: 'MTWTFSS'[i],
      name: d.toLocaleDateString('en-CA', { weekday: 'long' }),
      filled: !!by[k]?.length,
      mark: ice === 'game' ? 'G' : ice === 'practice' ? 'P' : '',
      today: k === todayKey,
      future: k > todayKey,
    });
  }
  const count = boxes.filter((b) => b.filled).length;
  let run = 0;
  let best = 0;
  const keys = Object.keys(by).sort();
  if (keys.length) {
    const [y, m, dd] = keys[0].split('-').map(Number);
    for (let w = mondayOf(new Date(y, m - 1, dd)); w <= mon; w = dayAt(w, 7)) {
      let n = 0;
      for (let i = 0; i < 7; i++) if (by[dayKey(dayAt(w, i))]?.length) n++;
      if (n >= FULL_WEEK) best = Math.max(best, ++run);
      else if (dayKey(w) !== dayKey(mon)) run = 0; // this week isn't over yet, so it can't break the run
    }
  }
  return { boxes, count, full: count >= FULL_WEEK, inARow: run, best };
}

// The season starts on 1 September.
export function seasonStats(log, now = new Date()) {
  const from = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1).getTime();
  const es = log.filter((e) => counts(e) && Date.parse(e.date) >= from);
  return { sessions: es.length, mins: Math.round(es.reduce((n, e) => n + (e.secs || 0), 0) / 60) };
}

export function weekStripHtml(w) {
  const days = w.boxes.map((b) => {
    const cls = ['wk-day', b.filled && 'filled', b.today && 'today', b.future && 'future'].filter(Boolean).join(' ');
    const label = `${b.name}: ${b.filled ? 'session done' : 'no session'}${b.mark === 'G' ? ', game' : b.mark === 'P' ? ', practice' : ''}`;
    return `<li class="${cls}" aria-label="${esc(label)}"><span class="wk-box">${b.mark}</span><span class="wk-letter">${b.letter}</span></li>`;
  }).join('');
  return `
  <section class="week${w.full ? ' full' : ''}">
    <div class="wk-head">
      <span class="wk-count">This week: <b>${w.count}</b></span>
      ${w.full ? '<span class="wk-full">Full week.</span>' : ''}
    </div>
    <ol class="wk-days">${days}</ol>
    ${w.full ? `<p class="wk-run">Full weeks in a row: <b>${w.inARow}</b> · Best: <b>${w.best}</b></p>` : ''}
  </section>`;
}

// "Splits · Split · 3 cushions" on Today, with a dot when Dad has one to watch.
export function splitsLineHtml(st) {
  const what = st.pause ? 'resting' : st.top ? 'done' : st.waiting ? 'ready for Dad' : st.r.name;
  return `<button class="lights-line splits-line${st.waiting ? ' waiting' : ''}" data-act="splits">
    <span class="ll-dot" aria-hidden="true"></span><span>Splits · <b>${esc(what)}</b></span></button>`;
}

export function lightsLineHtml(lights) {
  const { best } = lightsStats(lights);
  return `<button class="lights-line" data-act="lights"><span class="ll-dot" aria-hidden="true"></span><span>Lights · ${best === null ? 'no score yet' : `best <b>${best} ms</b>`}</span></button>`;
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
  const hurts = hurtToday(s.log, now);
  const lockZone = hurts.length ? painZones(hurts[hurts.length - 1]).pop() : null;
  const notice = hurts.length ? null : unseenPain(s.log);
  const noticeZone = notice ? painZones(notice).pop() : null;
  const doneToday = (doneByDay(s.log)[dayKey(now)] || []).length > 0;
  const last = lastSession(s);

  root.innerHTML = `
  <main class="screen home">
    <header class="home-head">
      ${CREASE_MARK}
      <div><h1>Crease</h1><p class="date">${esc(today())}</p></div>
    </header>
    ${notice ? `
      <div class="alert" role="status">
        <p>Last time it hurt: ${esc(zoneWord(noticeZone))}. Still hurts? Tell Dad before you train.</p>
      </div>` : ''}
    ${hurts.length ? `
      <section class="today-done locked">
        <h2>No training today.</h2>
        <p>${lockZone && lockZone !== 'other' ? `You said ${esc(spotOf(lockZone))} hurts.` : 'You said something hurts.'} Show Dad, and train again once he's had a look.</p>
      </section>` : doneToday ? `
      <section class="today-done">
        <h2>Done for today.</h2>
        <p>Next session tomorrow.</p>
        <button class="link" data-act="stretch">Loosen up with Stretch anyway</button>
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
    ${lightsLineHtml(s.lights)}
    ${splitsLineHtml(splits)}
    ${weekStripHtml(weekStats(s.log, s.days, now))}
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
    settings: () => app.go('settings'),
  });
}
