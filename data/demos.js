// Demo videos for the drill cards. Every one was checked against the drill's cues
// (research/DEMOS_VETTED.md). They need the internet; the drawings work without it.
// start = seconds into the video where the drill begins. note = what to do differently.

export const DEMOS = {
  W3: [
    { url: 'https://www.youtube.com/watch?v=difYoBtZi2s', from: 'PureGym', label: 'Front and back', note: 'Keep a hand on the wall and swing lower than this.' },
    { url: 'https://www.youtube.com/watch?v=unBmbI1nTQw', from: 'Commit To Life Fitness', label: 'Side to side' },
  ],
  W4: [{ url: 'https://www.youtube.com/watch?v=i2XQGTAxqow', from: 'Onward ATL', note: 'Same move with a band. You don\'t need one.' }],
  W7: [{ url: 'https://www.youtube.com/watch?v=tqp5XQPpTxY', from: 'PureGym' }],
  W8: [{ url: 'https://www.youtube.com/watch?v=Ak0wngKWGXU', from: 'The Fitness Academy', note: 'Same walk. You don\'t need the ball.' }],
  W9: [{ url: 'https://www.youtube.com/watch?v=ny3c2YNkGUo', from: 'Jennifer Eddins', note: 'Same move. The band is up to you.' }],
  M1: [{ url: 'https://www.youtube.com/watch?v=f_7qIPxw6nE', from: 'PureGym', start: 15 }],
  M2: [{ url: 'https://www.youtube.com/watch?v=Bfg0j9nZsQ0', from: 'Athletes\' Potential' }],
  M3: [
    { url: 'https://www.youtube.com/watch?v=gJzC9BQVr0Q', from: 'React Physical Therapy' },
    { url: 'https://www.youtube.com/watch?v=FWuM8Rh_iPs', from: 'Garrett McLaughlin', label: 'The squeeze' },
  ],
  M4: [{ url: 'https://www.youtube.com/watch?v=Ja4kZX4YMXI', from: 'Ryan Saplan', note: 'Long video. The move is in the first minute.' }],
  M5: [{ url: 'https://www.youtube.com/watch?v=nLNqEQ4B6XI', from: 'Dr. Carl Baird' }],
  M6: [{ url: 'https://www.youtube.com/watch?v=4J7kbCmPScQ', from: 'Medibank' }],
  M8: [{ url: 'https://www.youtube.com/watch?v=WLuYol-hCS8', from: 'E3 Rehab' }],
  M9: [{ url: 'https://www.youtube.com/watch?v=vGGLPwlbAl0', from: 'Girls Gone Strong' }],
  M11: [{ url: 'https://www.youtube.com/watch?v=-g0nuyTHMrI', from: 'AskDoctorJo' }],
  P1: [{ url: 'https://www.youtube.com/watch?v=cY_JnMQl6d4', from: 'Gold In The Net', note: 'On ice. Same stance off the ice.' }],
  P2: [{ url: 'https://www.youtube.com/watch?v=0T-xvW1dL3c', from: 'Gold In The Net', note: 'On ice. Off the ice it\'s the same push, just shorter.' }],
  P3: [{ url: 'https://www.youtube.com/watch?v=nIMZATYPfSg', from: 'Goalrobber', note: 'On ice. Off the ice it\'s a push and a step.' }],
  P4: [{ url: 'https://www.youtube.com/watch?v=axenBeFroHQ', from: 'Hockey Training', note: 'He keeps going. You freeze two seconds on every landing.' }],
  P8: [{ url: 'https://www.youtube.com/watch?v=by9L5Cvbpw4', from: 'Vishant Dave', start: 50 }],
  S2: [{ url: 'https://www.youtube.com/watch?v=DPFnfAUCvTA', from: 'Horton Barbell' }],
  S3: [{ url: 'https://www.youtube.com/watch?v=jWD8_iBkND0', from: 'Dana-Farber', start: 247 }],
  C1: [{ url: 'https://www.youtube.com/watch?v=oV1_T-5ksj8', from: 'Health By Scott', start: 34 }],
  C6: [{ url: 'https://www.youtube.com/watch?v=kzYkGZ3Aa50', from: 'Cressey Performance' }],
  G1: [{ url: 'https://www.youtube.com/watch?v=_ZE5oF1qaWo', from: 'Elite Performance Institute' }],
  G2: [{ url: 'https://www.youtube.com/watch?v=Cx9BcC-Uq-Y', from: 'Nottingham Physio' }],
  X3: [{ url: 'https://www.youtube.com/watch?v=wfzgrmavW2k', from: 'Lauren Miller', note: 'She adds a ball squeeze. You don\'t need to.' }],
  X5: [{ url: 'https://www.youtube.com/watch?v=lJvjLzJKjb0', from: 'OrthoIndy' }],
};

export const demoUrl = (d) => (d.start ? `${d.url}&t=${d.start}s` : d.url);
