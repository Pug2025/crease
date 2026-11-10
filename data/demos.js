// Demo videos for the drill cards. Every one was checked against the drill's cues by looking at
// frames from the video (research/DEMOS_VETTED.md and DEMOS_VETTED_2.md). They need the internet;
// the drawings work without it. start = seconds in. note = what to do differently.

export const DEMOS = {
  W3: [
    { url: 'https://www.youtube.com/watch?v=difYoBtZi2s', from: 'PureGym', label: 'Front and back', note: 'Keep a hand on the wall and swing lower than this.' },
    { url: 'https://www.youtube.com/watch?v=unBmbI1nTQw', from: 'Commit To Life Fitness', label: 'Side to side' },
  ],
  W4: [{ url: 'https://www.youtube.com/watch?v=i2XQGTAxqow', from: 'Onward ATL', note: 'Same move with a band. You don\'t need one.' }],
  W6: [{ url: 'https://www.youtube.com/watch?v=0T-xvW1dL3c', from: 'Gold In The Net', note: 'On ice. Same shuffle off the ice.' }],
  ST1: [{ url: 'https://www.youtube.com/watch?v=WDIpL0pjun0', from: 'NASM' }],
  ST2: [{ url: 'https://www.youtube.com/watch?v=cWTZ8Am1Ee0', from: 'Medbridge', note: 'Same move. Keep your hands off your legs.' }],
  ST3: [{ url: 'https://www.youtube.com/watch?v=P-yaD24bUE8', from: 'Runna' }],
  ST4: [{ url: 'https://www.youtube.com/watch?v=mwlp75MS6Rg', from: 'NASM' }],
  C3: [{ url: 'https://www.youtube.com/watch?v=ohaXbjftkYc', from: 'Dr. Chris Pieton' }],
  S3: [{ url: 'https://www.youtube.com/watch?v=jWD8_iBkND0', from: 'Dana-Farber', start: 247 }],
  S4: [{ url: 'https://www.youtube.com/watch?v=tmhESsZcpDY', from: 'E3 Rehab' }],
  W7: [{ url: 'https://www.youtube.com/watch?v=tqp5XQPpTxY', from: 'PureGym' }],
  G1: [{ url: 'https://www.youtube.com/watch?v=_ZE5oF1qaWo', from: 'Elite Performance Institute' }],
  C9: [{ url: 'https://www.youtube.com/watch?v=CQk4MHY2_Tc', from: 'Runna' }],
  P11: [{ url: 'https://www.youtube.com/watch?v=UxIgk7hsfI0', from: 'AFL High Performance', note: 'Same move. He keeps his hands on his hips.' }],
  P4: [{ url: 'https://www.youtube.com/watch?v=axenBeFroHQ', from: 'Hockey Training', note: 'He keeps going. You stick each landing for a second.' }],
  P13: [{ url: 'https://www.youtube.com/watch?v=w0K_JROl7Sc', from: 'GoalieTrainingProTV', note: 'A goalie push into a side lunge. Yours adds three shuffles first.' }],
  P12: [
    { url: 'https://www.youtube.com/watch?v=NCqbpkoiyXE', from: 'Nuffield Health', note: 'Same move. Skip any push-up you see.' },
    { url: 'https://www.youtube.com/watch?v=GRPg9z9STjw', from: 'Yeah She Tried That', label: 'No-jump version' },
  ],
  P8: [{ url: 'https://www.youtube.com/watch?v=by9L5Cvbpw4', from: 'Vishant Dave', start: 50 }],
  M1: [{ url: 'https://www.youtube.com/watch?v=f_7qIPxw6nE', from: 'PureGym', start: 15 }],
  M3: [{ url: 'https://www.youtube.com/watch?v=gJzC9BQVr0Q', from: 'React Physical Therapy' }],
  M5: [{ url: 'https://www.youtube.com/watch?v=nLNqEQ4B6XI', from: 'Dr. Carl Baird' }],
  M6: [{ url: 'https://www.youtube.com/watch?v=4J7kbCmPScQ', from: 'Medibank' }],
  M11: [{ url: 'https://www.youtube.com/watch?v=-g0nuyTHMrI', from: 'AskDoctorJo' }],
  X4: [{ url: 'https://www.youtube.com/watch?v=Il1L75v6gq0', from: 'AskDoctorJo' }],
  X5: [{ url: 'https://www.youtube.com/watch?v=lJvjLzJKjb0', from: 'OrthoIndy' }],
  X6: [{ url: 'https://www.youtube.com/watch?v=iIQx2Cx2NoQ', from: 'Garrett McLaughlin' }],
  X1: [{ url: 'https://www.youtube.com/watch?v=2FMOcD_jY5A', from: 'E3 Rehab' }],
  X3: [{ url: 'https://www.youtube.com/watch?v=wfzgrmavW2k', from: 'Lauren Miller', note: 'She adds a ball squeeze. You don\'t need to.' }],
};

export const demoUrl = (d) => (d.start ? `${d.url}&t=${d.start}s` : d.url);
