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
        <dl class="how">
          <div><dt>Start</dt><dd>Answer a few questions and the app picks today's session.</dd></div>
          <div><dt>Blue screen</dt><dd>Work. A white screen means rest or get ready.</dd></div>
          <div><dt>Bedroom</dt><dd>Drills that need 3 metres swap for small-room ones.</dd></div>
          <div><dt>Before 9 am</dt><dd>No med ball slams.</dd></div>
          <div><dt>Drills</dt><dd>Tap one before you start to see how it's done. Most have a video.</dd></div>
          <div><dt>Streak</dt><dd>Days in a row with a session.</dd></div>
          <div><dt>Saves</dt><dd>A save covers a day you miss. You get one every 7 days and can hold 2.</dd></div>
          <div><dt>Card</dt><dd>Your ratings go up as you train. They never go down.</dd></div>
          <div><dt>Finisher</dt><dd>The last hard drill. Do as many as you can, then enter your number at the end.</dd></div>
          <div><dt>Records</dt><dd>Your best on each finisher drill. A harder version starts a new record.</dd></div>
          <div><dt>Boss day</dt><dd>Three rounds. It comes after ten sessions.</dd></div>
          <div><dt>Masks</dt><dd>You earn masks from streaks, sessions, Boss days, the two games and the splits. Two are secret.</dd></div>
        </dl>
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
