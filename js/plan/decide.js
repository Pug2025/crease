// Decides today's session from his check-in answers and what he's done lately.
// He never picks the session himself. Pure functions: tests.mjs runs them in Node.
//
// answers: { today: 'game' | 'practice' | 'none', when: 'before' | 'after' (game days only),
//            tomorrow: 'game' | 'practice' | 'none', yesterdayGame: true | false | undefined, hurts: bool }
// log: the saved session log. days: saved check-in answers by date.

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shift(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// A session counts when it was finished, or stopped for pain. Extra stretching and Dad's test runs don't.
export const counts = (e) => (e.completed || e.stopped?.why === 'pain') && !e.extra;
const counted = counts;

// Session types done on each date, from the log.
export function doneByDay(log) {
  const by = {};
  for (const e of log) {
    if (!counted(e) || !e.type) continue;
    const k = dayKey(new Date(e.date));
    (by[k] ||= []).push(e.type);
  }
  return by;
}

// What we already know about a game yesterday, without asking.
export function knownYesterdayGame(log, days, now = new Date()) {
  const y = dayKey(shift(now, -1));
  const y2 = dayKey(shift(now, -2));
  if (days[y]?.today) return days[y].today === 'game';
  if (days[y2]?.tomorrow) return days[y2].tomorrow === 'game';
  if ((doneByDay(log)[y] || []).includes('gameday')) return true;
  return undefined;
}

export function decide(answers, log, days, now = new Date()) {
  const by = doneByDay(log);
  const on = (n, type) => (by[dayKey(shift(now, n))] || []).includes(type);
  const trained = (n) => (by[dayKey(shift(now, n))] || []).length > 0;
  const hard = (n) => on(n, 'power') || on(n, 'strength');
  const lastDone = (type) => {
    for (let n = 1; n <= 60; n++) if (on(-n, type)) return shift(now, -n);
    return null;
  };

  if (answers.hurts) return { type: null, why: 'hurts' };
  if (trained(0)) return { type: null, why: 'done' };
  if (answers.today === 'game') return answers.when === 'after' ? { type: 'stretch', why: 'after-game' } : { type: 'gameday', why: 'game-today' };
  if (answers.tomorrow === 'game') return { type: 'stretch', why: 'game-tomorrow' };
  const yesterdayGame = answers.yesterdayGame ?? knownYesterdayGame(log, days, now);
  if (yesterdayGame) return { type: 'stretch', why: 'game-yesterday' };
  // Six training days in a row with no easy day among them: today is easy.
  if ([1, 2, 3, 4, 5, 6].every((n) => trained(-n) && !on(-n, 'stretch'))) return { type: 'stretch', why: 'six-days' };
  if (hard(-1) && hard(-2)) return { type: 'stretch', why: 'two-hard-days' };

  const powerThisWeek = [1, 2, 3, 4, 5, 6].filter((n) => on(-n, 'power')).length;
  const powerOk = answers.today !== 'practice' && !on(-1, 'power') && powerThisWeek < 2;
  const strengthOk = !on(-1, 'strength');
  const lastPower = lastDone('power');
  const lastStrength = lastDone('strength');

  if (powerOk && strengthOk) {
    // Whichever was done longer ago. His very first session is Strength.
    if (!lastStrength) return { type: 'strength', why: 'strength-turn', last: null };
    if (!lastPower || lastPower < lastStrength) return { type: 'power', why: 'power-turn', last: lastPower };
    return { type: 'strength', why: 'strength-turn', last: lastStrength };
  }
  if (strengthOk) return { type: 'strength', why: answers.today === 'practice' ? 'practice-today' : 'strength-turn', last: lastStrength };
  if (powerOk) return { type: 'power', why: 'power-turn', last: lastPower };
  return { type: 'stretch', why: answers.today === 'practice' ? 'practice-easy' : 'trained-hard' };
}

// The line shown under today's session: what the app knew, not an order.
export function reasonText(d, now = new Date()) {
  const day = (date) => {
    if (!date) return 'not yet';
    const n = Math.round((new Date(dayKey(now)) - new Date(dayKey(date))) / 86400000);
    if (n === 1) return 'yesterday';
    if (n < 7) return date.toLocaleDateString('en-CA', { weekday: 'long' });
    return date.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
  };
  switch (d.why) {
    case 'game-today': return 'Game today. Short and easy, just get loose.';
    case 'after-game': return 'You played today. Loosen up and you\'re done.';
    case 'game-tomorrow': return 'Game tomorrow. Keep your legs fresh.';
    case 'game-yesterday': return 'Game yesterday. Today your legs recover.';
    case 'six-days': return 'Six days in a row. Today is an easy one.';
    case 'two-hard-days': return 'Two hard days in a row. Today is an easy one.';
    case 'practice-today': return 'Practice today, so no jumping.';
    case 'power-turn': return `No hockey today or tomorrow. Last Power: ${day(d.last)}.`;
    case 'strength-turn': return `Last Strength: ${day(d.last)}.`;
    case 'practice-easy': return 'Practice today and Strength yesterday. Today is an easy one.';
    case 'trained-hard': return 'You\'ve trained hard lately. Today is an easy one.';
    default: return '';
  }
}
