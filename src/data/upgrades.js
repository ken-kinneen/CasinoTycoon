// Every upgrade is data. `effects` is a list of { stat, add } or { stat, mul }.
// `model` is an optional key the world builder uses to change the 3D scene.
// `blurb` is the owner's own justification. He is not a good person.
// `tags` is an optional array for filtering (e.g. 'starter' for tutorial choices).
// `spawns` puts physical machines/tables into inventory for build-mode placement.
//   machines/tables stats are derived from what's on the floor, not from effects.

export const AD_UPGRADES = [
  { id: 'ad_flyers', name: 'Gutter Flyers', cost: 150, blurb: 'Printed on the back of missing-cat posters. Waste not.', model: 'flyer', effects: [{ stat: 'trafficPerMin', add: 0.3 }] },
  { id: 'ad_cardstock', name: 'Slippery Card Stock', cost: 300, blurb: 'Laminated so it slides into a pocket like a greased eel.', model: 'cardstock', effects: [{ stat: 'cardWidth', add: 0.06 }] },
  { id: 'ad_lemonade', name: 'Sponsor the Kids\' Lemonade Stand', cost: 600, blurb: 'Every cup comes with a coupon. Start them young.', model: 'lemonade', effects: [{ stat: 'trafficPerMin', add: 0.5 }, { stat: 'heat', add: 3 }] },
  { id: 'ad_bus', name: 'School Bus Wrap', cost: 1200, blurb: 'Route 9 goes past three schools. That\'s three schools of future regulars.', model: 'bus', effects: [{ stat: 'trafficPerMin', add: 1 }, { stat: 'heat', add: 8 }] },
  { id: 'ad_jingle', name: '"Everybody Wins!" Radio Jingle', cost: 2000, blurb: 'Nobody wins. But it rhymes.', model: 'radio', effects: [{ stat: 'cardWidth', add: 0.05 }, { stat: 'trafficPerMin', add: 0.8 }] },
  { id: 'ad_shuttle', name: 'Retirement Home Shuttle', cost: 3500, blurb: 'Free ride there. The ride back is... negotiable.', model: 'shuttle', effects: [{ stat: 'trafficPerMin', add: 1.5 }, { stat: 'stayTime', mul: 1.15 }, { stat: 'heat', add: 5 }] },
  { id: 'ad_testimonials', name: 'Fake Winner Testimonials', cost: 5000, blurb: 'Meet "Linda", who won a boat. Linda is my cousin. There is no boat.', model: 'testimonials', effects: [{ stat: 'cardWidth', add: 0.06 }, { stat: 'prestige', add: 5 }] },
  { id: 'ad_spam', name: 'Spam Text Blast', cost: 8000, blurb: 'WE HAVE UR NUMBER. COME PLAY. THIS IS NOT A THREAT (it is).', model: 'phone', effects: [{ stat: 'trafficPerMin', add: 2 }, { stat: 'heat', add: 6 }] },
  { id: 'ad_church', name: 'Church Bulletin Ads', cost: 12000, blurb: 'Right under the prayer list. They\'re already hoping for a miracle.', model: 'church', effects: [{ stat: 'trafficPerMin', add: 1.5 }, { stat: 'sharpness', add: -0.05 }] },
  { id: 'ad_payday', name: 'Payday Loan Partnership', cost: 18000, blurb: 'A loan kiosk by the door. 400% APR. We split the interest.', model: 'moneystack', effects: [{ stat: 'spendPerMin', mul: 1.15 }, { stat: 'heat', add: 10 }] },
  { id: 'ad_billboard', name: 'Highway Billboard', cost: 30000, blurb: 'Forty feet of my face. Drivers can\'t look away. Some crash.', model: 'billboard', effects: [{ stat: 'trafficPerMin', add: 3 }] },
  { id: 'ad_influencer', name: 'Influencer Bribes', cost: 50000, blurb: '#blessed #sponsored #notarigged', model: 'phone', effects: [{ stat: 'trafficPerMin', add: 4 }, { stat: 'prestige', add: 10 }] },
  { id: 'ad_subliminal', name: 'Subliminal Cinema Frames', cost: 80000, blurb: 'One frame every 24. Popcorn sales are down, our sales are up.', model: 'filmreel', effects: [{ stat: 'cardWidth', add: 0.08 }, { stat: 'trafficPerMin', add: 3 }] },
  { id: 'ad_airport', name: 'Fake "Winner\'s" Airport Shuttle', cost: 150000, blurb: 'It says VIP on the side. It stops here. Only here.', model: 'airportshuttle', effects: [{ stat: 'trafficPerMin', add: 6 }, { stat: 'prestige', add: 10 }, { stat: 'heat', add: 8 }] },
  { id: 'ad_tv', name: 'National TV Campaign', cost: 300000, blurb: 'Prime time. Between the news and the lottery. Perfect placement.', model: 'tvscreen', effects: [{ stat: 'trafficPerMin', add: 10 }, { stat: 'cardWidth', add: 0.08 }, { stat: 'prestige', add: 15 }] },
];

// Casinos start with 0 machines, 0 tables, 0 traffic — everything is bought.
// Slot/table upgrades use `spawns` (inventory) instead of machines/tables effects.
export const CASINO_UPGRADES = {
  duck: [
    { id: 'd_slot1', name: 'Your First Slot Machine', cost: 150, blurb: 'One machine. One dream. Pulled it out of a skip behind the bowling alley.', model: 'machines', tags: ['starter'], group: 'slots', spawns: { type: 'machine', count: 1 }, effects: [] },
    { id: 'd_roulette1', name: 'A Roulette Table', cost: 150, blurb: 'The wheel is slightly warped. That\'s a feature.', model: 'tables', tags: ['starter'], group: 'tables', spawns: { type: 'table', count: 1 }, effects: [] },
    { id: 'd_slots1', name: 'Two More Slot Machines', cost: 250, blurb: 'Fell off a truck. I was driving the truck.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 2 }, effects: [] },
    { id: 'd_walkins', name: 'Open-Door Policy', cost: 200, blurb: 'Leave the door open. Someone will wander in eventually.', model: 'noclocks', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 0.6 }] },
    { id: 'd_clocks', name: 'Remove the Clocks', cost: 300, blurb: 'Time is a construct. So is their retirement fund.', model: 'noclocks', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.1 }] },
    { id: 'd_windows', name: 'Board Up the Windows', cost: 400, blurb: 'Daylight reminds people they have lives.', model: 'windows', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.1 }] },
    { id: 'd_drinks', name: 'Double-Pour Drinks', cost: 500, blurb: 'Free drinks, twice the vodka. Generosity.', model: 'bar', group: 'spending', effects: [{ stat: 'sharpness', add: -0.08 }, { stat: 'spendPerMin', mul: 1.1 }] },
    { id: 'd_neon', name: 'Flickering Neon Sign', cost: 800, blurb: 'Half the letters work. It\'s called ambience.', model: 'neon', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 0.5 }, { stat: 'prestige', add: 5 }] },
    { id: 'd_oxygen', name: 'Extra Oxygen in the AC', cost: 1000, blurb: 'They feel great. They feel awake. They feel like one more spin.', model: 'vents', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.15 }] },
    { id: 'd_tighten', name: 'Tighten the Slots', cost: 1200, blurb: 'The payout chip is now a drawing of a payout chip.', model: 'slotwrench', group: 'edge', effects: [{ stat: 'houseEdge', mul: 1.2 }, { stat: 'heat', add: 4 }] },
    { id: 'd_peanuts', name: 'Free Peanuts (Extra Salty)', cost: 1500, blurb: 'Thirsty people buy drinks. Drunk people buy spins.', model: 'peanuts', group: 'spending', effects: [{ stat: 'spendPerMin', mul: 1.1 }] },
    { id: 'd_atm', name: 'Lobby ATM (9% fee)', cost: 2000, blurb: 'Their money never has to leave the building. Neither do they.', model: 'atm', group: 'spending', effects: [{ stat: 'spendPerMin', mul: 1.2 }, { stat: 'heat', add: 3 }] },
    { id: 'd_marshal', name: 'Bribe the Fire Marshal', cost: 2500, blurb: 'Max occupancy is now whatever I write on the sign.', model: 'badge', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 0.8 }, { stat: 'heat', add: -5 }] },
    { id: 'd_bouncer', name: 'Hire a Bouncer', cost: 3000, blurb: 'His job is not keeping people out.', model: 'bouncer', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.1 }, { stat: 'heat', add: 2 }] },
    { id: 'd_slots2', name: 'Four More Slot Machines', cost: 3500, blurb: 'Different truck.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 4 }, effects: [] },
    { id: 'd_hoppers', name: 'Bigger Cash Hoppers', cost: 4000, blurb: 'Fewer trips to the safe. More time for evil.', model: 'hopper', group: 'operations', effects: [{ stat: 'hopperCap', mul: 2 }] },
    { id: 'd_gas', name: 'Laughing Gas in the AC', cost: 5000, blurb: 'Everyone\'s having a wonderful time. Medically.', model: 'gas', group: 'operations', effects: [{ stat: 'sharpness', add: -0.12 }, { stat: 'stayTime', mul: 1.15 }, { stat: 'heat', add: 10 }] },
    { id: 'd_cart', name: 'Armored Cart Service', cost: 8000, blurb: 'A guy with a cart collects a cut every minute. Great guy. Owes me.', model: 'cart', group: 'operations', effects: [{ stat: 'autoCollect', add: 0.1 }] },
  ],
  rat: [
    { id: 'r_slots0', name: 'Starter Slot Bank', cost: 6000, blurb: 'Gotta fill this empty floor with something shiny.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 4 }, effects: [] },
    { id: 'r_table0', name: 'First Dealer Table', cost: 6000, blurb: 'A proper table for a proper racket.', model: 'tables', group: 'tables', spawns: { type: 'table', count: 1 }, effects: [] },
    { id: 'r_footfall', name: 'Downtown Foot Traffic', cost: 5000, blurb: 'Location, location, location. And a guy outside with a sign.', model: 'noclocks', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 2.2 }] },
    { id: 'r_slots1', name: 'Slot Bank Expansion', cost: 8000, blurb: 'A whole wall of blinking hope.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 6 }, effects: [] },
    { id: 'r_maze', name: 'Maze Carpet Layout', cost: 8000, blurb: 'The exit is that way. And that way. And that way.', model: 'carpet', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.15 }] },
    { id: 'r_drinks', name: 'Bottomless Well Drinks', cost: 10000, blurb: 'The well is bottomless. The vodka is 12 dollars a jug.', model: 'bar', group: 'spending', effects: [{ stat: 'sharpness', add: -0.1 }, { stat: 'spendPerMin', mul: 1.1 }] },
    { id: 'r_table', name: 'Second Dealer Table', cost: 12000, blurb: 'Twice the tables, twice the hands I get to deal.', model: 'tables', group: 'tables', spawns: { type: 'table', count: 1 }, effects: [] },
    { id: 'r_commission', name: 'Bribe the Gaming Commission', cost: 15000, blurb: 'Their audit found nothing. I found their price.', model: 'badge', group: 'heat', effects: [{ stat: 'heat', add: -12 }] },
    { id: 'r_roulette', name: 'Rigged Roulette Wheels', cost: 18000, blurb: 'Magnets. Lots of magnets.', model: 'roulette', group: 'edge', effects: [{ stat: 'houseEdge', mul: 1.25 }, { stat: 'heat', add: 8 }] },
    { id: 'r_statue', name: 'Golden Rat Statue', cost: 20000, blurb: 'Solid gold-painted plaster. Tourists love it. Rats love it.', model: 'statue', group: 'prestige', effects: [{ stat: 'prestige', add: 10 }] },
    { id: 'r_rooms', name: '"Complimentary" Hotel Rooms', cost: 25000, blurb: 'The doors lock from the outside. For their safety.', model: 'hotelkey', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.25 }, { stat: 'heat', add: 6 }] },
    { id: 'r_cameras', name: 'Hidden Cameras Everywhere', cost: 30000, blurb: 'I can see their cards. I can see their souls.', model: 'cameras', group: 'edge', effects: [{ stat: 'houseEdge', mul: 1.1 }, { stat: 'sharpness', add: -0.05 }] },
    { id: 'r_vault', name: 'Vault Upgrade', cost: 35000, blurb: 'Bigger hoppers, a chute to the vault. Money flows downhill.', model: 'vault', group: 'operations', effects: [{ stat: 'hopperCap', mul: 2 }, { stat: 'autoCollect', add: 0.1 }] },
    { id: 'r_vip', name: 'VIP Whale Lounge', cost: 45000, blurb: 'Velvet ropes. Behind them: more velvet ropes.', model: 'vip', group: 'prestige', effects: [{ stat: 'prestige', add: 15 }, { stat: 'spendPerMin', mul: 1.15 }] },
    { id: 'r_perfume', name: 'Pheromone Perfume in the Vents', cost: 50000, blurb: 'It smells like winning. Chemically.', model: 'vents', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.15 }, { stat: 'heat', add: 5 }] },
    { id: 'r_buffet', name: 'Free Buffet (Very Salty)', cost: 60000, blurb: 'All you can eat. All you can drink. All you can lose.', model: 'buffet', group: 'spending', effects: [{ stat: 'spendPerMin', mul: 1.15 }, { stat: 'trafficPerMin', add: 1 }] },
    { id: 'r_slots2', name: 'Slot Bank Expansion II', cost: 70000, blurb: 'The wall of hope now has a second wall.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 8 }, effects: [] },
    { id: 'r_mayor', name: 'Mayor on the Payroll', cost: 90000, blurb: 'He cut the ribbon. He also cut the zoning laws.', model: 'badge', group: 'heat', effects: [{ stat: 'heat', add: -20 }, { stat: 'stayTime', mul: 1.15 }] },
  ],
  diablo: [
    { id: 'p_floor0', name: 'Opening Day Slot Floor', cost: 100000, blurb: 'Can\'t open a Vegas casino with nothing on the floor.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 10 }, effects: [] },
    { id: 'p_tables0', name: 'Opening Day Tables', cost: 100000, blurb: 'Two tables, velvet felt, and the smell of ambition.', model: 'tables', group: 'tables', spawns: { type: 'table', count: 2 }, effects: [] },
    { id: 'p_strip', name: 'Strip Location Traffic', cost: 80000, blurb: 'The Strip delivers. They walk past. They walk in. They don\'t walk out.', model: 'noclocks', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 6 }] },
    { id: 'p_slots1', name: 'Mega Slot Floor', cost: 120000, blurb: 'Rows to the horizon. The horizon is also a slot machine.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 10 }, effects: [] },
    { id: 'p_sky', name: 'Fake Sky Ceiling (Always 2pm)', cost: 150000, blurb: 'It is always a lovely afternoon. Forever.', model: 'sky', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.2 }] },
    { id: 'p_volcano', name: 'Volcano Fountain Show', cost: 180000, blurb: 'Every 15 minutes it erupts. The insurance guy erupted once.', model: 'volcano', group: 'prestige', effects: [{ stat: 'trafficPerMin', add: 4 }, { stat: 'prestige', add: 15 }] },
    { id: 'p_sportsbook', name: 'Wire the Sportsbook', cost: 220000, blurb: 'I know the score before the game. Sometimes before the season.', model: 'sportsbook', group: 'edge', effects: [{ stat: 'houseEdge', mul: 1.2 }, { stat: 'heat', add: 8 }] },
    { id: 'p_tables', name: 'Two High-Roller Tables', cost: 250000, blurb: 'Minimum bet: your house.', model: 'tables', group: 'tables', spawns: { type: 'table', count: 2 }, effects: [] },
    { id: 'p_senator', name: 'Senator on Retainer', cost: 300000, blurb: 'He filibustered a bill about me. For eleven hours. Bless him.', model: 'badge', group: 'heat', effects: [{ stat: 'heat', add: -25 }] },
    { id: 'p_fog', name: 'Champagne Fog Machines', cost: 350000, blurb: 'You can breathe the bubbly. You will breathe the bubbly.', model: 'fog', group: 'stayTime', effects: [{ stat: 'sharpness', add: -0.15 }, { stat: 'stayTime', mul: 1.1 }, { stat: 'heat', add: 6 }] },
    { id: 'p_chimes', name: 'Hypnotic Slot Chimes', cost: 400000, blurb: 'Tuned to the exact frequency of "just one more".', model: 'radio', group: 'spending', effects: [{ stat: 'spendPerMin', mul: 1.2 }] },
    { id: 'p_jet', name: 'Private Jet Whale Pickups', cost: 500000, blurb: 'We fly them in. We do not fly them out.', model: 'jet', group: 'prestige', effects: [{ stat: 'prestige', add: 25 }, { stat: 'trafficPerMin', add: 3 }] },
    { id: 'p_rail', name: 'Underground Vault Rail', cost: 550000, blurb: 'A little train that carries money to me. I named it.', model: 'traincart', group: 'operations', effects: [{ stat: 'autoCollect', add: 0.2 }, { stat: 'hopperCap', mul: 2 }] },
    { id: 'p_chips', name: 'Chips That Look Bigger Than They Are', cost: 600000, blurb: 'A $5 chip the size of a dinner plate. Feels like nothing to lose.', model: 'bigchip', group: 'spending', effects: [{ stat: 'spendPerMin', mul: 1.15 }, { stat: 'sharpness', add: -0.05 }] },
    { id: 'p_exits', name: '"Lost" Exit Signs', cost: 650000, blurb: 'The fire code says exits must be marked. It doesn\'t say correctly.', model: 'exitsign', group: 'stayTime', effects: [{ stat: 'stayTime', mul: 1.15 }, { stat: 'heat', add: 10 }] },
    { id: 'p_tower', name: 'Casino Hotel Tower', cost: 800000, blurb: 'Forty floors. No checkout desk.', model: 'tower', group: 'traffic', effects: [{ stat: 'trafficPerMin', add: 5 }, { stat: 'stayTime', mul: 1.2 }] },
    { id: 'p_slots2', name: 'Mega Slot Floor II', cost: 900000, blurb: 'We ran out of floor so we built more floor.', model: 'machines', group: 'slots', spawns: { type: 'machine', count: 15 }, effects: [] },
    { id: 'p_governor', name: 'Own the Governor', cost: 1200000, blurb: 'Not bribe. Own. There\'s a receipt.', model: 'badge', group: 'heat', effects: [{ stat: 'heat', add: -40 }, { stat: 'houseEdge', mul: 1.1 }] },
  ],
};

// Cosmetic awards — now earned through achievements, not purchased.
export const AWARDS = [];
