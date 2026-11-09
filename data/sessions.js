// Session templates. Each block is a list of drills done in order.
// A block with `circuit` runs every drill once per round, `work` seconds on and `change` seconds to move.
// An item can change the drill's dose for this session only: { id: 'M1', dose: { reps: 6, window: 30 } }.

export const SESSIONS = {
  mobility: {
    name: 'Mobility',
    blurb: 'Hips, groin and ankles. Slow and steady.',
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W2' }, { id: 'W3' }, { id: 'W4' }, { id: 'W7' }] },
      {
        name: 'Hips',
        circuit: { rounds: 2, work: 40, change: 20 },
        items: [{ id: 'M1' }, { id: 'M2' }, { id: 'M4' }, { id: 'M5' }, { id: 'M8' }, { id: 'M9' }],
      },
      { name: 'Core', items: [{ id: 'C1' }, { id: 'G1' }] },
      { name: 'Cool-down', items: [{ id: 'M3' }, { id: 'M6' }, { id: 'X3' }] },
    ],
  },

  power: {
    name: 'Power',
    blurb: 'Pushes, stops and single-leg strength. Rest fully between sets.',
    checkGameTomorrow: true,
    blocks: [
      { name: 'Warm-up', items: [{ id: 'W2' }, { id: 'W4', dose: { time: 20 } }, { id: 'W8' }, { id: 'P10' }] },
      {
        name: 'Goalie moves',
        items: [
          { id: 'P1', dose: { rest: 20 } },
          { id: 'P2', dose: { rest: 30 } },
          { id: 'P3', dose: { rest: 30 } },
          { id: 'P4', dose: { rest: 30 } },
          { id: 'P5' },
        ],
      },
      {
        name: 'Strength',
        items: [
          { id: 'S2', dose: { window: 25, rest: 20 } },
          { id: 'S3', dose: { window: 25, rest: 20 } },
          // G2 Copenhagen comes back once there's a clip of the knee-on-couch version.
          { id: 'G3' },
          { id: 'P8' },
        ],
      },
      { name: 'Cool-down', items: [{ id: 'X5' }, { id: 'M11' }, { id: 'X3' }] },
    ],
  },

  gameday: {
    name: 'Game Day',
    blurb: 'Loose and switched on before a game. Nothing tiring.',
    blocks: [
      { name: 'Wake up', items: [{ id: 'W1' }, { id: 'W3', dose: { time: 20 } }, { id: 'W4', dose: { time: 20 } }] },
      {
        name: 'Hips and feet',
        items: [
          { id: 'M1', dose: { reps: 6, window: 30, sets: 1 } },
          { id: 'M9', dose: { reps: 6, window: 15 } },
          { id: 'P1', dose: { time: 15, sets: 2, rest: 15 } },
          { id: 'P2', dose: { reps: 2, window: 12, sets: 1 }, note: 'Half speed.' },
          { id: 'P10', dose: { reps: 3, window: 15 } },
        ],
      },
      { name: 'Eyes', items: [{ id: 'R7', dose: { reps: 10, window: 25 } }] },
      { name: 'Settle', items: [{ id: 'X3', dose: { time: 30 } }] },
    ],
  },
};

export const SESSION_ORDER = ['mobility', 'power', 'gameday'];
