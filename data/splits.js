// The splits ladder. Change the words freely; keep the field names.
//
// SIDE splits, not front splits. A goalie's legs go out to the SIDES: the butterfly, the power
// slide, the stretch for a puck in the corner. Front splits (one leg forward, one back) are a
// dance move and do nothing for any of it. Dad, 10 November 2026: "side splits are the only
// thing that matters. think about how a goalie moves."
//
// So every rung opens the same thing the butterfly needs: the inside of his thighs, and hips
// that let his knees drop in while his shins turn out flat. The Frog rung is that shape exactly.
//
// Working up to it is a long job: months, not weeks, and it goes backwards during a growth spurt
// because bones get longer before muscles do. The ladder is short and the rungs are hard, and
// the thing that moves every session is the hold count, not the rung.
//
// He climbs by doing the hold: HOLDS clean holds opens the next rung, at most one a day, so he
// can't climb by running Splits five times in an evening. Three rungs are Dad's: the app stops
// there and waits until Dad has watched one. Nothing is ever self-rated, and there is no way for
// him to tell the app a rung was easy.
//
// Safety, from the research in PLAN section 2: no bouncing, no forcing, nothing past flat (no
// oversplits ever), and stretches only on a warm body. Every hold is both legs at once, so none of them is a set per
// side and none runs past the 40-second cap.

// --- The drills. Seven drawings; four of the rungs share the cushion-stack one. ---
export const SPLIT_DRILLS = [
  {
    id: 'SP1', name: 'Wide Sit', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    hold: true,
    why: 'Sitting with your legs wide is the same shape as the butterfly.',
    cues: ['Legs out wide. Sit up tall.', 'Kneecaps pointing up.', 'Hands behind you if you need them.'],
    mistake: 'Slumping back and rounding your spine.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP2', name: 'Frog', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    hold: true,
    why: 'With your knees wide and your shins turned out, you are in your butterfly, off the ice.',
    cues: ['Knees out wide, shins out flat.', 'Forearms down. Hips back.', 'Rock back slow. Don\'t bounce.'],
    mistake: 'Knees sliding back under your hips.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP3', name: 'Wide Sit, Lean', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    hold: true,
    why: 'Leaning forward from a wide sit stretches the inside of both thighs at once.',
    cues: ['Legs wide. Walk your hands forward.', 'Flat back. Lead with your chest.', 'Breathe out and go a bit further.'],
    mistake: 'Rounding your back to get your head down.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP4', name: 'Wall Straddle', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor', 'wall'],
    hold: true,
    why: 'You lie still and the weight of your legs does the stretching. Take this one slowly.',
    cues: ['On your back, bum right at the wall.', 'Let your legs slide apart on their own.', 'Hands on your belly. Breathe out slow.'],
    mistake: 'Pulling your legs wider with your hands.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP5', name: 'Side Splits to a Stack', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor', 'cushions'],
    hold: true,
    why: 'You do the side splits sitting on a stack of cushions. You take a cushion away as you get looser.',
    cues: ['Feet wide. Kneecaps and toes up.', 'Sink onto the cushions. Hands down.', 'Breathe out slow. Don\'t bounce.'],
    mistake: 'Rolling onto the insides of your feet.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP6', name: 'Side Splits', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    hold: true,
    why: 'The side splits all the way to the floor, with your hands taking some of your weight.',
    cues: ['Feet wide. Kneecaps and toes up.', 'Hips all the way down.', 'Hands on the floor. Breathe out slow.'],
    mistake: 'Letting your feet roll in and your knees turn over.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 40 },
  },
  {
    id: 'SP7', name: 'The Side Splits', group: 'splits',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    hold: true,
    why: 'The side splits with your hands off the floor.',
    cues: ['Arms out. Hands off the floor.', 'Kneecaps up. Chest tall.', 'Hold still. Breathe out slow.'],
    mistake: 'Dropping a hand to the floor to take the weight.',
    versions: [{ name: 'Standard' }],
    start: 0,
    dose: { type: 'time', time: 30 },
  },
];

// --- The rungs. `as` overrides the drill for that rung: its name and its line. ---
// watch: the app stops here until Dad has watched him hold it.
export const LADDER = [
  { n: 1, id: 'SP1', name: 'Wide Sit' },
  { n: 2, id: 'SP2', name: 'Frog' },
  { n: 3, id: 'SP3', name: 'Wide Sit, Lean' },
  { n: 4, id: 'SP4', name: 'Wall Straddle' },
  { n: 5, id: 'SP5', name: 'Side Splits · 4 cushions', how: 'Four cushions under you.' },
  { n: 6, id: 'SP5', name: 'Side Splits · 3 cushions', how: 'Three cushions under you.', watch: true },
  { n: 7, id: 'SP5', name: 'Side Splits · 2 cushions', how: 'Two cushions under you.' },
  { n: 8, id: 'SP5', name: 'Side Splits · 1 cushion', how: 'One cushion under you.', watch: true },
  { n: 9, id: 'SP6', name: 'Side Splits · floor', how: 'Nothing under you. Hips to the floor.' },
  { n: 10, id: 'SP7', name: 'The Side Splits', how: 'Arms out, hands off the floor.', watch: true },
];

export const TOP = LADDER.length;
export const HOLDS = 6; // clean holds on a rung before the next one opens

// What the screen says. Short lines, grade 5, no praise.
export const SPLITS_COPY = {
  title: 'Side Splits',
  lead: 'You do one hold a day. After six holds on a rung, you move up to the next one.',
  why: 'Your legs go out to the sides every time you drop into the butterfly. The wider they go, the lower you sit and the further you reach.',
  slow: 'Getting to the side splits takes months.',
  // The line that stops him quitting the first time his number goes backwards.
  growth: 'Some months it will get harder. Your bones are growing faster than your muscles, and the stretch comes back once they catch up.',
  rules: [
    'Never bounce. Sink and hold still.',
    'Ease in. Never force it.',
    'Warm up first. Never stretch cold.',
    'Stop when your legs are flat. Never go past that.',
  ],
  // Waiting for Dad stops the climb, never the stretch: the hold is still in every session, so
  // the screen has to offer it too.
  watchHim: 'Keep doing it until he has.',
  waiting: 'Ready for Dad to watch.',
  topped: 'You can do the side splits.',
};
