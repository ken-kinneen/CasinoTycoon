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
import { AchievementsScreen } from './ui/achievements.js';
import { AdvertisingGame } from './minigames/advertising.js';
import { CashRunGame } from './minigames/cashrun.js';
import { DealerGame } from './minigames/dealer.js';
import { fmtMoney } from './minigames/base.js';
import { PedestrianManager } from './world/pedestrians.js';
import { FloorEditor } from './world/editor.js';
import * as music from './audio/music.js';
import * as sfx from './audio/sfx.js';

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
const achScreen = new AchievementsScreen(game);
const pedMgr = new PedestrianManager(scene, world);
const editor = new FloorEditor(scene, camera, canvas, world);
player.editor = editor;
ledger.onHide = () => { modalOpen = false; setOpenModal(null); };
ledger.onTabChange = (tab) => { setOpenModal(`ledger:${tab}`); };
achScreen.onHide = () => { modalOpen = false; setOpenModal(null); };

let started = false;
let activeGame = null;
let modalOpen = true; // intro is open

function setOpenModal(key) { game.s.openModal = key || null; game.save(); }
let nearbyPed = null;
let inspectionTimer = 90;
let quipTimer = 30;
let saveTimer = 10;
let currentZone = null;
let time = 0;

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
  if (game.s.lighting) applyLightSettings(loadLightSettings());
  scene.fog.density = def.id === 'diablo' ? 0.012 : 0.018;
  if (!keepCustomers) customers.clearAll();
  for (const c of customers.customers) {
    c.machine = null; c.table = null; c.seat = null;
    c.group.position.y = 0;
    const u = c.group.userData;
    if (u.legL) u.legL.rotation.x = 0;
    if (u.legR) u.legR.rotation.x = 0;
    if (c.state !== 'leaving') { c.state = 'entering'; c.path = []; c.stuck = 0; }
  }
  const hoppers = [...world.machines, ...world.tables];
  const each = hoppers.length ? oldCash / hoppers.length : 0;
  for (const h of hoppers) h.cash = Math.min(game.stats.hopperCap, each);
  game.s.machineCash = hoppers.reduce((a, h) => a + h.cash, 0);
  world.collide(player.pos, 0.4);
  pedMgr.world = world;
  pedMgr.clearAll();
  editor.setWorld(world);
  loadFloorLayout();
}

game.on('casino', () => {
  rebuildWorld({ keepCustomers: false });
  player.teleport(world.doorInside.x, world.doorInside.z - 1);
  player.rebuildModel();
  if (!started) return;
  toast(`Welcome to ${game.casinoDisplayName()}.`, 'good');
  quip(game.s.casino === 2 ? 'Vegas. I\'m home.' : 'Bigger floor. Bigger hoppers. Bigger everything.');
});
game.on('upgrade', u => {
  if (!u.model) return;
  const oldMachines = world.machines.length;
  const oldTables = world.tables.length;
  rebuildWorld();
  // new machines/tables from this upgrade spawn outside for manual placement
  const newMachines = world.machines.length;
  const newTables = world.tables.length;
  for (let i = oldMachines; i < newMachines; i++) editor.spawnOutside('machine', i);
  for (let i = oldTables; i < newTables; i++) editor.spawnOutside('table', i);
  if (newMachines > oldMachines || newTables > oldTables) {
    toast(`New ${newMachines > oldMachines ? 'machines' : 'tables'} delivered outside. Drag them onto the floor.`, 'good', 5000);
  }
});
game.on('skill', () => player.rebuildModel());
game.on('achievement', (a) => {
  if (achScreen.open) achScreen.render();
  if (a.item) rebuildWorld();
});
game.on('won', () => setTimeout(showWin, 1500));
let whaleToastAt = -999;
game.on('customer', ({ type }) => { if (type === 'whale' && time - whaleToastAt > 25) { whaleToastAt = time; toast('A whale just walked in. Get to the table.', 'good'); } });

// build the world right away so it sits behind the title screen
rebuildWorld({ keepCustomers: false });
player.model.visible = false;

// ---- intro / reset ------------------------------------------------------------
const hasSave = game.s.lifetimeEarned > 0 || game.s.playTime > 0;
if (hasSave) { $('intro').classList.add('hidden'); }
else { document.documentElement.classList.remove('has-save'); }

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
    editor.start();
    music.start();
    setTimeout(() => quip(hasSave ? 'Back to work. The machines missed me.' : 'Two hundred dollars and a dream. Let\'s ruin some lives.'), 600);
    setTimeout(() => customers.queue(2), 1500);
    restoreOpenModal();
  }
}

function restoreOpenModal() {
  const m = game.s.openModal;
  if (!m) return;
  if (m === 'settings') { openSettings(); }
  else if (m === 'help') { $('help').classList.remove('hidden'); modalOpen = true; }
  else if (m === 'achievements') { achScreen.show(); modalOpen = true; }
  else if (m.startsWith('ledger')) { const tab = m.split(':')[1]; ledger.show(tab); modalOpen = true; }
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
$('help-close').onclick = () => { $('help').classList.add('hidden'); modalOpen = false; setOpenModal(null); };
$('result-close').onclick = () => { $('result').classList.add('hidden'); modalOpen = false; setOpenModal(null); };
$('btn-ledger').onclick = () => toggleLedger();
$('btn-achievements').onclick = () => { if (!started || activeGame) return; if (achScreen.open) { achScreen.hide(); } else if (!modalOpen) { achScreen.show(); modalOpen = true; setOpenModal('achievements'); } };
$('btn-stats').onclick = () => hud.toggleStats();
$('btn-help').onclick = () => { $('help').classList.remove('hidden'); modalOpen = true; setOpenModal('help'); };

// ---- settings screen ----------------------------------------------------------
function updateSettingsUI() {
  $('settings-music-toggle').classList.toggle('muted', music.isMuted());
  $('settings-music-label').textContent = music.isMuted() ? 'OFF' : 'ON';
  $('settings-vol').value = Math.round(music.getVolume() * 100);
  $('settings-vol-num').textContent = `${Math.round(music.getVolume() * 100)}%`;
}
function updateGodUI() {
  $('settings-god').classList.toggle('muted', !game.godMode);
  $('settings-god-label').textContent = game.godMode ? 'ON' : 'OFF';
}
function openSettings() {
  $('settings-name').value = game.s.playerName;
  $('settings-casino-name').value = game.casinoDisplayName();
  $('settings-casino-name').placeholder = game.casinoDef.name;
  $('settings-level').value = game.s.casino;
  $('settings-money').value = Math.floor(game.s.money);
  updateSettingsUI();
  updateGodUI();
  updateLightUI();
  $('settings').classList.remove('hidden');
  modalOpen = true;
  setOpenModal('settings');
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
  // dev: money
  const rawMoney = parseFloat($('settings-money').value);
  if (!isNaN(rawMoney) && rawMoney >= 0 && rawMoney !== game.s.money) {
    game.s.money = rawMoney;
    changed = true;
  }
  // dev: casino level
  let casinoChanged = false;
  const newLevel = parseInt($('settings-level').value, 10);
  if (newLevel !== game.s.casino && newLevel >= 0 && newLevel <= 2) {
    if (!game.s.ownedCasinos.includes(newLevel)) game.s.ownedCasinos.push(newLevel);
    game.s.casino = newLevel;
    game.s.machineCash = 0;
    game.recompute();
    customers.clearAll();
    changed = true;
    casinoChanged = true;
  }
  if (changed) { game.save(); rebuildWorld({ keepCustomers: !casinoChanged }); updateDisplayNames(); }
  $('settings').classList.add('hidden');
  modalOpen = false;
  setOpenModal(null);
}
$('btn-settings').onclick = () => { if (!started || activeGame) return; if (!$('settings').classList.contains('hidden')) closeSettings(); else if (!modalOpen) openSettings(); };
$('settings-close').onclick = closeSettings;
$('settings').onclick = (e) => { if (e.target === $('settings')) closeSettings(); };
$('settings-music-toggle').onclick = () => { music.toggleMute(); updateSettingsUI(); };
$('settings-vol').oninput = () => { music.setVolume($('settings-vol').value / 100); $('settings-vol-num').textContent = `${$('settings-vol').value}%`; };
$('settings-god').onclick = () => { game.godMode = !game.godMode; game.save(); updateGodUI(); };

// ---- lighting settings ----------------------------------------------------------
function loadLightSettings() { return game.s.lighting; }

function applyLightSettings(ls) {
  postfx.bloom.strength = ls.bloom / 100;
  renderer.toneMappingExposure = ls.exposure / 100;
  postfx.grade.uniforms.grain.value = ls.grain / 1000;
  postfx.grade.uniforms.vignette.value = ls.vignette / 100;
}

function updateLightUI() {
  const ls = loadLightSettings();
  for (const key of ['bloom', 'exposure', 'grain', 'vignette']) {
    $('settings-' + key).value = ls[key];
    $('settings-' + key + '-num').textContent = `${ls[key]}%`;
  }
  updateResetButtons();
}

function onLightSlider(key) {
  const val = parseInt($('settings-' + key).value, 10);
  $('settings-' + key + '-num').textContent = `${val}%`;
  if (!game.s.lighting) game.s.lighting = {};
  game.s.lighting[key] = val;
  applyLightSettings(loadLightSettings());
  updateResetButtons();
  game.save();
}

$('settings-bloom').oninput = () => onLightSlider('bloom');
$('settings-exposure').oninput = () => onLightSlider('exposure');
$('settings-grain').oninput = () => onLightSlider('grain');
$('settings-vignette').oninput = () => onLightSlider('vignette');

function updateResetButtons() {
  for (const btn of document.querySelectorAll('.setting-reset')) {
    const key = btn.dataset.key;
    const def = parseInt(btn.dataset.default, 10);
    const cur = parseInt($('settings-' + key).value, 10);
    btn.classList.toggle('changed', cur !== def);
  }
}

for (const btn of document.querySelectorAll('.setting-reset')) {
  btn.onclick = () => {
    const key = btn.dataset.key;
    const def = parseInt(btn.dataset.default, 10);
    $('settings-' + key).value = def;
    onLightSlider(key);
    updateResetButtons();
  };
}

applyLightSettings(loadLightSettings());

// ---- perf stats overlay ---------------------------------------------------------
let perfOn = !!game.s.perfStats;
const perfEl = $('perf-stats');
let perfFrames = 0, perfTime = 0, perfFPS = 0;

function updatePerfUI() {
  $('settings-perf').classList.toggle('muted', !perfOn);
  $('settings-perf-label').textContent = perfOn ? 'ON' : 'OFF';
  perfEl.classList.toggle('hidden', !perfOn);
}
updatePerfUI();
function perfTick(dt) {
  if (!perfOn) return;
  perfFrames++;
  perfTime += dt;
  if (perfTime >= 0.5) {
    perfFPS = Math.round(perfFrames / perfTime);
    perfTime = 0;
    perfFrames = 0;
    const si = postfx.sceneInfo;
    const mem = renderer.info.memory;
    const heap = performance.memory;
    perfEl.textContent =
      `FPS ${perfFPS}  |  Draw ${si.calls}  |  Tri ${(si.triangles / 1000).toFixed(1)}k  |  Tex ${mem.textures}  |  Geo ${mem.geometries}` +
      (heap ? `  |  Heap ${(heap.usedJSHeapSize / 1048576).toFixed(0)}MB` : '');
  }
}
$('settings-perf').onclick = () => { perfOn = !perfOn; game.s.perfStats = perfOn; game.save(); updatePerfUI(); };

// ---- uncap FPS toggle -----------------------------------------------------------
let uncapped = !!game.s.uncapFPS;
function updateUncapUI() {
  $('settings-uncap').classList.toggle('muted', !uncapped);
  $('settings-uncap-label').textContent = uncapped ? 'ON' : 'OFF';
}
updateUncapUI();
$('settings-uncap').onclick = () => { uncapped = !uncapped; game.s.uncapFPS = uncapped; game.save(); updateUncapUI(); };

// ---- floor editor (always-on: hover outlines, click to select) ------------------

// Panel buttons use pointerdown + stopPropagation so they never leak to the canvas.
for (const btn of $('editor-info').querySelectorAll('button')) {
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('mousedown', e => e.stopPropagation());
}

editor.onSelect = (info, screenPos) => {
  const panel = $('editor-info');

  // Nothing selected, or we're in move mode — hide the panel
  if (!info || info.moveMode) {
    panel.classList.add('hidden');
    if (!info || !info.moveMode) { $('move-tooltip').classList.add('hidden'); _lastTooltipValid = null; }
    return;
  }
  $('move-tooltip').classList.add('hidden'); _lastTooltipValid = null;

  // Show panel at click position
  panel.classList.remove('hidden');
  if (screenPos && screenPos.x) {
    const pw = panel.offsetWidth || 240;
    const ph = panel.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let px = screenPos.x + 16;
    let py = screenPos.y - ph / 2;
    if (px + pw > vw - 12) px = screenPos.x - pw - 16;
    if (py < 12) py = 12;
    if (py + ph > vh - 12) py = vh - ph - 12;
    panel.style.left = px + 'px';
    panel.style.top = py + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  $('editor-info-type').textContent = info.type;
  $('editor-info-name').textContent = info.name;
  $('editor-info-stats').innerHTML = info.stats
    .map(s => `<div class="erow"><span class="ek">${s.label}</span><span class="ev">${s.value}</span></div>`).join('');

  const dealBtn = $('editor-deal');
  if (info.type === 'Dealer Table') {
    dealBtn.classList.remove('hidden');
    dealBtn.disabled = !info.canInteract;
    dealBtn.title = info.canInteract ? '' : (info.near ? 'No players at the table' : 'Walk closer to deal');
  } else {
    dealBtn.classList.add('hidden');
  }

  $('editor-info-hint').innerHTML = '<kbd>R</kbd> rotate · <kbd>Esc</kbd> close';
};
editor.onChange = () => { saveFloorLayout(); world.rebuildColliders(); };

// tooltip follows the object during move mode
const moveTooltip = $('move-tooltip');
const TOOLTIP_OK = '<kbd>R</kbd> <span class="sep">·</span> rotate <span class="sep">·</span> click to place <span class="sep">·</span> <kbd>Esc</kbd> <span class="sep">·</span> cancel';
const TOOLTIP_ERR = '<span class="err-msg">Can\'t place here</span> <span class="sep">·</span> <kbd>Esc</kbd> <span class="sep">·</span> cancel';
let _lastTooltipValid = null;
editor.onMoveUpdate = (sx, sy, valid) => {
  moveTooltip.classList.remove('hidden');
  moveTooltip.style.left = sx + 'px';
  moveTooltip.style.top = (sy - 16) + 'px';
  moveTooltip.classList.toggle('invalid', !valid);
  if (valid !== _lastTooltipValid) {
    moveTooltip.innerHTML = valid ? TOOLTIP_OK : TOOLTIP_ERR;
    _lastTooltipValid = valid;
  }
};

$('editor-move').onclick = () => editor.enterMoveMode();
$('editor-deal').onclick = () => {
  if (!editor.selected || editor.selected.type !== 'table') return;
  editor.deselect();
  startActivity('dealer');
};

// Arrange Floor button in sidebar — toggles arrange mode
let arrangeMode = false;
function toggleArrangeMode(force) {
  arrangeMode = force !== undefined ? force : !arrangeMode;
  editor.arrangeMode = arrangeMode;
  $('btn-arrange').classList.toggle('active', arrangeMode);
  if (arrangeMode) {
    toast('Click any machine or table to move it.', 'good', 2500);
  } else {
    editor.deselect();
  }
}
$('btn-arrange').onclick = () => {
  if (!started || activeGame || modalOpen) return;
  toggleArrangeMode();
};
// when editor enters move mode from any path, mark arrange as active
const _origEnter = editor.enterMoveMode.bind(editor);
editor.enterMoveMode = function() {
  _origEnter();
  if (editor.moveMode) $('btn-arrange').classList.add('active');
};
// when move ends, clear arrange
const _origFinish = editor._finishMove.bind(editor);
editor._finishMove = function() {
  _origFinish();
  arrangeMode = false;
  $('btn-arrange').classList.remove('active');
};

function saveFloorLayout() {
  const cid = game.casinoDef.id;
  const layout = editor.getLayout();
  if (!game.s.floorLayouts) game.s.floorLayouts = {};
  game.s.floorLayouts[cid] = layout;
  game.save();
}
function loadFloorLayout() {
  if (!game.s.floorLayouts) return;
  const cid = game.casinoDef.id;
  const layout = game.s.floorLayouts[cid];
  if (!layout) return;
  // Apply saved positions to however many match (partial apply is fine
  // when new machines/tables were added by an upgrade)
  editor.applyLayout(layout);
  world.rebuildColliders();
}
document.querySelectorAll('.sb-action').forEach(h => {
  if (h.id === 'btn-arrange') return; // handled separately
  h.onclick = () => {
    if (!started || modalOpen || activeGame) return;
    const k = h.dataset.key;
    if (k === 'office') return toggleLedger('casino');
    if (k === 'advertising') { jumpTo(k); toast('Walk up to someone on the sidewalk and press F.', 'good'); return; }
    jumpTo(k); startActivity(k);
  };
});

function jumpTo(key) {
  if (key === 'advertising') { player.teleport(world.streetPos.x, world.streetPos.z, Math.PI); return; }
  if (key === 'dealer') {
    if (world.tables.length) player.teleport(world.tables[0].pos.x, world.tables[0].pos.z + 3);
    return;
  }
  const z = key === 'cashrun' ? world.zones.safe : world.zones.office;
  if (z) player.teleport(z.pos.x, z.pos.z);
}
function toggleLedger(tab) {
  if (ledger.open) { ledger.hide(); modalOpen = false; setOpenModal(null); }
  else { ledger.show(tab); modalOpen = true; setOpenModal(`ledger:${tab || ledger.tab}`); }
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
  editor.deselect();
  const finish = (fn) => (res) => { activeGame = null; player.enabled = true; player.keys = {}; if (!res.aborted) fn(res); };
  activeGame = new AdvertisingGame(game, victim);
  activeGame.onDone = finish(res => {
    const slipped = res.deposited > 0;
    if (slipped) customers.queue(1);
    if (slipped) {
      sfx.playRandom('triumph', 'chuckle');
      showResult('Card slipped', `<div class="row"><span>The mark</span><b>${victim.name}</b></div><div class="row"><span>Guest on their way?</span><span class="big">Yes</span></div><div class="quip">"They'll come. They always come."</div>`, 'HOOKED');
    } else {
      sfx.playRandom('angry', 'frustrate');
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
  editor.deselect();
  const finish = (fn) => (res) => { activeGame = null; player.enabled = true; player.keys = {}; if (!res.aborted) fn(res); };
  if (key === 'cashrun') {
    activeGame = new CashRunGame(game);
    activeGame.onDone = finish(res => {
      customers.drainHoppers(res.banked);
      game.addMoney(res.banked, 'cashrun');
      game.save();
      effects.float(player.pos.x, 2.4, player.pos.z, `+${fmtMoney(res.banked)}`, '#ffd700', 1.6);
      if (res.banked > 0) sfx.playRandom('ching', 'triumph', 'chuckle');
      else sfx.play('groan');
      showResult('Vault crack', `<div class="row"><span>Secured in the vault</span><span class="big">${fmtMoney(res.banked)}</span></div><div class="row"><span>Left in the hoppers</span><b>${fmtMoney(game.s.machineCash)}</b></div><div class="quip">"${res.banked === 0 ? 'Couldn\'t remember a single number. Embarrassing.' : 'Cracked it. The money remembers who it belongs to.'}"</div>`, res.banked ? 'CRACKED' : 'LOCKED');
    });
    activeGame.open('Watch the keypad — memorize the sequence, then punch it back. 4 rounds, 3 to 6 digits.');
  } else if (key === 'dealer') {
    activeGame = new DealerGame(game, customers.tablePlayers());
    activeGame.onDone = finish(res => {
      game.save();
      const net = res.won - res.lost;
      const hadBullseye = res.hands.some(h => h.bullseye);
      if (hadBullseye) sfx.play('triumph');
      else if (net > 0) sfx.playRandom('chuckle', 'happy', 'ching');
      else if (net < 0) sfx.playRandom('oof', 'groan', 'frustrate');
      else sfx.play('huff');
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
  else if (e.code === 'KeyH') { if (!modalOpen) { $('help').classList.remove('hidden'); modalOpen = true; setOpenModal('help'); } else if (!$('help').classList.contains('hidden')) { $('help').classList.add('hidden'); modalOpen = false; setOpenModal(null); } }
  else if (e.code === 'Escape') { if (editor.selected) { /* editor handles its own Escape */ } else if (achScreen.open) achScreen.hide(); else if (ledger.open) toggleLedger(); else if (!$('settings').classList.contains('hidden')) closeSettings(); else if (!$('result').classList.contains('hidden')) $('result-close').click(); else if (!$('help').classList.contains('hidden')) $('help-close').click(); else hud.toggleStats(false); }
  else if (e.code === 'KeyM') { music.toggleMute(); updateSettingsUI(); }
  else if (e.code === 'KeyF') {
    if (modalOpen) return;
    if (nearbyPed) { launchAdGame(nearbyPed); }
    else if (currentZone) startActivity(currentZone.key);
  }
  else if (!modalOpen && e.code === 'Digit1') jumpTo('advertising');
  else if (!modalOpen && e.code === 'Digit2') jumpTo('cashrun');
  else if (!modalOpen && e.code === 'Digit3') jumpTo('dealer');
  else if (!modalOpen && e.code === 'KeyG') toggleArrangeMode();
});

// ---- main loop ------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  if (uncapped) setTimeout(frame, 0);
  else requestAnimationFrame(frame);
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
  editor.playerPos.copy(player.pos);
  editor.update(dt, time);
  if (!activeGame) postfx.render(dt);
  perfTick(dt);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.resize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => { if (started) { game.s.playerX = player.pos.x; game.s.playerZ = player.pos.z; } game.save(); });

window.__casino = { game, world, customers, player, effects, pedMgr, editor, step: (secs) => { for (let t = 0; t < secs; t += 0.05) customers.update(0.05); } };
