// Five skill paths for the owner. Each has 5 levels. Level effects stack per level.
// `cosmetic` describes what changes on the owner model at each level.
export const SKILL_COSTS = [400, 1500, 5000, 20000, 80000];

export const SKILLS = [
  {
    id: 'sleight',
    name: 'Sleight of Hand',
    icon: '🃏',
    blurb: 'Slipping cards into pockets. Steadier hands, roomier pockets, better cards.',
    activity: 'Advertising',
    perLevel: [
      { stat: 'cardWidth', mul: 1.18 },
      { stat: 'cardTime', add: 5 },
      { stat: 'cardConversion', add: 0.03 },
    ],
    cosmetic: ['White gloves', 'Ring on every finger', 'Diamond pinky ring', 'Gold watch', 'Sleeve full of aces'],
  },
  {
    id: 'back',
    name: 'Strong Back',
    icon: '💪',
    blurb: 'Hauling cash from the hoppers to the safe. Bigger armfuls, more time.',
    activity: 'Cash Run',
    perLevel: [
      { stat: 'stackSize', mul: 1.35 },
      { stat: 'cashTime', add: 4 },
    ],
    cosmetic: ['Rolled sleeves', 'Broader shoulders', 'Weight belt', 'Money bag', 'Two money bags'],
  },
  {
    id: 'poker',
    name: 'Poker Face',
    icon: '🎩',
    blurb: 'Dealing at the table. A wider margin, a slower count, and bigger bets.',
    activity: 'Dealer',
    perLevel: [
      { stat: 'dealerMargin', add: 1 },
      { stat: 'dealerBet', mul: 1.25 },
      { stat: 'dealerSpeed', mul: 0.9 },
    ],
    cosmetic: ['Dealer visor', 'Sunglasses', 'Cigar', 'Top hat', 'Gold top hat'],
  },
  {
    id: 'tongue',
    name: 'Silver Tongue',
    icon: '🐍',
    blurb: 'Talking people out of their money. They spend more and stay longer.',
    activity: 'Passive',
    perLevel: [
      { stat: 'spendPerMin', mul: 1.07 },
      { stat: 'stayTime', mul: 1.05 },
    ],
    cosmetic: ['Gold tooth', 'Gold chain', 'Two gold chains', 'Fur collar', 'Full fur coat'],
  },
  {
    id: 'feet',
    name: 'Fast Feet',
    icon: '👞',
    blurb: 'Hustle. Move faster between activities, and word spreads faster too.',
    activity: 'Movement',
    perLevel: [
      { stat: 'walkSpeed', mul: 1.15 },
      { stat: 'trafficPerMin', mul: 1.05 },
    ],
    cosmetic: ['Shined shoes', 'Red shoes', 'Cane', 'Gold cane', 'Cape'],
  },
];
