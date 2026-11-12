// The end of a session, finished or ended. Says why it counted or didn't,
// then the week strip and the season so far.
import { esc, on, minutes } from '../ui.js';
import { byId } from '../../data/exercises.js';
import { weekStats, weekStripHtml, seasonStats, isTest } from './home.js';
import { settleSplits, splitsState } from '../plan/splits.js';

// One line about the splits ladder, when he did today's hold. Nothing when he didn't.
export function splitsDone(st, moved, did) {
  if (!did) return '';
  if (moved) return `Splits: next rung. ${st.r.name}.`;
  if (st.waiting) return 'Splits: ready for Dad to watch.';
  if (st.top) return 'Splits: you can do the splits.';
  return `Splits: ${st.holds} of ${st.need} holds on ${st.r.name}.`;
}

const WHY = { hard: 'too hard', here: 'couldn\'t do it here' };

// The title and the line under it. Pure, so tests.mjs can check every case.
export function doneWords(log, { test = false } = {}) {
  const ended = log.stopped?.why === 'ended';
  const planned = log.planned;
  if (test || isTest(log)) {
    return { title: log.completed && !ended ? 'Done.' : 'Ended.', line: 'Test run. Nothing saved.' };
  }
  if (log.extra) return { title: 'Done.', line: 'Extra. It doesn\'t count as a session.' };
  if (log.completed) {
    return { title: 'Done.', line: ended && log.reached ? `Ended at drill ${log.reached} of ${planned}.` : '' };
  }
  const need = log.need || Math.ceil(planned / 2);
  const line = log.short === 'main' ? 'Do half the main drills and it counts.' : `Do ${need} of ${planned} drills and it counts.`;
  return { title: ended ? 'Ended early.' : 'Too many skips.', line };
}

export function render(root, app, { session, log, test = false }) {
  const isTestRun = test || isTest(log);
  const { title, line } = doneWords(log, { test: isTestRun });
  const s = app.save;
  const season = seasonStats(s.log);
  // The hold is already in his record by now, so the ladder settles here.
  const didSplits = !isTestRun && session.items.some((it) => it.block === 'Splits');
  const moved = !isTestRun && settleSplits(s, new Date());
  if (moved) app.persist();
  const splitsLine = splitsDone(splitsState(s), moved, didSplits);

  root.innerHTML = `
  <main class="screen done">
    <p class="kicker">${esc(session.name)}</p>
    <h1>${esc(title)}</h1>
    ${line ? `<p class="lead done-line">${esc(line)}</p>` : ''}
    <dl class="stats stats-2">
      <div><dt>Minutes</dt><dd>${minutes(log.secs)}</dd></div>
      <div><dt>Drills</dt><dd>${log.done.length}<small> of ${log.planned}</small></dd></div>
    </dl>
    ${log.skipped.length ? `<p class="small">Skipped: ${log.skipped.map((k) => `${esc(byId[k.id]?.name || k.id)} (${WHY[k.why] || esc(k.why)})`).join(', ')}.</p>` : ''}
    ${splitsLine ? `<p class="season splits-done">${esc(splitsLine)}</p>` : ''}
    ${isTestRun ? '' : `
      ${weekStripHtml(weekStats(s.log, s.days))}
      <p class="season">Season: <b>${season.sessions}</b> ${season.sessions === 1 ? 'session' : 'sessions'} · <b>${season.mins}</b> min</p>`}
    <button class="btn btn-primary" data-act="home">${isTestRun ? 'Back to Dad' : 'Back to Today'}</button>
  </main>`;
  // A test run only starts from Dad's screen, so it goes straight back there.
  on(root, { home: () => (isTestRun ? app.go('dad', { unlocked: true }) : app.go('home')) });
}
