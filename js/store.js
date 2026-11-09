// Everything Crease remembers lives on the phone, in one saved object.
// Phase 1 keeps it in localStorage: a year of sessions is well under 1 MB.

const KEY = 'crease.save';
const VERSION = 1;

function blank() {
  return {
    v: VERSION,
    created: new Date().toISOString(),
    setupDone: false,
    settings: { ball: 'none', band: false },
    log: [],
    seenAlerts: [],
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === VERSION) {
        const b = blank();
        return { ...b, ...s, settings: { ...b.settings, ...s.settings } };
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

// Ask the phone to keep this storage even when space runs low.
export async function askToKeep() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
}
