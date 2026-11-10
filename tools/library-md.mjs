// Writes the drill library as Markdown, in the format PLAN.md section 1.3 uses.
// Run from the Crease folder: node tools/library-md.mjs > out.md
import { DRILLS } from '../data/exercises.js';
import { targetText } from '../data/copy.js';

const GROUPS = [
  ['warm-up', 'Warm-up'],
  ['strength', 'Strength'],
  ['power', 'Power'],
  ['stretch', 'Stretch'],
];

const tags = (d) => {
  const t = [d.noise, d.space];
  if (d.needs?.length) t.push(d.needs.join(', '));
  if (d.jumps) t.push(`${d.jumps} jumps a set`);
  return t.join(' · ');
};

const swapLine = (d, field, label) => {
  const to = d[field];
  if (to === undefined) return null;
  if (typeof to === 'string') return `${label}: ${DRILLS.find((x) => x.id === to).name}.`;
  if (typeof to === 'number') return `${label}: ${d.versions[to].title || `the ${d.versions[to].name} version`}.`;
  return `${label}: ${to.name} (${to.how.replace(/\.$/, '')}).`;
};
const quietLine = (d) => [swapLine(d, 'bedroom', d.slam ? 'Bedroom and before 9 am' : 'Bedroom'), swapLine(d, 'noJump', 'Jumps off')].filter(Boolean).join(' ') || null;

const out = [];
for (const [g, title] of GROUPS) {
  out.push(`#### ${title}`, '');
  for (const d of DRILLS.filter((x) => x.group === g)) {
    const v = d.versions;
    const easier = v.find((x) => x.name === 'Easier');
    const harder = v.find((x) => x.name === 'Harder');
    const dose = { sets: 1, ...d.dose, ...(v[d.start].dose || {}) };
    let target = targetText(d, dose);
    if (dose.sets > 1) target += `, ${dose.sets} sets`;
    out.push(`**${d.id} ${d.name}** · ${tags(d)}`);
    out.push(`- Why: ${d.why}`);
    out.push(`- Cues: ${d.cues.join(' ')}`);
    out.push(`- Mistake: ${d.mistake}`);
    const eh = [easier && `Easier: ${easier.how}`, harder && `Harder: ${harder.how}`].filter(Boolean).join(' ');
    if (eh) out.push(`- ${eh}`);
    const extra = [quietLine(d), d.slam ? 'Only with a ball that doesn\'t bounce.' : null].filter(Boolean).join(' ');
    out.push(`- Target: ${target}.${extra ? ` ${extra}` : ''}`);
    out.push('');
  }
}
process.stdout.write(out.join('\n'));
