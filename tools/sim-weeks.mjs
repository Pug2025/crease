// Prints what the check-in would pick over a few weeks of a random hockey schedule.
// Run from the Crease folder: node tools/sim-weeks.mjs [days]
import { decide, dayKey } from '../js/plan/decide.js';

const total = Number(process.argv[2] || 21);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ice = [];
for (let d = 0; d < total + 3; d++) {
  const r = rand();
  ice.push(r < 0.2 ? 'game' : r < 0.45 ? 'practice' : 'none');
}
const log = [];
const days = {};
for (let d = 1; d <= total; d++) {
  const now = new Date(2026, 0, d, 16);
  const answers = { today: ice[d], when: 'before', tomorrow: ice[d + 1], yesterdayGame: ice[d - 1] === 'game' };
  const r = decide(answers, log, days, now);
  days[dayKey(now)] = { today: ice[d], tomorrow: ice[d + 1] };
  if (r.type) log.push({ date: now.toISOString(), type: r.type, completed: true });
  const day = now.toLocaleDateString('en-CA', { weekday: 'short' });
  console.log(`${day}  today ${ice[d].padEnd(9)} tomorrow ${ice[d + 1].padEnd(9)} -> ${r.type}  (${r.why})`);
}
