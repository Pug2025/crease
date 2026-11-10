// Today: one Start button. The check-in that follows decides the session; he never picks it.
import { esc, on, CREASE_MARK, today } from '../ui.js';
import { SESSIONS } from '../../data/sessions.js';
import { PAIN_ZONES } from '../../data/copy.js';
import { doneByDay, dayKey, counts } from '../plan/decide.js';

const zoneLabel = (id) => (PAIN_ZONES.find((z) => z.id === id)?.label || 'somewhere').toLowerCase();

// A pain stop, a "hurts" skip or a "something hurts" check-in in the last 36 hours, not yet dismissed.
function painAlert(save) {
  const cutoff = Date.now() - 36 * 3600 * 1000;
  for (let i = save.log.length - 1; i >= 0; i--) {
    const e = save.log[i];
    if (Date.parse(e.date) < cutoff) break;
    if (save.seenAlerts.includes(e.date)) continue;
    const zone = e.stopped?.zone || e.skipped?.find((s) => s.zone)?.zone;
    if (zone) return { key: e.date, zone };
  }
  return null;
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

export function render(root, app) {
  const s = app.save;
  const hour = new Date().getHours();
  if (!app.room) app.room = hour < 9 ? 'bedroom' : 'big';
  const alert = painAlert(s);
  const doneToday = (doneByDay(s.log)[dayKey(new Date())] || []).length > 0;
  // Once he says something hurts, today stays locked. Dad's screen can still start a session.
  const hurtToday = s.log.some((e) => e.stopped?.why === 'hurt-before' && dayKey(new Date(e.date)) === dayKey(new Date()));
  const doneCount = s.log.filter(counts).length;
  const last = lastSession(s);
  const quiet = app.room === 'bedroom' || hour < 9;

  root.innerHTML = `
  <main class="screen home">
    <header class="home-head">
      ${CREASE_MARK}
      <div><h1>Crease</h1><p class="date">${esc(today())}</p></div>
    </header>
    ${alert ? `
      <div class="alert" role="status">
        <p>Sore spot last time: ${esc(zoneLabel(alert.zone))}. If it still hurts, tell Dad before you train.</p>
        <button class="btn btn-small" data-act="seen" data-arg="${esc(alert.key)}">OK</button>
      </div>` : ''}
    ${hurtToday ? `
      <section class="today-done">
        <h2>No training today.</h2>
        <p>You said something hurts. Show Dad, and train again once he's had a look.</p>
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
        <p class="hint">${quiet ? (app.room === 'bedroom' ? 'Quiet versions. Nothing that thumps or needs space.' : 'Before 9 am: quiet versions, so the house can sleep.') : 'Full versions. Clear about 3 metres around you.'}</p>
      </section>
      <button class="btn btn-go btn-start" data-act="start">Start today's training</button>
      <p class="small center">A few quick questions, then your session.</p>`}
    <footer class="home-foot">
      <span>${last ? `Last: <b>${esc(last)}</b>` : 'No sessions yet'}<br>Sessions done: <b>${doneCount}</b></span>
      <button class="link" data-act="settings">Settings</button>
    </footer>
  </main>`;

  on(root, {
    room: (r) => { app.room = r; render(root, app); },
    start: () => app.go('checkin', { step: 0, answers: {} }),
    stretch: () => app.go('preview', { type: 'stretch', reason: 'Extra stretching. It doesn\'t count as a session.', extra: true }),
    seen: (key) => { s.seenAlerts.push(key); app.persist(); render(root, app); },
    settings: () => app.go('settings'),
  });
}
