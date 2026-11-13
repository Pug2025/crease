// The session player. Read from 2 m away: the whole screen's colour says work or rest,
// the big number fills the width (seconds left, or his reps on a rep set), and the voice
// says everything the screen says.
import { esc, on, clock, mmss } from '../ui.js';
import { Runner } from '../timer/runner.js';
import * as audio from '../timer/audio.js';
import { keepAwake, letSleep, onLost } from '../timer/wakelock.js';
import * as live from '../live.js';
import { migrateOldRecords } from '../store.js';
import { buildSession, phrasesOf, finisherOf } from '../plan/build.js';
import { bestFor } from '../plan/records.js';
import { repKind } from '../plan/reps.js';
import { SESSIONS } from '../../data/sessions.js';
import { SAY } from '../../data/copy.js';

const SIDE = { L: 'Left', R: 'Right' };
// Seconds into the finisher's intro when the camera's model loads: after the spoken intro.
const CAM_QUIET = 6;

// The main block of each session type: half of it has to be done for the session to count,
// so skipping every push-up and squat can't still earn "Done.". Stretch has no main block.
const MAIN = { strength: 'Circuit', power: 'Power', gameday: 'Legs on' };
const mainBlock = (type) => SESSIONS[type]?.blocks.find((b) => b.main)?.name ?? MAIN[type] ?? null;

// Does a session count? The same test for one that ran to the end and one he ended:
// half of all its drills, and half of its main block. doneNos: drill numbers done, not skipped.
// short: null when it counts, 'half' (not half the drills) or 'main' (not half the main block).
export function credit(session, doneNos) {
  const done = new Set(doneNos);
  const need = Math.ceil(session.drills / 2);
  const name = mainBlock(session.type);
  const main = name ? session.items.map((it, k) => (it.block === name ? k + 1 : 0)).filter(Boolean) : [];
  const mainNeed = Math.ceil(main.length / 2);
  const mainDone = main.filter((n) => done.has(n)).length;
  const short = done.size < need ? 'half' : mainDone < mainNeed ? 'main' : null;
  return { done: done.size, need, mainNeed, mainDone, short };
}

// Fills in how a session ended (contract C6): done, completed, reached, need, short.
export function settle(session, log, doneNos, skippedNos, reached) {
  const skipped = new Set(skippedNos);
  const done = [...new Set(doneNos)].filter((n) => !skipped.has(n)).sort((a, b) => a - b);
  const c = credit(session, done);
  log.done = done.map((n) => session.items[n - 1]?.drill.id).filter(Boolean);
  log.reached = reached;
  log.need = c.need;
  log.short = c.short;
  log.completed = !c.short;
  // The finisher: which drill and version, and whether its work started (Done then asks his number).
  const f = finisherOf(session);
  if (f) log.finisher = { id: f.item.drill.id, v: f.item.v, did: done.includes(f.no) };
  // A Boss day is won only when it ran to the end and counted. One he ended isn't a win.
  if (session.boss) {
    log.bossDay = true;
    log.boss = log.completed && !log.stopped;
  }
  return log;
}

// The big number on a rep set: his rep target, not the seconds in the window (contract C2).
// Until build.js gives every rep step reps and repUnit, the same numbers come from the drill.
export function repsOf(st) {
  if (!st || st.kind !== 'work') return null;
  if (typeof st.reps === 'number' && st.reps > 0) return { n: st.reps, unit: st.repUnit || 'reps' };
  const d = st.r?.dose;
  if (st.reps && d?.type === 'reps' && d.reps > 0) return { n: d.reps, unit: st.r.drill.side ? `each ${st.r.drill.side}` : 'reps' };
  return null;
}

// The "Sound is off" warning. iOS puts the sound to sleep when he leaves the app and wakes it on
// Resume, so a check at the wrong moment sees it asleep. Shown only once the sound has been off
// for a full second while the session is running; any moment it's on clears it.
export function soundGate(delay = 1000) {
  let offSince = null;
  return (isOn, now, running) => {
    if (isOn || !running) { offSince = null; return false; }
    if (offSince === null) offSince = now;
    return now - offSince >= delay;
  };
}

// Where to pick a saved session up again: the step he was on, backed up to the get-ready
// before it if that was a work step, so he has time to put the phone down before "Go."
export function resumeIndex(session, saved) {
  const steps = session.steps;
  const last = steps.length - 2; // the last step before the end marker
  let i = saved.nSteps === steps.length && Number.isInteger(saved.step) ? saved.step : steps.findIndex((st) => st.drillNo === saved.drillNo);
  if (!(i >= 0)) i = 0;
  i = Math.min(i, last);
  if (steps[i].kind === 'work' && i > 0 && steps[i - 1].kind !== 'work' && steps[i - 1].drillNo === steps[i].drillNo) i -= 1;
  return i;
}

// Contract C7: at start-up, a session iOS closed less than two hours ago reopens on Paused.
// An older one is logged as ended, so what he did isn't lost.
export function resumeIfAny(app) {
  const saved = live.read();
  if (!saved) return false;
  live.clear();
  if (!saved.log || (saved.dad && saved.extra)) return false;
  migrateOldRecords({ log: [saved.log] }); // a session saved by an older version
  if (app.save.log.some((e) => e.date === saved.log.date)) return false;
  let session = null;
  try { if (SESSIONS[saved.type] && saved.ctx) session = buildSession(saved.type, saved.ctx); } catch {}
  if (!session) return false;
  if (!live.fresh(saved)) {
    const log = saved.log;
    log.stopped = log.stopped || { why: 'ended' };
    settle(session, log, saved.doneNos || [], saved.skippedNos || [], saved.drillNo || 1);
    log.secs = Math.round((saved.activeMs || 0) / 1000);
    app.save.log.push(log);
    app.persist();
    return false;
  }
  audio.preload(phrasesOf(session)).catch(() => {});
  app.go('player', { session, extra: !!saved.extra, dad: !!saved.dad, resume: saved });
  return true;
}

// dad: started from Dad's screen. extra: doesn't count. Both together is Dad's test run:
// skip buttons to click through quickly, and nothing is saved to his record.
export function render(root, app, { session, extra = false, dad = false, resume = null }) {
  const test = dad && extra;
  const log = resume?.log ?? {
    date: new Date().toISOString(),
    type: session.type,
    extra,
    dad,
    room: session.ctx.room,
    feel: session.ctx.feel,
    planned: session.drills,
    done: [],
    skipped: [],
    stopped: null,
    completed: false,
    secs: 0,
  };
  // Drill numbers (1-based, as on screen) whose work has started, and those he skipped.
  const doneNos = new Set(resume?.doneNos ?? []);
  const skippedNos = new Set(resume?.skippedNos ?? []);
  const carriedMs = resume?.activeMs ?? 0; // training time before iOS closed the app

  // The camera counts the finisher only when Dad has turned it on and the drill is one it knows.
  // With it off, none of the camera code below runs and its preview isn't on the page.
  const finNow = finisherOf(session);
  const camKind = finNow && app.save.camera?.on === true ? repKind(finNow.item.drill.id) : null;

  root.innerHTML = `
  <div class="player${test ? ' is-test' : ''}" data-phase="intro">
    <div class="pl-top"><span class="pl-where"></span><span class="pl-left"></span></div>
    <div class="pl-prog" aria-hidden="true">${'<i><b></b></i>'.repeat(session.drills)}</div>
    <div class="pl-phase"><span class="pl-word"></span><span class="pl-set"></span></div>
    <div class="pl-count"><div class="pl-clock"></div><div class="pl-unit" hidden></div></div>
    <div class="pl-name"></div>
    <div class="pl-bar" hidden><b></b></div>
    <div class="pl-target"></div>
    <div class="pl-board"><img class="pl-draw" alt=""></div>
    ${camKind ? '<div class="pl-cam" hidden><video class="pl-video" playsinline muted autoplay></video><p class="pl-camline"></p></div>' : ''}
    <div class="pl-cue"></div>
    <div class="pl-warn">
      <button class="pl-sound" data-act="fixSound" hidden>Sound is off. Tap to fix.</button>
      <p class="pl-awake" role="status" hidden>Screen may sleep. Turn off Auto-Lock in Settings.</p>
    </div>
    ${test ? `<div class="pl-dad">
      <button class="pbtn-dad" data-act="nextStep">Next step ›</button>
      <button class="pbtn-dad" data-act="nextDrill">Next drill »</button>
    </div>` : ''}
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
    clock: $('.pl-clock'), unit: $('.pl-unit'), name: $('.pl-name'), bar: $('.pl-bar'), barFill: $('.pl-bar b'),
    target: $('.pl-target'), draw: $('.pl-draw'), cue: $('.pl-cue'), sound: $('.pl-sound'), awake: $('.pl-awake'),
    done: $('.pbtn-done'), sheet: $('.sheet'), segs: [...root.querySelectorAll('.pl-prog b')],
  };
  let shownClock = '';
  let shownLeft = '';
  let shownBar = -1;
  let isReps = false;
  let finished = false;

  // The progress strip: one segment per drill, filling with the time spent on that drill's steps.
  // A circuit drill comes round twice, so its segment is half full after round one.
  const work = session.steps.filter((st) => st.kind !== 'end');
  const totals = new Array(session.drills + 1).fill(0);
  work.forEach((st) => { totals[st.drillNo] += st.dur; });
  const shownProg = [];
  function drawProgress(e) {
    const got = new Array(session.drills + 1).fill(0);
    for (const st of work) got[st.drillNo] += Math.min(st.dur, Math.max(0, e - st.start));
    for (let k = 1; k <= session.drills; k++) {
      const f = totals[k] ? Math.round((got[k] / totals[k]) * 100) / 100 : 1;
      if (shownProg[k] !== f && el.segs[k - 1]) { shownProg[k] = f; el.segs[k - 1].style.transform = `scaleX(${f})`; }
    }
  }

  const doneNow = () => [...doneNos].filter((n) => !skippedNos.has(n));

  // His best on today's finisher, shown on its work step: "Best: 14", or "First time".
  const fin = finisherOf(session);
  const finBest = fin ? bestFor(app.save.records, fin.item.drill.id, fin.item.v) : null;
  const finLine = finBest ? `Your best: ${finBest.n}` : 'No best yet';

  // ---- The camera on the finisher (only when camKind) ----
  // Starts on the finisher's intro, stops the moment its work step ends, and on Pause, Stop,
  // leaving the app and any error. Nothing here is awaited, so the timer never waits for it.
  const camBox = root.querySelector('.pl-cam');
  let cam = null;         // the running camera, or null
  let camCtr = null;      // the counter, kept across a pause
  let camCount = 0;       // reps the camera counted
  let camDead = false;    // failed once this session: Done stays as it is today
  let camLib = null;
  let camLost = false;     // no body seen for 3 s
  let targetBase = '';    // the target line under the name, without the reps
  function camLine(text) { if (camBox) camBox.querySelector('.pl-camline').textContent = text; }
  function showReps() {
    if (cam && runner.current().finisher && runner.current().kind === 'work') el.target.textContent = [`Reps: ${camCount}`, targetBase].filter(Boolean).join(' · ');
  }
  function camStop() {
    try { cam?.stop(); } catch {}
    cam = null;
    camLost = false;
    if (camBox) camBox.hidden = true;
  }
  function camGone() { camDead = true; camStop(); try { el.target.textContent = targetBase; } catch {} }
  function camStep(st) {
    if (!camKind || camDead) return;
    const inFin = st.finisher && (st.kind === 'intro' || st.kind === 'work');
    if (!inFin || runner.paused || finished) { camStop(); return; }
    camBox.dataset.at = st.kind;
    camLine(st.kind === 'intro' ? 'Stand where the camera can see all of you.' : camLost ? 'The camera can\'t see you.' : '');
    camBox.hidden = false;
    if (cam) { showReps(); return; }
    const mine = cam = { stop() { this.dead = true; this.h?.stop(); } };
    (camLib ? Promise.resolve(camLib) : import('../camera.js')).then((lib) => {
      camLib = lib;
      if (mine.dead || cam !== mine) return;
      camCtr ||= lib.newCounter(camKind);
      // On the intro, the model loads once the spoken intro is over (it starts at 0.3 s and runs
      // about 5 s) and before the countdown beeps (the last 3 s).
      const now = runner.current();
      const waitMs = now.finisher && now.kind === 'intro' ? Math.max(0, (CAM_QUIET - (runner.elapsed() - now.start)) * 1000) : 0;
      mine.h = lib.runCamera(camBox.querySelector('video'), camCtr, {
        waitMs,
        onCount: (n) => { camCount = n; showReps(); },
        onLost: (gone) => { camLost = gone; if (runner.current().kind === 'work') camLine(gone ? 'The camera can\'t see you.' : ''); },
        onFail: () => { if (cam === mine) camGone(); },
      });
      showReps();
    }).catch(() => { if (cam === mine) camGone(); });
  }
  const safeCam = (st) => { try { camStep(st); } catch { try { camGone(); } catch {} } };

  function phaseWord(st) {
    if (st.kind === 'intro') return st.i === 0 ? 'First up' : st.finisher ? 'Finisher' : 'Up next';
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
    const reps = repsOf(st);
    isReps = !!reps;
    el.player.dataset.phase = st.kind;
    el.player.classList.toggle('is-reps', isReps);
    el.word.textContent = phaseWord(st);
    el.set.textContent = setLine(st);
    el.name.textContent = r.name;
    // On a rep set the target is the big number already; keep only Dad's version line or the note.
    const how = r.how || r.note;
    // The finisher's work step shows his best instead of the target. No number is spoken.
    const first = st.finisher && st.kind === 'work' ? finLine : r.target;
    targetBase = (isReps ? [how] : [first, how]).filter(Boolean).join(' · ');
    el.target.textContent = targetBase;
    if (el.draw.getAttribute('src') !== r.draw) el.draw.src = r.draw;
    el.draw.alt = `Drawing of ${r.name}`;
    if (st.kind === 'intro') el.cue.textContent = r.drill.cues[0];
    el.done.hidden = !(st.kind === 'work' && st.reps);
    el.where.textContent = `${session.name} · ${st.drillNo} of ${session.drills}`;
    el.unit.hidden = !isReps;
    el.bar.hidden = !isReps;
    if (isReps) {
      el.clock.textContent = String(reps.n);
      el.clock.classList.remove('long');
      el.unit.textContent = reps.unit;
      shownClock = '';
      shownBar = -1;
    }
    if (st.kind === 'work') {
      doneNos.add(st.drillNo);
      skippedNos.delete(st.drillNo); // skipped in round one, done in round two: he did it
    }
    keep();
    if (camKind) safeCam(st);
  }

  function onTick(e, st) {
    if (st.kind === 'end') return;
    if (isReps) {
      // The window drains as a bar under the name; the rep count stays put.
      const f = Math.round((Math.max(0, st.start + st.dur - e) / st.dur) * 200) / 200;
      if (f !== shownBar) { shownBar = f; el.barFill.style.transform = `scaleX(${f})`; }
    } else {
      const c = clock(st.start + st.dur - e);
      if (c !== shownClock) {
        shownClock = c;
        el.clock.textContent = c;
        el.clock.classList.toggle('long', c.length > 2);
      }
    }
    const l = mmss(session.total - e);
    if (l !== shownLeft) { shownLeft = l; el.left.textContent = `${l} left`; }
    drawProgress(e);
    const warn = sound(audio.soundOn(), performance.now(), !runner.paused && el.sheet.hidden);
    if (el.sound.hidden === warn) el.sound.hidden = !warn;
  }
  const sound = soundGate();

  function flash() {
    const t = isReps ? el.bar : el.clock;
    t.classList.remove('flash');
    void t.offsetWidth;
    t.classList.add('flash');
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

  // Saved at every step, on Pause and when the app is hidden, so iOS closing it loses nothing.
  // Dad's test runs are never saved.
  function keep() {
    if (test || finished || runner.idx < 0) return;
    live.keep({
      type: session.type, ctx: session.ctx, extra, dad, log,
      doneNos: [...doneNos], skippedNos: [...skippedNos],
      step: runner.idx, drillNo: runner.current().drillNo, nSteps: session.steps.length,
      activeMs: carriedMs + runner.activeMs(),
    });
  }

  function finish(ranToEnd) {
    if (finished) return;
    finished = true;
    if (camKind) camStop();
    runner.stop();
    if (!ranToEnd) audio.hush();
    letSleep();
    settle(session, log, [...doneNos], [...skippedNos], ranToEnd ? session.drills : runner.current().drillNo);
    log.secs = Math.round((carriedMs + runner.activeMs()) / 1000);
    // What the camera counted, for Done to start from. Nothing when it counted none.
    if (camCount > 0 && log.finisher) log.finisher.cam = camCount;
    if (test) log.test = true; // contract C6: shown on Done, never in his record
    else {
      app.save.log.push(log);
      app.persist();
    }
    // Only now: if iOS closes the app between the two, resumeIfAny() sees it's already logged.
    live.clear();
    app.go('done', { session, log });
  }

  // Sheets: pause and end.
  function sheet(html, kind = '') {
    el.sheet.innerHTML = `<div class="sheet-card${kind ? ` sheet-${kind}` : ''}">${html}</div>`;
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

  // Ending asks once, with how far he got. Keep going sits where the last tap was.
  function endSheet() {
    const c = credit(session, doneNow());
    const got = `You've done ${c.done} of ${session.drills} drills.`;
    const line = extra ? got
      : !c.short ? `${got} That's enough for it to count.`
      : c.short === 'half' ? `${got} It counts once you reach ${c.need}.`
      : `${got} It counts once you do half of the main drills.`;
    sheet(`
      <h2>End now?</h2>
      <p class="sheet-line">${esc(line)}</p>
      <button class="btn" data-act="endNow">End the session</button>
      <button class="btn btn-go" data-act="resume">Keep going</button>`);
  }

  function skipToNextDrill() {
    runner.jumpTo(runner.nextDrillIndex());
    closeSheet();
    audio.unlock();
    runner.resume();
    if (camKind) safeCam(runner.current());
  }

  on(root, {
    pause: () => { runner.pause(); audio.hush(); if (camKind) camStop(); pauseSheet(); keep(); },
    resume: () => { closeSheet(); audio.unlock(); holdScreen(); runner.resume(); if (camKind) safeCam(runner.current()); },
    done: () => { audio.hush(); runner.jumpTo(runner.afterCurrent()); },
    nextStep: () => { if (!test) return; audio.hush(); runner.jumpTo(runner.afterCurrent()); },
    nextDrill: () => { if (!test) return; audio.hush(); runner.jumpTo(runner.nextDrillIndex()); },
    stop: () => { runner.pause(); audio.hush(); if (camKind) camStop(); endSheet(); keep(); },
    endSession: () => endSheet(),
    endNow: () => { log.stopped = { why: 'ended' }; finish(false); },
    // One tap: the drill is skipped and the next one starts.
    skip: () => {
      const st = runner.current();
      log.skipped.push({ id: st.r?.drill.id, no: st.drillNo, why: 'here' });
      skippedNos.add(st.drillNo);
      skipToNextDrill();
    },
    fixSound: async () => {
      await audio.unlock();
      if (audio.soundOn()) el.sound.hidden = true;
    },
  });

  // Screen on: ask, and once more if the phone says no. Still no: say so on screen.
  let asks = 0;
  async function holdScreen() {
    const mine = ++asks;
    let ok = await keepAwake();
    if (!ok) {
      await new Promise((r) => setTimeout(r, 700));
      if (mine !== asks || finished) return;
      ok = await keepAwake();
    }
    if (mine === asks && !finished) el.awake.hidden = ok;
  }
  onLost(() => { if (!finished && !document.hidden) holdScreen(); });

  // Leaving the app pauses the session and saves it; coming back asks for the screen lock again.
  function onVisibility() {
    if (finished) return;
    if (document.hidden) {
      runner.pause();
      audio.hush();
      if (camKind) camStop();
      if (el.sheet.hidden) pauseSheet();
      keep();
    } else {
      holdScreen();
    }
  }
  const onPageHide = () => keep();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  if (resume) {
    runner.start({ at: resumeIndex(session, resume), paused: true });
    pauseSheet();
  } else {
    runner.start();
    holdScreen();
  }

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    onLost(null);
    if (camKind) camStop();
    runner.stop();
    letSleep();
  };
}
