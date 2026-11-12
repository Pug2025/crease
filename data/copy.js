// Every fixed word Crease shows or says. Drill words live in exercises.js.
// Lines in SAY are spoken; tools/make-voice.mjs records each one as a clip.

export const SAY = {
  firstUp: 'First up.',
  go: 'Go.',
  goLandSoft: 'Go. Land soft.', // every set of a drill with jumps
  rest: 'Rest.',
  tenSeconds: 'Ten seconds.',
  keepBreathing: 'Keep breathing.',
  lastSet: 'Last set.',
  roundTwo: 'Round two.',
  lastRound: 'Last round.',
  sessionDone: 'That\'s the session.',
  soundCheck: 'Sound check. If you can hear me, you\'re set.',
  start: { leg: 'Left leg first.', side: 'Left side first.', way: 'Going left first.' },
  switch: { leg: 'Switch legs.', side: 'Switch sides.', way: 'Now the other way.' },
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const word = (n) => (WORDS[n] ?? String(n));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The spoken and shown target for one set, e.g. "6 each leg", "Hold 30 seconds".
export function targetText(drill, dose) {
  const each = drill.side ? ` each ${drill.side}` : '';
  if (dose.type === 'reps') return drill.side ? `${dose.reps}${each}` : `${dose.reps} reps`;
  if (drill.hold) return `Hold ${dose.time} s${each}`;
  return `${dose.time} s${each}`;
}
export function targetSay(drill, dose) {
  const each = drill.side ? ` each ${drill.side}` : '';
  if (dose.type === 'reps') return drill.side ? `${cap(word(dose.reps))}${each}.` : `${cap(word(dose.reps))} reps.`;
  const secs = `${word(dose.time)} seconds`;
  if (drill.hold) return `Hold ${secs}${each}.`;
  return `${cap(secs)}${each}.`;
}
export const setsSay = (n) => `${cap(word(n))} sets.`;
export const setSay = (n) => `Set ${word(n)}.`;

// Today's room hint. The bedroom swaps only the drills that need space; before 9 am only slams swap.
export const ROOM_HINT = {
  bedroom: 'Small room: nothing that needs 3 metres.',
  big: 'Full versions. Clear about 3 metres around you.',
};

export const FEEL = [
  { id: 'good', label: 'Good' },
  { id: 'tired', label: 'Tired', note: 'Shorter version today.' },
  { id: 'sick', label: 'Sick', note: 'No training today. Rest up.' },
];
