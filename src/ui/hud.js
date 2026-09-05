import { STAT_META, CASINO_STAT_KEYS, PLAYER_STAT_KEYS, CASINOS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { ICONS, icon } from './icons.js';

const $ = id => document.getElementById(id);

// ---- toasts & the owner's speech bubble ----------------------------------------
export function toast(msg, kind = '', ms = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  const box = $('toasts');
  while (box.children.length >= 4) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400); }, ms);
}
let bubbleTimer = null;
export function quip(msg, ms = 5000) {
  const b = $('bubble'); if (!b) return;
  $('bubble-text').textContent = msg;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

const STAT_ICON = { capacity: 'people', machines: 'machine', tables: 'cards', trafficPerMin: 'walk', cardConversion: 'card', spendPerMin: 'dollar', stayTime: 'clock', sharpness: 'shades', houseEdge: 'chip', hopperCap: 'vault', autoCollect: 'vault', prestige: 'crown', heat: 'flame', walkSpeed: 'shoe', cardWidth: 'hand', cardTime: 'clock', stackSize: 'muscle', cashTime: 'clock', dealerMargin: 'hat', dealerBet: 'chip', dealerSpeed: 'clock' };

export class HUD {
  constructor(game, customers) {
    this.game = game; this.customers = customers;
    this.el = $('hud');
    this.statsPanel = $('stats-panel');
    this.acc = 0;
    this.shownMoney = game.s.money;
    // inject icons
    const put = (id, name) => { const e = $(id); if (e) e.innerHTML = ICONS[name]; };
    put('ico-hopper', 'vault'); put('ico-guests', 'people'); put('ico-heat', 'flame');
    put('ico-ledger', 'ledger'); put('ico-stats', 'stats'); put('ico-help', 'help');
    put('ico-hot-ads', 'card'); put('ico-hot-cash', 'safe'); put('ico-hot-deal', 'cards'); put('ico-hot-ledger', 'ledger');
    document.querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = ICONS[e.dataset.ico]; });
    this.drawPortrait();
    game.on('skill', () => this.drawPortrait());
    game.on('money', ({ amount }) => { if (amount > 0) { const m = $('hud-money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); } });
  }
  show() { this.el.classList.remove('hidden'); }

  /** Victor's portrait: painted straight onto the HUD canvas. */
  drawPortrait() {
    const c = $('portrait'); if (!c) return;
    const ctx = c.getContext('2d'); const sk = this.game.s.skills;
    const W = c.width, H = c.height;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1240'); g.addColorStop(1, '#0a0610');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // spotlight
    const r = ctx.createRadialGradient(W / 2, 40, 10, W / 2, 60, 110); r.addColorStop(0, 'rgba(255,200,120,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    // shoulders / suit
    ctx.fillStyle = sk.tongue >= 5 ? '#5a0a2a' : '#1c1030'; ctx.beginPath(); ctx.moveTo(10, H); ctx.quadraticCurveTo(20, 100, 60, 96); ctx.lineTo(100, 96); ctx.quadraticCurveTo(140, 100, 150, H); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; for (let x = 16; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x - 4, H); ctx.stroke(); }
    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.moveTo(66, 96); ctx.lineTo(80, 128); ctx.lineTo(94, 96); ctx.fill();
    ctx.fillStyle = '#9b0000'; ctx.beginPath(); ctx.moveTo(76, 100); ctx.lineTo(80, 132); ctx.lineTo(84, 100); ctx.fill();
    if (sk.tongue >= 2) { ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(80, 96, 20, 0.3, Math.PI - 0.3); ctx.stroke(); }
    if (sk.tongue >= 4) { ctx.fillStyle = '#f0e2c8'; ctx.fillRect(10, 96, 50, 16); ctx.fillRect(100, 96, 50, 16); }
    // neck + head
    ctx.fillStyle = '#e0ac69'; ctx.fillRect(70, 84, 20, 16);
    ctx.fillStyle = '#e0ac69'; ctx.beginPath(); ctx.roundRect(48, 30, 64, 66, 10); ctx.fill();
    // hair with widow's peak
    ctx.fillStyle = '#0d0d0d'; ctx.beginPath(); ctx.moveTo(46, 44); ctx.quadraticCurveTo(48, 22, 80, 24); ctx.quadraticCurveTo(112, 22, 114, 44); ctx.lineTo(114, 38); ctx.lineTo(46, 38); ctx.fill();
    ctx.beginPath(); ctx.moveTo(66, 30); ctx.lineTo(80, 42); ctx.lineTo(94, 30); ctx.fill();
    ctx.fillRect(46, 40, 6, 22); ctx.fillRect(108, 40, 6, 22);
    // brows (angry), eyes, nose, sneer, gold tooth
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(56, 50); ctx.lineTo(72, 56); ctx.stroke(); ctx.beginPath(); ctx.moveTo(104, 50); ctx.lineTo(88, 56); ctx.stroke();
    if (sk.poker >= 2) { ctx.fillStyle = '#050505'; ctx.fillRect(54, 56, 22, 12); ctx.fillRect(84, 56, 22, 12); ctx.fillRect(76, 60, 8, 3); }
    else { for (const ex of [65, 95]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 62, 8, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(ex, 63, 3.2, 0, 7); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(80, 64); ctx.lineTo(76, 76); ctx.lineTo(83, 78); ctx.stroke();
    ctx.strokeStyle = '#4a1a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(66, 88); ctx.quadraticCurveTo(80, 82, 96, 85); ctx.stroke();
    ctx.fillStyle = '#f5c542'; ctx.fillRect(86, 84, 5, 4);
    // cigarette / cigar
    if (sk.poker >= 3) { ctx.fillStyle = '#5a2a0a'; ctx.fillRect(94, 84, 26, 6); ctx.fillStyle = '#ff5500'; ctx.fillRect(118, 84, 4, 6); }
    else { ctx.fillStyle = '#fff'; ctx.fillRect(94, 86, 22, 3); ctx.fillStyle = '#ff5500'; ctx.fillRect(114, 86, 3, 3); }
    // hat
    if (sk.poker >= 4) { ctx.fillStyle = sk.poker >= 5 ? '#f5c542' : '#0a0a0a'; ctx.fillRect(40, 26, 80, 6); ctx.fillRect(52, 0, 56, 28); ctx.fillStyle = '#8b0000'; ctx.fillRect(52, 20, 56, 5); }
    else if (sk.poker >= 1) { ctx.fillStyle = 'rgba(0,200,120,0.7)'; ctx.fillRect(46, 34, 68, 7); }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 110); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const total = Object.values(sk).reduce((a, b) => a + b, 0);
    $('portrait-title').textContent = total >= 20 ? 'Kingpin' : total >= 12 ? 'Racketeer' : total >= 6 ? 'Operator' : total >= 2 ? 'Hustler' : 'Proprietor';
  }

  update(dt) {
    // smooth money counter every frame
    const target = this.game.s.money;
    if (Math.abs(target - this.shownMoney) > 0.5) { this.shownMoney += (target - this.shownMoney) * Math.min(1, dt * 6); if (Math.abs(target - this.shownMoney) < 1) this.shownMoney = target; $('hud-money').textContent = fmtMoney(this.shownMoney); }
    this.acc += dt;
    if (this.acc < 0.15) return;
    this.acc = 0;
    const g = this.game, st = g.stats;
    $('hud-casino').textContent = g.casinoDef.name.replace(', Las Vegas', '');
    $('hud-casino-index').textContent = `CASINO ${g.s.casino + 1} OF 3${g.s.casino === 2 ? ' · LAS VEGAS' : ''}`;
    $('hud-emblem').textContent = ['LD', 'GR', 'PD'][g.s.casino];
    const cap = st.hopperCap * (st.machines + st.tables);
    const full = this.customers.world.machines.filter(m => m.cash >= st.hopperCap - 0.5).length;
    $('hud-hopper').textContent = `${fmtMoney(g.s.machineCash)}${full ? ` · ${full} FULL` : ''}`;
    const hb = $('hud-hopper-bar'); hb.style.width = `${Math.min(100, g.s.machineCash / cap * 100)}%`; hb.classList.toggle('full', full > 0);
    $('hud-guests').textContent = `${this.customers.count} / ${Math.round(st.capacity)}${this.customers.pending ? ` (+${this.customers.pending})` : ''}`;
    $('hud-guests-bar').style.width = `${Math.min(100, this.customers.count / st.capacity * 100)}%`;
    const types = { whale: 0, sharp: 0, drunk: 0 };
    for (const c of this.customers.customers) if (types[c.type] !== undefined) types[c.type]++;
    $('hud-types').innerHTML = `${types.whale ? icon('whale') + types.whale : ''}${types.drunk ? icon('beer') + types.drunk : ''}${types.sharp ? icon('shades') + types.sharp : ''}`;
    $('hud-heat').textContent = `${Math.round(st.heat)}%`;
    $('hud-heat-bar').style.width = `${st.heat}%`;
    // goal tracker
    const next = CASINOS.findIndex((c, i) => !g.s.ownedCasinos.includes(i));
    const goal = $('hud-goal');
    if (next === -1) { $('goal-label').innerHTML = `<span>VEGAS ACHIEVED</span><span>${icon('crown')}</span>`; $('goal-fill').style.width = '100%'; $('goal-nums').textContent = `Lifetime take ${fmtMoney(g.s.lifetimeEarned)}`; }
    else { const c = CASINOS[next]; $('goal-label').innerHTML = `<span>NEXT: ${c.name.replace(', Las Vegas', '').toUpperCase()}</span><span>${Math.min(100, Math.floor(g.s.money / c.price * 100))}%</span>`; $('goal-fill').style.width = `${Math.min(100, g.s.money / c.price * 100)}%`; $('goal-nums').textContent = `${fmtMoney(g.s.money)} / ${fmtMoney(c.price)}`; }
    if (!this.statsPanel.classList.contains('hidden')) this.renderStats();
  }

  setPrompt(text, zoneKey) {
    const p = $('hud-prompt');
    if (!text) p.classList.add('hidden'); else { p.classList.remove('hidden'); $('hud-prompt-text').textContent = text; }
    document.querySelectorAll('.hot').forEach(h => h.classList.toggle('near', h.dataset.key === zoneKey));
  }

  toggleStats(force) {
    const p = this.statsPanel;
    const show = force !== undefined ? force : p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    if (show) this.renderStats();
  }

  renderStats() {
    const g = this.game, st = g.stats;
    $('stats-casino').textContent = g.casinoDef.name;
    const grid = (keys) => keys.map(k => `<div class="k">${icon(STAT_ICON[k] || 'star')}${STAT_META[k].label}</div><div class="v">${STAT_META[k].fmt(st[k])}</div>`).join('');
    $('stats-casino-grid').innerHTML = grid(CASINO_STAT_KEYS) + `<div class="k">${icon('people')}Guests inside</div><div class="v">${this.customers.count}</div><div class="k">${icon('vault')}Cash in hoppers</div><div class="v">${fmtMoney(g.s.machineCash)}</div>`;
    $('stats-player-grid').innerHTML = grid(PLAYER_STAT_KEYS);
    const mins = Math.floor(g.s.playTime / 60);
    $('stats-life').innerHTML = `Lifetime take <b>${fmtMoney(g.s.lifetimeEarned)}</b> · Guests fleeced <b>${g.s.lifetimeCustomers}</b> · Time on the floor <b>${mins} min</b>`;
  }
}
