// The end of a session, finished or stopped.
import { esc, on, minutes, stopRuleHtml } from '../ui.js';
import { spotOf, STOP_RULE } from '../../data/copy.js';
import { byId } from '../../data/exercises.js';
import { counts } from '../plan/decide.js';

const WHY = { hard: 'too hard', here: 'couldn\'t do it here', hurts: 'it hurt' };

export function render(root, app, { session, log }) {
  const pain = log.stopped?.why === 'pain';
  const zone = pain ? spotOf(log.stopped.zone) : '';
  const title = log.dad && log.extra && !pain ? 'Test run done.'
    : log.extra && !pain ? 'Done.'
    : log.completed ? 'Done.' : pain ? 'Stopped.' : log.stopped ? 'Ended early.' : 'Too many skips.';
  const total = app.save.log.filter(counts).length;

  root.innerHTML = `
  <main class="screen done">
    <p class="kicker">${esc(session.name)}</p>
    <h1>${title}</h1>
    ${pain ? `
      <div class="alert">
        <p><b>Stopped for ${esc(zone)}. That still counts.</b> Go and tell Dad now.</p>
      </div>
      ${stopRuleHtml(STOP_RULE)}` : ''}
    <dl class="stats">
      <div><dt>Minutes</dt><dd>${minutes(log.secs)}</dd></div>
      <div><dt>Drills</dt><dd>${log.done.length}<small> of ${log.planned}</small></dd></div>
      <div><dt>Sessions</dt><dd>${total}</dd></div>
    </dl>
    ${!log.completed && !log.stopped && !log.extra ? '<p>A session counts when you do at least half the drills.</p>' : ''}
    ${log.skipped.length ? `<p class="small">Skipped: ${log.skipped.map((s) => `${esc(byId[s.id]?.name || s.id)} (${WHY[s.why]})`).join(', ')}.</p>` : ''}
    <button class="btn btn-primary" data-act="home">Back to Today</button>
  </main>`;
  on(root, { home: () => app.go('home') });
}
