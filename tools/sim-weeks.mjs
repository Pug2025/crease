// His real hockey week, run through the check-in rules (js/plan/decide.js), with the days he skips.
// tests.mjs imports simulate() and summary() and checks the safety rules and the mix of sessions.
//
// Run from the Crease folder:  node tools/sim-weeks.mjs [weeks] [seed] [skips] [show]
//   skips: random (1 to 3 days off a week, any day; the usual)  hockey (1 to 3, his ice days first)
//          few (0 to 2)  many (2 to 4)
//   show:  print every day (default: the first 3 weeks)
//
// The week (PLAN 1.2), Monday to Sunday: practice every Monday and Saturday, goalie clinic every
// second Tuesday, 1 or 2 games a week. A home game sometimes (3 weeks in 10) takes over Saturday
// practice. He trains before 9 am a quarter of the time, otherwise after school or after supper,
// and answers the check-in truthfully unless told otherwise.
import { pathToFileURL } from 'node:url';
import { settle, knownYesterdayGame, dayKey } from '../js/plan/decide.js';

const START = new Date(2026, 8, 7); // Monday 7 September 2026, the start of a season

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const at = (base, n, hour = 0) => { const d = new Date(base); d.setDate(d.getDate() + n); d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0); return d; };

// Ice by date: { kind: 'game' | 'practice' | 'none', hour }. Day 0 of each week is Monday.
export function realWeekIce(weeks, rand, start = START) {
  const ice = {};
  for (let w = 0; w <= weeks + 1; w++) {
    const day = (n) => dayKey(at(start, w * 7 + n));
    for (let n = 0; n < 7; n++) ice[day(n)] = { kind: 'none' };
    ice[day(0)] = { kind: 'practice', hour: 18 }; // Monday practice
    const clinic = w % 2 === 0;
    if (clinic) ice[day(1)] = { kind: 'practice', hour: 17 }; // clinic every second Tuesday
    const homeSat = rand() < 0.3;
    ice[day(5)] = homeSat ? { kind: 'game', hour: 11 } : { kind: 'practice', hour: 9 };
    const games = homeSat ? [5] : [];
    const want = rand() < 0.5 ? 1 : 2;
    // A free Tuesday, Wednesday to Friday evenings, or Sunday afternoon.
    const open = [...(clinic ? [] : [1]), 2, 3, 4, 6];
    while (games.length < want) {
      const n = open[Math.floor(rand() * open.length)];
      if (games.includes(n)) continue;
      games.push(n);
      ice[day(n)] = { kind: 'game', hour: n === 6 ? 13 : 19 };
    }
  }
  return ice;
}

// Any schedule at all, for the safety checks: a game on 1 day in 5, practice on 1 in 4.
export function randomIce(weeks, rand, start = START) {
  const ice = {};
  for (let n = -1; n <= weeks * 7 + 8; n++) {
    const r = rand();
    ice[dayKey(at(start, n))] = r < 0.2 ? { kind: 'game', hour: 19 } : r < 0.45 ? { kind: 'practice', hour: 18 } : { kind: 'none' };
  }
  return ice;
}

// One run. Returns a row per day: what was on the ice, what he answered, what he got and did.
//   schedule: 'real' (his week) or 'random' (any schedule)
//   fridayMistake: chance he answers "Practice" for tomorrow on a Friday when Saturday is a home game.
//   endPower: chance a Power session ends early right after the jumps (not counted, jumps done).
export function simulate({ weeks = 43, seed = 7, skips = 'random', schedule = 'real', fridayMistake = 0, endPower = 0, start = START } = {}) {
  const rand = rng(seed);
  const ice = schedule === 'random' ? randomIce(weeks, rand, start) : realWeekIce(weeks, rand, start);
  const save = { log: [], days: {} };
  const rows = [];
  const busy = (w, d) => ice[dayKey(at(start, w * 7 + d))].kind !== 'none';
  for (let w = 0; w < weeks; w++) {
    const n = (skips === 'many' ? 2 : skips === 'few' ? 0 : 1) + Math.floor(rand() * 3);
    const order = [0, 1, 2, 3, 4, 5, 6].map((d) => [d, rand()]).sort((x, y) => x[1] - y[1]).map(([d]) => d);
    if (skips === 'hockey') order.sort((x, y) => busy(w, y) - busy(w, x));
    const off = new Set(order.slice(0, n));
    for (let d = 0; d < 7; d++) {
      const date = at(start, w * 7 + d);
      const k = dayKey(date);
      const t = ice[k];
      const tomorrow = ice[dayKey(at(date, 1))].kind;
      const yesterday = ice[dayKey(at(date, -1))]?.kind ?? 'none';
      const row = { k, date, dow: date.getDay(), ice: t.kind, tomorrow, yesterday, type: null, why: 'skipped', did: null };
      rows.push(row);
      if (off.has(d)) continue;
      const r = rand();
      const now = at(date, 0, r < 0.25 ? 7.5 : r < 0.75 ? 16 : 20.5);
      // The check-in, as js/screens/start.js asks it.
      const a = { today: t.kind };
      if (a.today === 'game') a.when = now.getHours() >= t.hour + 1.5 ? 'after' : 'before';
      if (!(a.today === 'game' && a.when === 'before')) {
        a.tomorrow = tomorrow;
        if (row.dow === 5 && tomorrow === 'game' && rand() < fridayMistake) { a.tomorrow = 'practice'; row.wrong = true; }
      }
      if (a.today !== 'game' && a.tomorrow !== 'game' && knownYesterdayGame(save.log, save.days, now) === undefined) a.yesterdayGame = yesterday === 'game';
      a.hurts = false;
      const { d: dec, day, reason } = settle(a, save.log, save.days, now);
      save.days[k] = day;
      Object.assign(row, { now, answers: a, type: dec.type, why: dec.why, reason });
      if (!dec.type) continue;
      const ended = dec.type === 'power' && rand() < endPower;
      save.log.push(ended
        ? { date: now.toISOString(), type: 'power', completed: false, stopped: { why: 'ended' }, done: ['W2', 'W3', 'W4', 'ST3', 'P10', 'P11', 'P4'], skipped: [] }
        : { date: now.toISOString(), type: dec.type, completed: true, stopped: null, done: [], skipped: [] });
      row.did = ended ? 'power-ended' : dec.type;
    }
  }
  return rows;
}

const hardDone = (r) => r.did === 'strength' || r.did === 'power';
// A day the rules could make hard: he trained, and there's no game that day or the next.
const gameFree = (r) => r.did && r.ice !== 'game' && r.tomorrow !== 'game';

// Share of each session type among the counted ones, the fewest Strength + Power in any 14 days,
// and the fewest in any 14 days where he trained on at least 4 game-free days.
export function summary(rows) {
  const did = rows.filter((r) => r.did && r.did !== 'power-ended');
  const count = {};
  for (const t of ['strength', 'power', 'gameday', 'stretch']) count[t] = did.filter((r) => r.did === t).length;
  const share = Object.fromEntries(Object.entries(count).map(([t, n]) => [t, n / (did.length || 1)]));
  let worst14 = { n: Infinity, from: null };
  let worstFair14 = { n: Infinity, from: null };
  for (let i = 0; i + 14 <= rows.length; i++) {
    const w = rows.slice(i, i + 14);
    const n = w.filter(hardDone).length;
    if (n < worst14.n) worst14 = { n, from: rows[i].k };
    if (w.filter(gameFree).length >= 4 && n < worstFair14.n) worstFair14 = { n, from: rows[i].k };
  }
  return { sessions: did.length, perWeek: did.length / (rows.length / 7), count, share, worst14, worstFair14 };
}

// Command line: print the days and the summary.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const weeks = Number(process.argv[2] || 43);
  const seed = Number(process.argv[3] || 7);
  const skips = process.argv[4] || 'random';
  const show = process.argv[5] === 'show' ? Infinity : 21;
  const rows = simulate({ weeks, seed, skips });
  const wd = (d) => d.toLocaleDateString('en-CA', { weekday: 'short' });
  for (const r of rows.slice(0, show)) {
    const ice = r.ice === 'none' ? '' : r.ice;
    console.log(`${r.k} ${wd(r.date)}  ${ice.padEnd(8)} -> ${(r.did || (r.why === 'skipped' ? '(skipped)' : r.why)).padEnd(11)} ${r.reason || ''}`);
  }
  const s = summary(rows);
  const pct = (x) => `${Math.round(x * 100)}%`;
  console.log(`\n${weeks} weeks, seed ${seed}, skips ${skips}: ${s.sessions} sessions (${s.perWeek.toFixed(1)} a week)`);
  console.log(`Strength ${pct(s.share.strength)}  Power ${pct(s.share.power)}  Game Day ${pct(s.share.gameday)}  Stretch ${pct(s.share.stretch)}`);
  console.log(`Fewest Strength + Power in any 14 days: ${s.worst14.n} (from ${s.worst14.from})`);
  console.log(`Fewest in any 14 days where he trained on 4 or more game-free days: ${s.worstFair14.n} (from ${s.worstFair14.from})`);
}
