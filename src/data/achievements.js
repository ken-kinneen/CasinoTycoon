// Achievements guide the player through the game loop.
// Each has a `check(s, stats)` receiving the save state + computed stats,
// returning true when the condition is met.
//
// Rewards:
//   `reward`  — cash bonus paid on claim
//   `item`    — cosmetic model key granted on claim (placed in the world)
//   `effects` — stat effects applied permanently once claimed
//
// `hidden` achievements don't show name/hint until unlocked.

export const ACHIEVEMENTS = [
  // ---- Early game: teach the core loop ----
  {
    id: 'first_card',
    name: 'First Hustle',
    hint: 'Slip a card to someone on the sidewalk',
    icon: 'card',
    reward: 50,
    check: s => s.lifetimeCustomers >= 1,
  },
  {
    id: 'first_vault',
    name: 'Cracked It',
    hint: 'Vault crack to bank your hopper cash',
    icon: 'safe',
    reward: 100,
    check: s => s.lifetimeEarned >= 50,
  },
  {
    id: 'first_deal',
    name: 'House Rules',
    hint: 'Deal a hand at the table',
    icon: 'cards',
    reward: 75,
    check: (s, st) => st.tables >= 1 && s.lifetimeEarned >= 200,
  },
  {
    id: 'first_upgrade',
    name: 'First Improvement',
    hint: 'Buy your first upgrade from the Upgrades screen',
    icon: 'ledger',
    reward: 100,
    check: s => s.casinoUpgrades.duck.length >= 1 || s.adUpgrades.length >= 1,
  },

  // ---- Money milestones ----
  {
    id: 'earn_1k',
    name: 'Four Figures',
    hint: 'Earn $1,000 lifetime',
    icon: 'dollar',
    reward: 150,
    check: s => s.lifetimeEarned >= 1000,
  },
  {
    id: 'earn_5k',
    name: 'Stacking Paper',
    hint: 'Earn $5,000 lifetime',
    icon: 'dollar',
    reward: 300,
    item: 'toilet',
    check: s => s.lifetimeEarned >= 5000,
  },
  {
    id: 'earn_25k',
    name: 'Five-Figure Fraud',
    hint: 'Earn $25,000 lifetime',
    icon: 'dollar',
    reward: 500,
    item: 'selfstatue',
    check: s => s.lifetimeEarned >= 25000,
  },
  {
    id: 'earn_100k',
    name: 'Six Figures of Sin',
    hint: 'Earn $100,000 lifetime',
    icon: 'dollar',
    reward: 2000,
    item: 'namelights',
    check: s => s.lifetimeEarned >= 100000,
  },
  {
    id: 'earn_500k',
    name: 'Half a Million Reasons',
    hint: 'Earn $500,000 lifetime',
    icon: 'dollar',
    reward: 10000,
    item: 'fountain',
    check: s => s.lifetimeEarned >= 500000,
  },

  // ---- Guest milestones ----
  {
    id: 'guests_10',
    name: 'Revolving Door',
    hint: 'Fleece 10 guests',
    icon: 'people',
    reward: 150,
    check: s => s.lifetimeCustomers >= 10,
  },
  {
    id: 'guests_50',
    name: 'Regular Crowd',
    hint: 'Fleece 50 guests',
    icon: 'people',
    reward: 500,
    check: s => s.lifetimeCustomers >= 50,
  },
  {
    id: 'guests_200',
    name: 'Packed House',
    hint: 'Fleece 200 guests',
    icon: 'people',
    reward: 2000,
    item: 'tiger',
    check: s => s.lifetimeCustomers >= 200,
  },
  {
    id: 'guests_1000',
    name: 'Human Livestock',
    hint: 'Fleece 1,000 guests',
    icon: 'people',
    reward: 5000,
    hidden: true,
    check: s => s.lifetimeCustomers >= 1000,
  },

  // ---- Upgrade depth ----
  {
    id: 'upgrades_5',
    name: 'Renovating',
    hint: 'Own 5 casino upgrades',
    icon: 'building',
    reward: 250,
    check: s => {
      const total = Object.values(s.casinoUpgrades).reduce((a, arr) => a + arr.length, 0);
      return total >= 5;
    },
  },
  {
    id: 'upgrades_15',
    name: 'Interior Designer',
    hint: 'Own 15 casino upgrades across all casinos',
    icon: 'building',
    reward: 1000,
    hidden: true,
    check: s => {
      const total = Object.values(s.casinoUpgrades).reduce((a, arr) => a + arr.length, 0);
      return total >= 15;
    },
  },
  {
    id: 'ads_5',
    name: 'Marketing Genius',
    hint: 'Buy 5 advertising upgrades',
    icon: 'billboard',
    reward: 400,
    check: s => s.adUpgrades.length >= 5,
  },
  {
    id: 'ads_all',
    name: 'Everywhere, All at Once',
    hint: 'Own every advertising campaign',
    icon: 'billboard',
    reward: 5000,
    hidden: true,
    check: s => s.adUpgrades.length >= 15,
  },
  {
    id: 'skill_any_3',
    name: 'Trained Up',
    hint: 'Reach level 3 in any skill',
    icon: 'person',
    reward: 500,
    check: s => Object.values(s.skills).some(v => v >= 3),
  },
  {
    id: 'skill_any_5',
    name: 'Master of One',
    hint: 'Max out any skill to level 5',
    icon: 'crown',
    reward: 5000,
    check: s => Object.values(s.skills).some(v => v >= 5),
  },
  {
    id: 'skill_all_5',
    name: 'Renaissance Crook',
    hint: 'Max every skill to level 5',
    icon: 'crown',
    reward: 25000,
    hidden: true,
    check: s => Object.values(s.skills).every(v => v >= 5),
  },

  // ---- Expansion ----
  {
    id: 'casino_2',
    name: 'The Golden Rat',
    hint: 'Buy your second casino',
    icon: 'building',
    reward: 2000,
    check: s => s.ownedCasinos.includes(1),
  },
  {
    id: 'casino_3',
    name: 'Welcome to Vegas',
    hint: 'Buy the Palazzo Diablo',
    icon: 'tower',
    reward: 10000,
    check: s => s.ownedCasinos.includes(2),
  },

  // ---- Cosmetics from achievements ----
  {
    id: 'first_cosmetic',
    name: 'Trophy Case',
    hint: 'Earn your first cosmetic item from an achievement',
    icon: 'star',
    reward: 300,
    check: s => (s.achItems || []).length >= 1,
  },

  // ---- Time on the floor ----
  {
    id: 'time_10',
    name: 'Settling In',
    hint: 'Spend 10 minutes on the floor',
    icon: 'clock',
    reward: 100,
    check: s => s.playTime >= 600,
  },
  {
    id: 'time_30',
    name: 'Marathon Shift',
    hint: 'Spend 30 minutes on the floor',
    icon: 'clock',
    reward: 500,
    check: s => s.playTime >= 1800,
  },
  {
    id: 'time_60',
    name: 'Night Owl',
    hint: 'Spend an hour on the floor',
    icon: 'clock',
    reward: 2000,
    hidden: true,
    check: s => s.playTime >= 3600,
  },

  // ---- Hidden / secret ----
  {
    id: 'hoard_50k',
    name: 'Scrooge',
    hint: 'Have $50,000 cash on hand at once',
    icon: 'vault',
    reward: 1000,
    hidden: true,
    check: s => s.money >= 50000,
  },
  {
    id: 'all_casinos_upgraded',
    name: 'Maxed Out',
    hint: 'Fully upgrade all three casinos',
    icon: 'crown',
    reward: 50000,
    hidden: true,
    check: s => {
      const counts = { duck: 15, rat: 15, diablo: 15 };
      return Object.entries(counts).every(([k, n]) => (s.casinoUpgrades[k] || []).length >= n);
    },
  },
];
