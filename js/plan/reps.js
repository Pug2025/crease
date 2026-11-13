// Counting Finisher reps from the pose the camera sees. Pure functions: tests.mjs feeds them
// made-up poses in Node. js/camera.js feeds them the real ones.
//
// A pose is the 33 body points the pose model gives (MediaPipe's numbering), each
// { x, y, z, visibility }. x, y, z are in metres (the model's "world" points), y pointing down.
// visibility runs 0 to 1. A frame with no person is null.
//
// Each drill kind is a small state machine: he has to be seen "up", then "down", then "up" again
// for one rep. Each of those has to hold for REP_RULES.hold frames in a row, and the angles that
// count as down and up are far apart, so a body sitting near one line can't count twice.

// Every number to tune after a real test with him. Angles in degrees.
export const REP_RULES = {
  minVis: 0.5,     // a point below this visibility is treated as not seen
  hold: 2,         // frames in a row a position has to hold
  minRepMs: 400,   // a rep faster than this isn't counted
  lostMs: 3000,    // no body seen for this long: "The camera can't see you."
  everyMs: 66,     // at most about 15 looks a second
  slowMs: 250,     // a look slower than this is slow...
  slowRuns: 5,     // ...and this many slow looks in a row turns the camera off until the app restarts
  squat: { down: 100, up: 160 },              // knee: hip, knee, ankle
  pushup: { down: 95, up: 150, flat: 50 },    // elbow: shoulder, elbow, wrist; body at least `flat` off upright
  lunge: { down: 105, up: 160 },              // either knee bent past `down`, then both straight past `up`
  burpee: { flat: 60, upright: 30 },          // body this far off upright is down; this close to upright is up
};

// The Finisher drills the camera can count. Side Lunges are the Strength lunge.
export const REP_KIND = { ST1: 'pushup', ST3: 'squat', S4: 'lunge', P12: 'burpee' };
export const repKind = (id) => REP_KIND[id] ?? null;

// The body points used, by side.
const P = {
  L: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  R: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

const vis = (p) => (p && Number.isFinite(p.visibility) ? p.visibility : 0);
const real = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z ?? 0);

// The angle at b, between b→a and b→c, in degrees.
export function angle(a, b, c) {
  const u = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const w = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const lu = Math.hypot(...u);
  const lw = Math.hypot(...w);
  if (!lu || !lw) return null;
  const cos = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// How far the body (hip to shoulder) leans off upright: 0 standing, 90 lying flat.
export function lean(shoulder, hip) {
  const v = [shoulder.x - hip.x, shoulder.y - hip.y, (shoulder.z ?? 0) - (hip.z ?? 0)];
  const l = Math.hypot(...v);
  if (!l) return null;
  return (Math.acos(Math.min(1, Math.abs(v[1]) / l)) * 180) / Math.PI;
}

// The side whose named points are all seen, the better seen one if both are. null if neither.
function side(lm, names, R) {
  let best = null;
  let bestVis = -1;
  for (const s of ['L', 'R']) {
    const pts = names.map((n) => lm[P[s][n]]);
    if (!pts.every(real)) continue;
    const v = Math.min(...pts.map(vis));
    if (v >= R.minVis && v > bestVis) { best = pts; bestVis = v; }
  }
  return best;
}

// Each reader turns one pose into 'up', 'down', 'mid' (seen, but neither), or null (not seen).
const between = (deg, lo, hi) => (deg === null ? 'mid' : deg < lo ? 'down' : deg > hi ? 'up' : 'mid');

export const READ = {
  squat(lm, R) {
    const leg = side(lm, ['hip', 'knee', 'ankle'], R);
    if (!leg) return null;
    return between(angle(...leg), R.squat.down, R.squat.up);
  },
  pushup(lm, R) {
    const arm = side(lm, ['shoulder', 'elbow', 'wrist'], R);
    const body = side(lm, ['shoulder', 'hip'], R);
    if (!arm || !body) return null;
    const off = lean(...body);
    if (off === null || off < R.pushup.flat) return 'mid'; // not in a push-up position
    return between(angle(...arm), R.pushup.down, R.pushup.up);
  },
  lunge(lm, R) {
    const legs = ['L', 'R'].map((s) => {
      const pts = ['hip', 'knee', 'ankle'].map((n) => lm[P[s][n]]);
      return pts.every(real) && Math.min(...pts.map(vis)) >= R.minVis ? angle(...pts) : null;
    });
    const seen = legs.filter((a) => a !== null);
    if (!seen.length) return null;
    if (seen.some((a) => a < R.lunge.down)) return 'down';
    if (seen.length === 2 && seen.every((a) => a > R.lunge.up)) return 'up';
    return 'mid';
  },
  burpee(lm, R) {
    const body = side(lm, ['shoulder', 'hip'], R);
    if (!body) return null;
    const off = lean(...body);
    if (off === null) return 'mid';
    return off > R.burpee.flat ? 'down' : off < R.burpee.upright ? 'up' : 'mid';
  },
};

// One counter for one Finisher. push(pose, ms) after every look; it returns
// { count, seenAt }: the reps so far and when the body was last seen (null: not yet).
export function counter(kind, R = REP_RULES) {
  const read = READ[kind];
  if (!read) throw new Error(`no counter for ${kind}`);
  let state = null; // the last held position: 'up' or 'down'
  let cand = null;  // the position the last frames showed, and how many in a row
  let run = 0;
  let upAt = null;  // when this rep started (the last held 'up')
  let count = 0;
  let seenAt = null;
  const out = () => ({ count, seenAt });
  return {
    get count() { return count; },
    push(lm, t) {
      if (!Array.isArray(lm)) return out();
      const r = read(lm, R);
      if (r === null) return out(); // the joints it needs aren't seen: this frame is ignored
      seenAt = t;
      if (r === 'mid') { cand = null; run = 0; return out(); }
      if (r === cand) run++; else { cand = r; run = 1; }
      if (run < R.hold || r === state) return out();
      if (r === 'up') {
        if (state === 'down' && upAt !== null && t - upAt >= R.minRepMs) count++;
        state = 'up';
        upAt = t;
      } else if (state === 'up') {
        state = 'down'; // starting already down (no 'up' seen yet) waits for the first 'up'
      }
      return out();
    },
  };
}
