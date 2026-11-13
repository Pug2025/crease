// Confetti for the big wins: a new mask, a new card tier, a Boss beaten, a new best.
// Uses canvas-confetti (js/vendor/confetti.mjs, ISC licence), loaded only when first needed.
// It never throws and does nothing when the phone is set to reduce motion, or outside a browser.
const COLOURS = ['#2D7CC1', '#6BB4E6', '#F2C230', '#D21F2E', '#FFFFFF'];

let lib = null;

export function wantsMotion() {
  try { return typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// big: a mask, a tier or a Boss. Otherwise a smaller burst for a new best.
export async function celebrate({ big = false } = {}) {
  if (!wantsMotion()) return false;
  try {
    if (!lib) {
      // Our own canvas on the main thread: the library's worker mode throws on resize in some browsers.
      const { create } = await import('./vendor/confetti.mjs');
      const canvas = document.createElement('canvas');
      canvas.className = 'confetti';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
      document.body.appendChild(canvas);
      lib = create(canvas, { resize: true, useWorker: false });
    }
    const base = { colors: COLOURS, disableForReducedMotion: true, ticks: 160, zIndex: 50 };
    if (big) {
      lib({ ...base, particleCount: 70, spread: 60, angle: 60, origin: { x: 0, y: 0.7 } });
      lib({ ...base, particleCount: 70, spread: 60, angle: 120, origin: { x: 1, y: 0.7 } });
    } else {
      lib({ ...base, particleCount: 45, spread: 70, origin: { x: 0.5, y: 0.6 } });
    }
    return true;
  } catch { return false; }
}
