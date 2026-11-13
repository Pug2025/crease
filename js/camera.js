// The camera rep counter for the Finisher. Off unless Dad turns it on (save.camera.on).
// The pose files (vendor/pose/, about 17 MB) are not part of the install: they are fetched once,
// when Dad turns it on, into their own cache, and sw.js serves them from there afterwards.
//
// It runs only on the phone. It never records, keeps or sends a frame: each frame is looked at
// once and dropped. Anything that goes wrong turns it off quietly, and Done works as before.
// Nothing here is ever awaited by the session timer.
import { counter, REP_RULES } from './plan/reps.js';

export const POSE_CACHE = 'crease-pose-v1';
export const POSE_FILES = ['vision_bundle.mjs', 'vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'pose_landmarker_lite.task'];
const BASE = new URL('../vendor/pose/', import.meta.url);
const poseUrls = () => POSE_FILES.map((f) => new URL(f, BASE).href);

// Front camera, picture only, small.
export const CAMERA = { audio: false, video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 30 } } };

// For checking in a browser: how many starts and stops, how long each look took.
export const camStats = { starts: 0, stops: 0, looks: 0, ms: [], live: 0, ended: null, off: false, why: '' };

let off = false; // turned off until the app restarts: a slow phone or a library that failed
let landmarker = null;
let making = null;

function turnOff(why) {
  off = true;
  camStats.off = true;
  camStats.why = String(why || '');
}

// Are all the pose files in their cache?
export async function poseReady() {
  try {
    if (typeof caches === 'undefined') return false;
    const c = await caches.open(POSE_CACHE);
    for (const u of poseUrls()) if (!(await c.match(u))) return false;
    return true;
  } catch { return false; }
}

// Fetch the pose files into their cache (Dad's screen, when he turns it on). True when all are in.
export async function getPose() {
  try {
    if (typeof caches === 'undefined') return false;
    const c = await caches.open(POSE_CACHE);
    for (const u of poseUrls()) {
      if (await c.match(u)) continue;
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) return false;
      await c.put(u, res);
    }
    return poseReady();
  } catch { return false; }
}

const stopTracks = (stream) => { try { stream?.getTracks().forEach((t) => t.stop()); } catch {} };

// Start the camera for a moment and stop it, so iOS asks Dad for permission on his screen,
// not the first time the Finisher starts. True if the phone allowed it.
export async function askCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA);
    stopTracks(stream);
    return true;
  } catch { return false; }
}

async function getLandmarker() {
  if (landmarker) return landmarker;
  if (!making) {
    making = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('../vendor/pose/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(new URL('../vendor/pose', import.meta.url).href);
      landmarker = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('pose_landmarker_lite.task', BASE).href, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      return landmarker;
    })();
    making.catch((e) => { making = null; turnOff(e?.message || 'load'); });
  }
  return making;
}

// One pose from a result: the world points (metres) with the screen points' visibility.
export function poseOf(res) {
  const world = res?.worldLandmarks?.[0];
  const flat = res?.landmarks?.[0];
  if (!world || !flat || world.length < 33) return null;
  return world.map((p, i) => ({ x: p.x, y: p.y, z: p.z, visibility: flat[i]?.visibility ?? p.visibility ?? 0 }));
}

// A counter for one Finisher, kept by the player across a pause.
export const newCounter = (kind) => counter(kind);

// Run the camera into `video`, feeding `ctr`. Returns { stop() } at once; the rest happens later.
// onCount(n): the count changed. onLost(bool): the body has gone unseen for 3 s, or is back.
// onFail(): it stopped for good this time (no files, no permission, too slow, any error).
// waitMs: how long to wait before loading the model and the first look. Both hold up the page
// for a moment (half a second in desktop Chrome), so the player times them for a quiet gap
// between the voice and the countdown beeps. The picture shows meanwhile.
export function runCamera(video, ctr, { onCount = () => {}, onLost = () => {}, onFail = () => {}, waitMs = 0 } = {}) {
  const h = { stopped: false, stream: null, timer: null };
  const R = REP_RULES;
  let slow = 0;
  let lost = false;
  let startedAt = 0;

  h.stop = () => {
    if (h.stopped) return;
    h.stopped = true;
    clearTimeout(h.timer);
    const tracks = h.stream ? h.stream.getTracks() : [];
    stopTracks(h.stream);
    h.stream = null;
    try { video.pause(); video.srcObject = null; } catch {}
    camStats.stops++;
    camStats.live = 0;
    camStats.ended = tracks.length ? tracks.every((t) => t.readyState === 'ended') : null;
  };
  const fail = (why) => {
    if (h.stopped) return;
    if (why) turnOff(why);
    h.stop();
    try { onFail(); } catch {}
  };

  const look = () => {
    if (h.stopped) return;
    const t0 = performance.now();
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const res = landmarker.detectForVideo(video, t0);
        const dt = performance.now() - t0;
        camStats.looks++;
        if (camStats.ms.length < 2000) camStats.ms.push(Math.round(dt * 10) / 10);
        slow = dt > R.slowMs ? slow + 1 : 0;
        if (slow >= R.slowRuns) { fail('slow'); return; }
        const before = ctr.count;
        const { count, seenAt } = ctr.push(poseOf(res), t0);
        if (count !== before) onCount(count);
        const nowLost = t0 - (seenAt ?? startedAt) > R.lostMs;
        if (nowLost !== lost) { lost = nowLost; onLost(lost); }
      }
    } catch (e) { fail(e?.message || 'look'); return; }
    h.timer = setTimeout(look, Math.max(10, R.everyMs - (performance.now() - t0)));
  };

  (async () => {
    try {
      if (off) { fail(); return; }
      if (!(await poseReady())) { fail(); return; }
      if (h.stopped) return;
      if (typeof WebAssembly === 'undefined' || !navigator.mediaDevices?.getUserMedia) { fail('no support'); return; }
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA);
      if (h.stopped) { stopTracks(stream); return; }
      h.stream = stream;
      camStats.starts++;
      camStats.live = stream.getTracks().length;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (h.stopped) return;
      if (waitMs > 0) await new Promise((r) => { h.timer = setTimeout(r, waitMs); });
      if (h.stopped) return;
      await getLandmarker();
      if (h.stopped) return;
      startedAt = performance.now();
      look();
    } catch (e) { fail(e?.name === 'NotAllowedError' ? '' : (e?.message || 'start')); }
  })();
  return h;
}
