// Turns a session template into a timed list of steps with voice cues.
// Pure functions: no DOM, so tests.mjs can run them in Node.
import { byId } from '../../data/exercises.js';
import { SESSIONS } from '../../data/sessions.js';
import { SAY, targetSay, targetText, setsSay, setSay } from '../../data/copy.js';

const INTRO_FIRST = 12;
const INTRO = 10;
const SWITCH = 5;
const MIN_GAP = 4; // seconds between two spoken cues

export function makeContext({ room = 'big', hour = new Date().getHours(), feel = 'good', ball = 'none', band = false } = {}) {
  return { room, hour, feel, ball, band, quiet: room === 'bedroom' || hour < 9, small: room === 'bedroom' };
}

// What he will actually do for one session item, after gear, room and time-of-day swaps.
export function resolveItem(item, ctx) {
  let drill = byId[item.id];
  let swappedFrom = null;
  let variant = null;
  const swapTo = (id) => { swappedFrom = swappedFrom || drill; drill = byId[id]; };

  if (drill.noBand && !ctx.band) swapTo(drill.noBand);
  if (drill.slam && ctx.ball !== 'dead' && typeof drill.quiet === 'string') swapTo(drill.quiet);

  let v = drill.start;
  let version = drill.versions[v];
  const noise = version.noise ?? drill.noise;
  const space = version.space ?? drill.space;
  if (((ctx.quiet && noise !== 'quiet') || (ctx.small && space === 'big')) && drill.quiet !== undefined) {
    const q = drill.quiet;
    if (typeof q === 'string') { swapTo(q); v = drill.start; }
    else if (typeof q === 'number') v = q;
    else variant = q;
  }
  if (drill.noBall !== undefined && ctx.ball === 'none') v = drill.noBall;
  version = drill.versions[v];

  const dose = { sets: 1, rest: 20, ...drill.dose, ...(version.dose || {}), ...(item.dose || {}) };
  if (ctx.feel === 'tired' && dose.sets > 1) dose.sets -= 1;
  const jumps = variant?.jumps ?? version.jumps ?? drill.jumps ?? 0;
  return {
    drill,
    v,
    version,
    variant,
    name: variant?.name ?? drill.name,
    how: variant?.how ?? version.how ?? null,
    note: item.note ?? null,
    dose,
    jumps,
    draw: `media/draw/${variant?.draw ?? drill.id}.webp`,
    swappedFrom,
    target: targetText(drill, dose),
  };
}

const ticks = (dur) => (dur >= 8 ? [{ at: dur - 3, beep: 'tick' }, { at: dur - 2, beep: 'tick' }, { at: dur - 1, beep: 'tick' }] : []);

// Drop spoken cues that would talk over each other.
function spaced(cues) {
  const out = [];
  let lastSay = -99;
  for (const c of cues.sort((a, b) => a.at - b.at)) {
    if (c.say) {
      if (c.at - lastSay < MIN_GAP && !c.must) continue;
      lastSay = c.at;
    }
    out.push(c);
  }
  return out;
}

function introStep(r, dur, o) {
  const words = [];
  if (o.roundWord) words.push(o.roundWord);
  words.push(o.first ? SAY.firstUp : SAY.next, `${r.name}.`, targetSay(r.drill, r.dose));
  if (o.sets > 1) words.push(setsSay(o.sets));
  if (r.drill.side && !r.drill.alternate) words.push(SAY.start[r.drill.side]);
  if (r.variant?.how) words.push(r.variant.how);
  words.push(r.drill.cues[0]);
  const cues = [{ at: 0, beep: o.first ? null : 'end' }, { at: 0.3, say: words, must: true }, ...ticks(dur)];
  return { kind: 'intro', dur, r, set: 0, sets: o.sets, round: o.round, rounds: o.rounds, cues: cues.filter((c) => c.beep !== null) };
}

function workStep(r, dur, o) {
  const d = r.drill;
  const cues = [
    { at: 0, beep: 'go' },
    { at: 0.05, say: [d.goWord || SAY.go], must: true },
  ];
  if (o.splitAt) cues.push({ at: o.splitAt, say: [SAY.switch[d.side]], must: true }, { at: o.splitAt, beep: 'tick' });
  if (dur >= 20 && d.cues[1]) cues.push({ at: Math.round(dur * 0.4), say: [d.cues[1]] });
  if (dur >= 30) cues.push({ at: Math.round(dur * 0.7), say: [d.hold ? SAY.keepBreathing : d.cues[2] || SAY.keepBreathing] });
  if (dur >= 30) cues.push({ at: dur - 10, say: [SAY.tenSeconds] });
  cues.push(...ticks(dur));
  return { kind: 'work', dur, r, set: o.set, sets: o.sets, side: o.side || null, round: o.round, rounds: o.rounds, reps: r.dose.type === 'reps', cues: spaced(cues) };
}

function restStep(r, dur, o) {
  const d = r.drill;
  const cues = [{ at: 0, beep: 'end' }, { at: 0.05, say: [d.restWord || SAY.rest], must: true }];
  if (dur >= 8) cues.push({ at: dur - 5, say: [o.nextSet === o.sets ? SAY.lastSet : setSay(o.nextSet)], must: true });
  cues.push(...ticks(dur));
  return { kind: 'rest', dur, r, set: o.nextSet, sets: o.sets, restWord: d.restWord, cues };
}

function switchStep(r, o) {
  const cues = [{ at: 0, beep: 'end' }, { at: 0.05, say: [SAY.switch[r.drill.side]], must: true }];
  return { kind: 'switch', dur: SWITCH, r, set: o.set, sets: o.sets, cues };
}

export function buildSession(type, ctx) {
  const s = SESSIONS[type];
  const items = [];
  const steps = [];
  let first = true;

  for (const block of s.blocks) {
    if (block.circuit) {
      const rounds = Math.max(1, block.circuit.rounds - (ctx.feel === 'tired' ? 1 : 0));
      const work = block.circuit.work;
      const resolved = block.items.map((it) => resolveItem(it, ctx));
      resolved.forEach((r) => items.push({ ...r, block: block.name, sets: rounds, circuit: true }));
      for (let round = 1; round <= rounds; round++) {
        resolved.forEach((r, k) => {
          const split = r.drill.side && !r.drill.alternate;
          const roundWord = k === 0 && round > 1 ? (round === rounds ? SAY.lastRound : SAY.roundTwo) : null;
          steps.push(introStep(r, first ? INTRO_FIRST : block.circuit.change, { first, sets: 1, round, rounds, roundWord }));
          first = false;
          steps.push(workStep(r, work, { set: round, sets: rounds, round, rounds, splitAt: split ? work / 2 : null }));
        });
      }
    } else {
      for (const it of block.items) {
        const r = resolveItem(it, ctx);
        const sets = r.dose.sets;
        items.push({ ...r, block: block.name, sets });
        steps.push(introStep(r, first ? INTRO_FIRST : INTRO, { first, sets }));
        first = false;
        const dur = r.dose.type === 'reps' ? r.dose.window : r.dose.time;
        for (let set = 1; set <= sets; set++) {
          if (r.drill.side && !r.drill.alternate) {
            steps.push(workStep(r, dur, { set, sets, side: 'L' }));
            steps.push(switchStep(r, { set, sets }));
            steps.push(workStep(r, dur, { set, sets, side: 'R' }));
          } else {
            steps.push(workStep(r, dur, { set, sets }));
          }
          if (set < sets) steps.push(restStep(r, r.dose.rest, { nextSet: set + 1, sets }));
        }
      }
    }
  }
  // The player plays the end beep and "That's the session" itself, because the runner stops on this step.
  steps.push({ kind: 'end', dur: 0, r: null, cues: [] });

  let t = 0;
  steps.forEach((st, i) => { st.i = i; st.start = t; t += st.dur; });
  // Number each drill so the player can show "4 of 9". A circuit's second round reuses the numbers.
  const nums = new Map();
  let drillNo = 0;
  steps.forEach((st) => {
    if (st.r && !nums.has(st.r)) nums.set(st.r, ++drillNo);
    st.drillNo = st.r ? nums.get(st.r) : drillNo;
  });
  const jumps = items.reduce((n, it) => n + it.jumps * (it.circuit ? it.sets : it.sets * (it.drill.side && !it.drill.alternate ? 2 : 1)), 0);
  return { type, name: s.name, blurb: s.blurb, items, steps, total: t, drills: drillNo, jumps, ctx };
}

// Every phrase a session can speak, for the voice recorder and the preloader.
export function phrasesOf(session) {
  const set = new Set([SAY.sessionDone]);
  for (const st of session.steps) for (const c of st.cues) if (c.say) c.say.forEach((p) => set.add(p));
  return [...set];
}
