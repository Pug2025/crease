// Turns a session template into a timed list of steps with voice cues.
// Pure functions: no DOM, so tests.mjs can run them in Node.
import { DRILLS, byId } from '../../data/exercises.js';
import { SESSIONS, SESSION_ORDER, FINISHER, BOSS } from '../../data/sessions.js';
import { LADDER } from '../../data/splits.js';
import { SAY, targetSay, targetText, setsSay, setSay, countSay } from '../../data/copy.js';

const INTRO_FIRST = 12;
const INTRO = 10;
const SWITCH = 5;
const MIN_GAP = 4; // seconds between two spoken cues

// room: 'bedroom' swaps every drill that needs about 3 m of space. Before 9 am only slams swap
// (Dad, 10 Nov 2026: jumping in the morning is fine; slams would still wake the house).
// versions: Dad's chosen version per drill id ({ ST1: 0 }); anything not listed uses the drill's start.
// avoid: drill ids left out of this session. noJumps: every drill with jumps uses its no-jump version.
// ladder: today's splits hold as a session item ({ id, as }), or null while the ladder rests.
// rot: counted sessions of this type he has done (picks the drills that change).
// fin: finishers of this type he has done (picks the finisher). boss: a Boss day (Strength only).
// All three are kept in the saved session, so a resumed session rebuilds the same.
export function makeContext({ room = 'big', hour = new Date().getHours(), feel = 'good', versions = {}, avoid = [], noJumps = false, ladder = null, rot = 0, fin = 0, boss = false } = {}) {
  return { room, hour, feel, versions, avoid: [...(avoid || [])], noJumps: !!noJumps, ladder, small: room === 'bedroom', early: hour < 9, rot: count(rot), fin: count(fin), boss: !!boss };
}
const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

// The jump cap: 50 foot landings a session (PLAN.md, jump caps). tests.mjs holds every build to it.
export const JUMP_CAP = 50;

const chosenVersion = (drill, ctx) => {
  const v = ctx.versions?.[drill.id];
  return Number.isInteger(v) && v >= 0 && v < drill.versions.length ? v : drill.start;
};

// What he will actually do for one session item, after Dad's version, jumps off, and room and
// time-of-day swaps. Returns null when the drill is left out (ctx.avoid).
// `drill` is a copy whose name and cues are already the ones for the version he does.
export function resolveItem(item, ctx) {
  const avoid = new Set(ctx.avoid || []);
  if (avoid.has(item.id)) return null;
  let drill = byId[item.id];
  let swappedFrom = null;
  let variant = null;
  let v = chosenVersion(drill, ctx);
  const apply = (to) => {
    if (typeof to === 'string') { swappedFrom = swappedFrom || drill; drill = byId[to]; v = chosenVersion(drill, ctx); variant = null; }
    else if (typeof to === 'number') v = to;
    else variant = to;
  };
  for (let pass = 0; pass < 3; pass++) {
    const ver = drill.versions[v];
    const jumpy = (variant?.jumps ?? ver.jumps ?? drill.jumps ?? 0) > 0 || !!(variant?.hops ?? ver.hops ?? drill.hops);
    const space = variant ? 'small' : ver.space ?? drill.space;
    if (ctx.noJumps && jumpy && drill.noJump !== undefined) { apply(drill.noJump); continue; }
    if (!variant && ((ctx.small && space === 'big') || (ctx.early && drill.slam)) && drill.bedroom !== undefined) { apply(drill.bedroom); continue; }
    break;
  }
  if (avoid.has(drill.id)) return null;

  const version = drill.versions[v];
  // `as` overrides the drill for this one item, after every swap. The splits ladder uses it: four
  // of its rungs are the same hold with a different stack under him.
  const as = item.as || null;
  const dose = { sets: 1, rest: 20, ...drill.dose, ...(version.dose || {}), ...(as?.dose || {}), ...(item.dose || {}) };
  if (ctx.feel === 'tired' && dose.sets > 1) dose.sets -= 1;
  const name = as?.name ?? variant?.name ?? version.title ?? drill.name;
  const cues = as?.cues ?? variant?.cues ?? version.cues ?? drill.cues;
  const why = as?.why ?? variant?.why ?? version.why ?? drill.why;
  const mistake = as?.mistake ?? variant?.mistake ?? version.mistake ?? drill.mistake;
  return {
    drill: { ...drill, name, cues, why, mistake },
    v,
    version,
    variant,
    name,
    cues,
    how: as?.how ?? variant?.how ?? version.how ?? null,
    note: item.note ?? null,
    dose,
    jumps: variant?.jumps ?? version.jumps ?? drill.jumps ?? 0,
    hops: !!(variant?.hops ?? version.hops ?? drill.hops),
    needs: as?.needs ?? variant?.needs ?? version.needs ?? drill.needs ?? [],
    draw: `media/draw/${as?.draw ?? variant?.draw ?? version.draw ?? drill.id}.webp`,
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

// The intro says what's next and how. The version's line (or the session's note) replaces the
// first cue, so the voice says what he's actually doing and still finishes well before "Go."
function introStep(r, dur, o) {
  const words = [];
  if (o.roundWord) words.push(o.roundWord);
  if (o.first) words.push(SAY.firstUp);
  words.push(`${r.name}.`, targetSay(r.drill, r.dose));
  if (o.sets > 1) words.push(setsSay(o.sets));
  if (r.drill.side && !r.drill.alternate) words.push(SAY.start[r.drill.side]);
  words.push(r.how || r.note || r.cues[0]);
  const cues = [{ at: 0, beep: o.first ? null : 'end' }, { at: 0.3, say: words, must: true }, ...ticks(dur)];
  return { kind: 'intro', dur, r, set: 0, sets: o.sets, round: o.round, rounds: o.rounds, cues: cues.filter((c) => c.beep !== null) };
}

// The coach counts a rep set out loud: "One." to the last rep, spread evenly over the set's time,
// so the count is also the pace. A set done on each side is counted once per side. Not counted:
// drills that go side to side every rep ("4 each way" is 8 moves, and one count can't say both),
// and sets of fewer than COUNT.min reps.
export const COUNT = { min: 3, tail: 1.5, cueRoom: 2.5 };
export function counted(r, o = {}) {
  const d = r.drill;
  if (r.dose.type !== 'reps' || r.dose.reps < COUNT.min || d.alternate) return false;
  return !d.side || !!o.splitAt || !!o.side;
}
// The count's cues. A coaching line (extras: [{ at, say }]) rides on the number nearest its time,
// "Three. Chest to the floor.", so the two never talk over each other.
function countCues(r, dur, o, extras) {
  const n = r.dose.reps;
  const spans = o.splitAt ? [[0, o.splitAt], [o.splitAt, dur]] : [[0, dur]];
  const out = [];
  let pace = dur;
  for (const [a, b] of spans) {
    pace = (b - a - COUNT.tail) / n;
    for (let k = 1; k <= n; k++) out.push({ at: Math.round((a + k * pace) * 10) / 10, say: [countSay(k)], must: true, count: k });
  }
  if (pace >= COUNT.cueRoom) {
    for (const x of extras) {
      const free = out.filter((c) => c.say.length === 1 && c.count < n);
      if (!free.length) break;
      free.reduce((best, c) => (Math.abs(c.at - x.at) < Math.abs(best.at - x.at) ? c : best)).say.push(x.say);
    }
  }
  return out;
}

function workStep(r, dur, o) {
  const d = r.drill;
  const cues = [
    { at: 0, beep: 'go' },
    { at: 0.05, say: [d.goWord || (r.jumps > 0 ? SAY.goLandSoft : SAY.go)], must: true },
  ];
  if (o.splitAt) cues.push({ at: o.splitAt, say: [SAY.switch[d.side]], must: true }, { at: o.splitAt, beep: 'tick' });
  // The second cue on sets of 20 s or more, and on every jump set (that's the landing cue).
  const second = Math.round(dur * 0.4);
  const third = Math.max(second + MIN_GAP, Math.min(Math.round(dur * 0.7), dur - 10 - MIN_GAP));
  if (counted(r, o)) {
    // A counted set: the coaching lines ride on the count, and "Ten seconds." isn't said.
    const extras = [];
    if ((dur >= 20 || r.jumps > 0) && r.cues[1]) extras.push({ at: second, say: r.cues[1] });
    if (dur >= 30) extras.push({ at: third, say: r.cues[2] || SAY.keepBreathing });
    cues.push(...countCues(r, dur, o, extras));
  } else {
    if ((dur >= 20 || r.jumps > 0) && r.cues[1]) cues.push({ at: second, say: [r.cues[1]] });
    if (dur >= 30) {
      // The third cue (on most drills, the one that fixes the usual mistake), clear of "Ten seconds."
      cues.push({ at: third, say: [r.cues[2] || SAY.keepBreathing] });
      cues.push({ at: dur - 10, say: [SAY.tenSeconds] });
    }
  }
  cues.push(...ticks(dur));
  const reps = r.dose.type === 'reps' ? r.dose.reps : undefined;
  return {
    kind: 'work', dur, r, set: o.set, sets: o.sets, side: o.side || null, round: o.round, rounds: o.rounds,
    reps, repUnit: reps === undefined ? undefined : d.side ? `each ${d.side}` : 'reps',
    cues: spaced(cues),
  };
}

// Between sets. In a circuit (o.circuit) it fills the rest of a hold's slot: no set call and no
// countdown ticks, because the next thing is the next drill's intro, not "Go."
function restStep(r, dur, o) {
  const d = r.drill;
  const cues = [{ at: 0, beep: 'end' }, { at: 0.05, say: [d.restWord || SAY.rest], must: true }];
  if (!o.circuit) {
    if (dur >= 8) cues.push({ at: dur - 5, say: [o.nextSet === o.sets ? SAY.lastSet : setSay(o.nextSet)], must: true });
    cues.push(...ticks(dur));
  }
  return { kind: 'rest', dur, r, set: o.nextSet, sets: o.sets, round: o.round, rounds: o.rounds, restWord: d.restWord, cues };
}

function switchStep(r, o) {
  const cues = [{ at: 0, beep: 'end' }, { at: 0.05, say: [SAY.switch[r.drill.side]], must: true }];
  return { kind: 'switch', dur: SWITCH, r, set: o.set, sets: o.sets, cues };
}

// Things to fetch before he starts, as the preview says them ("Grab: the med ball and a towel.").
const GRAB = { 'med ball': 'the med ball', pillow: 'a pillow', towel: 'a towel', chair: 'a chair', cushions: 'some cushions' };

// The drills that change: a block with `rotate` adds the pair for this session, by ctx.rot.
export function rotationOf(block, rot = 0) {
  if (!block.rotate) return block.items;
  return [...block.items, ...block.rotate[count(rot) % block.rotate.length].map((id) => ({ id }))];
}

// Today's finisher, resolved like any item (Dad's version, jumps off, room, left out), as a
// FINISHER.window-second set. null on any other session, or when every choice is left out.
// Power's burpees are always FINISHER.powerVersion (Step-Back Burpees, no jumps), whatever the
// room, the hour or Dad's burpee version: no landings after the jump work, and one record line.
export function finisherFor(type, ctx) {
  const pool = FINISHER[type];
  if (!pool) return null;
  const dose = { type: 'time', time: FINISHER.window, sets: 1 };
  const get = (id, c = ctx) => resolveItem({ id, dose }, c);
  if (type === 'strength') {
    const start = count(ctx.fin) % pool.length;
    for (let k = 0; k < pool.length; k++) {
      const r = get(pool[(start + k) % pool.length]);
      if (r) return r;
    }
    return null;
  }
  const id = pool[count(ctx.fin) % pool.length];
  let r = ctx.noJumps ? null : get(id, { ...ctx, versions: { ...(ctx.versions || {}), [id]: FINISHER.powerVersion } });
  if (r?.swappedFrom) r = null; // the room swapped it for something else: squats instead
  return r || get(FINISHER.powerFallback);
}

// Today's splits hold goes in its own block just before the cool-down, on a warm body.
// The Splits session has the ladder as its own main block, so nothing is added there.
// The finisher block goes in just before that, after the main work.
function blocksOf(s, ctx, type) {
  let blocks = s.blocks.map((b) => (b.rotate ? { ...b, items: rotationOf(b, ctx.rot) } : b));
  if (FINISHER[type]) blocks = [...blocks.slice(0, -1), { name: 'Finisher', finisher: true, items: [] }, blocks.at(-1)];
  const own = blocks.findIndex((b) => b.name === 'Splits');
  if (own >= 0) return ctx.ladder ? blocks.map((b, i) => (i === own ? { ...b, items: [ctx.ladder] } : b)) : blocks;
  // Never on a game day: a long static stretch right before he plays takes power out of his legs.
  if (!ctx.ladder || s.noLadder) return blocks;
  return [...blocks.slice(0, -1), { name: 'Splits', items: [ctx.ladder] }, blocks.at(-1)];
}

// The finisher's intro: "Finisher.", the drill, "As many as you can.", the window, then Dad's
// version line, if any. A drill done on each side hears "Switch sides." halfway through the work;
// "Left side first." is left out so the version line still starts inside the voice's limit.
function finisherIntro(r, dur, first) {
  const words = [SAY.finisher, `${r.name}.`, SAY.asMany, targetSay({}, { type: 'time', time: FINISHER.window })];
  if (r.how) words.push(r.how);
  const cues = [{ at: 0, beep: first ? null : 'end' }, { at: 0.3, say: words, must: true }, ...ticks(dur)];
  return { kind: 'intro', dur, r, set: 0, sets: 1, finisher: true, cues: cues.filter((c) => c.beep !== null) };
}

// Foot landings in one session item.
const jumpsOf = (it) => it.jumps * (it.circuit ? it.sets : it.sets * (it.drill.side && !it.drill.alternate ? 2 : 1));

export function buildSession(type, ctx) {
  const s = SESSIONS[type];
  const items = [];
  const steps = [];
  let first = true;

  const boss = !!ctx.boss && type === 'strength';
  for (const block of blocksOf(s, ctx, type)) {
    if (block.finisher) {
      const r0 = finisherFor(type, ctx);
      if (!r0) continue;
      const r = { ...r0, target: `As many as you can in ${FINISHER.window} s`, finisher: true };
      items.push({ ...r, block: block.name, main: false, sets: 1 });
      steps.push(finisherIntro(r, INTRO_FIRST, first));
      first = false;
      const split = !!(r.drill.side && !r.drill.alternate);
      const work = workStep(r, FINISHER.window, { set: 1, sets: 1, splitAt: split ? FINISHER.window / 2 : null });
      steps.push({ ...work, finisher: true });
      continue;
    }
    if (block.circuit) {
      // A Boss day runs the circuit one more round.
      const rounds = Math.max(1, (boss ? BOSS.rounds : block.circuit.rounds) - (ctx.feel === 'tired' ? 1 : 0));
      const work = block.circuit.work;
      // Each station is a slot of `work` seconds. A rep station gets its own window, up to the slot.
      // A hold gets its version's time, up to the slot, and the rest of the slot is a short rest.
      // A station done on each side splits the slot in two.
      const stations = block.items.map((it) => {
        const r0 = resolveItem(it, ctx);
        if (!r0) return null;
        const split = !!(r0.drill.side && !r0.drill.alternate);
        let dose;
        let dur = work;
        let rest = 0;
        if (split) dose = r0.dose.type === 'time' ? { time: work / 2 } : { window: work / 2 };
        else if (r0.dose.type === 'time') { dur = Math.min(work, r0.dose.time); dose = { time: dur }; rest = work - dur; }
        else { dur = Math.min(work, r0.dose.window); dose = { window: dur }; }
        const r = resolveItem({ ...it, dose: { ...(it.dose || {}), ...dose } }, ctx);
        return { r, dur, rest: rest >= 5 ? rest : 0, split };
      }).filter(Boolean);
      stations.forEach(({ r }) => items.push({ ...r, block: block.name, main: !!block.main, sets: rounds, circuit: true }));
      for (let round = 1; round <= rounds; round++) {
        stations.forEach(({ r, dur, rest, split }, k) => {
          const roundWord = k === 0 && round > 1 ? (round === rounds ? SAY.lastRound : SAY.roundTwo) : null;
          steps.push(introStep(r, first ? INTRO_FIRST : block.circuit.change, { first, sets: 1, round, rounds, roundWord }));
          first = false;
          steps.push(workStep(r, dur, { set: round, sets: rounds, round, rounds, splitAt: split ? dur / 2 : null }));
          if (rest) steps.push(restStep(r, rest, { circuit: true, nextSet: round, sets: rounds, round, rounds }));
        });
      }
    } else {
      for (const it of block.items) {
        const r = resolveItem(it, ctx);
        if (!r) continue;
        const sets = r.dose.sets;
        items.push({ ...r, block: block.name, main: !!block.main, sets });
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
  const jumps = items.reduce((n, it) => n + jumpsOf(it), 0);
  const grab = Object.keys(GRAB).filter((g) => items.some((it) => it.needs.includes(g))).map((g) => GRAB[g]);
  return { type, name: boss ? 'Boss day' : s.name, boss, blurb: s.blurb, items, steps, total: t, drills: drillNo, jumps, grab, ctx };
}

// The finisher in a built session: its item and its drill number, or null.
export function finisherOf(session) {
  const k = session.items.findIndex((it) => it.finisher);
  return k < 0 ? null : { item: session.items[k], no: k + 1 };
}

// Every phrase a session can speak, for the voice recorder and the preloader.
export function phrasesOf(session) {
  const set = new Set([SAY.sessionDone]);
  for (const st of session.steps) for (const c of st.cues) if (c.say) c.say.forEach((p) => set.add(p));
  return [...set];
}

// Every rung of the splits ladder, in the Splits session and in a normal one. The rungs aren't in
// everyContext (they aren't a version Dad sets), so the tests and the voice recorder read this too.
export function everyLadder() {
  const out = [];
  for (const r of LADDER) {
    const ladder = { id: r.id, as: { name: r.name, ...(r.how ? { how: r.how } : {}) } };
    for (const type of ['splits', 'stretch', 'strength'])
      for (const room of ['bedroom', 'big'])
        out.push({ type, rung: r.n, tag: `rung${r.n}/${type}/${room}`, ctx: makeContext({ room, hour: 15, ladder }) });
  }
  return out;
}

// Every way a session can be built: both rooms, morning and afternoon, each version Dad can set,
// and with jumps off and drills left out. The tests check them all; the voice recorder records them all.
// Strength and Power also run every rotation: k from 0 to 11 covers each pair of changing drills
// (4 for Strength, 3 for Power) with each finisher (3 for Strength), and every other Strength is a Boss day.
export const ROTATIONS = 12;
export function everyContext() {
  const at = (v) => Object.fromEntries(DRILLS.map((d) => [d.id, Math.min(v, d.versions.length - 1)]));
  const versionSets = [['start', {}], ['easier', at(0)], ['standard', at(1)], ['harder', at(2)]];
  const limits = [['all', {}], ['nojumps', { noJumps: true }], ['avoid', { noJumps: true, avoid: ['ST2', 'S3', 'S4', 'P13'] }]];
  const out = [];
  for (const type of SESSION_ORDER)
    for (const room of ['bedroom', 'big'])
      for (const hour of [7, 15])
        for (const [vname, versions] of versionSets)
          for (const [lname, lim] of limits) {
            if (!FINISHER[type]) {
              out.push({ type, vname, lname, tag: `${type}/${room}/${hour}h/${vname}/${lname}`, ctx: makeContext({ room, hour, versions, ...lim }) });
              continue;
            }
            for (let k = 0; k < ROTATIONS; k++) {
              const boss = type === 'strength' && k % 2 === 1;
              out.push({ type, vname, lname, rot: k, boss, tag: `${type}/${room}/${hour}h/${vname}/${lname}/r${k}${boss ? '/boss' : ''}`, ctx: makeContext({ room, hour, versions, ...lim, rot: k, fin: k, boss }) });
            }
          }
  return out;
}
