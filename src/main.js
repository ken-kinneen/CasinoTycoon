import * as THREE from 'three';
import { game, CASINOS } from './state.js';
import { createRenderer, createScene, createCamera } from './engine/scene.js';
import { createPostFX } from './engine/postfx.js';
import { Player } from './engine/player.js';
import { CasinoWorld } from './world/casino.js';
import { CustomerManager } from './world/customers.js';
import { Effects } from './world/effects.js';
import { HUD, toast, quip } from './ui/hud.js';
import { Ledger } from './ui/ledger.js';
import { AdvertisingGame } from './minigames/advertising.js';
import { CashRunGame } from './minigames/cashrun.js';
import { DealerGame } from './minigames/dealer.js';
import { fmtMoney } from './minigames/base.js';
import { PedestrianManager } from './world/pedestrians.js';
import * as music from './audio/music.js';

const $ = id => document.getElementById(id);

// ---- boot -------------------------------------------------------------------
const canvas = $('game');
const renderer = createRenderer(canvas);
const scene = createScene(renderer);
const camera = createCamera();
const postfx = createPostFX(renderer, scene, camera);
const world = new CasinoWorld(scene);
const effects = new Effects(scene);
const customers = new CustomerManager(scene, world, game, effects);
const player = new Player(scene, camera, game);
const hud = new HUD(game, customers);
const ledger = new Ledger(game, () => {});
const pedMgr = new PedestrianManager(scene, world);
ledger.onHide = () => { modalOpen = false; };

let started = false;
let activeGame = null;
let modalOpen = true; // intro is open
let nearbyPed = null;
let inspectionTimer = 90;
let quipTimer = 30;
let saveTimer = 10;
let currentZone = null;
let time = 0;
const zoneRings = [];

const AMBIENT_QUIPS = [
  'Look at them. Feeding the machines. Beautiful.',
  'Somebody\'s kid isn\'t going to college tonight.',
  'The house always wins. I am the house. I always win.',
  'I could add more oxygen to the vents. Or something stronger.',
  'Vegas. One day. A casino so big it has its own weather.',
  'Every clock I remove adds an hour to their stay. Science.',
  'A full hopper is a wasted hopper. Get that cash to the safe.',
  'Heat\'s getting high. Someone official is going to want an envelope.',
  'Free drinks are the most expensive thing in this building.',
  'Is it evil if it\'s profitable? Asking for me.',
  'That carpet cost forty dollars. It has seen things.',
  'I don\'t gamble. I own gambling.',
];

const MOODS = { duck: { bloomStrength: 0.45, vignette: 0.6, warmth: 0.07 }, rat: { bloomStrength: 0.55, vignette: 0.55, warmth: 0.05 }, diablo: { bloomStrength: 0.65, vignette: 0.5, warmth: 0.09 } };

function rebuildWorld({ keepCustomers = true } = {}) {
  const def = game.casinoDef;
  const oldCash = game.s.machineCash;
  world.build(def, game);
  effects.build(world, def);
  postfx.setMood(MOODS[def.id]);
  scene.fog.density = def.id === 'diablo' ? 0.012 : 0.018;
  if (!keepCustomers) customers.clearAll();
  for (const c of customers.customers) {
    c.machine = null; c.table = null; c.seat = null;
    if (c.state !== 'leaving') { c.state = 'entering'; c.path = []; c.stuck = 0; }
  }
  const hoppers = [...world.machines, ...world.tables];
  const each = hoppers.length ? oldCash / hoppers.length : 0;
  for (const h of hoppers) h.cash = Math.min(game.stats.hopperCap, each);
  game.s.machineCash = hoppers.reduce((a, h) => a + h.cash, 0);
  world.collide(player.pos, 0.4);
  pedMgr.world = world;
  pedMgr.clearAll();
  refreshZoneRings();
}

game.on('casino', () => {
  rebuildWorld({ keepCustomers: false });
  player.teleport(world.doorInside.x, world.doorInside.z - 1);
  player.rebuildModel();
  if (!started) return;
  toast(`Welcome to ${game.casinoDisplayName()}.`, 'good');
  quip(game.s.casino === 2 ? 'Vegas. I\'m home.' : 'Bigger floor. Bigger hoppers. Bigger everything.');
});
game.on('upgrade', u => { if (u.model) rebuildWorld(); });
game.on('skill', () => player.rebuildModel());
game.on('won', () => setTimeout(showWin, 1500));
let whaleToastAt = -999;
game.on('customer', ({ type }) => { if (type === 'whale' && time - whaleToastAt > 25) { whaleToastAt = time; toast('A whale just walked in. Get to the table.', 'good'); } });

// build the world right away so it sits behind the title screen
rebuildWorld({ keepCustomers: false });
player.model.visible = false;

// ---- intro / reset ------------------------------------------------------------
const hasSave = game.s.lifetimeEarned > 0 || game.s.playTime > 0;

function start() {
  player.model.visible = true;
  $('intro').classList.add('hidden');
  modalOpen = false;
  if (!started) {
    started = true;
    if (game.s.playerX !== null && game.s.playerZ !== null) {
      player.teleport(game.s.playerX, game.s.playerZ);
    } else {
      player.teleport(world.doorInside.x, world.doorInside.z - 1);
    }
    hud.show();
    music.start();
    setTimeout(() => quip(hasSave ? 'Back to work. The machines missed me.' : 'Two hundred dollars and a dream. Let\'s ruin some lives.'), 600);
    setTimeout(() => customers.queue(2), 1500);
  }
}

function updateDisplayNames() {
  const name = game.s.playerName;
  $('portrait-name').textContent = name.toUpperCase();
  $('stats-player-name').textContent = name.toUpperCase();
  $('intro-name').textContent = name;
  $('intro-casino').textContent = game.casinoDisplayName(0);
}
updateDisplayNames();

if (hasSave) start();
$('intro-start').onclick = start;
$('intro-reset').onclick = () => { if (confirm('Wipe the books and start over?')) { game.reset(); updateDisplayNames(); rebuildWorld({ keepCustomers: false }); player.rebuildModel(); hud.drawPortrait(); player.teleport(world.doorInside.x, world.doorInside.z - 1); start(); } };
$('help-close').onclick = () => { $('help').classList.add('hidden'); modalOpen = false; };
$('result-close').onclick = () => { $('result').classList.add('hidden'); modalOpen = false; };
$('btn-ledger').onclick = () => toggleLedger();
$('btn-stats').onclick = () => hud.toggleStats();
$('btn-help').onclick = () => { $('help').classList.remove('hidden'); modalOpen = true; };

// ---- settings screen ----------------------------------------------------------
function updateSettingsUI() {
  $('settings-music-toggle').classList.toggle('muted', music.isMuted());
  $('settings-music-label').textContent = music.isMuted() ? 'OFF' : 'ON';
  $('settings-vol').value = Math.round(music.getVolume() * 100);
  $('settings-vol-num').textContent = `${Math.round(music.getVolume() * 100)}%`;
}
function openSettings() {
  $('settings-name').value = game.s.playerName;
  $('settings-casino-name').value = game.casinoDisplayName();
  $('settings-casino-name').placeholder = game.casinoDef.name;
  updateSettingsUI();
  $('settings').classList.remove('hidden');
  modalOpen = true;
}
function closeSettings() {
  let changed = false;
  const rawName = $('settings-name').value.trim();
  if (rawName && rawName !== game.s.playerName) {
    game.s.playerName = rawName;
    updateDisplayNames();
    changed = true;
  }
  const rawCasino = $('settings-casino-name').value.trim();
  const cid = game.casinoDef.id;
  const defaultName = game.casinoDef.name;
  const newCasinoName = rawCasino || defaultName;
  if (newCasinoName !== game.casinoDisplayName()) {
    if (newCasinoName === defaultName) delete game.s.casinoNames[cid];
    else game.s.casinoNames[cid] = newCasinoName;
    changed = true;
  }
  if (changed) { game.save(); rebuildWorld(); }
  $('settings').classList.add('hidden');
  modalOpen = false;
}
$('btn-settings').onclick = () => { if (!started || activeGame) return; if (!$('settings').classList.contains('hidden')) closeSettings(); else if (!modalOpen) openSettings(); };
$('settings-close').onclick = closeSettings;
$('settings-music-toggle').onclick = () => { music.toggleMute(); updateSettingsUI(); };
$('settings-vol').oninput = () => { music.setVolume($('settings-vol').value / 100); $('settings-vol-num').textContent = `${$('settings-vol').value}%`; };
document.querySelectorAll('.hot').forEach(h => h.onclick = () => {
  if (!started || modalOpen || activeGame) return;
  const k = h.dataset.key;
  if (k === 'office') return toggleLedger('casino');
  if (k === 'advertising') { jumpTo(k); toast('Walk up to someone on the sidewalk and press F.', 'good'); return; }
  jumpTo(k); startActivity(k);
});

function jumpTo(key) {
  if (key === 'advertising') { player.teleport(world.streetPos.x, world.streetPos.z); return; }
  const z = key === 'cashrun' ? world.zones.safe : key === 'dealer' ? world.zones.dealer : world.zones.office;
  if (z) player.teleport(z.pos.x, z.pos.z);
}
function toggleLedger(tab) {
  if (ledger.open) { ledger.hide(); modalOpen = false; }
  else { ledger.show(tab); modalOpen = true; }
}
function showResult(title, html, stamp = 'PAID') {
  $('result-title').textContent = title;
  $('result-stamp').textContent = stamp;
  $('result-body').innerHTML = html;
  $('result').classList.remove('hidden');
  modalOpen = true;
}
function showWin() {
  showResult('You made it to Vegas.', `
    <p>${game.casinoDisplayName(2)} is yours. A cathedral of neon, forty floors of no checkout desk, and a volcano that scares the insurance guy.</p>
    <div class="row"><span>Lifetime take</span><span class="big">${fmtMoney(game.s.lifetimeEarned)}</span></div>
    <div class="row"><span>Guests fleeced</span><b>${game.s.lifetimeCustomers}</b></div>
    <p>The dream was never the casino. The dream was the next one. There are 15 more upgrades in this building and ${game.s.playerName}'s name isn't in lights yet.</p>
    <div class="quip">"They said I'd never make it. They were right. I took it."</div>`, 'VEGAS');
}

// ---- activities ---------------------------------------------------------------
function launchAdGame(ped) {
  if (activeGame || modalOpen) return;
  const victim = { type: ped.type, difficulty: ped.difficulty, name: ped.name };
  pedMgr.remove(ped);
  player.enabled = false;
  const finish = (fn) => (res) => { activeGame = null; player.enabled = true; player.keys = {}; if (!res.aborted) fn(res); };
  activeGame = new AdvertisingGame(game, victim);
  activeGame.onDone = finish(res => {
    const slipped = res.deposited > 0;
    const converted = slipped && Math.random() < game.stats.cardConversion ? 1 : 0;
    if (converted) customers.queue(1);
    if (slipped) {
      showResult('Card slipped', `<div class="row"><span>The mark</span><b>${victim.name}</b></div><div class="row"><span>Guest on their way?</span><span class="big">${converted ? 'Yes' : 'No'}</span></div><div class="quip">"${converted ? 'They\'ll come. They always come.' : 'Planted, but they tossed it. Try another.'}"</div>`, converted ? 'HOOKED' : 'PLANTED');
    } else {
      showResult('Busted', `<div class="row"><span>The mark</span><b>${victim.name}</b></div><div class="quip">"${['They felt that. Sloppy.', 'Gone. Find someone less alert.', 'Tighter grip next time.'][Math.floor(Math.random() * 3)]}"</div>`, 'BUSTED');
    }
  });
  activeGame.open(`Guide the card into ${victim.name}'s pocket without touching the fabric.`);
}

function startActivity(key) {
  if (activeGame || modalOpen) return;
  if (key === 'office') { toggleLedger('casino'); return; }
  if (key === 'cashrun' && game.s.machineCash < 1) { toast('The hoppers are empty. Get some guests on the machines first.', 'bad'); quip('Nothing to haul. Get people in here.'); return; }
  if (key === 'dealer' && !customers.tablePlayers().length) { toast('Nobody at the table. Advertise, wait for a whale, or let a drunk wander over.', 'bad'); quip('An empty table. My least favourite kind.'); return; }
  player.enabled = false;
  const finish = (fn) => (res) => { activeGame = null; player.enabled = true; player.keys = {}; if (!res.aborted) fn(res); };
  if (key === 'cashrun') {
    activeGame = new CashRunGame(game);
    activeGame.onDone = finish(res => {
      customers.drainHoppers(res.banked);
      game.addMoney(res.banked, 'cashrun');
      game.save();
      effects.float(player.pos.x, 2.4, player.pos.z, `+${fmtMoney(res.banked)}`, '#ffd700', 1.6);
      showResult('Cash run', `<div class="row"><span>Hauled into the safe</span><span class="big">${fmtMoney(res.banked)}</span></div><div class="row"><span>Left in the hoppers</span><b>${fmtMoney(game.s.machineCash)}</b></div><div class="quip">"${res.banked === 0 ? 'Nothing? My back hurts for nothing?' : 'Mine. All mine. Legally mine, mostly.'}"</div>`, res.banked ? 'BANKED' : 'EMPTY');
    });
    activeGame.open(`Drag the stacks into the safe while the door is open. ${Math.round(game.stats.cashTime)} seconds.`);
  } else if (key === 'dealer') {
    activeGame = new DealerGame(game, customers.tablePlayers());
    activeGame.onDone = finish(res => {
      game.save();
      const net = res.won - res.lost;
      showResult('The table', `<div class="row"><span>Hands dealt</span><b>${res.hands.length}</b></div><div class="row"><span>House wins</span><b>${res.hands.filter(h => h.hit).length}</b></div><div class="row"><span>Net</span><span class="big ${net < 0 ? 'neg' : ''}">${net >= 0 ? '+' : '-'}${fmtMoney(Math.abs(net))}</span></div><div class="quip">${res.hands[res.hands.length - 1].quip}</div>`, net >= 0 ? 'HOUSE' : 'OUCH');
    });
    activeGame.open('Lock the number inside the gambler\'s margin. SPACE or click.');
  }
}

// ---- keys ---------------------------------------------------------------------
window.addEventListener('keydown', e => {
  if (!started || activeGame) return;
  if (e.code === 'KeyU') { if (!modalOpen || ledger.open) toggleLedger(); }
  else if (e.code === 'Tab') { e.preventDefault(); hud.toggleStats(); }
  else if (e.code === 'KeyH') { if (!modalOpen) { $('help').classList.remove('hidden'); modalOpen = true; } else if (!$('help').classList.contains('hidden')) { $('help').classList.add('hidden'); modalOpen = false; } }
  else if (e.code === 'Escape') { if (ledger.open) toggleLedger(); else if (!$('settings').classList.contains('hidden')) closeSettings(); else if (!$('result').classList.contains('hidden')) $('result-close').click(); else if (!$('help').classList.contains('hidden')) $('help-close').click(); else hud.toggleStats(false); }
  else if (e.code === 'KeyM') { music.toggleMute(); updateSettingsUI(); }
  else if (e.code === 'KeyF') {
    if (modalOpen) return;
    if (nearbyPed) { launchAdGame(nearbyPed); }
    else if (currentZone) startActivity(currentZone.key);
  }
  else if (!modalOpen && e.code === 'Digit1') jumpTo('advertising');
  else if (!modalOpen && e.code === 'Digit2') jumpTo('cashrun');
  else if (!modalOpen && e.code === 'Digit3') jumpTo('dealer');
});

// ---- zone rings ---------------------------------------------------------------
function refreshZoneRings() {
  for (const r of zoneRings) scene.remove(r);
  zoneRings.length = 0;
  for (const z of Object.values(world.zones)) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.12, z.r, 48), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; g.add(ring);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(z.r - 0.14, 48), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    inner.rotation.x = -Math.PI / 2; g.add(inner);
    g.position.set(z.pos.x, 0.15, z.pos.z);
    g.userData = { ring, inner };
    scene.add(g); zoneRings.push(g);
  }
}

// ---- main loop ------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  window.__activeGame = activeGame;
  if (started) pedMgr.update(dt, player.pos);
  if (started && !activeGame && !modalOpen) {
    player.enabled = true;
    nearbyPed = pedMgr.highlighted;
    if (nearbyPed) {
      const tier = nearbyPed.difficulty.charAt(0).toUpperCase() + nearbyPed.difficulty.slice(1);
      hud.setPrompt(`Slip a card to ${nearbyPed.name} (${tier})`, 'advertising');
    } else {
      currentZone = null; let best = Infinity;
      for (const z of Object.values(world.zones)) { const d = player.pos.distanceTo(z.pos); if (d < z.r && d < best) { best = d; currentZone = z; } }
      hud.setPrompt(currentZone ? currentZone.label : null, currentZone ? (currentZone.key === 'office' ? 'office' : currentZone.key) : null);
    }
    for (const g of zoneRings) { const near = currentZone && Math.abs(g.position.x - currentZone.pos.x) < 0.01 && Math.abs(g.position.z - currentZone.pos.z) < 0.01; g.userData.ring.material.opacity = (near ? 0.9 : 0.45) + Math.sin(time * 3) * 0.15; g.userData.inner.material.opacity = near ? 0.16 : 0.06; g.rotation.y = time * 0.3; }
  } else if (started) {
    player.enabled = false;
    nearbyPed = null;
  }
  if (started) {
    game.s.playTime += dt;
    customers.update(dt);
    const st = game.stats;
    if (st.autoCollect > 0 && game.s.machineCash > 0) {
      const take = Math.min(game.s.machineCash, game.s.machineCash * st.autoCollect / 60 * dt + 0.2 * dt);
      customers.drainHoppers(take); game.addMoney(take, 'auto');
    }
    inspectionTimer -= dt;
    if (inspectionTimer <= 0) {
      inspectionTimer = 90 + Math.random() * 60;
      if (Math.random() < st.heat / 100 * 0.6) {
        const bribe = Math.round(Math.min(game.s.money, Math.max(50, game.s.money * (0.02 + st.heat / 100 * 0.06))));
        game.spend(bribe);
        toast(`An inspector "dropped by". The envelope cost ${fmtMoney(bribe)}. (Heat ${Math.round(st.heat)}%)`, 'bad', 6000);
        effects.float(player.pos.x, 2.4, player.pos.z, `-${fmtMoney(bribe)}`, '#ff3b3b', 1.4);
        quip(['Cost of doing business. Business is crime.', 'He took the envelope and a buffet voucher. Classy.', 'I should buy someone higher up.'][Math.floor(Math.random() * 3)]);
      }
    }
    quipTimer -= dt;
    if (quipTimer <= 0) { quipTimer = 40 + Math.random() * 30; quip(AMBIENT_QUIPS[Math.floor(Math.random() * AMBIENT_QUIPS.length)]); }
    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 10; game.s.playerX = player.pos.x; game.s.playerZ = player.pos.z; game.save(); }
  }
  if (started) { player.update(dt, world); hud.update(dt); }
  else { camera.position.set(Math.sin(time * 0.08) * 16, 5.5, world.D / 2 + 15); camera.lookAt(0, 3, world.D / 2 - 4); }
  world.update(dt, time);
  effects.update(dt);
  if (!activeGame) postfx.render(dt);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.resize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => { if (started) { game.s.playerX = player.pos.x; game.s.playerZ = player.pos.z; } game.save(); });

window.__casino = { game, world, customers, player, effects, pedMgr, step: (secs) => { for (let t = 0; t < secs; t += 0.05) customers.update(0.05); } };
