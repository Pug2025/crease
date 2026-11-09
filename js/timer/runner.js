// Runs a built session against the clock. Time comes from timestamps, never from counting ticks,
// so a slow or throttled timer can't make the countdown drift.

const STALE = 1.5; // a cue more than this many seconds late is dropped, not played

export class Runner {
  constructor(session, handlers) {
    this.s = session;
    this.h = handlers; // { onStep(step), onTick(elapsed, step), onCue(cue, step), onEnd() }
    this.idx = -1;
    this.fired = new Set();
    this.paused = false;
    this.ended = false;
    this.timer = null;
  }

  now() { return performance.now(); }

  start() {
    this.t0 = this.now();
    this.pausedTotal = 0;
    this.timer = setInterval(() => this.tick(), 100);
    this.tick();
  }

  elapsed() {
    const now = this.paused ? this.pausedAt : this.now();
    return (now - this.t0 - this.pausedTotal) / 1000;
  }

  pause() {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.pausedAt = this.now();
    this.tick();
  }

  resume() {
    if (!this.paused || this.ended) return;
    this.pausedTotal += this.now() - this.pausedAt;
    this.paused = false;
    this.tick();
  }

  // Jump to the start of step i (Done, Skip). Cues of the steps jumped over never play.
  jumpTo(i) {
    const st = this.s.steps[Math.min(i, this.s.steps.length - 1)];
    const shift = st.start - this.elapsed();
    if (this.paused) this.pausedAt += shift * 1000; else this.t0 -= shift * 1000;
    for (let k = 0; k < st.i; k++) this.s.steps[k].cues.forEach((_, j) => this.fired.add(`${k}:${j}`));
    this.tick();
  }

  // Index of the next step that starts a different drill (for Skip).
  nextDrillIndex() {
    const cur = this.s.steps[Math.max(this.idx, 0)];
    for (let k = cur.i + 1; k < this.s.steps.length; k++) {
      const st = this.s.steps[k];
      if (st.kind === 'end' || (st.kind === 'intro' && st.drillNo !== cur.drillNo)) return k;
    }
    return this.s.steps.length - 1;
  }

  // Index of the step after the current work step (for Done on a rep set).
  afterCurrent() { return Math.min(this.idx + 1, this.s.steps.length - 1); }

  current() { return this.s.steps[Math.max(this.idx, 0)]; }

  remaining() {
    const st = this.current();
    return Math.max(0, st.start + st.dur - this.elapsed());
  }

  tick() {
    if (this.ended) return;
    const e = this.elapsed();
    const steps = this.s.steps;
    let i = steps.findIndex((st) => e >= st.start && e < st.start + st.dur);
    if (i < 0) i = steps.length - 1;
    if (i !== this.idx) {
      this.idx = i;
      this.h.onStep?.(steps[i]);
    }
    const st = steps[i];
    const local = e - st.start;
    if (!this.paused) {
      st.cues.forEach((c, j) => {
        const key = `${i}:${j}`;
        if (this.fired.has(key) || local < c.at) return;
        this.fired.add(key);
        if (local - c.at <= STALE) this.h.onCue?.(c, st);
      });
    }
    this.h.onTick?.(e, st);
    if (st.kind === 'end') this.finish();
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    this.h.onEnd?.();
  }

  stop() {
    this.ended = true;
    clearInterval(this.timer);
  }
}
