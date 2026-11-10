// Before a session: the check-in that decides it, then the preview with Start.
import { esc, on, minutes, stopRuleHtml } from '../ui.js';
import { STOP_RULE, PAIN_ZONES, spotOf } from '../../data/copy.js';
import { buildSession, makeContext, phrasesOf } from '../plan/build.js';
import { decide, reasonText, knownYesterdayGame, dayKey } from '../plan/decide.js';
import * as audio from '../timer/audio.js';
import { keepAwake } from '../timer/wakelock.js';

const HOCKEY = [
  { id: 'game', label: 'A game' },
  { id: 'practice', label: 'Practice or clinic' },
  { id: 'none', label: 'No hockey' },
];

// The questions, in order. Each is asked only when it matters.
const QUESTIONS = [
  { key: 'today', title: 'Any hockey today?', choices: HOCKEY },
  {
    key: 'when', title: 'Before or after the game?', only: (a) => a.today === 'game',
    choices: [{ id: 'before', label: 'Before. The game is later.' }, { id: 'after', label: 'After. I already played.' }],
  },
  { key: 'tomorrow', title: 'Any hockey tomorrow?', only: (a) => !(a.today === 'game' && a.when === 'before'), choices: HOCKEY },
  {
    key: 'yesterdayGame', title: 'Did you have a game yesterday?',
    only: (a, app) => a.today !== 'game' && a.tomorrow !== 'game' && knownYesterdayGame(app.save.log, app.save.days) === undefined,
    choices: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
  },
  { key: 'hurts', title: 'Does anything hurt right now?', choices: [{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }] },
];

export function checkin(root, app, { step = 0, answers = {} }) {
  let i = step;
  while (i < QUESTIONS.length && QUESTIONS[i].only && !QUESTIONS[i].only(answers, app)) i++;
  if (i >= QUESTIONS.length) { finish(root, app, answers); return; }
  const q = QUESTIONS[i];

  root.innerHTML = `
  <main class="screen checkin">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Check-in</p>
    <h1>${esc(q.title)}</h1>
    <div class="choices ${q.choices.length === 2 ? 'row' : ''}">
      ${q.choices.map((c) => `<button class="choice" data-act="pick" data-arg="${c.id}"><span>${esc(c.label)}</span></button>`).join('')}
    </div>
  </main>`;
  on(root, {
    back: () => app.go('home'),
    pick: (id) => {
      const value = q.key === 'yesterdayGame' ? id === 'yes' : q.key === 'hurts' ? id === 'yes' : id;
      app.go('checkin', { step: i + 1, answers: { ...answers, [q.key]: value } });
    },
  });
}

function finish(root, app, answers) {
  const s = app.save;
  if (answers.hurts) { whereItHurts(root, app); return; }
  if (answers.today) {
    s.days[dayKey(new Date())] = { today: answers.today, tomorrow: answers.tomorrow ?? null };
    app.persist();
  }
  const d = decide(answers, s.log, s.days);
  if (!d.type) { app.go('home'); return; }
  app.go('preview', { type: d.type, reason: reasonText(d) });
}

function whereItHurts(root, app) {
  root.innerHTML = `
  <main class="screen hurts">
    <p class="kicker">Check-in</p>
    <h1>Where does it hurt?</h1>
    <div class="zones">${PAIN_ZONES.map((z) => `<button class="choice" data-act="zone" data-arg="${z.id}"><span>${esc(z.label)}</span></button>`).join('')}</div>
  </main>`;
  on(root, {
    zone: (zone) => {
      app.save.log.push({ date: new Date().toISOString(), type: null, completed: false, done: [], skipped: [], stopped: { why: 'hurt-before', zone } });
      app.persist();
      root.innerHTML = `
      <main class="screen message">
        <h1>No training today.</h1>
        <p class="lead">Show Dad ${esc(zone === 'other' ? 'where it hurts' : spotOf(zone))} and tell him how it feels. Train again once he's had a look.</p>
        ${stopRuleHtml(STOP_RULE)}
        <button class="btn btn-primary" data-act="home">Back to Today</button>
      </main>`;
      on(root, { home: () => app.go('home') });
    },
  });
}

export function preview(root, app, { type, reason = '', extra = false, dad = false }) {
  const s = app.save;
  const ctx = makeContext({ room: app.room || 'big', ball: s.settings.ball, band: s.settings.band, versions: s.versions });
  const session = buildSession(type, ctx);
  const notes = [];
  if (ctx.small) notes.push('Bedroom: quiet versions.');
  else if (ctx.quiet) notes.push('Before 9 am: quiet versions.');

  let lastBlock = null;
  const rows = session.items.map((it, k) => {
    const head = it.block !== lastBlock ? `<li class="block-name">${esc(it.block)}</li>` : '';
    lastBlock = it.block;
    const sets = it.circuit ? `${it.sets} rounds` : it.sets > 1 ? `${it.sets} sets` : '';
    const detail = [it.target, sets].filter(Boolean).join(' · ');
    const extra = it.how || it.note;
    return `${head}<li><button class="drill-row" data-act="drill" data-arg="${k}">
      <img src="${esc(it.draw)}" alt="" loading="lazy">
      <span class="dr-text"><span class="dr-name">${esc(it.name)}</span><span class="dr-detail">${esc(detail)}</span>${extra ? `<span class="dr-how">${esc(extra)}</span>` : ''}</span>
    </button></li>`;
  }).join('');

  root.innerHTML = `
  <main class="screen preview">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Today · ${minutes(session.total)} min · ${session.drills} drills</p>
    <h1>${esc(session.name)}</h1>
    ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
    ${notes.length ? `<p class="hint">${esc(notes.join(' '))}</p>` : ''}
    <p class="small">Tap a drill to see how it's done.</p>
    <ul class="drill-list">${rows}</ul>
    ${stopRuleHtml(STOP_RULE)}
    <p class="small">Lean the phone against the wall, low down, screen facing you.</p>
    <div class="start-bar"><button class="btn btn-go" data-act="start">Start</button></div>
  </main>`;

  on(root, {
    back: () => app.go('home'),
    drill: (k) => app.go('drill', { item: session.items[+k], back: ['preview', { type, reason, extra, dad }] }),
    start: async (arg, btn) => {
      btn.disabled = true;
      btn.textContent = 'Loading';
      audio.unlock();
      keepAwake();
      await audio.preload(phrasesOf(session));
      app.go('player', { session, extra, dad });
    },
  });
}
