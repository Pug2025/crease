// For Dad, behind a 4-digit PIN: his streak and saves, his last 14 days, redo today's check-in,
// start any session, the splits ladder, and each drill's version.
import { esc, on, minutes } from '../ui.js';
import { SESSIONS, SESSION_ORDER } from '../../data/sessions.js';
import { DRILLS, byId } from '../../data/exercises.js';
import { targetText } from '../../data/copy.js';
import { scramble } from '../store.js';
import { BUILD } from '../version.js';
import { dayKey, counts } from '../plan/decide.js';
import { makeContext, resolveItem } from '../plan/build.js';
import { splitsState, settleSplits, markWatched, setRung } from '../plan/splits.js';
import { LADDER, TOP } from '../../data/splits.js';
import { isTest } from './home.js';
import { MAX_SAVES, giveSave } from '../plan/streak.js';
import { cardStats, rungFor } from '../plan/card.js';

const GROUPS = [['warm-up', 'Warm-up'], ['strength', 'Strength'], ['power', 'Power'], ['stretch', 'Stretch']];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SKIP_WHY = { hard: 'too hard', here: 'can\'t do it here' };
const dayAt = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// "No hockey today · Game tomorrow → Stretch"
export function answersText(d) {
  if (!d) return '';
  const today = { game: 'Game today', practice: 'Practice today', none: 'No hockey today' };
  const tomorrow = { game: 'game tomorrow', practice: 'practice tomorrow', none: 'no hockey tomorrow' };
  const parts = [];
  if (d.today === 'game' && d.when) parts.push(d.when === 'before' ? 'Game today, later' : 'Game today, already played');
  else if (today[d.today]) parts.push(today[d.today]);
  if (tomorrow[d.tomorrow]) parts.push(cap(tomorrow[d.tomorrow]));
  const picked = SESSIONS[d.type] ? ` → ${SESSIONS[d.type].name}` : '';
  const tries = d.tries > 1 ? ` · checked in ${d.tries} times` : '';
  return parts.join(' · ') + picked + tries;
}

// How one log entry ended, in Dad's words.
export function endingText(e) {
  const ended = e.stopped?.why === 'ended';
  const at = e.reached ? `Ended at ${e.reached} of ${e.planned}` : `Ended early, ${e.done?.length ?? 0} of ${e.planned} done`;
  let t = ended ? at : e.completed ? 'Done' : 'Too many skips';
  if (e.extra) t += ' · extra, doesn\'t count';
  else if (!counts(e)) t += ' · didn\'t count';
  if (e.dad && !e.extra) t += ' · Picked by Dad';
  return t;
}

// One row a day, newest first: the last 14 days.
export function dadDays(save, now = new Date()) {
  const byDay = {};
  for (const e of save.log) if (!isTest(e)) (byDay[dayKey(new Date(e.date))] ||= []).push(e);
  const keys = [];
  for (let n = 0; n < 14; n++) keys.push(dayKey(dayAt(now, -n)));
  return keys.map((k, n) => {
    const d = fromKey(k);
    const entries = (byDay[k] || []).map((e) => ({
      e,
      session: SESSIONS[e.type] ? `${SESSIONS[e.type].name} · ${minutes(e.secs || 0)} min` : '',
      ending: endingText(e),
      skips: (e.skipped || []).map((sk) => `Skipped ${byId[sk.id]?.name || sk.id}: ${SKIP_WHY[sk.why] || sk.why}`),
    }));
    return {
      key: k,
      label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${WD[d.getDay()]} ${MO[d.getMonth()]} ${d.getDate()}`,
      date: `${WD[d.getDay()]} ${MO[d.getMonth()]} ${d.getDate()}`,
      answers: answersText(save.days?.[k]),
      entries,
    };
  });
}

function dayRowHtml(r) {
  if (!r.entries.length && !r.answers) {
    return `<li class="dd-row dd-empty"><span class="dd-date">${esc(r.label)}</span><span class="dd-none">No session.</span></li>`;
  }
  const entries = r.entries.map((x) => `
    <div class="dd-entry">
      ${x.session ? `<span class="dd-sess">${esc(x.session)}</span>` : ''}
      <span class="dd-end">${esc(x.ending)}</span>
      ${x.skips.map((t) => `<span class="dd-skip">${esc(t)}</span>`).join('')}
    </div>`).join('');
  return `
  <li class="dd-row">
    <div class="dd-head">
      <span class="dd-date">${esc(r.label)}${r.label !== r.date ? ` <small>${esc(r.date)}</small>` : ''}</span>
    </div>
    ${r.answers ? `<p class="dd-ans">${esc(r.answers)}</p>` : ''}
    ${entries || '<span class="dd-none">No session.</span>'}
  </li>`;
}

// The chosen version in one line: "Harder: Hold the med ball on your lap. Hold 45 s."
// Sets are left out: each session sets its own (Power runs 3 sets of slams, the library says 2).
export function versionLine(d, k) {
  const v = d.versions[k];
  const dose = { ...d.dose, ...(v.dose || {}) };
  return `${v.name}: ${v.how ? `${v.how} ` : ''}${targetText(d, dose)}`;
}

export function render(root, app, { unlocked = false, note = '', scroll = 0 } = {}) {
  if (!unlocked) { pinScreen(root, app); return; }
  const s = app.save;
  const now = new Date();
  const todayKey = dayKey(now);
  const asCounted = app.dadCounts === true;
  const again = (p = {}) => render(root, app, { unlocked: true, ...p });

  const checkin = s.days?.[todayKey];
  if (settleSplits(s, now)) app.persist();
  const sp = splitsState(s, now);
  const card = cardStats(s, now);
  const st = card.streak;

  const sessions = SESSION_ORDER.map((t) => `<button class="set-row" data-act="run" data-arg="${t}"><span>${esc(SESSIONS[t].name)}</span><small>Start now</small></button>`).join('');
  const drills = GROUPS.map(([g, title]) => {
    const rows = DRILLS.filter((d) => d.group === g && d.versions.length > 1).map((d) => {
      const cur = Number.isInteger(s.versions[d.id]) ? s.versions[d.id] : d.start;
      return `<li class="ver-row">
        <button class="ver-name" data-act="card" data-arg="${d.id}">${esc(d.name)}<span aria-hidden="true"> ›</span></button>
        <span class="ver-seg">${d.versions.map((v, k) => `<button data-act="ver" data-arg="${d.id}:${k}" aria-pressed="${k === cur}">${esc(v.name)}</button>`).join('')}</span>
        <span class="ver-what">${esc(versionLine(d, cur))}</span></li>`;
    }).join('');
    return rows ? `<li class="block-name">${esc(title)}</li>${rows}` : '';
  }).join('');

  root.innerHTML = `
  <main class="screen dad">
    <div class="dad-top">
      <button class="back" data-act="back">Back</button>
      <span class="build">Build ${esc(BUILD)}</span>
    </div>
    <p class="kicker">For Dad</p>
    <h1>Dad</h1>
    ${note ? `<p class="dad-note" role="status">${esc(note)}</p>` : ''}
    <section class="set-group dad-streak">
      <h2>Streak</h2>
      <dl class="stats">
        <div><dt>Streak</dt><dd>${st.days}</dd></div>
        <div><dt>Best</dt><dd>${st.best}</dd></div>
        <div><dt>Saves</dt><dd>${st.saves}<small> of ${MAX_SAVES}</small></dd></div>
      </dl>
      <p class="small">A save covers a day he doesn't train, so the streak keeps going. It's spent on its own when a day passes with no session. He earns one every 7 days in a row and holds 2 at most. Give him one for a tournament weekend or a sick day, before or during the days off.</p>
      <button class="set-row" data-act="gift" ${st.saves >= MAX_SAVES ? 'disabled' : ''}><span>Give him a save</span><small>${st.saves >= MAX_SAVES ? 'He has 2' : ''}</small></button>
      <p class="small">His card: <b>${card.overall}</b> overall, ${esc(card.tier)}.</p>
    </section>
    <section class="set-group">
      <h2>Last 14 days</h2>
      <p class="small">What he answered, what he did and how it ended.</p>
      <ol class="dd-list">${dadDays(s, now).map(dayRowHtml).join('')}</ol>
    </section>
    ${checkin ? `
      <section class="set-group">
        <h2>Today's check-in</h2>
        <p class="small">${esc(answersText(checkin))}. His first check-in of the day sticks. A second one can only make the session easier.</p>
        <button class="set-row" data-act="redo"><span>Redo today's check-in</span></button>
      </section>` : ''}
    <section class="set-group">
      <h2>Start a session</h2>
      <p class="small">The check-in normally picks. Use this to try a session, or to set today's yourself.</p>
      <div class="seg" role="group">
        <button data-act="counts" data-arg="no" aria-pressed="${!asCounted}">Test run</button>
        <button data-act="counts" data-arg="yes" aria-pressed="${asCounted}">Counts as his session</button>
      </div>
      <p class="small">${asCounted ? 'His normal session: no skip buttons, saved to his record.' : 'Skip buttons to click through. Nothing is saved.'}</p>
      ${sessions}
    </section>
    <section class="set-group">
      <h2>Splits ladder</h2>
      <p class="small">Rung ${sp.rung} of ${TOP}: <b>${esc(sp.r.name)}</b>${sp.r.how ? `. ${esc(sp.r.how)}` : '.'} Side splits, not front splits: his legs go out to the sides, the way they do in the butterfly. He climbs by doing the hold, one a day, ${sp.need} holds a rung. ${LADDER.filter((r) => r.watch).length} rungs wait for you.</p>
      ${sp.waiting ? `
        <div class="dad-watch">
          <p><b>Ready for you to watch.</b> ${esc(sp.r.name)}, one hold. Look for: kneecaps and toes pointing up, feet not rolling in, no bouncing, and he can breathe the whole way through. If it looks forced, tap Not yet.</p>
          <button class="btn btn-primary" data-act="watched">Watched — he's got it</button>
          <button class="btn" data-act="notyet">Not yet</button>
        </div>`
    : `<p class="small">${sp.top ? 'He can do the splits.' : `${sp.holds} of ${sp.need} holds done on this rung.`}</p>`}
      <ul class="ver-list"><li class="ver-row">
        <span class="ver-name">Set the rung</span>
        <span class="ver-seg sp-seg">${LADDER.map((r) => `<button data-act="rung" data-arg="${r.n}" aria-pressed="${r.n === sp.rung}" title="${esc(r.name)}">${r.n}</button>`).join('')}</span>
        <span class="ver-what">Use this if he's further along than the app thinks, or if you want him back a rung.</span>
      </li></ul>
    </section>
    <section class="set-group">
      <h2>Drill versions</h2>
      <p class="small">What he does in every session from now on. Easier if a drill is too much for him, Harder once you've watched him do a clean set. Tap a name for its card.</p>
      <ul class="ver-list">${drills}</ul>
    </section>
  </main>`;
  if (scroll) window.scrollTo(0, scroll);

  on(root, {
    back: () => app.go('settings'),
    counts: (v) => { app.dadCounts = v === 'yes'; again({ scroll: window.scrollY }); },
    // dad stays true for his counted runs too, so the 14-day list can say "Picked by Dad".
    // The player gives skip buttons only to test runs (dad && extra).
    run: (type) => app.go('preview', {
      type, extra: !asCounted, dad: true,
      reason: asCounted ? 'Picked by Dad.' : 'Test run. It doesn\'t count as a session.',
    }),
    gift: () => {
      if (!giveSave(s, now)) return;
      app.persist();
      again({ note: `Save given. He has ${cardStats(s, now).streak.saves}.` });
    },
    redo: () => {
      delete s.days[todayKey];
      app.persist();
      again({ note: 'Today\'s check-in is cleared. His next one starts fresh.' });
    },
    watched: () => {
      markWatched(s, sp.rung, now);
      app.persist();
      again({ note: `Rung ${sp.rung} signed off. He's on ${splitsState(s, now).r.name}.`, scroll: window.scrollY });
    },
    // Not ready: he stays on this rung and the holds start again, so he works at it before you look again.
    notyet: () => {
      setRung(s, sp.rung, now);
      app.persist();
      again({ note: `He stays on ${sp.r.name}. ${sp.need} more holds before it asks you again.`, scroll: window.scrollY });
    },
    rung: (n) => {
      // Flex on his card keeps the highest rung he reached.
      s.card = { ...(s.card || {}), rungPeak: rungFor(s) };
      setRung(s, +n, now);
      app.persist();
      again({ note: `Set to rung ${+n}: ${splitsState(s, now).r.name}.`, scroll: window.scrollY });
    },
    card: (id) => {
      const ctx = makeContext({ room: 'big', hour: 12, ball: s.settings.ball, band: s.settings.band, versions: s.versions });
      const r = resolveItem({ id }, ctx);
      app.go('drill', { item: { ...r, sets: r.dose.sets }, back: ['dad', { unlocked: true, scroll: window.scrollY }] });
    },
    ver: (arg) => {
      const [id, k] = arg.split(':');
      const d = DRILLS.find((x) => x.id === id);
      if (+k === d.start) delete s.versions[id]; else s.versions[id] = +k;
      app.persist();
      again({ scroll: window.scrollY });
    },
  });
}

// Only an older save can reach Dad's screen with no PIN: first launch sets one now.
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
