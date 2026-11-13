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
const BOSS_LIMITS = [23, 28];
const JUMP_CAP = 50;
const draws = new Set();
const allPhrases = new Set();
const BUILT = [];
for (const { type, vname, lname, tag, ctx } of everyContext()) {
  const s = buildSession(type, ctx);
  BUILT.push({ type, vname, lname, tag, ctx, s });
  const min = s.total / 60;
  // A Boss day is a Strength with a third round of the circuit: about 6 minutes longer.
  const [lo, hi] = ctx.boss ? BOSS_LIMITS : LIMITS[type];
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
  ok(why({ yesterdayGame: true }, powerDue(WED), WED) === 'You played yesterday, so it\'s Strength in place of Power.', 'rules: day-after-game reason line');
  ok(go({ tomorrow: 'game' }, powerDue(WED), WED).type === 'stretch', 'rules: day before a game stays Stretch');

  // Item 12: no Power on a Friday or Saturday, whatever he says about tomorrow.
  for (const now of [FRI, SAT]) for (const tomorrow of ['practice', 'none'])
    ok(go({ tomorrow }, powerDue(now), now).type === 'strength', `rules: ${now.toDateString()} with "${tomorrow}" tomorrow: Strength, never Power`);
  ok(why({}, powerDue(FRI), FRI) === 'There\'s no Power on Fridays, so today is Strength.', 'rules: Friday reason line');
  // Friday he said "Practice" for Saturday and skipped Saturday: Sunday asks about yesterday instead of trusting it.
  const friSaid = { [dayKey(FRI)]: { today: 'none', tomorrow: 'practice' } };
  ok(D.knownYesterdayGame([], friSaid, day(22)) === undefined, 'rules: a "practice tomorrow" from two days ago isn\'t trusted');
  ok(D.knownYesterdayGame([], { [dayKey(FRI)]: { today: 'none', tomorrow: 'game' } }, day(22)) === true, 'rules: a "game tomorrow" from two days ago is');
  // Power moves to the day before: Thursday, or any day before a practice.
  ok(go({}, [did(THU, 3, 'power'), did(THU, 5, 'strength')], THU).type === 'power', 'rules: Thursday takes Power when it fits, since Friday can\'t');
  ok(go({ tomorrow: 'practice' }, [did(WED, 3, 'power'), did(WED, 5, 'strength')], WED).type === 'power', 'rules: practice tomorrow: Power today when it fits');

  // Item 24: reason lines that are true.
  ok(why({ tomorrow: 'practice' }, powerDue(WED), WED) === 'No hockey today and no game tomorrow, so it\'s a Power day. Your last one was Friday.', 'rules: Power reason with practice tomorrow');
  ok(why({ today: 'practice' }, powerDue(WED), WED) === 'You have practice today, so it\'s Strength in place of Power.', 'rules: practice-day reason says Power, not jumping');
  ok(why({}, [], WED) === 'Your first session is Strength.', 'rules: first session reason');
  ok(go({ tomorrow: 'practice' }, [], WED).type === 'strength' && go({}, [], THU).type === 'strength', 'rules: first session is Strength even before a practice or a Friday');
  ok(why({}, [did(WED, 2, 'gameday')], WED) === 'This is your first Strength session.', 'rules: first Strength after other sessions');

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
  ok(str.drills === 16, 'player: Strength has 16 drills (15 and the finisher)');
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
  // The one circuit drill left in log.done is the finisher's push-ups, a drill number of its own.
  ok(noMain.done.length === 9 && noMain.done.filter((id) => ['ST1', 'ST3', 'ST4', 'S4', 'ST2', 'W7'].includes(id)).join() === 'ST1', 'player: skipped drills are left out of log.done');
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
  // Restart this drill (pause sheet): back to the drill's intro, its cues play again, no minutes lost or added.
  for (const type of ['strength', 'power', 'gameday', 'stretch']) {
    let t = 0;
    const s = build(type);
    const cues = [];
    const r = new Runner(s, { onCue: (c, st) => cues.push(st.i) });
    r.now = () => t;
    r.start();
    // Walk to a work step in the middle of the session.
    const wi = s.steps.findIndex((st, i) => i > s.steps.length / 2 && st.kind === 'work');
    r.jumpTo(wi);
    t += 3000; r.tick();
    const cur = r.current();
    const before = r.activeMs();
    r.pause();
    t += 4000;
    const at = r.drillStartIndex();
    const first = s.steps[at];
    ok(at <= cur.i && first.drillNo === cur.drillNo && first.kind === 'intro', `restart (${type}): goes to the intro of the same drill (step ${at}, ${first.kind}, drill ${first.drillNo} vs ${cur.drillNo})`);
    ok(!s.steps.slice(at + 1, cur.i + 1).some((st) => st.kind === 'intro'), `restart (${type}): it is the nearest intro, so a circuit restarts this round's turn`);
    cues.length = 0;
    r.jumpTo(at);
    ok(r.current().i === at && Math.abs(r.remaining() - first.dur) < 0.001, `restart (${type}): the step's full time is left`);
    ok(Math.abs(r.activeMs() - before) < 1, `restart (${type}): restarting while paused adds no minutes`);
    r.resume();
    t += (first.dur + 1) * 1000; r.tick();
    ok(cues.includes(at) || first.cues.length === 0, `restart (${type}): the intro's words play again`);
    ok(r.current().i === at + 1, `restart (${type}): then the session carries on from there`);
    r.stop();
  }
  {
    const pl = fs.readFileSync(new URL('./js/screens/player.js', import.meta.url), 'utf8');
    ok(/data-act="restart">Restart this drill</.test(pl) && /restart: \(\) =>/.test(pl), 'restart: the Paused sheet has a "Restart this drill" button');
  }
  // The coach counts rep sets out loud (13 November 2026).
  {
    const B = await import('./js/plan/build.js');
    const { countSay, SAY } = await import('./data/copy.js');
    ok(countSay(1) === 'One.' && countSay(12) === 'Twelve.', 'count: the coach says "One." to "Twelve."');
    let sets = 0;
    let pushups = false;
    for (const { type, ctx } of [...B.everyContext(), ...B.everyLadder()]) {
      const sess = B.buildSession(type, ctx);
      for (const st of sess.steps) {
        if (st.kind !== 'work') continue;
        const nums = st.cues.filter((c) => c.count);
        const d = st.r.drill;
        const o = { splitAt: st.cues.some((c) => c.say && Object.values(SAY.switch).includes(c.say[0])) ? 1 : 0, side: st.side };
        if (!B.counted(st.r, o)) { ok(nums.length === 0, `count: ${st.r.name} (${type}) is not a counted set, so no numbers are said`); continue; }
        sets++;
        const n = st.reps;
        const halves = o.splitAt ? 2 : 1;
        ok(nums.length === n * halves, `count: ${st.r.name} (${type}) says ${n * halves} numbers, got ${nums.length}`);
        ok(nums.every((c, i) => c.say[0] === countSay((i % n) + 1) && c.must), `count: ${st.r.name} counts One to ${n} in order`);
        ok(nums.every((c) => c.at > 0.5 && c.at <= st.dur - 1), `count: ${st.r.name} every number is inside the set, the last at least a second before the end`);
        ok(nums.every((c, i) => i === 0 || c.at - nums[i - 1].at >= 1.5), `count: ${st.r.name} numbers are at least 1.5 s apart`);
        ok(!st.cues.some((c) => c.say && c.say.includes(SAY.tenSeconds)), `count: ${st.r.name} a counted set doesn't say "Ten seconds."`);
        ok(st.cues.filter((c) => c.say && !c.count && !c.must).length === 0, `count: ${st.r.name} coaching lines ride on a number, never between two`);
        ok(nums.every((c) => c.say.length <= 2) && !(nums.at(-1).say.length > 1), `count: ${st.r.name} at most one coaching line per number, none on the last`);
        ok(!d.alternate && n >= B.COUNT.min, `count: ${st.r.name} only straight sets of ${B.COUNT.min} or more are counted`);
        if (d.id === 'ST1' && type === 'strength' && n === 8) pushups = true;
      }
      const fin = sess.steps.find((st) => st.finisher && st.kind === 'work');
      if (fin) ok(!fin.cues.some((c) => c.count), 'count: the Finisher is never counted by the coach');
    }
    ok(sets > 50 && pushups, `count: rep sets are counted, 8 push-ups among them (${sets} sets)`);
  }
  // The camera watches every set it can count, and the coach says the reps it sees.
  {
    const P = await import('./js/screens/player.js');
    const B = await import('./js/plan/build.js');
    const C = await import('./data/copy.js');
    ok(C.countSay(21) === 'Twenty-one.' && C.countSay(30) === 'Thirty.' && C.countSay(40) === 'Forty.' && C.COUNT_MAX === 40, 'camera count: the coach has numbers to forty');
    for (let n = 1; n <= C.COUNT_MAX; n++) ok(!!clips[C.countSay(n)], `camera count: no voice clip for "${C.countSay(n)}"`);
    const names = new Set();
    for (const { type, ctx } of B.everyContext()) {
      for (const st of B.buildSession(type, ctx).steps) {
        if (!P.camSet(st)) continue;
        names.add(st.finisher ? 'Finisher' : st.r.drill.id);
        ok(st.kind === 'work' && (st.finisher || (st.reps !== undefined && !st.r.drill.side)), `camera count: ${st.r.name} is a Finisher or a plain rep set`);
      }
    }
    ok(names.has('Finisher') && names.has('ST1') && names.has('ST3') && names.has('P12') && !names.has('S4'), `camera count: push-ups, squats, burpees and the Finisher; side lunges only as a Finisher (${[...names].join()})`);
    ok(!P.camSet({ kind: 'intro', r: { drill: { id: 'ST1' } } }) && !P.camSet({ kind: 'work', reps: 8, r: { drill: { id: 'W2' } } }) && !P.camSet(null), 'camera count: nothing else is watched');
    const pl = fs.readFileSync(new URL('./js/screens/player.js', import.meta.url), 'utf8');
    ok(pl.includes('audio.say([countSay(n)])') && pl.includes('camCounting(st, c.count) ? c.say.slice(1) : c.say'), 'camera count: the coach says the camera\'s number and the paced one stays quiet');
    ok(pl.includes('camSeen && (camCount > 0 || n < 3)'), 'camera count: if the camera has counted nothing by "Three.", the paced count carries on');
  }
  // The camera's count is big on the Finisher, and Dad's screen says what it did last time.
  {
    const pl = fs.readFileSync(new URL('./js/screens/player.js', import.meta.url), 'utf8');
    ok(pl.includes('<div class="pl-camn" hidden><b>0</b><span>reps</span></div>') && pl.includes("'The camera stopped. Count your own reps.'"), 'camera: a big count beside the picture, and a line when it stops');
    const D = await import('./js/screens/dad.js');
    ok(D.camLastWords({ n: 9, why: '' }) === 'The camera counted 9 on the last set it watched.', 'camera: Dad sees the last count');
    ok(D.camLastWords({ n: 0, why: '' }) === 'The camera watched the last set but counted 0.', 'camera: Dad sees a zero count');
    ok(D.camLastWords({ n: 2, why: 'slow' }) === 'The camera stopped after counting 2 on the last set it watched. Reason: slow.' && D.camLastWords(null) === '', 'camera: Dad sees why it stopped');
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
  ok(copy.ROOM_HINT.bedroom === 'Drills that need a lot of space are swapped for ones that fit a small room.' && copy.ROOM_HINT.big === 'Clear about 3 metres of space around you.', 'Today: room hints');

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
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }).line === 'A session counts once you do 8 of its 15 drills.', 'done: "Do 8 of 15 drills and it counts."');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 11, need: 8, short: 'main' }).line === 'A session counts once you do half of the main drills.', 'done: the main-block rule');
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
  ok(home.lightsLineHtml(ls.lights).includes('<b>298 ms</b>') && home.lightsLineHtml([]).includes('No score yet'), 'Today: "Lights · best 298 ms"');
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
    ok(/moved up/i.test(splitsDone(st, true, true)), 'moving up says so');
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
  ok(rf(450) === 50 && rf(600) === 50 && rf(200) === 79 && rf(150) === 79 && rf(null) === 50 && rf(325) === 65, `card: Reflex from Lights alone is 60% of it (450 ms 50, 200 ms 79; got ${rf(450)} ${rf(200)} ${rf(325)})`);
  const rb = (l, h) => card.ratingsFrom({ lightsMs: l, handsMs: h }).ratings.find((r) => r.id === 'reflex').value;
  ok(rb(200, 300) === 99 && rb(null, 300) === 70 && rb(null, 600) === 50 && rb(null, 700) === 50 && rb(null, 250) === 70 && rb(null, 450) === 60, `card: Reflex from Glove or Blocker is 40% of it (600 ms 0, 300 ms all; got ${rb(200, 300)} ${rb(null, 300)} ${rb(null, 450)})`);
  ok(card.bestLights([{ ms: 250, counted: false }, { ms: 300, counted: true }]) === 300, 'card: practice rounds of Lights do not count');
  ok(card.tierOf(59).name === 'Bronze' && card.tierOf(60).name === 'Silver' && card.tierOf(70).name === 'Gold' && card.tierOf(80).name === 'Elite' && card.tierOf(90).name === 'Legend' && card.tierOf(99).name === 'Legend', 'card: tier boundaries');
  ok(card.ratingsFrom({ strength: 1e6, power: 1e6, stretch: 1e6, rung: 10, lightsMs: 100, handsMs: 100, bestStreak: 1e6 }).overall === 99, 'card: everything maxed is 99, never more');
  const flexAt = (sv) => card.cardStats(sv, day(12)).ratings.find((r) => r.id === 'flex').value;
  ok(flexAt({ ...blankSave, splits: { rung: 6 } }) === 50 + Math.round(19 * 5 / 9) && flexAt({ ...blankSave, splits: { rung: 3 }, card: { rungPeak: 6 } }) === flexAt({ ...blankSave, splits: { rung: 6 } }), 'card: Flex keeps the highest splits rung when Dad moves him back');
  const before = card.ratingsFrom({ strength: 10, power: 5 });
  const after = card.ratingsFrom({ strength: 11, power: 5 });
  const gains = card.cardGains(before, after);
  ok(gains.ratings.length === (after.ratings[0].value > before.ratings[0].value ? 1 : 0) && gains.ratings.every((r) => r.to > r.from), 'card: cardGains lists only what rose');

  // A simulated season (tools/sim-weeks.mjs): his real hockey week, 1 to 3 days off a week.
  // Lights best drifts from about 380 ms to 300, Glove or Blocker from about 520 ms to 420 (the same
  // share of its range); the splits rung climbs a rung a week of training.
  const TARGETS = [];
  for (const seed of [7, 11, 23]) {
    const rows = simulate({ weeks: 53, seed, skips: 'random' });
    const slog = rows.filter((r) => r.did && r.did !== 'power-ended').map((r) => ({ date: r.now.toISOString(), type: r.did, completed: true }));
    const at = (w) => { const e = rows[w * 7 - 1].date; return new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 30); };
    const saveAt = (L, w) => {
      const daysTrained = new Set(L.map((e) => e.date.slice(0, 10))).size;
      return { log: L, lights: [{ date: L[0]?.date, counted: true, ms: Math.round(300 + 80 * Math.exp(-w / 8)) }], hands: [{ date: L[0]?.date, counted: true, ms: Math.round(420 + 110 * Math.exp(-w / 8)) }], splits: { rung: Math.min(10, 1 + Math.floor(daysTrained / 7)) }, streak: { gifts: [] }, card: {} };
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
    ok(firstWeek.Silver >= 3 && firstWeek.Silver <= 4, `card season ${seed}: Silver in week 3 to 4 (week ${firstWeek.Silver})`);
    ok(firstWeek.Gold >= 10 && firstWeek.Gold <= 12, `card season ${seed}: Gold in week 10 to 12 (week ${firstWeek.Gold})`);
    // Compete counts every training day since 12 Nov 2026, so a kid who misses days gets there sooner than before.
    ok(firstWeek.Elite >= 17 && firstWeek.Elite <= 22, `card season ${seed}: Elite in week 17 to 22 (week ${firstWeek.Elite})`);
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
  ok(MASKS.length === 18 && MASKS.every((m, i) => m.id === `m${i}`), 'masks: eighteen, m0 to m17');
  ok(MASKS.slice(0, 7).map((m) => `${m.name}:${m.by}:${m.n}`).join() === 'Rookie:streak:0,Ice:streak:3,Bolt:streak:7,Shark:streak:14,Wolf:streak:30,Dragon:streak:60,Champ:streak:100', 'masks: the first seven are the streak masks, unchanged');
  const ms = card.maskState({ log: [...run(1, 7), ...run(20, 21)], streak: { gifts: [] }, card: {} }, day(21, 18));
  ok(ms.list.filter((m) => m.unlocked).map((m) => m.name).join() === 'Rookie,Ice,Bolt', 'masks: unlocked by his best streak, so a broken streak keeps them');
  ok(ms.wearing.id === 'm0', 'masks: Rookie until he picks one');
  ok(card.maskState({ log: [], card: { mask: 'm4' } }, day(1)).wearing.id === 'm0', 'masks: a locked pick falls back to Rookie');
  ok(card.maskState({ log: run(1, 3), card: { mask: 'm1' } }, day(3, 18)).wearing.id === 'm1', 'masks: wears the one he picked');
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
  ok(lines.some((l) => l.text === 'Power 50 → 52' || /^Power \d+ → \d+$/.test(l.text)) && lines.some((l) => l.text === 'New mask: Bolt!') && lines.some((l) => l.text === 'You earned a save.'), `done: rating, mask and save words (got ${lines.map((l) => l.text)})`);
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
    ok(tierLine?.text === 'Your card is now Silver.', `done: a tier change says "Silver card." (got ${tierLine?.text})`);
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

// ===== Masks earned many ways, Glove or Blocker, Compete after a break (12 November 2026) =====
{
  const card = await import('./js/plan/card.js');
  const { MASKS } = await import('./data/masks.js');
  const { streakStats } = await import('./js/plan/streak.js');
  const hands = await import('./js/screens/hands.js');
  const home = await import('./js/screens/home.js');
  const { shelfHtml } = await import('./js/screens/card.js');
  const { payoff, payoffLines } = await import('./js/screens/done.js');
  const { load, blank } = await import('./js/store.js');

  const day = (n, h = 16) => new Date(2026, 10, n, h);
  const s = (n, type = 'strength', more = {}) => ({ date: day(n, more.h ?? 16).toISOString(), type, completed: true, extra: false, dad: false, done: [], skipped: [], ...more });
  const run = (from, to, type = 'strength') => Array.from({ length: to - from + 1 }, (_, k) => s(from + k, type));
  // n sessions of one kind, a few a day so no streak mask gets in the way.
  const many = (n, type = 'stretch') => Array.from({ length: n }, (_, k) => s(1 + (k % 2), type, { h: 8 + Math.floor(k / 2) % 12 }));
  const mk = (more = {}) => ({ log: [], lights: [], hands: [], splits: { rung: 1 }, streak: { gifts: [] }, card: { earned: ['m0'] }, ...more });
  const isOn = (sv, id, now = day(28, 23)) => card.masksFor(sv, now).find((m) => m.id === id).unlocked;
  const rounds = (...ms) => ms.map((x, k) => ({ date: day(1 + k).toISOString(), ms: Math.abs(x), counted: x > 0, taps: [] }));

  // Every rule: locked one short of it, unlocked at it.
  for (const m of MASKS.filter((x) => x.by === 'streak' && x.n > 0)) {
    ok(!isOn(mk({ log: run(1, m.n - 1) }), m.id, day(m.n - 1, 18)) && isOn(mk({ log: run(1, m.n) }), m.id, day(m.n, 18)), `masks: ${m.name} at a ${m.n}-day streak`);
  }
  for (const m of MASKS.filter((x) => x.by === 'sessions')) {
    ok(!isOn(mk({ log: many(m.n - 1) }), m.id) && isOn(mk({ log: many(m.n) }), m.id), `masks: ${m.name} at ${m.n} counted sessions`);
  }
  for (const m of MASKS.filter((x) => x.by === 'type')) {
    ok(!isOn(mk({ log: many(m.n - 1, m.type) }), m.id) && isOn(mk({ log: many(m.n, m.type) }), m.id), `masks: ${m.name} at ${m.n} ${m.type} sessions`);
    ok(!isOn(mk({ log: [...many(m.n - 1, m.type), s(3, m.type, { extra: true }), s(3, m.type, { test: true })] }), m.id), `masks: extras and test runs never count toward ${m.name}`);
  }
  ok(!isOn(mk({ log: many(30, 'strength').slice(0, 11) }), 'm8') && isOn(mk({ log: many(12, 'strength') }), 'm8') && !isOn(mk({ log: many(30, 'stretch') }), 'm8'), 'masks: Bull counts Strength only');
  ok(!isOn(mk({ splits: { rung: 4 } }), 'm10') && isOn(mk({ splits: { rung: 5 } }), 'm10') && isOn(mk({ splits: { rung: 3 }, card: { earned: ['m0'], rungPeak: 5 } }), 'm10'), 'masks: Spider at splits rung 5, his peak rung');
  ok(!isOn(mk({ lights: rounds(400, 361) }), 'm11') && isOn(mk({ lights: rounds(400, 360) }), 'm11'), 'masks: Laser at Lights 10% faster than his first score');
  ok(!isOn(mk({ lights: rounds(-500, 400, -300, 365) }), 'm11'), 'masks: Laser ignores practice rounds, first and best');
  ok(!isOn(mk({ lights: rounds(400) }), 'm11') && !isOn(mk(), 'm11'), 'masks: Laser needs a first score and a faster one');
  ok(!isOn(mk({ hands: rounds(500, 451) }), 'm12') && isOn(mk({ hands: rounds(500, 450) }), 'm12') && !isOn(mk({ lights: rounds(500, 300) }), 'm12'), 'masks: Hawk at Glove or Blocker 10% faster, Lights does not count');

  // Phoenix: a 3-day streak after losing 7 or more. Losing 6 isn't enough.
  const lost7 = [...run(1, 7), ...run(11, 13)]; // 7, then days 8 and 9 use his 2 saves, day 10 breaks it
  ok(streakStats(lost7.slice(0, 7), { gifts: [] }, day(11, 7)).days === 0, 'Phoenix: the 7-day streak is lost on day 10');
  ok(!isOn(mk({ log: lost7.slice(0, 9) }), 'm15', day(12, 18)) && isOn(mk({ log: lost7 }), 'm15', day(13, 18)), 'masks: Phoenix on the third day after losing 7');
  const lost6 = [...run(1, 6), ...run(9, 11)]; // 6, day 7 uses his save, day 8 breaks it
  ok(streakStats(lost6.slice(0, 6), { gifts: [] }, day(9, 7)).days === 0 && !isOn(mk({ log: lost6 }), 'm15', day(11, 18)), 'masks: no Phoenix after losing 6');
  ok(!isOn(mk({ log: run(1, 10) }), 'm15', day(10, 18)), 'masks: no Phoenix without a loss');

  // Secret masks show nothing until earned.
  const fresh = card.masksFor(mk(), day(1));
  for (const id of ['m14', 'm15']) {
    const m = fresh.find((x) => x.id === id);
    ok(m.secret && m.name === 'Secret' && m.need === '???' && !m.progress && m.have === undefined, `masks: ${id} is "Secret" and "???" while locked`);
  }
  const shelf0 = shelfHtml(card.maskState(mk(), day(1)));
  ok(!/Ace|Phoenix|Game Day/.test(shelf0) && (shelf0.match(/locked secret/g) || []).length === 2, 'masks: the shelf never names a secret mask before he earns it');
  const aceSave = mk({ log: many(5, 'gameday') });
  ok(card.masksFor(aceSave, day(3)).find((m) => m.id === 'm14').name === 'Ace' && shelfHtml(card.maskState(aceSave, day(3))).includes('Ace'), 'masks: Ace shows its name once earned');
  ok(card.masksFor(mk({ log: many(12) }), day(3)).find((m) => m.id === 'm7').progress === '12 / 20', 'masks: Viper shows "12 / 20"');
  ok(card.masksFor(mk({ lights: rounds(400, 380) }), day(3)).find((m) => m.id === 'm11').progress === '360 ms or faster', 'masks: Laser shows the time to beat');
  ok(card.masksFor(mk(), day(3)).find((m) => m.id === 'm11').need === 'Lights 10% faster' && card.masksFor(mk(), day(3)).find((m) => m.id === 'm12').need === 'Glove or Blocker 10% faster', 'masks: the two game masks say what they need');
  const st0 = card.maskState(mk({ log: run(1, 3), card: { earned: ['m0', 'm1'], mask: 'm1' } }), day(3, 18));
  ok(st0.count === 2 && st0.wearing.id === 'm1' && shelfHtml(st0).indexOf('Ice') < shelfHtml(st0).indexOf('Bolt'), 'masks: count, wearing, unlocked first');

  // claimMasks: each mask once, and never lost.
  const cs = mk({ log: run(1, 3) });
  const c1 = card.claimMasks(cs, day(3, 18));
  ok(c1.map((m) => m.name).join() === 'Ice' && cs.card.earned.includes('m1'), `claimMasks: claims Ice (got ${c1.map((m) => m.name)})`);
  ok(card.claimMasks(cs, day(3, 19)).length === 0, 'claimMasks: never twice');
  cs.splits.rung = 5;
  ok(card.claimMasks(cs, day(4, 8)).map((m) => m.name).join() === 'Spider', 'claimMasks: Dad moving the rung claims Spider');
  cs.splits.rung = 2;
  ok(isOn(cs, 'm10', day(4, 9)), 'claimMasks: an earned mask stays when its rule no longer holds');
  const unseeded = { log: run(1, 7), lights: [], splits: { rung: 1 }, streak: { gifts: [] }, card: {} };
  ok(card.claimMasks(unseeded, day(7, 18)).length === 0 && unseeded.card.earned.join() === 'm0,m1,m2', 'claimMasks: a save with no list yet is seeded silently');
  ok(blank().card.earned.join() === 'm0' && Array.isArray(blank().hands), 'save: a new save holds Rookie and an empty Glove or Blocker list');
  ok(card.claimMasks(blank(), new Date()).length === 0, 'claimMasks: a new save gets no "New mask" for Rookie');

  // Migration: an older save gets every mask it has now, with no "New mask" line for any.
  localStorage.setItem('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [...run(1, 7), ...many(14)], splits: { rung: 5 }, card: { mask: 'm2' } }));
  const mig = load();
  ok(['m0', 'm1', 'm2', 'm7', 'm10'].every((id) => mig.card.earned.includes(id)) && mig.card.mask === 'm2' && Array.isArray(mig.hands), `migration: earned seeded (got ${mig.card.earned})`);
  ok(card.claimMasks(mig, new Date()).length === 0, 'migration: nothing new to show after seeding');
  ok(Array.isArray(JSON.parse(localStorage.getItem('crease.save')).card.earned), 'migration: the seeded list is saved');

  // Done: every kind of unlock shows, from the claimed list.
  const dl = [...many(19, 'stretch'), s(5, 'power', { h: 18 })];
  const dsv = mk({ log: dl });
  const dp = payoff(dsv, dl.at(-1), day(5, 19));
  ok(dp.masks.map((m) => m.name).join() === 'Viper' && dp.say.includes('New mask.'), `done: the 20th session shows Viper (got ${dp.masks.map((m) => m.name)})`);
  const claimed = card.claimMasks(dsv, day(5, 19));
  const dp2 = payoff(dsv, dl.at(-1), day(5, 19), { claimed });
  ok(payoffLines(dp2).filter((l) => l.kind === 'mask').map((l) => l.text).join() === 'New mask: Viper!', 'done: the claimed list makes the lines');
  ok(payoff(dsv, dl.at(-1), day(5, 19), { claimed: [] }).masks.length === 0 && payoff(dsv, dl.at(-1), day(5, 19), { claimed: [] }).say.length === 0, 'done: nothing claimed, no mask line and no voice');

  // Compete: the same as before for a kid who never misses, rising for one who breaks streaks.
  const comp = (sv, now) => card.cardStats(sv, now).ratings.find((r) => r.id === 'compete').value;
  for (const n of [5, 14, 28]) ok(comp(mk({ log: run(1, n) }), day(n, 18)) === Math.round(50 + 49 * (1 - Math.exp(-n / card.K.compete))), `Compete: unchanged for ${n} days in a row`);
  // Four days on, three off, for eight weeks: his best stays 4 (one save covers one day of three).
  const choppy = [];
  for (let w = 0; w < 8; w++) choppy.push(...run(1 + w * 7, 4 + w * 7));
  ok(streakStats(choppy, { gifts: [] }, day(53, 18)).best === 4, 'Compete: the choppy kid\'s best streak stays 4');
  const cw2 = comp(mk({ log: choppy.slice(0, 8) }), day(11, 18));
  const cw8 = comp(mk({ log: choppy }), day(53, 18));
  ok(cw8 > cw2 && cw8 > Math.round(50 + 49 * (1 - Math.exp(-4 / card.K.compete))), `Compete: keeps rising after broken streaks (week 2 ${cw2}, week 8 ${cw8})`);
  let cPrev = 0, cDrop = false;
  for (let i = 1; i <= choppy.length; i++) { const v = comp(mk({ log: choppy.slice(0, i) }), new Date(choppy[i - 1].date)); if (v < cPrev) cDrop = true; cPrev = v; }
  ok(!cDrop, 'Compete: never drops as sessions are added');

  // Reflex: the blend never drops when a round of either game is added, faster, slower or practice.
  {
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const sv = mk();
    let prev = 50, drop = false;
    for (let i = 0; i < 200; i++) {
      const game = rnd() < 0.5 ? 'lights' : 'hands';
      sv[game].push({ date: day(1 + (i % 28)).toISOString(), ms: Math.round((game === 'lights' ? 180 : 280) + rnd() * 400), counted: rnd() < 0.7, taps: [] });
      const v = card.cardStats(sv, day(28)).ratings.find((r) => r.id === 'reflex').value;
      if (v < prev) drop = true;
      prev = v;
    }
    ok(!drop && prev > 50, `Reflex: never drops as rounds are added (ended at ${prev})`);
  }

  // Glove or Blocker: the round.
  let hs = 3;
  const hr = () => ((hs = (hs * 16807) % 2147483647) / 2147483647);
  const r0 = hands.newRound(hr);
  ok(r0.queue.length === 12 && r0.queue.filter((x) => x === 'L').length === 6, 'Glove or Blocker: 12 lights, 6 a side');
  const other = (r) => (r.queue[0] === 'L' ? 'R' : 'L');
  ok(hands.judge(r0, { lit: false, side: 'L' }) === 'early' && r0.queue.length === 12 && r0.wrong === 0, 'Glove or Blocker: a tap before the light is "Early." and changes nothing');
  ok(hands.judge(r0, { lit: true, side: r0.queue[0], ms: 80 }) === 'early' && r0.taps.length === 0, 'Glove or Blocker: under 100 ms is "Early."');
  ok(hands.judge(r0, { lit: true, side: other(r0), ms: 300 }) === 'wrong' && r0.wrong === 1 && r0.queue.length === 12 && r0.queue.filter((x) => x === 'L').length === 6, 'Glove or Blocker: a wrong side keeps that light in the round');
  ok(hands.judge(r0, { lit: true, side: r0.queue[0], ms: 310 }) === 'hit' && r0.taps.length === 1 && r0.queue.length === 11, 'Glove or Blocker: a right side counts');
  ok(hands.judge(r0, { lit: true, side: other(r0), ms: 300 }) === 'wrong' && hands.judge(r0, { lit: true, side: other(r0), ms: 300 }) === 'over', 'Glove or Blocker: the third wrong side ends the round');
  const hsv = mk();
  ok(hands.finish(hsv, r0, day(3)) === null && hsv.hands.length === 0 && hands.handsStats(hsv.hands, day(3)).left === 3, 'Glove or Blocker: a 3-wrong round saves nothing and uses no counted round');
  const play = (base) => { const r = hands.newRound(hr); let out; for (let k = 0; k < 12; k++) out = hands.judge(r, { lit: true, side: r.queue[0], ms: base + k * 10 }); return { r, out }; };
  const p1 = play(400);
  ok(p1.out === 'done', 'Glove or Blocker: the 12th hit ends the round');
  const f1 = hands.finish(hsv, p1.r, day(3, 9));
  ok(f1.counted && f1.first && f1.ms === 455 && hsv.hands[0].taps.length === 12, `Glove or Blocker: the score is the median of 12 (got ${f1.ms})`);
  const f2 = hands.finish(hsv, play(350).r, day(3, 10));
  ok(f2.counted && f2.best && f2.was === 455, 'Glove or Blocker: a faster round is a new best');
  hands.finish(hsv, play(380).r, day(3, 11));
  const f4 = hands.finish(hsv, play(200).r, day(3, 12));
  ok(!f4.counted && !f4.best && hands.handsStats(hsv.hands, day(3, 13)).best === 405, 'Glove or Blocker: 3 counted rounds a day, the 4th is practice');
  ok(hands.handsStats(hsv.hands, day(4, 9)).left === 3, 'Glove or Blocker: 3 more count tomorrow');

  // Today: the two game tiles and their dots.
  const tile = home.handsLineHtml(hsv.hands, day(3, 13));
  ok(tile.includes('Glove or Blocker') && tile.includes('<b>405 ms</b>') && tile.includes('aria-label="3 of 3 rounds played today"') && (tile.match(/class="on"/g) || []).length === 3, 'Today: Glove or Blocker tile, best and 3 dots');
  ok(home.lightsLineHtml([], day(3)).includes('No score yet') && home.lightsLineHtml([], day(3)).includes('0 of 3 rounds played today'), 'Today: Lights tile with no score yet');
  // The games are locked behind today's session: one free round of each a day until he trains.
  {
    const L = await import('./js/screens/lights.js');
    const at = (h) => new Date(2026, 10, 18, h, 0);
    const sv = { log: [], lights: [], hands: [] };
    ok(!L.gameLocked(sv, 'lights', at(9)) && !L.gameLocked(sv, 'hands', at(9)), 'games lock: both open before the free round');
    L.useFree(sv, 'lights', at(9));
    ok(L.gameLocked(sv, 'lights', at(10)) && !L.gameLocked(sv, 'hands', at(10)), 'games lock: Lights locks once its free round has started, Glove or Blocker is still open');
    ok(sv.lights.length === 0, 'games lock: the free round is used when it starts, not when it is saved');
    L.useFree(sv, 'hands', at(10));
    ok(L.gameLocked(sv, 'hands', at(10)), 'games lock: Glove or Blocker locks after its own free round');
    ok(!L.gameLocked(sv, 'lights', new Date(2026, 10, 19, 8, 0)), 'games lock: a new day brings a new free round');
    const extra = { ...sv, log: [{ date: at(11).toISOString(), type: 'stretch', completed: true, extra: true }] };
    ok(L.gameLocked(extra, 'lights', at(12)), 'games lock: an extra Stretch does not open the games');
    const early = { ...sv, log: [{ date: at(11).toISOString(), type: 'strength', completed: false }] };
    ok(L.gameLocked(early, 'lights', at(12)), 'games lock: a session that did not count does not open the games');
    const done = { ...sv, log: [{ date: at(11).toISOString(), type: 'strength', completed: true }] };
    ok(!L.gameLocked(done, 'lights', at(12)) && !L.gameLocked(done, 'hands', at(12)), 'games lock: today\'s session opens both games');
    const before = JSON.stringify(done.freePlay);
    L.useFree(done, 'lights', at(13)); L.useFree(done, 'lights', at(13));
    ok(JSON.stringify(done.freePlay) === before && !L.gameLocked(done, 'lights', at(13)), 'games lock: after training he can play as much as he likes');
    ok(!L.gameLocked({ log: [] }, 'lights', at(9)), 'games lock: an older save with no freePlay loads open');
    const t = home.lightsLineHtml([], at(9), true);
    ok(t.includes('Train to play more') && !t.includes('mt-dots') && !home.lightsLineHtml([], at(9), false).includes('Train to play more'), 'games lock: the Today tile says "Train to play more" when locked');
    ok(/Finish today's session/.test(L.LOCK_WORDS.locked) && /one round before you train/.test(L.LOCK_WORDS.free), 'games lock: the words say how to open them');
  }
  ok(home.maskNewsHtml([{ id: 'm10', name: 'Spider' }]).includes('New mask: Spider!') && home.maskNewsHtml([]) === '', 'Today: "New mask: Spider!" banner');
  ok(fs.readFileSync('js/screens/settings.js', 'utf8').includes('You earn masks from streaks, sessions, Boss days, the two games and the splits. Two are secret.'), 'Settings: the Masks row');
  ok(fs.readFileSync('js/app.js', 'utf8').includes('hands: hands.render'), 'app: the hands route');
}

// The milestone lines are recorded.
{
  const { SAY } = await import('./data/copy.js');
  const clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8'));
  for (const p of [...Object.values(SAY.milestone), SAY.newMask]) ok(clips[p] && fs.existsSync(`audio/${clips[p]}`), `voice: no clip for "${p}"`);
}

// ===== Finisher, records, sessions that change, Boss day, Dad's challenge (12 November 2026) =====
{
  const { finisherFor, finisherOf, rotationOf, ROTATIONS, JUMP_CAP: CAP } = await import('./js/plan/build.js');
  const { FINISHER, BOSS } = await import('./data/sessions.js');
  const { SAY } = await import('./data/copy.js');
  const R = await import('./js/plan/records.js');
  const { decide, settle: settleDay, reasonText, bossStats, dayKey: dayKeyOf } = await import('./js/plan/decide.js');
  const { settle: settleRun } = await import('./js/screens/player.js');
  const { payoff, payoffLines, recordAsk } = await import('./js/screens/done.js');
  const card = await import('./js/plan/card.js');
  const { MASKS } = await import('./data/masks.js');
  const { challengeHtml } = await import('./js/screens/home.js');
  const { recordsHtml } = await import('./js/screens/card.js');
  const { load } = await import('./js/store.js');
  const ctxOf = (o = {}) => makeContext({ room: 'big', hour: 15, ...o });
  const fin = (s) => finisherOf(s)?.item;
  const said = (st) => st.cues.filter((c) => c.say).flatMap((c) => c.say);

  ok(CAP === 50 && FINISHER.window === 40 && FINISHER.powerVersion === 0, 'finisher: 40 s, cap 50, burpees at version 0');

  // Which finisher, and the rotation by finishers done.
  const sf = (o) => fin(buildSession('strength', ctxOf(o)));
  ok([0, 1, 2, 3].map((k) => sf({ fin: k }).drill.id).join() === 'ST1,ST3,S4,ST1', 'finisher: Strength rotates push-ups, squats, side lunges');
  for (const room of ['bedroom', 'big']) for (const hour of [7, 15]) for (const noJumps of [false, true])
    ok([0, 1, 2].map((k) => sf({ room, hour, noJumps, fin: k }).drill.id).join() === 'ST1,ST3,S4', `finisher: Strength in ${room} at ${hour}h, jumps ${noJumps ? 'off' : 'on'}: the same three`);
  ok(sf({ fin: 2, avoid: ['S4'] }).drill.id === 'ST1' && sf({ fin: 0, avoid: ['ST1'] }).drill.id === 'ST3', 'finisher: a drill left out passes to the next');
  ok(sf({ fin: 0, avoid: ['ST1', 'ST3', 'S4'] }) === undefined, 'finisher: all three left out, no finisher');
  ok(sf({ versions: { ST1: 0 } }).name === 'Push-Ups' && sf({ versions: { ST1: 0 } }).v === 0 && sf({ versions: { ST1: 2 } }).v === 2, 'finisher: Dad\'s version');
  const pf = (o) => fin(buildSession('power', ctxOf(o)));
  // Power: always Step-Back Burpees, whatever the room, the hour or Dad's burpee version.
  for (const room of ['bedroom', 'big']) for (const hour of [7, 15]) for (const v of [undefined, 0, 1, 2]) {
    const f = pf({ room, hour, versions: v === undefined ? {} : { P12: v } });
    ok(f.drill.id === 'P12' && f.v === 0 && f.name === 'Step-Back Burpees' && f.jumps === 0, `finisher: Power in ${room} at ${hour}h, burpees ${v}: Step-Back Burpees`);
  }
  {
    const noFin = (s) => s.items.filter((x) => !x.finisher).reduce((n, x) => n + x.jumps * (x.circuit ? x.sets : x.sets * (x.drill.side && !x.drill.alternate ? 2 : 1)), 0);
    for (const room of ['bedroom', 'big']) { const p = buildSession('power', ctxOf({ room })); ok(p.jumps === noFin(p), `jumps: the finisher adds no landings in the ${room}`); }
  }
  for (const { type, tag, s } of BUILT) if (type === 'power' && fin(s)) ok(fin(s).jumps === 0 && (fin(s).drill.id === 'ST3' || fin(s).v === 0), `${tag}: Power finisher must be Step-Back Burpees or squats`);
  ok(pf({ noJumps: true }).drill.id === 'ST3' && pf({ avoid: ['P12'] }).drill.id === 'ST3', 'finisher: jumps off or burpees left out: squats');
  ok(pf({ avoid: ['P12', 'ST3'] }) === undefined, 'finisher: burpees and squats left out: none');
  // Every build: one finisher on Strength and Power, after the main block and before the splits
  // hold and the cool-down; none on Game Day or Stretch.
  for (const { type, tag, s } of BUILT) {
    const f = s.items.filter((x) => x.finisher);
    if (!FINISHER[type]) { ok(f.length === 0 && !s.items.some((x) => x.block === 'Finisher'), `${tag}: a finisher on ${type}`); continue; }
    if (s.ctx.avoid.length) continue;
    ok(f.length === 1, `${tag}: ${f.length} finishers`);
    const k = s.items.indexOf(f[0]);
    const mainLast = s.items.map((x) => x.main).lastIndexOf(true);
    ok(k > mainLast && s.items.slice(k + 1).every((x) => ['Cool-down', 'Splits'].includes(x.block)), `${tag}: finisher out of place`);
    const steps = s.steps.filter((st) => st.r === s.steps.find((x) => x.finisher)?.r);
    ok(steps.length === 2 && steps[1].kind === 'work' && steps[1].dur === 40 && steps[1].finisher, `${tag}: finisher should be one 40 s set`);
    const words = said(steps[0]);
    ok(words[0] === SAY.finisher && words[1] === `${f[0].name}.` && words[2] === SAY.asMany && words[3] === '40 seconds.', `${tag}: finisher intro says ${words.join(' ')}`);
    ok(!words.some((w) => /\d+ (reps|each)|best/i.test(w)), `${tag}: the finisher intro speaks a number of reps`);
  }
  ok(!buildSession('gameday', ctxOf()).items.some((x) => x.finisher) && !buildSession('stretch', ctxOf()).items.some((x) => x.finisher), 'finisher: never on Game Day or Stretch');
  ok(!buildSession('splits', ctxOf()).items.some((x) => x.finisher), 'finisher: never on the Splits session');
  ok(finisherFor('gameday', ctxOf()) === null && finisherFor('stretch', ctxOf()) === null && finisherFor('splits', ctxOf()) === null, 'finisherFor: null off Strength and Power');
  {
    const extra = buildSession('stretch', ctxOf());
    ok(!extra.items.some((x) => x.finisher), 'finisher: never on the extra Stretch');
  }
  // The splits hold still comes after the finisher, before the cool-down.
  {
    const lad = everyLadder().find((x) => x.type === 'strength');
    const s = buildSession('strength', lad.ctx);
    const blocks = [...new Set(s.items.map((x) => x.block))];
    ok(blocks.slice(-3).join() === 'Finisher,Splits,Cool-down', `finisher: before the splits hold (got ${blocks.join()})`);
  }

  // Sessions that change: four fixed stations, two that rotate; Power's core rotates. Deterministic.
  const circ = (s) => s.items.filter((x) => x.block === 'Circuit').map((x) => x.drill.id).join();
  const core = (s) => s.items.filter((x) => x.block === 'Core').map((x) => x.drill.id).join();
  ok([0, 1, 2, 3, 4].map((k) => circ(buildSession('strength', ctxOf({ rot: k })))).join('|') === 'ST1,ST3,ST4,S4,ST2,W7|ST1,ST3,ST4,S4,S3,C9|ST1,ST3,ST4,S4,ST2,C9|ST1,ST3,ST4,S4,S3,W7|ST1,ST3,ST4,S4,ST2,W7', 'rotation: Strength circuit, four sessions round');
  ok([0, 1, 2, 3].map((k) => core(buildSession('power', ctxOf({ rot: k })))).join('|') === 'ST4,C9|C3,C9|ST4,C3|ST4,C9', 'rotation: Power core, three sessions round');
  ok(buildSession('power', ctxOf({ rot: 1 })).items.filter((x) => x.block === 'Power').map((x) => x.drill.id).join() === buildSession('power', ctxOf()).items.filter((x) => x.block === 'Power').map((x) => x.drill.id).join(), 'rotation: the jump drills never change');
  for (const type of ['strength', 'power']) for (let k = 0; k < 6; k++) {
    const a = buildSession(type, ctxOf({ rot: k, fin: k, boss: k === 3 }));
    const b = buildSession(type, JSON.parse(JSON.stringify(a.ctx))); // a resumed session rebuilds from its saved ctx
    ok(JSON.stringify(a.steps.map((st) => [st.kind, st.dur, st.r?.drill.id, st.cues])) === JSON.stringify(b.steps.map((st) => [st.kind, st.dur, st.r?.drill.id, st.cues])), `rotation: ${type} ${k} rebuilds the same from its saved ctx`);
  }
  for (const [type, b] of [['strength', SESSIONS.strength.blocks.find((x) => x.rotate)], ['power', SESSIONS.power.blocks.find((x) => x.rotate)]])
    for (const pair of b.rotate) for (const id of pair) {
      const d = byId[id];
      ok(d && ['strength'].includes(d.group) && !d.jumps && !d.hops && !d.slam && d.versions.every((v) => !v.jumps), `rotation: ${type} ${id} must be a strength or core drill with no jumps or slams`);
      ok(!b.items.some((it) => it.id === id), `rotation: ${type} ${id} is also a fixed station`);
      ok(!/knee slide|crease/i.test(`${d.name} ${d.why}`) && id !== 'P13', `rotation: ${type} ${id} is a goalie-movement drill`);
    }
  ok(rotationOf({ items: [{ id: 'ST1' }] }, 5).length === 1, 'rotationOf: a block with no rotate is unchanged');
  // everyContext covers every rotation and every finisher, so every phrase gets recorded.
  {
    const seen = { circ: new Set(), core: new Set(), sfin: new Set(), boss: 0 };
    for (const { type, s, ctx } of BUILT) {
      if (ctx.avoid.length) continue;
      if (type === 'strength') { seen.circ.add(circ(s)); seen.sfin.add(fin(s)?.drill.id); if (s.boss) seen.boss++; }
      if (type === 'power') seen.core.add(core(s));
    }
    ok(seen.circ.size === 4 && seen.core.size === 3 && seen.sfin.size === 3 && seen.boss > 0 && ROTATIONS % 12 === 0, `everyContext: covers every rotation (${seen.circ.size} circuits, ${seen.core.size} cores, ${seen.sfin.size} finishers, ${seen.boss} boss)`);
  }

  // Boss day: three rounds, its name, and "Round two." / "Last round.".
  {
    const b = buildSession('strength', ctxOf({ boss: true }));
    const n = buildSession('strength', ctxOf());
    const rounds = b.items.filter((x) => x.circuit).map((x) => x.sets);
    ok(b.name === 'Boss day' && b.boss && rounds.every((r) => r === 3) && n.items.filter((x) => x.circuit).every((x) => x.sets === 2), 'boss: Boss day runs the circuit 3 rounds');
    const words = phrasesOf(b);
    ok(words.includes(SAY.roundTwo) && words.includes(SAY.lastRound), 'boss: says "Round two." and "Last round."');
    ok(!buildSession('power', ctxOf({ boss: true })).boss && buildSession('power', ctxOf({ boss: true })).name === 'Power', 'boss: only on Strength');
  }

  // Boss eligibility.
  const NOW = new Date(2026, 10, 18, 16, 0); // a Wednesday
  const past = (n, type, more = {}) => ({ date: new Date(2026, 10, 18 - n, 15).toISOString(), type, completed: true, extra: false, done: [], skipped: [], ...more });
  const pick = (log, a = {}) => decide({ today: 'none', tomorrow: 'none', ...a }, log, {}, NOW);
  const mkLog = (total, sinceBoss) => {
    // total counted sessions; the boss win (if sinceBoss < total) sits sinceBoss sessions before the end.
    const out = [];
    for (let k = 0; k < total - 2; k++) out.push(past(80 - k * 2, k % 2 ? 'stretch' : 'gameday'));
    out.push(past(5, 'strength'), past(3, 'power'));
    if (sinceBoss !== null) { const i = total - 1 - sinceBoss; out[i] = { ...out[i], type: 'strength', boss: true, bossDay: true }; }
    return out;
  };
  const strengthDay = (log) => pick(log).type === 'strength';
  // Make sure the rules pick Strength for this shape, then check the flag.
  const L = mkLog(12, null);
  ok(strengthDay(L), `boss: the test log gives Strength today (got ${pick(L).type})`);
  ok(pick(mkLog(12, null)).boss === true && pick(mkLog(12, null)).firstBoss === true, 'boss: 12 sessions, none won: Boss day');
  ok(!pick(mkLog(11, null)).boss, 'boss: 11 sessions in all: not yet');
  ok(pick(mkLog(20, 10)).boss === true && pick(mkLog(20, 10)).since === 10 && !pick(mkLog(20, 10)).firstBoss, 'boss: 10 since the last win: Boss day');
  ok(!pick(mkLog(20, 9)).boss, 'boss: 9 since the last win: not yet');
  ok(!pick(mkLog(20, 12), { today: 'practice' }).boss, 'boss: never on a practice day');
  ok(pick(mkLog(20, 12), { tomorrow: 'game' }).type === 'stretch' && !pick(mkLog(20, 12), { tomorrow: 'game' }).boss, 'boss: a game tomorrow is still Stretch');
  ok(pick(mkLog(20, 12), { today: 'practice' }).type === pick(mkLog(20, 12)).type, 'boss: the flag never changes the session type');
  // An ended Boss day that still counts isn't a win, so the next Strength is a Boss day again.
  {
    const lg = mkLog(20, null);
    lg.splice(lg.length - 2, 1, past(5, 'strength', { bossDay: true, boss: false, stopped: { why: 'ended' } }));
    ok(pick(lg).boss === true, 'boss: an ended Boss day is no win, the next one is a Boss day');
    ok(bossStats(lg).beaten === 0, 'boss: ended Boss day not counted as beaten');
  }
  ok(reasonText({ type: 'strength', boss: true, firstBoss: true, since: 12 }, NOW) === 'Today is a Boss day, with three rounds in place of two.', 'boss: before any win the line is just "Three rounds today."');
  ok(reasonText({ type: 'strength', boss: true, firstBoss: false, since: 13 }, NOW) === 'Today is a Boss day, with three rounds in place of two. You\'ve done thirteen sessions since your last one.', 'boss: the real count since the last win');
  ok(reasonText({ type: 'strength', boss: true, firstBoss: false, since: 10 }, NOW) === 'Today is a Boss day, with three rounds in place of two. You\'ve done ten sessions since your last one.', 'boss: reason line');
  // The check-in record keeps the flag, and a redo can't turn a plain Strength into a Boss day.
  {
    const lg = mkLog(12, null);
    const first = settleDay({ today: 'none', tomorrow: 'none' }, lg, {}, NOW);
    ok(first.d.boss && first.day.boss === true && first.reason === 'Today is a Boss day, with three rounds in place of two.', 'boss: the check-in saves boss: true and the plain line');
    const plain = settleDay({ today: 'practice', tomorrow: 'none' }, lg, {}, NOW);
    ok(!plain.day.boss, 'boss: practice today, a plain Strength');
    const redo = settleDay({ today: 'none', tomorrow: 'none' }, lg, { [dayKeyOf(NOW)]: plain.day }, NOW);
    ok(redo.d.type === 'strength' && !redo.d.boss && !redo.day.boss, 'boss: a redo never makes it a Boss day');
    const down = settleDay({ today: 'practice', tomorrow: 'none' }, lg, { [dayKeyOf(NOW)]: first.day }, NOW);
    ok(!down.day.boss, 'boss: a redo can drop the Boss day');
  }
  // The player marks the win: completed and ran to the end.
  {
    const s = buildSession('strength', ctxOf({ boss: true }));
    const all = Array.from({ length: s.drills }, (_, k) => k + 1);
    const won = settleRun(s, { type: 'strength', done: [], skipped: [], stopped: null }, all, [], s.drills);
    ok(won.boss === true && won.bossDay === true && won.completed, 'boss: a finished Boss day is a win');
    const ended = settleRun(s, { type: 'strength', done: [], skipped: [], stopped: { why: 'ended' } }, all.slice(0, 13), [], 13);
    ok(ended.completed && ended.boss === false && ended.bossDay === true, 'boss: an ended Boss day that counts is not a win');
    const plain = settleRun(buildSession('strength', ctxOf()), { type: 'strength', done: [], skipped: [], stopped: null }, all, [], s.drills);
    ok(!('boss' in plain) && !('bossDay' in plain), 'boss: a plain Strength has no boss fields');
    ok(won.finisher.id === 'ST1' && won.finisher.v === 1 && won.finisher.did === true, 'finisher: the log keeps which drill and that he did it');
    const noFin = settleRun(s, { type: 'strength', done: [], skipped: [], stopped: { why: 'ended' } }, all.slice(0, 12), [], 12);
    ok(noFin.finisher.did === false, 'finisher: ended before it: not done');
  }
  // Payoff: "Boss beaten."
  {
    const mk = (log) => ({ log, lights: [], hands: [], splits: { rung: 1 }, streak: { gifts: [] }, card: { earned: ['m0'] } });
    const e = past(0, 'strength', { boss: true, bossDay: true });
    const lines = payoffLines(payoff(mk([past(1, 'stretch'), e]), e, NOW));
    ok(lines.filter((l) => l.kind === 'boss').map((l) => l.text).join() === 'You beat the Boss day.', `done: "Boss beaten." (got ${lines.map((l) => l.text)})`);
    const e2 = past(0, 'strength', { bossDay: true, boss: false });
    ok(!payoffLines(payoff(mk([e2]), e2, NOW)).some((l) => l.kind === 'boss'), 'done: no "Boss beaten." for an ended one');
    // Cyclops at 3 bosses.
    const wins = (n) => Array.from({ length: n }, (_, k) => past(20 - k, 'strength', { boss: true, bossDay: true }));
    const isOn = (log) => card.masksFor(mk(log), NOW).find((m) => m.id === 'm17');
    ok(MASKS.at(-1).id === 'm17' && MASKS.at(-1).name === 'Cyclops', 'masks: Cyclops is m17');
    ok(!isOn(wins(2)).unlocked && isOn(wins(3)).unlocked, 'masks: Cyclops at 3 Boss days');
    ok(isOn(wins(1)).need === '3 Boss days' && isOn(wins(1)).progress === '1 / 3', 'masks: Cyclops shows "3 Boss days" and "1 / 3"');
    ok(!isOn([...wins(2), past(3, 'strength', { boss: true, test: true })]).unlocked, 'masks: a test run never beats a boss');
  }

  // Records: save, best, per version, the Done words.
  {
    const sv = { log: [], records: [], challenge: null, versions: {} };
    const t = (d) => new Date(2026, 10, d, 17);
    const a = R.addRecord(sv, { id: 'ST1', v: 1, n: 14 }, t(1));
    ok(a.prev === null && a.best && a.words === 'Your first record is 14.', 'records: first');
    const b = R.addRecord(sv, { id: 'ST1', v: 1, n: 16 }, t(2));
    ok(b.prev === 14 && b.best && b.words === 'New best: 16. Your old best was 14.', 'records: new best');
    const c = R.addRecord(sv, { id: 'ST1', v: 1, n: 12 }, t(3));
    ok(c.prev === 16 && !c.best && c.words === 'You did 12 today. Your best is 16.', 'records: not a best');
    const d = R.addRecord(sv, { id: 'ST1', v: 2, n: 6 }, t(4));
    ok(d.prev === null && d.words === 'Your first record is 6.' && R.bestFor(sv.records, 'ST1', 1).n === 16 && R.bestFor(sv.records, 'ST1', 2).n === 6, 'records: a harder version starts its own record');
    ok(R.addRecord(sv, { id: 'ST3', v: 1, n: 250 }, t(5)).n === 99 && R.addRecord(sv, { id: 'ST3', v: 1, n: -4 }, t(5)).n === 0, 'records: 0 to 99');
    ok(sv.records.every((r) => r.date && r.id && Number.isInteger(r.v) && Number.isInteger(r.n)), 'records: { date, id, v, n }');
    ok(R.bestFor(sv.records, 'ST1', 1).date === t(2).toISOString(), 'records: best keeps its date');
    ok(R.recordTitle('ST1', 1) === 'Push-Ups in 40 s' && R.recordTitle('P12', 0) === 'Step-Back Burpees in 40 s', 'records: titles');
    const rows = R.recordRows(sv);
    ok(rows.filter((r) => r.id === 'ST1').map((r) => `${r.tag}:${r.best.n}`).join() === ':16,Harder:6' && rows.find((r) => r.id === 'S4').best === null, 'records: Card rows, one per version, "No record yet" otherwise');
    const html = recordsHtml(rows, 3);
    ok(html.includes('No record yet') && html.includes('Bosses beaten: <b>3</b>') && html.includes('Nov 2'), 'records: Card section with best, date and bosses');
    // Records never move a rating.
    const base0 = { log: [past(2, 'strength'), past(1, 'power')], lights: [], hands: [], splits: { rung: 1 }, streak: { gifts: [] }, card: {} };
    const before = JSON.stringify(card.cardStats(base0, NOW));
    const after = JSON.stringify(card.cardStats({ ...base0, records: sv.records, challenge: { id: 'ST1', v: 1, n: 5, beaten: 'x' } }, NOW));
    ok(before === after, 'records: never change the card');
    ok(!/records|challenge/.test(fs.readFileSync('js/plan/card.js', 'utf8')), 'records: card.js never reads them');
    // The finisher count for the rotation.
    const lg = [past(3, 'strength', { finisher: { id: 'ST1', v: 1, did: true } }), past(2, 'strength', { finisher: { id: 'ST3', v: 1, did: false } }), past(1, 'power', { finisher: { id: 'P12', v: 0, did: true } })];
    ok(R.finishersDone(lg, 'strength') === 1 && R.finishersDone(lg, 'power') === 1 && R.finishersDone([...lg, { ...lg[0], test: true }], 'strength') === 1, 'records: finishers done, by type');
  }
  // Done asks only when he did the finisher, once.
  {
    const e = past(0, 'strength', { finisher: { id: 'ST1', v: 1, did: true } });
    const sv = { log: [e], records: [{ date: 'x', id: 'ST1', v: 1, n: 14 }] };
    const ask = recordAsk(sv, e);
    ok(ask && ask.title === 'Push-Ups in 40 s' && ask.best === 14 && ask.start === 14, 'done: asks with his best');
    ok(recordAsk({ log: [e], records: [] }, e).start === R.RECORD_START && recordAsk({ log: [e], records: [] }, e).best === null, 'done: no best yet starts at 10');
    ok(recordAsk(sv, { ...e, finisher: { ...e.finisher, did: false } }) === null, 'done: no card when he didn\'t do it');
    ok(recordAsk(sv, e, { test: true }) === null && recordAsk({ log: [], records: [] }, e) === null, 'done: no card on a test run');
    ok(recordAsk(sv, { ...e, finisher: { ...e.finisher, n: 12 } }) === null, 'done: never asks twice');
  }
  // Dad's challenge: per drill, compared at the version he does now.
  {
    const sv = { log: [], records: [], challenge: null, versions: { ST1: 0 } };
    const ch = R.setChallenge(sv, 'ST1', 20, new Date(2026, 10, 12));
    ok(ch.id === 'ST1' && !('v' in ch) && ch.n === 20 && ch.beaten === null && ch.set && Object.keys(ch).sort().join() === 'beaten,id,n,set', 'challenge: stored as { id, n, set, beaten }');
    ok(R.challengeTile(sv).text === 'Dad\'s challenge: 20 push-ups in 40 s' && R.challengeTile(sv).best === 'No record yet', 'challenge: Today tile');
    R.addRecord(sv, { id: 'ST1', v: 1, n: 30 });
    ok(!sv.challenge.beaten, 'challenge: a version he isn\'t doing now never reaches it');
    const r1 = R.addRecord(sv, { id: 'ST1', v: 0, n: 18 });
    ok(!r1.challengeBeaten && R.challengeTile(sv).best === 'Your best: 18', 'challenge: 18 of 20 isn\'t reached');
    sv.versions.ST1 = 1; // Dad moves him to Standard: the tile follows, his Standard best is 30
    ok(R.challengeTile(sv).best === 'Your best: 30', 'challenge: the tile follows the version he does now');
    sv.versions.ST1 = 0;
    const r2 = R.addRecord(sv, { id: 'ST1', v: 0, n: 20 });
    ok(r2.challengeBeaten && sv.challenge.beaten && R.challengeTile(sv).text === 'You beat Dad\'s challenge: 20 push-ups', 'challenge: reaching 20 beats it');
    ok(!R.addRecord(sv, { id: 'ST1', v: 0, n: 25 }).challengeBeaten, 'challenge: beaten once');
    ok(challengeHtml(R.challengeTile(sv)).includes('beaten') && challengeHtml(null) === '', 'challenge: Today html');
    R.clearChallenge(sv);
    ok(sv.challenge === null && R.challengeTile(sv) === null, 'challenge: cleared');
    // An old stored v is ignored.
    sv.challenge = { id: 'ST1', v: 2, n: 10, set: 'x', beaten: null };
    ok(R.addRecord(sv, { id: 'ST1', v: 0, n: 10 }).challengeBeaten, 'challenge: an old stored v is ignored');
    // Burpees: always the finisher's Step-Back Burpees, whatever Dad's burpee version.
    const bv = { log: [], records: [], challenge: null, versions: { P12: 2 } };
    R.setChallenge(bv, 'P12', 12);
    ok(R.challengeTile(bv).text === 'Dad\'s challenge: 12 step-back burpees in 40 s', 'challenge: burpees mean Step-Back Burpees');
    ok(!R.addRecord(bv, { id: 'P12', v: 2, n: 15 }).challengeBeaten && R.addRecord(bv, { id: 'P12', v: 0, n: 12 }).challengeBeaten, 'challenge: burpees compared at version 0');
    ok(R.recordRows({ records: [], versions: { P12: 2 } }).find((r) => r.id === 'P12').v === 0, 'records: the burpee row is Step-Back Burpees');
    ok(R.setChallenge(sv, 'W2', 10) === null, 'challenge: only record drills');
    ok(R.setChallenge(sv, 'ST3', 500).n === 99 && R.setChallenge(sv, 'ST3', 0).n === 5 && R.CHALLENGE_MIN === 5, 'challenge: 5 to 99');
    const dad = await import('./js/screens/dad.js');
    ok(dad.challengeVersion({ versions: { P12: 1 } }, 'P12') === 0 && dad.challengeVersion({ versions: { ST1: 2 } }, 'ST1') === 2, 'challenge: Dad\'s screen uses the finisher\'s version');
    const dt = fs.readFileSync('js/screens/dad.js', 'utf8');
    ok(dt.includes('a number to reach') && !dt.includes('a number to beat'), 'challenge: Dad\'s words say reach');
  }
  // An older save loads with no records and no challenge; a new one starts empty.
  {
    const mem = new Map();
    globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    mem.set('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [past(2, 'strength')], card: { earned: ['m0'] } }));
    const old = load();
    ok(Array.isArray(old.records) && old.records.length === 0 && old.challenge === null && old.log.length === 1, 'save: an older save gets records [] and challenge null');
    mem.set('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [], card: { earned: ['m0'] }, records: [{ date: 'x', id: 'ST1', v: 1, n: 9 }, { bad: 1 }], challenge: { id: 'ST1', v: 1, n: 12, set: 'x', beaten: null } }));
    const kept = load();
    ok(kept.records.length === 1 && kept.challenge.n === 12 && !('v' in kept.challenge), 'save: records and challenge load, junk and the old v dropped');
    for (const bad of [{ id: 'ZZ9', n: 12 }, { id: 'W2', n: 5 }, { id: 'ST1' }, 'x', 7]) {
      mem.set('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [], card: { earned: ['m0'] }, challenge: bad }));
      ok(load().challenge === null, `save: an unknown challenge (${JSON.stringify(bad)}) is dropped`);
    }
    const { challengeTile } = await import('./js/plan/records.js');
    ok(challengeTile({ challenge: { id: 'ZZ9', n: 3 }, records: [] }) === null, 'challenge: an unknown id never reaches Today');
  }
  // Settings rows.
  {
    const t = fs.readFileSync('js/screens/settings.js', 'utf8');
    ok(t.includes('The last hard drill of a session.') && t.includes('A Strength session with three rounds in place of two.') && t.includes('<dt>Records</dt>'), 'Settings: Finisher, Records and Boss day rows');
  }
  ok(BOSS.rounds === 3 && BOSS.every === 10 && BOSS.after === 12, 'boss: 3 rounds, every 10, after 12');
}

// ===== Camera rep counter on the finisher (13 November 2026, prototype) =====
// Off unless Dad turns it on. Counters are fed made-up poses; Done only changes when it counted.
{
  const RP = await import('./js/plan/reps.js');
  const { REP_RULES, counter, repKind, angle, lean } = RP;
  const R = REP_RULES;
  const rad = (d) => (d * Math.PI) / 180;
  // A made-up pose: knee angles [left, right], elbow angle, body lean off upright, visibility.
  // legVis / armVis override the visibility of those joints only.
  function pose({ knee = [175, 175], elbow = 170, lean: tilt = 0, vis = 0.9, legVis = vis, armVis = vis } = {}) {
    const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
    const put = (i, p, v = vis) => { pts[i] = { ...p, visibility: v }; };
    const sides = [{ sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, z: -0.1, k: knee[0] }, { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, z: 0.1, k: knee[1] }];
    for (const s of sides) {
      const hip = { x: 0, y: 0, z: s.z };
      const sh = { x: 0.5 * Math.sin(rad(tilt)), y: -0.5 * Math.cos(rad(tilt)), z: s.z };
      const el = { x: sh.x, y: sh.y + 0.25, z: s.z };
      const wr = { x: el.x + 0.25 * Math.sin(rad(elbow)), y: el.y - 0.25 * Math.cos(rad(elbow)), z: s.z };
      const kn = { x: 0, y: 0.4, z: s.z };
      const an = { x: 0.4 * Math.sin(rad(s.k)), y: 0.4 - 0.4 * Math.cos(rad(s.k)), z: s.z };
      put(s.hip, hip, Math.min(vis, legVis)); put(s.kn, kn, legVis); put(s.an, an, legVis);
      put(s.sh, sh); put(s.el, el, armVis); put(s.wr, wr, armVis);
    }
    return pts;
  }
  // Feeds poses 66 ms apart (about 15 a second); returns the counter's last answer.
  function feed(kind, poses, dt = 66) {
    const c = counter(kind);
    let out = { count: 0, seenAt: null };
    poses.forEach((p, i) => { out = c.push(p, i * dt); });
    return out;
  }
  const times = (n, p) => Array.from({ length: n }, () => p);
  // n reps of: 4 frames at `up`, 4 frames at `down`, then 4 frames back up.
  const reps = (n, up, down) => [...times(4, up), ...Array.from({ length: n }, () => [...times(4, down), ...times(4, up)]).flat()];

  ok(Math.abs(angle({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) - 90) < 1e-9 && Math.abs(lean({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 })) < 1e-9 && Math.abs(lean({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) - 90) < 1e-9, 'reps: angle and lean measure degrees');
  ok(Math.abs(angle(...[23, 25, 27].map((i) => pose({ knee: [90, 90] })[i])) - 90) < 0.01, 'reps: the made-up pose has the knee angle asked for');

  const KINDS = {
    squat: { up: pose({ knee: [170, 170] }), down: pose({ knee: [85, 85] }), half: pose({ knee: [125, 125] }), lowVis: pose({ knee: [85, 85], legVis: 0.2 }), nearDown: (k) => pose({ knee: [k % 2 ? 98 : 103, k % 2 ? 98 : 103] }), nearUp: (k) => pose({ knee: [k % 2 ? 158 : 163, k % 2 ? 158 : 163] }) },
    pushup: { up: pose({ lean: 85, elbow: 170 }), down: pose({ lean: 85, elbow: 80 }), half: pose({ lean: 85, elbow: 125 }), lowVis: pose({ lean: 85, elbow: 80, armVis: 0.2 }), nearDown: (k) => pose({ lean: 85, elbow: k % 2 ? 93 : 98 }), nearUp: (k) => pose({ lean: 85, elbow: k % 2 ? 148 : 153 }) },
    lunge: { up: pose({ knee: [172, 172] }), down: pose({ knee: [90, 170] }), half: pose({ knee: [130, 170] }), lowVis: pose({ knee: [90, 170], legVis: 0.2 }), nearDown: (k) => pose({ knee: [k % 2 ? 103 : 108, 170] }), nearUp: (k) => pose({ knee: [k % 2 ? 158 : 163, 170] }) },
    burpee: { up: pose({ lean: 5 }), down: pose({ lean: 85 }), half: pose({ lean: 45 }), lowVis: pose({ lean: 85, vis: 0.2 }), nearDown: (k) => pose({ lean: k % 2 ? 58 : 63 }), nearUp: (k) => pose({ lean: k % 2 ? 28 : 33 }) },
  };
  for (const [kind, P] of Object.entries(KINDS)) {
    ok(feed(kind, reps(5, P.up, P.down)).count === 5, `reps ${kind}: 5 clean reps count 5`);
    ok(feed(kind, reps(1, P.up, P.down)).count === 1, `reps ${kind}: one rep counts 1`);
    ok(feed(kind, reps(5, P.up, P.half)).count === 0, `reps ${kind}: half reps count 0`);
    // Going down past the line and coming up through it with a wobble: still one rep.
    const wobble = [...times(4, P.up), ...times(4, P.down), ...Array.from({ length: 8 }, (_, k) => P.nearDown(k)), ...times(4, P.down), ...Array.from({ length: 8 }, (_, k) => P.nearUp(k)), ...times(4, P.up), ...Array.from({ length: 10 }, (_, k) => P.nearUp(k)), ...times(4, P.up)];
    ok(feed(kind, wobble).count === 1, `reps ${kind}: jitter around a line doesn't double-count`);
    // One stray frame at the bottom isn't a rep: each position has to hold 2 frames.
    ok(feed(kind, [...times(4, P.up), P.down, ...times(4, P.up), P.down, ...times(4, P.up)]).count === 0, `reps ${kind}: a one-frame dip isn't a rep`);
    // Down frames the camera can't see well are ignored, so no rep, and the body isn't "seen" then.
    const lv = feed(kind, [...times(4, P.up), ...times(6, P.lowVis), ...times(4, P.up)]);
    ok(lv.count === 0, `reps ${kind}: low-visibility frames are ignored`);
    const unseen = feed(kind, [...times(4, P.up), ...times(20, P.lowVis)]);
    ok(unseen.seenAt === 3 * 66, `reps ${kind}: last seen stops at the last clear frame`);
    ok(feed(kind, [null, null, 'x']).seenAt === null, `reps ${kind}: no person, never seen`);
    // Too fast: 2 frames each way, 20 ms apart, is 80 ms a rep.
    const fast = [...times(2, P.up), ...Array.from({ length: 5 }, () => [...times(2, P.down), ...times(2, P.up)]).flat()];
    ok(feed(kind, fast, 20).count === 0, `reps ${kind}: reps faster than ${R.minRepMs} ms aren't counted`);
    ok(feed(kind, fast, 66).count === 0 && feed(kind, reps(3, P.up, P.down), 66).count === 3, `reps ${kind}: a 264 ms rep isn't counted, a 528 ms one is`);
    // Starting at the bottom waits for the first "up".
    ok(feed(kind, [...times(4, P.down), ...times(4, P.up)]).count === 0, `reps ${kind}: starting down, the first rise isn't a rep`);
  }
  // Push-ups only count with the body roughly flat: arm bends while standing don't.
  ok(feed('pushup', reps(4, pose({ lean: 5, elbow: 170 }), pose({ lean: 5, elbow: 80 }))).count === 0, 'reps pushup: standing arm bends count 0');
  // Lunges: either knee counts, and each lunge is one.
  ok(feed('lunge', [...times(4, pose({ knee: [172, 172] })), ...times(4, pose({ knee: [90, 170] })), ...times(4, pose({ knee: [172, 172] })), ...times(4, pose({ knee: [170, 92] })), ...times(4, pose({ knee: [172, 172] }))]).count === 2, 'reps lunge: left then right is 2');
  // The better-seen side is used: one hidden leg doesn't stop a squat counting.
  const halfHidden = (k) => { const p = pose({ knee: [k, k] }); for (const i of [24, 26, 28]) p[i] = { ...p[i], visibility: 0.1 }; return p; };
  ok(feed('squat', reps(3, halfHidden(170), halfHidden(85))).count === 3, 'reps squat: counts from the side it can see');
  ok(R.hold === 2 && R.minRepMs === 400 && R.lostMs === 3000 && R.everyMs >= 66 && R.slowMs === 250 && R.slowRuns === 5, 'reps: rules match the plan (2 frames, 400 ms, 3 s, 15 a second, 250 ms x5)');
  ok(R.squat.down === 100 && R.squat.up === 160 && R.pushup.down === 95 && R.pushup.up === 150 && R.lunge.down === 105 && R.lunge.up === 160, 'reps: thresholds match the plan');

  // Every finisher drill has a counter.
  const { RECORD_IDS, addRecord } = await import('./js/plan/records.js');
  for (const id of RECORD_IDS) ok(RP.READ[repKind(id)], `reps: finisher ${id} has a counter`);
  ok(repKind('W2') === null, 'reps: a drill that is never a finisher has no counter');

  // Done: the camera's number starts the stepper and the card says so. No count: Done as before.
  const { recordAsk, camWords } = await import('./js/screens/done.js');
  const mk = (finisher) => { const log = { date: new Date().toISOString(), type: 'strength', completed: true, done: [], skipped: [], finisher }; return { save: { log: [log], records: [{ date: 'x', id: 'ST1', v: 1, n: 14 }] }, log }; };
  {
    const { save, log } = mk({ id: 'ST1', v: 1, did: true, cam: 12 });
    const a = recordAsk(save, log);
    ok(a.start === 12 && a.cam === 12 && a.best === 14, 'Done: the stepper starts at the camera\'s count');
    ok(camWords(a) === 'The camera counted 12. Change it if that\'s wrong.', 'Done: "The camera counted 12. Change it if that\'s wrong."');
  }
  for (const cam of [undefined, 0, -3, 2.5, 'x']) {
    const { save, log } = mk({ id: 'ST1', v: 1, did: true, ...(cam === undefined ? {} : { cam }) });
    const a = recordAsk(save, log);
    ok(a.start === 14 && a.cam === null && camWords(a) === '', `Done: with no camera count (${cam}) it is as it was`);
  }
  {
    const { save, log } = mk({ id: 'ST1', v: 1, did: true, cam: 40 });
    ok(recordAsk(save, log, { test: true }) === null, 'Done: a test run still asks nothing');
    const dt = fs.readFileSync('js/screens/done.js', 'utf8');
    ok(dt.includes('...(ask.cam ? { cam: ask.cam } : {})') && dt.includes('n: count'), 'Done: saves his number, with the camera\'s alongside');
  }
  {
    const sv = { records: [], challenge: null };
    addRecord(sv, { id: 'ST1', v: 1, n: 13, cam: 12 });
    addRecord(sv, { id: 'ST1', v: 1, n: 9 });
    addRecord(sv, { id: 'ST1', v: 1, n: 9, cam: 0 });
    ok(sv.records[0].n === 13 && sv.records[0].cam === 12 && !('cam' in sv.records[1]) && !('cam' in sv.records[2]), 'records: n is his number; cam kept only when the camera counted');
    const card = fs.readFileSync('js/plan/card.js', 'utf8');
    ok(!/records|\.cam\b/.test(card), 'records: nothing about records or the camera feeds the card');
  }

  // The save: off by default, old saves load with it off, only true turns it on.
  {
    const { blank, load } = await import('./js/store.js');
    ok(blank().camera && blank().camera.on === false, 'save: camera starts off');
    const mem = new Map();
    globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    for (const [stored, want] of [[undefined, false], [{ on: true }, true], [{ on: 'yes' }, false], ['on', false], [null, false]]) {
      mem.set('crease.save', JSON.stringify({ v: 1, setupDone: true, log: [], card: { earned: ['m0'] }, ...(stored === undefined ? {} : { camera: stored }) }));
      ok(load().camera.on === want, `save: camera ${JSON.stringify(stored)} loads as ${want}`);
    }
  }

  // Not in the install: the precache list never holds the pose files, and an update keeps their cache.
  {
    const sw = fs.readFileSync('sw.js', 'utf8');
    const pre = JSON.parse(sw.match(/^const PRECACHE = (.*);$/m)[1]);
    ok(pre.length > 10 && !pre.some((f) => f.startsWith('vendor/')), 'precache: no vendor/pose files');
    const stamp = fs.readFileSync('tools/stamp.mjs', 'utf8');
    ok(!/'vendor'/.test(stamp.match(/^const roots = .*$/m)[0]), 'precache: stamp.mjs never walks vendor/');
    ok(sw.includes("!k.startsWith('crease-pose-')"), 'sw: an update keeps the pose cache');
    const cam = await import('./js/camera.js');
    ok(cam.POSE_CACHE.startsWith('crease-pose-') && cam.POSE_FILES.length === 4, 'camera: its own cache, four files');
    ok(cam.CAMERA.audio === false && cam.CAMERA.video.facingMode === 'user' && cam.CAMERA.video.width.ideal <= 480, 'camera: front, picture only, small');
    // The files are the ones in vendor/pose/README.md, byte for byte.
    const { createHash } = await import('node:crypto');
    const readme = fs.readFileSync('vendor/pose/README.md', 'utf8');
    for (const f of cam.POSE_FILES) {
      const sha = createHash('sha256').update(fs.readFileSync(`vendor/pose/${f}`)).digest('hex');
      ok(readme.includes(sha), `vendor/pose: ${f} matches its sha256 in README.md`);
    }
    // No telemetry endpoint in the library we ship.
    ok(!fs.readFileSync('vendor/pose/vision_bundle.mjs', 'utf8').includes('odml.pa.googleapis.com'), 'vendor/pose: the library has no usage-logging endpoint');
  }

  // Words he and Dad read: plain, no exclamation marks.
  {
    const dad = await import('./js/screens/dad.js');
    ok(dad.CAM_WORDS.row === 'Count reps with the camera' && dad.CAM_WORDS.what === 'The camera runs during push-ups, squats, burpees and the Finisher, and the coach says each rep it sees. Nothing is recorded or sent anywhere.', 'Dad: the camera row and its line');
    ok(dad.CAM_WORDS.getting === 'Getting it ready…' && dad.CAM_WORDS.ready === 'Ready' && dad.CAM_WORDS.failed === 'Couldn\'t get it. Try again on Wi-Fi.', 'Dad: getting ready, ready, and the failure line');
    const pl = fs.readFileSync('js/screens/player.js', 'utf8');
    ok(pl.includes('Stand where the camera can see all of you.') && pl.includes('The camera can\\\'t see you.') && pl.includes('`Reps: ${camCount}`'), 'player: the camera\'s three lines');
    ok(!Object.values(dad.CAM_WORDS).some((w) => w.includes('!')), 'Dad: no exclamation marks in the camera words');
    // With it off nothing camera-related is on the page, and the camera module is only loaded on demand.
    ok(pl.includes("${camAny ? '<div class=\"pl-cam\"") && !/^import .*camera\.js/m.test(pl) && pl.includes("import('../camera.js')"), 'player: no camera element or module unless it is on');
    ok(!/^import .*camera\.js/m.test(fs.readFileSync('js/screens/dad.js', 'utf8')), 'Dad: the camera module loads only when it is on');
  }
}
