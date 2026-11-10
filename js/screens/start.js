// Before a session: the check-in that decides it, then the preview with Start.
import { esc, on, minutes, stopRuleHtml } from '../ui.js';
// A namespace import, so a line copy.js doesn't have yet falls back instead of breaking the module.
import * as COPY from '../../data/copy.js';
import { SESSIONS } from '../../data/sessions.js';
import { byId } from '../../data/exercises.js';
import { buildSession, makeContext, phrasesOf } from '../plan/build.js';
import { settle, knownYesterdayGame, dayKey, painText, answersText, grabText } from '../plan/decide.js';
import * as audio from '../timer/audio.js';
import { keepAwake } from '../timer/wakelock.js';

const HOCKEY = [
  { id: 'game', label: 'A game' },
  { id: 'practice', label: 'Practice or clinic' },
  { id: 'none', label: 'No hockey' },
];
// No on the left on both yes/no questions.
const NO_YES = [{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }];

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
    choices: NO_YES,
  },
  {
    key: 'hurts', title: 'Does anything hurt right now?',
    note: COPY.HURT_QUESTION_NOTE ?? 'Sore muscles are normal. Tap Yes for sharp pain, or pain in a joint, below the kneecap or in your heel.',
    choices: NO_YES,
  },
];

// trail: the questions already answered, so Back goes to the one before and a mis-tap is never saved.
export function checkin(root, app, { step = 0, answers = {}, trail = [] }) {
  let i = step;
  while (i < QUESTIONS.length && QUESTIONS[i].only && !QUESTIONS[i].only(answers, app)) i++;
  if (i >= QUESTIONS.length) { finish(root, app, answers, trail); return; }
  const q = QUESTIONS[i];

  root.innerHTML = `
  <main class="screen checkin">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Check-in</p>
    <h1>${esc(q.title)}</h1>
    ${q.note ? `<p class="lead">${esc(q.note)}</p>` : ''}
    <div class="choices ${q.choices.length === 2 ? 'row' : ''}">
      ${q.choices.map((c) => `<button class="choice" data-act="pick" data-arg="${c.id}"><span>${esc(c.label)}</span></button>`).join('')}
    </div>
  </main>`;
  on(root, {
    back: () => (trail.length ? app.go('checkin', { ...trail.at(-1), trail: trail.slice(0, -1) }) : app.go('home')),
    pick: (id) => {
      const value = q.key === 'yesterdayGame' || q.key === 'hurts' ? id === 'yes' : id;
      app.go('checkin', { step: i + 1, answers: { ...answers, [q.key]: value }, trail: [...trail, { step: i, answers }] });
    },
  });
}

function finish(root, app, answers, trail) {
  const s = app.save;
  const now = new Date();
  // Today's answers are saved first, even when something hurts. The first check-in of the day
  // sticks: a later one can only make the session easier (settle, contract C5).
  const { d, day } = settle(answers, s.log, s.days, now);
  s.days[dayKey(now)] = day;
  app.persist();
  if (answers.hurts) { whereItHurts(root, app, answers, trail); return; }
  if (!d.type) { app.go('home'); return; }
  app.go('preview', { type: d.type, reason: day.reason, answers: day, avoid: d.avoid, noJumps: d.noJumps, note: painText(d, now) });
}

function whereItHurts(root, app, answers, trail) {
  root.innerHTML = `
  <main class="screen hurts">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Check-in</p>
    <h1>Where does it hurt?</h1>
    <div class="zones">${COPY.PAIN_ZONES.map((z) => `<button class="choice" data-act="zone" data-arg="${z.id}"><span>${esc(z.label)}</span></button>`).join('')}</div>
  </main>`;
  on(root, {
    // Back to "Does anything hurt?". Nothing is logged until he picks a spot.
    back: () => app.go('checkin', { ...trail.at(-1), trail: trail.slice(0, -1) }),
    zone: (zone) => {
      app.save.log.push({ date: new Date().toISOString(), type: null, completed: false, done: [], skipped: [], stopped: { why: 'hurt-before', zone } });
      app.persist();
      root.innerHTML = `
      <main class="screen message">
        <h1>No training today.</h1>
        <p class="lead">Show Dad ${esc(zone === 'other' ? 'where it hurts' : COPY.spotOf(zone))} and tell him how it feels. Train again once he's had a look.</p>
        ${stopRuleHtml(COPY.STOP_RULE)}
        <button class="btn btn-primary" data-act="home">Back to Today</button>
      </main>`;
      on(root, { home: () => app.go('home') });
    },
  });
}

// params: { type, reason, extra, dad, answers (the day's check-in record), avoid, noJumps, note }.
// avoid and noJumps come from decide() (contract C4); Dad's runs and the extra Stretch don't pass them.
export function preview(root, app, params) {
  const { type, reason = '', extra = false, dad = false, answers = null, avoid = [], noJumps = false, note = '' } = params;
  const s = app.save;
  const ctx = makeContext({ room: app.room || 'big', hour: new Date().getHours(), versions: s.versions, avoid, noJumps });
  const session = buildSession(type, ctx);

  // What changes for the room or the hour (contract C10), said only when this session has such a drill.
  const drills = SESSIONS[type].blocks.flatMap((b) => b.items.map((it) => byId[it.id])).filter((d) => d && !avoid.includes(d.id));
  const notes = [];
  if (note) notes.push(note);
  if (ctx.small) { if (drills.some((d) => d.space === 'big')) notes.push('Bedroom: small-room versions.'); }
  else if (ctx.early && drills.some((d) => d.slam)) notes.push('Before 9 am: no slams.');
  const said = answersText(answers);
  const grab = grabText(session.grab);

  let lastBlock = null;
  const rows = session.items.map((it, k) => {
    const head = it.block !== lastBlock ? `<li class="block-name">${esc(it.block)}</li>` : '';
    lastBlock = it.block;
    const sets = it.circuit ? `${it.sets} rounds` : it.sets > 1 ? `${it.sets} sets` : '';
    const detail = [it.target, sets].filter(Boolean).join(' · ');
    const more = it.how || it.note;
    return `${head}<li><button class="drill-row" data-act="drill" data-arg="${k}">
      <img src="${esc(it.draw)}" alt="" loading="lazy">
      <span class="dr-text"><span class="dr-name">${esc(it.name)}</span><span class="dr-detail">${esc(detail)}</span>${more ? `<span class="dr-how">${esc(more)}</span>` : ''}</span>
    </button></li>`;
  }).join('');

  root.innerHTML = `
  <main class="screen preview">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Today · ${minutes(session.total)} min · ${session.drills} drills</p>
    <h1>${esc(session.name)}</h1>
    ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
    ${said ? `<p class="small">${esc(said)}</p>` : ''}
    ${notes.map((n) => `<p class="hint">${esc(n)}</p>`).join('')}
    ${grab ? `<p class="hint">${esc(grab)}</p>` : ''}
    <p class="small">Tap a drill to see how it's done.</p>
    <ul class="drill-list">${rows}</ul>
    ${stopRuleHtml(COPY.STOP_RULE)}
    <p class="small">Lean the phone against the wall, low down, screen facing you.</p>
    <div class="start-bar"><button class="btn btn-go" data-act="start">Start</button></div>
  </main>`;

  on(root, {
    back: () => app.go('home'),
    drill: (k) => app.go('drill', { item: session.items[+k], back: ['preview', params] }),
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
