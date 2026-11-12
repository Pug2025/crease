// His goalie card: Overall, tier, the five ratings, his streak, and the mask shelf.
// He sets his name and number by tapping them. They live only in save.card on the phone.
import { esc, on } from '../ui.js';
import { cardStats, maskState } from '../plan/card.js';
import { seasonStats, maskImg } from './home.js';

export const NAME_MAX = 12;

// Cleans what he typed. Name: letters (and a space, hyphen or apostrophe), 12 at most. Number: 0 to 99.
export function cleanName(v) {
  return String(v ?? '').replace(/[^\p{L} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}
export function cleanNumber(v) {
  const t = String(v ?? '').replace(/\D/g, '').slice(0, 2);
  return t === '' ? '' : String(Number(t));
}

const unlockText = (m) => `${m.streak}-day streak`;

export function shelfHtml(masks) {
  return masks.list.map((m) => {
    const on = m.id === masks.wearing.id;
    if (!m.unlocked) {
      return `<li class="shelf-item locked" aria-label="${esc(m.name)}: locked, ${esc(unlockText(m))}">
        <span class="shelf-pic">${maskImg(m)}</span>
        <span class="shelf-name">${esc(m.name)}</span>
        <span class="shelf-need">${esc(unlockText(m))}</span></li>`;
    }
    return `<li class="shelf-item"><button class="shelf-btn" data-act="wear" data-arg="${m.id}" aria-pressed="${on}">
      <span class="shelf-pic">${maskImg(m)}</span>
      <span class="shelf-name">${esc(m.name)}</span>
      <span class="shelf-need">${on ? 'Wearing' : 'Wear'}</span></button></li>`;
  }).join('');
}

export function cardHtml(card, masks, info, edit = false) {
  const st = card.streak;
  const name = info.name || '';
  const num = info.number ?? '';
  const ident = edit ? `
      <form class="gc-edit" data-form="who">
        <label><span>No.</span><input id="gc-num" name="number" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(num)}" autocomplete="off"></label>
        <label><span>Name</span><input id="gc-name" name="name" maxlength="${NAME_MAX}" value="${esc(name)}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
        <button class="btn btn-primary gc-save" data-act="saveWho">Save</button>
      </form>` : `
      <button class="gc-who" data-act="edit" aria-label="Number and name. Tap to change.">
        <span class="gc-num${num === '' ? ' empty' : ''}">${num === '' ? '#' : `#${esc(num)}`}</span>
        <span class="gc-name${name ? '' : ' empty'}">${name ? esc(name) : 'Your name'}</span>
      </button>`;
  return `
  <article class="gcard tier-${card.tierId}" aria-label="Goalie card">
    <div class="gc-top">
      <div class="gc-ovr"><b>${card.overall}</b><span>${esc(card.tier)}</span></div>
      <div class="gc-mask">${maskImg(masks.wearing)}</div>
      <div class="gc-pos" aria-label="Position: goalie">G</div>
    </div>
    <div class="gc-id">${ident}</div>
    <ul class="gc-ratings">${card.ratings.map((r) => `
      <li><span class="gc-label">${esc(r.label)}</span>
        <span class="gc-bar" aria-hidden="true"><i style="width:${Math.round(((r.value - 50) / 49) * 100)}%"></i></span>
        <b class="gc-val">${r.value}</b></li>`).join('')}
    </ul>
    <dl class="gc-foot">
      <div><dt>Streak</dt><dd>${st.days}</dd></div>
      <div><dt>Best</dt><dd>${st.best}</dd></div>
      <div><dt>Sessions</dt><dd>${info.season}</dd></div>
    </dl>
  </article>
  ${card.nextTier ? `<p class="small center">${esc(card.nextTier.name)} at ${card.nextTier.at}.</p>` : ''}`;
}

export function render(root, app, { edit = false } = {}) {
  const s = app.save;
  const now = new Date();
  s.card = s.card || {};
  const card = cardStats(s, now);
  const masks = maskState(s, now, card.streak.best);
  const season = seasonStats(s.log, now).sessions;

  root.innerHTML = `
  <main class="screen card-screen">
    <button class="back" data-act="back">Back</button>
    ${cardHtml(card, masks, { name: s.card.name, number: s.card.number, season }, edit)}
    <section class="shelf">
      <h2>Masks</h2>
      <ul class="shelf-list">${shelfHtml(masks)}</ul>
    </section>
  </main>`;

  const form = root.querySelector('.gc-edit');
  const saveWho = () => {
    const n = cleanName(root.querySelector('#gc-name').value);
    const k = cleanNumber(root.querySelector('#gc-num').value);
    s.card = { ...s.card, name: n || undefined, number: k === '' ? undefined : Number(k) };
    if (!n) delete s.card.name;
    if (k === '') delete s.card.number;
    app.persist();
    render(root, app);
  };
  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); saveWho(); });
    root.querySelector('#gc-num').addEventListener('input', (e) => { e.target.value = cleanNumber(e.target.value); });
    const nameIn = root.querySelector('#gc-name');
    nameIn.addEventListener('input', (e) => { const c = e.target.value.replace(/[^\p{L} '\-]/gu, '').slice(0, NAME_MAX); if (c !== e.target.value) e.target.value = c; });
    (s.card.number === undefined ? root.querySelector('#gc-num') : nameIn).focus();
  }
  on(root, {
    back: () => app.go('home'),
    edit: () => render(root, app, { edit: true }),
    saveWho,
    wear: (id) => {
      if (!masks.list.find((m) => m.id === id)?.unlocked) return;
      s.card = { ...s.card, mask: id };
      app.persist();
      render(root, app);
    },
  });
}
