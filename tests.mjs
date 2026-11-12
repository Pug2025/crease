// Crease checks. Run: node tests.mjs  (deploy.sh refuses to publish if any fail)
import fs from 'node:fs';
import { DRILLS, byId } from './data/exercises.js';
import { SESSIONS, SESSION_ORDER } from './data/sessions.js';
import { DEMOS } from './data/demos.js';
import { SPLIT_DRILLS, LADDER, TOP, HOLDS } from './data/splits.js';
import { buildSession, makeContext, phrasesOf, resolveItem, everyContext, everyLadder } from './js/plan/build.js';

let failed = 0;
let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('FAIL', msg); } };

// 1. The drill file is complete and consistent.
const ids = new Set();
for (const d of [...DRILLS, ...SPLIT_DRILLS]) {
  ok(!ids.has(d.id), `${d.id}: id used twice`);
  ids.add(d.id);
  for (const f of ['name', 'group', 'noise', 'space', 'why', 'mistake', 'dose'])
    ok(d[f] !== undefined && d[f] !== '', `${d.id}: missing ${f}`);
  ok(['quiet', 'thud', 'loud'].includes(d.noise), `${d.id}: noise must be quiet, thud or loud`);
  ok(['small', 'big'].includes(d.space), `${d.id}: space must be small or big`);
  ok(Array.isArray(d.cues) && d.cues.length >= 2 && d.cues.length <= 3, `${d.id}: needs 2 or 3 cues`);
  ok(Array.isArray(d.versions) && d.versions.length >= 1, `${d.id}: needs versions`);
  ok(d.start >= 0 && d.start < d.versions.length, `${d.id}: start points at a version that doesn't exist`);
  ok(['time', 'reps'].includes(d.dose.type), `${d.id}: dose type must be time or reps`);
  if (d.dose.type === 'reps') ok(d.dose.reps > 0 && d.dose.window > 0, `${d.id}: reps dose needs reps and window`);
  if (d.dose.type === 'time') ok(d.dose.time > 0, `${d.id}: time dose needs time`);
  if (d.side) ok(['leg', 'side', 'way'].includes(d.side), `${d.id}: side must be leg, side or way`);
  // Swaps: the bedroom (big-space drills, and slams before 9 am) and jumps off.
  for (const f of ['bedroom', 'noJump']) {
    if (typeof d[f] === 'string') ok(byId[d[f]], `${d.id}: ${f} swap ${d[f]} doesn't exist`);
    if (typeof d[f] === 'number') ok(d.versions[d[f]], `${d.id}: ${f} version ${d[f]} doesn't exist`);
  }
  if (d.space === 'big' || d.slam) ok(d.bedroom !== undefined, `${d.id}: big-space drill with no bedroom version`);
  const jumpy = (x) => (x.jumps ?? d.jumps) > 0 || !!(x.hops ?? d.hops);
  if (d.versions.some(jumpy)) ok(d.noJump !== undefined, `${d.id}: has jumps but no no-jump version`);
  if (typeof d.noJump === 'number') ok(!jumpy(d.versions[d.noJump]), `${d.id}: its no-jump version still jumps`);
  for (const c of d.cues) ok(c.length <= 70, `${d.id}: cue too long for one breath: "${c}"`);
  for (const v of d.versions) {
    if (v.cues) ok(v.cues.length >= 2 && v.cues.length <= 3 && v.cues.every((c) => c.length <= 70), `${d.id} ${v.name}: needs 2 or 3 short cues`);
    if (v.draw) ok(fs.existsSync(`media/draw/${v.draw}.webp`), `${d.id} ${v.name}: drawing ${v.draw} missing`);
  }
}
for (const id of Object.keys(DEMOS)) ok(byId[id], `demos.js: ${id} isn't a drill`);

// 2. Sessions point at real drills.
for (const [type, s] of Object.entries(SESSIONS))
  for (const b of s.blocks) for (const it of b.items) ok(byId[it.id], `${type}: ${it.id} doesn't exist`);

// 3. Every way a session can be built is safe and the right length.
// (everyContext: both rooms, 7 am and 3 pm, each version Dad can set, jumps off, drills left out.)
const LIMITS = { strength: [17, 24], power: [17, 25], gameday: [5, 11], stretch: [9, 16] };
const JUMP_CAP = 50;
const draws = new Set();
const allPhrases = new Set();
const BUILT = [];
for (const { type, vname, lname, tag, ctx } of everyContext()) {
  const s = buildSession(type, ctx);
  BUILT.push({ type, vname, lname, tag, ctx, s });
  const min = s.total / 60;
  const [lo, hi] = LIMITS[type];
  if (vname === 'start' && lname !== 'avoid') ok(min >= lo && min <= hi, `${tag}: ${min.toFixed(1)} min, expected ${lo}-${hi}`);
  else ok(min <= hi + 2, `${tag}: ${min.toFixed(1)} min, too long with Dad's versions`);
  ok(s.jumps <= JUMP_CAP, `${tag}: ${s.jumps} jumps, cap is ${JUMP_CAP}`);
  for (const it of s.items) {
    draws.add(it.draw);
    if (ctx.small) ok((it.version.space ?? it.drill.space) === 'small' || it.variant, `${tag}: ${it.name} needs a big room`);
    if (it.drill.slam) ok(!ctx.early && !ctx.small, `${tag}: slams before 9 am or in the bedroom`);
  }
  // Steps tile the timeline with no gaps.
  let t = 0;
  for (const st of s.steps) { ok(Math.abs(st.start - t) < 1e-9, `${tag}: gap at step ${st.i}`); t += st.dur; }
  ok(s.steps.at(-1).kind === 'end', `${tag}: last step isn't the end`);
  phrasesOf(s).forEach((p) => allPhrases.add(p));
}

// 4. Power never runs before a game: the template asks first.
ok(SESSIONS.power.checkGameTomorrow === true, 'power: must ask "Game tomorrow?"');

// 5. Every drawing and every voice line exists.
for (const f of draws) ok(fs.existsSync(f), `missing drawing ${f}`);
let clips = {};
try { clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8')); } catch { ok(false, 'audio/clips.json missing: run node tools/make-voice.mjs'); }
for (const p of allPhrases) ok(clips[p] && fs.existsSync(`audio/${clips[p]}`), `no voice clip for "${p}"`);

// 6. The check-in picks the right session. He never picks it himself.
{
  const { decide, dayKey } = await import('./js/plan/decide.js');
  const NOW = new Date(2026, 10, 18, 16, 0); // a Wednesday afternoon
  const ago = (n, type) => ({ date: new Date(2026, 10, 18 - n, 15).toISOString(), type, completed: true, skipped: [], done: [] });
  const pick = (answers, log = [], days = {}) => decide({ today: 'none', tomorrow: 'none', ...answers }, log, days, NOW).type;
  ok(pick({}) === 'strength', 'first ever session should be Strength');
  ok(pick({ today: 'game', when: 'before' }) === 'gameday', 'game later today: Game Day');
  ok(pick({ today: 'game', when: 'after' }) === 'stretch', 'after today\'s game: Stretch');
  ok(pick({ tomorrow: 'game' }, [ago(3, 'strength'), ago(5, 'power')]) === 'stretch', 'game tomorrow: Stretch, never Power or Strength');
  ok(pick({ yesterdayGame: true }, [ago(3, 'strength'), ago(5, 'power')]) === 'strength', 'day after a game: Strength, never Power');
  ok(pick({}, [ago(3, 'strength'), ago(5, 'power')], { [dayKey(new Date(2026, 10, 17))]: { today: 'game', tomorrow: 'none' } }) === 'strength', 'remembers yesterday\'s game from yesterday\'s check-in');
  ok(pick({ today: 'practice' }, [ago(3, 'strength'), ago(5, 'power')]) === 'strength', 'practice today: Strength, no Power');
  ok(pick({}, [ago(1, 'power')]) === 'strength', 'no Power two days in a row');
  ok(pick({}, [ago(3, 'power'), ago(5, 'power'), ago(4, 'strength')]) === 'strength', 'at most 2 Power in a week');
  ok(pick({}, [ago(1, 'strength'), ago(2, 'power')]) === 'stretch', 'two hard days in a row: Stretch');
  ok(pick({}, [ago(3, 'strength'), ago(5, 'power')]) === 'power', 'Power when it was done longest ago');
  ok(pick({}, [ago(3, 'power'), ago(5, 'strength')]) === 'strength', 'Strength when it was done longest ago');
  ok(decide({ today: 'none', tomorrow: 'none' }, [ago(0, 'strength')], {}, NOW).why === 'done', 'already trained today');
  ok(pick({}, [1, 2, 3, 4, 5, 6].map((n) => ago(n, n % 2 ? 'gameday' : 'strength'))) === 'stretch', 'six days in a row with no easy day: Stretch');
  ok(pick({}, [ago(1, 'stretch'), ago(2, 'stretch'), ago(3, 'stretch'), ago(4, 'strength'), ago(5, 'power'), ago(6, 'stretch')]) !== 'stretch', 'easy days in the last six: not stuck on Stretch');
  // The 300-day simulation is in the RULES block at the end: his real week, with skipped days.
}

// ===== RULES =====
// The check-in rules, the check-in record (C5), the preview words,
// and 300 days of his real week through the rules.
{
  const D = await import('./js/plan/decide.js');
  const { decide, settle, reasonText, answersText, grabText, counts, jumpedPower, dayKey } = D;
  const { simulate, summary } = await import('./tools/sim-weeks.mjs');
  const day = (d, h = 16) => new Date(2026, 10, d, h, 0); // November 2026
  const WED = day(18), THU = day(19), FRI = day(20), SAT = day(21);
  const back = (now, n, h = 15) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, h).toISOString();
  const did = (now, n, type, more = {}) => ({ date: back(now, n), type, completed: true, stopped: null, skipped: [], done: [], ...more });
  const powerDue = (now) => [did(now, 3, 'strength'), did(now, 5, 'power')]; // Power was done longer ago
  const go = (answers, log, now, days = {}) => decide({ today: 'none', tomorrow: 'none', ...answers }, log, days, now);
  const why = (answers, log, now) => reasonText(go(answers, log, now), now);

  // Item 7: the day after a game can be Strength, never Power. The day before stays Stretch.
  ok(go({ yesterdayGame: true }, powerDue(WED), WED).type === 'strength', 'rules: day after a game, Power due: Strength');
  ok(why({ yesterdayGame: true }, powerDue(WED), WED) === 'Game yesterday, so no Power.', 'rules: day-after-game reason line');
  ok(go({ tomorrow: 'game' }, powerDue(WED), WED).type === 'stretch', 'rules: day before a game stays Stretch');

  // Item 12: no Power on a Friday or Saturday, whatever he says about tomorrow.
  for (const now of [FRI, SAT]) for (const tomorrow of ['practice', 'none'])
    ok(go({ tomorrow }, powerDue(now), now).type === 'strength', `rules: ${now.toDateString()} with "${tomorrow}" tomorrow: Strength, never Power`);
  ok(why({}, powerDue(FRI), FRI) === 'No Power on Fridays.', 'rules: Friday reason line');
  // Friday he said "Practice" for Saturday and skipped Saturday: Sunday asks about yesterday instead of trusting it.
  const friSaid = { [dayKey(FRI)]: { today: 'none', tomorrow: 'practice' } };
  ok(D.knownYesterdayGame([], friSaid, day(22)) === undefined, 'rules: a "practice tomorrow" from two days ago isn\'t trusted');
  ok(D.knownYesterdayGame([], { [dayKey(FRI)]: { today: 'none', tomorrow: 'game' } }, day(22)) === true, 'rules: a "game tomorrow" from two days ago is');
  // Power moves to the day before: Thursday, or any day before a practice.
  ok(go({}, [did(THU, 3, 'power'), did(THU, 5, 'strength')], THU).type === 'power', 'rules: Thursday takes Power when it fits, since Friday can\'t');
  ok(go({ tomorrow: 'practice' }, [did(WED, 3, 'power'), did(WED, 5, 'strength')], WED).type === 'power', 'rules: practice tomorrow: Power today when it fits');

  // Item 24: reason lines that are true.
  ok(why({ tomorrow: 'practice' }, powerDue(WED), WED) === 'No hockey today, no game tomorrow. Last Power: Friday.', 'rules: Power reason with practice tomorrow');
  ok(why({ today: 'practice' }, powerDue(WED), WED) === 'Practice today, so no Power.', 'rules: practice-day reason says Power, not jumping');
  ok(why({}, [], WED) === 'Your first session is Strength.', 'rules: first session reason');
  ok(go({ tomorrow: 'practice' }, [], WED).type === 'strength' && go({}, [], THU).type === 'strength', 'rules: first session is Strength even before a practice or a Friday');
  ok(why({}, [did(WED, 2, 'gameday')], WED) === 'First Strength session.', 'rules: first Strength after other sessions');

  // Item 6, rules side: a Power that ended after the jumps counts for the jump limits, not as a session.
  const ended = (now, n, done) => did(now, n, 'power', { completed: false, stopped: { why: 'ended' }, done });
  const JUMPED = ['W2', 'W3', 'W4', 'ST3', 'P10', 'P11', 'P4'];
  ok(!counts(ended(WED, 1, JUMPED)) && jumpedPower(ended(WED, 1, JUMPED)), 'rules: ended Power with the jumps done: not a session, but Power for the limits');
  ok(!jumpedPower(ended(WED, 1, ['W2', 'W3', 'W4', 'ST3', 'P10'])), 'rules: ended in the warm-up: not Power for the limits');
  ok(!jumpedPower({ ...ended(WED, 1, JUMPED), extra: true, dad: true }), 'rules: Dad\'s test run is never Power for the limits');
  ok(go({}, [did(WED, 3, 'strength'), ended(WED, 1, JUMPED)], WED).type !== 'power', 'rules: jumps done yesterday: no Power today');
  ok(go({}, [did(WED, 5, 'power'), ended(WED, 2, JUMPED), did(WED, 4, 'strength')], WED).type !== 'power', 'rules: ended Power counts toward 2 in 7');
  ok(go({}, [did(WED, 3, 'strength'), { ...ended(WED, 0, JUMPED), date: back(WED, 0, 9) }], WED).type === 'stretch', 'rules: jumps done earlier today: Stretch, not Power again');
  ok(counts({ completed: true }) && !counts({ completed: false }) && !counts({ completed: true, extra: true }) && !counts({ completed: false, stopped: { why: 'ended' } }), 'rules: counts(e) keeps its meaning (C8)');
  // PLAYER: an ended session that reached half counts (completed: true, stopped.why 'ended'); log.done holds drills started.
  const countedEnd = did(WED, 1, 'power', { stopped: { why: 'ended' }, done: [...JUMPED, 'P13', 'P12'] });
  ok(counts(countedEnd) && jumpedPower(countedEnd) && go({}, [did(WED, 3, 'strength'), countedEnd], WED).type !== 'power', 'rules: a counted ended Power is Power for the limits');
  ok(go({}, [did(WED, 3, 'strength'), did(WED, 2, 'strength', { stopped: { why: 'ended' } })], WED).type === 'power', 'rules: a counted ended Strength is Strength for the turn order');

  // build.js still takes avoid and noJumps: Jumping Jacks turn into Step Jacks.
  {
    const s = buildSession('strength', makeContext({ room: 'big', hour: 16, avoid: ['ST2', 'S4', 'P13'], noJumps: true }));
    ok(s.items.some((it) => it.name === 'Step Jacks') && !s.items.some((it) => it.name === 'Jumping Jacks') && s.jumps === 0, 'build: noJumps keeps the warm-up as Step Jacks, no jumps');
  }

  // Item 11 and C5: the first check-in of the day sticks; later ones can only make it easier.
  {
    const k = dayKey(WED);
    const log = powerDue(WED);
    const days = {};
    const step = (answers) => { const r = settle(answers, log, days, WED); days[k] = r.day; return r; };
    const s1 = step({ today: 'none', tomorrow: 'none' });
    ok(s1.d.type === 'power', 'C5: first check-in: Power');
    ok(['today', 'tomorrow', 'when', 'type', 'at'].every((f) => f in s1.day) && s1.day.type === 'power', 'C5: the record has today, tomorrow, when, type, at');
    const s2 = step({ today: 'practice', tomorrow: 'none' });
    ok(s2.d.type === 'strength', 'C5: a redo can make it easier (practice today: Strength)');
    const s3 = step({ today: 'none', tomorrow: 'none' });
    ok(s3.d.type === 'strength' && s3.reason === s2.reason, 'C5: a redo can\'t go back up to Power');
    const s4 = step({ today: 'none', tomorrow: 'game' });
    ok(s4.d.type === 'stretch', 'C5: he can still fix a game he forgot');
    const s5 = step({ today: 'none', tomorrow: 'none' });
    ok(s5.d.type === 'stretch' && s5.day.tomorrow === 'game', 'C5: "game tomorrow" sticks');
    ok(s5.day.at === s1.day.at && s5.day.tries === 5, 'C5: keeps the first time, counts the check-ins');
    days[k] = { ...days[k], yesterdayGame: false };
    ok(D.knownYesterdayGame(log, days, WED) === false, 'C5: a redo doesn\'t ask about yesterday\'s game again');
    delete days[k]; // Dad's "Redo today's check-in"
    ok(step({ today: 'none', tomorrow: 'none' }).d.type === 'power', 'C5: after Dad\'s redo the check-in starts fresh');
  }
  {
    const k = dayKey(WED);
    const days = {};
    const a = settle({ today: 'game', when: 'before' }, powerDue(WED), days, WED);
    days[k] = a.day;
    ok(a.d.type === 'gameday' && settle({ today: 'none', tomorrow: 'none' }, powerDue(WED), days, WED).d.type === 'gameday', 'C5: game today, then "No hockey": still Game Day');
    const noType = { today: 'none', tomorrow: 'game', when: null, yesterdayGame: null, type: null, reason: '', at: WED.toISOString(), tries: 1 };
    const fresh = settle({ today: 'none', tomorrow: 'none' }, [], { [k]: noType }, WED);
    ok(fresh.d.type === 'strength' && fresh.day.tries === 1, 'C5: a record with no type is no first check-in');
  }

  // Preview words (items 11 and 26).
  ok(answersText({ today: 'none', tomorrow: 'none' }) === 'No hockey today · No hockey tomorrow', 'preview: answers line');
  ok(answersText({ today: 'game', when: 'before', tomorrow: null }) === 'Game later today', 'preview: answers line, game later');
  ok(answersText({ today: 'practice', tomorrow: 'game', yesterdayGame: true }) === 'Practice today · Game tomorrow · Game yesterday', 'preview: answers line, all three');
  ok(grabText(undefined) === '' && grabText([]) === '', 'preview: no Grab line with nothing to grab');
  ok(grabText(['the med ball']) === 'Grab: the med ball.', 'preview: Grab line, one thing');
  ok(grabText(['the med ball', 'a towel']) === 'Grab: the med ball and a towel.', 'preview: Grab line, two things');
  ok(grabText(['a pillow', 'a towel', 'the med ball']) === 'Grab: a pillow, a towel and the med ball.', 'preview: Grab line, three things');

  // 300 days of his real week (tools/sim-weeks.mjs): practice Monday and Saturday, clinic every second
  // Tuesday, 1 or 2 games a week, a home game on some Saturdays, and 1 to 3 days off a week.
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const runs = [];
  for (const skips of ['random', 'hockey', 'few', 'many'])
    for (const seed of SEEDS) runs.push({ tag: skips, seed, rows: simulate({ weeks: 43, seed, skips }) });
  // Stress: he says "Practice" for a Saturday home game; Powers end right after the jumps; any schedule at all.
  for (const seed of SEEDS.slice(0, 4)) {
    runs.push({ tag: 'friday-mistake', seed, rows: simulate({ weeks: 43, seed, fridayMistake: 0.5 }) });
    runs.push({ tag: 'ended-power', seed, rows: simulate({ weeks: 43, seed, endPower: 0.3 }) });
    runs.push({ tag: 'any-schedule', seed, rows: simulate({ weeks: 43, seed, skips: 'few', schedule: 'random' }) });
  }
  const jumped = (r) => r && (r.did === 'power' || r.did === 'power-ended');
  for (const { tag, seed, rows } of runs) {
    const t = `sim ${tag} seed ${seed}`;
    let bad = 0;
    const check = (cond, msg) => { if (!cond && bad++ < 3) ok(false, msg); };
    rows.forEach((r, i) => {
      if (r.type === 'power') {
        check(r.tomorrow !== 'game', `${t} ${r.k}: Power the day before a game`);
        check(r.ice === 'none', `${t} ${r.k}: Power on a ${r.ice} day`);
        check(r.yesterday !== 'game', `${t} ${r.k}: Power the day after a game`);
        check(r.dow !== 5 && r.dow !== 6, `${t} ${r.k}: Power on a Friday or Saturday`);
        check(!jumped(rows[i - 1]), `${t} ${r.k}: Power two days in a row`);
        check(rows.slice(Math.max(0, i - 6), i).filter(jumped).length < 2, `${t} ${r.k}: more than 2 Power in 7 days`);
      }
      // He can't be protected from a game he didn't mention, except from Power (no Power on Fridays).
      if (r.type === 'strength' && !r.wrong) check(r.tomorrow !== 'game', `${t} ${r.k}: Strength the day before a game`);
    });
    ok(bad === 0, `${t}: ${bad} safety breaks`);
    if (tag === 'ended-power' || tag === 'any-schedule') continue;
    const s = summary(rows);
    // Every 14 days at least 2 Strength or Power. Strictly when his days off fall on ice days first.
    // With days off anywhere, a 14-day stretch can hold 4 to 6 games with every free day skipped,
    // so there it holds wherever he trained on at least 4 days with no game that day or the next.
    if (tag === 'hockey') ok(s.worst14.n >= 2, `${t}: only ${s.worst14.n} Strength or Power in the 14 days from ${s.worst14.from}`);
    ok(s.worstFair14.n >= 2, `${t}: only ${s.worstFair14.n} Strength or Power in the 14 days from ${s.worstFair14.from}, with 4 or more free days trained`);
  }
  // Stretch at most 40% of his sessions over all the seeds of his usual week, and under 50% in any
  // single season of any mode (one season swings more than the average; the old rules ran 49-58%).
  // Training nearly every day it sits at 42-43%, because then he trains on every day before a game,
  // and that day is always Stretch: the brief's rule, kept on purpose.
  for (const tag of ['random', 'hockey', 'few', 'many', 'friday-mistake']) {
    const s = summary(runs.filter((r) => r.tag === tag).flatMap((r) => r.rows));
    if (tag === 'random') ok(s.share.stretch <= 0.4, `sim ${tag}: Stretch is ${Math.round(s.share.stretch * 100)}% of his sessions, over 40%`);
    ok(s.share.power > 0.1 && s.share.strength > 0.25, `sim ${tag}: too little hard work ${JSON.stringify(s.count)}`);
    for (const run of runs.filter((r) => r.tag === tag)) {
      const one = summary(run.rows);
      ok(one.share.stretch < 0.5, `sim ${tag} seed ${run.seed}: Stretch is ${Math.round(one.share.stretch * 100)}% of one season, 50% or more`);
    }
  }
}

// The summary prints when everything has run, so each builder's block can sit at the end of the file.
// A crash (an exception in any block) keeps its non-zero exit code, so deploy.sh never ships on a crash.
process.on('exit', (code) => {
  console.log(`${passed} passed, ${failed} failed${code ? ' (CRASHED before the end)' : ''}`);
  if (failed) process.exitCode = 1;
});

// ===== PLAYER =====
{
  const { credit, settle, repsOf, soundGate, resumeIndex } = await import('./js/screens/player.js');
  const { Runner } = await import('./js/timer/runner.js');
  const { on, TAP_GUARD_MS } = await import('./js/ui.js');
  const live = await import('./js/live.js');
  const { counts } = await import('./js/plan/decide.js');
  const ctxBig = makeContext({ room: 'big', hour: 16 });
  const build = (type, ctx = ctxBig) => buildSession(type, ctx);
  // The drill numbers whose work started by the time he reached drill `upTo` (that drill included).
  const upTo = (s, n) => Array.from({ length: n }, (_, k) => k + 1);
  const ended = (s, nos, skipped = [], stopped = { why: 'ended' }) =>
    settle(s, { type: s.type, extra: false, done: [], skipped: [], stopped, completed: false }, nos, skipped, Math.max(1, ...nos));

  // Drill numbers on screen match the session's items, so the count rule reads the right block.
  for (const { type, tag, ctx } of everyContext()) {
    const s = build(type, ctx);
    ok(s.items.length === s.drills, `player ${tag}: ${s.items.length} items but ${s.drills} drill numbers`);
    for (const st of s.steps) if (st.r) ok(s.items[st.drillNo - 1]?.drill.id === st.r.drill.id, `player ${tag}: step ${st.i} drill number points at the wrong item`);
  }

  // Item 6 and 14: an ended session counts by the same test as a finished one.
  const str = build('strength');
  ok(str.drills === 15, 'player: Strength has 15 drills');
  const e13 = ended(str, upTo(str, 13));
  ok(e13.completed && e13.short === null && e13.reached === 13 && e13.need === 8 && counts(e13), 'player: Strength ended at drill 13 of 15 counts');
  const e5 = ended(str, upTo(str, 5));
  ok(!e5.completed && e5.short === 'half' && !counts(e5), 'player: Strength ended at drill 5 of 15 does not count');
  const e4 = ended(str, upTo(str, 4));
  ok(e4.short === 'half' && !counts(e4), 'player: quitting after the warm-up does not count');
  const e1 = ended(str, [1]);
  ok(!e1.completed && e1.short === 'half' && !counts(e1), 'player: any stop at drill 1 of 15 does not count');
  // Skipping every circuit drill but doing the rest (9 of 15) used to give "Done.": not now.
  const circuit = str.items.map((it, k) => (it.block === 'Circuit' ? k + 1 : 0)).filter(Boolean);
  ok(circuit.length === 6, `player: Strength circuit should be 6 drills, is ${circuit.length}`);
  const noMain = settle(str, { type: 'strength', done: [], skipped: [], stopped: null }, upTo(str, 15), circuit, 15);
  ok(noMain.short === 'main' && !noMain.completed && !counts(noMain), 'player: skipping the whole circuit does not count');
  const halfMain = settle(str, { type: 'strength', done: [], skipped: [], stopped: null }, upTo(str, 15), circuit.slice(0, 3), 15);
  ok(halfMain.completed && halfMain.short === null, 'player: doing half the circuit and half of everything counts');
  ok(noMain.done.length === 9 && !noMain.done.some((id) => ['ST1', 'ST3', 'ST4', 'S4', 'ST2', 'W7'].includes(id)), 'player: skipped drills are left out of log.done');
  const pow = build('power');
  const p10 = ended(pow, upTo(pow, 10));
  ok(p10.completed && p10.done.includes('P11') && p10.done.includes('P12'), 'player: Power ended at drill 10 with the jumps done counts, jump drills in log.done');
  const p8 = settle(pow, { type: 'power', done: [], skipped: [], stopped: null }, upTo(pow, 15), [6, 7, 8], 15);
  ok(p8.short === 'main', 'player: Power with the jump block skipped is short of the main block');
  const gd = build('gameday');
  ok(credit(gd, [1, 2, 3, 4, 5]).short === null && credit(gd, [1, 2, 3, 8]).short === 'main', 'player: Game Day needs half of Legs on');
  const st = build('stretch');
  ok(credit(st, [1, 2, 3, 4, 5]).short === null && credit(st, [1, 2, 3, 4]).short === 'half', 'player: Stretch needs half its drills, no main block');

  // Item 18: rep sets show his reps; timed holds keep the countdown.
  for (const type of SESSION_ORDER)
    for (const room of ['bedroom', 'big']) {
      const s = build(type, makeContext({ room, hour: 16 }));
      for (const w of s.steps.filter((x) => x.kind === 'work')) {
        const r = repsOf(w);
        if (w.r.dose.type === 'reps') {
          const unit = w.r.drill.side ? `each ${w.r.drill.side}` : 'reps';
          ok(r && r.n === (typeof w.reps === 'number' ? w.reps : w.r.dose.reps), `player ${type}/${room}: ${w.r.name} rep count`);
          ok(r && ['reps', 'each side', 'each way', 'each leg'].includes(r.unit) && (typeof w.reps === 'number' || r.unit === unit), `player ${type}/${room}: ${w.r.name} rep unit "${r?.unit}"`);
        } else ok(r === null, `player ${type}/${room}: ${w.r.name} is timed and should keep the countdown`);
      }
    }
  ok(JSON.stringify(repsOf({ kind: 'work', reps: 6, repUnit: 'each leg', r: {} })) === '{"n":6,"unit":"each leg"}', 'player: reads step.reps and step.repUnit (contract C2)');
  ok(repsOf({ kind: 'intro', reps: 6, r: {} }) === null && repsOf({ kind: 'rest', r: {} }) === null, 'player: only work steps show reps');

  // Item 22: the sound warning waits a full second of silence while running, and clears at once.
  const g = soundGate();
  ok(g(false, 0, true) === false && g(false, 900, true) === false && g(false, 1000, true) === true, 'player: sound warning only after 1 s off');
  ok(g(true, 1100, true) === false && g(false, 1200, true) === false, 'player: sound back on clears the warning and restarts the wait');
  ok(g(false, 5000, false) === false && g(false, 5100, true) === false && g(false, 6050, true) === false && g(false, 6100, true) === true, 'player: paused never warns; the second starts again after Resume');

  // Item 32: skipping while paused adds no minutes. Real time minus real pauses.
  {
    let t = 0;
    const s = build('power');
    const cues = [];
    const r = new Runner(s, { onCue: (c) => cues.push(c) });
    r.now = () => t;
    r.start();
    t = 10000; r.tick();
    r.pause();
    for (let k = 0; k < 7; k++) { t += 1000; r.jumpTo(r.nextDrillIndex()); }
    t += 1000; r.resume();
    t += 5000; r.tick();
    ok(Math.abs(r.activeMs() - 15000) < 1, `player: 7 skips while paused should add nothing (active ${r.activeMs()} ms, want 15000)`);
    ok(r.current().drillNo === 8, `player: 7 skips from drill 1 should land on drill 8, got ${r.current().drillNo}`);
    r.pause(); t += 60000; ok(Math.abs(r.activeMs() - 15000) < 1, 'player: time paused is not training time');
    r.stop();
  }
  // Item 25: a runner can start paused at a step, playing nothing until Resume.
  {
    let t = 0;
    const s = build('strength');
    const cues = [];
    const steps = [];
    const r = new Runner(s, { onCue: (c) => cues.push(c), onStep: (x) => steps.push(x.i) });
    r.now = () => t;
    r.start({ at: 14, paused: true });
    ok(r.idx === 14 && r.paused && cues.length === 0 && steps.join() === '14', `player: start paused at step 14 (idx ${r.idx}, cues ${cues.length}, steps ${steps})`);
    t = 30000; r.tick();
    ok(r.idx === 14 && cues.length === 0 && r.activeMs() === 0, 'player: nothing moves or plays while paused');
    r.resume(); t += 1000; r.tick();
    ok(cues.length > 0 && Math.abs(r.elapsed() - (s.steps[14].start + 1)) < 1e-6, 'player: Resume plays the step from its start');
    r.stop();
  }
  {
    const s = build('power');
    const work = s.steps.find((x) => x.kind === 'work' && x.set === 2); // Jump Squats set 2, after a rest
    ok(resumeIndex(s, { step: work.i, nSteps: s.steps.length }) === work.i - 1 && s.steps[work.i - 1].kind === 'rest', 'player: picked up mid-set, he gets the rest before it again');
    const intro = s.steps.find((x) => x.kind === 'intro' && x.drillNo === 9);
    ok(resumeIndex(s, { step: intro.i, nSteps: s.steps.length }) === intro.i, 'player: picked up in a get-ready, it stays there');
    ok(s.steps[resumeIndex(s, { step: 999, nSteps: 1, drillNo: 9 })].drillNo === 9, 'player: an app update in between falls back to the drill number');
    ok(s.steps[resumeIndex(s, { step: s.steps.length - 1, nSteps: s.steps.length })].kind !== 'end', 'player: never resumes on the end marker');
  }
  ok(live.fresh({ v: live.VERSION, savedAt: 1000 }, 1000 + 3600e3) && !live.fresh({ v: live.VERSION, savedAt: 1000 }, 1000 + 2 * 3600e3) && !live.fresh({ v: 99, savedAt: 1000 }, 2000) && !live.fresh(null), 'player: a saved session is picked up for under 2 hours');

  // Item 14: no "Too hard" skip.
  ok(!/Too hard|data-arg="hard"/.test(fs.readFileSync('js/screens/player.js', 'utf8')), 'player: the skip sheet has no Too hard');

  // Item 5: a second tap within 350 ms is ignored, on any screen; a later one goes through.
  {
    let n = 0;
    const btn = { dataset: { act: 'go' }, disabled: false };
    const root = { contains: () => true };
    const ev = { target: { closest: () => btn }, preventDefault() {} };
    on(root, { go: () => n++ });
    const first = root.onclick;
    first(ev);
    on(root, { go: () => n++ }); // the next screen
    root.onclick(ev);
    ok(n === 1 && TAP_GUARD_MS === 350, 'player: double tap answers only the first screen');
    await new Promise((res) => setTimeout(res, TAP_GUARD_MS + 20));
    root.onclick(ev);
    ok(n === 2, 'player: a tap after 350 ms goes through');
  }
}

// ===== SCREENS =====
// Today, Done, Dad's screen, Lights, the save, the icon. Pure functions only: no browser needed.
{
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { load, blank, migrateOldRecords } = await import('./js/store.js');
  const home = await import('./js/screens/home.js');
  const { doneWords } = await import('./js/screens/done.js');
  const dad = await import('./js/screens/dad.js');
  const lights = await import('./js/screens/lights.js');
  const copy = await import('./data/copy.js');
  const { dayKey } = await import('./js/plan/decide.js');

  // The save: new fields have safe defaults, and an older save keeps everything it had.
  ok(Array.isArray(blank().lights) && blank().lights.length === 0, 'save: blank() starts with an empty Lights list');
  store.set('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [{ date: '2026-11-01T20:00:00.000Z', type: 'strength', completed: true }], days: { '2026-11-01': { today: 'none' } }, dadPin: 'abc' }));
  const old = load();
  ok(old.setupDone && old.log.length === 1 && old.dadPin === 'abc' && old.days['2026-11-01'], 'save: an older save keeps its log, days and PIN');
  ok(Array.isArray(old.lights) && old.versions && old.settings.ball === 'dead', 'save: an older save gets lights, versions and settings');

  // Words (items 3 and 13).
  ok(copy.ROOM_HINT.bedroom === 'Small room: nothing that needs 3 metres.' && copy.ROOM_HINT.big === 'Full versions. Clear about 3 metres around you.', 'Today: room hints');

  // A week to work with: Friday 13 November 2026, 4:30 pm.
  const NOW = new Date(2026, 10, 13, 16, 30);
  const at = (m, d, h = 16) => new Date(2026, m, d, h).toISOString();
  const run = (m, d, type, more = {}) => ({ date: at(m, d), type, completed: true, extra: false, dad: false, planned: 15, done: [], skipped: [], stopped: null, secs: 1200, ...more });
  const log = [
    run(9, 26, 'strength'), run(9, 27, 'power'), run(9, 29, 'stretch'), run(9, 31, 'gameday'), // a full week
    run(10, 2, 'strength'), run(10, 3, 'stretch'), run(10, 5, 'power'), run(10, 7, 'strength'), // another
    run(10, 9, 'strength', { secs: 1205, skipped: [{ id: 'S4', no: 6, why: 'here' }] }),
    run(10, 10, 'power', { completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }), // didn't count
    run(10, 11, 'gameday', { secs: 300 }),
    run(10, 12, 'stretch', { extra: true }), // extra: never counts
    run(10, 12, 'power', { dad: true, extra: true, stopped: { why: 'ended' }, completed: false }), // an old test run
  ];
  const days = { '2026-11-09': { today: 'practice', tomorrow: 'none' }, '2026-11-11': { today: 'game', when: 'before' }, '2026-11-12': { today: 'none', tomorrow: 'game' } };

  // Week strip (item 21).
  const w = home.weekStats(log, days, NOW);
  ok(w.boxes.length === 7 && w.boxes[0].letter === 'M' && w.boxes[0].key === '2026-11-09', 'week strip: Monday to Sunday');
  ok(w.boxes.map((b) => (b.filled ? 1 : 0)).join('') === '1010000', `week strip: boxes only for counted sessions, got ${w.boxes.map((b) => (b.filled ? 1 : 0)).join('')}`);
  ok(w.count === 2, `week strip: "This week: 2", got ${w.count}`);
  ok(w.boxes[0].mark === 'P' && w.boxes[2].mark === 'G' && w.boxes[4].mark === 'G' && w.boxes[1].mark === '', 'week strip: G and P from his check-ins, including "game tomorrow"');
  ok(w.boxes[4].today && w.boxes[5].future && !w.boxes[3].future, 'week strip: knows today and the days ahead');
  ok(!home.weekStripHtml(w).includes('Full week') && !('full' in w) && !('inARow' in w), 'week strip: the streak replaced "Full week." and full weeks in a row');
  const ws = home.weekStats(log, days, NOW, ['2026-11-10', '2026-11-09']);
  ok(ws.boxes[1].saved && !ws.boxes[0].saved && home.weekStripHtml(ws).includes('Tuesday: saved'), 'week strip: a saved day gets its own box, labelled "saved" (never over a session)');
  ok(!home.weekStripHtml(w).includes('red'), 'week strip: missed days are never red');

  // Season line (item 21): from 1 September, counted sessions only.
  const season = home.seasonStats([run(7, 30, 'strength'), ...log], NOW);
  ok(season.sessions === 10, `season: 10 counted sessions since 1 September (not August's, not extras or test runs), got ${season.sessions}`);
  ok(season.mins === Math.round((8 * 1200 + 1205 + 300) / 60), `season: minutes of counted sessions add up, got ${season.mins}`);
  ok(home.seasonStats(log, new Date(2027, 7, 31)).sessions === 10 && home.seasonStats(log, new Date(2027, 8, 1)).sessions === 0, 'season: a new season starts on 1 September');

  // Done screen words (items 6 and 36, C6).
  const dw = (more) => doneWords({ planned: 15, done: [], skipped: [], stopped: null, completed: true, extra: false, dad: false, ...more });
  ok(dw({}).title === 'Done.' && dw({}).line === '', 'done: a finished session');
  ok(dw({ stopped: { why: 'ended' }, reached: 13, need: 8 }).line === 'Ended at drill 13 of 15.', 'done: a counted ended session says where it ended');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }).title === 'Ended early.', 'done: "Ended early."');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }).line === 'Do 8 of 15 drills and it counts.', 'done: "Do 8 of 15 drills and it counts."');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 11, need: 8, short: 'main' }).line === 'Do half the main drills and it counts.', 'done: the main-block rule');
  ok(dw({ dad: true, extra: true }).line === 'Test run. Nothing saved.' && doneWords({ planned: 15, completed: true }, { test: true }).line === 'Test run. Nothing saved.', 'done: "Test run. Nothing saved."');
  ok(dw({ dad: true, extra: true, completed: false, stopped: { why: 'ended' } }).title === 'Ended.', 'done: a test run he ended says "Ended."');

  // Dad's last 14 days (item 2) and today's check-in (item 11).
  const dlog = [...log.slice(4), run(9, 1, 'power'), run(10, 12, 'strength', { dad: true })];
  const rows = dad.dadDays({ log: dlog, days: { ...days, '2026-11-13': { today: 'none', tomorrow: 'practice', type: null } } }, NOW);
  ok(rows.length === 14 && rows[0].label === 'Today' && rows[1].label === 'Yesterday' && rows[13].key === '2026-10-31', `Dad: 14 days, newest first, nothing older (got ${rows.length})`);
  ok(rows[0].answers === 'No hockey today · Practice tomorrow' && rows[0].entries.length === 0, 'Dad: today\'s answers with no session yet');
  const mon = rows.find((r) => r.key === '2026-11-09');
  ok(mon.answers === 'Practice today · No hockey tomorrow' && mon.entries[0].skips[0] === 'Skipped Side Lunges: can\'t do it here', 'Dad: answers, and "Skipped Side Lunges: can\'t do it here"');
  ok(rows.find((r) => r.key === '2026-11-10').entries[0].ending === 'Ended at 5 of 15 · didn\'t count', 'Dad: "Ended at 5 of 15 · didn\'t count"');
  ok(rows.find((r) => r.key === '2026-11-12').entries.some((x) => x.ending === 'Done · Picked by Dad'), 'Dad: "Picked by Dad"');
  ok(!rows.some((r) => r.entries.some((x) => x.e.extra && x.e.dad)), 'Dad: his own test runs aren\'t in the list');
  ok(dad.answersText({ today: 'game', when: 'after', tomorrow: 'none', type: 'stretch' }) === 'Game today, already played · No hockey tomorrow → Stretch', 'Dad: answers read in words');

  // Dad's version lines (item 37).
  const { byId: drillById } = await import('./data/exercises.js');
  ok(dad.versionLine(drillById.ST2, 2) === 'Harder: Hold the med ball on your lap. Hold 45 s', `Dad: Wall Sit Harder says what changes, got "${dad.versionLine(drillById.ST2, 2)}"`);
  ok(dad.versionLine(drillById.ST1, 1) === 'Standard: 8 reps', 'Dad: Standard says the target');

  // Lights (item 10).
  ok(lights.median([300, 200, 250]) === 250 && lights.median([1, 2, 3, 4]) === 3, 'Lights: median');
  const ls = { lights: [] };
  const taps = (base) => Array.from({ length: lights.TAPS }, (_, k) => base + k * 4);
  const r1 = lights.recordRound(ls, taps(300), NOW);
  ok(r1.counted && r1.first && !r1.best && r1.ms === 318, `Lights: first round counts, is a first score, not a "Best" (got ${r1.ms})`);
  const r2 = lights.recordRound(ls, taps(280), NOW);
  ok(r2.counted && r2.best && r2.was === 318, 'Lights: a faster counted round is a new best');
  lights.recordRound(ls, taps(290), NOW);
  const r4 = lights.recordRound(ls, taps(200), NOW);
  ok(!r4.counted && !r4.best, 'Lights: the 4th round today is practice, never a best');
  ok(lights.lightsStats(ls.lights, NOW).best === 298 && lights.lightsStats(ls.lights, NOW).left === 0, 'Lights: best comes from counted rounds only');
  ok(lights.lightsStats(ls.lights, new Date(2026, 10, 14, 9)).left === 3, 'Lights: 3 more count tomorrow');
  ok(ls.lights.every((l) => l.date && Number.isFinite(l.ms) && l.taps.length === lights.TAPS), 'Lights: every round saved with its date and taps');
  ok(home.lightsLineHtml(ls.lights).includes('best <b>298 ms</b>') && home.lightsLineHtml([]).includes('no score yet'), 'Today: "Lights · best 298 ms"');
  ok(!log.some((e) => e.type === 'lights'), 'Lights never become a session');

  // The icon (item 35): solid PNGs at 180, 192 and 512.
  for (const size of [180, 192, 512]) {
    const b = fs.readFileSync(`icons/crease-${size}.png`);
    ok(b.readUInt32BE(16) === size && b.readUInt32BE(20) === size, `icon ${size}: wrong size`);
    ok(b[25] === 2, `icon ${size}: must be solid RGB, no transparency`);
  }

  // No names or emails in any file the public repo holds. The names to look for live in
  // qa/private-names.txt (gitignored, one per line), so this test never spells them out itself.
  if (fs.existsSync('qa/private-names.txt')) {
    const names = fs.readFileSync('qa/private-names.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
    const tracked = (await import('node:child_process')).execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(js|mjs|html|css|json|md|py|sh|webmanifest)$/.test(f));
    for (const f of tracked) {
      const text = fs.readFileSync(f, 'utf8').toLowerCase();
      ok(!names.some((n) => text.includes(n.toLowerCase())), `${f}: holds a private name or email`);
    }
  }
  void dayKey;
}

// ===== VOICE =====
// Fix list of 10 Nov 2026: items 1, 4, 13, 18, 19, 20, 26, 27, 30, 31, 38; contracts C1 to C4 and C10.
{
  const { LATE, GAP } = await import('./js/timer/audio.js');
  const said = (st) => st.cues.filter((c) => c.say).flatMap((c) => c.say);
  const start = (type, o = {}) => buildSession(type, makeContext({ room: 'big', hour: 15, ...o }));

  // Item 1: a step with no jumps never shows or says "jump", unless it says "No jump".
  for (const { tag, s } of BUILT)
    for (const st of s.steps) {
      const r = st.r;
      if (!r || r.jumps > 0 || r.hops) continue;
      for (const line of [r.name, r.target, r.how, r.note, r.drill.why, r.drill.mistake, ...r.cues, ...said(st)].filter(Boolean))
        ok(!/jump/i.test(line) || /no jump/i.test(line), `${tag}: "${line}" on ${r.name}, which has no jumps`);
    }
  // Dad's version is what the voice says, with its own name, cues and drawing.
  {
    const s = start('power', { versions: { P11: 0, P12: 0, P4: 0 } });
    const it = (id) => s.items.find((x) => x.drill.id === id);
    ok(it('P11').name === 'Squat to Toes' && it('P11').draw.endsWith('/ST3.webp'), 'Jump Squats Easier: Squat to Toes, squat drawing');
    ok(it('P12').name === 'Step-Back Burpees' && it('P12').draw.endsWith('/P12q.webp'), 'Burpees Easier: Step-Back Burpees, own drawing');
    ok(it('P4').name === 'Step & Hold' && it('P4').cues[0] === 'Big step sideways.', 'Skater Jumps Easier: Step & Hold');
    const ups = start('strength', { versions: { ST1: 0 } }).steps.find((st) => st.kind === 'intro' && st.r.drill.id === 'ST1');
    ok(said(ups).includes('Knees down.'), 'Push-Ups Easier: the voice says "Knees down."');
    const bed = start('power', { room: 'bedroom' }).items.find((x) => x.drill.id === 'P4');
    ok(bed.name === 'Step & Hold' && bed.jumps === 0, 'Skater Jumps in the bedroom: Step & Hold, no jumps');
  }

  // C1: resolveItem's drill copy carries the version's name and cues.
  {
    const r = resolveItem({ id: 'P11' }, makeContext({ versions: { P11: 0 } }));
    ok(r.drill.name === 'Squat to Toes' && r.drill.cues === r.cues && r.cues[0] === 'Squat down, then rise onto your toes.', 'C1: drill copy has the version name and cues');
    ok(r.drill.id === 'P11' && byId.P11.name === 'Jump Squats', 'C1: same id, and the library itself is untouched');
  }

  // Item 4: every set of a drill with jumps starts "Go. Land soft." and says its landing cue.
  for (const { tag, s } of BUILT) {
    for (const st of s.steps.filter((x) => x.kind === 'work' && x.r.jumps > 0)) {
      ok(said(st)[0] === 'Go. Land soft.', `${tag}: ${st.r.name} set doesn't start "Go. Land soft."`);
      ok(said(st).includes(st.r.cues[1]), `${tag}: ${st.r.name} set never says "${st.r.cues[1]}"`);
    }
    for (const p of phrasesOf(s)) ok(!/shoe|sock|footwear/i.test(p), `${tag}: footwear line "${p}"`);
  }

  // Item 20: the cue that fixes the usual mistake gets said, and holds of 30 s or more say their third cue.
  for (const [type, id, cue] of [['strength', 'ST2', 'Hands off your legs.'], ['power', 'C9', 'Hips stay low.'], ['stretch', 'M5', 'Heel down.'], ['stretch', 'X4', 'Pull gently. Head stays down.'], ['stretch', 'X5', 'Knees together.']]) {
    const steps = start(type).steps.filter((st) => st.kind === 'work' && st.r.drill.id === id);
    ok(steps.length && steps.every((st) => said(st).includes(cue)), `${type}: ${id} never says "${cue}"`);
  }
  for (const { tag, s } of BUILT)
    for (const st of s.steps.filter((x) => x.kind === 'work' && x.r.drill.hold && x.dur >= 30))
      if (st.r.cues[2]) ok(said(st).includes(st.r.cues[2]), `${tag}: ${st.r.name} hold skips "${st.r.cues[2]}"`);

  // Item 13 and C10: no morning quiet mode. The bedroom swaps only big-space drills; before 9 am only slams.
  {
    const names = (s) => s.items.map((x) => x.name).join();
    const am = start('power', { hour: 7 });
    const pm = start('power');
    ok(names(am) === names(pm).replace('Ball Slams', 'Push-Ups'), 'before 9 am in the big room: only the slams change');
    ok(am.jumps === pm.jumps && pm.jumps >= 40, `before 9 am: every jump stays (${am.jumps} of ${pm.jumps})`);
    const bed = start('power', { room: 'bedroom' });
    for (const id of ['P10', 'P11', 'P12']) ok(bed.items.some((x) => x.drill.id === id && x.jumps > 0), `bedroom: ${id} stays, it fits a small room`);
    for (const it of bed.items) if (!it.swappedFrom && !it.variant && it.v === byId[it.drill.id].start) ok(it.drill.space === 'small', `bedroom: ${it.name} needs space`);
    ok(!bed.items.some((x) => x.drill.slam) && !am.items.some((x) => x.drill.slam), 'no slams in the bedroom or before 9 am');
    const ctx = makeContext({ room: 'big', hour: 7 });
    ok(ctx.quiet === undefined && ctx.early === true && ctx.small === false, 'makeContext: no quiet flag; early and small instead');
  }

  // C2 and item 18: a work step with a rep target carries the count and its unit; a timed step doesn't.
  for (const { tag, s } of BUILT)
    for (const st of s.steps.filter((x) => x.kind === 'work')) {
      if (st.r.dose.type === 'reps') ok(Number.isInteger(st.reps) && st.reps > 0 && ['reps', 'each side', 'each way', 'each leg'].includes(st.repUnit), `${tag}: ${st.r.name} has no rep count`);
      else ok(st.reps === undefined && st.repUnit === undefined, `${tag}: ${st.r.name} is timed but has reps`);
    }
  {
    const st = start('power').steps.find((x) => x.kind === 'work' && x.r.drill.id === 'P4');
    ok(st.reps === 4 && st.repUnit === 'each way', 'Skater Jumps: 4 each way');
  }

  // The main block (the player's half-the-main-block rule): flagged and keeps its name.
  for (const [type, name] of [['strength', 'Circuit'], ['power', 'Power'], ['gameday', 'Legs on']]) {
    ok(SESSIONS[type].blocks.filter((b) => b.main).map((b) => b.name).join() === name, `${type}: main block should be "${name}"`);
    const s = start(type);
    ok(s.items.some((x) => x.main) && s.items.every((x) => x.main === (x.block === name)), `${type}: items don't carry main`);
  }
  ok(!SESSIONS.stretch.blocks.some((b) => b.main), 'stretch: no main block (half of all drills)');

  // Item 27: circuit stations. Rep stations get their own window; holds get their time, then rest.
  {
    const station = (s, id) => {
      const i = s.steps.findIndex((st) => st.kind === 'work' && st.r.drill.id === id);
      return { work: s.steps[i].dur, rest: s.steps[i + 1].kind === 'rest' ? s.steps[i + 1].dur : 0 };
    };
    const std = start('strength');
    ok(station(std, 'ST1').work === 30 && station(std, 'ST1').rest === 0, 'circuit: Push-Ups get 30 s');
    ok(station(std, 'ST3').work === 35, 'circuit: Squats get 35 s');
    ok(station(std, 'ST2').work === 30 && station(std, 'ST2').rest === 10, 'circuit: Wall Sit 30 s, then 10 s rest');
    const easy = start('strength', { versions: { ST2: 0 } });
    ok(station(easy, 'ST2').work === 20 && station(easy, 'ST2').rest === 20, 'circuit: Wall Sit Easier 20 s, then 20 s rest');
    const hard = start('strength', { versions: { ST2: 2 } });
    ok(station(hard, 'ST2').work === 40 && station(hard, 'ST2').rest === 0, 'circuit: Wall Sit Harder holds the whole 40 s');
    ok(station(std, 'S4').work === 40, 'circuit: Side Lunges keep 20 s a side');
    ok(std.steps.filter((st) => st.kind === 'intro' && st.r.drill.id === 'ST3').every((st) => st.dur === 20), 'circuit: the 20 s change stays');
  }

  // C3 and item 26: what to grab, never the wall or the floor.
  {
    const ALLOWED = ['the med ball', 'a pillow', 'a towel', 'a chair'];
    for (const { tag, s } of BUILT) ok(Array.isArray(s.grab) && s.grab.every((g) => ALLOWED.includes(g)), `${tag}: grab ${JSON.stringify(s.grab)}`);
    ok(start('stretch').grab.join() === 'a pillow,a towel', 'Stretch: grab a pillow and a towel');
    ok(start('strength').grab.join() === 'the med ball', 'Strength: grab the med ball');
    ok(start('power').grab.join() === 'the med ball', 'Power: grab the med ball for the slams');
    ok(start('power', { room: 'bedroom' }).grab.length === 0, 'Power in the bedroom: nothing to grab (no slams)');
    ok(start('strength', { versions: { G1: 0 } }).grab.join() === 'a pillow', 'Pillow Squeeze: grab a pillow, not the ball');
  }

  // C4: avoid leaves drills out; noJumps takes out every jump and hop.
  for (const { tag, ctx, s } of BUILT) {
    for (const id of ctx.avoid) ok(!s.items.some((x) => x.drill.id === id || x.swappedFrom?.id === id), `${tag}: ${id} should be left out`);
    if (ctx.noJumps) ok(s.jumps === 0 && s.items.every((x) => x.jumps === 0 && !x.hops), `${tag}: jumps left with jumps off`);
  }
  {
    const ctx = makeContext({ avoid: ['ST2'], noJumps: true });
    ok(ctx.avoid.join() === 'ST2' && ctx.noJumps === true, 'makeContext keeps avoid and noJumps');
    ok(resolveItem({ id: 'ST2' }, ctx) === null, 'resolveItem: an avoided drill is null');
    ok(start('strength', { avoid: ['ST2', 'S4'] }).drills === start('strength').drills - 2, 'avoid: two drills fewer');
  }

  // Item 31: every intro line starts inside the voice's limit and ends before "Go.". No "Next.".
  let levels = {};
  try { levels = JSON.parse(fs.readFileSync('audio/levels.json', 'utf8')); } catch { ok(false, 'audio/levels.json missing: run node tools/loudness.mjs'); }
  const len = (p) => levels[clips[p]]?.len;
  for (const { tag, s } of BUILT)
    for (const st of s.steps.filter((x) => x.kind === 'intro')) {
      const c = st.cues.find((x) => x.say);
      ok(!c.say.includes('Next.'), `${tag}: intro says "Next."`);
      let t = c.at;
      for (const p of c.say) {
        ok(t - c.at <= LATE - 0.2, `${tag}: "${p}" in the ${st.r.name} intro starts ${(t - c.at).toFixed(1)} s in, past the ${LATE} s limit`);
        if (len(p) === undefined) { ok(false, `no spoken length for "${p}"`); break; }
        t += len(p) + GAP;
      }
      ok(t - GAP <= st.dur - 0.2, `${tag}: the ${st.r.name} intro runs to ${(t - GAP).toFixed(1)} s, into "Go." at ${st.dur} s`);
    }

  // Item 19: every clip levelled to about -16 LUFS, no peak above -1 dBFS. A short or gappy line
  // ("Plank.", "Half speed.") reads low on the 400 ms loudness scale even with its words as loud as
  // the rest; it may sit under -16 only when the limiter is already at its 6 dB cap.
  for (const [p, f] of Object.entries(clips)) {
    const l = levels[f];
    if (!l) { ok(false, `clip for "${p}" not levelled: run node tools/loudness.mjs`); continue; }
    ok(l.peak <= -1.0, `"${p}" peaks at ${l.peak} dBFS`);
    ok(l.lufs <= -15.4 && l.lufs >= -20.5 && (l.lufs >= -16.6 || l.limited >= 5.5), `"${p}" is ${l.lufs} LUFS, not about -16`);
  }

  // Items 30 and 38: the built-in voice is gone, and a cut-off line never plays over the next one.
  for (const f of ['js/timer/audio.js', 'js/screens/player.js', 'js/screens/setup.js', 'js/screens/start.js'])
    ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(fs.readFileSync(f, 'utf8')), `${f} uses the iPhone's built-in voice`);
  {
    // A pretend Web Audio, so audio.js runs here without making a sound.
    const started = [];
    let state = 'running';
    let resumed = 0;
    class Src { connect() {} start() { this.on = true; started.push(this); } stop() { this.on = false; this.stopped = true; } }
    class FakeCtx {
      get state() { return state; }
      createGain() { return { gain: { value: 1 }, connect() {} }; }
      createBufferSource() { return new Src(); }
      createBuffer() { return {}; }
      resume() { resumed++; return Promise.resolve(); }
      addEventListener() {}
      removeEventListener() {}
      decodeAudioData(b) { const d = new Float32Array(2400).fill(0.5); return Promise.resolve({ sampleRate: 24000, getChannelData: () => d, name: b.name }); }
    }
    const realFetch = globalThis.fetch;
    globalThis.window = { AudioContext: FakeCtx };
    globalThis.fetch = async (url) => ({ json: async () => ({ 'A.': 'a', 'B.': 'b', 'C.': 'c', 'D.': 'd' }), arrayBuffer: async () => ({ name: url }) });
    const audio = await import('./js/timer/audio.js');
    await audio.preload(['A.', 'B.', 'C.', 'D.']);
    const playing = () => started.filter((x) => x.on).length;

    audio.say(['A.', 'B.']);
    ok(started.length === 1, 'say: one line at a time');
    started[0].on = false;
    started[0].onended?.(); // A ends, and B is due after the gap...
    audio.hush(); // ...but Next step cuts in first
    audio.say(['C.']);
    await new Promise((r) => setTimeout(r, GAP * 1000 + 80));
    ok(started.length === 2 && started[1].buffer.name.endsWith('/c') && playing() === 1, 'hush: a cut-off line\'s ending never starts another line');
    audio.say(['D.']);
    ok(playing() === 1, 'a new line waits while one is playing');
    audio.hush();
    ok(started[1].stopped && started[1].onended === null, 'hush: clears the clip\'s ending, then stops it');

    state = 'suspended';
    const before = started.length;
    audio.say(['A.']);
    ok(started.length === before && resumed > 0, 'sound asleep: the line is dropped and the sound asked back');
    state = 'running';
    audio.say(['Not recorded.']);
    ok(started.length === before, 'a line with no clip is dropped, never spoken another way');
    globalThis.fetch = realFetch;
    delete globalThis.window;
  }
}

// ===== The splits ladder =====
// Side splits, not front splits: a goalie's legs go out to the sides (Dad, 10 November 2026).
{
  const SP = await import('./js/plan/splits.js');
  const { splitsState, settleSplits, markWatched, setRung, ladderItem, rungAt } = SP;
  const NOW = new Date(2026, 10, 18, 16, 0);
  const day = (n) => new Date(2026, 10, 18 - n, 15).toISOString();
  const fresh = (over = {}) => ({ log: [], splits: { rung: 1, since: day(60), watched: [] }, ...over });
  const held = (id, n, over = {}) => ({ date: day(n), type: 'stretch', completed: true, skipped: [], done: [id], ...over });

  // --- The ladder data itself ---
  LADDER.forEach((r, k) => {
    ok(r.n === k + 1, `ladder: rung ${k + 1} is numbered ${r.n}`);
    ok(byId[r.id], `ladder: rung ${r.n} points at ${r.id}, which isn't a drill`);
    ok(r.name && r.name.length <= 28, `ladder: rung ${r.n} name too long for the row ("${r.name}")`);
    ok(fs.existsSync(`media/draw/${r.id}.webp`), `ladder: rung ${r.n} drawing ${r.id} missing`);
  });
  ok(LADDER.length === TOP && TOP >= 6, 'ladder: TOP matches the rungs');
  ok(LADDER.at(-1).watch === true, 'ladder: the top rung waits for Dad');
  ok(LADDER.filter((r) => r.watch).length >= 2, 'ladder: at least two rungs wait for Dad');
  // The goalie's shape: legs out to the SIDES. Nothing front-to-back.
  for (const d of SPLIT_DRILLS) {
    const words = [d.name, d.why, d.mistake, ...d.cues].join(' ');
    ok(!/front split|lunge|back leg|front leg|back knee/i.test(words), `${d.id}: front-splits wording ("${d.name}")`);
    ok(!d.side, `${d.id}: a side-splits hold is both legs at once, never one side at a time`);
    ok(d.hold === true && d.dose.type === 'time', `${d.id}: must be a timed hold`);
    ok(d.dose.time <= 40, `${d.id}: hold ${d.dose.time} s is over the 40 s cap (PLAN section 2)`);
    ok(d.jumps === 0 && !d.hops, `${d.id}: a stretch must have no jumps`);
    ok(d.space === 'small', `${d.id}: must fit the bedroom`);
  }

  // --- Every rung builds, in every session, and never on a game day ---
  const ladderLimits = { strength: [17, 24], power: [17, 25], stretch: [9, 16], splits: [2, 5] };
  const ladderPhrases = new Set();
  for (const { type, rung, tag, ctx } of everyLadder()) {
    const s = buildSession(type, ctx);
    phrasesOf(s).forEach((p) => ladderPhrases.add(p));
    const mins = s.total / 60;
    const [lo, hi] = ladderLimits[type];
    ok(mins >= lo && mins <= hi, `${tag}: ${mins.toFixed(1)} min is outside ${lo}-${hi}`);
    const hold = s.items.filter((it) => it.block === 'Splits');
    ok(hold.length === 1, `${tag}: expected one splits hold, got ${hold.length}`);
    ok(hold[0].name === LADDER[rung - 1].name, `${tag}: shows "${hold[0].name}", not the rung's name`);
    ok(hold[0].draw === `media/draw/${LADDER[rung - 1].id}.webp`, `${tag}: wrong drawing`);
    ok(hold[0].dose.sets === 1 && !hold[0].dose.window, `${tag}: a hold is one set, not reps`);
    ok(fs.existsSync(hold[0].draw), `${tag}: drawing ${hold[0].draw} missing`);
    // The cushion rungs say how many; nothing else claims a stack.
    const says = [hold[0].how || '', hold[0].name].join(' ');
    if (/cushion/i.test(LADDER[rung - 1].name)) ok(/cushion/i.test(says), `${tag}: a cushion rung that never says cushions`);
    for (const p of phrasesOf(s)) ok(!/shoe|sock|footwear/i.test(p), `${tag}: footwear line "${p}"`);
    for (const p of [hold[0].how, ...hold[0].cues].filter(Boolean)) ok(!/jump|bounce (up|down|into)/i.test(p), `${tag}: a stretch that says "${p}"`);
  }
  for (const p of ladderPhrases) ok(clips[p] && fs.existsSync(`audio/${clips[p]}`), `ladder: no voice clip for "${p}"`);
  {
    const item = ladderItem(fresh());
    const g = buildSession('gameday', makeContext({ room: 'big', hour: 15, ladder: item }));
    ok(!g.items.some((it) => it.block === 'Splits'), 'game day: never a long stretch before he plays');
    ok(!buildSession('gameday', makeContext({ room: 'bedroom', hour: 7, ladder: item })).items.some((it) => it.block === 'Splits'),
      'game day, bedroom: still no splits hold');
  }

  // --- Climbing it ---
  {
    const s = fresh();
    ok(splitsState(s, NOW).rung === 1 && splitsState(s, NOW).holds === 0, 'a new save starts on rung 1 with no holds');
    // One hold a day: five sessions today is one hold.
    s.log = Array.from({ length: 5 }, () => held('SP1', 0));
    ok(splitsState(s, NOW).holds === 1, 'five holds in one day count once');
    // Dad's test runs aren't his.
    s.log = [held('SP1', 1, { dad: true, extra: true }), held('SP1', 2, { dad: true, extra: true })];
    ok(splitsState(s, NOW).holds === 0, 'Dad\'s test runs never move the ladder');
    // Holds from before the rung opened don't count toward it.
    const old = fresh();
    old.splits.since = day(2);
    old.log = [held('SP1', 10), held('SP1', 1)];
    ok(splitsState(old, NOW).holds === 1, 'holds from before the rung opened don\'t count');
  }
  {
    // Six holds opens rung 2.
    const s = fresh();
    s.log = Array.from({ length: HOLDS }, (_, k) => held('SP1', k + 1));
    ok(splitsState(s, NOW).ready === true, `${HOLDS} holds opens the next rung`);
    ok(settleSplits(s, NOW) === true && s.splits.rung === 2, 'settle moves him up one rung');
    ok(splitsState(s, NOW).holds === 0, 'the new rung starts at no holds');
    ok(settleSplits(s, NOW) === false, 'settling twice doesn\'t skip a rung');
  }
  {
    // A rung Dad watches stops there until he taps Watched.
    const watchRung = LADDER.find((r) => r.watch).n;
    const s = fresh();
    setRung(s, watchRung, NOW);
    s.splits.since = day(60); // setRung starts the count again; these holds are the ones after it
    s.log = Array.from({ length: HOLDS }, (_, k) => held(rungAt(watchRung).id, k + 1));
    const st = splitsState(s, NOW);
    ok(st.waiting === true && st.ready === false, `rung ${watchRung} waits for Dad`);
    ok(settleSplits(s, NOW) === false && s.splits.rung === watchRung, 'it never climbs past Dad on its own');
    // Waiting for Dad stops the climb, not the stretch: the hold stays in his sessions, so the
    // Splits screen has to keep offering it too, or the two disagree.
    ok(ladderItem(s, NOW) !== null, 'waiting for Dad: the hold is still in his sessions');
    for (const type of ['strength', 'power', 'stretch']) {
      const built = buildSession(type, makeContext({ room: 'big', hour: 15, ladder: ladderItem(s, NOW) }));
      ok(built.items.some((it) => it.block === 'Splits'), `waiting for Dad: ${type} still has the hold`);
    }
    markWatched(s, watchRung, NOW);
    ok(s.splits.rung === watchRung + 1, 'Dad taps Watched and he moves up');
  }
  {
    // The top rung stops at the top.
    const s = fresh();
    setRung(s, TOP, NOW);
    s.splits.since = day(60);
    s.splits.watched = [TOP];
    s.log = Array.from({ length: HOLDS }, (_, k) => held(rungAt(TOP).id, k + 1));
    ok(splitsState(s, NOW).top === true, 'the top rung, held and watched: he can do the side splits');
    settleSplits(s, NOW);
    ok(s.splits.rung === TOP, 'it never climbs past the top rung');
    setRung(s, 99, NOW);
    ok(s.splits.rung === TOP, 'Dad can\'t set a rung past the top');
    setRung(s, -3, NOW);
    ok(s.splits.rung === 1, 'Dad can\'t set a rung below 1');
  }

  // --- Nothing pauses it: an ended session leaves the hold in place ---
  {
    const s = fresh();
    s.log = [{ date: day(1), type: 'strength', completed: false, done: [], skipped: [], stopped: { why: 'ended' } }];
    ok(ladderItem(s, NOW) !== null && !('pause' in splitsState(s, NOW)), 'the ladder never rests');
  }

  // --- The Done line ---
  {
    const { splitsDone } = await import('./js/screens/done.js');
    const st = splitsState(fresh(), NOW);
    ok(splitsDone(st, false, false) === '', 'a session with no splits hold says nothing about the ladder');
    ok(/0 of 6/.test(splitsDone(st, false, true)), 'after the hold it says how many he\'s done');
    ok(/next rung/i.test(splitsDone(st, true, true)), 'moving up says so');
  }
}

// ===== LEAD =====
// Fixes from the final check: Done after a skip, Dad's version line, Wall Sit Easier's cue.
{
  const { doneWords } = await import('./js/screens/done.js');
  const { versionLine } = await import('./js/screens/dad.js');
  const { DRILLS: ALL } = await import('./data/exercises.js');
  const w = doneWords({ completed: true, planned: 15, skipped: [{ id: 'S4', no: 6, why: 'here' }], stopped: null });
  ok(w.title === 'Done.' && w.line === '', 'done: a skip adds nothing to the Done line');
  for (const d of ALL) d.versions.forEach((v, k) => ok(!/sets/.test(versionLine(d, k)), `dad: ${d.id} ${v.name} version line names sets`));
  const easierWall = buildSession('strength', makeContext({ room: 'big', hour: 16, versions: { ST2: 0 } }));
  ok(phrasesOf(easierWall).includes('Hands off your legs.'), 'Wall Sit Easier (20 s) says "Hands off your legs."');
}

// ===== No hurt handling =====
// Dad, 12 November 2026: the app never asks, records, shows or reacts to anything hurting.
{
  // Old saves: hurt records turn into plain ones on load.
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const { load, migrateOldRecords } = await import('./js/store.js');
  const { counts } = await import('./js/plan/decide.js');
  const t = (d) => new Date(2026, 10, d, 16).toISOString();
  const oldSave = {
    v: 1, setupDone: true, seenAlerts: ['x'],
    log: [
      { date: t(2), type: null, completed: false, done: [], skipped: [], stopped: { why: 'hurt-before', zone: 'knee' }, dadSeen: true },
      { date: t(3), type: 'power', completed: false, short: null, done: ['W2'], skipped: [], stopped: { why: 'pain', zone: 'heel' }, dadSeen: true, cleared: true },
      { date: t(4), type: 'strength', completed: true, done: [], stopped: null, skipped: [{ id: 'S4', no: 6, why: 'hurts', zone: 'groin' }, { id: 'ST2', no: 7, why: 'here' }] },
      { date: t(5), type: 'stretch', completed: false, done: [], stopped: { why: 'ended' }, skipped: [] },
    ],
    days: { '2026-11-02': { today: 'none', tomorrow: 'none', hurts: true, type: null }, '2026-11-04': { today: 'practice', type: 'strength' } },
  };
  mem.set('crease.save', JSON.stringify(oldSave));
  const m = load();
  ok(m.log.length === 3 && !m.log.some((e) => e.stopped?.why === 'hurt-before'), 'migration: a "hurt before training" entry is dropped');
  const p = m.log[0];
  ok(p.type === 'power' && p.completed === true && !('stopped' in p) && counts(p), 'migration: a pain stop becomes a finished session that still counts');
  ok(!('dadSeen' in p) && !('cleared' in p), 'migration: dadSeen and cleared are gone');
  ok(m.log[1].skipped.every((k) => !('zone' in k) && k.why === 'here'), 'migration: skips lose their spot and read "here"');
  ok(m.log[2].stopped.why === 'ended' && !m.log[2].completed, 'migration: an ended session is left alone');
  ok(!('seenAlerts' in m) && Object.values(m.days).every((d) => !('hurts' in d)), 'migration: seenAlerts and days[...].hurts are gone');
  ok(m.days['2026-11-04'].type === 'strength', 'migration: the rest of the day record stays');
  ok(!/hurt|pain|zone|dadSeen|cleared|seenAlerts/i.test(JSON.stringify(m)), 'migration: nothing about hurting is left in the save');
  ok(migrateOldRecords({ v: 1 }).v === 1 && migrateOldRecords(null) === null, 'migration: a save with no log is fine');

  // The guard: hurt handling never comes back.
  const HURT = /hurt|pain|\bsore\b|tell dad/i;
  const dir = (d) => fs.readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`);
  const files = [...dir('js/screens'), ...dir('js/plan'), 'js/store.js', 'data/copy.js', 'data/splits.js', 'data/sessions.js', 'data/exercises.js', 'data/masks.js', 'audio/clips.json'];
  for (const f of files) {
    let text = fs.readFileSync(f, 'utf8');
    // The one exempt part: the marked migration function in store.js, which has to name the old keys.
    if (f === 'js/store.js') {
      const a = text.indexOf('// MIGRATION ONLY');
      const b = text.indexOf('// END MIGRATION');
      ok(a >= 0 && b > a, 'guard: store.js keeps its migration between the two markers');
      if (a >= 0 && b > a) text = text.slice(0, a) + text.slice(b);
    }
    const hit = text.split('\n').find((l) => HURT.test(l));
    ok(!hit, `guard: ${f} mentions hurting: ${hit?.trim()}`);
  }
}

// ===== Streak, card and masks (12 November 2026) =====
{
  const { streakStats, giveSave, MAX_SAVES } = await import('./js/plan/streak.js');
  const card = await import('./js/plan/card.js');
  const { MASKS } = await import('./data/masks.js');
  const { payoff, payoffLines } = await import('./js/screens/done.js');
  const { streakLine } = await import('./js/screens/home.js');
  const { cleanName, cleanNumber } = await import('./js/screens/card.js');
  const { SAY } = await import('./data/copy.js');
  const { simulate } = await import('./tools/sim-weeks.mjs');

  // Day n of November 2026 (n can run past 30 into December), at 4 pm.
  const day = (n, h = 16) => new Date(2026, 10, n, h);
  const s = (n, type = 'strength', more = {}) => ({ date: day(n, more.h ?? 16).toISOString(), type, completed: true, extra: false, dad: false, done: [], skipped: [], ...more });
  const run = (from, to, type = 'strength') => Array.from({ length: to - from + 1 }, (_, k) => s(from + k, type));
  const st = (log, now, gifts = []) => streakStats(log, { gifts }, now);

  // The basics.
  let x = st([], day(12));
  ok(x.days === 0 && x.best === 0 && x.saves === 1 && !x.todayDone && x.milestone === null, `streak: nothing yet is 0 with 1 save (got ${JSON.stringify(x)})`);
  ok(streakLine(x) === 'Train today to start your streak.', 'Today: "Train today to start your streak." with no streak');
  x = st(run(10, 12), day(12, 18));
  ok(x.days === 3 && x.todayDone && x.milestone === 3 && x.best === 3, `streak: three days ending today is 3, milestone 3 (got ${x.days}/${x.milestone})`);
  x = st(run(6, 11), day(12, 7));
  ok(x.days === 6 && !x.todayDone && x.milestone === null && x.savedDays.length === 0, `streak: in the morning the streak runs to yesterday, not broken (got ${x.days})`);
  ok(streakLine(x) === 'Train today to make it 7.', `Today: "Train today to make it 7." (got ${streakLine(x)})`);
  ok(streakLine(st(run(10, 12), day(12, 18))) === '', 'Today: no line once he has trained today');
  x = st([...run(10, 12), s(12, 'stretch', { h: 19 })], day(12, 20));
  ok(x.days === 3, 'streak: two sessions on one day count once');

  // What never counts.
  const noise = [
    s(9, 'stretch', { extra: true }), // extra stretching
    s(9, 'splits', { extra: true }), // the 3-minute Splits
    s(9, 'power', { dad: true, extra: true }), // Dad's test run
    s(9, 'strength', { test: true }), // an older test run
    s(9, 'power', { completed: false, stopped: { why: 'ended' } }), // ended before it counted
    s(9, null), // no session type
  ];
  x = st([...noise, ...run(10, 12)], day(12, 18));
  ok(x.days === 3 && x.best === 3 && x.saves === 1, `streak: extras, Splits, test runs and sessions that didn't count are ignored (got ${x.days}, saves ${x.saves})`);
  x = st(noise, day(9, 20));
  ok(x.days === 0 && !x.todayDone, 'streak: a day of only extras and test runs is not a day');

  // Saves: spent, earned, capped.
  x = st([...run(1, 3), ...run(5, 6)], day(6, 18));
  ok(x.days === 5 && x.saves === 0 && x.savedDays.join() === '2026-11-04' && x.best === 5, `streak: a missed day spends his save and the saved day doesn't add (got ${x.days}, saves ${x.saves}, ${x.savedDays})`);
  x = st([...run(1, 3), ...run(6, 7)], day(7, 18));
  ok(x.days === 2 && x.saves === 1 && x.savedDays.length === 0 && x.best === 3, `streak: a gap longer than his saves spends nothing, goes to 0 and keeps the best (got ${x.days}, saves ${x.saves}, best ${x.best})`);
  x = st(run(1, 3), day(5, 8));
  ok(x.days === 3 && x.saves === 0 && x.savedDays.join() === '2026-11-04', `streak: a gap still open this morning is covered (got ${x.days}, saves ${x.saves})`);
  x = st(run(1, 3), day(6, 8));
  ok(x.days === 0 && x.saves === 1 && x.savedDays.length === 0 && x.best === 3, `streak: two days missed with one save: 0, and the save comes back (got ${x.days}, saves ${x.saves})`);
  x = st(run(1, 7), day(7, 18));
  ok(x.days === 7 && x.saves === 2 && x.saveEarned && x.milestone === 7 && x.nextSaveAt === 14, `streak: 7 in a row earns a save (got saves ${x.saves}, earned ${x.saveEarned})`);
  x = st(run(1, 14), day(14, 18));
  ok(x.saves === MAX_SAVES && !x.saveEarned && x.milestone === 14, `streak: saves stop at 2 (got ${x.saves}, earned ${x.saveEarned})`);
  x = st([...run(1, 7), ...run(10, 16)], day(16, 18));
  ok(x.days === 14 && x.saves === 1 && x.savedDays.join() === '2026-11-08,2026-11-09', `streak: two saves cover two days, and 14 (7 counted days after them) earns one back (got ${x.days}, saves ${x.saves})`);
  x = st([...run(1, 6), ...run(8, 13)], day(13, 18));
  ok(x.days === 12 && x.saves === 1, `streak: the 7th counted day earns, saved days don't (got ${x.days}, saves ${x.saves})`);
  x = st([...run(1, 7), ...run(11, 12)], day(12, 18));
  ok(x.days === 2 && x.saves === 2 && x.best === 7, `streak: three days off with two saves: back to 0, saves kept (got ${x.days}, saves ${x.saves})`);
  x = st([...run(1, 3), ...run(5, 9)], day(9, 18));
  ok(x.days === 8 && x.saves === 1, `streak: the 7th counted day earns the spent save back (got ${x.days}, saves ${x.saves})`);
  x = st([...run(1, 3), ...run(5, 8)], day(8, 18));
  ok(x.days === 7 && x.saves === 1 && x.saveEarned, `streak: 7 counted days with a saved day between them earns a save (got ${x.days}, ${x.saves})`);

  // Dad's gifts.
  x = st([...run(1, 3), ...run(6, 7)], day(7, 18), ['2026-11-05']);
  ok(x.days === 5 && x.saves === 0 && x.savedDays.join() === '2026-11-04,2026-11-05', `streak: Dad's save during the days off covers the second one (got ${x.days}, saves ${x.saves})`);
  x = st(run(5, 6), day(6, 18), ['2026-11-01']);
  ok(x.saves === 2, `streak: a save Dad gave before the first session is in hand (got ${x.saves})`);
  x = st(run(5, 6), day(6, 18), ['2026-11-05', '2026-11-05']);
  ok(x.saves === 2, `streak: gifts stop at 2 (got ${x.saves})`);
  x = st([], day(6), ['2026-11-06']);
  ok(x.saves === 2, 'streak: a gift with no sessions yet');
  x = st(run(1, 3), day(6, 8), ['2026-11-06']);
  ok(x.days === 0, 'streak: a save given after the streak already broke does not bring it back');
  const gs = { log: run(1, 3), streak: { gifts: [] } };
  ok(giveSave(gs, day(3, 18)) && gs.streak.gifts.join() === '2026-11-03', 'Dad: giving a save records today\'s date');
  ok(!giveSave(gs, day(3, 19)) && gs.streak.gifts.length === 1, 'Dad: no gift once he holds 2');

  // Dates: a new year, and the clocks changing.
  const ny = [new Date(2026, 11, 30, 21), new Date(2026, 11, 31, 23, 50), new Date(2027, 0, 1, 0, 10), new Date(2027, 0, 2, 9)].map((d) => ({ date: d.toISOString(), type: 'stretch', completed: true }));
  x = st(ny, new Date(2027, 0, 2, 12));
  ok(x.days === 4 && x.milestone === null, `streak: runs across New Year (got ${x.days})`);
  x = st(ny.slice(0, 2), new Date(2027, 0, 2, 7));
  ok(x.days === 2 && x.saves === 0 && x.savedDays.join() === '2027-01-01', `streak: a save across New Year (got ${x.days} ${x.savedDays})`);
  const tz = process.env.TZ;
  process.env.TZ = 'America/Toronto';
  {
    // Clocks went back 1 November 2026 and go forward 14 March 2027. Late and early sessions.
    const fall = [[10, 31, 23, 30], [11, 1, 0, 30], [11, 2, 23, 59], [11, 3, 6, 0]].map(([m, d, h, mi]) => ({ date: new Date(2026, m - 1, d, h, mi).toISOString(), type: 'strength', completed: true }));
    const xs = st(fall, new Date(2026, 10, 3, 12));
    ok(xs.days === 4 && xs.savedDays.length === 0, `streak: the November clock change (got ${xs.days})`);
    const spring = [[3, 13, 23, 30], [3, 14, 0, 30], [3, 15, 22, 0], [3, 16, 7, 0]].map(([m, d, h, mi]) => ({ date: new Date(2027, m - 1, d, h, mi).toISOString(), type: 'strength', completed: true }));
    const xp = st(spring, new Date(2027, 2, 16, 12));
    ok(xp.days === 4 && xp.savedDays.length === 0, `streak: the March clock change (got ${xp.days})`);
    const xg = st(spring.filter((_, i) => i !== 2), new Date(2027, 2, 16, 12));
    ok(xg.days === 3 && xg.savedDays.join() === '2027-03-15', `streak: a save on the day after the clocks go forward (got ${xg.days} ${xg.savedDays})`);
  }
  if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;

  // An older save replays cleanly: a migrated stop that counts, and junk dates are skipped.
  x = st([{ date: day(1).toISOString(), type: 'power', completed: true }, { date: 'nonsense', type: 'power', completed: true }, s(2)], day(2, 18));
  ok(x.days === 2, 'streak: an older save with a bad date still replays');
  ok(st(run(10, 12), day(12, 18), undefined).days === 3 && streakStats(run(10, 12), undefined, day(12, 18)).days === 3, 'streak: a save with no streak record works');

  // ---- The card ----
  const blankSave = { log: [], lights: [], splits: { rung: 1 }, streak: { gifts: [] }, card: {} };
  const c0 = card.cardStats(blankSave, day(12));
  ok(c0.overall === 50 && c0.tier === 'Bronze' && c0.ratings.every((r) => r.value === 50) && c0.nextTier.name === 'Silver' && c0.nextTier.at === 60, 'card: a new card is 50s, Bronze, Silver at 60');
  ok(c0.ratings.map((r) => r.id).join() === 'strength,power,flex,reflex,compete', 'card: five ratings in order');
  for (const type of ['strength', 'power', 'stretch']) {
    const c1 = card.cardStats({ ...blankSave, log: [s(12, type)] }, day(12, 18));
    const moved = c1.ratings.filter((r) => r.value > 50).map((r) => r.id);
    ok(moved.length >= 1, `card: the first ${type} session moves a rating (moved ${moved})`);
  }
  const cg = card.cardStats({ ...blankSave, log: [s(12, 'gameday')] }, day(12, 18));
  ok(cg.ratings.filter((r) => r.value > 50).map((r) => r.id).join() === 'compete', 'card: Game Day feeds only the streak (Compete)');
  const cx = card.cardStats({ ...blankSave, log: noise }, day(12, 18));
  ok(cx.overall === 50, 'card: extras and test runs never move the card');
  const rf = (ms) => card.ratingsFrom({ lightsMs: ms }).ratings.find((r) => r.id === 'reflex').value;
  ok(rf(450) === 50 && rf(600) === 50 && rf(200) === 99 && rf(150) === 99 && rf(null) === 50 && rf(325) === 75, `card: Reflex from Lights (450 ms 50, 200 ms 99; got ${rf(450)} ${rf(200)} ${rf(325)})`);
  ok(card.bestLights([{ ms: 250, counted: false }, { ms: 300, counted: true }]) === 300, 'card: practice rounds of Lights do not count');
  ok(card.tierOf(59).name === 'Bronze' && card.tierOf(60).name === 'Silver' && card.tierOf(70).name === 'Gold' && card.tierOf(80).name === 'Elite' && card.tierOf(90).name === 'Legend' && card.tierOf(99).name === 'Legend', 'card: tier boundaries');
  ok(card.ratingsFrom({ strength: 1e6, power: 1e6, stretch: 1e6, rung: 10, lightsMs: 100, bestStreak: 1e6 }).overall === 99, 'card: everything maxed is 99, never more');
  const flexAt = (sv) => card.cardStats(sv, day(12)).ratings.find((r) => r.id === 'flex').value;
  ok(flexAt({ ...blankSave, splits: { rung: 6 } }) === 50 + Math.round(19 * 5 / 9) && flexAt({ ...blankSave, splits: { rung: 3 }, card: { rungPeak: 6 } }) === flexAt({ ...blankSave, splits: { rung: 6 } }), 'card: Flex keeps the highest splits rung when Dad moves him back');
  const before = card.ratingsFrom({ strength: 10, power: 5 });
  const after = card.ratingsFrom({ strength: 11, power: 5 });
  const gains = card.cardGains(before, after);
  ok(gains.ratings.length === (after.ratings[0].value > before.ratings[0].value ? 1 : 0) && gains.ratings.every((r) => r.to > r.from), 'card: cardGains lists only what rose');

  // A simulated season (tools/sim-weeks.mjs): his real hockey week, 1 to 3 days off a week.
  // Lights best drifts from about 380 ms to 300; the splits rung climbs a rung a week of training.
  const TARGETS = [];
  for (const seed of [7, 11, 23]) {
    const rows = simulate({ weeks: 53, seed, skips: 'random' });
    const slog = rows.filter((r) => r.did && r.did !== 'power-ended').map((r) => ({ date: r.now.toISOString(), type: r.did, completed: true }));
    const at = (w) => { const e = rows[w * 7 - 1].date; return new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 30); };
    const saveAt = (L, w) => {
      const daysTrained = new Set(L.map((e) => e.date.slice(0, 10))).size;
      return { log: L, lights: [{ date: L[0]?.date, counted: true, ms: Math.round(300 + 80 * Math.exp(-w / 8)) }], splits: { rung: Math.min(10, 1 + Math.floor(daysTrained / 7)) }, streak: { gifts: [] }, card: {} };
    };
    const ovr = {};
    const firstWeek = {};
    for (let w = 1; w <= 52; w++) {
      const now = at(w);
      const L = slog.filter((e) => new Date(e.date) <= now);
      const c = card.cardStats(saveAt(L, w), now);
      ovr[w] = c.overall;
      for (const t of ['Silver', 'Gold', 'Elite', 'Legend']) if (card.tierOf(c.overall).name === t || c.overall >= card.TIERS.find((x) => x.name === t).at) firstWeek[t] ??= w;
    }
    TARGETS.push({ seed, ovr, firstWeek });
    ok(firstWeek.Silver >= 2 && firstWeek.Silver <= 4, `card season ${seed}: Silver in week 2 to 4 (week ${firstWeek.Silver})`);
    ok(firstWeek.Gold >= 9 && firstWeek.Gold <= 16, `card season ${seed}: Gold around month 3 (week ${firstWeek.Gold})`);
    ok(firstWeek.Elite >= 20 && firstWeek.Elite <= 32, `card season ${seed}: Elite around month 6 (week ${firstWeek.Elite})`);
    // No rating ever drops when a session is added.
    let prev = null;
    let dropped = null;
    for (let i = 1; i <= slog.length; i += 1) {
      const L = slog.slice(0, i);
      const now = new Date(L[i - 1].date);
      const c = card.cardStats({ ...saveAt(L, 1), lights: [] }, now);
      if (prev && (c.overall < prev.overall || c.ratings.some((r, k) => r.value < prev.ratings[k].value))) dropped ??= L[i - 1].date;
      prev = c;
    }
    ok(!dropped, `card season ${seed}: no rating drops when a session is added (dropped at ${dropped})`);
  }
  globalThis.CREASE_SEASON = TARGETS; // printed by: node tests.mjs season

  // ---- Masks ----
  ok(MASKS.length === 7 && MASKS.map((m) => m.streak).join() === '0,3,7,14,30,60,100' && MASKS.every((m, i) => m.id === `m${i}`), 'masks: seven, at 0, 3, 7, 14, 30, 60, 100');
  const ms = card.maskState({ log: [...run(1, 7), ...run(20, 21)], streak: { gifts: [] }, card: {} }, day(21, 18));
  ok(ms.list.filter((m) => m.unlocked).map((m) => m.name).join() === 'Rookie,Ice,Bolt', 'masks: unlocked by his best streak, so a broken streak keeps them');
  ok(ms.wearing.id === 'm0', 'masks: Rookie until he picks one');
  ok(card.maskState({ log: [], card: { mask: 'm4' } }, day(1)).wearing.id === 'm0', 'masks: a locked pick falls back to Rookie');
  ok(card.maskState({ log: run(1, 3), card: { mask: 'm1' } }, day(3, 18)).wearing.id === 'm1', 'masks: wears the one he picked');
  ok(card.newMasks(2, 3).map((m) => m.id).join() === 'm1' && card.newMasks(3, 3).length === 0 && card.newMasks(0, 0).length === 0, 'masks: newMasks');
  ok(fs.readFileSync('tools/stamp.mjs', 'utf8').includes("'media'") && fs.readFileSync('tools/stamp.mjs', 'utf8').includes("'js'"), 'deploy: stamp.mjs caches media/ (masks) and js/ (new files)');

  // ---- Done: the payoff ----
  const mk = (log) => ({ log, lights: [], splits: { rung: 1 }, streak: { gifts: [] }, card: {} });
  const sixDays = run(5, 10);
  const today7 = s(11, 'power', { h: 18 });
  const sv = mk([...sixDays, today7]);
  const p7 = payoff(sv, today7, day(11, 19));
  ok(p7.streak?.from === 6 && p7.streak?.to === 7, `done: the streak counts up from yesterday's number (got ${JSON.stringify(p7.streak)})`);
  ok(p7.milestone === 7 && p7.masks.map((m) => m.name).join() === 'Bolt' && p7.saveEarned, 'done: day 7 is a milestone, Bolt and a save');
  ok(p7.say.join('|') === 'Seven in a row.|New mask.', `done: the coach says the milestone (got ${p7.say})`);
  const lines = payoffLines(p7);
  const kinds = lines.map((l) => l.kind);
  ok(kinds[0] === 'streak' && kinds.indexOf('mask') > kinds.lastIndexOf('rating') && kinds.at(-1) === 'save', `done: lines in order (got ${kinds})`);
  ok(lines.some((l) => l.text === 'Power 50 → 52' || /^Power \d+ → \d+$/.test(l.text)) && lines.some((l) => l.text === 'New mask: Bolt!') && lines.some((l) => l.text === 'Save earned.'), `done: rating, mask and save words (got ${lines.map((l) => l.text)})`);
  ok(lines.filter((l) => l.text.includes('!')).every((l) => l.kind === 'mask'), 'done: the only exclamation mark is a new mask');
  for (const l of lines) ok(!/awesome|great job|crushing|keep it up|almost/i.test(l.text), `done: no cheerleading in "${l.text}"`);
  const second = s(11, 'stretch', { h: 20 });
  const sv2 = mk([...sixDays, today7, second]);
  const p2 = payoff(sv2, second, day(11, 21));
  ok(p2.streak === null && p2.milestone === null && p2.masks.length === 0 && !p2.saveEarned && p2.say.length === 0, 'done: a second session the same day does not raise the streak again');
  const ext = s(11, 'stretch', { extra: true });
  ok(payoffLines(payoff(mk([...sixDays, ext]), ext, day(11, 19))).length === 0, 'done: an extra shows none of it');
  const tr = s(11, 'power', { dad: true, extra: true });
  ok(payoffLines(payoff(mk([...sixDays, tr]), tr, day(11, 19))).length === 0, 'done: a test run shows none of it');
  const notIn = s(11, 'power');
  ok(payoffLines(payoff(mk(sixDays), notIn, day(11, 19), { test: true })).length === 0, 'done: a test run that never reached the log shows none of it');
  const short = s(11, 'power', { completed: false, stopped: { why: 'ended' } });
  ok(payoffLines(payoff(mk([...sixDays, short]), short, day(11, 19))).length === 0, 'done: a session that did not count shows none of it');
  // A tier change: build a save sitting just under Silver.
  {
    let tierLine = null;
    const L = [];
    for (let n = 1; n <= 40 && !tierLine; n++) {
      const e = s(n, ['strength', 'power', 'stretch'][n % 3]);
      L.push(e);
      const p = payoff(mk([...L]), e, new Date(e.date));
      tierLine = payoffLines(p).find((l) => l.kind === 'tier') || null;
    }
    ok(tierLine?.text === 'Silver card.', `done: a tier change says "Silver card." (got ${tierLine?.text})`);
  }
  ok(SAY.milestone[3] === 'Three in a row.' && SAY.milestone[100] === 'One hundred in a row.' && SAY.newMask === 'New mask.', 'voice: milestone lines');

  // ---- The card's name and number ----
  ok(cleanName('  wall-e 2000 ') === 'wall-e' && cleanName('ABCDEFGHIJKLMNOP') === 'ABCDEFGHIJKL' && cleanName('') === '', 'card: names are letters, 12 at most');
  ok(cleanNumber('031') === '3' && cleanNumber('99') === '99' && cleanNumber('a') === '' && cleanNumber('7x') === '7', 'card: numbers 0 to 99');
  for (const f of ['js/screens/card.js', 'js/plan/card.js', 'js/plan/streak.js', 'data/masks.js', 'js/screens/home.js', 'js/screens/done.js']) {
    ok(!/placeholder="[A-Z][a-z]+"|name:\s*'[A-Z][a-z]+'\s*,\s*number/.test(fs.readFileSync(f, 'utf8')), `card: no default name in ${f}`);
  }
}

if (process.argv[2] === 'season') {
  for (const t of globalThis.CREASE_SEASON || []) console.log(`seed ${t.seed}: ` + [1, 2, 4, 12, 26, 52].map((w) => `week ${w} ${t.ovr[w]}`).join(', ') + ` | first Silver ${t.firstWeek.Silver}, Gold ${t.firstWeek.Gold}, Elite ${t.firstWeek.Elite}, Legend ${t.firstWeek.Legend ?? '-'}`);
}

// The milestone lines are recorded.
{
  const { SAY } = await import('./data/copy.js');
  const clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8'));
  for (const p of [...Object.values(SAY.milestone), SAY.newMask]) ok(clips[p] && fs.existsSync(`audio/${clips[p]}`), `voice: no clip for "${p}"`);
}
