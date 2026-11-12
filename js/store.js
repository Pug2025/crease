// Everything Crease remembers lives on the phone, in one saved object.
// Phase 1 keeps it in localStorage: a year of sessions is well under 1 MB.

const KEY = 'crease.save';
const VERSION = 1;

// New fields always get a safe default here, so an older save keeps working.
export function blank() {
  return {
    v: VERSION,
    created: new Date().toISOString(),
    setupDone: false,
    // His med ball doesn't bounce (Jamie, 10 November 2026), so slams are always allowed. No band drills remain.
    settings: { ball: 'dead', band: false },
    log: [], // sessions
    days: {}, // first check-in of each day: { '2026-11-10': { today, tomorrow, when, type, at } }
    dadPin: null, // scrambled, never the PIN itself
    versions: {}, // Dad's chosen version per drill: { ST1: 0 } (0 Easier, 1 Standard, 2 Harder)
    lights: [], // every Lights round: { date, ms, counted, taps }. It never counts as a session.
    // The splits ladder: which rung he's on, when it opened (holds before that don't count
    // toward it), and the rungs Dad has watched.
    splits: { rung: 1, since: new Date().toISOString(), watched: [] },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === VERSION) {
        const b = blank();
        migrateOldRecords(s);
        return {
          ...b,
          ...s,
          settings: { ...b.settings, ...s.settings, ball: 'dead' },
          log: Array.isArray(s.log) ? s.log : [],
          days: s.days || {},
          versions: s.versions || {},
          lights: Array.isArray(s.lights) ? s.lights : [],
          splits: { ...b.splits, ...(s.splits || {}), watched: Array.isArray(s.splits?.watched) ? s.splits.watched : [] },
        };
      }
    }
  } catch {}
  return blank();
}

// MIGRATION ONLY (hurt-guard exempt: tests.mjs skips this function). Older saves can hold
// records from a feature the app no longer has. Turns them into plain records so nothing
// about them is ever shown or acted on. Changes s in place and returns it.
export function migrateOldRecords(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s.log)) {
    s.log = s.log.filter((e) => e && e.stopped?.why !== 'hurt-before');
    for (const e of s.log) {
      // A pain stop counted before, so it still counts.
      if (e.stopped?.why === 'pain') { e.completed = true; delete e.stopped; delete e.short; }
      if (Array.isArray(e.skipped)) {
        for (const sk of e.skipped) {
          if (!sk) continue;
          delete sk.zone;
          if (sk.why === 'hurts') sk.why = 'here';
        }
      }
      delete e.dadSeen;
      delete e.cleared;
    }
  }
  delete s.seenAlerts;
  if (s.days && typeof s.days === 'object') for (const d of Object.values(s.days)) if (d && typeof d === 'object') delete d.hurts;
  return s;
}
// END MIGRATION

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch {}
  return blank();
}

// Dad's PIN is saved scrambled, so the saved data never holds the four digits.
export async function scramble(pin) {
  const data = new TextEncoder().encode(`crease:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Ask the phone to keep this storage even when space runs low.
export async function askToKeep() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
}
