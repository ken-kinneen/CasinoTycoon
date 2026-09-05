import { CASINOS } from './data/casinos.js';
import { AD_UPGRADES, CASINO_UPGRADES, AWARDS } from './data/upgrades.js';
import { SKILLS, SKILL_COSTS } from './data/skills.js';

const SAVE_KEY = 'casino-tycoon-save-v1';

// Stats that every casino/skill/upgrade can touch, with the player-side defaults.
const PLAYER_BASE = {
  walkSpeed: 6,
  cardWidth: 1,       // multiplier on the pocket channel width
  cardTime: 30,       // seconds per advertising round
  stackSize: 80,      // $ per cash stack in the cash run
  cashTime: 18,       // seconds per cash run
  dealerMargin: 0,    // extra +/- tolerance when dealing
  dealerBet: 1,       // multiplier on bet size at the table
  dealerSpeed: 1,     // multiplier on how fast the number sweeps (lower = slower)
};

export const STAT_META = {
  capacity:      { label: 'Capacity',           fmt: v => `${Math.round(v)} guests`,           good: +1 },
  machines:      { label: 'Slot Machines',      fmt: v => `${Math.round(v)}`,                  good: +1 },
  tables:        { label: 'Dealer Tables',      fmt: v => `${Math.round(v)}`,                  good: +1 },
  trafficPerMin: { label: 'Walk-in Traffic',    fmt: v => `${v.toFixed(2)}/min`,               good: +1 },
  cardConversion:{ label: 'Ad Card Conversion', fmt: v => `${Math.round(v * 100)}%`,           good: +1 },
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
  stackSize:     { label: 'Cash Stack Size',    fmt: v => `$${Math.round(v)}`,                 good: +1 },
  cashTime:      { label: 'Cash Run Time',      fmt: v => `${Math.round(v)}s`,                 good: +1 },
  dealerMargin:  { label: 'Dealer Margin',      fmt: v => `±${v.toFixed(0)} bonus`,            good: +1 },
  dealerBet:     { label: 'Table Bet Size',     fmt: v => `x${v.toFixed(2)}`,                  good: +1 },
  dealerSpeed:   { label: 'Count Speed',        fmt: v => `x${v.toFixed(2)}`,                  good: -1 },
};

// Which stats show on the casino stats panel (in order).
export const CASINO_STAT_KEYS = ['capacity', 'machines', 'tables', 'trafficPerMin', 'cardConversion', 'spendPerMin', 'stayTime', 'sharpness', 'houseEdge', 'hopperCap', 'autoCollect', 'prestige', 'heat'];
export const PLAYER_STAT_KEYS = ['walkSpeed', 'cardWidth', 'cardTime', 'cardConversion', 'stackSize', 'cashTime', 'dealerMargin', 'dealerBet', 'dealerSpeed'];

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
    playerX: null,             // saved player position (null = use default)
    playerZ: null,
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

  computeStats(extraEffects = []) {
    const base = { ...PLAYER_BASE, ...this.casinoDef.base };
    const adds = {}, muls = {};
    for (const e of this.activeEffects(extraEffects)) {
      if (e.add !== undefined) adds[e.stat] = (adds[e.stat] || 0) + e.add;
      if (e.mul !== undefined) muls[e.stat] = (muls[e.stat] || 1) * e.mul;
    }
    const st = {};
    for (const k of Object.keys(base)) {
      st[k] = (base[k] + (adds[k] || 0)) * (muls[k] || 1);
    }
    st.heat = Math.max(0, Math.min(100, st.heat));
    st.sharpness = Math.max(0.05, Math.min(1, st.sharpness));
    st.autoCollect = Math.min(0.9, st.autoCollect);
    st.prestige = Math.max(0, st.prestige);
    return st;
  }

  recompute() {
    this.stats = this.computeStats();
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

  // ---- money ------------------------------------------------------------
  addMoney(n, source = 'misc') {
    if (n <= 0) return;
    this.s.money += n;
    this.s.lifetimeEarned += n;
    this.emit('money', { amount: n, source });
  }
  spend(n) {
    if (this.s.money < n) return false;
    this.s.money -= n;
    this.emit('money', { amount: -n, source: 'spend' });
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
    return false;
  }
}

export const game = new GameState();
export { CASINOS, AD_UPGRADES, CASINO_UPGRADES, AWARDS, SKILLS, SKILL_COSTS };
