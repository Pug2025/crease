// Brings every voice clip to the same loudness: -16 LUFS (Apple's level for speech) behind a
// limiter, so no clip peaks above -1 dBFS. Same file names, same format (AAC, 24 kHz, 64 kbps).
// Run from the Crease folder:
//   node tools/loudness.mjs            level every clip in audio/clips.json not yet in audio/levels.json
//   node tools/loudness.mjs --measure  print the loudness of every clip, change nothing
// make-voice.mjs levels each new clip itself, straight from the recording, before it's saved.
// audio/levels.json keeps each clip's loudness, peak and spoken length (tests.mjs reads the lengths).
// macOS only: decoding and encoding use afconvert.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET = -16; // LUFS
export const CEILING = -1; // dBFS, checked on the saved file
const LEVELS = 'audio/levels.json';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'crease-level-'));
const dB = (x) => 20 * Math.log10(x + 1e-12);

export function readWav(file) {
  const b = fs.readFileSync(file);
  let i = 12;
  let fmt = null;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4);
    const size = b.readUInt32LE(i + 4);
    if (id === 'fmt ') {
      let tag = b.readUInt16LE(i + 8);
      if (tag === 0xfffe) tag = b.readUInt16LE(i + 8 + 24);
      fmt = { tag, ch: b.readUInt16LE(i + 10), rate: b.readUInt32LE(i + 12), bits: b.readUInt16LE(i + 22) };
    }
    if (id === 'data' && fmt) {
      const n = Math.floor(Math.min(size, b.length - i - 8) / (fmt.bits / 8) / fmt.ch);
      const x = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const at = i + 8 + k * fmt.ch * (fmt.bits / 8);
        x[k] = fmt.tag === 3 ? b.readFloatLE(at) : b.readInt16LE(at) / 32768;
      }
      return { x, rate: fmt.rate };
    }
    i += 8 + size + (size & 1);
  }
  throw new Error(`${file}: no audio in this WAV`);
}

export function writeWav(file, x, rate) {
  const b = Buffer.alloc(44 + x.length * 4);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + x.length * 4, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(x.length * 4, 40);
  for (let k = 0; k < x.length; k++) b.writeFloatLE(x[k], 44 + k * 4);
  fs.writeFileSync(file, b);
}

// Any audio file afconvert reads, as samples. rate: resample on the way (null keeps the file's own).
export function decode(file, rate = null) {
  const dir = tmpDir();
  const wav = path.join(dir, 'd.wav');
  try {
    execFileSync('afconvert', [file, wav, '-f', 'WAVE', '-d', rate ? `LEF32@${rate}` : 'LEF32']);
    return readWav(wav);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// BS.1770 K-weighting for any sample rate (the same filter design libebur128 uses).
function kFilters(rate) {
  let K = Math.tan(Math.PI * 1681.974450955533 / rate);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  K = Math.tan(Math.PI * 38.13547087602444 / rate);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const high = { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  return [shelf, high];
}
function biquad(x, { b, a }) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = b[0] * x[n] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[n]; y2 = y1; y1 = v; y[n] = v;
  }
  return y;
}

// The part the app plays: it skips the near-silence at each end (js/timer/audio.js trimmed()).
export function speech(x, rate) {
  let a = 0;
  let b = x.length - 1;
  while (a < b && Math.abs(x[a]) < 0.01) a++;
  while (b > a && Math.abs(x[b]) < 0.01) b--;
  const pad = Math.round(0.03 * rate);
  return x.subarray(Math.max(0, a - pad), Math.min(x.length, b + pad));
}

// Integrated loudness in LUFS of the spoken part: 400 ms blocks, 75% overlap, -70 and -10 LU gates.
export function loudness(x, rate) {
  let y = speech(x, rate);
  for (const f of kFilters(rate)) y = biquad(y, f);
  const blk = Math.round(0.4 * rate);
  const hop = Math.round(0.1 * rate);
  if (y.length < blk) { const z = new Float64Array(blk); z.set(y); y = z; }
  const ms = [];
  for (let s = 0; s + blk <= y.length; s += hop) {
    let sum = 0;
    for (let k = s; k < s + blk; k++) sum += y[k] * y[k];
    ms.push(sum / blk);
  }
  const L = (m) => -0.691 + 10 * Math.log10(m + 1e-20);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const abs = ms.filter((m) => L(m) > -70);
  if (!abs.length) return -99;
  const rel = L(mean(abs)) - 10;
  const kept = abs.filter((m) => L(m) > rel);
  return L(mean(kept));
}

export const peak = (x) => dB(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
export const spokenLength = (x, rate) => speech(x, rate).length / rate;

// Look-ahead peak limiter: gain falls smoothly over 3 ms before a peak and recovers over 80 ms,
// so no sample goes above the ceiling and nothing clicks.
export function limit(x, rate, ceilDb) {
  const c = 10 ** (ceilDb / 20);
  const L = Math.max(1, Math.round(0.003 * rate));
  const n = x.length;
  const need = new Float64Array(n + L);
  need.fill(1);
  for (let i = 0; i < n; i++) need[i] = Math.min(1, c / (Math.abs(x[i]) + 1e-12));
  // Lowest gain needed anywhere in the next L samples, then a moving average over L samples:
  // every average includes the peak's own need, so the result is never above it.
  const lo = new Float64Array(n);
  const dq = [];
  for (let i = n + L - 2; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + L - 1) dq.shift();
    if (i < n) lo[i] = need[dq[0]];
  }
  const rel = Math.exp(-1 / (0.08 * rate));
  const y = new Float64Array(n);
  let sum = L; // the window starts full of gain 1
  let env = 1;
  let minGain = 1;
  for (let i = 0; i < n; i++) {
    sum += lo[i] - (i >= L ? lo[i - L] : 1);
    const s = Math.min(1, sum / L);
    env = s < env ? s : s + (env - s) * rel;
    const g = Math.min(env, need[i]); // a hard stop, for a peak in the first 3 ms
    y[i] = x[i] * g;
    if (g < minGain) minGain = g;
  }
  return { y, reduction: -dB(minGain) };
}

// Gain to the target, then the limiter. Limiting takes a little loudness off, so go round again.
// The limiter never takes more than MAX_LIMIT dB off a peak. A short word ("Plank.", "Go.") reads
// quiet on the 400 ms loudness scale even when its vowel is as loud as any other line, and pushing
// it all the way to -16 would squash it, so it stops a little under the target instead.
export const MAX_LIMIT = 6;
export function level(x, rate, ceilDb = -1.5) {
  const room = ceilDb - peak(x) + MAX_LIMIT;
  let gain = Math.min(room, TARGET - loudness(x, rate));
  let out = null;
  for (let pass = 0; pass < 6; pass++) {
    const g = 10 ** (gain / 20);
    out = limit(x.map((v) => v * g), rate, ceilDb);
    const miss = TARGET - loudness(out.y, rate);
    if (Math.abs(miss) < 0.05 || (miss > 0 && gain >= room)) break;
    gain = Math.min(room, gain + miss);
  }
  return { y: out.y, gain, reduction: out.reduction };
}

// Levels one recording (WAV from the voice model, or an existing clip) into dest, an AAC clip.
// AAC can overshoot a peak a little, so check the saved file and lower the ceiling if needed.
export function finishClip(src, dest) {
  const { x, rate } = decode(src);
  const dir = tmpDir();
  try {
    let ceil = -1.5;
    let r = null;
    let check = null;
    for (let pass = 0; pass < 4; pass++) {
      r = level(x, rate, ceil);
      const wav = path.join(dir, 'l.wav');
      const out = path.join(dir, 'l.m4a');
      writeWav(wav, r.y, rate);
      execFileSync('afconvert', [wav, out, '-f', 'm4af', '-d', 'aac', '-b', '64000']);
      const hi = decode(out, 48000);
      check = { lufs: loudness(hi.x, hi.rate), peak: peak(hi.x) };
      if (check.peak <= CEILING - 0.05) { fs.copyFileSync(out, dest); break; }
      ceil -= check.peak - CEILING + 0.2;
      if (pass === 3) fs.copyFileSync(out, dest);
    }
    const saved = decode(dest);
    const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
    return { lufs: round(check.lufs, 1), peak: round(check.peak, 1), len: round(spokenLength(saved.x, saved.rate), 3), gain: round(r.gain, 1), limited: round(r.reduction, 1) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export function readLevels() {
  try { return JSON.parse(fs.readFileSync(LEVELS, 'utf8')); } catch { return {}; }
}
export function writeLevels(levels) {
  const sorted = Object.fromEntries(Object.keys(levels).sort().map((k) => [k, levels[k]]));
  fs.writeFileSync(LEVELS, JSON.stringify(sorted, null, 1));
}

function stats(rows) {
  const L = rows.map((r) => r.lufs).sort((a, b) => a - b);
  const P = rows.map((r) => r.peak).sort((a, b) => a - b);
  const med = (a) => a[Math.floor(a.length / 2)];
  return `${rows.length} clips: loudness median ${med(L).toFixed(1)} LUFS, quietest ${L[0].toFixed(1)}, loudest ${L.at(-1).toFixed(1)} (spread ${(L.at(-1) - L[0]).toFixed(1)} LU); peak median ${med(P).toFixed(1)} dBFS, highest ${P.at(-1).toFixed(1)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const clips = JSON.parse(fs.readFileSync('audio/clips.json', 'utf8'));
  const byFile = Object.fromEntries(Object.entries(clips).map(([p, f]) => [f, p]));
  if (process.argv.includes('--measure')) {
    const rows = Object.keys(byFile).sort().map((f) => {
      const a = decode(`audio/${f}`, 48000);
      return { f, p: byFile[f], lufs: loudness(a.x, a.rate), peak: peak(a.x) };
    });
    rows.sort((a, b) => a.lufs - b.lufs);
    console.log(stats(rows));
    for (const r of [...rows.slice(0, 3), ...rows.slice(-3)]) console.log(`  ${r.lufs.toFixed(1)} LUFS  peak ${r.peak.toFixed(1)}  ${r.p}`);
  } else {
    const levels = readLevels();
    const todo = Object.keys(byFile).filter((f) => !levels[f]).sort();
    let worst = 0;
    for (const f of todo) {
      levels[f] = finishClip(`audio/${f}`, `audio/${f}`);
      worst = Math.max(worst, levels[f].limited);
      writeLevels(levels);
    }
    for (const f of Object.keys(levels)) if (!byFile[f]) delete levels[f];
    writeLevels(levels);
    console.log(`levelled ${todo.length} clips; most limiting on any clip ${worst.toFixed(1)} dB`);
    console.log(stats(Object.values(levels)));
  }
}
