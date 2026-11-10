// Session templates. Each block is a list of drills done in order.
// A block with `circuit` runs every drill once per round, `work` seconds on and `change` seconds to move.
// An item can change the drill's dose for this session only: { id: 'ST3', dose: { reps: 10, window: 30 } }.

export const SESSIONS = {
  strength: {
    name: 'Strength',
    blurb: 'Push-ups, squats, wall sits, lunges, planks. Two rounds.',
    checkGameTomorrow: true,
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W2' }, { id: 'W3' }, { id: 'W4' }, { id: 'W6' }] },
      {
        name: 'Circuit',
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
        name: 'Power',
        items: [{ id: 'P11' }, { id: 'P4' }, { id: 'P13', dose: { sets: 3 } }, { id: 'P12' }, { id: 'P8', dose: { sets: 3 } }],
      },
      { name: 'Core', items: [{ id: 'ST4' }, { id: 'C9' }] },
      { name: 'Cool-down', items: [{ id: 'X5' }, { id: 'M11' }, { id: 'X6' }] },
    ],
  },

  gameday: {
    name: 'Game Day',
    blurb: 'Loose and switched on before a game. Nothing tiring.',
    blocks: [
      { name: 'Wake up', items: [{ id: 'W1' }, { id: 'W3' }, { id: 'W4' }] },
      {
        name: 'Legs on',
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
    blurb: 'Hips, groin and legs. For the day after a game, or when you\'re sore.',
    blocks: [
      {
        name: 'Hips',
        items: [{ id: 'M6', dose: { time: 40 } }, { id: 'M3' }, { id: 'M1' }, { id: 'M5' }, { id: 'M11' }],
      },
      { name: 'Legs', items: [{ id: 'X4' }, { id: 'X5' }, { id: 'X6' }] },
      { name: 'Finish', items: [{ id: 'X1' }, { id: 'X3' }] },
    ],
  },
};

export const SESSION_ORDER = ['strength', 'power', 'gameday', 'stretch'];
