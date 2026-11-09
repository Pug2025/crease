// Before a session: how he feels, the game-tomorrow check, and the preview with Start.
import { esc, on, minutes, stopRuleHtml } from '../ui.js';
import { SESSIONS } from '../../data/sessions.js';
import { FEEL, STOP_RULE } from '../../data/copy.js';
import { buildSession, makeContext, phrasesOf } from '../plan/build.js';
import * as audio from '../timer/audio.js';
import { keepAwake } from '../timer/wakelock.js';

export function feel(root, app, { type }) {
  root.innerHTML = `
  <main class="screen feel">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">${esc(SESSIONS[type].name)}</p>
    <h1>How do you feel?</h1>
    <div class="choices">
      ${FEEL.map((f) => `<button class="choice" data-act="pick" data-arg="${f.id}"><span>${esc(f.label)}</span>${f.note ? `<small>${esc(f.note)}</small>` : ''}</button>`).join('')}
    </div>
  </main>`;
  on(root, {
    back: () => app.go('home'),
    pick: (f) => {
      if (f === 'sick') { message(root, app, 'Sick', 'No training today. Rest up and drink water.'); return; }
      if (f === 'sore' && type !== 'mobility') {
        message(root, app, 'Sore', 'Mobility only today. Easy on anything that hurts.', { label: 'Do Mobility', go: ['preview', { type: 'mobility', feel: 'good' }] });
        return;
      }
      const next = { type, feel: f === 'tired' ? 'tired' : 'good' };
      app.go(SESSIONS[type].checkGameTomorrow ? 'game' : 'preview', next);
    },
  });
}

function message(root, app, title, text, action) {
  root.innerHTML = `
  <main class="screen message">
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(text)}</p>
    ${action ? `<button class="btn btn-primary" data-act="go">${esc(action.label)}</button>` : ''}
    <button class="btn" data-act="home">Back to Today</button>
  </main>`;
  on(root, { home: () => app.go('home'), go: () => app.go(...action.go) });
}

export function game(root, app, params) {
  root.innerHTML = `
  <main class="screen game">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Power</p>
    <h1>Game tomorrow?</h1>
    <div class="choices row">
      <button class="choice" data-act="yes"><span>Yes</span></button>
      <button class="choice" data-act="no"><span>No</span></button>
    </div>
  </main>`;
  on(root, {
    back: () => app.go('home'),
    yes: () => message(root, app, 'Game tomorrow.', 'Power waits. Mobility keeps you loose without making your legs tired.', { label: 'Do Mobility', go: ['preview', { type: 'mobility', feel: params.feel }] }),
    no: () => app.go('preview', params),
  });
}

export function preview(root, app, { type, feel = 'good' }) {
  const s = app.save.settings;
  const ctx = makeContext({ room: app.room || 'big', feel, ball: s.ball, band: s.band });
  const session = buildSession(type, ctx);
  const notes = [];
  if (ctx.small) notes.push('Bedroom: quiet versions.');
  else if (ctx.quiet) notes.push('Before 9 am: quiet versions.');
  if (feel === 'tired') notes.push('Tired: one set fewer.');

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
    <p class="kicker">${minutes(session.total)} min · ${session.drills} drills</p>
    <h1>${esc(session.name)}</h1>
    ${notes.length ? `<p class="hint">${esc(notes.join(' '))}</p>` : ''}
    <p class="small">Tap a drill to see how it's done.</p>
    <ul class="drill-list">${rows}</ul>
    ${stopRuleHtml(STOP_RULE)}
    <p class="small">Lean the phone against the wall, low down, screen facing you.</p>
    <div class="start-bar"><button class="btn btn-go" data-act="start">Start</button></div>
  </main>`;

  on(root, {
    back: () => app.go('home'),
    drill: (k) => app.go('drill', { item: session.items[+k], back: ['preview', { type, feel }] }),
    start: async (arg, btn) => {
      btn.disabled = true;
      btn.textContent = 'Loading';
      audio.unlock();
      keepAwake();
      await audio.preload(phrasesOf(session));
      app.go('player', { session });
    },
  });
}
