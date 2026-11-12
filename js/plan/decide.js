// Decides today's session from his check-in answers and what he's done lately.
// He never picks the session himself. Pure functions: tests.mjs runs them in Node.
//
// answers: { today: 'game' | 'practice' | 'none', when: 'before' | 'after' (game days only),
//            tomorrow: 'game' | 'practice' | 'none', yesterdayGame: true | false | undefined }
// log: the saved session log. days: saved check-in answers by date (see settle()).
import { byId } from '../../data/exercises.js';
import { SESSIONS } from '../../data/sessions.js';

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shift(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Whole days from a to b, by the calendar (DST-proof).
const daysFrom = (a, b) => Math.round((new Date(dayKey(b)) - new Date(dayKey(a))) / 86400000);

// A session counts when it was finished. Extra stretching and Dad's test runs don't.
export const counts = (e) => !!e.completed && !e.extra;
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

// The drills in Power's main blocks that land jumps: jump squats, skater jumps, burpees.
const JUMP_IDS = new Set(SESSIONS.power.blocks.filter((b) => b.name !== 'Warm-up')
  .flatMap((b) => b.items.map((it) => it.id)).filter((id) => byId[id]?.jumps > 0));

// A Power session counts for the jump limits once he did its jumps, even if it ended early.
export const jumpedPower = (e) => e.type === 'power' && !e.extra && (counted(e) || (e.done || []).some((id) => JUMP_IDS.has(id)));

// What we already know about a game yesterday, without asking. An answer about "tomorrow" from two
// days ago is trusted only when it said game: a Saturday practice can turn into a home game.
export function knownYesterdayGame(log, days, now = new Date()) {
  const y = dayKey(shift(now, -1));
  const y2 = dayKey(shift(now, -2));
  const asked = days[dayKey(now)]?.yesterdayGame; // he already answered it today
  if (typeof asked === 'boolean') return asked;
  if (days[y]?.today) return days[y].today === 'game';
  if (days[y2]?.tomorrow === 'game') return true;
  if ((doneByDay(log)[y] || []).includes('gameday')) return true;
  return undefined;
}

export function decide(answers, log, days, now = new Date()) {
  const by = doneByDay(log);
  const on = (n, type) => (by[dayKey(shift(now, n))] || []).includes(type);
  const trained = (n) => (by[dayKey(shift(now, n))] || []).length > 0;
  const powerDays = new Set(log.filter(jumpedPower).map((e) => dayKey(new Date(e.date))));
  const power = (n) => powerDays.has(dayKey(shift(now, n)));
  const hard = (n) => power(n) || on(n, 'strength');
  const lastDone = (type) => {
    let last = null;
    for (const e of log) {
      if (!counted(e) || e.type !== type) continue;
      const d = new Date(e.date);
      if (daysFrom(d, now) >= 1 && (!last || d > last)) last = d;
    }
    return last;
  };

  const pick = (type, why, more = {}) => ({ type, why, ...more });

  if (trained(0)) return { type: null, why: 'done' };
  // A Power that ended early after the jumps: no more jumping today.
  if (power(0)) return pick('stretch', 'jumped-today');
  if (answers.today === 'game') return answers.when === 'after' ? pick('stretch', 'after-game') : pick('gameday', 'game-today');
  if (answers.tomorrow === 'game') return pick('stretch', 'game-tomorrow');
  const yesterdayGame = answers.yesterdayGame ?? knownYesterdayGame(log, days, now);
  // Six training days in a row with no easy day among them: today is easy.
  if ([1, 2, 3, 4, 5, 6].every((n) => trained(-n) && !on(-n, 'stretch'))) return pick('stretch', 'six-days');
  if (hard(-1) && hard(-2)) return pick('stretch', 'two-hard-days');

  // Why Power is off today, first reason that applies. The day after a game can be Strength, never Power.
  // No Power on Fridays and Saturdays: weekend games are the ones he gets wrong or hears about late.
  const powerThisWeek = [1, 2, 3, 4, 5, 6].filter((n) => power(-n)).length;
  const dow = now.getDay();
  const noPower = answers.today === 'practice' ? 'practice-today'
    : yesterdayGame ? 'game-yesterday'
    : dow === 5 || dow === 6 ? 'fri-sat'
    : power(-1) ? 'power-yesterday'
    : powerThisWeek >= 2 ? 'power-cap'
    : null;
  const powerOk = !noPower;
  const strengthOk = !on(-1, 'strength');
  const lastPower = lastDone('power');
  const lastStrength = lastDone('strength');
  const firstEver = !log.some(counted);
  // Whichever was done longer ago. His very first Strength comes before any Power.
  const powerTurn = !!lastStrength && (!lastPower || lastPower < lastStrength);

  const strength = () => {
    if (firstEver) return pick('strength', 'first', { last: null });
    // Say why it isn't Power when that's news: always for practice or a game; otherwise only when Power was due.
    if (noPower && (powerTurn || ['practice-today', 'game-yesterday'].includes(noPower)) && noPower !== 'power-yesterday')
      return pick('strength', 'no-power', { blocked: noPower, last: lastStrength });
    return pick('strength', lastStrength ? 'strength-turn' : 'strength-first', { last: lastStrength });
  };

  // Power has fewer days it can go on. When tomorrow can't have it (practice, or Friday), take it today:
  // Strength fits tomorrow. Not before his first Strength.
  const powerOffTomorrow = !!lastStrength && (answers.tomorrow === 'practice' || dow === 4);
  if (powerOk && strengthOk) return powerTurn || powerOffTomorrow ? pick('power', 'power-turn', { last: lastPower }) : strength();
  if (strengthOk) return strength();
  if (powerOk) return pick('power', 'power-turn', { last: lastPower });
  if (yesterdayGame) return pick('stretch', 'game-yesterday');
  return pick('stretch', 'easy', { blocked: noPower });
}

const listAnd = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// The line shown under today's session: what the app knew, not an order.
export function reasonText(d, now = new Date()) {
  const last = (date) => {
    if (!date) return 'not yet';
    const n = daysFrom(date, now);
    if (n === 1) return 'yesterday';
    if (n < 7) return date.toLocaleDateString('en-CA', { weekday: 'long' });
    return date.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
  };
  const weekday = now.toLocaleDateString('en-CA', { weekday: 'long' });
  switch (d.why) {
    case 'game-today': return 'Game today, so this one is short and easy.';
    case 'after-game': return 'You played today, so you only stretch.';
    case 'game-tomorrow': return 'Game tomorrow, so today you stretch and save your legs.';
    case 'game-yesterday': return 'Game yesterday, so today is an easy one.';
    case 'jumped-today': return 'You did the jumps today. Today is an easy one.';
    case 'six-days': return 'Six days in a row. Today is an easy one.';
    case 'two-hard-days': return 'Two hard days in a row. Today is an easy one.';
    case 'first': return 'Your first session is Strength.';
    case 'strength-first': return 'First Strength session.';
    case 'power-turn': return `No hockey today, no game tomorrow. ${d.last ? `Last Power: ${last(d.last)}.` : 'First Power session.'}`;
    case 'strength-turn': return `Last Strength: ${last(d.last)}.`;
    case 'no-power':
      switch (d.blocked) {
        case 'practice-today': return 'Practice today, so no Power.';
        case 'game-yesterday': return 'Game yesterday, so no Power.';
        case 'fri-sat': return `No Power on ${weekday}s.`;
        case 'power-cap': return 'Power twice this week already.';
        default: return `Last Strength: ${last(d.last)}.`;
      }
    case 'easy':
      switch (d.blocked) {
        case 'practice-today': return 'Practice today and Strength yesterday. Today is an easy one.';
        case 'fri-sat': return `Strength yesterday, and no Power on ${weekday}s. Today is an easy one.`;
        case 'power-cap': return 'Strength yesterday, and Power twice this week. Today is an easy one.';
        default: return 'You\'ve trained hard lately. Today is an easy one.';
      }
    default: return '';
  }
}

// His answers, for the preview: "No hockey today · Practice tomorrow".
export function answersText(a) {
  if (!a || !a.today) return '';
  const parts = [];
  if (a.today === 'game') parts.push(a.when === 'after' ? 'Played a game today' : 'Game later today');
  else parts.push(a.today === 'practice' ? 'Practice today' : 'No hockey today');
  if (a.tomorrow) parts.push({ game: 'Game tomorrow', practice: 'Practice tomorrow', none: 'No hockey tomorrow' }[a.tomorrow]);
  if (a.yesterdayGame === true) parts.push('Game yesterday');
  return parts.filter(Boolean).join(' · ');
}

// "Grab: the med ball and a towel." from session.grab (plain strings), or '' when there's nothing.
export function grabText(grab) {
  const xs = Array.isArray(grab) ? grab.filter((g) => typeof g === 'string' && g) : [];
  return xs.length ? `Grab: ${listAnd(xs)}.` : '';
}

// The first check-in of a day sticks (contract C5). A later one that day can only make it easier:
// the session only moves down Power > Strength > Game Day > Stretch, the answer with more hockey
// wins, and "game tomorrow" from either sticks, so he can still fix a game he forgot.
// Dad's "Redo today's check-in" deletes the day. Returns the decision, its reason line, and the
// record to save as days[dayKey(now)]: { today, tomorrow, when, yesterdayGame, type, reason, at, tries }.
const EASIER = ['power', 'strength', 'gameday', 'stretch'];
const HOCKEY = { none: 0, practice: 1, game: 2 };
const moreHockey = (a, b) => ((HOCKEY[b] ?? -1) > (HOCKEY[a] ?? -1) ? b : a);

export function settle(answers, log, days, now = new Date()) {
  // A record with no type (a check-in after he'd already trained, or answers from before this build) is no first check-in.
  const saved = days[dayKey(now)];
  const prev = saved?.type ? saved : null;
  const a = { ...answers };
  if (prev) {
    a.today = moreHockey(prev.today, answers.today);
    a.tomorrow = moreHockey(prev.tomorrow, answers.tomorrow) ?? null;
    if (a.today === 'game') a.when = prev.when === 'after' || answers.when === 'after' ? 'after' : answers.when ?? prev.when;
    if (prev.yesterdayGame === true || answers.yesterdayGame === true) a.yesterdayGame = true;
    else a.yesterdayGame = answers.yesterdayGame ?? prev.yesterdayGame;
  }
  let d = decide(a, log, days, now);
  let reason = reasonText(d, now);
  // A redo can't make it harder: keep the earlier session and its reason.
  if (d.type && EASIER.includes(prev?.type) && EASIER.indexOf(d.type) < EASIER.indexOf(prev.type)) {
    d = { ...d, type: prev.type, why: 'kept', kept: true, blocked: undefined, last: undefined };
    reason = prev.reason || '';
  }
  const day = {
    today: a.today ?? null,
    tomorrow: a.tomorrow ?? null,
    when: a.today === 'game' ? a.when ?? null : null,
    yesterdayGame: a.yesterdayGame ?? null,
    type: d.type ?? prev?.type ?? null,
    reason: d.type ? reason : prev?.reason ?? '',
    at: prev?.at ?? now.toISOString(),
    tries: (prev?.tries || 0) + 1,
  };
  return { d, reason, day };
}
