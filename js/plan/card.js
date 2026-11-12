// His goalie card: five ratings from 50 to 99 that only ever go up, an Overall, a tier,
// and the masks his best streak has unlocked. Pure functions: tests.mjs runs them in Node.
import { MASKS } from '../../data/masks.js';
import { countsForStreak, streakStats } from './streak.js';

// How fast each rating climbs. Each curve is 50 + span·(1 − e^(−n/k)), so it rises quickly at
// first and never passes 99. tests.mjs runs a simulated season against the targets.
export const K = { strength: 40, power: 20, stretch: 35, compete: 45 };
// Reflex: his best Lights score. REFLEX_SLOW ms or slower is 50, REFLEX_FAST ms or faster is 99.
export const REFLEX_SLOW = 450;
export const REFLEX_FAST = 200;

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

export const tierOf = (overall) => [...TIERS].reverse().find((t) => overall >= t.at) || TIERS[0];

// The splits rung the card uses: the highest he has reached, so Dad moving him back a rung never
// lowers Flex. save.card.rungPeak is set by Dad's screen before it moves the rung down.
export function rungFor(save) {
  const r = Math.max(Number(save?.splits?.rung) || 1, Number(save?.card?.rungPeak) || 1);
  return Math.min(10, Math.max(1, Math.floor(r)));
}

export function bestLights(lights = []) {
  const ms = (lights || []).filter((l) => l && l.counted && Number.isFinite(l.ms)).map((l) => l.ms);
  return ms.length ? Math.min(...ms) : null;
}

// The raw inputs, so the season simulation can feed them in directly.
export function ratingsFrom({ strength = 0, power = 0, stretch = 0, rung = 1, lightsMs = null, bestStreak = 0 }) {
  const reflex = lightsMs === null || !Number.isFinite(lightsMs) ? 50
    : 50 + 49 * (REFLEX_SLOW - lightsMs) / (REFLEX_SLOW - REFLEX_FAST);
  const raw = {
    strength: 50 + 49 * curve(strength, K.strength),
    power: 50 + 49 * curve(power, K.power),
    flex: 50 + 30 * curve(stretch, K.stretch) + 19 * (Math.min(10, Math.max(1, rung)) - 1) / 9,
    reflex,
    compete: 50 + 49 * curve(bestStreak, K.compete),
  };
  const ratings = Object.keys(LABELS).map((id) => ({ id, label: LABELS[id], value: Math.round(clamp(raw[id])) }));
  const overall = Math.round(ratings.reduce((n, r) => n + r.value, 0) / ratings.length);
  const tier = tierOf(overall);
  const next = TIERS.find((t) => t.at > overall);
  return { overall, tier: tier.name, tierId: tier.id, ratings, nextTier: next ? { name: next.name, at: next.at } : null };
}

// Counted sessions of each kind. Game Day feeds only the streak.
export function sessionCounts(log = []) {
  const n = { strength: 0, power: 0, stretch: 0, gameday: 0 };
  for (const e of log) if (countsForStreak(e) && e.type in n) n[e.type]++;
  return n;
}

export function cardStats(save, now = new Date()) {
  const n = sessionCounts(save.log);
  const st = streakStats(save.log, save.streak, now);
  return {
    ...ratingsFrom({ ...n, rung: rungFor(save), lightsMs: bestLights(save.lights), bestStreak: st.best }),
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

// Masks: unlocked by his best streak ever.
export function maskState(save, now = new Date(), best = streakStats(save.log, save.streak, now).best) {
  const list = MASKS.map((m) => ({ ...m, unlocked: best >= m.streak }));
  const want = save.card?.mask;
  const wearing = list.find((m) => m.id === want && m.unlocked) || list[0];
  return { list, wearing, best };
}

// The masks this many best-streak days newly unlocks, compared with the best before.
export const newMasks = (bestBefore, bestAfter) => MASKS.filter((m) => m.streak > bestBefore && m.streak <= bestAfter);
