// Keeps the screen on during a session. Works in Home Screen apps from iOS 18.4.
// iOS drops the lock whenever the app is hidden, so the player asks again when it comes back.
// keepAwake() says whether it worked, so the player can warn him when the phone refuses.

let lock = null;
let asking = null;
let lost = null;

async function ask() {
  try {
    if (!('wakeLock' in navigator)) return false;
    const l = await navigator.wakeLock.request('screen');
    lock = l;
    l.addEventListener('release', () => {
      if (lock !== l) return; // let go on purpose
      lock = null;
      // Dropped while the app is still on screen (Low Power Mode can do this): tell the player.
      if (!document.hidden) lost?.();
    });
    return true;
  } catch {
    lock = null;
    return false;
  }
}

export function keepAwake() {
  if (lock) return Promise.resolve(true);
  if (!asking) asking = ask().finally(() => { asking = null; });
  return asking;
}

// fn runs when the phone drops the lock while the app is on screen. null to stop.
export function onLost(fn) { lost = fn; }

export function letSleep() {
  const l = lock;
  lock = null;
  try { l?.release(); } catch {}
}

export const awake = () => !!lock;
