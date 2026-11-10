// Every fixed word Crease shows or says. Drill words live in exercises.js.
// Lines in SAY are spoken; tools/make-voice.mjs records each one as a clip.

export const SAY = {
  firstUp: 'First up.',
  next: 'Next.',
  go: 'Go.',
  rest: 'Rest.',
  getReady: 'Get ready.',
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

export const STOP_RULE = {
  title: 'Stop and tell Dad if:',
  lines: [
    'something hurts sharp',
    'your knee hurts just below the kneecap',
    'your heel hurts',
    'something still hurts the next day',
    'you feel dizzy or can\'t catch your breath',
  ],
};

// label: the button. spot: how it reads in a sentence ("You stopped for ___").
export const PAIN_ZONES = [
  { id: 'below-kneecap', label: 'Just below the kneecap', spot: 'the spot below your kneecap' },
  { id: 'knee', label: 'Knee', spot: 'your knee' },
  { id: 'heel', label: 'Heel', spot: 'your heel' },
  { id: 'groin', label: 'Groin', spot: 'your groin' },
  { id: 'hip', label: 'Hip', spot: 'your hip' },
  { id: 'lower-back', label: 'Lower back', spot: 'your lower back' },
  { id: 'ankle', label: 'Ankle', spot: 'your ankle' },
  { id: 'other', label: 'Somewhere else', spot: 'something that hurt' },
];
export const spotOf = (id) => PAIN_ZONES.find((z) => z.id === id)?.spot || 'something that hurt';

export const FEEL = [
  { id: 'good', label: 'Good' },
  { id: 'tired', label: 'Tired', note: 'Shorter version today.' },
  { id: 'sore', label: 'Sore', note: 'Stretch only today.' },
  { id: 'sick', label: 'Sick', note: 'No training today. Rest up.' },
];
