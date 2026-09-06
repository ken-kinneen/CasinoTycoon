// Five skill paths for the owner. Each has 5 levels. Level effects stack per level.
// `cosmetic` describes what changes on the owner model at each level.
// `slot` determines which body slot the cosmetic occupies — only one item per slot.
export const SKILL_COSTS = [400, 1500, 5000, 20000, 80000];

export const COSMETIC_SLOTS = {
  hat:       { label: 'Hat' },
  glasses:   { label: 'Glasses' },
  smoking:   { label: 'Smoking' },
  neck:      { label: 'Neck' },
  torso:     { label: 'Torso' },
  hands:     { label: 'Hands' },
  waist:     { label: 'Waist' },
  held:      { label: 'Held' },
  shoes:     { label: 'Shoes' },
};

// All cosmetic items. `key` = unique id, `slot` = body slot, `source` = how it's unlocked.
export const COSMETICS = [
  { key: 'sleight_1', slot: 'hands',   name: 'White Gloves',       desc: 'Pristine white gloves',           source: 'sleight', level: 1 },
  { key: 'sleight_2', slot: 'hands',   name: 'Gold Rings',         desc: 'Gold ring on every finger',       source: 'sleight', level: 2 },
  { key: 'sleight_3', slot: 'hands',   name: 'Diamond Ring',       desc: 'Diamond pinky ring (glows)',      source: 'sleight', level: 3 },
  { key: 'sleight_4', slot: 'hands',   name: 'Gold Watch',         desc: 'Heavy gold watch on wrist',       source: 'sleight', level: 4 },
  { key: 'sleight_5', slot: 'hands',   name: 'Ace Up Sleeve',      desc: 'Card peeking from sleeve',        source: 'sleight', level: 5 },

  { key: 'back_1',    slot: 'torso',   name: 'Rolled Sleeves',     desc: 'Sleeves rolled to the elbow',     source: 'back',    level: 1 },
  { key: 'back_2',    slot: 'torso',   name: 'Broad Shoulders',    desc: 'Wider, more imposing frame',      source: 'back',    level: 2 },
  { key: 'back_3',    slot: 'waist',   name: 'Weight Belt',        desc: 'Thick leather belt',              source: 'back',    level: 3 },
  { key: 'back_4',    slot: 'waist',   name: 'Money Bag',          desc: 'Burlap money bag on left hip',    source: 'back',    level: 4 },
  { key: 'back_5',    slot: 'waist',   name: 'Two Money Bags',     desc: 'Bags of cash on both hips',       source: 'back',    level: 5 },

  { key: 'poker_1',   slot: 'hat',     name: 'Dealer Visor',       desc: 'Green translucent dealer visor',  source: 'poker',   level: 1 },
  { key: 'poker_2',   slot: 'glasses', name: 'Sunglasses',         desc: 'Dark shades — no tells',          source: 'poker',   level: 2 },
  { key: 'poker_3',   slot: 'smoking', name: 'Cigar',              desc: 'Fat cigar, always lit',           source: 'poker',   level: 3 },
  { key: 'poker_4',   slot: 'hat',     name: 'Top Hat',            desc: 'Black top hat with red band',     source: 'poker',   level: 4 },
  { key: 'poker_5',   slot: 'hat',     name: 'Gold Top Hat',       desc: 'Solid gold top hat',              source: 'poker',   level: 5 },

  { key: 'tongue_1',  slot: 'neck',    name: 'Gold Tooth',         desc: 'Gold tooth in the sneer',         source: 'tongue',  level: 1 },
  { key: 'tongue_2',  slot: 'neck',    name: 'Gold Chain',         desc: 'Gold chain necklace',             source: 'tongue',  level: 2 },
  { key: 'tongue_3',  slot: 'neck',    name: 'Two Chains',         desc: 'Double chains with pendant',      source: 'tongue',  level: 3 },
  { key: 'tongue_4',  slot: 'torso',   name: 'Fur Collar',         desc: 'Fur collar on shoulders',         source: 'tongue',  level: 4 },
  { key: 'tongue_5',  slot: 'torso',   name: 'Full Fur Coat',      desc: 'Full-length fur coat',            source: 'tongue',  level: 5 },

  { key: 'feet_1',    slot: 'shoes',   name: 'Shined Shoes',       desc: 'Polished to a mirror shine',      source: 'feet',    level: 1 },
  { key: 'feet_2',    slot: 'shoes',   name: 'Red Shoes',          desc: 'Red leather shoes',               source: 'feet',    level: 2 },
  { key: 'feet_3',    slot: 'held',    name: 'Cane',               desc: 'Walking cane with gold knob',     source: 'feet',    level: 3 },
  { key: 'feet_4',    slot: 'held',    name: 'Gold Cane',          desc: 'Solid gold walking cane',         source: 'feet',    level: 4 },
  { key: 'feet_5',    slot: 'torso',   name: 'Cape',               desc: 'Flowing red cape',                source: 'feet',    level: 5 },

  // Achievement-unlocked wearables
  { key: 'ach_shades',         slot: 'glasses', name: 'Mirrored Sunglasses',    desc: 'Chrome mirrors — see everything, show nothing', source: 'achievement' },
  { key: 'ach_diamond_shades', slot: 'glasses', name: 'Diamond-Studded Shades', desc: 'Sunglasses rimmed with real diamonds',         source: 'achievement' },
  { key: 'ach_street_chain',   slot: 'neck',    name: 'Street Chain',           desc: 'Thick gold chain — earned the hard way',      source: 'achievement' },
  { key: 'ach_boss_cigar',     slot: 'smoking', name: 'Boss Cigar',             desc: 'Fat cigar that says you own the floor',       source: 'achievement' },
  { key: 'ach_crown',          slot: 'hat',     name: 'Empire Crown',           desc: 'A gaudy gold crown for the casino king',      source: 'achievement' },
];

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
    ],
    cosmetic: ['White gloves', 'Ring on every finger', 'Diamond pinky ring', 'Gold watch', 'Sleeve full of aces'],
  },
  {
    id: 'back',
    name: 'Sharp Memory',
    icon: '💪',
    blurb: 'Cracking the vault. A sharper mind means bigger hoppers and fatter stacks.',
    activity: 'Vault Crack',
    perLevel: [
      { stat: 'hopperCap', mul: 1.3 },
      { stat: 'spendPerMin', mul: 1.08 },
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
