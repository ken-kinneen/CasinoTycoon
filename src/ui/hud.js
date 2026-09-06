import * as THREE from 'three';
import { STAT_META, CASINO_STAT_KEYS, PLAYER_STAT_KEYS, ACHIEVEMENTS, SKILLS, SKILL_COSTS, COSMETICS, COSMETIC_SLOTS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { ICONS, icon } from './icons.js';
import { makeOwner } from '../world/people.js';
import { renderCosmeticPreview, renderCosmeticKeyPreview } from './model-preview.js';
import * as M from '../world/models.js';
import * as T from '../engine/textures.js';

const $ = id => document.getElementById(id);

// ---- toasts & quips → unified message system ----------------------------------------
import { showMessage as _showMsg, isMessagesEnabled } from './messages.js';

export function toast(msg, kind = '', ms = 3500) {
  if (isMessagesEnabled()) {
    const from = kind === 'bad' ? 'system' : 'casino';
    _showMsg(msg, { from, duration: ms });
    return;
  }
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
  if (isMessagesEnabled()) {
    _showMsg(msg, { from: 'player', duration: ms });
    return;
  }
  const b = $('bubble'); if (!b) return;
  $('bubble-text').textContent = msg;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

export const STAT_ICON = { capacity: 'people', machines: 'machine', tables: 'cards', trafficPerMin: 'walk', spendPerMin: 'dollar', stayTime: 'clock', sharpness: 'shades', houseEdge: 'chip', hopperCap: 'vault', autoCollect: 'vault', prestige: 'crown', heat: 'flame', walkSpeed: 'shoe', cardWidth: 'hand', cardTime: 'clock', dealerMargin: 'hat', dealerBet: 'chip', dealerSpeed: 'clock' };

const MILESTONES = [
  { key: 'balance', label: 'Balance', icon: 'dollar', get: s => s.money, achIds: ['hoard_50k'], fmt: fmtMoney },
  { key: 'earned', label: 'Lifetime Take', icon: 'dollar', get: s => s.lifetimeEarned, achIds: ['earn_1k', 'earn_5k', 'high_roller_shades', 'earn_25k', 'earn_100k', 'diamond_eyes', 'earn_500k'], fmt: fmtMoney },
  { key: 'guests', label: 'Guests Served', icon: 'people', get: s => s.lifetimeCustomers, achIds: ['guests_10', 'guests_50', 'street_cred', 'guests_200', 'guests_1000'], fmt: v => v.toLocaleString() },
  { key: 'time', label: 'Time on Floor', icon: 'clock', get: s => s.playTime, achIds: ['time_10', 'floor_boss', 'time_30', 'time_60'], fmt: v => { const m = Math.floor(v / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; } },
];

const ITEM_NAMES = { toilet: 'Gold Toilet', selfstatue: 'Your Statue', namelights: 'Name in Lights', tiger: 'Pet Tiger', fountain: 'Champagne Fountain' };

export class HUD {
  static portraitDataURL = null;
  constructor(game, customers) {
    this.game = game; this.customers = customers;
    this.el = $('hud');
    this.wardrobePanel = $('wardrobe-panel');
    this.acc = 0;
    this.achAcc = 0;
    this.shownMoney = game.s.money;
    this._modelT = 0;
    this._wardrobeTab = 'wardrobe';
    this._wardrobeOpen = false;
    
    const put = (id, name) => { const e = $(id); if (e) e.innerHTML = ICONS[name]; };
    put('ico-guests', 'people'); put('ico-heat', 'flame');
    put('ico-ledger', 'ledger'); put('ico-help', 'help'); put('ico-settings', 'gear'); put('ico-settings-music', 'music');
    put('ico-hot-ads', 'card'); put('ico-hot-deal', 'cards'); put('ico-hot-roulette', 'chip'); put('ico-hot-ledger', 'ledger'); put('ico-hot-arrange', 'hammer');
    document.querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = ICONS[e.dataset.ico]; });
    this._initModelPreview();
    this._initCasinoPreview();
    this._initWardrobe();
    this.drawPortrait();
    this.buildCasinoModel();
    this.renderMilestones();
    game.on('skill', () => { this.drawPortrait(); if (this._wardrobeOpen) this.renderWardrobe(); });
    game.on('wardrobe', () => { this.drawPortrait(); if (this._wardrobeOpen) { this._drawWardrobePreview(); this.renderWardrobe(); } });
    game.on('casino', () => this.buildCasinoModel());
    game.on('money', () => this.renderMilestones());
    game.on('achievement', (a) => {
      const rewardText = a.reward ? ` — ${fmtMoney(a.reward)}` : '';
      _showMsg(`${a.name}${rewardText}`, { from: 'trophy', duration: 5000 });
      _showMsg(a.hint, { from: 'player', duration: 5000 });
      if (this._wardrobeOpen) this.renderWardrobe();
    });
  }
  show() { this.el.classList.remove('hidden'); }


  renderMilestones() {
    const el = $('pp-milestones'); if (!el) return;
    const s = this.game.s;
    const unlocked = s.achievements;

    const rows = MILESTONES.map(m => {
      const cur = m.key === 'balance' ? this.shownMoney : m.get(s);
      const nextAch = m.achIds.map(id => ACHIEVEMENTS.find(a => a.id === id)).find(a => a && !unlocked.includes(a.id));
      const valText = m.fmt(cur);
      return { m, cur, nextAch, valText };
    });

    el.innerHTML = rows.map(r => {
      return `<div class="sb-stat-row${r.nextAch ? ' has-tip' : ''}" data-ms="${r.m.key}">` +
        `<span class="ico-slot">${ICONS[r.m.icon] || ICONS.star}</span>` +
        `<span class="sb-stat-label">${r.m.label}</span>` +
        `<span class="sb-stat-val">${r.valText}</span></div>`;
    }).join('');

    el.querySelectorAll('.sb-stat-row.has-tip').forEach(row => {
      const key = row.dataset.ms;
      const r = rows.find(x => x.m.key === key);
      if (!r || !r.nextAch) return;
      row.onmouseenter = () => {
        let tip = row.querySelector('.pp-tip');
        if (tip) return;
        tip = document.createElement('div');
        tip.className = 'pp-tip';
        const a = r.nextAch;
        const rewards = [];
        if (a.reward) rewards.push(`<span class="pp-tip-cash">+${fmtMoney(a.reward)}</span>`);
        if (a.item) rewards.push(`<span class="pp-tip-item">${icon('star')}${ITEM_NAMES[a.item] || a.item}</span>`);
        if (a.cosmetic) {
          const cos = COSMETICS.find(c => c.key === a.cosmetic);
          rewards.push(`<span class="pp-tip-item">${icon('star')}${cos ? cos.name : a.cosmetic}</span>`);
        }
        tip.innerHTML = `<div class="pp-tip-name">${a.name}</div>` +
          `<div class="pp-tip-hint">${a.hint}</div>` +
          (rewards.length ? `<div class="pp-tip-rewards">${rewards.join('')}</div>` : '');
        row.appendChild(tip);
      };
      row.onmouseleave = () => {
        const tip = row.querySelector('.pp-tip');
        if (tip) tip.remove();
      };
    });
  }

  // ---- wardrobe panel --------------------------------------------------------
  _initWardrobe() {
    const closeWd = () => { this.toggleWardrobe(false); if (this.onWardrobeHide) this.onWardrobeHide(); };
    $('wd-close').onclick = closeWd;
    this.wardrobePanel.addEventListener('click', (e) => {
      if (e.target === this.wardrobePanel) closeWd();
    });
    this._initWardrobePreview();
    const body = $('wd-body');
    if (body) body.addEventListener('scroll', () => this._hideCosmeticTip(), { passive: true });
    for (const tab of this.wardrobePanel.querySelectorAll('.wd-tab')) {
      tab.onclick = () => {
        this._wardrobeTab = tab.dataset.wdTab;
        for (const t of this.wardrobePanel.querySelectorAll('.wd-tab')) t.classList.toggle('active', t === tab);
        $('wd-tab-wardrobe').classList.toggle('hidden', this._wardrobeTab !== 'wardrobe');
        $('wd-tab-stats').classList.toggle('hidden', this._wardrobeTab !== 'stats');
        const isWd = this._wardrobeTab === 'wardrobe';
        $('wd-heading').textContent = isWd ? 'Cosmetics' : 'Statistics';
        $('wd-intro').textContent = isWd
          ? 'One item per slot. Unlock more by levelling skills.'
          : 'Your casino empire at a glance.';
        if (!isWd) this.renderStats();
      };
    }
  }

  _initWardrobePreview() {
    const c = $('wd-player-model'); if (!c) return;
    this._wdPvCanvas = c;
    this._wdPvRenderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
    this._wdPvRenderer.setSize(c.width, c.height);
    this._wdPvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._wdPvRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._wdPvRenderer.toneMappingExposure = 1.0;
    this._wdPvScene = new THREE.Scene();
    this._wdPvScene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.3);
    dl.position.set(3, 6, 4);
    this._wdPvScene.add(dl);
    this._wdPvCamera = new THREE.PerspectiveCamera(30, c.width / c.height, 0.1, 100);
    this._wdPvCamera.position.set(0, 1.0, 4.8);
    this._wdPvCamera.lookAt(0, 0.8, 0);
    this._wdPvModel = null;
    this._wdPvAngle = 0;
  }

  _drawWardrobePreview() {
    if (!this._wdPvRenderer) return;
    if (this._wdPvModel) this._wdPvScene.remove(this._wdPvModel);
    const m = makeOwner(this.game.s.skills, this.game.wardrobeMap());
    this._wdPvScene.add(m);
    this._wdPvModel = m;
  }

  _tickWardrobePreview() {
    if (!this._wdPvRenderer || !this._wdPvModel) return;
    this._wdPvAngle += 0.008;
    this._wdPvModel.rotation.y = this._wdPvAngle;
    this._wdPvRenderer.render(this._wdPvScene, this._wdPvCamera);
  }

  _renderRailStats() {
    const el = $('wd-rail-stats'); if (!el) return;
    const s = this.game.s;
    el.innerHTML = MILESTONES.map(m => {
      const val = m.key === 'balance' ? this.shownMoney : m.get(s);
      return `<div class="sb-stat-row">`
        + `<span class="ico-slot">${ICONS[m.icon] || ''}</span>`
        + `<span class="sb-stat-label">${m.label}</span>`
        + `<span class="sb-stat-val">${m.fmt(val)}</span>`
        + `</div>`;
    }).join('');
  }

  toggleWardrobe(force, opts = {}) {
    const show = force !== undefined ? force : !this._wardrobeOpen;
    this._wardrobeOpen = show;
    this._highlightCosmetic = show ? (opts.highlight || null) : null;
    this.wardrobePanel.classList.toggle('hidden', !show);
    if (!show) this._hideCosmeticTip();
    if (show) {
      $('wd-player-name').textContent = this.game.s.casinoName ? `${this.game.s.casinoName}` : 'VICTOR VANE';
      this._drawWardrobePreview();
      this._renderRailStats();
      // Always land on cosmetics tab when deep-linking to an item
      if (this._highlightCosmetic) {
        this._wardrobeTab = 'wardrobe';
        for (const t of this.wardrobePanel.querySelectorAll('.wd-tab')) {
          t.classList.toggle('active', t.dataset.wdTab === 'wardrobe');
        }
        $('wd-tab-wardrobe').classList.remove('hidden');
        $('wd-tab-stats').classList.add('hidden');
        $('wd-heading').textContent = 'Cosmetics';
        $('wd-intro').textContent = 'One item per slot. Unlock more by levelling skills.';
      }
      this.renderWardrobe();
      if (this._wardrobeTab === 'stats') this.renderStats();
    }
  }

  renderWardrobe() {
    const el = $('wd-tab-wardrobe');
    if (!el) return;
    this._hideCosmeticTip();
    const g = this.game;

    const SLOT_ORDER = ['hat', 'glasses', 'smoking', 'neck', 'torso', 'hands', 'waist', 'held', 'shoes'];

    let html = '<div class="wd-slot-list">';

    for (const slotId of SLOT_ORDER) {
      const slotDef = COSMETIC_SLOTS[slotId];
      if (!slotDef) continue;
      const items = COSMETICS.filter(c => c.slot === slotId);
      if (!items.length) continue;
      const equipped = g.getSlot(slotId);

      html += `<div class="wd-slot-row">`;
      html += `<div class="wd-slot-label">`;
      html += `<span class="wd-slot-name">${slotDef.label}</span>`;
      html += `</div>`;
      html += `<div class="wd-items">`;

      for (const item of items) {
        const unlocked = g.ownsCosmetic ? g.ownsCosmetic(item.key) : ((g.s.skills[item.source] || 0) >= (item.level || 0));
        const isEquipped = equipped === item.key;

        html += `<div class="wd-card ${unlocked ? '' : 'locked'} ${isEquipped ? 'equipped' : ''} ${this._highlightCosmetic === item.key ? 'highlighted' : ''}" data-wd-key="${item.key}" data-wd-slot="${slotId}">`;
        if (item.source === 'achievement') {
          html += `<div class="wd-card-preview"><canvas class="wd-pv-canvas" data-wd-cosmetic="${item.key}" width="128" height="128"></canvas></div>`;
        } else {
          html += `<div class="wd-card-preview"><canvas class="wd-pv-canvas" data-wd-skill="${item.source}" data-wd-level="${item.level}" width="128" height="128"></canvas></div>`;
        }
        if (isEquipped) {
          html += `<span class="wd-card-badge wd-badge-worn">WORN</span>`;
        } else if (!unlocked) {
          html += `<span class="wd-card-badge wd-badge-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`;
        }
        html += `<div class="wd-card-label"><div class="wd-card-name">${item.name}</div></div>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    }

    html += '</div>';
    el.innerHTML = html;

    // clicking a card = equip/unequip
    for (const card of el.querySelectorAll('.wd-card:not(.locked)')) {
      card.onclick = () => {
        if (card.classList.contains('equipped')) g.unequipSlot(card.dataset.wdSlot);
        else g.equipCosmetic(card.dataset.wdKey);
      };
    }

    // hover tooltips — fixed so they aren't clipped by card overflow
    for (const card of el.querySelectorAll('.wd-card')) {
      const key = card.dataset.wdKey;
      const cosmetic = COSMETICS.find(c => c.key === key);
      if (!cosmetic) continue;
      card.onmouseenter = () => this._showCosmeticTip(card, cosmetic);
      card.onmouseleave = () => this._hideCosmeticTip();
    }

    this._snapshotCardPreviews(el);

    if (this._highlightCosmetic) {
      const target = el.querySelector(`.wd-card[data-wd-key="${this._highlightCosmetic}"]`);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        });
      }
    }
  }

  _hideCosmeticTip() {
    if (this._cosmeticTip) {
      this._cosmeticTip.remove();
      this._cosmeticTip = null;
    }
  }

  _showCosmeticTip(card, cosmetic) {
    this._hideCosmeticTip();
    const unlocked = !card.classList.contains('locked');
    const worn = card.classList.contains('equipped');

    let unlockHtml = '';
    if (!unlocked) {
      if (cosmetic.source === 'achievement') {
        const ach = ACHIEVEMENTS.find(a => a.cosmetic === cosmetic.key);
        if (ach) {
          unlockHtml =
            `<div class="wd-tip-how">`
            + `<div class="wd-tip-how-label">How to unlock</div>`
            + `<div class="wd-tip-how-title">${ach.name}</div>`
            + `<div class="wd-tip-how-hint">${ach.hint}</div>`
            + `</div>`;
        } else {
          unlockHtml = `<div class="wd-tip-how"><div class="wd-tip-how-label">How to unlock</div><div class="wd-tip-how-hint">Earn via achievements</div></div>`;
        }
      } else {
        const sk = SKILLS.find(s => s.id === cosmetic.source);
        const skillName = sk ? sk.name : cosmetic.source;
        const lvl = cosmetic.level || 1;
        const cost = SKILL_COSTS[lvl - 1];
        const cur = this.game.s.skills[cosmetic.source] || 0;
        unlockHtml =
          `<div class="wd-tip-how">`
          + `<div class="wd-tip-how-label">How to unlock</div>`
          + `<div class="wd-tip-how-title">${skillName} · Level ${lvl}</div>`
          + `<div class="wd-tip-how-hint">Train in Upgrades → My Skills`
          + (cost != null ? ` · ${fmtMoney(cost)}` : '')
          + `</div>`
          + `<div class="wd-tip-progress">Currently level ${cur} / ${lvl}</div>`
          + `</div>`;
      }
    } else {
      unlockHtml = `<div class="wd-tip-status">${worn ? 'Currently worn' : 'Owned — click to wear'}</div>`;
    }

    const tip = document.createElement('div');
    tip.className = 'wd-card-tip' + (unlocked ? '' : ' locked');
    tip.innerHTML =
      `<div class="wd-card-tip-name">${cosmetic.name}</div>`
      + `<div class="wd-card-tip-desc">${cosmetic.desc}</div>`
      + unlockHtml;

    document.body.appendChild(tip);
    this._cosmeticTip = tip;

    const r = card.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    let top = r.top - th - 10;
    if (top < 8) top = r.bottom + 10;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  _snapshotCardPreviews(container) {
    const canvases = container.querySelectorAll('.wd-pv-canvas');
    const angle = Math.PI * 0.15;
    for (const c of canvases) {
      const { wdSkill, wdLevel, wdCosmetic } = c.dataset;
      if (wdCosmetic) {
        renderCosmeticKeyPreview(wdCosmetic, c, angle);
      } else if (wdSkill && wdLevel) {
        renderCosmeticPreview(wdSkill, parseInt(wdLevel, 10), c, angle);
      }
    }
  }

  /** Set up the mini Three.js scene that renders the owner model. */
  _initModelPreview() {
    const c = $('player-model'); if (!c) return;
    this._pvCanvas = c;
    this._pvRenderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this._pvRenderer.setSize(c.width, c.height);
    this._pvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._pvRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._pvRenderer.toneMappingExposure = 1.0;

    this._pvScene = new THREE.Scene();
    this._pvCam = new THREE.PerspectiveCamera(28, c.width / c.height, 0.1, 50);
    this._pvCam.position.set(0, 1.45, 4.6);
    this._pvCam.lookAt(0, 1.05, 0);

    this._pvScene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffd080, 2.0);
    key.position.set(2, 3, 3);
    this._pvScene.add(key);
    const rim = new THREE.DirectionalLight(0xff2e88, 0.6);
    rim.position.set(-2, 1, -2);
    this._pvScene.add(rim);
    const fill = new THREE.DirectionalLight(0x38e8ff, 0.3);
    fill.position.set(-1, 2, 1);
    this._pvScene.add(fill);

    this._pvModel = null;
    this._pvRaycaster = new THREE.Raycaster();
    this._pvReactions = [];

    c.addEventListener('click', (e) => this._onPlayerClick(e));
    c.style.cursor = 'pointer';
  }

  _onPlayerClick(e) {
    if (!this._pvModel || !this._pvCanvas) return;
    const rect = this._pvCanvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._pvRaycaster.setFromCamera(mouse, this._pvCam);
    const hits = this._pvRaycaster.intersectObjects(this._pvModel.children, true);
    if (!hits.length) return;

    const u = this._pvModel.userData;
    const parts = { head: u.head, armL: u.armL, armR: u.armR, legL: u.legL, legR: u.legR, body: u.body };
    let hitPart = null;
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && obj !== this._pvModel) {
        for (const [name, ref] of Object.entries(parts)) {
          if (ref && obj === ref) { hitPart = name; break; }
        }
        if (hitPart) break;
        obj = obj.parent;
      }
      if (hitPart) break;
    }
    if (!hitPart) hitPart = 'body';

    const QUIPS = ["Hey!", "Stop.", "Ow.", "Quit it.", "No.", "What?", "Hm?", "Easy.", "Rude.", "Why?"];
    const msgs = QUIPS;
    quip(msgs[Math.floor(Math.random() * msgs.length)], 3000);

    this._pvReactions.push({ part: hitPart, t: 0, duration: 0.5 });
  }

  _applyReactions(dt) {
    if (!this._pvModel) return;
    const u = this._pvModel.userData;
    for (let i = this._pvReactions.length - 1; i >= 0; i--) {
      const r = this._pvReactions[i];
      r.t += dt;
      const p = Math.min(r.t / r.duration, 1);
      const wave = Math.sin(p * Math.PI * 4) * (1 - p);
      const part = u[r.part === 'body' ? 'body' : r.part];
      if (!part) { this._pvReactions.splice(i, 1); continue; }

      switch (r.part) {
        case 'head':
          part.rotation.z = wave * 0.4;
          part.rotation.x = wave * 0.15;
          break;
        case 'armL':
          part.rotation.x = wave * -1.2;
          part.rotation.z = wave * 0.3;
          break;
        case 'armR':
          part.rotation.x = wave * -1.2;
          part.rotation.z = wave * -0.3;
          break;
        case 'legL':
          part.rotation.x = wave * 0.8;
          break;
        case 'legR':
          part.rotation.x = wave * 0.8;
          break;
        case 'body': {
          const leg = u.legR || u.legL;
          if (leg) leg.rotation.x = wave * -1.0;
          break;
        }
      }

      if (p >= 1) {
        part.rotation.x = 0; part.rotation.z = 0;
        this._pvReactions.splice(i, 1);
      }
    }
  }

  /** Set up the mini Three.js scene for the casino building preview. */
  _initCasinoPreview() {
    const c = $('casino-model'); if (!c) return;
    this._cvCanvas = c;
    this._cvRenderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
    this._cvRenderer.setSize(c.width, c.height);
    this._cvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._cvRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._cvRenderer.toneMappingExposure = 1.2;

    this._cvScene = new THREE.Scene();
    this._cvCam = new THREE.PerspectiveCamera(30, c.width / c.height, 0.1, 100);
    this._cvCam.position.set(0, 4, 15);
    this._cvCam.lookAt(0, 2.0, 0);

    this._cvScene.add(new THREE.AmbientLight(0xc0b8d0, 0.8));
    const key = new THREE.DirectionalLight(0xffe8c0, 2.0);
    key.position.set(0, 6, 8); this._cvScene.add(key);
    const warm = new THREE.PointLight(0xffc840, 12, 20, 1.5);
    warm.position.set(0, 3, 6); this._cvScene.add(warm);
    const neon = new THREE.PointLight(0xff2e88, 5, 16, 1.5);
    neon.position.set(-3, 4, 4); this._cvScene.add(neon);
    const fill = new THREE.PointLight(0x4060ff, 3, 16, 1.5);
    fill.position.set(3, 3, 4); this._cvScene.add(fill);

    this._cvModel = null;
    this._cvT = 0;
  }

  /** Build a small iconic building model for the current casino tier. */
  buildCasinoModel() {
    if (!this._cvScene) return;
    if (this._cvModel) { this._cvScene.remove(this._cvModel); this._cvModel = null; }

    const def = this.game.casinoDef;
    const tier = def.id === 'duck' ? 0 : def.id === 'rat' ? 1 : 2;
    const g = new THREE.Group();

    const brickTex = T.brickTexture(
      tier === 2 ? '#c8c0b8' : tier === 1 ? '#2a2a34' : '#3b2418',
      tier === 2 ? '#a8a098' : tier === 1 ? '#15151c' : '#1a0e08'
    );
    const wallMat = M.texMat(brickTex, { roughness: 0.9 });
    const gold = M.GOLD();

    const bw = tier === 2 ? 8 : tier === 1 ? 6 : 4.5;
    const bh = tier === 2 ? 7 : tier === 1 ? 5 : 3.5;
    const bd = tier === 2 ? 5 : tier === 1 ? 4 : 3;

    g.add(M.box(bw, bh, bd, wallMat, 0, bh / 2, 0));
    g.add(M.box(bw + 0.1, 0.15, bd + 0.1, gold, 0, bh + 0.08, 0));

    const doorW = tier === 2 ? 1.6 : 1.0;
    const doorH = tier === 2 ? 2.8 : 2.0;
    g.add(M.box(doorW, doorH, 0.15, M.mat(0x1a0a06, { roughness: 0.3 }), 0, doorH / 2, bd / 2 + 0.05));
    g.add(M.box(doorW + 0.3, 0.1, 0.2, gold, 0, doorH + 0.1, bd / 2 + 0.05));

    if (tier > 0) {
      for (let i = 0; i < (tier === 2 ? 3 : 2); i++) {
        const wx = -bw / 2 + 1.2 + i * (bw - 2.4) / (tier === 2 ? 2 : 1);
        const wy = bh * 0.55;
        g.add(M.box(0.7, 0.9, 0.08, M.glow(0x3a5a8a, 0.5, { transparent: true, opacity: 0.8 }), wx, wy, bd / 2 + 0.08));
      }
    }

    const signColor = '#' + def.signColor.toString(16).padStart(6, '0');
    const shortName = this.game.casinoDisplayName().replace(', Las Vegas', '').toUpperCase();
    const sign = M.makeNeonSign(shortName.length > 12 ? shortName.slice(0, 12) : shortName, signColor, Math.min(bw - 0.5, 5), { intensity: 15 });
    sign.position.set(0, bh + 1, bd / 2 + 0.2);
    g.add(sign);

    if (tier >= 1) {
      const awning = M.box(doorW + 1, 0.12, 1.0, M.mat(0x8b0000, { roughness: 0.5 }), 0, doorH + 0.3, bd / 2 + 0.5);
      g.add(awning);
    }
    if (tier === 2) {
      for (const cx of [-bw / 2 + 0.4, bw / 2 - 0.4]) {
        g.add(M.cyl(0.15, 0.15, bh, M.mat(0xe0d8c8, { roughness: 0.3, metalness: 0.1 }), cx, bh / 2, bd / 2 + 0.2, 8));
      }
    }

    const ground = M.box(bw + 4, 0.06, bd + 4, M.mat(0x0b0b10, { roughness: 0.15, metalness: 0.1 }), 0, -0.03, 0);
    g.add(ground);
    const sidewalk = M.box(bw + 2, 0.08, 1.5, M.mat(0x2e2e34, { roughness: 0.85 }), 0, 0.01, bd / 2 + 1.5);
    g.add(sidewalk);

    g.position.set(0, 0, 0);
    this._cvScene.add(g);
    this._cvModel = g;
    this._cvNeonSign = sign;
  }

  /** Render one frame of the casino preview. */
  _renderCasinoPreview(dt) {
    if (!this._cvRenderer || !this._cvModel) return;
    this._cvT += dt;
    this._cvModel.rotation.y = Math.sin(this._cvT * 0.15) * 0.15;
    this._cvRenderer.render(this._cvScene, this._cvCam);
  }

  /** Rebuild the 3D owner model and title text. */
  drawPortrait() {
    if (!this._pvScene) return;
    if (this._pvModel) { this._pvScene.remove(this._pvModel); this._pvModel = null; }
    const sk = this.game.s.skills;
    this._pvModel = makeOwner(sk, this.game.wardrobeMap());
    this._pvModel.position.set(0, 0, 0);
    this._pvModel.rotation.y = 0.3;
    this._pvScene.add(this._pvModel);
    const total = Object.values(sk).reduce((a, b) => a + b, 0);
    $('portrait-title').textContent = total >= 20 ? 'KINGPIN' : total >= 12 ? 'RACKETEER' : total >= 6 ? 'OPERATOR' : total >= 2 ? 'HUSTLER' : 'PROPRIETOR';
  }

  /** Render one frame of the model preview (called from the main loop). */
  _renderPreview(dt) {
    if (!this._pvRenderer || !this._pvModel) return;
    this._modelT += dt;
    this._pvModel.rotation.y = 0.3 + Math.sin(this._modelT * 0.5) * 0.15;
    const u = this._pvModel.userData;
    if (u && u.head) u.head.rotation.y = Math.sin(this._modelT * 0.7) * 0.2;
    this._applyReactions(dt);
    this._pvRenderer.render(this._pvScene, this._pvCam);

    this._portraitAcc = (this._portraitAcc || 0) + dt;
    if (this._portraitAcc > 2 || !HUD.portraitDataURL) {
      this._portraitAcc = 0;
      try {
        const src = this._pvCanvas;
        const sz = 128;
        if (!this._portraitBuf) {
          this._portraitBuf = document.createElement('canvas');
          this._portraitBuf.width = sz; this._portraitBuf.height = sz;
        }
        const ctx = this._portraitBuf.getContext('2d');
        const sx = src.width * 0.1, sy = 0;
        const sw = src.width * 0.8, sh = src.width * 0.8;
        ctx.clearRect(0, 0, sz, sz);
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sz, sz);
        HUD.portraitDataURL = this._portraitBuf.toDataURL('image/png');
      } catch { /* cross-origin or context lost */ }
    }
  }

  update(dt) {
    this._renderPreview(dt);
    this._renderCasinoPreview(dt);
    if (this._wardrobeOpen) {
      this._tickWardrobePreview();
    }
    const target = this.game.s.money;
    if (Math.abs(target - this.shownMoney) > 0.5) {
      this.shownMoney += (target - this.shownMoney) * Math.min(1, dt * 6);
      if (Math.abs(target - this.shownMoney) < 1) this.shownMoney = target;
      const balEl = $('pp-milestones')?.querySelector('[data-ms="balance"] .sb-stat-val');
      if (balEl) balEl.textContent = fmtMoney(this.shownMoney);
    }
    this.acc += dt;
    if (this.acc < 0.15) return;
    this.acc = 0;
    const g = this.game, st = g.stats;
    $('hud-casino').textContent = g.casinoDisplayName().replace(', Las Vegas', '');
    const totalSeats = this.customers.world.machines.length + this.customers.world.tables.reduce((a, t) => a + t.seats.length, 0);
    $('hud-guests').textContent = `${this.customers.count} / ${totalSeats}${this.customers.pending ? ` (+${this.customers.pending})` : ''}`;
    const types = { whale: 0, sharp: 0, drunk: 0 };
    for (const c of this.customers.customers) if (types[c.type] !== undefined) types[c.type]++;
    $('hud-whale-count').textContent = types.whale;
    $('hud-drunk-count').textContent = types.drunk;
    $('hud-sharp-count').textContent = types.sharp;
    const heatEl = $('hud-heat');
    heatEl.textContent = `${Math.round(st.heat)}%`;
    heatEl.className = `sb-stat-val${st.heat > 60 ? ' danger' : st.heat > 30 ? ' warn' : ''}`;
    if (this._wardrobeOpen && this._wardrobeTab === 'stats') this.renderStats();
    this.achAcc += 0.15;
    if (this.achAcc >= 2) {
      this.achAcc = 0;
      this.renderMilestones();
      this.game.checkAchievements();
    }
  }

  setPrompt(text, zoneKey) {
    const p = $('hud-prompt');
    if (!text) p.classList.add('hidden'); else { p.classList.remove('hidden'); $('hud-prompt-text').textContent = text; }
    document.querySelectorAll('.sb-action').forEach(h => h.classList.toggle('near', h.dataset.key === zoneKey));
  }

  toggleStats(force) {
    this.toggleWardrobe(force);
  }

  renderStats() {
    const g = this.game, st = g.stats;
    $('stats-casino').textContent = g.casinoDisplayName();
    const grid = (keys) => keys.map(k => `<div class="k">${icon(STAT_ICON[k] || 'star')}${STAT_META[k].label}</div><div class="v">${STAT_META[k].fmt(st[k])}</div>`).join('');
    $('stats-casino-grid').innerHTML = grid(CASINO_STAT_KEYS) + `<div class="k">${icon('people')}Guests inside</div><div class="v">${this.customers.count}</div>`;
    $('stats-player-grid').innerHTML = grid(PLAYER_STAT_KEYS);
    const mins = Math.floor(g.s.playTime / 60);
    $('stats-life').innerHTML = `Lifetime take <b>${fmtMoney(g.s.lifetimeEarned)}</b> · Guests fleeced <b>${g.s.lifetimeCustomers}</b> · Time on the floor <b>${mins} min</b>`;
  }
}
