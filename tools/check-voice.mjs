// Flags voice clips whose length doesn't fit their words (extra words, long silences, cut-offs).
// Run from the Crease folder: node tools/check-voice.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8'));
const rows = Object.entries(clips).map(([p, f]) => {
  const out = execFileSync('afinfo', [`audio/${f}`]).toString();
  const secs = parseFloat(/estimated duration: ([\d.]+)/.exec(out)?.[1] || '0');
  const words = p.split(/\s+/).filter(Boolean).length;
  return { p, secs, words, perWord: secs / words };
});
const odd = rows.filter((r) => r.secs < 0.3 || r.perWord > 1.1 || (r.words >= 4 && r.perWord < 0.18));
console.log(`${rows.length} clips, ${rows.reduce((s, r) => s + r.secs, 0).toFixed(0)} s in all`);
for (const r of odd) console.log(`CHECK ${r.secs.toFixed(1)} s, ${r.words} words: ${r.p}`);
