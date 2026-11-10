// Records every line Crease can say as a short voice clip, with OpenAI's voice model.
// Run from the Crease folder: node tools/make-voice.mjs   (needs OPENAI_API_KEY in the environment
// for the run; the key is never written to any file)
// Writes audio/<hash>.m4a and audio/clips.json ({ "phrase": "file" }). Existing clips are kept.
// Each new clip is levelled (tools/loudness.mjs) straight from the recording, and its loudness and
// spoken length go in audio/levels.json.
//
// There is no other voice. If the voice model can't be reached, nothing is recorded: Dad threw out
// the Mac's voice, and the app never falls back to the iPhone's.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SAY } from '../data/copy.js';
import { buildSession, everyContext, phrasesOf } from '../js/plan/build.js';
import { finishClip, readLevels, writeLevels } from './loudness.mjs';

const VOICE = process.env.CREASE_VOICE || 'cedar';
const MODEL = process.env.CREASE_TTS_MODEL || 'gpt-4o-mini-tts';
const COACH =
  'You are a youth hockey goalie coach in your thirties, from Canada, talking an 11-year-old goalie through a workout at home. ' +
  'Calm, confident and warm. Plain and direct, like a real coach at practice. Short lines, natural pace, a little lift on "Go". ' +
  'Never cheesy, never a narrator or announcer, never over-excited.';
const outDir = path.resolve('audio');
fs.mkdirSync(outDir, { recursive: true });

// Every line any session can say, in every way it can be built.
const phrases = new Set([SAY.soundCheck, SAY.sessionDone]);
for (const { type, ctx } of everyContext()) phrasesOf(buildSession(type, ctx)).forEach((p) => phrases.add(p));

// How a line should sound, where the written form would be read oddly.
const spoken = (p) => p.replace(/90\/90/g, 'ninety ninety').replace(/&/g, 'and').replace(/\bT-Push\b/g, 'T push');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crease-voice-'));

// One request per line, saved as WAV, then levelled and turned into AAC.
async function record(text, dest, n) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, instructions: COACH, response_format: 'wav' }),
      });
      if (!res.ok) {
        const msg = (await res.text()).slice(0, 300);
        if (res.status === 401 || res.status === 403 || res.status === 404) throw Object.assign(new Error(msg), { fatal: true });
        throw new Error(`${res.status} ${msg}`);
      }
      const wav = path.join(tmp, `clip${n}.wav`);
      fs.writeFileSync(wav, Buffer.from(await res.arrayBuffer()));
      const level = finishClip(wav, dest);
      fs.unlinkSync(wav);
      return level;
    } catch (e) {
      if (e.fatal) throw e;
      if (attempt === 2) { console.error(`could not record "${text}": ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

const key = (p) => `openai|${MODEL}|${VOICE}|${COACH}|${spoken(p)}`;
const clips = {};
for (const p of phrases) clips[p] = `${createHash('sha1').update(key(p)).digest('hex').slice(0, 12)}.m4a`;
const missing = [...phrases].sort().filter((p) => !fs.existsSync(path.join(outDir, clips[p])));

// CREASE_SAMPLE="some line" records just that one line to qa/voice-sample.m4a, as a cheap test.
if (process.env.CREASE_SAMPLE) {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is not set for this run.'); process.exit(1); }
  fs.mkdirSync('qa', { recursive: true });
  let level = null;
  try { level = await record(process.env.CREASE_SAMPLE, 'qa/voice-sample.m4a', 0); } catch (e) { console.error(`voice model refused: ${e.message}`); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(level ? `sample written to qa/voice-sample.m4a (${level.lufs} LUFS, peak ${level.peak} dBFS, ${level.len} s)` : 'sample failed');
  process.exit(level ? 0 : 1);
}

if (missing.length && !process.env.OPENAI_API_KEY) {
  console.error(`${missing.length} lines need recording and OPENAI_API_KEY is not set for this run.`);
  process.exit(1);
}

const levels = readLevels();
let made = 0;
const failed = [];
// Six requests at a time.
let next = 0;
try {
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < missing.length) {
      const n = next++;
      const p = missing[n];
      const level = await record(spoken(p), path.join(outDir, clips[p]), n);
      if (level) { levels[clips[p]] = level; made++; } else failed.push(p);
    }
  }));
} catch (e) {
  console.error(`voice model refused, nothing more recorded: ${e.message}`);
  next = missing.length;
  missing.forEach((p) => { if (!levels[clips[p]] || !fs.existsSync(path.join(outDir, clips[p]))) failed.push(p); });
}
fs.rmSync(tmp, { recursive: true, force: true });
[...new Set(failed)].forEach((p) => delete clips[p]);

// Remove clips nothing uses any more.
const keep = new Set(Object.values(clips));
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.m4a') && !keep.has(f)) fs.unlinkSync(path.join(outDir, f));
for (const f of Object.keys(levels)) if (!keep.has(f)) delete levels[f];

fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify(clips, null, 1));
writeLevels(levels);
console.log(`${Object.keys(clips).length} lines, ${made} new clips, ${new Set(failed).size} failed, voice openai/${VOICE}`);
if (failed.length) process.exit(1);
