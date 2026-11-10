// The end of a session, finished, ended or stopped. Says why it counted or didn't,
// then the week strip and the season so far.
import { esc, on, minutes, stopRuleHtml } from '../ui.js';
import { spotOf, STOP_RULE } from '../../data/copy.js';
import { byId } from '../../data/exercises.js';
import { weekStats, weekStripHtml, seasonStats, isTest } from './home.js';

const WHY = { hard: 'too hard', here: 'couldn\'t do it here', hurts: 'it hurt' };

// The title and the line under it. Pure, so tests.mjs can check every case.
export function doneWords(log, { test = false } = {}) {
  const pain = log.stopped?.why === 'pain';
  const ended = log.stopped?.why === 'ended';
  const planned = log.planned;
  if (test || isTest(log)) {
    return { title: log.completed && !ended ? 'Done.' : pain ? 'Stopped.' : 'Ended.', line: 'Test run. Nothing saved.' };
  }
  if (pain) return { title: 'Stopped.', line: '' };
  // He skipped a drill because it hurt: say so, the same way a pain stop does, because Today locks next.
  const hurt = (log.skipped || []).find((x) => x.zone);
  const tell = hurt ? `You skipped a drill for ${spotOf(hurt.zone)}. Go and tell Dad now.` : '';
  const plus = (line) => [line, tell].filter(Boolean).join(' ');
  if (log.extra) return { title: 'Done.', line: plus('Extra. It doesn\'t count as a session.') };
  if (log.completed) {
    return { title: 'Done.', line: plus(ended && log.reached ? `Ended at drill ${log.reached} of ${planned}.` : '') };
  }
  const need = log.need || Math.ceil(planned / 2);
  const line = log.short === 'main' ? 'Do half the main drills and it counts.' : `Do ${need} of ${planned} drills and it counts.`;
  return { title: ended ? 'Ended early.' : 'Too many skips.', line: plus(line) };
}

export function render(root, app, { session, log, test = false }) {
  const isTestRun = test || isTest(log);
  const pain = log.stopped?.why === 'pain';
  const { title, line } = doneWords(log, { test: isTestRun });
  const s = app.save;
  const season = seasonStats(s.log);

  root.innerHTML = `
  <main class="screen done">
    <p class="kicker">${esc(session.name)}</p>
    <h1>${esc(title)}</h1>
    ${line ? `<p class="lead done-line">${esc(line)}</p>` : ''}
    ${pain ? `
      <div class="alert">
        <p><b>Stopped for ${esc(spotOf(log.stopped.zone))}.${isTestRun ? '' : ' That still counts.'}</b>${isTestRun ? '' : ' Go and tell Dad now.'}</p>
      </div>
      ${isTestRun ? '' : stopRuleHtml(STOP_RULE)}` : ''}
    <dl class="stats stats-2">
      <div><dt>Minutes</dt><dd>${minutes(log.secs)}</dd></div>
      <div><dt>Drills</dt><dd>${log.done.length}<small> of ${log.planned}</small></dd></div>
    </dl>
    ${log.skipped.length ? `<p class="small">Skipped: ${log.skipped.map((k) => `${esc(byId[k.id]?.name || k.id)} (${WHY[k.why] || esc(k.why)})`).join(', ')}.</p>` : ''}
    ${isTestRun ? '' : `
      ${weekStripHtml(weekStats(s.log, s.days))}
      <p class="season">Season: <b>${season.sessions}</b> ${season.sessions === 1 ? 'session' : 'sessions'} · <b>${season.mins}</b> min</p>`}
    <button class="btn btn-primary" data-act="home">${isTestRun ? 'Back to Dad' : 'Back to Today'}</button>
  </main>`;
  // A test run only starts from Dad's screen, so it goes straight back there.
  on(root, { home: () => (isTestRun ? app.go('dad', { unlocked: true }) : app.go('home')) });
}
