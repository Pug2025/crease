// A drill's card: drawing, why, cues, the common mistake, versions, demo video.
import { esc, on } from '../ui.js';
import { DEMOS, demoUrl } from '../../data/demos.js';

export function render(root, app, { item, back }) {
  const d = item.drill;
  const demos = DEMOS[d.id] || [];
  const versions = d.versions.map((v, k) => `
    <li class="${k === item.v ? 'current' : ''}">
      <span class="v-mark" aria-hidden="true">${k === item.v ? '●' : '○'}</span>
      <span><span class="v-name">${esc(v.name)}${k === item.v ? ' <small>what you do now</small>' : ''}</span>
      ${v.how ? `<span class="v-how">${esc(v.how)}</span>` : ''}</span>
    </li>`).join('');

  root.innerHTML = `
  <main class="screen drill">
    <button class="back" data-act="back">Back</button>
    <div class="board"><img src="${esc(item.draw)}" alt="Drawing of ${esc(item.name)}"></div>
    <p class="kicker">${esc(item.target)}${item.sets > 1 ? ` · ${item.circuit ? `${item.sets} rounds` : `${item.sets} sets`}` : ''}</p>
    <h1>${esc(item.name)}</h1>
    ${item.how || item.note ? `<p class="how">${esc(item.how || item.note)}</p>` : ''}
    <p class="lead">${esc(d.why)}</p>
    <h2>How</h2>
    <ul class="cues">${d.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <h2>Watch out for</h2>
    <p>${esc(d.mistake)}</p>
    ${demos.length ? `<h2>Watch a demo</h2><ul class="demos">${demos.map((x) => `
      <li><a class="demo" href="${esc(demoUrl(x))}" target="_blank" rel="noopener">
        <span>${esc(x.label || 'Video')}<small>${esc(x.from)}</small></span>
        ${x.note ? `<span class="demo-note">${esc(x.note)}</span>` : ''}
      </a></li>`).join('')}</ul><p class="small">Videos need the internet. The drawing works without it.</p>` : ''}
    <h2>Versions</h2>
    <ul class="versions">${versions}</ul>
    ${d.versions.length > 1 ? '<p class="small">Dad moves you up or down from his screen once he\'s watched you.</p>' : ''}
    ${item.swappedFrom ? `<p class="small">In place of ${esc(item.swappedFrom.name)} today.</p>` : ''}
  </main>`;
  on(root, { back: () => app.go(...back) });
}
