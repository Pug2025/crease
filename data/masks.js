// Goalie masks he unlocks with his best streak ever, so a broken streak never takes one away.
// Each image is media/masks/<id>.webp, square.
export const MASKS = [
  { id: 'm0', name: 'Rookie', streak: 0 },
  { id: 'm1', name: 'Ice', streak: 3 },
  { id: 'm2', name: 'Bolt', streak: 7 },
  { id: 'm3', name: 'Shark', streak: 14 },
  { id: 'm4', name: 'Wolf', streak: 30 },
  { id: 'm5', name: 'Dragon', streak: 60 },
  { id: 'm6', name: 'Champ', streak: 100 },
];

export const maskSrc = (id) => `media/masks/${id}.webp`;
