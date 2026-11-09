// Today: where he's training and the three sessions.
import { esc, on, CREASE_MARK, minutes, today } from '../ui.js';
import { SESSIONS, SESSION_ORDER } from '../../data/sessions.js';
import { spotOf } from '../../data/copy.js';
import { buildSession, makeContext } from '../plan/build.js';

// A pain stop or a "hurts" skip in the last 36 hours that he hasn't dismissed.
function painAlert(save) {
  const cutoff = Date.now() - 36 * 3600 * 1000;
  for (let i = save.log.length - 1; i >= 0; i--) {
    const e = save.log[i];
    if (Date.parse(e.date) < cutoff) break;
    if (save.seenAlerts.includes(e.date)) continue;
    const zone = e.stopped?.zone || e.skipped.find((s) => s.zone)?.zone;
    if (zone) return { key: e.date, zone };
  }
  return null;
}

export function render(root, app) {
  const s = app.save;
  const hour = new Date().getHours();
  if (!app.room) app.room = hour < 9 ? 'bedroom' : 'big';
  const ctx = makeContext({ room: app.room, hour, ball: s.settings.ball, band: s.settings.band });
  const alert = painAlert(s);
  const doneCount = s.log.filter((e) => e.completed || e.stopped?.why === 'pain').length;

  const tiles = SESSION_ORDER.map((type) => {
    const b = buildSession(type, ctx);
    return `
      <button class="tile" data-act="pick" data-arg="${type}">
        <span class="t-top"><span class="t-name">${esc(SESSIONS[type].name)}</span><span class="t-min">${minutes(b.total)}<small> min</small></span></span>
        <span class="t-blurb">${esc(SESSIONS[type].blurb)}</span>
        <span class="t-count">${b.drills} drills</span>
      </button>`;
  }).join('');

  root.innerHTML = `
  <main class="screen home">
    <header class="home-head">
      ${CREASE_MARK}
      <div><h1>Crease</h1><p class="date">${esc(today())}</p></div>
    </header>
    ${alert ? `
      <div class="alert" role="status">
        <p>You stopped for ${esc(spotOf(alert.zone))}. If it still hurts, tell Dad before you train.</p>
        <button class="btn btn-small" data-act="seen" data-arg="${esc(alert.key)}">OK</button>
      </div>` : ''}
    <section class="room">
      <h2 class="label">Where are you training?</h2>
      <div class="seg" role="group">
        <button data-act="room" data-arg="bedroom" aria-pressed="${app.room === 'bedroom'}">Bedroom</button>
        <button data-act="room" data-arg="big" aria-pressed="${app.room === 'big'}">Big room</button>
      </div>
      <p class="hint">${ctx.quiet ? (ctx.small ? 'Quiet versions. Nothing that thumps or needs space.' : 'Before 9 am: quiet versions, so the house can sleep.') : 'Full versions. Clear about 3 metres around you.'}</p>
    </section>
    <section class="tiles">${tiles}</section>
    <footer class="home-foot">
      <span>Sessions done: <b>${doneCount}</b></span>
      <button class="link" data-act="settings">Settings</button>
    </footer>
  </main>`;

  on(root, {
    room: (r) => { app.room = r; render(root, app); },
    pick: (type) => app.go('feel', { type }),
    seen: (key) => { s.seenAlerts.push(key); app.persist(); render(root, app); },
    settings: () => app.go('settings'),
  });
}
