// The end of a session, finished or ended. Says why it counted or didn't,
// then the payoff (streak, card, mask, save), the week strip and the season so far.
import { esc, on, minutes, stepper } from '../ui.js';
import { byId } from '../../data/exercises.js';
import { SAY } from '../../data/copy.js';
import { weekStats, weekStripHtml, seasonStats, isTest, maskImg } from './home.js';
import { settleSplits, splitsState } from '../plan/splits.js';
import { countsForStreak } from '../plan/streak.js';
import { cardStats, cardGains, pendingMasks, claimMasks } from '../plan/card.js';
import { addRecord, bestFor, recordTitle, RECORD_MAX, RECORD_START } from '../plan/records.js';
import * as audio from '../timer/audio.js';
import { celebrate } from '../celebrate.js';

// What this one session changed: the card before it and after it. Pure, so tests.mjs checks it.
// Only a counted session pays off, and a second one on the same day doesn't raise the streak again.
// claimed: the masks claimMasks just added for this session. Left out, it is the masks this
// session newly met, so tests can check it without changing the save.
export function payoff(save, log, now = new Date(), { test = false, claimed = null } = {}) {
  const none = { streak: null, ratings: [], overall: null, tier: null, boss: false, masks: [], saveEarned: false, milestone: null, say: [] };
  if (test || isTest(log) || !countsForStreak(log) || !save.log.includes(log)) return none;
  // Judged on the day the session started, so one that runs past midnight still gets its milestone and save.
  const started = new Date(log.date);
  const at = Number.isNaN(started.getTime()) ? now : started;
  const without = { ...save, log: save.log.filter((e) => e !== log) };
  const before = cardStats(without, at);
  const after = cardStats(save, at);
  const g = cardGains(before, after);
  const rose = after.streak.days > before.streak.days;
  const masks = claimed ?? (() => {
    const had = new Set(pendingMasks(without, at).map((m) => m.id));
    return pendingMasks(save, at).filter((m) => !had.has(m.id));
  })();
  const milestone = rose ? after.streak.milestone : null;
  const say = [];
  if (milestone && SAY.milestone[milestone]) say.push(SAY.milestone[milestone]);
  if (masks.length) say.push(SAY.newMask);
  return {
    streak: rose ? { from: before.streak.days, to: after.streak.days } : null,
    ratings: g.ratings,
    overall: g.overall,
    tier: g.tier,
    boss: !!log.boss,
    masks,
    saveEarned: rose && after.streak.saveEarned,
    milestone,
    say,
  };
}

// The payoff lines, in order, only the ones that apply.
export function payoffLines(p) {
  const lines = [];
  if (p.streak) lines.push({ kind: 'streak', text: `${p.streak.to} day streak`, from: p.streak.from, to: p.streak.to });
  for (const r of p.ratings) lines.push({ kind: 'rating', text: `${r.label} ${r.from} → ${r.to}`, ...r });
  if (p.overall) lines.push({ kind: 'rating', text: `Overall ${p.overall.from} → ${p.overall.to}`, label: 'Overall', ...p.overall, overall: true });
  if (p.tier) lines.push({ kind: 'tier', text: `Your card is now ${p.tier}.` });
  if (p.boss) lines.push({ kind: 'boss', text: 'You beat the Boss day.' });
  for (const m of p.masks) lines.push({ kind: 'mask', text: `New mask: ${m.name}!`, mask: m });
  if (p.saveEarned) lines.push({ kind: 'save', text: 'You earned a save.' });
  return lines;
}

// Each line comes in a beat after the one before. Everything is in place by about 2 seconds.
function payoffHtml(lines, wearing) {
  if (!lines.length) return '';
  const step = Math.min(0.3, 1.4 / lines.length);
  return `<section class="payoff">${lines.map((l, i) => {
    const d = `style="--d:${(i * step).toFixed(2)}s"`;
    if (l.kind === 'streak') {
      return `<p class="po po-streak" ${d} aria-label="${esc(l.text)}"><b class="po-count" style="--from:${l.from};--to:${l.to}" aria-hidden="true"></b><span aria-hidden="true">day streak</span></p>`;
    }
    if (l.kind === 'rating') {
      return `<p class="po po-rating${l.overall ? ' po-overall' : ''}" ${d}><span>${esc(l.label)}</span> <span class="po-from">${l.from}</span> <span aria-hidden="true">→</span><span class="sr"> to </span> <b class="po-to">${l.to}</b></p>`;
    }
    if (l.kind === 'mask') {
      const worn = wearing === l.mask.id;
      return `<div class="po po-mask" ${d}>
        <span class="po-maskpic">${maskImg(l.mask)}</span>
        <div><p class="po-big">${esc(l.text)}</p>
        ${worn ? '<p class="small">Wearing it.</p>' : `<button class="btn po-wear" data-act="wear" data-arg="${l.mask.id}">Wear it</button>`}</div></div>`;
    }
    return `<p class="po po-${l.kind}" ${d}>${esc(l.text)}</p>`;
  }).join('')}</section>`;
}

// One line about the splits ladder, when he did today's hold. Nothing when he didn't.
export function splitsDone(st, moved, did) {
  if (!did) return '';
  if (moved) return `Splits: you moved up to ${st.r.name}.`;
  if (st.waiting) return 'Splits: you\'re ready for Dad to watch.';
  if (st.top) return 'Splits: you can do the splits.';
  return `Splits: ${st.holds} of ${st.need} holds done on ${st.r.name}.`;
}

const WHY = { hard: 'too hard', here: 'couldn\'t do it here' };

// The finisher card: asked only when he did the finisher in a session that is in his record,
// and only until he saves a number. Pure. start: where the stepper starts (what the camera
// counted, else his best, else 10). cam: the camera's count, or null when it counted nothing.
export function recordAsk(save, log, { test = false } = {}) {
  const f = log?.finisher;
  if (test || isTest(log) || !f?.did || f.n !== undefined || !save.log.includes(log)) return null;
  const best = bestFor(save.records, f.id, f.v);
  const cam = Number.isInteger(f.cam) && f.cam > 0 ? Math.min(RECORD_MAX, f.cam) : null;
  return { id: f.id, v: f.v, title: recordTitle(f.id, f.v), best: best ? best.n : null, start: cam ?? (best ? best.n : RECORD_START), cam };
}

// The line on the finisher card when the camera counted.
export const camWords = (ask) => (ask?.cam ? `The camera counted ${ask.cam}. Change it if that's wrong.` : '');

function recordHtml(ask) {
  if (!ask) return '';
  return `
  <section class="rec" aria-label="Finisher">
    <h2 class="rec-title">${esc(ask.title)}</h2>
    <p class="rec-best">${ask.best === null ? 'No best yet' : `Your best: ${ask.best}`}</p>
    ${ask.cam ? `<p class="rec-cam">${esc(camWords(ask))}</p>` : ''}
    <div class="rec-step">
      <button class="rec-btn" data-step="-1" aria-label="One less">−</button>
      <output class="rec-n" aria-live="polite">${ask.start}</output>
      <button class="rec-btn" data-step="1" aria-label="One more">+</button>
    </div>
    <button class="btn btn-primary" data-act="saveRec">Save</button>
  </section>`;
}


// The title and the line under it. Pure, so tests.mjs can check every case.
export function doneWords(log, { test = false } = {}) {
  const ended = log.stopped?.why === 'ended';
  const planned = log.planned;
  if (test || isTest(log)) {
    return { title: log.completed && !ended ? 'Done.' : 'Ended.', line: 'Test run. Nothing saved.' };
  }
  if (log.extra) return { title: 'Done.', line: 'This was extra, so it doesn\'t count as a session.' };
  if (log.completed) {
    return { title: 'Done.', line: ended && log.reached ? `Ended at drill ${log.reached} of ${planned}.` : '' };
  }
  const need = log.need || Math.ceil(planned / 2);
  const line = log.short === 'main' ? 'A session counts once you do half of the main drills.' : `A session counts once you do ${need} of its ${planned} drills.`;
  return { title: ended ? 'Ended early.' : 'Too many skips.', line };
}

export function render(root, app, { session, log, test = false }) {
  const isTestRun = test || isTest(log);
  const { title, line } = doneWords(log, { test: isTestRun });
  const s = app.save;
  const season = seasonStats(s.log);
  // The hold is already in his record by now, so the ladder settles here.
  const didSplits = !isTestRun && session.items.some((it) => it.block === 'Splits' && (log.done || []).includes(it.drill?.id));
  const moved = !isTestRun && settleSplits(s, new Date());
  if (moved) app.persist();
  const splitsLine = splitsDone(splitsState(s), moved, didSplits);
  const now = new Date();
  // A counted session claims every mask he has newly met, so each "New mask" shows once.
  const counted = !isTestRun && countsForStreak(log) && s.log.includes(log);
  const claimed = counted ? claimMasks(s, now) : [];
  if (claimed.length) app.persist();
  const p = payoff(s, log, now, { test: isTestRun, claimed });
  const lines = payoffLines(p);
  const st = cardStats(s, now).streak;
  const ask = recordAsk(s, log, { test: isTestRun });
  let count = ask ? ask.start : 0;

  root.innerHTML = `
  <main class="screen done">
    <p class="kicker">${esc(session.name)}</p>
    <h1>${esc(title)}</h1>
    ${line ? `<p class="lead done-line">${esc(line)}</p>` : ''}
    ${payoffHtml(lines, s.card?.mask)}
    ${recordHtml(ask)}
    <dl class="stats stats-2">
      <div><dt>Minutes</dt><dd>${minutes(log.secs)}</dd></div>
      <div><dt>Drills</dt><dd>${log.done.length}<small> of ${log.planned}</small></dd></div>
    </dl>
    ${log.skipped.length ? `<p class="small">Skipped: ${log.skipped.map((k) => `${esc(byId[k.id]?.name || k.id)} (${WHY[k.why] || esc(k.why)})`).join(', ')}.</p>` : ''}
    ${splitsLine ? `<p class="season splits-done">${esc(splitsLine)}</p>` : ''}
    ${isTestRun ? '' : `
      ${weekStripHtml(weekStats(s.log, s.days, now, st.savedDays))}
      <p class="season">Season: <b>${season.sessions}</b> ${season.sessions === 1 ? 'session' : 'sessions'} · <b>${season.mins}</b> min</p>`}
    <button class="btn btn-primary" data-act="home">${isTestRun ? 'Back to Dad' : 'Back to Today'}</button>
  </main>`;
  // A test run only starts from Dad's screen, so it goes straight back there.
  // The coach says the milestone after "That's the session." Nothing plays without a recorded clip.
  if (p.say.length) audio.preload(p.say).then(() => audio.say(p.say)).catch(() => {});
  const rec = root.querySelector('.rec');
  const stopStep = rec ? stepper(rec, () => count, (n) => {
    count = Math.min(RECORD_MAX, Math.max(0, n));
    rec.querySelector('.rec-n').textContent = String(count);
  }) : () => {};
  // Confetti for a mask, a new tier or a Boss, after the payoff lines have come in.
  if (lines.some((l) => ['mask', 'tier', 'boss'].includes(l.kind))) setTimeout(() => celebrate({ big: true }), 900);
  on(root, {
    // Saved once. The card then says how it compares; skipping it just leaves it unsaved.
    saveRec: () => {
      stopStep();
      const r = addRecord(s, { id: ask.id, v: ask.v, n: count, ...(ask.cam ? { cam: ask.cam } : {}) }, new Date());
      log.finisher = { ...log.finisher, n: r.n };
      app.persist();
      rec.classList.toggle('rec-new', r.best);
      if (r.best || r.challengeBeaten) celebrate({ big: !!r.challengeBeaten });
      rec.innerHTML = `<h2 class="rec-title">${esc(ask.title)}</h2>
        <p class="rec-result">${esc(r.words)}</p>
        ${r.challengeBeaten ? '<p class="rec-chal">You beat Dad\'s challenge.</p>' : ''}`;
    },
    home: () => (isTestRun ? app.go('dad', { unlocked: true }) : app.go('home')),
    wear: (id, el) => {
      s.card = { ...(s.card || {}), mask: id };
      app.persist();
      const box = el.closest('.po-mask');
      el.outerHTML = '<p class="small">Wearing it.</p>';
      box?.classList.add('worn');
    },
  });
  return stopStep;
}
