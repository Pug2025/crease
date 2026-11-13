// His records: the number he enters after a finisher, and Dad's challenge.
// Pure functions: tests.mjs runs them in Node. Records are his own count, so nothing here
// feeds the card's ratings.
//
// save.records: [{ date, id, v, n, cam? }], one per finisher he entered. cam: what the camera
// counted, kept only to compare with the number he saved; n is always his number. A record belongs to one drill
// and one version: a harder version starts its own.
// save.challenge: { id, n, set, beaten } or null. It is per drill: the version is always the one he
// does now (finisherVersion). beaten is the date of the record that reached n.
import { byId } from '../../data/exercises.js';
import { FINISHER } from '../../data/sessions.js';

export const RECORD_MAX = 99;
// Where the stepper starts when he has no record yet for that drill.
export const RECORD_START = 10;

// Every drill a finisher can be, in the order the Records list and Dad's challenge show them.
export const RECORD_IDS = [...new Set([...FINISHER.strength, ...FINISHER.power, FINISHER.powerFallback])];

const clampN = (n) => Math.min(RECORD_MAX, Math.max(0, Math.round(Number(n) || 0)));
const list = (save) => (Array.isArray(save?.records) ? save.records : []);

// The name he sees for a drill and version: "Step-Back Burpees" for burpees' easier version.
export function recordName(id, v) {
  const d = byId[id];
  if (!d) return id;
  return d.versions[v]?.title ?? d.name;
}

// "Push-Ups in 40 s".
export const recordTitle = (id, v) => `${recordName(id, v)} in ${FINISHER.window} s`;

// Finishers of one session type he did (the work step started), for the rotation. Test runs never reach the log.
export function finishersDone(log = [], type) {
  return log.filter((e) => e && !e.test && e.type === type && e.finisher?.did).length;
}

// His best for one drill and version: { n, date }, or null.
export function bestFor(records, id, v) {
  let best = null;
  for (const r of records || []) {
    if (!r || r.id !== id || r.v !== v || !Number.isFinite(r.n)) continue;
    if (!best || r.n > best.n) best = { n: r.n, date: r.date };
  }
  return best;
}

// The line on Done after he saves. prev: his best before this one (a number) or null.
export function recordWords(prev, n) {
  if (prev === null || prev === undefined) return `First record: ${n}.`;
  if (n > prev) return `New best: ${n}. Your old best was ${prev}.`;
  return `Today ${n}. Best ${prev}.`;
}

// Saves one record and checks Dad's challenge. Returns what Done shows.
export function addRecord(save, { id, v, n, cam }, now = new Date()) {
  save.records = list(save);
  const count = clampN(n);
  const prev = bestFor(save.records, id, v)?.n ?? null;
  const date = now.toISOString();
  save.records.push(Number.isInteger(cam) && cam > 0 ? { date, id, v, n: count, cam } : { date, id, v, n: count });
  const ch = save.challenge;
  const beat = !!ch && !ch.beaten && ch.id === id && v === finisherVersion(save, id) && count >= ch.n;
  if (beat) save.challenge = { ...ch, beaten: date };
  return { n: count, prev, best: prev === null || count > prev, words: recordWords(prev, count), challengeBeaten: beat };
}

// The version Dad has set for a drill now.
export const versionOf = (save, id) => {
  const d = byId[id];
  const v = save?.versions?.[id];
  return Number.isInteger(v) && d.versions[v] ? v : d.start;
};

// The version his finisher runs on a drill now: burpees are always FINISHER.powerVersion
// (Step-Back Burpees); the others are the version Dad has set.
export const finisherVersion = (save, id) => (FINISHER.power.includes(id) ? FINISHER.powerVersion : versionOf(save, id));

// The Records list on the Card: a row for each drill and version he has a record on, and for a
// finisher drill with no record yet, a row at the version the finisher runs now ("No record yet").
// A version with its own name (Step-Back Burpees) shows that name; another shows its tag (Harder).
export function recordRows(save) {
  const recs = list(save);
  const rows = [];
  for (const id of RECORD_IDS) {
    const d = byId[id];
    const vs = [...new Set(recs.filter((r) => r.id === id).map((r) => r.v))].filter((v) => d.versions[v]).sort();
    for (const v of vs.length ? vs : [finisherVersion(save, id)]) {
      const tag = !d.versions[v].title && v !== d.start ? d.versions[v].name : '';
      rows.push({ id, v, name: recordName(id, v), tag, best: bestFor(recs, id, v) });
    }
  }
  return rows;
}

// ---- Dad's challenge ----

// The lowest number Dad can set.
export const CHALLENGE_MIN = 5;

// Dad sets one: a record drill and a number to reach. No version: it follows what he does now.
export function setChallenge(save, id, n, now = new Date()) {
  if (!byId[id] || !RECORD_IDS.includes(id)) return null;
  save.challenge = { id, n: Math.max(CHALLENGE_MIN, clampN(n)), set: now.toISOString(), beaten: null };
  return save.challenge;
}

export function clearChallenge(save) {
  save.challenge = null;
}

// "20 push-ups in 40 s", for Today and Dad's screen, at the version he does now.
export function challengeWhat(save, ch) {
  return `${ch.n} ${recordName(ch.id, finisherVersion(save, ch.id)).toLowerCase()} in ${FINISHER.window} s`;
}

// Today's tile: { text, best, beaten }, or null when there's no challenge.
export function challengeTile(save) {
  const ch = save?.challenge;
  if (!ch || !RECORD_IDS.includes(ch.id)) return null;
  const v = finisherVersion(save, ch.id);
  if (ch.beaten) return { beaten: true, text: `Dad's challenge beaten: ${ch.n} ${recordName(ch.id, v).toLowerCase()}` };
  const best = bestFor(list(save), ch.id, v);
  return { beaten: false, text: `Dad's challenge: ${challengeWhat(save, ch)}`, best: best ? `Your best: ${best.n}` : 'No record yet' };
}
