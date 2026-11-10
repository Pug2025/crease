// Records every line Crease can say as a short voice clip.
// Run from the Crease folder: node tools/make-voice.mjs
// Writes audio/<hash>.m4a and audio/clips.json ({ "phrase": "file" }). Existing clips are kept.
//
// Two engines. The default is OpenAI's voice model (needs OPENAI_API_KEY in the environment for the
// run; the key is never written to any file). CREASE_ENGINE=mac uses the Mac's built-in `say` voice.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_ORDER } from '../data/sessions.js';
import { SAY } from '../data/copy.js';
import { buildSession, makeContext, phrasesOf } from '../js/plan/build.js';

const ENGINE = process.env.CREASE_ENGINE || 'openai';
const VOICE = process.env.CREASE_VOICE || (ENGINE === 'openai' ? 'cedar' : 'Samantha');
const RATE = '172';
const MODEL = process.env.CREASE_TTS_MODEL || 'gpt-4o-mini-tts';
const COACH =
  'You are a youth hockey goalie coach in your thirties, from Canada, talking an 11-year-old goalie through a workout at home. ' +
  'Calm, confident and warm. Plain and direct, like a real coach at practice. Short lines, natural pace, a little lift on "Go". ' +
  'Never cheesy, never a narrator or announcer, never over-excited.';
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crease-voice-'));

// A Mac clip: `say` occasionally hangs, so each line gets 15 seconds and two more tries.
function recordMac(text, dest, n) {
  const aiff = path.join(tmp, `clip${n}.aiff`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, text], { timeout: 15000, killSignal: 'SIGKILL' });
      if (fs.existsSync(aiff) && fs.statSync(aiff).size > 1000) break;
    } catch { /* try again */ }
  }
  if (!fs.existsSync(aiff)) return false;
  execFileSync('afconvert', [aiff, dest, '-f', 'm4af', '-d', 'aac', '-b', '48000']);
  fs.unlinkSync(aiff);
  return true;
}

// An OpenAI clip: one request per line, saved as WAV, then turned into AAC like the Mac clips.
async function recordOpenAI(text, dest, n) {
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
      execFileSync('afconvert', [wav, dest, '-f', 'm4af', '-d', 'aac', '-b', '64000']);
      fs.unlinkSync(wav);
      return true;
    } catch (e) {
      if (e.fatal) throw e;
      if (attempt === 2) { console.error(`could not record "${text}": ${e.message}`); return false; }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return false;
}

const key = (p) => (ENGINE === 'openai' ? `openai|${MODEL}|${VOICE}|${COACH}|${spoken(p)}` : `${VOICE}|${RATE}|${spoken(p)}`);
const clips = {};
for (const p of phrases) clips[p] = `${createHash('sha1').update(key(p)).digest('hex').slice(0, 12)}.m4a`;
const missing = [...phrases].sort().filter((p) => !fs.existsSync(path.join(outDir, clips[p])));

// CREASE_SAMPLE="some line" records just that one line to qa/voice-sample.m4a, as a cheap test.
if (process.env.CREASE_SAMPLE) {
  missing.length = 0;
  fs.mkdirSync('qa', { recursive: true });
  const ok = ENGINE === 'openai' ? await recordOpenAI(process.env.CREASE_SAMPLE, 'qa/voice-sample.m4a', 0) : recordMac(process.env.CREASE_SAMPLE, 'qa/voice-sample.m4a', 0);
  console.log(ok ? 'sample written to qa/voice-sample.m4a' : 'sample failed');
  process.exit(ok ? 0 : 1);
}

if (missing.length && ENGINE === 'openai' && !process.env.OPENAI_API_KEY) {
  console.error(`${missing.length} lines need recording and OPENAI_API_KEY is not set. Set it for this run, or use CREASE_ENGINE=mac.`);
  process.exit(1);
}

let made = 0;
const failed = [];
if (ENGINE === 'openai') {
  // Six requests at a time.
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < missing.length) {
      const n = next++;
      const p = missing[n];
      if (await recordOpenAI(spoken(p), path.join(outDir, clips[p]), n)) made++; else failed.push(p);
    }
  }));
} else {
  missing.forEach((p, n) => { if (recordMac(spoken(p), path.join(outDir, clips[p]), n)) made++; else failed.push(p); });
}
fs.rmSync(tmp, { recursive: true, force: true });
failed.forEach((p) => delete clips[p]);

// Remove clips nothing uses any more.
const keep = new Set(Object.values(clips));
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.m4a') && !keep.has(f)) fs.unlinkSync(path.join(outDir, f));

fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify(clips, null, 1));
console.log(`${Object.keys(clips).length} lines, ${made} new clips, ${failed.length} failed, voice ${ENGINE}/${VOICE}`);
if (failed.length) process.exit(1);
