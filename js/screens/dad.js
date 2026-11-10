// For Dad, behind a 4-digit PIN: start any session, and set each drill's version.
import { esc, on } from '../ui.js';
import { SESSIONS, SESSION_ORDER } from '../../data/sessions.js';
import { DRILLS } from '../../data/exercises.js';

async function scramble(pin) {
  const data = new TextEncoder().encode(`crease:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const GROUPS = [['warm-up', 'Warm-up'], ['strength', 'Strength'], ['power', 'Power'], ['stretch', 'Stretch']];

export function render(root, app, { unlocked = false } = {}) {
  if (!unlocked) { pinScreen(root, app); return; }
  const s = app.save;
  const counts = app.dadCounts === true;

  const sessions = SESSION_ORDER.map((t) => `<button class="set-row" data-act="run" data-arg="${t}"><span>${esc(SESSIONS[t].name)}</span><small>Start now</small></button>`).join('');
  const drills = GROUPS.map(([g, title]) => {
    const rows = DRILLS.filter((d) => d.group === g && d.versions.length > 1).map((d) => {
      const cur = Number.isInteger(s.versions[d.id]) ? s.versions[d.id] : d.start;
      return `<li class="ver-row"><span class="ver-name">${esc(d.name)}</span>
        <span class="ver-seg">${d.versions.map((v, k) => `<button data-act="ver" data-arg="${d.id}:${k}" aria-pressed="${k === cur}">${esc(v.name)}</button>`).join('')}</span></li>`;
    }).join('');
    return rows ? `<li class="block-name">${esc(title)}</li>${rows}` : '';
  }).join('');

  root.innerHTML = `
  <main class="screen dad">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">For Dad</p>
    <h1>Dad</h1>
    <section class="set-group">
      <h2>Start a session</h2>
      <p class="small">The check-in normally picks. Use this to try a session, or to set today's yourself.</p>
      <div class="seg" role="group">
        <button data-act="counts" data-arg="no" aria-pressed="${!counts}">Test run</button>
        <button data-act="counts" data-arg="yes" aria-pressed="${counts}">Counts as his session</button>
      </div>
      ${sessions}
    </section>
    <section class="set-group">
      <h2>Drill versions</h2>
      <p class="small">What he does in every session from now on. Easier if something bothers him, Harder once you've watched him do a clean set.</p>
      <ul class="ver-list">${drills}</ul>
    </section>
  </main>`;

  on(root, {
    back: () => app.go('settings'),
    counts: (v) => { app.dadCounts = v === 'yes'; render(root, app, { unlocked: true }); },
    run: (type) => app.go('preview', { type, reason: counts ? 'Picked by Dad.' : 'Test run. It doesn\'t count as a session.', extra: !counts, from: 'dad' }),
    ver: (arg) => {
      const [id, k] = arg.split(':');
      const d = DRILLS.find((x) => x.id === id);
      if (+k === d.start) delete s.versions[id]; else s.versions[id] = +k;
      app.persist();
      const y = window.scrollY;
      render(root, app, { unlocked: true });
      window.scrollTo(0, y);
    },
  });
}

function pinScreen(root, app) {
  const s = app.save;
  const setting = !s.dadPin;
  root.innerHTML = `
  <main class="screen dad-pin">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">For Dad</p>
    <h1>${setting ? 'Set a PIN' : 'PIN'}</h1>
    <p class="lead">${setting ? 'Four digits. Keep it to yourself.' : 'Enter your PIN.'}</p>
    <input class="pin-input" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN">
    ${setting ? '<input class="pin-input" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN again" placeholder="Again">' : ''}
    <p class="small pin-msg" role="status"></p>
    <button class="btn btn-primary" data-act="ok">${setting ? 'Save PIN' : 'Open'}</button>
    ${setting ? '' : '<p class="small">Forgot it? Settings, Start over erases everything on this phone, PIN included.</p>'}
  </main>`;
  const msg = root.querySelector('.pin-msg');
  on(root, {
    back: () => app.go('settings'),
    ok: async () => {
      const pin = root.querySelector('#pin').value.trim();
      if (!/^\d{4}$/.test(pin)) { msg.textContent = 'Four digits, please.'; return; }
      if (setting) {
        if (root.querySelector('#pin2').value.trim() !== pin) { msg.textContent = 'The two PINs don\'t match.'; return; }
        s.dadPin = await scramble(pin);
        app.persist();
        render(root, app, { unlocked: true });
        return;
      }
      if ((await scramble(pin)) === s.dadPin) render(root, app, { unlocked: true });
      else { msg.textContent = 'That PIN isn\'t right.'; root.querySelector('#pin').value = ''; }
    },
  });
}
