// First launch: install, welcome and the stop rule, gear questions for Dad, sound check.
import { esc, on, CREASE_MARK, stopRuleHtml } from '../ui.js';
import { STOP_RULE, SAY } from '../../data/copy.js';
import * as audio from '../timer/audio.js';

export function install(root) {
  root.innerHTML = `
  <main class="screen install">
    ${CREASE_MARK}
    <h1>Crease</h1>
    <p class="lead">Add it to your Home Screen first. It only saves your training when you open it from there.</p>
    <ol class="steps">
      <li><span class="n">1</span><span>Tap <b>•••</b> at the bottom right of Safari, then <b>Share</b> <span class="share-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 11v9h14v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></li>
      <li><span class="n">2</span><span>Tap <b>View More</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
      <li><span class="n">3</span><span>Close Safari and open <b>Crease</b> from your Home Screen.</span></li>
    </ol>
    <p class="small">If it opens in Safari again, press and hold the icon, then make sure Open as Web App is on.</p>
  </main>`;
}

export function welcome(root, app) {
  root.innerHTML = `
  <main class="screen welcome">
    ${CREASE_MARK}
    <h1>Crease</h1>
    <p class="lead">Off-ice training for goalies. The phone runs the session. You do the work.</p>
    ${stopRuleHtml(STOP_RULE)}
    <p class="small">There's a Stop button on screen the whole time.</p>
    <button class="btn btn-primary" data-act="next">Got it</button>
  </main>`;
  on(root, { next: () => app.go('gear') });
}

const BALL = [
  { id: 'dead', label: 'It doesn\'t bounce', note: 'A slam ball. Slams are allowed.' },
  { id: 'bouncy', label: 'It bounces', note: 'No slams. It could bounce back at his face.' },
  { id: 'none', label: 'No med ball' },
];

export function gear(root, app, { fromSettings = false } = {}) {
  const s = app.save.settings;
  const draw = () => {
    root.innerHTML = `
    <main class="screen gear">
      <p class="kicker">${fromSettings ? 'Settings' : 'For Dad'}</p>
      <h1>Gear</h1>
      <section class="q">
        <h2>Does the med ball bounce?</h2>
        <div class="choices">
          ${BALL.map((b) => `<button class="choice" data-act="ball" data-arg="${b.id}" aria-pressed="${s.ball === b.id}"><span>${esc(b.label)}</span>${b.note ? `<small>${esc(b.note)}</small>` : ''}</button>`).join('')}
        </div>
      </section>
      <section class="q">
        <h2>Is there a mini band?</h2>
        <div class="choices row">
          <button class="choice" data-act="band" data-arg="yes" aria-pressed="${s.band === true}"><span>Yes</span></button>
          <button class="choice" data-act="band" data-arg="no" aria-pressed="${s.band === false}"><span>No</span></button>
        </div>
      </section>
      <button class="btn btn-primary" data-act="next">${fromSettings ? 'Save' : 'Next'}</button>
    </main>`;
  };
  draw();
  on(root, {
    ball: (id) => { s.ball = id; app.persist(); draw(); },
    band: (v) => { s.band = v === 'yes'; app.persist(); draw(); },
    next: () => app.go(fromSettings ? 'settings' : 'sound'),
  });
}

export function sound(root, app, { fromSettings = false } = {}) {
  root.innerHTML = `
  <main class="screen sound">
    <p class="kicker">${fromSettings ? 'Settings' : 'Last step'}</p>
    <h1>Sound check</h1>
    <p class="lead">The coach talks you through every session, so you can keep the phone on the floor.</p>
    <button class="btn btn-big" data-act="play">Play the voice</button>
    <p class="small">Nothing? Flip the switch on the side of your phone so it isn't on silent, and turn the volume up.</p>
    <button class="btn btn-primary" data-act="next">${fromSettings ? 'Back' : 'It works'}</button>
  </main>`;
  on(root, {
    play: async () => {
      await audio.unlock();
      await audio.preload([SAY.soundCheck]);
      audio.say([SAY.soundCheck]);
    },
    next: () => {
      if (fromSettings) { app.go('settings'); return; }
      app.save.setupDone = true;
      app.persist();
      app.go('home');
    },
  });
}
