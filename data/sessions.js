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
        items: [{ id: 'ST1' }, { id: 'ST3' }, { id: 'ST4' }, { id: 'S4' }, { id: 'ST2' }, { id: 'W7' }],
      },
      { name: 'Finish', items: [{ id: 'C3' }, { id: 'G1' }] },
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
      { name: 'Core', items: [{ id: 'ST4' }, { id: 'C9' }] },
      { name: 'Cool-down', items: [{ id: 'X5' }, { id: 'M11' }, { id: 'X6' }] },
    ],
  },

  gameday: {
    name: 'Game Day',
    blurb: 'Loose and switched on before a game. Nothing tiring.',
    // No splits hold today: a long static stretch before a game takes power out of his legs.
    noLadder: true,
    blocks: [
      { name: 'Wake up', items: [{ id: 'W1' }, { id: 'W3' }, { id: 'W4' }] },
      {
        name: 'Legs on', main: true,
        items: [
          { id: 'ST3', dose: { reps: 8, window: 25 } },
          { id: 'P13', dose: { reps: 2, window: 20, sets: 1 }, note: 'Half speed.' },
          { id: 'P11', dose: { reps: 3, window: 12, sets: 1 }, note: 'Easy. Just wake your legs up.' },
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

// The four the rules can pick. The Splits session isn't one: it never counts.
export const SESSION_ORDER = ['strength', 'power', 'gameday', 'stretch'];
