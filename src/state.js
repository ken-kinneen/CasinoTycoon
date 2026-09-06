import { CASINOS, CUSTOMER_TYPES } from './data/casinos.js';
import { AD_UPGRADES, CASINO_UPGRADES, AWARDS } from './data/upgrades.js';
import { SKILLS, SKILL_COSTS, COSMETICS, COSMETIC_SLOTS } from './data/skills.js';
import { ACHIEVEMENTS } from './data/achievements.js';

const SAVE_KEY = 'casino-tycoon-save-v1';
const SLOTS_KEY = 'casino-tycoon-save-slots';

// Stats that every casino/skill/upgrade can touch, with the player-side defaults.
const PLAYER_BASE = {
  walkSpeed: 6,
  cardWidth: 1,       // multiplier on the pocket channel width
  cardTime: 30,       // seconds per advertising round
  dealerMargin: 0,    // extra +/- tolerance when dealing
  dealerBet: 1,       // multiplier on bet size at the table
  dealerSpeed: 1,     // multiplier on how fast the number sweeps (lower = slower)
};

export const STAT_META = {
  capacity:      { label: 'Guest Capacity',     fmt: v => `${Math.round(v)}`,                  good: +1 },
  machines:      { label: 'Slot Machines',      fmt: v => `${Math.round(v)}`,                  good: +1 },
  tables:        { label: 'Dealer Tables',      fmt: v => `${Math.round(v)}`,                  good: +1 },
  trafficPerMin: { label: 'Walk-in Traffic',    fmt: v => `${v.toFixed(2)}/min`,               good: +1 },
  spendPerMin:   { label: 'Spend per Guest',    fmt: v => `$${v.toFixed(1)}/min`,              good: +1 },
  stayTime:      { label: 'Guest Stay Time',    fmt: v => `${Math.round(v)}s`,                 good: +1 },
  sharpness:     { label: 'Gambler Sharpness',  fmt: v => `${Math.round(v * 100)}%`,           good: -1 },
  houseEdge:     { label: 'House Edge',         fmt: v => `x${v.toFixed(2)}`,                  good: +1 },
  heat:          { label: 'Heat',               fmt: v => `${Math.round(v)}%`,                 good: -1 },
  prestige:      { label: 'Prestige',           fmt: v => `${Math.round(v)}`,                  good: +1 },
  autoCollect:   { label: 'Auto-collect',       fmt: v => `${Math.round(v * 100)}%/min`,       good: +1 },
  hopperCap:     { label: 'Hopper Capacity',    fmt: v => `$${Math.round(v)}`,                 good: +1 },
  walkSpeed:     { label: 'Walk Speed',         fmt: v => `${v.toFixed(1)} m/s`,               good: +1 },
  cardWidth:     { label: 'Pocket Tolerance',   fmt: v => `x${v.toFixed(2)}`,                  good: +1 },
  cardTime:      { label: 'Ad Round Time',      fmt: v => `${Math.round(v)}s`,                 good: +1 },
  dealerMargin:  { label: 'Dealer Margin',      fmt: v => `±${v.toFixed(0)} bonus`,            good: +1 },
  dealerBet:     { label: 'Table Bet Size',     fmt: v => `x${v.toFixed(2)}`,                  good: +1 },
  dealerSpeed:   { label: 'Count Speed',        fmt: v => `x${v.toFixed(2)}`,                  good: -1 },
};

// Which stats show on the casino stats panel (in order).
export const CASINO_STAT_KEYS = ['machines', 'tables', 'trafficPerMin', 'spendPerMin', 'stayTime', 'sharpness', 'houseEdge', 'hopperCap', 'autoCollect', 'prestige', 'heat'];
export const PLAYER_STAT_KEYS = ['walkSpeed', 'cardWidth', 'cardTime', 'dealerMargin', 'dealerBet', 'dealerSpeed'];

function freshState() {
  return {
    money: 200,
    casino: 0,                 // index into CASINOS
    ownedCasinos: [0],
    adUpgrades: [],            // ids
    casinoUpgrades: { duck: [], rat: [], diablo: [] },
    awards: [],
    skills: { sleight: 0, back: 0, poker: 0, tongue: 0, feet: 0 },
    machineCash: 0,            // cash sitting in hoppers, not yet banked
    lifetimeEarned: 0,
    lifetimeCustomers: 0,
    playTime: 0,
    won: false,
    achievements: [],           // ids of unlocked achievements
    achItems: [],               // model keys earned from achievements (placeables)
    equippedItems: [],          // model keys currently displayed in the world
    achCosmetics: [],           // wearable cosmetic keys earned from achievements
    playerName: 'Victor Vane',
    casinoNames: {},           // { duck: 'My Casino', ... } — overrides per casino
    floorLayouts: {},          // { duck: { machines: [...], tables: [...] }, ... } — custom positions
    machineInventory: { duck: [], rat: [], diablo: [] }, // unplaced 'machine' | 'table' per casino
    wardrobe: {},              // { hat: 'poker_5', glasses: 'poker_2', ... } — equipped cosmetic per slot
    lighting: { bloom: 20, exposure: 85, grain: 12, vignette: 45 },
    godMode: false,
    perfStats: false,
    uncapFPS: false,
    openModal: null,           // 'settings' | 'help' | 'ledger:tab' | null
    playerX: null,             // saved player position (null = use default)
    playerZ: null,
    tutorialStep: 0,           // current tutorial step (0 = intro, 7 = done)
    tutorialComplete: false,   // true once tutorial is finished or skipped
  };
}

class GameState {
  constructor() {
    this.s = freshState();
    this.listeners = new Map();
    this.load();
    this.recompute();
  }

  // ---- events -----------------------------------------------------------
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.listeners.get(evt).delete(fn);
  }
  emit(evt, payload) {
    const set = this.listeners.get(evt);
    if (set) for (const fn of set) fn(payload);
  }

  // ---- persistence ------------------------------------------------------
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* private mode etc */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.s = { ...freshState(), ...data };
        this.s.skills = { ...freshState().skills, ...(data.skills || {}) };
        this.s.casinoUpgrades = { ...freshState().casinoUpgrades, ...(data.casinoUpgrades || {}) };
        this.s.casinoNames = { ...freshState().casinoNames, ...(data.casinoNames || {}) };
        this.s.floorLayouts = { ...freshState().floorLayouts, ...(data.floorLayouts || {}) };
        this.s.machineInventory = { ...freshState().machineInventory, ...(data.machineInventory || {}) };
        this.s.wardrobe = { ...freshState().wardrobe, ...(data.wardrobe || {}) };
        this.s.lighting = { ...freshState().lighting, ...(data.lighting || {}) };
        if (!this.s.equippedItems) {
          this.s.equippedItems = [...(this.s.achItems || [])];
        }
        if (!this.s.achCosmetics) this.s.achCosmetics = [];
        // Always reconcile: owned upgrades − placed floor items = inventory
        this.reconcileMachineInventory();
      }
    } catch (e) { this.s = freshState(); }
  }
  reset() {
    this.s = freshState();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.recompute();
    this.emit('reset');
  }

  // ---- derived stats ----------------------------------------------------
  get casinoDef() { return CASINOS[this.s.casino]; }
  get godMode() { return this.s.godMode; }
  set godMode(v) { this.s.godMode = !!v; }

  casinoDisplayName(index) {
    const c = CASINOS[index !== undefined ? index : this.s.casino];
    return this.s.casinoNames[c.id] || c.name;
  }

  /** Collect every active effect list, optionally with an extra hypothetical set. */
  activeEffects(extra = []) {
    const s = this.s;
    const out = [];
    for (const u of AD_UPGRADES) if (s.adUpgrades.includes(u.id)) out.push(...u.effects);
    const cid = this.casinoDef.id;
    for (const u of CASINO_UPGRADES[cid]) if (s.casinoUpgrades[cid].includes(u.id)) out.push(...u.effects);
    for (const a of AWARDS) if (s.awards.includes(a.id)) out.push(...a.effects);
    for (const sk of SKILLS) {
      const lvl = s.skills[sk.id] || 0;
      for (let i = 0; i < lvl; i++) out.push(...sk.perLevel);
    }
    out.push(...extra);
    return out;
  }

  /** Count of machines/tables physically placed on the current casino floor. */
  placedCount(type, casinoId) {
    const cid = casinoId || this.casinoDef.id;
    const layout = (this.s.floorLayouts || {})[cid];
    if (!layout) return 0;
    if (type === 'machine') return (layout.machines || []).length;
    if (type === 'table') return (layout.tables || []).length;
    return 0;
  }

  machineInventoryFor(casinoId) {
    const cid = casinoId || this.casinoDef.id;
    if (!this.s.machineInventory) this.s.machineInventory = { duck: [], rat: [], diablo: [] };
    if (!this.s.machineInventory[cid]) this.s.machineInventory[cid] = [];
    return this.s.machineInventory[cid];
  }

  /** Total machines/tables owned via upgrades (placed + inventory). */
  ownedSpawnCount(type, casinoId) {
    const cid = casinoId || this.casinoDef.id;
    let n = 0;
    for (const u of CASINO_UPGRADES[cid] || []) {
      if (!this.s.casinoUpgrades[cid]?.includes(u.id) || !u.spawns) continue;
      if (u.spawns.type === type) n += u.spawns.count;
    }
    return n;
  }

  /** Push spawn items into inventory when buying a machine/table upgrade. */
  addSpawnsToInventory(u, casinoId) {
    if (!u.spawns) return;
    const inv = this.machineInventoryFor(casinoId);
    for (let i = 0; i < u.spawns.count; i++) inv.push(u.spawns.type);
  }

  /** Take one item from inventory. Returns type or null. */
  takeFromInventory(type, casinoId) {
    const inv = this.machineInventoryFor(casinoId);
    const idx = inv.indexOf(type);
    if (idx === -1) return null;
    inv.splice(idx, 1);
    return type;
  }

  /** Return an item to inventory (e.g. cancel place). */
  returnToInventory(type, casinoId) {
    this.machineInventoryFor(casinoId).push(type);
  }

  /** Rebuild inventory so owned - placed = unplaced. Recovers lost items. */
  reconcileMachineInventory() {
    if (!this.s.machineInventory) this.s.machineInventory = { duck: [], rat: [], diablo: [] };
    for (const cid of Object.keys(CASINO_UPGRADES)) {
      const needM = Math.max(0, this.ownedSpawnCount('machine', cid) - this.placedCount('machine', cid));
      const needT = Math.max(0, this.ownedSpawnCount('table', cid) - this.placedCount('table', cid));
      this.s.machineInventory[cid] = [
        ...Array(needM).fill('machine'),
        ...Array(needT).fill('table'),
      ];
    }
  }

  /** @deprecated use reconcileMachineInventory */
  _migrateMachineInventory() { this.reconcileMachineInventory(); }

  computeStats(extraEffects = []) {
    const base = { ...PLAYER_BASE, ...this.casinoDef.base };
    const adds = {}, muls = {};
    for (const e of this.activeEffects(extraEffects)) {
      // machines/tables come from the floor, never from upgrade effects
      if (e.stat === 'machines' || e.stat === 'tables') continue;
      if (e.add !== undefined) adds[e.stat] = (adds[e.stat] || 0) + e.add;
      if (e.mul !== undefined) muls[e.stat] = (muls[e.stat] || 1) * e.mul;
    }
    const st = {};
    for (const k of Object.keys(base)) {
      st[k] = (base[k] + (adds[k] || 0)) * (muls[k] || 1);
    }
    // Floor is the source of truth for physical equipment
    st.machines = this.placedCount('machine');
    st.tables = this.placedCount('table');
    // Hypothetical previews: extraEffects may include machines/tables for shop deltas
    for (const e of extraEffects) {
      if (e.stat === 'machines' && e.add) st.machines += e.add;
      if (e.stat === 'tables' && e.add) st.tables += e.add;
    }
    st.heat = Math.max(0, Math.min(100, st.heat));
    st.sharpness = Math.max(0.05, Math.min(1, st.sharpness));
    st.autoCollect = Math.min(0.9, st.autoCollect);
    st.prestige = Math.max(0, st.prestige);
    return st;
  }

  recompute() {
    this.stats = this.computeStats();
    this.refreshWardrobe();
    this.emit('stats', this.stats);
  }

  /** Stat deltas if a given effect list were applied. Returns [{key, from, to}]. */
  previewEffects(effects) {
    const now = this.stats;
    const then = this.computeStats(effects);
    const deltas = [];
    for (const e of effects) {
      const k = e.stat;
      if (deltas.find(d => d.key === k)) continue;
      deltas.push({ key: k, from: now[k], to: then[k] });
    }
    return deltas;
  }

  /** Preview for a spawn upgrade (machines go to inventory, not floor yet). */
  previewSpawns(u) {
    if (!u.spawns) return [];
    const key = u.spawns.type === 'machine' ? 'machines' : 'tables';
    const from = this.stats[key];
    return [{ key, from, to: from + u.spawns.count, inventory: true }];
  }

  // ---- money ------------------------------------------------------------
  addMoney(n, source = 'misc') {
    if (n <= 0) return;
    this.s.money += n;
    this.s.lifetimeEarned += n;
    this.emit('money', { amount: n, source });
  }
  spend(n) {
    if (!this.godMode && this.s.money < n) return false;
    if (!this.godMode) this.s.money -= n;
    this.emit('money', { amount: this.godMode ? 0 : -n, source: 'spend' });
    return true;
  }

  // ---- purchases --------------------------------------------------------
  buyAd(id) {
    const u = AD_UPGRADES.find(x => x.id === id);
    if (!u || this.s.adUpgrades.includes(id) || !this.spend(u.cost)) return false;
    this.s.adUpgrades.push(id);
    this.afterPurchase(u);
    return true;
  }
  buyCasinoUpgrade(id) {
    const cid = this.casinoDef.id;
    const u = CASINO_UPGRADES[cid].find(x => x.id === id);
    if (!u || this.s.casinoUpgrades[cid].includes(id) || !this.spend(u.cost)) return false;
    this.s.casinoUpgrades[cid].push(id);
    this.addSpawnsToInventory(u, cid);
    this.reconcileMachineInventory();
    this.afterPurchase(u);
    return true;
  }
  buyAward(id) {
    const a = AWARDS.find(x => x.id === id);
    if (!a || this.s.awards.includes(id) || !this.spend(a.cost)) return false;
    this.s.awards.push(id);
    this.afterPurchase(a);
    return true;
  }
  buySkill(id) {
    const sk = SKILLS.find(x => x.id === id);
    const lvl = this.s.skills[id] || 0;
    if (!sk || lvl >= 5) return false;
    const cost = SKILL_COSTS[lvl];
    if (!this.spend(cost)) return false;
    this.s.skills[id] = lvl + 1;
    this.recompute();
    this.save();
    this.emit('skill', { id, level: lvl + 1 });
    return true;
  }
  buyCasino(index) {
    const c = CASINOS[index];
    if (!c || this.s.ownedCasinos.includes(index) || !this.spend(c.price)) return false;
    this.s.ownedCasinos.push(index);
    this.moveToCasino(index);
    if (index === 2 && !this.s.won) { this.s.won = true; this.emit('won'); }
    return true;
  }
  moveToCasino(index) {
    if (!this.s.ownedCasinos.includes(index)) return false;
    this.s.casino = index;
    this.s.machineCash = 0;
    this.recompute();
    this.save();
    this.emit('casino', index);
    return true;
  }
  afterPurchase(u) {
    this.recompute();
    this.save();
    this.emit('upgrade', u);
  }

  // ---- achievements ----------------------------------------------------------
  checkAchievements() {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.s.achievements.includes(a.id)) continue;
      if (a.requires && !this.s.achievements.includes(a.requires)) continue;
      try {
        if (a.check(this.s, this.stats)) {
          // Claim immediately so chained achievements can unlock in the same pass
          if (this.claimAchievement(a.id)) newly.push(a);
        }
      } catch (_) {}
    }
    return newly;
  }
  claimAchievement(id) {
    if (this.s.achievements.includes(id)) return null;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return null;
    if (a.requires && !this.s.achievements.includes(a.requires)) return null;
    this.s.achievements.push(id);
    if (a.reward) this.addMoney(a.reward, 'achievement');
    if (a.item) {
      if (!this.s.achItems) this.s.achItems = [];
      if (!this.s.achItems.includes(a.item)) this.s.achItems.push(a.item);
      if (!this.s.equippedItems) this.s.equippedItems = [];
      if (!this.s.equippedItems.includes(a.item)) this.s.equippedItems.push(a.item);
    }
    if (a.cosmetic) {
      if (!this.s.achCosmetics) this.s.achCosmetics = [];
      if (!this.s.achCosmetics.includes(a.cosmetic)) this.s.achCosmetics.push(a.cosmetic);
      // Auto-equip into its wardrobe slot
      const c = COSMETICS.find(x => x.key === a.cosmetic);
      if (c) {
        this.s.wardrobe[c.slot] = a.cosmetic;
        this.emit('wardrobe', a.cosmetic);
      }
    }
    this.recompute();
    this.save();
    this.emit('achievement', a);
    return a;
  }

  equipItem(key) {
    if (!this.s.equippedItems) this.s.equippedItems = [];
    if (!this.s.achItems || !this.s.achItems.includes(key)) return false;
    if (this.s.equippedItems.includes(key)) return false;
    this.s.equippedItems.push(key);
    this.save();
    this.emit('equip', key);
    return true;
  }
  unequipItem(key) {
    if (!this.s.equippedItems) return false;
    const idx = this.s.equippedItems.indexOf(key);
    if (idx === -1) return false;
    this.s.equippedItems.splice(idx, 1);
    this.save();
    this.emit('equip', key);
    return true;
  }
  isEquipped(key) {
    return (this.s.equippedItems || []).includes(key);
  }

  // ---- wardrobe (slot-based cosmetics) ----------------------------------------

  /** Whether the player owns a cosmetic (skill-unlocked or achievement-granted). */
  ownsCosmetic(key) {
    const c = COSMETICS.find(x => x.key === key);
    if (!c) return false;
    if (c.source === 'achievement') {
      return (this.s.achCosmetics || []).includes(key);
    }
    return (this.s.skills[c.source] || 0) >= (c.level || 0);
  }

  /** Auto-equip the best unlocked cosmetic for each slot (used on first load / skill up). */
  _autoEquipSlot(slot) {
    const candidates = COSMETICS.filter(c => c.slot === slot && this.ownsCosmetic(c.key));
    if (!candidates.length) { delete this.s.wardrobe[slot]; return; }
    const current = this.s.wardrobe[slot];
    if (current && candidates.some(c => c.key === current)) return;
    // Prefer highest skill level; achievement items (no level) win ties by being last
    const best = candidates.reduce((a, b) => (b.level || 0) > (a.level || 0) ? b : a);
    this.s.wardrobe[slot] = best.key;
  }

  /** Called after skill changes — auto-equip newly unlocked slots without overriding player choices. */
  refreshWardrobe() {
    const OLD_TO_NEW = { wrist: 'hands', sleeve: 'hands', arms: 'torso', coat: 'torso', cape: 'torso', belt: 'waist', hip: 'waist' };
    for (const [old, neu] of Object.entries(OLD_TO_NEW)) {
      if (this.s.wardrobe[old]) {
        if (!this.s.wardrobe[neu]) this.s.wardrobe[neu] = this.s.wardrobe[old];
        delete this.s.wardrobe[old];
      }
    }
    for (const slot of Object.keys(COSMETIC_SLOTS)) {
      const current = this.s.wardrobe[slot];
      if (current) {
        if (this.ownsCosmetic(current)) continue;
        delete this.s.wardrobe[slot];
      }
      this._autoEquipSlot(slot);
    }
    this.save();
  }

  /** Get the cosmetic key equipped in a slot, or null. */
  getSlot(slot) { return this.s.wardrobe[slot] || null; }

  /** Equip a cosmetic into its slot (replaces whatever was there). */
  equipCosmetic(key) {
    const c = COSMETICS.find(x => x.key === key);
    if (!c) return false;
    if (!this.ownsCosmetic(key)) return false;
    this.s.wardrobe[c.slot] = key;
    this.save();
    this.emit('wardrobe', key);
    return true;
  }

  /** Unequip a slot (remove cosmetic, leave slot empty). */
  unequipSlot(slot) {
    delete this.s.wardrobe[slot];
    this.save();
    this.emit('wardrobe', slot);
  }

  /** Check if a cosmetic key is currently worn. */
  isWorn(key) {
    const c = COSMETICS.find(x => x.key === key);
    if (!c) return false;
    return this.s.wardrobe[c.slot] === key;
  }

  /** Build the wardrobe map for makeOwner(): { hat: 'poker_5', glasses: null, ... } */
  wardrobeMap() {
    const map = {};
    for (const slot of Object.keys(COSMETIC_SLOTS)) {
      map[slot] = this.s.wardrobe[slot] || null;
    }
    return map;
  }

  // helpers for the UI
  ownsAd(id) { return this.s.adUpgrades.includes(id); }
  ownsCasinoUpgrade(id) { return this.s.casinoUpgrades[this.casinoDef.id].includes(id); }
  ownsAward(id) { return this.s.awards.includes(id); }
  skillLevel(id) { return this.s.skills[id] || 0; }
  skillCost(id) { const l = this.skillLevel(id); return l >= 5 ? null : SKILL_COSTS[l]; }
  hasModel(key) {
    const s = this.s;
    const cid = this.casinoDef.id;
    for (const u of AD_UPGRADES) if (u.model === key && s.adUpgrades.includes(u.id)) return true;
    for (const u of CASINO_UPGRADES[cid]) if (u.model === key && s.casinoUpgrades[cid].includes(u.id)) return true;
    for (const a of AWARDS) if (a.model === key && s.awards.includes(a.id)) return true;
    if (s.equippedItems && s.equippedItems.includes(key)) return true;
    return false;
  }

  // ---- save slots (dev testing) -----------------------------------------------
  static _loadSlots() {
    try { return JSON.parse(localStorage.getItem(SLOTS_KEY)) || {}; } catch { return {}; }
  }
  static _saveSlots(slots) {
    try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch {}
  }
  listSlots() {
    const slots = GameState._loadSlots();
    return Object.entries(slots)
      .map(([id, sl]) => ({ id, name: sl.name, date: sl.date, casino: sl.casino, money: sl.money, playerName: sl.playerName }))
      .sort((a, b) => b.date - a.date);
  }
  saveToSlot(name) {
    const slots = GameState._loadSlots();
    const id = 'slot_' + Date.now();
    this.save();
    slots[id] = {
      name,
      date: Date.now(),
      casino: this.s.casino,
      money: this.s.money,
      playerName: this.s.playerName,
      state: JSON.parse(JSON.stringify(this.s)),
    };
    GameState._saveSlots(slots);
    return id;
  }
  loadFromSlot(id) {
    const slots = GameState._loadSlots();
    const sl = slots[id];
    if (!sl || !sl.state) return false;
    this.s = { ...freshState(), ...sl.state };
      this.s.skills = { ...freshState().skills, ...(sl.state.skills || {}) };
      this.s.casinoUpgrades = { ...freshState().casinoUpgrades, ...(sl.state.casinoUpgrades || {}) };
      this.s.casinoNames = { ...freshState().casinoNames, ...(sl.state.casinoNames || {}) };
      this.s.floorLayouts = { ...freshState().floorLayouts, ...(sl.state.floorLayouts || {}) };
      this.s.machineInventory = { ...freshState().machineInventory, ...(sl.state.machineInventory || {}) };
      this.s.wardrobe = { ...freshState().wardrobe, ...(sl.state.wardrobe || {}) };
      this.s.lighting = { ...freshState().lighting, ...(sl.state.lighting || {}) };
      if (!sl.state.machineInventory) this.reconcileMachineInventory();
      else this.reconcileMachineInventory();
    this.recompute();
    this.save();
    this.emit('reset');
    return true;
  }
  deleteSlot(id) {
    const slots = GameState._loadSlots();
    delete slots[id];
    GameState._saveSlots(slots);
  }
  renameSlot(id, name) {
    const slots = GameState._loadSlots();
    if (slots[id]) { slots[id].name = name; GameState._saveSlots(slots); }
  }
}

export const game = new GameState();
export { CASINOS, CUSTOMER_TYPES, AD_UPGRADES, CASINO_UPGRADES, AWARDS, SKILLS, SKILL_COSTS, ACHIEVEMENTS, COSMETICS, COSMETIC_SLOTS };
