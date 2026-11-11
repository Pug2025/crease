// Where he is on the splits ladder, and what the next hold is.
// Pure functions: tests.mjs runs them in Node.
//
// The rung only ever moves on something the app can see: a hold he actually did in a session
// (one a day, counted from the log itself), or Dad tapping Watched. He is never asked whether a
// rung was easy, because an 11-year-old asked that question answers it the way that gets him out
// of work. Dad's test runs don't count.
import { LADDER, TOP, HOLDS, PAUSE_ZONES } from '../../data/splits.js';
import { dayKey, painReports, PAIN_DAYS } from './decide.js';

export { TOP, HOLDS };

const clamp = (n) => Math.min(Math.max(1, Number.isFinite(n) ? n : 1), TOP);
export const rungAt = (n) => LADDER[clamp(n) - 1];

const daysFrom = (a, b) => Math.round((new Date(dayKey(b)) - new Date(dayKey(a))) / 86400000);

// Pain in the groin, hip, knee or lower back rests the ladder for 7 days. Returns the newest
// report still in force, or null.
export function splitsPause(log = [], now = new Date()) {
  let out = null;
  for (const r of painReports(log)) {
    if (!PAUSE_ZONES.includes(r.zone)) continue;
    const date = new Date(r.date);
    const n = daysFrom(date, now);
    if (n < 0 || n > PAIN_DAYS) continue;
    const back = new Date(date);
    back.setDate(back.getDate() + PAIN_DAYS + 1);
    if (!out || date > out.date) out = { zone: r.zone, date, back };
  }
  return out;
}

// Days he held the current rung since it opened. One a day: five Splits sessions in an evening
// are one hold. A session Dad ran as a test isn't his.
export function holdsOn(save, now = new Date()) {
  const sp = save.splits || {};
  const since = Date.parse(sp.since || 0) || 0;
  const id = rungAt(sp.rung).id;
  const days = new Set();
  for (const e of save.log || []) {
    if (e.dad && e.extra) continue;
    if (Date.parse(e.date) < since) continue;
    if ((e.done || []).includes(id)) days.add(dayKey(new Date(e.date)));
  }
  return Math.min(days.size, HOLDS);
}

// Everything the screens show.
export function splitsState(save, now = new Date()) {
  const sp = save.splits || {};
  const rung = clamp(sp.rung);
  const r = rungAt(rung);
  const holds = holdsOn(save, now);
  const watched = (sp.watched || []).includes(rung);
  const pause = splitsPause(save.log || [], now);
  const full = holds >= HOLDS;
  return {
    rung, r, holds, watched, pause,
    need: HOLDS,
    left: Math.max(0, HOLDS - holds),
    // Held it enough, and Dad still has to watch it.
    waiting: full && !!r.watch && !watched,
    // Held it enough and free to move up.
    ready: full && (!r.watch || watched) && rung < TOP,
    // He can do the splits: the top rung, held and watched.
    top: rung === TOP && full && watched,
  };
}

// Moves him up when he's earned it. Returns true if anything changed, so the caller saves.
export function settleSplits(save, now = new Date()) {
  if (!save.splits) return false;
  let moved = false;
  for (let guard = 0; guard < TOP; guard++) {
    const st = splitsState(save, now);
    if (!st.ready) break;
    save.splits.rung = st.rung + 1;
    save.splits.since = now.toISOString();
    moved = true;
  }
  return moved;
}

// Dad watched this rung. From here he can move up once he's held it enough.
export function markWatched(save, rung, now = new Date()) {
  save.splits.watched = [...new Set([...(save.splits.watched || []), clamp(rung)])];
  settleSplits(save, now);
}

// Dad sets the rung himself. Clears the holds, and keeps any rung he's already watched.
export function setRung(save, rung, now = new Date()) {
  save.splits.rung = clamp(rung);
  save.splits.since = now.toISOString();
}

// The session item for today's hold, or null while the ladder rests.
export function ladderItem(save, now = new Date()) {
  const st = splitsState(save, now);
  if (st.pause) return null;
  const r = st.r;
  return { id: r.id, as: { name: r.name, ...(r.how ? { how: r.how } : {}) } };
}

// "Split · 3 cushions" for Today, or what's holding the ladder up.
export function splitsLine(save, now = new Date()) {
  const st = splitsState(save, now);
  if (st.pause) return 'resting';
  if (st.top) return 'done';
  if (st.waiting) return 'ready for Dad';
  return st.r.name;
}
