// The day streak and his saves. Pure functions: tests.mjs runs them in Node.
//
// A day counts when it has at least one counted session. Extras, Lights, the 3-minute Splits and
// Dad's test runs never count. The streak is the run of counted days ending today, or ending
// yesterday when he hasn't trained yet today, so it never looks broken in the morning.
//
// Saves (a day off that keeps the streak): he starts with 1, earns 1 each time the streak reaches
// a multiple of 7, and holds at most 2. Dad can give one (save.streak.gifts, one date per gift).
// A missed day spends a save as soon as the day is over, and a saved day doesn't add to the count.
// If a gap runs longer than the saves he holds, the saves spent on it come back, the streak goes
// to 0 and his best stays.
//
// Everything is replayed from the log, day by day, every time. No running counter is stored,
// so it can never drift.
import { counts, dayKey } from './decide.js';

export const MAX_SAVES = 2;
export const START_SAVES = 1;
export const SAVE_EVERY = 7;
export const MILESTONES = [3, 7, 14, 30, 60, 100];

// A session that counts toward the streak and the card. Older saves can hold test runs.
export const countsForStreak = (e) => !!e && counts(e) && !!e.type && !e.test && !(e.dad && e.extra);

// The set of days with a counted session.
export function streakDays(log = []) {
  const days = new Set();
  for (const e of log) {
    if (!countsForStreak(e)) continue;
    const d = new Date(e.date);
    if (!Number.isNaN(d.getTime())) days.add(dayKey(d));
  }
  return days;
}

const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const nextKey = (k) => { const d = fromKey(k); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); };

export function streakStats(log = [], streak = { gifts: [] }, now = new Date()) {
  const days = streakDays(log);
  const todayKey = dayKey(now);
  const gifts = (Array.isArray(streak?.gifts) ? streak.gifts : []).filter((g) => typeof g === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g)).sort();
  const giftsOn = {};
  for (const g of gifts) giftsOn[g] = (giftsOn[g] || 0) + 1;

  const keys = [...days].filter((k) => k <= todayKey).sort();
  let saves = START_SAVES;
  let run = 0;
  let best = 0;
  let earnedToday = false;
  let savedDays = [];
  // The Phoenix mask: a streak of 3 after losing one of 7 or more.
  let lostBig = false;
  let comeback = false;
  if (!keys.length) {
    for (const g of gifts) if (g <= todayKey) saves = Math.min(MAX_SAVES, saves + 1);
    return { days: 0, best: 0, saves, savedDays: [], todayDone: false, nextSaveAt: SAVE_EVERY, milestone: null, saveEarned: false, comeback: false };
  }
  // Gifts from before his first session (or on that day) are in hand on day one.
  for (const g of gifts) if (g <= keys[0]) saves = Math.min(MAX_SAVES, saves + 1);

  let gap = []; // the missed days spent on the gap so far
  let broken = false; // this gap already ran past his saves
  for (let k = keys[0]; k <= todayKey; k = nextKey(k)) {
    if (k > keys[0]) for (let n = giftsOn[k] || 0; n > 0; n--) saves = Math.min(MAX_SAVES, saves + 1);
    if (days.has(k)) {
      if (gap.length) savedDays.push(...gap);
      gap = [];
      broken = false;
      run++;
      best = Math.max(best, run);
      if (lostBig && run >= 3) comeback = true;
      if (run % SAVE_EVERY === 0) {
        const had = saves;
        saves = Math.min(MAX_SAVES, saves + 1);
        if (k === todayKey) earnedToday = saves > had;
      }
    } else if (k < todayKey && !broken) {
      // The day is over and he didn't train: it spends a save, or the gap is too long.
      if (saves > 0) { saves--; gap.push(k); }
      else {
        saves = Math.min(MAX_SAVES, saves + gap.length);
        gap = [];
        broken = true;
        if (run >= 7) lostBig = true;
        run = 0;
      }
    }
  }
  // A gap still open this morning: its saves are spent and the streak stands.
  if (gap.length) savedDays.push(...gap);
  const todayDone = days.has(todayKey);
  const milestone = todayDone && MILESTONES.includes(run) ? run : null;
  return {
    days: run,
    best,
    saves,
    savedDays,
    todayDone,
    nextSaveAt: (Math.floor(run / SAVE_EVERY) + 1) * SAVE_EVERY,
    milestone,
    saveEarned: earnedToday,
    comeback,
  };
}

// Dad gives a save. Returns false (and changes nothing) when he already holds the most.
export function giveSave(save, now = new Date()) {
  const st = streakStats(save.log, save.streak, now);
  if (st.saves >= MAX_SAVES) return false;
  save.streak = { ...(save.streak || {}), gifts: [...(save.streak?.gifts || []), dayKey(now)] };
  return true;
}
