// His goalie card: five ratings from 50 to 99 that only ever go up, an Overall, a tier,
// and his masks. Pure functions: tests.mjs runs them in Node.
import { MASKS, FASTER } from '../../data/masks.js';
import { countsForStreak, streakStats, streakDays } from './streak.js';
import { dayKey } from './decide.js';

// How fast each rating climbs. Each curve is 50 + span·(1 − e^(−n/k)), so it rises quickly at
// first and never passes 99. tests.mjs runs a simulated season against the targets.
export const K = { strength: 40, power: 20, stretch: 35, compete: 45 };
// Compete counts a third of each counted day outside his best streak.
export const COMPETE_SPREAD = 3;
// Reflex blends his two phone games, 60% Lights and 40% Glove or Blocker. In each, the slow
// time or slower is 0 and the fast time or faster is 1; no score yet is 0.
export const REFLEX_SLOW = 450;
export const REFLEX_FAST = 200;
export const HANDS_SLOW = 600;
export const HANDS_FAST = 300;
export const REFLEX_MIX = { lights: 0.6, hands: 0.4 };

export const TIERS = [
  { id: 'bronze', name: 'Bronze', at: 50 },
  { id: 'silver', name: 'Silver', at: 60 },
  { id: 'gold', name: 'Gold', at: 70 },
  { id: 'elite', name: 'Elite', at: 80 },
  { id: 'legend', name: 'Legend', at: 90 },
];

const LABELS = { strength: 'Strength', power: 'Power', flex: 'Flex', reflex: 'Reflex', compete: 'Compete' };
const curve = (n, k) => 1 - Math.exp(-Math.max(0, n) / k);
const clamp = (x) => Math.min(99, Math.max(50, x));
const frac = (ms, slow, fast) => (ms === null || !Number.isFinite(ms) ? 0 : Math.min(1, Math.max(0, (slow - ms) / (slow - fast))));

export const tierOf = (overall) => [...TIERS].reverse().find((t) => overall >= t.at) || TIERS[0];

// The splits rung the card uses: the highest he has reached, so Dad moving him back a rung never
// lowers Flex. save.card.rungPeak is set by Dad's screen before it moves the rung down.
export function rungFor(save) {
  const r = Math.max(Number(save?.splits?.rung) || 1, Number(save?.card?.rungPeak) || 1);
  return Math.min(10, Math.max(1, Math.floor(r)));
}

// His best counted score in a phone game (Lights or Glove or Blocker). Practice rounds don't count.
export function bestLights(lights = []) {
  const ms = (lights || []).filter((l) => l && l.counted && Number.isFinite(l.ms)).map((l) => l.ms);
  return ms.length ? Math.min(...ms) : null;
}

// His first counted score in a phone game, or null.
export function firstScore(rounds = []) {
  const r = (rounds || []).find((l) => l && l.counted && Number.isFinite(l.ms));
  return r ? r.ms : null;
}

// The raw inputs, so the season simulation can feed them in directly.
// Compete runs on his best streak plus a third of the counted days outside it, so it keeps
// moving after a broken streak. For a kid who never misses, countedDays equals bestStreak.
export function ratingsFrom({ strength = 0, power = 0, stretch = 0, rung = 1, lightsMs = null, handsMs = null, bestStreak = 0, countedDays = bestStreak }) {
  const reflex = 50 + 49 * (REFLEX_MIX.lights * frac(lightsMs, REFLEX_SLOW, REFLEX_FAST) + REFLEX_MIX.hands * frac(handsMs, HANDS_SLOW, HANDS_FAST));
  const compete = bestStreak + Math.max(0, countedDays - bestStreak) / COMPETE_SPREAD;
  const raw = {
    strength: 50 + 49 * curve(strength, K.strength),
    power: 50 + 49 * curve(power, K.power),
    flex: 50 + 30 * curve(stretch, K.stretch) + 19 * (Math.min(10, Math.max(1, rung)) - 1) / 9,
    reflex,
    compete: 50 + 49 * curve(compete, K.compete),
  };
  const ratings = Object.keys(LABELS).map((id) => ({ id, label: LABELS[id], value: Math.round(clamp(raw[id])) }));
  const overall = Math.round(ratings.reduce((n, r) => n + r.value, 0) / ratings.length);
  const tier = tierOf(overall);
  const next = TIERS.find((t) => t.at > overall);
  return { overall, tier: tier.name, tierId: tier.id, ratings, nextTier: next ? { name: next.name, at: next.at } : null };
}

// Counted sessions of each kind. Game Day feeds only the streak (and two masks).
export function sessionCounts(log = []) {
  const n = { strength: 0, power: 0, stretch: 0, gameday: 0 };
  for (const e of log) if (countsForStreak(e) && e.type in n) n[e.type]++;
  return n;
}

// Days with a counted session, up to and including today.
export function countedDays(log = [], now = new Date()) {
  const today = dayKey(now);
  return [...streakDays(log)].filter((k) => k <= today).length;
}

export function cardStats(save, now = new Date()) {
  const n = sessionCounts(save.log);
  const st = streakStats(save.log, save.streak, now);
  return {
    ...ratingsFrom({ ...n, rung: rungFor(save), lightsMs: bestLights(save.lights), handsMs: bestLights(save.hands), bestStreak: st.best, countedDays: countedDays(save.log, now) }),
    streak: st,
  };
}

// What one finished session changed, for Done. before and after are cardStats results.
export function cardGains(before, after) {
  const rose = after.ratings
    .map((r) => ({ ...r, from: before.ratings.find((b) => b.id === r.id)?.value ?? r.value }))
    .filter((r) => r.value > r.from)
    .map((r) => ({ id: r.id, label: r.label, from: r.from, to: r.value }));
  return {
    ratings: rose,
    overall: after.overall > before.overall ? { from: before.overall, to: after.overall } : null,
    tier: after.tier !== before.tier ? after.tier : null,
  };
}

// ---- Masks ----

const GAME = { lights: 'Lights', hands: 'Glove or Blocker' };
const TYPE = { strength: 'Strength', power: 'Power', gameday: 'Game Day' };

// Everything the mask rules look at, worked out once.
export function maskFacts(save, now = new Date(), st = streakStats(save.log, save.streak, now)) {
  const n = sessionCounts(save.log);
  const game = (rounds) => ({ first: firstScore(rounds), best: bestLights(rounds) });
  return {
    best: st.best,
    comeback: !!st.comeback,
    sessions: n.strength + n.power + n.stretch + n.gameday,
    types: n,
    rung: rungFor(save),
    lights: game(save.lights),
    hands: game(save.hands),
  };
}

// One mask's rule: met, and for the shelf, what it needs and how far along he is.
function rule(m, f) {
  switch (m.by) {
    case 'streak': return { met: f.best >= m.n, need: `${m.n}-day streak`, have: f.best, goal: m.n };
    case 'sessions': return { met: f.sessions >= m.n, need: `${m.n} sessions`, have: f.sessions, goal: m.n };
    case 'type': return { met: (f.types[m.type] || 0) >= m.n, need: `${m.n} ${TYPE[m.type]} sessions`, have: f.types[m.type] || 0, goal: m.n };
    case 'rung': return { met: f.rung >= m.n, need: `Splits rung ${m.n}`, have: f.rung, goal: m.n };
    case 'faster': {
      const g = f[m.game];
      const target = g.first === null ? null : Math.floor(g.first * FASTER);
      // Goal is the time to beat in ms, not a count.
      return { met: target !== null && g.best <= g.first * FASTER, need: target === null ? `${GAME[m.game]} 10% faster` : GAME[m.game], have: g.best, goal: target, ms: true };
    }
    case 'comeback': return { met: f.comeback, need: '3-day streak after losing 7' };
    default: return { met: false, need: '' };
  }
}

const earnedIds = (save) => (Array.isArray(save?.card?.earned) ? save.card.earned : []);

// Every mask, for the shelf: unlocked (rule met now, or earned before), and for a locked one
// what it needs and his progress. A locked secret mask hides its name and rule.
export function masksFor(save, now = new Date(), facts = maskFacts(save, now)) {
  const earned = new Set(earnedIds(save));
  return MASKS.map((m) => {
    const r = rule(m, facts);
    const unlocked = r.met || earned.has(m.id);
    const out = { id: m.id, name: m.name, by: m.by, secret: !!m.secret, met: r.met, unlocked };
    if (unlocked) return out;
    if (m.secret) return { ...out, name: 'Secret', need: '???' };
    const progress = r.goal === undefined || r.goal === null ? null
      : r.ms ? (r.have === null ? null : `${r.goal} ms or faster`)
      : `${Math.min(r.have, r.goal)} / ${r.goal}`;
    return { ...out, need: r.need, have: r.have, goal: r.goal, progress };
  });
}

export function maskState(save, now = new Date()) {
  const list = masksFor(save, now);
  const want = save.card?.mask;
  const wearing = list.find((m) => m.id === want && m.unlocked) || list[0];
  return { list, wearing, count: list.filter((m) => m.unlocked).length };
}

// The masks whose rule is met but which he hasn't been shown yet. Pure.
export function pendingMasks(save, now = new Date()) {
  const earned = new Set(earnedIds(save));
  const facts = maskFacts(save, now);
  return MASKS.filter((m) => !earned.has(m.id) && rule(m, facts).met).map((m) => ({ id: m.id, name: m.name }));
}

// Adds the newly met masks to save.card.earned and returns them, once only. A save with no
// earned list yet (an older save) is seeded silently and returns nothing.
export function claimMasks(save, now = new Date()) {
  save.card = save.card && typeof save.card === 'object' ? save.card : {};
  if (!Array.isArray(save.card.earned)) { seedMasks(save, now); return []; }
  const fresh = pendingMasks(save, now);
  if (fresh.length) save.card.earned = [...save.card.earned, ...fresh.map((m) => m.id)];
  return fresh;
}

// Fills save.card.earned with every mask met right now, without a "New mask" line for any.
export function seedMasks(save, now = new Date()) {
  save.card = save.card && typeof save.card === 'object' ? save.card : {};
  const have = Array.isArray(save.card.earned) ? save.card.earned : [];
  const facts = maskFacts(save, now);
  const met = MASKS.filter((m) => rule(m, facts).met).map((m) => m.id);
  save.card.earned = [...new Set([...have, ...met])];
  return save.card.earned;
}
