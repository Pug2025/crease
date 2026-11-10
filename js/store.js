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
    // Sessions. A pain entry can also carry dadSeen (Dad tapped Seen) and cleared (Dad: he's OK to train today).
    log: [],
    seenAlerts: [], // old saves only: notices he closed himself. Only Dad's Seen clears a pain notice now.
    days: {}, // first check-in of each day: { '2026-11-10': { today, tomorrow, when, type, at } }
    dadPin: null, // scrambled, never the PIN itself
    versions: {}, // Dad's chosen version per drill: { ST1: 0 } (0 Easier, 1 Standard, 2 Harder)
    lights: [], // every Lights round: { date, ms, counted, taps }. It never counts as a session.
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === VERSION) {
        const b = blank();
        return {
          ...b,
          ...s,
          settings: { ...b.settings, ...s.settings, ball: 'dead' },
          log: Array.isArray(s.log) ? s.log : [],
          days: s.days || {},
          versions: s.versions || {},
          lights: Array.isArray(s.lights) ? s.lights : [],
        };
      }
    }
  } catch {}
  return blank();
}

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
