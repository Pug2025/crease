// Goalie masks. Each has one rule; js/plan/card.js checks them. Once earned, a mask is his for
// good (save.card.earned), so a broken streak or a slow day never takes one away.
// Each image is media/masks/<id>.webp, square.
//
// by: 'streak' best streak ever · 'sessions' counted sessions · 'type' counted sessions of one
// kind · 'rung' splits rung reached · 'faster' best counted score in a game at least 10% under
// his first counted score · 'comeback' a 3-day streak after losing one of 7 or more ·
// 'boss' Boss days beaten.
// secret: the shelf shows "Secret" and "???" until he earns it.
export const MASKS = [
  { id: 'm0', name: 'Rookie', by: 'streak', n: 0 },
  { id: 'm1', name: 'Ice', by: 'streak', n: 3 },
  { id: 'm2', name: 'Bolt', by: 'streak', n: 7 },
  { id: 'm3', name: 'Shark', by: 'streak', n: 14 },
  { id: 'm4', name: 'Wolf', by: 'streak', n: 30 },
  { id: 'm5', name: 'Dragon', by: 'streak', n: 60 },
  { id: 'm6', name: 'Champ', by: 'streak', n: 100 },
  { id: 'm7', name: 'Viper', by: 'sessions', n: 20 },
  { id: 'm8', name: 'Bull', by: 'type', type: 'strength', n: 12 },
  { id: 'm9', name: 'Rocket', by: 'type', type: 'power', n: 5 },
  { id: 'm10', name: 'Spider', by: 'rung', n: 5 },
  { id: 'm11', name: 'Laser', by: 'faster', game: 'lights' },
  { id: 'm12', name: 'Hawk', by: 'faster', game: 'hands' },
  { id: 'm13', name: 'Viking', by: 'sessions', n: 50 },
  { id: 'm14', name: 'Ace', by: 'type', type: 'gameday', n: 5, secret: true },
  { id: 'm15', name: 'Phoenix', by: 'comeback', secret: true },
  { id: 'm16', name: 'Titan', by: 'sessions', n: 100 },
  { id: 'm17', name: 'Cyclops', by: 'boss', n: 3 },
];

// How much faster his best must be than his first counted score: 10%.
export const FASTER = 0.9;

export const maskSrc = (id) => `media/masks/${id}.webp`;
