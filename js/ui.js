// Small helpers shared by the screens.
import { maskSrc } from '../data/masks.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Countdown: "45", "7", "1:05". No leading zeros.
export function clock(sec) {
  const s = Math.max(0, Math.ceil(sec - 0.001));
  if (s < 60) return String(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Time left in the whole session: always m:ss.
export function mmss(sec) {
  const s = Math.max(0, Math.ceil(sec - 0.001));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const minutes = (sec) => Math.max(1, Math.round(sec / 60));

// A quick double tap: the first tap redraws the screen, and iOS delivers the second one to
// whatever button is now under his finger (touch-action: manipulation lets both through).
// So any tap within this long of the last one that did something is ignored, on every screen.
// One timestamp for the whole app, because the second tap usually lands on the next screen.
export const TAP_GUARD_MS = 350;
let lastTap = -Infinity;

// One click handler per screen: any element with data-act="name" calls handlers.name(arg, el).
export function on(root, handlers) {
  root.onclick = (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.disabled) return;
    const fn = handlers[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap < TAP_GUARD_MS) return;
    lastTap = now;
    fn(el.dataset.arg, el, e);
  };
}

export const CREASE_MARK = `<svg class="mark" viewBox="0 0 120 64" aria-hidden="true"><path d="M12 58 A48 48 0 0 1 108 58 Z" fill="#6CB4E4" stroke="#D21F2E" stroke-width="5" stroke-linejoin="round"/><line x1="0" y1="58" x2="120" y2="58" stroke="#D21F2E" stroke-width="5"/></svg>`;

export const today = () =>
  new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

// A mask picture. If the file isn't there yet, the empty frame shows instead of a broken image.
export const maskImg = (m, cls = '') => `<img class="mask-img${cls ? ` ${cls}` : ''}" src="${esc(maskSrc(m.id))}" alt="" onerror="this.hidden=true">`;

// − and +: one a tap, and they keep going while held down. Not through on(): its double-tap
// guard would drop quick taps here, and these never change the screen.
export function stepper(box, get, set) {
  let wait = null;
  let rep = null;
  const stop = () => { clearTimeout(wait); clearInterval(rep); wait = rep = null; };
  for (const b of box.querySelectorAll('[data-step]')) {
    const d = Number(b.dataset.step);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
      set(get() + d);
      wait = setTimeout(() => { rep = setInterval(() => set(get() + d), 90); }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    b.addEventListener('click', (e) => { if (e.detail === 0) set(get() + d); }); // keyboard
  }
  return stop;
}
