// The session player. Read from 2 m away: the whole screen's colour says work or rest,
// the countdown fills the width, and the voice says everything the screen says.
import { esc, on, clock, mmss, stopRuleHtml } from '../ui.js';
import { Runner } from '../timer/runner.js';
import * as audio from '../timer/audio.js';
import { keepAwake, letSleep } from '../timer/wakelock.js';
import { PAIN_ZONES, STOP_RULE, SAY } from '../../data/copy.js';

const SIDE = { L: 'Left', R: 'Right' };

export function render(root, app, { session }) {
  const log = {
    date: new Date().toISOString(),
    type: session.type,
    room: session.ctx.room,
    feel: session.ctx.feel,
    planned: session.drills,
    done: [],
    skipped: [],
    stopped: null,
    completed: false,
    secs: 0,
  };

  root.innerHTML = `
  <div class="player" data-phase="intro">
    <div class="pl-top"><span class="pl-where"></span><span class="pl-left"></span></div>
    <div class="pl-phase"><span class="pl-word"></span><span class="pl-set"></span></div>
    <div class="pl-clock"></div>
    <div class="pl-name"></div>
    <div class="pl-target"></div>
    <div class="pl-board"><img class="pl-draw" alt=""></div>
    <div class="pl-cue"></div>
    <button class="pl-sound" data-act="fixSound" hidden>Sound is off. Tap to fix.</button>
    <div class="pl-buttons">
      <button class="pbtn pbtn-pause" data-act="pause">Pause</button>
      <button class="pbtn pbtn-done" data-act="done" hidden>Done</button>
      <button class="pbtn pbtn-stop" data-act="stop">Stop</button>
    </div>
    <div class="sheet" hidden></div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const el = {
    player: $('.player'), where: $('.pl-where'), left: $('.pl-left'), word: $('.pl-word'), set: $('.pl-set'),
    clock: $('.pl-clock'), name: $('.pl-name'), target: $('.pl-target'), draw: $('.pl-draw'), cue: $('.pl-cue'),
    sound: $('.pl-sound'), done: $('.pbtn-done'), sheet: $('.sheet'),
  };
  let shownClock = '';
  let shownLeft = '';
  let finished = false;

  function phaseWord(st) {
    if (st.kind === 'intro') return st.i === 0 ? 'First up' : 'Up next';
    if (st.kind === 'work') return st.r.drill.goWord ? st.r.drill.goWord.replace('.', '') : 'Work';
    if (st.kind === 'rest') return st.restWord ? st.restWord.replace('.', '') : 'Rest';
    if (st.kind === 'switch') return 'Switch';
    return 'Done';
  }

  function setLine(st) {
    const parts = [];
    if (st.rounds > 1) parts.push(`Round ${st.round} of ${st.rounds}`);
    else if (st.sets > 1 && st.kind !== 'intro') parts.push(`Set ${st.set} of ${st.sets}`);
    if (st.side) parts.push(SIDE[st.side]);
    if (st.kind === 'switch') parts.push(st.r.drill.side === 'way' ? 'Other way' : 'Right side');
    return parts.join(' · ');
  }

  function onStep(st) {
    if (st.kind === 'end') return;
    const r = st.r;
    el.player.dataset.phase = st.kind;
    el.word.textContent = phaseWord(st);
    el.set.textContent = setLine(st);
    el.name.textContent = r.name;
    el.target.textContent = [r.target, r.how || r.note].filter(Boolean).join(' · ');
    if (el.draw.getAttribute('src') !== r.draw) el.draw.src = r.draw;
    el.draw.alt = `Drawing of ${r.name}`;
    if (st.kind === 'intro') el.cue.textContent = r.drill.cues[0];
    el.done.hidden = !(st.kind === 'work' && st.reps);
    el.where.textContent = `${session.name} · ${st.drillNo} of ${session.drills}`;
    if (st.kind === 'work' && !log.done.includes(r.drill.id)) log.done.push(r.drill.id);
  }

  function onTick(e, st) {
    if (st.kind === 'end') return;
    const c = clock(st.start + st.dur - e);
    if (c !== shownClock) {
      shownClock = c;
      el.clock.textContent = c;
      el.clock.classList.toggle('long', c.length > 2);
    }
    const l = mmss(session.total - e);
    if (l !== shownLeft) { shownLeft = l; el.left.textContent = `${l} left`; }
  }

  function flash() {
    el.clock.classList.remove('flash');
    void el.clock.offsetWidth;
    el.clock.classList.add('flash');
  }

  function onCue(c, st) {
    if (c.beep) { audio.beep(c.beep); if (c.beep !== 'end') flash(); }
    if (c.say) {
      audio.say(c.say);
      const shown = c.say.filter((p) => st.r && st.r.drill.cues.includes(p));
      if (shown.length) el.cue.textContent = shown[shown.length - 1];
    }
  }

  const runner = new Runner(session, {
    onStep,
    onTick,
    onCue,
    onEnd: () => {
      audio.beep('end');
      audio.say([SAY.sessionDone]);
      finish(true);
    },
  });

  function finish(completed) {
    if (finished) return;
    finished = true;
    runner.stop();
    if (!completed) audio.hush();
    letSleep();
    log.done = log.done.filter((id) => !log.skipped.some((s) => s.id === id));
    // Skipping through doesn't count: at least half the drills have to be done.
    log.completed = completed && log.done.length >= Math.ceil(session.drills / 2);
    log.secs = Math.round((performance.now() - startedAt - runner.pausedTotal) / 1000);
    app.save.log.push(log);
    app.persist();
    app.go('done', { session, log });
  }

  // Sheets: pause, stop, skip, pain.
  function sheet(html) {
    el.sheet.innerHTML = `<div class="sheet-card">${html}</div>`;
    el.sheet.hidden = false;
  }
  function closeSheet() { el.sheet.hidden = true; el.sheet.innerHTML = ''; }

  function pauseSheet() {
    sheet(`
      <h2>Paused</h2>
      <button class="btn btn-go" data-act="resume">Resume</button>
      <button class="btn" data-act="skip">Skip this drill</button>
      <button class="btn" data-act="endSession">End the session</button>`);
  }

  function zonesSheet(then) {
    pending = then;
    sheet(`
      <h2>Where does it hurt?</h2>
      <div class="zones">${PAIN_ZONES.map((z) => `<button class="choice" data-act="zone" data-arg="${z.id}"><span>${esc(z.label)}</span></button>`).join('')}</div>`);
  }
  let pending = null;

  function skipToNextDrill() {
    runner.jumpTo(runner.nextDrillIndex());
    closeSheet();
    runner.resume();
  }

  on(root, {
    pause: () => { runner.pause(); audio.hush(); pauseSheet(); },
    resume: () => { closeSheet(); audio.unlock(); keepAwake(); runner.resume(); },
    done: () => { runner.jumpTo(runner.afterCurrent()); },
    stop: () => {
      runner.pause();
      audio.hush();
      sheet(`
        <h2>Why are you stopping?</h2>
        <button class="btn btn-stop" data-act="hurts">Something hurts</button>
        <button class="btn" data-act="endSession">I'm done for today</button>
        <button class="btn" data-act="resume">Keep going</button>`);
    },
    hurts: () => zonesSheet((zone) => { log.stopped = { why: 'pain', zone }; finish(false); }),
    endSession: () => { log.stopped = { why: 'ended' }; finish(false); },
    skip: () => {
      sheet(`
        <h2>Skip ${esc(runner.current().r?.name || 'this drill')}?</h2>
        <button class="btn" data-act="skipWhy" data-arg="hard">Too hard</button>
        <button class="btn" data-act="skipWhy" data-arg="here">Can't do it here</button>
        <button class="btn btn-stop" data-act="skipWhy" data-arg="hurts">It hurts</button>
        <button class="btn" data-act="resume">Back</button>`);
    },
    skipWhy: (why) => {
      const id = runner.current().r?.drill.id;
      if (why === 'hurts') {
        zonesSheet((zone) => {
          log.skipped.push({ id, why, zone });
          sheet(`
            <h2>Skipped.</h2>
            <p>If it still hurts, stop and tell Dad.</p>
            ${stopRuleHtml(STOP_RULE)}
            <button class="btn btn-go" data-act="afterSkip">Next drill</button>
            <button class="btn btn-stop" data-act="hurtsStop">Stop the session</button>`);
          pending = () => {};
          lastZone = zone;
        });
        return;
      }
      log.skipped.push({ id, why });
      skipToNextDrill();
    },
    afterSkip: () => skipToNextDrill(),
    hurtsStop: () => { log.stopped = { why: 'pain', zone: lastZone }; finish(false); },
    zone: (z) => pending?.(z),
    fixSound: async () => {
      await audio.unlock();
      el.sound.hidden = audio.soundOn();
    },
  });
  let lastZone = null;

  // Leaving the app pauses the session; coming back asks for the screen lock again.
  function onVisibility() {
    if (finished) return;
    if (document.hidden) {
      runner.pause();
      audio.hush();
      if (el.sheet.hidden) pauseSheet();
    } else {
      keepAwake();
      setTimeout(() => { el.sound.hidden = audio.soundOn(); }, 300);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  el.sound.hidden = audio.soundOn();
  const startedAt = performance.now();
  runner.start();

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    runner.stop();
    letSleep();
  };
}
