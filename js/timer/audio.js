// Sound for sessions: recorded voice clips and synthesized beeps. Nothing else ever speaks.
// A line with no clip, or one that comes while the phone has put the sound to sleep, is dropped:
// every line is also on screen, so a silent phone still works.

// ?mute=1 in the address silences everything. Used for testing on the Mac, so nobody hears it.
const MUTED = typeof location !== 'undefined' && /[?&]mute=1\b/.test(location.search);

export const LATE = 6.5; // seconds: a line that can't start this soon after it was queued is dropped
export const GAP = 0.12; // seconds of quiet between two lines

let ctx = null;
let master = null;
let manifest = null;
const buffers = new Map();
const queue = [];
let playing = false;
let current = null;
let gen = 0; // goes up on every hush and every clip, so a cut-off clip's ending can't start another line

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

// Call from inside a tap. Sets the audio to play through the silent switch where Safari allows it.
export async function unlock() {
  if (MUTED) return true;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  const c = audioCtx();
  if (!c) return false;
  try { await c.resume(); } catch {}
  try {
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(master);
    src.start(0);
  } catch {}
  return c.state === 'running';
}

export function soundOn() { return MUTED || (!!ctx && ctx.state === 'running'); }

// Calls fn() each time the phone wakes or sleeps the sound (calls, Siri, locking the screen).
// Returns a function that stops listening.
export function onSoundChange(fn) {
  if (MUTED) return () => {};
  const c = audioCtx();
  if (!c || !c.addEventListener) return () => {};
  c.addEventListener('statechange', fn);
  return () => c.removeEventListener('statechange', fn);
}

export async function loadManifest() {
  if (manifest) return manifest;
  try { manifest = await (await fetch('audio/clips.json')).json(); } catch { manifest = {}; }
  return manifest;
}

export async function preload(phrases) {
  if (MUTED) return;
  await loadManifest();
  const c = audioCtx();
  if (!c) return;
  await Promise.all(phrases.map(async (p) => {
    if (buffers.has(p) || !manifest[p]) return;
    try {
      const data = await (await fetch(`audio/${manifest[p]}`)).arrayBuffer();
      buffers.set(p, trimmed(await c.decodeAudioData(data)));
    } catch {}
  }));
}

// The voice clips carry a little silence at each end. Find where the speech starts and stops,
// so "Go." lands right on the beep.
function trimmed(buf) {
  const d = buf.getChannelData(0);
  const th = 0.01;
  let a = 0;
  let b = d.length - 1;
  while (a < b && Math.abs(d[a]) < th) a++;
  while (b > a && Math.abs(d[b]) < th) b--;
  const pad = Math.round(0.03 * buf.sampleRate);
  const start = Math.max(0, a - pad);
  const end = Math.min(d.length, b + pad);
  return { buf, off: start / buf.sampleRate, dur: Math.max(0.05, (end - start) / buf.sampleRate) };
}

export function say(phrases) {
  if (MUTED) return;
  const at = performance.now();
  phrases.forEach((p) => queue.push({ p, at }));
  pump();
}

// Stop talking now: the clip playing and everything queued.
export function hush() {
  queue.length = 0;
  gen++;
  const src = current;
  current = null;
  playing = false;
  if (src) {
    src.onended = null;
    try { src.stop(); } catch {}
  }
}

function pump() {
  while (!playing && queue.length) {
    const item = queue.shift();
    if (performance.now() - item.at > LATE * 1000) continue; // too late to be useful
    const c = ctx;
    if (!c || c.state !== 'running') {
      // The phone has the sound asleep. Ask for it back and drop the line: it's on screen.
      try { c?.resume()?.catch?.(() => {}); } catch {}
      continue;
    }
    const clip = buffers.get(item.p);
    if (!clip) continue; // no recording of this line: never the built-in voice
    play(c, clip);
  }
}

function play(c, clip) {
  const mine = ++gen;
  playing = true;
  const src = c.createBufferSource();
  src.buffer = clip.buf;
  src.connect(master);
  src.onended = () => setTimeout(() => {
    if (mine !== gen) return; // cut off by hush(), or something newer is playing
    playing = false;
    current = null;
    pump();
  }, GAP * 1000);
  current = src;
  src.start(0, clip.off, clip.dur);
}

const TONES = {
  tick: { f: 880, d: 0.09, v: 0.35 },
  go: { f: 1320, d: 0.28, v: 0.45 },
  end: { f: 660, d: 0.32, v: 0.4 },
};

export function beep(kind) {
  if (MUTED) return;
  const c = audioCtx();
  const t = TONES[kind];
  if (!c || !t || c.state !== 'running') return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = t.f;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(t.v, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t.d);
  o.connect(g);
  g.connect(master);
  o.start(now);
  o.stop(now + t.d + 0.02);
}
