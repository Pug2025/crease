// Crease checks. Run: node tests.mjs  (deploy.sh refuses to publish if any fail)
import fs from 'node:fs';
import { DRILLS, byId } from './data/exercises.js';
import { SESSIONS, SESSION_ORDER } from './data/sessions.js';
import { DEMOS } from './data/demos.js';
import { buildSession, makeContext, phrasesOf, resolveItem, everyContext } from './js/plan/build.js';

let failed = 0;
let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('FAIL', msg); } };

// 1. The drill file is complete and consistent.
const ids = new Set();
for (const d of DRILLS) {
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
  ok(decide({ today: 'none', tomorrow: 'none', hurts: true }, [], {}, NOW).type === null, 'something hurts: no session');
  ok(decide({ today: 'none', tomorrow: 'none' }, [ago(0, 'strength')], {}, NOW).why === 'done', 'already trained today');
  ok(pick({}, [1, 2, 3, 4, 5, 6].map((n) => ago(n, n % 2 ? 'gameday' : 'strength'))) === 'stretch', 'six days in a row with no easy day: Stretch');
  ok(pick({}, [ago(1, 'stretch'), ago(2, 'stretch'), ago(3, 'stretch'), ago(4, 'strength'), ago(5, 'power'), ago(6, 'stretch')]) !== 'stretch', 'easy days in the last six: not stuck on Stretch');
  // The 300-day simulation is in the RULES block at the end: his real week, with skipped days.
}

// ===== RULES =====
// The check-in rules, the check-in record (C5), the pain rules (C4, C9), the preview words,
// and 300 days of his real week through the rules.
{
  const D = await import('./js/plan/decide.js');
  const { decide, settle, reasonText, painText, answersText, grabText, counts, jumpedPower, hurtToday, dayKey } = D;
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
  ok(why({}, [], WED) === 'First session. Strength comes first.', 'rules: first session reason');
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
  ok(counts({ completed: true }) && counts({ stopped: { why: 'pain' } }) && !counts({ completed: true, extra: true }) && !counts({ completed: false, stopped: { why: 'ended' } }), 'rules: counts(e) keeps its meaning (C8)');
  // PLAYER: an ended session that reached half counts (completed: true, stopped.why 'ended'); log.done holds drills started.
  const countedEnd = did(WED, 1, 'power', { stopped: { why: 'ended' }, done: [...JUMPED, 'P13', 'P12'] });
  ok(counts(countedEnd) && jumpedPower(countedEnd) && go({}, [did(WED, 3, 'strength'), countedEnd], WED).type !== 'power', 'rules: a counted ended Power is Power for the limits');
  ok(go({}, [did(WED, 3, 'strength'), did(WED, 2, 'strength', { stopped: { why: 'ended' } })], WED).type === 'power', 'rules: a counted ended Strength is Strength for the turn order');

  // Item 2, rules side: the 7-day pain rules (PLAN section 2). Zones come from the log (C9).
  const hurt = (now, n, zone, more = {}) => ({ date: back(now, n), type: null, completed: false, done: [], skipped: [], stopped: { why: 'hurt-before', zone }, ...more });
  const knee = go({}, [...powerDue(WED), hurt(WED, 2, 'below-kneecap')], WED);
  ok(knee.type === 'strength', 'rules: below the kneecap 2 days ago, Power due: Strength');
  ok(knee.noJumps === true && ['ST2', 'S4', 'P13'].every((id) => knee.avoid.includes(id)), 'rules: below the kneecap: no jumping, wall sits or lunges');
  {
    const s = buildSession('strength', makeContext({ room: 'big', hour: 16, avoid: knee.avoid, noJumps: knee.noJumps }));
    ok(s.items.some((it) => it.name === 'Step Jacks') && !s.items.some((it) => it.name === 'Jumping Jacks') && s.jumps === 0, 'rules: knee week keeps the warm-up as Step Jacks, no jumps');
  }
  ok(reasonText(knee, WED) === 'The spot below your kneecap hurt on Monday, so no Power.', 'rules: pain reason line');
  ok(painText(knee, WED) === 'No jumping, wall sits or lunges until Tuesday.', 'rules: pain note on the preview');
  const kneeGame = go({ today: 'game', when: 'before' }, [hurt(WED, 2, 'knee')], WED);
  ok(kneeGame.type === 'gameday' && kneeGame.noJumps && kneeGame.avoid.includes('P13'), 'rules: knee pain: Game Day without jumps or lunges');
  ok(go({}, [...powerDue(WED), hurt(WED, 7, 'heel')], WED).type === 'strength', 'rules: heel 7 days ago: still no Power');
  ok(go({}, [...powerDue(WED), hurt(WED, 8, 'heel')], WED).type === 'power', 'rules: heel 8 days ago: Power is back');
  ok(go({}, [hurt(WED, 3, 'heel')], WED).noJumps && go({}, [hurt(WED, 3, 'ankle')], WED).noJumps, 'rules: heel or ankle: no jumping');
  const lowBack = go({}, [...powerDue(WED), hurt(WED, 1, 'lower-back')], WED);
  ok(lowBack.type === 'power' && !lowBack.noJumps && ['P8', 'P12', 'C9'].every((id) => lowBack.avoid.includes(id)), 'rules: lower back: Power still on, no slams, burpees or climbers');
  ok(painText(lowBack, WED) === 'Your lower back hurt yesterday. No slams, burpees or mountain climbers until November 25.', 'rules: lower back note');
  ok(go({}, [...powerDue(WED), hurt(WED, 1, 'groin')], WED).avoid.length === 0, 'rules: groin has no 7-day rule (Dad sees it on his list)');
  ok(go({}, [...powerDue(WED), did(WED, 2, 'strength', { completed: false, stopped: { why: 'pain', zone: 'heel' } })], WED).noJumps, 'rules: a pain stop is a report');
  ok(go({}, [...powerDue(WED), did(WED, 2, 'strength', { skipped: [{ id: 'ST2', why: 'hurts', zone: 'knee' }] })], WED).noJumps, 'rules: a skip because it hurt is a report');
  ok(go({}, [...powerDue(WED), hurt(WED, 1, 'knee', { extra: true, dad: true })], WED).type === 'power', 'rules: pain in Dad\'s test run is not his');
  // Hurt today locks the check-in until Dad clears it. The 7-day rules stay after he clears it.
  ok(go({}, [...powerDue(WED), hurt(WED, 0, 'groin')], WED).type === null, 'rules: hurt earlier today: no session');
  ok(hurtToday([hurt(WED, 0, 'groin')], WED) && !hurtToday([hurt(WED, 0, 'groin', { cleared: true })], WED), 'rules: Dad\'s clear lifts today\'s lock');
  const cleared = go({}, [...powerDue(WED), hurt(WED, 0, 'knee', { cleared: true })], WED);
  ok(cleared.type === 'strength' && cleared.noJumps, 'rules: cleared knee: he trains, still no Power or jumping');

  // Item 11 and C5: the first check-in of the day sticks; later ones can only make it easier.
  {
    const k = dayKey(WED);
    const log = powerDue(WED);
    const days = {};
    const step = (answers) => { const r = settle({ hurts: false, ...answers }, log, days, WED); days[k] = r.day; return r; };
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
    const a = settle({ today: 'game', when: 'before', hurts: false }, powerDue(WED), days, WED);
    days[k] = a.day;
    ok(a.d.type === 'gameday' && settle({ today: 'none', tomorrow: 'none' }, powerDue(WED), days, WED).d.type === 'gameday', 'C5: game today, then "No hockey": still Game Day');
    const h = settle({ today: 'none', tomorrow: 'game', hurts: true }, [], {}, WED);
    ok(h.d.type === null && h.day.type === null && h.day.tomorrow === 'game', 'item 15: a "hurts" check-in saves his answers first, no session');
    const fresh = settle({ today: 'none', tomorrow: 'none' }, [], { [k]: h.day }, WED);
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
  const pain1 = ended(str, [1], [], { why: 'pain', zone: 'knee' });
  ok(!pain1.completed && pain1.short === null && counts(pain1), 'player: a pain stop at drill 1 of 15 still counts');
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
  const { load, blank } = await import('./js/store.js');
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
  ok(Array.isArray(old.lights) && Array.isArray(old.seenAlerts) && old.versions && old.settings.ball === 'dead', 'save: an older save gets lights, versions and settings');

  // Words (items 3 and 13).
  ok(copy.STOP_RULE.lines.includes('pain (not sore muscles) still there the next day'), 'stop rule: "pain (not sore muscles) still there the next day"');
  ok(!copy.STOP_RULE.lines.some((l) => l.includes('something still hurts')), 'stop rule: the old "still hurts" line is gone');
  ok(copy.SORE_OR_HURT.sore.join(' ') === 'Sore: your muscles ache a day or two after training. That\'s normal. Train.', 'welcome: the Sore line');
  ok(copy.SORE_OR_HURT.hurt.join(' ') === 'Hurt: sharp pain, pain in a joint, below your kneecap or in your heel, or pain that makes you limp. Stop and tell Dad.', 'welcome: the Hurt line');
  ok(copy.ROOM_HINT.bedroom === 'Small room: nothing that needs 3 metres.' && copy.ROOM_HINT.big === 'Full versions. Clear about 3 metres around you.', 'Today: room hints');
  ok(copy.zoneWord('below-kneecap') === 'just below the kneecap' && copy.zoneWord('knee') === 'knee', 'zone words for "Last time it hurt"');

  // A week to work with: Friday 13 November 2026, 4:30 pm.
  const NOW = new Date(2026, 10, 13, 16, 30);
  const at = (m, d, h = 16) => new Date(2026, m, d, h).toISOString();
  const run = (m, d, type, more = {}) => ({ date: at(m, d), type, completed: true, extra: false, dad: false, planned: 15, done: [], skipped: [], stopped: null, secs: 1200, ...more });
  const log = [
    run(9, 26, 'strength'), run(9, 27, 'power'), run(9, 29, 'stretch'), run(9, 31, 'gameday'), // a full week
    run(10, 2, 'strength'), run(10, 3, 'stretch'), run(10, 5, 'power'), run(10, 7, 'strength'), // another
    run(10, 9, 'strength', { secs: 1205, skipped: [{ id: 'S4', why: 'hurts', zone: 'groin' }] }),
    run(10, 10, 'power', { completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }), // didn't count
    run(10, 11, 'gameday', { secs: 300 }),
    run(10, 12, 'stretch', { extra: true }), // extra: never counts
    run(10, 12, 'power', { dad: true, extra: true, stopped: { why: 'pain', zone: 'heel' }, completed: false }), // an old test run
  ];
  const days = { '2026-11-09': { today: 'practice', tomorrow: 'none' }, '2026-11-11': { today: 'game', when: 'before' }, '2026-11-12': { today: 'none', tomorrow: 'game' } };

  // Week strip (item 21).
  const w = home.weekStats(log, days, NOW);
  ok(w.boxes.length === 7 && w.boxes[0].letter === 'M' && w.boxes[0].key === '2026-11-09', 'week strip: Monday to Sunday');
  ok(w.boxes.map((b) => (b.filled ? 1 : 0)).join('') === '1010000', `week strip: boxes only for counted sessions, got ${w.boxes.map((b) => (b.filled ? 1 : 0)).join('')}`);
  ok(w.count === 2, `week strip: "This week: 2", got ${w.count}`);
  ok(w.boxes[0].mark === 'P' && w.boxes[2].mark === 'G' && w.boxes[4].mark === 'G' && w.boxes[1].mark === '', 'week strip: G and P from his check-ins, including "game tomorrow"');
  ok(w.boxes[4].today && w.boxes[5].future && !w.boxes[3].future, 'week strip: knows today and the days ahead');
  ok(!w.full && w.inARow === 2 && w.best === 2, `week strip: this week isn't over, so the run of 2 full weeks stands (got ${w.inARow}/${w.best})`);
  ok(!home.weekStripHtml(w).includes('Full week.') && !/ of 4/.test(home.weekStripHtml(w)), 'week strip: no "Full week." under 4, and never "of 4"');
  const w4 = home.weekStats([...log, run(10, 13, 'strength'), run(10, 12, 'stretch')], days, NOW);
  ok(w4.count === 4 && w4.full && w4.inARow === 3 && w4.best === 3, `week strip: 4 in a week is a full week, 3 in a row (got ${w4.count} ${w4.inARow}/${w4.best})`);
  ok(home.weekStripHtml(w4).includes('Full week.') && home.weekStripHtml(w4).includes('wk-full'), 'week strip: "Full week." at 4');
  const gap = home.weekStats([run(9, 19, 'strength'), run(9, 20, 'strength'), run(9, 21, 'strength'), run(9, 22, 'strength'), ...log.slice(4)], days, NOW);
  ok(gap.inARow === 1 && gap.best === 1, `week strip: a short week breaks the run, best stays (got ${gap.inARow}/${gap.best})`);
  ok(!home.weekStripHtml(w).includes('red'), 'week strip: missed days are never red');

  // Season line (item 21): from 1 September, counted sessions only.
  const season = home.seasonStats([run(7, 30, 'strength'), ...log], NOW);
  ok(season.sessions === 10, `season: 10 counted sessions since 1 September (not August's, not extras or test runs), got ${season.sessions}`);
  ok(season.mins === Math.round((8 * 1200 + 1205 + 300) / 60), `season: minutes of counted sessions add up, got ${season.mins}`);
  ok(home.seasonStats(log, new Date(2027, 7, 31)).sessions === 10 && home.seasonStats(log, new Date(2027, 8, 1)).sessions === 0, 'season: a new season starts on 1 September');

  // Pain records (items 2, 16, 36 and C9).
  const hurtBefore = { date: at(10, 13, 15), type: null, completed: false, done: [], skipped: [], stopped: { why: 'hurt-before', zone: 'knee' } };
  const painStop = run(10, 13, 'power', { stopped: { why: 'pain', zone: 'groin' }, completed: false });
  const painSkip = run(10, 13, 'strength', { skipped: [{ id: 'S4', why: 'hurts', zone: 'hip' }] });
  ok(home.painZones(hurtBefore)[0] === 'knee' && home.painZones(painStop)[0] === 'groin' && home.painZones(painSkip)[0] === 'hip', 'pain: check-in, stop and skip all count as pain');
  ok(!home.isPain(log[12]), 'pain: Dad\'s test runs never count as his pain');
  for (const e of [hurtBefore, painStop, painSkip]) ok(home.hurtToday([e], NOW).length === 1, `lock: ${e.stopped?.why || 'a hurts skip'} today locks Today`);
  ok(home.hurtToday([{ ...painStop, cleared: true }], NOW).length === 0, 'lock: Dad\'s "He\'s OK to train today" unlocks it');
  ok(home.hurtToday([painStop], new Date(2026, 10, 14, 7)).length === 0, 'lock: lasts until tomorrow');
  ok(home.unseenPain(log) === log[8], 'notice: the groin skip waits for Dad');
  ok(home.unseenPain(log.map((e) => (e === log[8] ? { ...e, dadSeen: true } : e))) === null, 'notice: clears only when Dad taps Seen');
  ok(home.unseenPain([run(5, 1, 'power', { stopped: { why: 'pain', zone: 'heel' } })]) !== null, 'notice: no 36-hour cutoff');

  // Done screen words (items 6 and 36, C6).
  const dw = (more) => doneWords({ planned: 15, done: [], skipped: [], stopped: null, completed: true, extra: false, dad: false, ...more });
  ok(dw({}).title === 'Done.' && dw({}).line === '', 'done: a finished session');
  ok(dw({ stopped: { why: 'ended' }, reached: 13, need: 8 }).line === 'Ended at drill 13 of 15.', 'done: a counted ended session says where it ended');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }).title === 'Ended early.', 'done: "Ended early."');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 5, need: 8, short: 'half' }).line === 'Do 8 of 15 drills and it counts.', 'done: "Do 8 of 15 drills and it counts."');
  ok(dw({ completed: false, stopped: { why: 'ended' }, reached: 11, need: 8, short: 'main' }).line === 'Do half the main drills and it counts.', 'done: the main-block rule');
  ok(dw({ dad: true, extra: true }).line === 'Test run. Nothing saved.' && doneWords({ planned: 15, completed: true }, { test: true }).line === 'Test run. Nothing saved.', 'done: "Test run. Nothing saved."');
  ok(dw({ dad: true, extra: true, completed: false, stopped: { why: 'pain', zone: 'knee' } }).line === 'Test run. Nothing saved.', 'done: a test run stopped for pain is still a test run');
  ok(dw({ completed: false, stopped: { why: 'pain', zone: 'knee' } }).title === 'Stopped.', 'done: a pain stop');

  // Dad's last 14 days (item 2) and today's check-in (item 11).
  const dlog = [...log.slice(4), hurtBefore, run(9, 1, 'power', { stopped: { why: 'pain', zone: 'heel' }, completed: false }), run(10, 12, 'strength', { dad: true })];
  const rows = dad.dadDays({ log: dlog, days: { ...days, '2026-11-13': { today: 'none', tomorrow: 'practice', type: null } } }, NOW);
  ok(rows.length === 15 && rows[0].label === 'Today' && rows[1].label === 'Yesterday' && rows[13].key === '2026-10-31', `Dad: 14 days, newest first, then older unseen pain (got ${rows.length})`);
  ok(rows[14].key === '2026-10-01' && rows[14].unseen, 'Dad: an older pain report he hasn\'t seen still shows');
  ok(rows[0].unseen && rows[0].entries[0].ending === 'Hurt before training: knee', 'Dad: "Hurt before training: knee", red until Seen');
  const mon = rows.find((r) => r.key === '2026-11-09');
  ok(mon.answers === 'Practice today · No hockey tomorrow' && mon.entries[0].skips[0].text === 'Skipped Side Lunges: groin' && mon.entries[0].skips[0].pain, 'Dad: answers, and "Skipped Side Lunges: groin" in red');
  ok(rows.find((r) => r.key === '2026-11-10').entries[0].ending === 'Ended at 5 of 15 · didn\'t count', 'Dad: "Ended at 5 of 15 · didn\'t count"');
  ok(rows.find((r) => r.key === '2026-11-12').entries.some((x) => x.ending === 'Done · Picked by Dad'), 'Dad: "Picked by Dad"');
  ok(!rows.some((r) => r.entries.some((x) => x.e.extra && x.e.dad)), 'Dad: his own test runs aren\'t in the list');
  ok(dad.endingText({ stopped: { why: 'pain', zone: 'groin' } }) === 'Stopped: groin', 'Dad: "Stopped: groin"');
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
  ok(!home.isPain({ ...ls.lights[0] }) && !log.some((e) => e.type === 'lights'), 'Lights never become a session');

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

// ===== LEAD =====
// Fixes from the final check: Done after a hurt skip, Dad's version line, Wall Sit Easier's cue.
{
  const { doneWords } = await import('./js/screens/done.js');
  const { versionLine } = await import('./js/screens/dad.js');
  const { DRILLS: ALL } = await import('./data/exercises.js');
  const w = doneWords({ completed: true, planned: 15, skipped: [{ id: 'S4', no: 6, why: 'hurts', zone: 'groin' }], stopped: null });
  ok(w.title === 'Done.' && /tell Dad now/.test(w.line) && /groin/.test(w.line), `done: a hurt skip says to tell Dad (${w.line})`);
  ok(!/tell Dad/.test(doneWords({ completed: true, planned: 15, skipped: [{ id: 'S4', no: 6, why: 'here' }], stopped: null }).line), 'done: a "can\'t do it here" skip says nothing about Dad');
  for (const d of ALL) d.versions.forEach((v, k) => ok(!/sets/.test(versionLine(d, k)), `dad: ${d.id} ${v.name} version line names sets`));
  const easierWall = buildSession('strength', makeContext({ room: 'big', hour: 16, versions: { ST2: 0 } }));
  ok(phrasesOf(easierWall).includes('Hands off your legs.'), 'Wall Sit Easier (20 s) says "Hands off your legs."');
}
