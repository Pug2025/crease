// Crease checks. Run: node tests.mjs  (deploy.sh refuses to publish if any fail)
import fs from 'node:fs';
import { DRILLS, byId } from './data/exercises.js';
import { SESSIONS, SESSION_ORDER } from './data/sessions.js';
import { DEMOS } from './data/demos.js';
import { buildSession, makeContext, phrasesOf } from './js/plan/build.js';

let failed = 0;
let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('FAIL', msg); } };

// 1. The drill file is complete and consistent.
const ids = new Set();
for (const d of DRILLS) {
  ok(!ids.has(d.id), `${d.id}: id used twice`);
  ids.add(d.id);
  for (const f of ['name', 'group', 'noise', 'space', 'why', 'mistake', 'dose'])
    ok(d[f] !== undefined && d[f] !== '', `${d.id}: missing ${f}`);
  ok(['quiet', 'thud', 'loud'].includes(d.noise), `${d.id}: noise must be quiet, thud or loud`);
  ok(['small', 'big'].includes(d.space), `${d.id}: space must be small or big`);
  ok(Array.isArray(d.cues) && d.cues.length >= 2 && d.cues.length <= 3, `${d.id}: needs 2 or 3 cues`);
  ok(Array.isArray(d.versions) && d.versions.length >= 1, `${d.id}: needs versions`);
  ok(d.start >= 0 && d.start < d.versions.length, `${d.id}: start points at a version that doesn't exist`);
  ok(['time', 'reps'].includes(d.dose.type), `${d.id}: dose type must be time or reps`);
  if (d.dose.type === 'reps') ok(d.dose.reps > 0 && d.dose.window > 0, `${d.id}: reps dose needs reps and window`);
  if (d.dose.type === 'time') ok(d.dose.time > 0, `${d.id}: time dose needs time`);
  if (d.side) ok(['leg', 'side', 'way'].includes(d.side), `${d.id}: side must be leg, side or way`);
  if (typeof d.quiet === 'string') ok(byId[d.quiet], `${d.id}: quiet swap ${d.quiet} doesn't exist`);
  if (typeof d.quiet === 'number') ok(d.versions[d.quiet], `${d.id}: quiet version ${d.quiet} doesn't exist`);
  if (d.noBand) ok(byId[d.noBand], `${d.id}: noBand swap doesn't exist`);
  if (d.noise !== 'quiet' && d.versions[d.start].noise !== 'quiet') ok(d.quiet !== undefined, `${d.id}: loud drill with no quiet version`);
  if (d.space === 'big') ok(d.quiet !== undefined, `${d.id}: big-space drill with no bedroom version`);
  for (const c of d.cues) ok(c.length <= 70, `${d.id}: cue too long for one breath: "${c}"`);
}
for (const id of Object.keys(DEMOS)) ok(byId[id], `demos.js: ${id} isn't a drill`);

// 2. Sessions point at real drills.
for (const [type, s] of Object.entries(SESSIONS))
  for (const b of s.blocks) for (const it of b.items) ok(byId[it.id], `${type}: ${it.id} doesn't exist`);

// 3. Every way a session can be built is safe and the right length.
const LIMITS = { mobility: [17, 24], power: [18, 25], gameday: [5, 11] };
const draws = new Set();
const allPhrases = new Set();
for (const type of SESSION_ORDER)
  for (const room of ['bedroom', 'big'])
    for (const hour of [7, 15])
      for (const ball of ['dead', 'bouncy', 'none'])
        for (const band of [true, false])
          for (const feel of ['good', 'tired']) {
            const ctx = makeContext({ room, hour, ball, band, feel });
            const s = buildSession(type, ctx);
            const tag = `${type}/${room}/${hour}h/${ball}/${band ? 'band' : 'noband'}/${feel}`;
            const min = s.total / 60;
            const [lo, hi] = LIMITS[type];
            if (feel === 'good') ok(min >= lo && min <= hi, `${tag}: ${min.toFixed(1)} min, expected ${lo}-${hi}`);
            else ok(min <= hi, `${tag}: tired version longer than the cap`);
            ok(s.jumps <= 40, `${tag}: ${s.jumps} jumps, cap is 40`);
            for (const it of s.items) {
              draws.add(it.draw);
              const noise = it.variant ? 'quiet' : it.version.noise ?? it.drill.noise;
              if (ctx.quiet) ok(noise === 'quiet', `${tag}: ${it.name} is ${noise} in quiet mode`);
              if (ctx.small) ok((it.version.space ?? it.drill.space) === 'small' || it.variant, `${tag}: ${it.name} needs a big room`);
              if (it.drill.slam) ok(ball === 'dead' && !ctx.quiet && !ctx.small, `${tag}: slams with a ${ball} ball`);
              if (it.drill.needs?.includes('band')) ok(band, `${tag}: band drill with no band`);
              if (ball === 'none' && it.drill.needs?.includes('med ball')) ok(!/ball/i.test(it.version.how || '') || /no ball|pillow/i.test(it.version.how), `${tag}: ${it.name} needs a ball`);
            }
            // Steps tile the timeline with no gaps.
            let t = 0;
            for (const st of s.steps) { ok(Math.abs(st.start - t) < 1e-9, `${tag}: gap at step ${st.i}`); t += st.dur; }
            ok(s.steps.at(-1).kind === 'end', `${tag}: last step isn't the end`);
            phrasesOf(s).forEach((p) => allPhrases.add(p));
          }

// 4. Power never runs before a game: the template asks first.
ok(SESSIONS.power.checkGameTomorrow === true, 'power: must ask "Game tomorrow?"');

// 5. Every drawing and every voice line exists.
for (const f of draws) ok(fs.existsSync(f), `missing drawing ${f}`);
let clips = {};
try { clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8')); } catch { ok(false, 'audio/clips.json missing: run node tools/make-voice.mjs'); }
for (const p of allPhrases) ok(clips[p] && fs.existsSync(`audio/${clips[p]}`), `no voice clip for "${p}"`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
