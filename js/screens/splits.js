// The splits ladder: where he is, what's next, and a 3-minute session to do today's hold.
// The ladder is also added to every normal session, so this screen is for a rest day.
import { esc, on } from '../ui.js';
import { LADDER, TOP, SPLITS_COPY as C } from '../../data/splits.js';
import { byId } from '../../data/exercises.js';
import { splitsState, settleSplits } from '../plan/splits.js';

// One row per rung: done, where he is now, or still ahead.
export function rungRows(st) {
  return LADDER.map((r) => {
    const state = r.n < st.rung ? 'done' : r.n === st.rung ? 'now' : 'ahead';
    const dots = r.n === st.rung
      ? `<span class="sp-dots" aria-label="${st.holds} of ${st.need} holds">${
        Array.from({ length: st.need }, (_, k) => `<i${k < st.holds ? ' class="on"' : ''}></i>`).join('')}</span>`
      : '';
    return `<li class="sp-rung ${state}${r.watch ? ' watch' : ''}">
      <span class="sp-n">${r.n}</span>
      <span class="sp-what"><span class="sp-name">${esc(r.name)}</span>${
        r.watch ? '<span class="sp-tag">Dad watches</span>' : ''}</span>
      ${dots}</li>`;
  }).join('');
}

export function render(root, app) {
  const s = app.save;
  const now = new Date();
  if (settleSplits(s, now)) app.persist();
  const st = splitsState(s, now);
  const drill = byId[st.r.id];

  const status = st.top
      ? `<p class="sp-status top">${esc(C.topped)}</p>`
      : st.waiting
        ? `<p class="sp-status waiting">${esc(C.waiting)} ${esc(C.watchHim)}</p>`
        : `<p class="sp-status">${st.holds} of ${st.need} holds on this rung.</p>`;

  root.innerHTML = `
  <main class="screen splits">
    <button class="back" data-act="back">Back</button>
    <p class="kicker">Rung ${st.rung} of ${TOP}</p>
    <h1>${esc(C.title)}</h1>
    <section class="sp-now">
      <img class="sp-draw" src="media/draw/${esc(st.r.id)}.webp" alt="">
      <div class="sp-now-text">
        <h2>${esc(st.r.name)}</h2>
        ${st.r.how ? `<p class="sp-how">${esc(st.r.how)}</p>` : ''}
        <p class="sp-dose">Hold ${drill.dose.time} s</p>
      </div>
    </section>
    ${status}
    <button class="btn btn-go" data-act="start">Do today's hold</button>
    <p class="small center">Warm up first, then the hold. About 3 minutes.</p>
    <ol class="sp-ladder">${rungRows(st)}</ol>
    <section class="sp-note">
      <p>${esc(C.why)}</p>
      <p><b>${esc(C.slow)}</b> ${esc(C.growth)}</p>
      <ul class="sp-rules">${C.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="small">${esc(C.lead)}</p>
    </section>
  </main>`;

  on(root, {
    back: () => app.go('home'),
    start: () => app.go('preview', {
      type: 'splits',
      reason: `${st.r.name}. ${st.left} more ${st.left === 1 ? 'hold' : 'holds'} to the next rung.`,
      extra: true,
    }),
  });
}
