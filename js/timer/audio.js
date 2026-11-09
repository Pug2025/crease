// Sound for sessions: recorded voice clips, synthesized beeps, and the iPhone's built-in speech
// only as a backup when a clip is missing. Every sound also has an on-screen twin, so a silent
// phone still works.

let ctx = null;
let master = null;
let manifest = null;
const buffers = new Map();
const queue = [];
let playing = false;
let current = null;

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
  // Wake up speech too, in case a clip is missing later.
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch {}
  return c.state === 'running';
}

export function soundOn() { return !!ctx && ctx.state === 'running'; }

export async function loadManifest() {
  if (manifest) return manifest;
  try { manifest = await (await fetch('audio/clips.json')).json(); } catch { manifest = {}; }
  return manifest;
}

export async function preload(phrases) {
  await loadManifest();
  const c = audioCtx();
  if (!c) return;
  await Promise.all(phrases.map(async (p) => {
    if (buffers.has(p) || !manifest[p]) return;
    try {
      const data = await (await fetch(`audio/${manifest[p]}`)).arrayBuffer();
      buffers.set(p, await c.decodeAudioData(data));
    } catch {}
  }));
}

export function say(phrases) {
  const at = performance.now();
  phrases.forEach((p) => queue.push({ p, at }));
  pump();
}

export function hush() {
  queue.length = 0;
  try { current?.stop(); } catch {}
  try { speechSynthesis?.cancel(); } catch {}
  playing = false;
}

function pump() {
  if (playing) return;
  const item = queue.shift();
  if (!item) return;
  if (performance.now() - item.at > 6000) { pump(); return; } // too late to be useful
  playing = true;
  const done = () => { playing = false; current = null; pump(); };
  const buf = buffers.get(item.p);
  const c = audioCtx();
  if (buf && c && c.state === 'running') {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    src.onended = () => setTimeout(done, 60);
    current = src;
    src.start();
    return;
  }
  speakFallback(item.p, done);
}

function speakFallback(text, done) {
  try {
    if (!('speechSynthesis' in window)) { done(); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/90\/90/g, 'ninety ninety').replace(/&/g, 'and'));
    u.rate = 1;
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    setTimeout(() => { if (playing) done(); }, 6000);
  } catch { done(); }
}

const TONES = {
  tick: { f: 880, d: 0.09, v: 0.35 },
  go: { f: 1320, d: 0.28, v: 0.45 },
  end: { f: 660, d: 0.32, v: 0.4 },
};

export function beep(kind) {
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
