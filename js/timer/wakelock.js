// Keeps the screen on during a session. Works in Home Screen apps from iOS 18.4.
// iOS drops the lock whenever the app is hidden, so the player asks again when it comes back.

let lock = null;

export async function keepAwake() {
  try {
    if (!('wakeLock' in navigator)) return false;
    if (lock) return true;
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
    return true;
  } catch {
    lock = null;
    return false;
  }
}

export function letSleep() {
  try { lock?.release(); } catch {}
  lock = null;
}

export const awake = () => !!lock;
