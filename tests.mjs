// Crease checks. Run: node tests.mjs  (deploy.sh refuses to publish if any fail)
import fs from 'node:fs';
import { DRILLS, byId } from './data/exercises.js';
import { SESSIONS, SESSION_ORDER } from './data/sessions.js';
import { DEMOS } from './data/demos.js';
import { buildSession, makeContext, phrasesOf } from './js/plan/build.js';

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
  if (typeof d.quiet === 'string') ok(byId[d.quiet], `${d.id}: quiet swap ${d.quiet} doesn't exist`);
  if (typeof d.quiet === 'number') ok(d.versions[d.quiet], `${d.id}: quiet version ${d.quiet} doesn't exist`);
  if (d.noBand) ok(byId[d.noBand], `${d.id}: noBand swap doesn't exist`);
  if (d.noise !== 'quiet' && d.versions[d.start].noise !== 'quiet') ok(d.quiet !== undefined, `${d.id}: loud drill with no quiet version`);
  if (d.space === 'big') ok(d.quiet !== undefined, `${d.id}: big-space drill with no bedroom version`);
  for (const c of d.cues) ok(c.length <= 70, `${d.id}: cue too long for one breath: "${c}"`);
}
for (const id of Object.keys(DEMOS)) ok(byId[id], `demos.js: ${id} isn't a drill`);

// 2. Sessions point at real drills.
for (const [type, s] of Object.entries(SESSIONS))
  for (const b of s.blocks) for (const it of b.items) ok(byId[it.id], `${type}: ${it.id} doesn't exist`);

// 3. Every way a session can be built is safe and the right length.
const LIMITS = { strength: [17, 24], power: [17, 25], gameday: [5, 11], stretch: [9, 16] };
const JUMP_CAP = 50;
const draws = new Set();
const allPhrases = new Set();
const everyDrillAt = (v) => Object.fromEntries(DRILLS.map((d) => [d.id, Math.min(v, d.versions.length - 1)]));
const VERSION_SETS = [['start', {}], ['easier', everyDrillAt(0)], ['standard', everyDrillAt(1)], ['harder', everyDrillAt(2)]];
for (const type of SESSION_ORDER)
  for (const room of ['bedroom', 'big'])
    for (const hour of [7, 15])
      for (const ball of ['dead', 'bouncy', 'none'])
        for (const band of [true, false])
          for (const [vname, versions] of VERSION_SETS) {
            const feel = 'good';
            const ctx = makeContext({ room, hour, ball, band, feel, versions });
            const s = buildSession(type, ctx);
            const tag = `${type}/${room}/${hour}h/${ball}/${band ? 'band' : 'noband'}/${vname}`;
            const min = s.total / 60;
            const [lo, hi] = LIMITS[type];
            if (vname === 'start') ok(min >= lo && min <= hi, `${tag}: ${min.toFixed(1)} min, expected ${lo}-${hi}`);
            else ok(min <= hi + 2, `${tag}: ${min.toFixed(1)} min, too long with Dad's versions`);
            ok(s.jumps <= JUMP_CAP, `${tag}: ${s.jumps} jumps, cap is ${JUMP_CAP}`);
            for (const it of s.items) {
              draws.add(it.draw);
              const noise = it.variant ? 'quiet' : it.version.noise ?? it.drill.noise;
              if (ctx.quiet) ok(noise === 'quiet', `${tag}: ${it.name} is ${noise} in quiet mode`);
              if (ctx.small) ok((it.version.space ?? it.drill.space) === 'small' || it.variant, `${tag}: ${it.name} needs a big room`);
              if (it.drill.slam) ok(ball === 'dead' && !ctx.quiet && !ctx.small, `${tag}: slams with a ${ball} ball`);
              if (it.drill.needs?.includes('band')) ok(band, `${tag}: band drill with no band`);
              if (ball === 'none' && it.drill.needs?.includes('med ball')) ok(!/ball/i.test(it.version.how || '') || /no ball|pillow/i.test(it.version.how), `${tag}: ${it.name} needs a ball`);
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
  ok(pick({ yesterdayGame: true }) === 'stretch', 'day after a game: Stretch');
  ok(pick({}, [], { [dayKey(new Date(2026, 10, 17))]: { today: 'game', tomorrow: 'none' } }) === 'stretch', 'remembers yesterday\'s game from yesterday\'s check-in');
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

  // 300 days of a random hockey schedule, always doing what the app says.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ice = [];
  for (let d = 0; d < 302; d++) { const r = rand(); ice.push(r < 0.2 ? 'game' : r < 0.45 ? 'practice' : 'none'); }
  const log = [];
  const days = {};
  const types = [];
  for (let d = 1; d < 301; d++) {
    const now = new Date(2026, 0, d, 16);
    const answers = { today: ice[d], when: 'before', tomorrow: ice[d + 1], yesterdayGame: ice[d - 1] === 'game', hurts: false };
    const r = decide(answers, log, days, now);
    days[dayKey(now)] = { today: ice[d], tomorrow: ice[d + 1] };
    types[d] = r.type;
    if (r.type) log.push({ date: now.toISOString(), type: r.type, completed: true, skipped: [], done: [] });
    if (r.type === 'power') {
      ok(ice[d + 1] !== 'game', `sim day ${d}: Power the day before a game`);
      ok(ice[d] === 'none', `sim day ${d}: Power on a hockey day`);
      ok(types[d - 1] !== 'power', `sim day ${d}: Power two days in a row`);
      ok(types.slice(Math.max(1, d - 6), d + 1).filter((t) => t === 'power').length <= 2, `sim day ${d}: more than 2 Power in 7 days`);
    }
    if (r.type === 'strength') ok(ice[d + 1] !== 'game', `sim day ${d}: Strength the day before a game`);
  }
  const mix = types.reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
  ok(mix.power > 30 && mix.strength > 30 && mix.stretch > 30, `sim: sessions too lopsided ${JSON.stringify(mix)}`);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
