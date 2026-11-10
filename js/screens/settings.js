// Settings: sound check, Dad's screen, how it works, start over (Dad's PIN needed).
import { esc, on } from '../ui.js';
import { wipe, scramble } from '../store.js';
import { BUILD } from '../version.js';

export function render(root, app) {
  const draw = (confirm = false) => {
    const needPin = !!app.save.dadPin;
    root.innerHTML = `
    <main class="screen settings">
      <button class="back" data-act="back">Back</button>
      <h1>Settings</h1>
      <section class="set-group">
        <button class="set-row" data-act="sound"><span>Sound check</span></button>
        <button class="set-row" data-act="dad"><span>For Dad</span><small>PIN</small></button>
      </section>
      <section class="howto">
        <h2>How it works</h2>
        <p>Tap Start and answer a few questions. The app picks today's session from your hockey and what you've done lately. The coach's voice runs it, so the phone can stay on the floor. Blue screen means work. White means rest or get ready.</p>
        <p>In your bedroom, the drills that need 3 metres of space swap for small-room versions. Before 9 am there are no med ball slams.</p>
        <p>Tap a drill before you start to see how it's done. Most have a video.</p>
      </section>
      <section class="set-group">
        ${confirm
          ? `<p>This erases every session on this phone. It can't be undone.</p>
             ${needPin ? '<input class="pin-input" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="Dad\'s PIN" placeholder="Dad\'s PIN">' : ''}
             <p class="small pin-msg" role="status"></p>
             <button class="btn btn-stop" data-act="wipe">Erase everything</button>
             <button class="btn" data-act="cancel">Keep it</button>`
          : `<button class="set-row" data-act="ask"><span>Start over</span>${needPin ? '<small>Dad\'s PIN</small>' : ''}</button>`}
      </section>
      <p class="small">Build ${esc(BUILD)}</p>
    </main>`;
  };
  draw();
  on(root, {
    back: () => app.go('home'),
    sound: () => app.go('sound', { fromSettings: true }),
    dad: () => app.go('dad'),
    ask: () => draw(true),
    cancel: () => draw(false),
    wipe: async () => {
      if (app.save.dadPin) {
        const field = root.querySelector('#pin');
        const pin = field.value.trim();
        if (!/^\d{4}$/.test(pin) || (await scramble(pin)) !== app.save.dadPin) {
          root.querySelector('.pin-msg').textContent = /^\d{4}$/.test(pin) ? 'That PIN isn\'t right.' : 'Dad\'s 4-digit PIN, please.';
          field.value = '';
          return;
        }
      }
      app.save = wipe();
      app.room = null;
      app.go('welcome');
    },
  });
}
