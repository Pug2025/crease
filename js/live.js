// The session in progress, saved at every step so it survives iOS closing the app.
// Kept apart from the main save: it is written often and thrown away when the session ends.
// The player writes it (js/screens/player.js), and resumeIfAny() there reads it at start-up.

const KEY = 'crease.live';
export const VERSION = 1;
export const MAX_AGE = 2 * 3600 * 1000; // older than this, it isn't picked up again

export function keep(state) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, v: VERSION, savedAt: Date.now() })); } catch {}
}

export function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && typeof s === 'object' ? s : null;
  } catch {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Saved by this version, and touched less than two hours ago.
export function fresh(s, now = Date.now()) {
  return !!s && s.v === VERSION && typeof s.savedAt === 'number' && now - s.savedAt >= 0 && now - s.savedAt < MAX_AGE;
}
