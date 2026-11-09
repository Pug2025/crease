// Records every line Crease can say as a short voice clip, using the Mac's built-in voice.
// Run from the Crease folder: node tools/make-voice.mjs
// Writes audio/<hash>.m4a and audio/clips.json ({ "phrase": "file" }). Existing clips are kept.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_ORDER } from '../data/sessions.js';
import { SAY } from '../data/copy.js';
import { buildSession, makeContext, phrasesOf } from '../js/plan/build.js';

const VOICE = process.env.CREASE_VOICE || 'Samantha';
const RATE = '172';
const outDir = path.resolve('audio');
fs.mkdirSync(outDir, { recursive: true });

// Every context a session can be built in.
const phrases = new Set([SAY.soundCheck, SAY.sessionDone]);
for (const type of SESSION_ORDER)
  for (const room of ['bedroom', 'big'])
    for (const hour of [7, 15])
      for (const feel of ['good', 'tired'])
        for (const ball of ['dead', 'bouncy', 'none'])
          for (const band of [true, false])
            phrasesOf(buildSession(type, makeContext({ room, hour, feel, ball, band }))).forEach((p) => phrases.add(p));

// How a line should sound, where the written form would be read oddly.
const spoken = (p) => p.replace(/90\/90/g, 'ninety ninety').replace(/&/g, 'and').replace(/\bT-Push\b/g, 'T push');

const clips = {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crease-voice-'));
let made = 0;
for (const p of [...phrases].sort()) {
  const file = `${createHash('sha1').update(`${VOICE}|${RATE}|${spoken(p)}`).digest('hex').slice(0, 12)}.m4a`;
  clips[p] = file;
  const dest = path.join(outDir, file);
  if (fs.existsSync(dest)) continue;
  const aiff = path.join(tmp, `clip${made}.aiff`);
  // `say` occasionally hangs; give each line 15 seconds and two more tries.
  let recorded = false;
  for (let attempt = 0; attempt < 3 && !recorded; attempt++) {
    try {
      execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, spoken(p)], { timeout: 15000, killSignal: 'SIGKILL' });
      recorded = fs.existsSync(aiff) && fs.statSync(aiff).size > 1000;
    } catch { /* try again */ }
  }
  if (!recorded) { console.error(`could not record: ${p}`); delete clips[p]; continue; }
  execFileSync('afconvert', [aiff, dest, '-f', 'm4af', '-d', 'aac', '-b', '48000']);
  fs.unlinkSync(aiff);
  made++;
}
fs.rmSync(tmp, { recursive: true, force: true });

// Remove clips nothing uses any more.
const keep = new Set(Object.values(clips));
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.m4a') && !keep.has(f)) fs.unlinkSync(path.join(outDir, f));

fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify(clips, null, 1));
console.log(`${Object.keys(clips).length} lines, ${made} new clips, voice ${VOICE}`);
