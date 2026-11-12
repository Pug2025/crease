// Crease drill library. One block per drill. Change the words freely; keep the field names.
//
// noise    quiet | thud | loud. Information only: jumping in the morning is fine (Dad, 10 Nov 2026).
// space    small | big. Big drills need about 3 m clear and are swapped in the bedroom.
// jumps    foot landings in one set (counts toward the jump cap).
// hops     true for small bounces that don't count toward the cap (jumping jacks). They still
//          swap out, like jumps, when jumps are off.
// side     "leg", "side" or "way": the drill is done on each side, left then right.
//          alternate: true means both sides inside one set (no switch).
// hold     true for holds and stretches.
// needs    what it uses. Things he has to fetch show on the preview ("Grab: a towel."); the wall
//          and the floor don't.
// dose     one set: { type: "time", time: seconds } or { type: "reps", reps, window: seconds }.
//          sets and rest (seconds) are optional. A version can change the dose.
// start    which version he begins on: 0 = Easier, 1 = Standard, 2 = Harder.
// versions name (Easier, Standard, Harder) and how (the line under the drill name; the voice
//          says it too). A version that changes the move also gives its own title (the drill
//          name while he does it), cues and draw, plus why, mistake, jumps, hops, space, needs or dose.
// bedroom  what replaces a big-space drill in the bedroom, and a slam before 9 am: a drill id
//          ("ST1"), a version number (0), or a variant { name, how, cues, draw }.
// noJump   what replaces a drill with jumps or hops when jumps are off: a version number or a drill id.
// slam     true for ball slams: never before 9 am (Dad's rule, so the house can sleep).

import { SPLIT_DRILLS } from './splits.js';

export const DRILLS = [
  // Warm-up
  {
    id: 'W1', name: 'March & Swing', group: 'warm-up',
    noise: 'quiet', space: 'small', jumps: 0,
    why: 'Warms up your legs and gets your arms moving before the work.',
    cues: ['Knees to hip height.', 'Swing your arms big.', 'Breathe through your nose.'],
    mistake: 'Little knees, shuffling feet.',
    versions: [
      { name: 'Easier', how: 'Slow march.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'High-knee jog on the spot.' },
    ],
    start: 1,
    dose: { type: 'time', time: 45 },
  },
  {
    id: 'W2', name: 'Jumping Jacks', group: 'warm-up',
    noise: 'loud', space: 'small', jumps: 0, hops: true,
    why: 'Gets your heart going so your muscles are ready to move fast.',
    cues: ['Land soft on the balls of your feet.', 'Arms all the way up.'],
    mistake: 'Landing flat and loud.',
    versions: [
      {
        name: 'Easier', title: 'Step Jacks', how: 'One foot out at a time.', noise: 'quiet', hops: false,
        cues: ['Step one foot out wide, arms up.', 'Arms all the way up.'],
      },
      { name: 'Standard' },
      {
        name: 'Harder', how: 'Clap jacks. Arms clap in front.',
        cues: ['Land soft on the balls of your feet.', 'Clap in front, then arms out wide.'],
      },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
    noJump: 0,
  },
  {
    id: 'W3', name: 'Leg Swings', group: 'warm-up',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['wall'],
    side: 'leg',
    why: 'Loosens your hips for wide pushes and kick saves.',
    cues: ['Hand on the wall. Stand tall.', 'Swing front and back, then side to side.', 'Swing, don\'t kick.'],
    mistake: 'Twisting your body to swing higher.',
    versions: [
      { name: 'Easier', how: 'Small swings.' },
      { name: 'Standard' },
      {
        name: 'Harder', how: 'No hand on the wall.', needs: [],
        cues: ['Stand tall.', 'Swing front and back, then side to side.', 'Swing, don\'t kick.'],
      },
    ],
    start: 1,
    dose: { type: 'time', time: 20 },
  },
  {
    id: 'W4', name: 'Gate Openers', group: 'warm-up',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'leg',
    why: 'Opens your hips the way they move when you drop into the butterfly.',
    cues: ['Knee up high.', 'Draw a big circle out to the side.', 'Stand tall.'],
    mistake: 'Leaning sideways to get the knee higher.',
    versions: [
      { name: 'Easier', how: 'Hand on the wall.', needs: ['wall'] },
      { name: 'Standard' },
      { name: 'Harder', how: 'No hand. Two seconds per circle.' },
    ],
    start: 1,
    dose: { type: 'time', time: 20 },
  },
  {
    id: 'W6', name: 'Shuffles', group: 'warm-up',
    noise: 'thud', space: 'big', jumps: 0,
    why: 'Warms up the side-to-side moves you make all game.',
    cues: ['Low in your stance.', 'Quick shuffles side to side. Don\'t cross your feet.'],
    mistake: 'Standing up tall as you shuffle.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 20 },
    bedroom: { name: 'Small Shuffles', how: 'Small shuffles, soft feet.' },
  },

  // Strength
  {
    id: 'ST1', name: 'Push-Ups', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    why: 'Strong arms and shoulders keep your glove and blocker up, and push you back up off the ice.',
    cues: ['Hands under your shoulders.', 'Body straight like a plank.', 'Chest down to a fist off the floor.'],
    mistake: 'Hips sagging, or butt up in the air.',
    versions: [
      { name: 'Easier', how: 'Knees down.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Three seconds on the way down.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 8, window: 30 },
  },
  {
    id: 'ST2', name: 'Wall Sit', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['wall'], hold: true,
    why: 'It\'s your stance with a wall behind you. It builds legs that can stay low all game.',
    cues: ['Back flat on the wall.', 'Thighs flat, knees over your ankles.', 'Hands off your legs.'],
    mistake: 'Resting your hands on your thighs.',
    versions: [
      {
        name: 'Easier', how: 'Sit a little higher.', dose: { time: 20 },
        // The 20 s hold speaks cues[1] only, so the cue that fixes the common mistake goes second.
        cues: ['Back flat on the wall.', 'Hands off your legs.', 'Knees over your ankles.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball on your lap.', needs: ['wall', 'med ball'], dose: { time: 45 } },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'ST3', name: 'Squats', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    why: 'Strong legs are what you push with and what get you back up.',
    cues: ['Feet shoulder-width.', 'Sit back like there\'s a chair.', 'Chest up, knees out over your toes.'],
    mistake: 'Knees caving in.',
    versions: [
      { name: 'Easier', how: 'Squat down to a chair.', needs: ['chair'] },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball at your chest.', needs: ['med ball'] },
    ],
    start: 1,
    dose: { type: 'reps', reps: 12, window: 35 },
  },
  {
    id: 'ST4', name: 'Plank', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0, hold: true,
    why: 'A solid middle keeps you square when you move and reach.',
    cues: ['Elbows under your shoulders.', 'Straight from head to heels.', 'Squeeze your butt.'],
    mistake: 'Hips sagging.',
    versions: [
      {
        name: 'Easier', how: 'Knees down.',
        cues: ['Elbows under your shoulders.', 'Straight from head to knees.', 'Squeeze your butt.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Lift one foot, then switch.' },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'C3', name: 'Side Plank', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'side', hold: true,
    why: 'Stops you getting knocked off balance with traffic in front of you.',
    cues: ['Elbow under your shoulder.', 'Body in a straight line.', 'Lift your hips.'],
    mistake: 'Hips sagging.',
    versions: [
      { name: 'Easier', how: 'Knees down.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Lift your top leg.' },
    ],
    start: 1,
    dose: { type: 'time', time: 20 },
  },
  {
    id: 'S3', name: 'Back Lunges', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'leg',
    why: 'Builds the leg you push with, and it\'s easy on your knees.',
    cues: ['Long step back.', 'Lower your back knee gently.', 'Front knee over your toes.'],
    mistake: 'Front knee falling inward.',
    versions: [
      { name: 'Easier', how: 'Hold a chair. Shorter range.', needs: ['chair'] },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball at your chest.', needs: ['med ball'] },
    ],
    start: 1,
    dose: { type: 'reps', reps: 6, window: 25 },
  },
  {
    id: 'S4', name: 'Side Lunges', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'side',
    why: 'Builds strength in the wide position you push from, and stretches your groin.',
    cues: ['Big step to the side.', 'Sit back into that hip.', 'Other leg straight, both feet flat.'],
    mistake: 'Knee turning in.',
    versions: [
      { name: 'Easier', how: 'Shorter step.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball at your chest.', needs: ['med ball'] },
    ],
    start: 1,
    dose: { type: 'reps', reps: 6, window: 25 },
  },
  {
    id: 'W7', name: 'Glute Bridge', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0,
    why: 'Strong butt muscles do the pushing, so your back doesn\'t have to.',
    cues: ['Feet flat, knees bent.', 'Squeeze and lift. Hold two seconds.', 'Ribs down.'],
    mistake: 'Arching your lower back at the top.',
    versions: [
      { name: 'Easier', how: 'Smaller lift.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'One leg at a time.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 10, window: 40 },
  },
  {
    id: 'G1', name: 'Ball Squeeze', group: 'strength',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['med ball'],
    hold: true, goWord: 'Squeeze.', restWord: 'Relax.',
    why: 'Strong inner legs drive your push across the crease.',
    cues: ['Lie on your back, ball between your knees.', 'Squeeze hard.', 'Keep breathing.'],
    mistake: 'Holding your breath.',
    versions: [
      {
        name: 'Easier', title: 'Pillow Squeeze', how: 'Pillow instead of the ball. Medium squeeze.', needs: ['pillow'],
        cues: ['Lie on your back, pillow between your knees.', 'Medium squeeze.', 'Keep breathing.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Squeeze in a bridge.' },
    ],
    start: 1,
    dose: { type: 'time', time: 5, sets: 5, rest: 5 },
  },
  {
    id: 'C9', name: 'Mountain Climbers', group: 'strength',
    noise: 'thud', space: 'small', jumps: 0,
    why: 'Works your core while your feet move fast.',
    cues: ['High plank, hands under your shoulders.', 'Hips stay low.', 'Drive your knees to your chest, fast.'],
    mistake: 'Butt up in the air.',
    versions: [
      {
        name: 'Easier', title: 'Slow Climbers', how: 'Step each knee in slowly.', noise: 'quiet',
        cues: ['High plank, hands under your shoulders.', 'Hips stay low.', 'Step each knee in to your chest.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Faster.' },
    ],
    start: 1,
    dose: { type: 'time', time: 20 },
  },

  // Power
  {
    id: 'P10', name: 'Snap Down', group: 'power',
    noise: 'thud', space: 'small', jumps: 3,
    why: 'Practises landing in a strong stance before you jump.',
    cues: ['Snap down into stance. Freeze.', 'Up on your toes, arms high.', 'Knees out, not in.'],
    mistake: 'Landing flat with your knees in.',
    versions: [
      {
        name: 'Easier', how: 'Slow drop. Feet stay down.', noise: 'quiet', jumps: 0,
        why: 'Practises dropping into a strong stance.', mistake: 'Knees caving in as you drop.',
        cues: ['Up on your toes, arms high.', 'Drop slowly into stance. Freeze.', 'Knees out, not in.'],
      },
      { name: 'Standard' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 3, window: 15 },
    noJump: 0,
  },
  {
    id: 'P11', name: 'Jump Squats', group: 'power',
    noise: 'loud', space: 'small', jumps: 5,
    why: 'Explosive legs get you across the crease and up out of your butterfly fast.',
    cues: ['Squat, then jump high. Land soft.', 'Knees over your toes.', 'Reset, then go again.'],
    mistake: 'Landing stiff and loud, or knees caving in.',
    versions: [
      {
        name: 'Easier', title: 'Squat to Toes', how: 'Squat, then rise onto your toes. No jump.', noise: 'quiet', jumps: 0, draw: 'ST3',
        mistake: 'Knees caving in.',
        cues: ['Squat down, then rise onto your toes.', 'Knees over your toes.', 'Reset, then go again.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Pause two seconds at the bottom, then jump.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 5, window: 15, sets: 3, rest: 40 },
    noJump: 0,
  },
  {
    id: 'P4', name: 'Skater Jumps', group: 'power',
    noise: 'loud', space: 'big', jumps: 8,
    side: 'way', alternate: true,
    why: 'Jumping side to side off one leg is the push that moves you post to post.',
    cues: ['Push off one leg sideways.', 'Land on the other, soft knee.', 'Stick it for a second.'],
    mistake: 'Knee caving in on the landing.',
    versions: [
      {
        name: 'Easier', title: 'Step & Hold', how: 'No jump. Stick each step.', noise: 'quiet', space: 'small', jumps: 0,
        why: 'Pushing off one leg and sticking it is the move that takes you post to post.',
        cues: ['Big step sideways.', 'Stick it, knee over toes.'],
      },
      { name: 'Standard' },
      {
        name: 'Harder', how: 'No pause. Keep bounding.',
        cues: ['Push off one leg sideways.', 'Land on the other, soft knee.', 'Bound straight back.'],
      },
    ],
    start: 1,
    dose: { type: 'reps', reps: 4, window: 25, sets: 2, rest: 40 },
    bedroom: 0,
    noJump: 0,
  },
  {
    id: 'P13', name: 'Shuffle & Lunge', group: 'power',
    noise: 'thud', space: 'big', jumps: 0,
    side: 'way', alternate: true,
    why: 'Shuffle across like you\'re following a pass, then drop into a strong side lunge and push back.',
    cues: ['Low stance. Three quick shuffles.', 'Big step into a side lunge.', 'Push off hard back to stance.'],
    mistake: 'Standing up during the shuffles.',
    versions: [
      {
        name: 'Easier', how: 'Two shuffles, smaller lunge.',
        cues: ['Low stance. Two quick shuffles.', 'Step into a small side lunge.', 'Push off back to stance.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball at your chest.', needs: ['med ball'] },
    ],
    start: 1,
    dose: { type: 'reps', reps: 3, window: 30, sets: 2, rest: 30 },
    bedroom: 'S4',
  },
  {
    id: 'P12', name: 'Burpees', group: 'power',
    noise: 'loud', space: 'small', jumps: 5,
    why: 'You go down and get back up fast, the way you do after a save.',
    cues: ['Hands down, jump your feet back to a plank.', 'Jump your feet back in.', 'Jump up, hands high.'],
    mistake: 'Hips sagging in the plank.',
    versions: [
      {
        name: 'Easier', title: 'Step-Back Burpees', how: 'Step back, step in, stand tall. No jumping.', noise: 'quiet', jumps: 0, draw: 'P12q',
        cues: ['Hands down, step back to a plank.', 'Step back in.', 'Stand up tall, hands high.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Add a push-up at the bottom.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 5, window: 25, sets: 2, rest: 40 },
    noJump: 0,
  },
  {
    id: 'P8', name: 'Ball Slams', group: 'power',
    noise: 'loud', space: 'big', jumps: 0, needs: ['med ball'],
    slam: true,
    why: 'Slamming the ball uses your whole body at once.',
    cues: ['Ball up high, arms long.', 'Slam it right in front of your feet.', 'Step back.'],
    mistake: 'Slamming it far out in front, where it bounces back at you.',
    versions: [
      { name: 'Easier', how: 'Half-height slams.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Slam, catch, slam faster.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 6, window: 20, sets: 2, rest: 40 },
    bedroom: 'ST1',
  },

  // Stretch (cool-downs and the Stretch day)
  {
    id: 'M1', name: '90/90 Switch', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['soft floor'],
    why: 'Your hips turn in and out to drop into the butterfly and get back up. This loosens both.',
    cues: ['Sit tall.', 'Swing both knees side to side together.', 'Feet stay put.'],
    mistake: 'Leaning way back on your hands.',
    versions: [
      { name: 'Easier', how: 'Hands on the floor behind you.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hands-free.' },
    ],
    start: 1,
    dose: { type: 'reps', reps: 8, window: 40 },
  },
  {
    id: 'M3', name: 'Kneeling Hip Stretch', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['pillow'],
    side: 'side', hold: true,
    why: 'Your stance tightens the front of your hips. This undoes it.',
    cues: ['Back knee on a pillow.', 'Squeeze the butt of your back leg.', 'Lean forward a little.'],
    mistake: 'Arching your back instead of squeezing.',
    versions: [
      { name: 'Easier', how: 'Smaller lean.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Reach the same-side arm up and over.' },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'M5', name: 'Deep Side Squat', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'side',
    why: 'Stretches your groin in the low, wide spot you push from.',
    cues: ['Wide stance. Sit down to one side.', 'Heel down.', 'Other leg straight, toes up.'],
    mistake: 'Heel of the bent leg lifting.',
    versions: [
      { name: 'Easier', how: 'Hold a doorframe, go halfway.' },
      { name: 'Standard' },
      { name: 'Harder', how: 'Hold the med ball out in front.', needs: ['med ball'] },
    ],
    start: 1,
    dose: { type: 'reps', reps: 5, window: 25 },
  },
  {
    id: 'M6', name: 'Butterfly Sit', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, hold: true,
    why: 'Opens your groin for the butterfly.',
    cues: ['Feet together, sit tall.', 'Let your knees drop on their own.', 'Breathe out slow.'],
    mistake: 'Pushing your knees down with your hands.',
    versions: [
      { name: 'Easier', how: 'Sit on a pillow.', needs: ['pillow'] },
      { name: 'Standard' },
      { name: 'Harder', how: 'Lean forward from the hips, back flat.' },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'M11', name: 'Figure 4', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'side', hold: true,
    why: 'Loosens the outside of your hip after a hard skate.',
    cues: ['Lie on your back.', 'Ankle on the other knee.', 'Pull the bottom leg in.'],
    mistake: 'Lifting your head and tightening your neck.',
    versions: [
      {
        name: 'Easier', how: 'Feet on the wall.', needs: ['wall'],
        cues: ['Lie on your back, foot on the wall.', 'Ankle on the other knee.', 'Head stays down.'],
      },
      { name: 'Standard' },
      { name: 'Harder', how: 'Pull closer.' },
    ],
    start: 1,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'X4', name: 'Towel Hamstring', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['towel'],
    side: 'leg', hold: true,
    why: 'Loose hamstrings let you sit lower in your stance.',
    cues: ['Lie on your back.', 'Towel round your foot, leg straight up.', 'Pull gently. Head stays down.'],
    mistake: 'Lifting your head off the floor.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'X5', name: 'Side-Lying Quad', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0,
    side: 'side', hold: true,
    why: 'Loose thighs take strain off the spot below your kneecap.',
    cues: ['Lie on your side.', 'Hold your top ankle behind you.', 'Knees together.'],
    mistake: 'Top knee drifting forward.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'X6', name: 'Calf Stretch', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['wall'],
    side: 'leg', hold: true,
    why: 'Loose calves take strain off your heels, which matters while you\'re growing.',
    cues: ['Hands on the wall.', 'Back leg straight, heel down.', 'Lean in slowly.'],
    mistake: 'Back heel lifting.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 30 },
  },
  {
    id: 'X1', name: 'Child\'s Pose', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, hold: true,
    why: 'Stretches your back and shoulders after the work.',
    cues: ['Sit back on your heels.', 'Arms long in front, forehead down.', 'Breathe out slow.'],
    mistake: 'Hips floating up off your heels.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 45 },
  },
  {
    id: 'X3', name: 'Wall Breathing', group: 'stretch',
    noise: 'quiet', space: 'small', jumps: 0, needs: ['wall'], hold: true,
    why: 'Calms you down at the end of a session.',
    cues: ['Feet on the wall, knees bent.', 'Breathe in through your nose.', 'Long breath out.'],
    mistake: 'Short, fast breaths.',
    versions: [
      { name: 'Standard' },
    ],
    start: 0,
    dose: { type: 'time', time: 45 },
  },
];

// The splits ladder lives in its own file (data/splits.js) so this library stays the drills he
// does in a session. Its holds are looked up the same way, so everything else works unchanged.
export const byId = Object.fromEntries([...DRILLS, ...SPLIT_DRILLS].map((d) => [d.id, d]));
