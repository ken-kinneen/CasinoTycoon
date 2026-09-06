import { game, CASINOS, AD_UPGRADES, CASINO_UPGRADES, SKILLS, SKILL_COSTS, ACHIEVEMENTS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { ICONS, icon } from './icons.js';

const $ = id => document.getElementById(id);

const CASINO_IDS = CASINOS.map(c => c.id);

export class DevPanel {
  constructor({ onCasinoChange, onMoneyChange, onReset, onGodModeChange, onPerfChange, onUncapChange, onLightingChange, onTutorialSkip, onTutorialReset }) {
    this.cbs = { onCasinoChange, onMoneyChange, onReset, onGodModeChange, onPerfChange, onUncapChange, onLightingChange, onTutorialSkip, onTutorialReset };
    this.open = false;
    this.el = $('dev-panel');
    this.toggle = $('dev-toggle');
    this.toggle.addEventListener('click', () => this.setOpen(!this.open));
    this._build();
    this._bind();
    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      if (this.el.contains(e.target) || this.toggle.contains(e.target)) return;
      this.setOpen(false);
    });
  }

  setOpen(v) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    this.toggle.classList.toggle('active', v);
    if (v) this.refresh();
  }

  refresh() {
    if (!this.open) return;
    this._refreshToggles();
    this._refreshLighting();
    this._refreshProgression();
    this._refreshSlots();
    this._refreshTutorial();
  }

  _build() {
    this.el.innerHTML = `
      <div class="dp-header">
        <span class="dp-title">DEV TOOLS</span>
        <button class="dp-close" id="dp-close">${ICONS.close}</button>
      </div>
      <div class="dp-scroll">
        ${this._buildQuickSection()}
        ${this._buildTutorialSection()}
        ${this._buildLightingSection()}
        ${this._buildProgressionSection()}
        ${this._buildUpgradesSection()}
        ${this._buildSkillsSection()}
        ${this._buildAchievementsSection()}
        ${this._buildSlotsSection()}
      </div>
    `;
  }

  _buildQuickSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">QUICK CONTROLS</div>
      <div class="dp-row">
        <span class="dp-label">God Mode</span>
        <button class="dp-toggle" id="dp-god"><span id="dp-god-label">OFF</span></button>
      </div>
      <div class="dp-row">
        <span class="dp-label">Casino</span>
        <select class="dp-select" id="dp-casino">
          ${CASINOS.map((c, i) => `<option value="${i}">${i + 1} · ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="dp-row">
        <span class="dp-label">Money</span>
        <div class="dp-money-controls">
          <input class="dp-input" type="number" id="dp-money" min="0" step="1000" />
          <button class="dp-btn dp-btn-sm" id="dp-money-set">Set</button>
        </div>
      </div>
      <div class="dp-row dp-money-presets">
        ${[200, 1000, 5000, 25000, 100000, 500000, 1000000].map(v =>
          `<button class="dp-chip" data-money="${v}">${fmtMoney(v)}</button>`
        ).join('')}
      </div>
      <div class="dp-row">
        <span class="dp-label">Hopper Cash</span>
        <div class="dp-money-controls">
          <input class="dp-input" type="number" id="dp-hopper" min="0" step="100" />
          <button class="dp-btn dp-btn-sm" id="dp-hopper-set">Set</button>
        </div>
      </div>
      <div class="dp-row">
        <span class="dp-label">Perf Stats</span>
        <button class="dp-toggle" id="dp-perf"><span id="dp-perf-label">OFF</span></button>
      </div>
      <div class="dp-row">
        <span class="dp-label">Uncap FPS</span>
        <button class="dp-toggle" id="dp-uncap"><span id="dp-uncap-label">OFF</span></button>
      </div>
      <div class="dp-row">
        <button class="dp-btn dp-btn-danger" id="dp-wipe">Wipe All Progress</button>
      </div>
    </div>`;
  }

  _buildTutorialSection() {
    const STEP_NAMES = ['intro', 'buy_machine', 'place_it', 'nobody', 'advertise', 'first_guest', 'earn_500', 'done'];
    return `
    <div class="dp-section">
      <div class="dp-section-title">TUTORIAL</div>
      <div class="dp-row">
        <span class="dp-label">Step</span>
        <select class="dp-select" id="dp-tut-step-select">
          ${STEP_NAMES.map((name, i) => `<option value="${i}">${i} · ${name}</option>`).join('')}
        </select>
      </div>
      <div class="dp-row">
        <span class="dp-label">Complete</span>
        <button class="dp-toggle" id="dp-tut-complete"><span id="dp-tut-complete-label">${game.s.tutorialComplete ? 'YES' : 'NO'}</span></button>
      </div>
      <div class="dp-row dp-actions">
        <button class="dp-btn dp-btn-sm" id="dp-tut-skip">Skip Tutorial</button>
        <button class="dp-btn dp-btn-sm dp-btn-muted" id="dp-tut-reset">Reset Tutorial</button>
      </div>
    </div>`;
  }

  _buildLightingSection() {
    const LIGHT_KEYS = [
      { key: 'bloom', label: 'Bloom', def: 20 },
      { key: 'exposure', label: 'Exposure', def: 85 },
      { key: 'grain', label: 'Grain', def: 12 },
      { key: 'vignette', label: 'Vignette', def: 45 },
    ];
    return `
    <div class="dp-section">
      <div class="dp-section-title">LIGHTING</div>
      ${LIGHT_KEYS.map(({ key, label, def }) => `
      <div class="dp-row">
        <span class="dp-label">${label}</span>
        <div class="dp-light-controls">
          <input type="range" min="0" max="100" id="dp-light-${key}" class="dp-slider" />
          <span class="dp-light-num" id="dp-light-${key}-num">0%</span>
          <button class="dp-btn dp-btn-sm dp-light-reset" data-light-key="${key}" data-light-default="${def}">${def}</button>
        </div>
      </div>`).join('')}
    </div>`;
  }

  _buildProgressionSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">PROGRESSION</div>
      <div class="dp-row">
        <span class="dp-label">Lifetime Earned</span>
        <div class="dp-money-controls">
          <input class="dp-input" type="number" id="dp-lifetime" min="0" step="5000" />
          <button class="dp-btn dp-btn-sm" id="dp-lifetime-set">Set</button>
        </div>
      </div>
      <div class="dp-row">
        <span class="dp-label">Lifetime Guests</span>
        <div class="dp-money-controls">
          <input class="dp-input" type="number" id="dp-guests" min="0" step="10" />
          <button class="dp-btn dp-btn-sm" id="dp-guests-set">Set</button>
        </div>
      </div>
      <div class="dp-row">
        <span class="dp-label">Play Time</span>
        <div class="dp-money-controls">
          <input class="dp-input" type="number" id="dp-playtime" min="0" step="60" placeholder="seconds" />
          <button class="dp-btn dp-btn-sm" id="dp-playtime-set">Set</button>
        </div>
      </div>
      <div class="dp-row">
        <span class="dp-label">Won (Vegas)</span>
        <button class="dp-toggle" id="dp-won"><span id="dp-won-label">NO</span></button>
      </div>
      <div class="dp-row dp-actions">
        <button class="dp-btn" id="dp-unlock-all">Unlock Everything</button>
        <button class="dp-btn" id="dp-lock-all">Lock Everything</button>
      </div>
    </div>`;
  }

  _buildUpgradesSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">UPGRADES</div>
      <div class="dp-subsection">
        <div class="dp-sub-title">Advertising <span class="dp-count" id="dp-ad-count">0/15</span></div>
        <div class="dp-row dp-actions">
          <button class="dp-btn dp-btn-sm" id="dp-ad-all">Buy All</button>
          <button class="dp-btn dp-btn-sm dp-btn-muted" id="dp-ad-none">Remove All</button>
        </div>
        <div class="dp-upgrade-grid" id="dp-ad-grid"></div>
      </div>
      ${CASINO_IDS.map(cid => {
        const c = CASINOS.find(x => x.id === cid);
        return `
        <div class="dp-subsection">
          <div class="dp-sub-title">${c.name} <span class="dp-count" id="dp-cu-${cid}-count">0/15</span></div>
          <div class="dp-row dp-actions">
            <button class="dp-btn dp-btn-sm" data-cu-all="${cid}">Buy All</button>
            <button class="dp-btn dp-btn-sm dp-btn-muted" data-cu-none="${cid}">Remove All</button>
          </div>
          <div class="dp-upgrade-grid" id="dp-cu-${cid}-grid"></div>
        </div>`;
      }).join('')}
    </div>`;
  }

  _buildSkillsSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">SKILLS</div>
      <div class="dp-row dp-actions">
        <button class="dp-btn dp-btn-sm" id="dp-skills-max">Max All</button>
        <button class="dp-btn dp-btn-sm dp-btn-muted" id="dp-skills-reset">Reset All</button>
      </div>
      <div class="dp-skills-grid" id="dp-skills-grid"></div>
    </div>`;
  }

  _buildAchievementsSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">ACHIEVEMENTS <span class="dp-count" id="dp-ach-count">0/28</span></div>
      <div class="dp-row dp-actions">
        <button class="dp-btn dp-btn-sm" id="dp-ach-all">Claim All</button>
        <button class="dp-btn dp-btn-sm dp-btn-muted" id="dp-ach-none">Revoke All</button>
      </div>
      <div class="dp-ach-grid" id="dp-ach-grid"></div>
    </div>`;
  }

  _buildSlotsSection() {
    return `
    <div class="dp-section">
      <div class="dp-section-title">SAVE SLOTS</div>
      <div class="dp-row">
        <input class="dp-input dp-slot-name" type="text" id="dp-slot-name" placeholder="Save name (e.g. Early game, Max'd out)" maxlength="40" />
        <button class="dp-btn" id="dp-slot-save">Save</button>
      </div>
      <div class="dp-slots" id="dp-slots"></div>
    </div>`;
  }

  _bind() {
    this.el.querySelector('#dp-close').onclick = () => this.setOpen(false);

    // God mode
    $('dp-god').onclick = () => {
      game.godMode = !game.godMode;
      game.save();
      this.cbs.onGodModeChange();
      this._refreshToggles();
    };

    // Casino switch
    $('dp-casino').onchange = () => {
      const idx = parseInt($('dp-casino').value, 10);
      if (!game.s.ownedCasinos.includes(idx)) game.s.ownedCasinos.push(idx);
      game.s.casino = idx;
      game.s.machineCash = 0;
      game.recompute();
      game.save();
      this.cbs.onCasinoChange(idx);
      this.refresh();
    };

    // Money set
    $('dp-money-set').onclick = () => {
      const v = parseFloat($('dp-money').value);
      if (!isNaN(v) && v >= 0) {
        game.s.money = v;
        game.save();
        game.emit('money', { amount: 0, source: 'dev' });
        this.cbs.onMoneyChange();
      }
    };

    // Money presets
    for (const chip of this.el.querySelectorAll('.dp-chip[data-money]')) {
      chip.onclick = () => {
        const v = parseFloat(chip.dataset.money);
        game.s.money = v;
        $('dp-money').value = v;
        game.save();
        game.emit('money', { amount: 0, source: 'dev' });
        this.cbs.onMoneyChange();
      };
    }

    // Hopper cash
    $('dp-hopper-set').onclick = () => {
      const v = parseFloat($('dp-hopper').value);
      if (!isNaN(v) && v >= 0) {
        game.s.machineCash = v;
        game.save();
      }
    };

    // Perf stats
    $('dp-perf').onclick = () => {
      this.cbs.onPerfChange();
      this._refreshToggles();
    };

    // Uncap FPS
    $('dp-uncap').onclick = () => {
      this.cbs.onUncapChange();
      this._refreshToggles();
    };

    // Wipe
    $('dp-wipe').onclick = () => {
      if (!confirm('Wipe all progress and start fresh?')) return;
      this.cbs.onReset();
      this.refresh();
    };

    // Tutorial
    $('dp-tut-skip').onclick = () => {
      if (this.cbs.onTutorialSkip) this.cbs.onTutorialSkip();
      this._refreshTutorial();
    };
    $('dp-tut-reset').onclick = () => {
      if (this.cbs.onTutorialReset) this.cbs.onTutorialReset();
      this._refreshTutorial();
    };

    // Progression
    $('dp-lifetime-set').onclick = () => {
      const v = parseFloat($('dp-lifetime').value);
      if (!isNaN(v) && v >= 0) { game.s.lifetimeEarned = v; game.save(); }
    };
    $('dp-guests-set').onclick = () => {
      const v = parseInt($('dp-guests').value, 10);
      if (!isNaN(v) && v >= 0) { game.s.lifetimeCustomers = v; game.save(); }
    };
    $('dp-playtime-set').onclick = () => {
      const v = parseFloat($('dp-playtime').value);
      if (!isNaN(v) && v >= 0) { game.s.playTime = v; game.save(); }
    };
    $('dp-won').onclick = () => {
      game.s.won = !game.s.won;
      game.save();
      this._refreshToggles();
    };

    // Unlock/lock all
    $('dp-unlock-all').onclick = () => this._unlockAll();
    $('dp-lock-all').onclick = () => this._lockAll();

    // Ad upgrades
    $('dp-ad-all').onclick = () => {
      game.s.adUpgrades = AD_UPGRADES.map(u => u.id);
      game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
    };
    $('dp-ad-none').onclick = () => {
      game.s.adUpgrades = [];
      game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
    };

    // Casino upgrades bulk
    for (const cid of CASINO_IDS) {
      this.el.querySelector(`[data-cu-all="${cid}"]`).onclick = () => {
        game.s.casinoUpgrades[cid] = CASINO_UPGRADES[cid].map(u => u.id);
        game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
      };
      this.el.querySelector(`[data-cu-none="${cid}"]`).onclick = () => {
        game.s.casinoUpgrades[cid] = [];
        game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
      };
    }

    // Skills
    $('dp-skills-max').onclick = () => {
      for (const sk of SKILLS) game.s.skills[sk.id] = 5;
      game.recompute(); game.save(); game.emit('skill', {}); this._refreshProgression();
    };
    $('dp-skills-reset').onclick = () => {
      for (const sk of SKILLS) game.s.skills[sk.id] = 0;
      game.recompute(); game.save(); game.emit('skill', {}); this._refreshProgression();
    };

    // Achievements
    $('dp-ach-all').onclick = () => {
      for (const a of ACHIEVEMENTS) {
        if (!game.s.achievements.includes(a.id)) {
          game.s.achievements.push(a.id);
          if (a.item && !game.s.achItems.includes(a.item)) game.s.achItems.push(a.item);
        }
      }
      game.recompute(); game.save(); this._refreshProgression();
    };
    $('dp-ach-none').onclick = () => {
      game.s.achievements = [];
      game.s.achItems = [];
      game.save(); this._refreshProgression();
    };

    // Lighting sliders
    for (const slider of this.el.querySelectorAll('.dp-slider[id^="dp-light-"]')) {
      slider.oninput = () => {
        const key = slider.id.replace('dp-light-', '');
        const val = parseInt(slider.value, 10);
        $(`dp-light-${key}-num`).textContent = `${val}%`;
        if (!game.s.lighting) game.s.lighting = {};
        game.s.lighting[key] = val;
        this.cbs.onLightingChange();
        this._updateLightResets();
        game.save();
      };
    }
    for (const btn of this.el.querySelectorAll('.dp-light-reset')) {
      btn.onclick = () => {
        const key = btn.dataset.lightKey;
        const def = parseInt(btn.dataset.lightDefault, 10);
        $(`dp-light-${key}`).value = def;
        $(`dp-light-${key}-num`).textContent = `${def}%`;
        if (!game.s.lighting) game.s.lighting = {};
        game.s.lighting[key] = def;
        this.cbs.onLightingChange();
        this._updateLightResets();
        game.save();
      };
    }

    // Save slots
    $('dp-slot-save').onclick = () => {
      const name = $('dp-slot-name').value.trim() || `Save ${new Date().toLocaleString()}`;
      game.saveToSlot(name);
      $('dp-slot-name').value = '';
      this._refreshSlots();
    };
  }

  _refreshToggles() {
    const god = $('dp-god');
    god.classList.toggle('dp-on', game.godMode);
    $('dp-god-label').textContent = game.godMode ? 'ON' : 'OFF';

    $('dp-casino').value = game.s.casino;
    $('dp-money').value = Math.floor(game.s.money);
    $('dp-hopper').value = Math.floor(game.s.machineCash);

    const perf = $('dp-perf');
    perf.classList.toggle('dp-on', !!game.s.perfStats);
    $('dp-perf-label').textContent = game.s.perfStats ? 'ON' : 'OFF';

    const uncap = $('dp-uncap');
    uncap.classList.toggle('dp-on', !!game.s.uncapFPS);
    $('dp-uncap-label').textContent = game.s.uncapFPS ? 'ON' : 'OFF';

    const won = $('dp-won');
    won.classList.toggle('dp-on', !!game.s.won);
    $('dp-won-label').textContent = game.s.won ? 'YES' : 'NO';

    $('dp-lifetime').value = Math.floor(game.s.lifetimeEarned);
    $('dp-guests').value = game.s.lifetimeCustomers;
    $('dp-playtime').value = Math.floor(game.s.playTime);
  }

  _refreshLighting() {
    const ls = game.s.lighting || {};
    for (const key of ['bloom', 'exposure', 'grain', 'vignette']) {
      const el = $(`dp-light-${key}`);
      if (el) { el.value = ls[key] ?? 0; $(`dp-light-${key}-num`).textContent = `${ls[key] ?? 0}%`; }
    }
    this._updateLightResets();
  }

  _updateLightResets() {
    for (const btn of this.el.querySelectorAll('.dp-light-reset')) {
      const key = btn.dataset.lightKey;
      const def = parseInt(btn.dataset.lightDefault, 10);
      const cur = parseInt($(`dp-light-${key}`).value, 10);
      btn.classList.toggle('changed', cur !== def);
    }
  }

  _refreshProgression() {
    // Ad upgrades
    $('dp-ad-count').textContent = `${game.s.adUpgrades.length}/${AD_UPGRADES.length}`;
    $('dp-ad-grid').innerHTML = AD_UPGRADES.map(u => {
      const owned = game.s.adUpgrades.includes(u.id);
      return `<button class="dp-upgrade-chip ${owned ? 'dp-owned' : ''}" data-ad-toggle="${u.id}" title="${u.name} (${fmtMoney(u.cost)})">${u.name.length > 18 ? u.name.slice(0, 16) + '…' : u.name}</button>`;
    }).join('');
    for (const btn of $('dp-ad-grid').querySelectorAll('[data-ad-toggle]')) {
      btn.onclick = () => {
        const id = btn.dataset.adToggle;
        if (game.s.adUpgrades.includes(id)) game.s.adUpgrades = game.s.adUpgrades.filter(x => x !== id);
        else game.s.adUpgrades.push(id);
        game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
      };
    }

    // Casino upgrades
    for (const cid of CASINO_IDS) {
      const ups = CASINO_UPGRADES[cid];
      const owned = game.s.casinoUpgrades[cid];
      $(`dp-cu-${cid}-count`).textContent = `${owned.length}/${ups.length}`;
      $(`dp-cu-${cid}-grid`).innerHTML = ups.map(u => {
        const on = owned.includes(u.id);
        return `<button class="dp-upgrade-chip ${on ? 'dp-owned' : ''}" data-cu-toggle="${cid}:${u.id}" title="${u.name} (${fmtMoney(u.cost)})">${u.name.length > 18 ? u.name.slice(0, 16) + '…' : u.name}</button>`;
      }).join('');
      for (const btn of $(`dp-cu-${cid}-grid`).querySelectorAll('[data-cu-toggle]')) {
        btn.onclick = () => {
          const [c, id] = btn.dataset.cuToggle.split(':');
          const arr = game.s.casinoUpgrades[c];
          if (arr.includes(id)) game.s.casinoUpgrades[c] = arr.filter(x => x !== id);
          else arr.push(id);
          game.recompute(); game.save(); game.emit('upgrade', {}); this._refreshProgression();
        };
      }
    }

    // Skills
    $('dp-skills-grid').innerHTML = SKILLS.map(sk => {
      const lvl = game.s.skills[sk.id] || 0;
      return `
        <div class="dp-skill-row">
          <span class="dp-skill-name">${sk.icon} ${sk.name}</span>
          <div class="dp-skill-pips">
            ${[0, 1, 2, 3, 4, 5].map(i =>
              `<button class="dp-pip ${i <= lvl && i > 0 ? 'dp-pip-on' : ''} ${i === 0 ? 'dp-pip-zero' : ''}" data-skill="${sk.id}" data-level="${i}" title="Set to ${i}">${i}</button>`
            ).join('')}
          </div>
        </div>`;
    }).join('');
    for (const btn of $('dp-skills-grid').querySelectorAll('[data-skill]')) {
      btn.onclick = () => {
        game.s.skills[btn.dataset.skill] = parseInt(btn.dataset.level, 10);
        game.recompute(); game.save(); game.emit('skill', {}); this._refreshProgression();
      };
    }

    // Achievements
    $('dp-ach-count').textContent = `${game.s.achievements.length}/${ACHIEVEMENTS.length}`;
    $('dp-ach-grid').innerHTML = ACHIEVEMENTS.map(a => {
      const done = game.s.achievements.includes(a.id);
      return `<button class="dp-ach-chip ${done ? 'dp-ach-done' : ''}" data-ach-toggle="${a.id}" title="${a.hint}${a.reward ? ' (+' + fmtMoney(a.reward) + ')' : ''}">${a.name}</button>`;
    }).join('');
    for (const btn of $('dp-ach-grid').querySelectorAll('[data-ach-toggle]')) {
      btn.onclick = () => {
        const id = btn.dataset.achToggle;
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (game.s.achievements.includes(id)) {
          game.s.achievements = game.s.achievements.filter(x => x !== id);
          if (a && a.item) game.s.achItems = (game.s.achItems || []).filter(x => x !== a.item);
        } else {
          game.s.achievements.push(id);
          if (a && a.item) {
            if (!game.s.achItems) game.s.achItems = [];
            if (!game.s.achItems.includes(a.item)) game.s.achItems.push(a.item);
          }
        }
        game.recompute(); game.save(); this._refreshProgression();
      };
    }
  }

  _refreshSlots() {
    const slots = game.listSlots();
    const container = $('dp-slots');
    if (!slots.length) {
      container.innerHTML = '<div class="dp-slots-empty">No saves yet</div>';
      return;
    }
    container.innerHTML = slots.map(sl => {
      const date = new Date(sl.date);
      const casinoName = CASINOS[sl.casino]?.name || '?';
      return `
        <div class="dp-slot" data-slot-id="${sl.id}">
          <div class="dp-slot-info">
            <div class="dp-slot-name">${sl.name}</div>
            <div class="dp-slot-meta">${sl.playerName} · ${casinoName} · ${fmtMoney(sl.money)} · ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="dp-slot-actions">
            <button class="dp-btn dp-btn-sm" data-slot-load="${sl.id}">Load</button>
            <button class="dp-btn dp-btn-sm dp-btn-danger-sm" data-slot-del="${sl.id}">×</button>
          </div>
        </div>`;
    }).join('');

    for (const btn of container.querySelectorAll('[data-slot-load]')) {
      btn.onclick = () => {
        if (!confirm('Load this save? Current progress will be overwritten.')) return;
        game.loadFromSlot(btn.dataset.slotLoad);
        this.cbs.onCasinoChange(game.s.casino);
        this.cbs.onMoneyChange();
        this.refresh();
      };
    }
    for (const btn of container.querySelectorAll('[data-slot-del]')) {
      btn.onclick = () => {
        game.deleteSlot(btn.dataset.slotDel);
        this._refreshSlots();
      };
    }
  }

  _refreshTutorial() {
    const STEP_NAMES = ['intro', 'buy_machine', 'place_it', 'nobody', 'advertise', 'first_guest', 'earn_500', 'done'];
    const step = game.s.tutorialStep || 0;
    const el = $('dp-tut-step');
    if (el) el.textContent = `${step} (${STEP_NAMES[step] || '?'})`;
    const cel = $('dp-tut-complete');
    if (cel) cel.textContent = game.s.tutorialComplete ? 'YES' : 'NO';
  }

  _unlockAll() {
    game.s.ownedCasinos = [0, 1, 2];
    game.s.adUpgrades = AD_UPGRADES.map(u => u.id);
    for (const cid of CASINO_IDS) game.s.casinoUpgrades[cid] = CASINO_UPGRADES[cid].map(u => u.id);
    for (const sk of SKILLS) game.s.skills[sk.id] = 5;
    for (const a of ACHIEVEMENTS) {
      if (!game.s.achievements.includes(a.id)) game.s.achievements.push(a.id);
      if (a.item && !(game.s.achItems || []).includes(a.item)) {
        if (!game.s.achItems) game.s.achItems = [];
        game.s.achItems.push(a.item);
      }
    }
    game.s.won = true;
    game.s.tutorialComplete = true;
    game.s.tutorialStep = 7;
    game.recompute(); game.save();
    game.emit('upgrade', {}); game.emit('skill', {});
    this.cbs.onCasinoChange(game.s.casino);
    this.refresh();
  }

  _lockAll() {
    if (!confirm('Reset all progression? (Money and casino stay the same)')) return;
    game.s.adUpgrades = [];
    for (const cid of CASINO_IDS) game.s.casinoUpgrades[cid] = [];
    for (const sk of SKILLS) game.s.skills[sk.id] = 0;
    game.s.achievements = [];
    game.s.achItems = [];
    game.s.awards = [];
    game.s.won = false;
    game.recompute(); game.save();
    game.emit('upgrade', {}); game.emit('skill', {});
    this.cbs.onCasinoChange(game.s.casino);
    this.refresh();
  }
}
