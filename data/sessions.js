// Session templates. Each block is a list of drills done in order.
// A block with `circuit` runs every drill once per round, `work` seconds on and `change` seconds to move.
// An item can change the drill's dose for this session only: { id: 'ST3', dose: { reps: 10, window: 30 } }.
// main: true marks the main block. An ended session counts only if he did half of it (the player's rule).
// Keep the names "Circuit", "Power" and "Legs on": the player falls back on them.

export const SESSIONS = {
  strength: {
    name: 'Strength',
    blurb: 'Push-ups, squats, wall sits, lunges, planks. Two rounds.',
    checkGameTomorrow: true,
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W2' }, { id: 'W3' }, { id: 'W4' }, { id: 'W6' }] },
      {
        name: 'Circuit', main: true,
        circuit: { rounds: 2, work: 40, change: 20 },
        // Four fixed stations, then two that change each session (see `rotate`).
        items: [{ id: 'ST1' }, { id: 'ST3' }, { id: 'ST4' }, { id: 'S4' }],
        // The last two stations, by how many Strength sessions he has done: session n uses
        // rotate[n % 4]. Every pair of wall sit or back lunges with glute bridge or mountain climbers.
        rotate: [['ST2', 'W7'], ['S3', 'C9'], ['ST2', 'C9'], ['S3', 'W7']],
      },
      // "Core", not "Finish": it sits right above the Finisher and read as the same thing.
      { name: 'Core', items: [{ id: 'C3' }, { id: 'G1' }] },
      { name: 'Cool-down', items: [{ id: 'X5' }, { id: 'M11' }, { id: 'M6' }] },
    ],
  },

  power: {
    name: 'Power',
    blurb: 'Jump squats, skater jumps, burpees, slams. Rest fully between sets.',
    checkGameTomorrow: true,
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W2' }, { id: 'W3' }, { id: 'W4' }, { id: 'ST3', dose: { reps: 10, window: 30 } }, { id: 'P10' }] },
      {
        name: 'Power', main: true,
        items: [{ id: 'P11' }, { id: 'P4' }, { id: 'P13', dose: { sets: 3 } }, { id: 'P12' }, { id: 'P8', dose: { sets: 3 } }],
      },
      // Two core drills, by how many Power sessions he has done: session n uses rotate[n % 3].
      // The jump drills above never rotate: the jump limits are counted on them.
      { name: 'Core', items: [], rotate: [['ST4', 'C9'], ['C3', 'C9'], ['ST4', 'C3']] },
      { name: 'Cool-down', items: [{ id: 'X5' }, { id: 'M11' }, { id: 'X6' }] },
    ],
  },

  gameday: {
    name: 'Game Day',
    blurb: 'A short warm-up for before a game. It won\'t tire you out.',
    // No splits hold today: a long static stretch before a game takes power out of his legs.
    noLadder: true,
    blocks: [
      { name: 'Wake up', items: [{ id: 'W1' }, { id: 'W3' }, { id: 'W4' }] },
      {
        name: 'Legs on', main: true,
        items: [
          { id: 'ST3', dose: { reps: 8, window: 25 } },
          { id: 'P13', dose: { reps: 2, window: 20, sets: 1 }, note: 'Do these at half speed.' },
          { id: 'P11', dose: { reps: 3, window: 12, sets: 1 }, note: 'Go easy. This is to wake your legs up.' },
          { id: 'ST4', dose: { time: 20 } },
        ],
      },
      { name: 'Settle', items: [{ id: 'M6' }] },
    ],
  },

  stretch: {
    name: 'Stretch',
    blurb: 'Hips, groin and legs. For the day before a game, after you play, or after two hard days.',
    blocks: [
      {
        name: 'Hips',
        items: [{ id: 'M6', dose: { time: 40 } }, { id: 'M3' }, { id: 'M1' }, { id: 'M5' }, { id: 'M11' }],
      },
      { name: 'Legs', items: [{ id: 'X4' }, { id: 'X5' }, { id: 'X6' }] },
      { name: 'Finish', items: [{ id: 'X1' }, { id: 'X3' }] },
    ],
  },

  // The splits ladder on its own, for a rest day. Short, and it never counts as a session:
  // Today always starts it with extra: true. A block named "Splits" is filled with today's rung
  // by buildSession, so this one item is only the fallback. Warm-up first: never stretch cold.
  splits: {
    name: 'The Splits',
    blurb: 'Warm up, then today\'s hold on the ladder.',
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W1' }, { id: 'W4' }] },
      { name: 'Splits', main: true, items: [{ id: 'SP1' }] },
    ],
  },
};

// The Finisher: one drill at the end of every Strength and Power session, as many as he can in
// `window` seconds. It goes after the main work, before the splits hold and the cool-down.
// Strength takes the next of `strength` by how many Strength finishers he has done; Power takes
// Step-Back Burpees, or squats when jumps are off or burpees are left out. Never on Game Day or Stretch.
export const FINISHER = {
  window: 40,
  strength: ['ST1', 'ST3', 'S4'],
  power: ['P12'],
  // Burpees as a finisher are always this version: Step-Back Burpees, no jumps.
  powerVersion: 0,
  powerFallback: 'ST3',
};

// A Boss day: a Strength session whose circuit runs one more round.
export const BOSS = { rounds: 3, every: 10, after: 12 };

// The four the rules can pick. The Splits session isn't one: it never counts.
export const SESSION_ORDER = ['strength', 'power', 'gameday', 'stretch'];
