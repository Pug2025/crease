// Settings: gear, sound check, how it works, start over.
import { esc, on } from '../ui.js';
import { wipe } from '../store.js';
import { BUILD } from '../version.js';

const BALL = { dead: 'Slam ball (doesn\'t bounce)', bouncy: 'Bouncy ball, no slams', none: 'No med ball' };

export function render(root, app) {
  const s = app.save.settings;
  const draw = (confirm = false) => {
    root.innerHTML = `
    <main class="screen settings">
      <button class="back" data-act="back">Back</button>
      <h1>Settings</h1>
      <section class="set-group">
        <button class="set-row" data-act="gear"><span>Gear</span><small>${esc(BALL[s.ball])} · ${s.band ? 'mini band' : 'no band'}</small></button>
        <button class="set-row" data-act="sound"><span>Sound check</span></button>
      </section>
      <section class="howto">
        <h2>How it works</h2>
        <p>Pick a session. The coach's voice runs it, so the phone can stay on the floor. Blue screen means work. White means rest or get ready.</p>
        <p>Before 9 am, or in your bedroom, you get quiet versions of the loud drills.</p>
        <p>Tap a drill before you start to see how it's done. Most have a video.</p>
      </section>
      <section class="set-group">
        ${confirm
          ? `<p>This erases every session on this phone. It can't be undone.</p>
             <button class="btn btn-stop" data-act="wipe">Erase everything</button>
             <button class="btn" data-act="cancel">Keep it</button>`
          : `<button class="set-row" data-act="ask"><span>Start over</span></button>`}
      </section>
      <p class="small">Build ${esc(BUILD)}</p>
    </main>`;
  };
  draw();
  on(root, {
    back: () => app.go('home'),
    gear: () => app.go('gear', { fromSettings: true }),
    sound: () => app.go('sound', { fromSettings: true }),
    ask: () => draw(true),
    cancel: () => draw(false),
    wipe: () => { app.save = wipe(); app.go('welcome'); },
  });
}
