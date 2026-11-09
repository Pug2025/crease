// Small helpers shared by the screens.

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

// One click handler per screen: any element with data-act="name" calls handlers.name(arg, el).
export function on(root, handlers) {
  root.onclick = (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.disabled) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset.arg, el, e); }
  };
}

export const CREASE_MARK = `<svg class="mark" viewBox="0 0 120 64" aria-hidden="true"><path d="M12 58 A48 48 0 0 1 108 58 Z" fill="#6CB4E4" stroke="#D21F2E" stroke-width="5" stroke-linejoin="round"/><line x1="0" y1="58" x2="120" y2="58" stroke="#D21F2E" stroke-width="5"/></svg>`;

export function stopRuleHtml(rule) {
  return `<div class="stop-rule"><p>${esc(rule.title)}</p><ul>${rule.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
}

export const today = () =>
  new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
