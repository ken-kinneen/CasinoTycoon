// Inline SVG icon set (24x24, stroke-based). Keeps the UI free of emoji.
const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  card:      P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  safe:      P('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1M19 7v10"/>'),
  cards:     P('<rect x="4" y="3" width="11" height="15" rx="2" transform="rotate(-8 9 10)"/><rect x="9" y="6" width="11" height="15" rx="2" transform="rotate(8 15 13)"/><path d="M14 11l1.5 2.5L14 16l-1.5-2.5z" fill="currentColor"/>'),
  ledger:    P('<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M4 4v14a2 2 0 0 0 2 2h12"/><path d="M8 8h6M8 12h6"/>'),
  machine:   P('<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="7" width="8" height="4"/><path d="M9 15h6M19 8h2v4"/>'),
  gas:       P('<path d="M7 16a4 4 0 0 1 .5-8A5 5 0 0 1 17 9a3.5 3.5 0 0 1 0 7z"/><path d="M9 20c1-1 1-2 0-3M13 20c1-1 1-2 0-3"/>'),
  drink:     P('<path d="M5 4h14l-7 8z"/><path d="M12 12v7M8 19h8"/>'),
  eye:       P('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>'),
  bus:       P('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 11h18M7 17v2M17 17v2"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/>'),
  billboard: P('<rect x="3" y="4" width="18" height="11" rx="1"/><path d="M12 15v5M8 20h8"/><path d="M7 8h6M7 11h4"/>'),
  dollar:    P('<path d="M12 3v18"/><path d="M16 7.5c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5S10 10 12 10s4 .8 4 2.5-1.8 2.5-4 2.5-4-1-4-2.5"/>'),
  star:      P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  flame:     P('<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c0-3 2-5 2-8z"/>'),
  person:    P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
  people:    P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>'),
  clock:     P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  window:    P('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>'),
  envelope:  P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  crown:     P('<path d="M3 17l2-10 5 5 2-7 2 7 5-5 2 10z"/><path d="M5 20h14"/>'),
  shield:    P('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  key:       P('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>'),
  vault:     P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 8v8M18 8v8"/>'),
  plane:     P('<path d="M3 13l18-8-6 16-3-6z"/><path d="M12 15l9-10"/>'),
  tower:     P('<path d="M7 21V7l5-4 5 4v14"/><path d="M10 11h4M10 15h4M3 21h18"/>'),
  sun:       P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  music:     P('<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  camera:    P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  phone:     P('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  church:    P('<path d="M12 2v5M9 5h6"/><path d="M5 21V12l7-5 7 5v9"/><path d="M10 21v-5h4v5"/>'),
  food:      P('<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M12 12V6M8 20h8"/>'),
  bed:       P('<path d="M3 18V8M3 14h18v4M3 11h8v3M21 18v-5a3 3 0 0 0-3-3h-7"/>'),
  chip:      P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  ticket:    P('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M9 6v12"/>'),
  hand:      P('<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-12 0v-3a1.5 1.5 0 0 1 3 0"/>'),
  muscle:    P('<path d="M6 20c-2-3-2-7 1-9l2-5 3 1 1 4 4-1c2 0 3 2 3 4v6z"/>'),
  hat:       P('<path d="M4 17h16"/><path d="M7 17V9a5 5 0 0 1 10 0v8"/><path d="M7 12h10"/>'),
  snake:     P('<path d="M4 8c3 0 3 4 6 4s3-4 6-4 3 4 4 4"/><path d="M4 16c3 0 3-4 6-4s3 4 6 4 3-4 4-4"/>'),
  shoe:      P('<path d="M3 17h18v-2c-3 0-5-2-6-4l-2 1-3-3-4 2v6z"/>'),
  toilet:    P('<path d="M7 3h8v7H7z"/><path d="M5 10h14a7 7 0 0 1-14 0z"/><path d="M8 17v4h8v-4"/>'),
  statue:    P('<circle cx="12" cy="5" r="2.5"/><path d="M8 21h8M10 21v-6l-2-5h8l-2 5v6"/>'),
  lights:    P('<path d="M12 3v3M5 6l2 2M19 6l-2 2"/><rect x="6" y="10" width="12" height="7" rx="1"/><path d="M9 21h6"/>'),
  tiger:     P('<path d="M5 8l2-4 3 3h4l3-3 2 4v6a7 7 0 0 1-14 0z"/><path d="M9 12h1M14 12h1M11 16h2"/>'),
  fountain:  P('<path d="M12 3c-3 0-3 5 0 5s3-5 0-5z"/><path d="M12 8v4M6 14h12a6 6 0 0 1-12 0z"/><path d="M4 21h16"/>'),
  building:  P('<rect x="4" y="3" width="16" height="18"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-4h4v4"/>'),
  help:      P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  stats:     P('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
  walk:      P('<circle cx="13" cy="4" r="2"/><path d="M10 22l2-7-3-2 1-5 4 1 3 3"/><path d="M14 22l-2-6"/>'),
  close:     P('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrow:     P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check:     P('<path d="M4 12l5 5L20 6"/>'),
  lock:      P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  whale:     P('<path d="M3 13c2-5 8-7 14-5l4-3-1 5c1 3-1 6-5 7H8c-3 0-5-2-5-4z"/><circle cx="15" cy="11" r="1" fill="currentColor"/>'),
  beer:      P('<path d="M6 5h9v14H6z"/><path d="M15 8h3a2 2 0 0 1 0 6h-3"/><path d="M6 5c1-2 8-2 9 0"/>'),
  shades:    P('<path d="M2 10h20"/><path d="M4 10l1 5h5l1-4M19 10l-1 5h-5l-1-4"/>'),
  gear:      P('<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
};

export function icon(name, cls = '') { return `<span class="ico ${cls}">${ICONS[name] || ICONS.star}</span>`; }

/** Pick an icon for an upgrade/skill definition. */
export function iconFor(u) {
  const byModel = { machines: 'machine', noclocks: 'clock', windows: 'window', bar: 'drink', neon: 'lights', vents: 'gas', gas: 'gas', fog: 'gas', atm: 'dollar', bouncer: 'person', cart: 'vault', carpet: 'walk', tables: 'cards', roulette: 'chip', statue: 'statue', cameras: 'camera', vip: 'crown', buffet: 'food', sky: 'sun', volcano: 'flame', jet: 'plane', tower: 'tower', bus: 'bus', shuttle: 'bus', billboard: 'billboard', toilet: 'toilet', selfstatue: 'statue', namelights: 'lights', tiger: 'tiger', fountain: 'fountain' };
  if (u.model && byModel[u.model]) return byModel[u.model];
  const n = (u.name || '').toLowerCase();
  const kw = [['bribe', 'envelope'], ['payroll', 'envelope'], ['senator', 'envelope'], ['governor', 'crown'], ['commission', 'envelope'], ['marshal', 'shield'], ['hopper', 'vault'], ['vault', 'vault'], ['rail', 'vault'], ['text', 'phone'], ['spam', 'phone'], ['church', 'church'], ['jingle', 'music'], ['radio', 'music'], ['tv', 'billboard'], ['flyer', 'card'], ['card', 'card'], ['testimonial', 'people'], ['influencer', 'people'], ['lemonade', 'drink'], ['drink', 'drink'], ['peanut', 'food'], ['chip', 'chip'], ['chime', 'music'], ['sportsbook', 'ticket'], ['exit', 'walk'], ['room', 'bed'], ['hotel', 'bed'], ['loan', 'dollar'], ['tighten', 'machine'], ['slot', 'machine'], ['cinema', 'eye'], ['airport', 'plane'], ['lounge', 'crown'], ['perfume', 'gas'], ['oxygen', 'gas']];
  for (const [k, v] of kw) if (n.includes(k)) return v;
  return 'star';
}
