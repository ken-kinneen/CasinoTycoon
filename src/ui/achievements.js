import { ACHIEVEMENTS, COSMETICS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { icon, ICONS } from './icons.js';
import { renderPreviewFrame, resolveModelKey, SIZE as PREVIEW_PX, ROTATION_SPEED } from './model-preview.js';

const $ = id => document.getElementById(id);

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function fmtProgress(val, fmt) {
  if (fmt === 'money') return fmtMoney(val);
  if (fmt === 'time') return fmtTime(val);
  return val.toLocaleString();
}

const ITEM_LABELS = {
  toilet: 'Gold Toilet', selfstatue: 'Statue of Yourself', namelights: 'Your Name in Lights',
  tiger: 'Pet Tiger', fountain: 'Champagne Fountain', planter: 'Casino Planter',
  velvetrope: 'Velvet Rope', ornateurn: 'Ornate Urn', palmtree: 'Palm Tree',
  aquarium: 'Exotic Aquarium', fireplace: 'Grand Fireplace', chandelier: 'Crystal Chandelier',
  megaphone: 'Gold Megaphone',
};

function cosmeticLabel(key) {
  const c = COSMETICS.find(x => x.key === key);
  return c ? c.name : key;
}

function achCategory(a) {
  if (a.cosmetic) return 'cosmetic';
  if (a.item) return 'placeable';
  return 'trophy';
}

/** True if this achievement should appear as a mystery/secret card. */
function isSecretToPlayer(a, unlocked) {
  if (unlocked.includes(a.id)) return false;
  if (a.hidden) return true;
  if (a.requires && !unlocked.includes(a.requires)) return true;
  return false;
}

export class AchievementsScreen {
  constructor(game) {
    this.game = game;
    this.el = $('achievements');
    this.body = $('ach-body');
    this.open = false;
    this._previews = [];
    this._rafId = null;
    this._filter = 'all';
    $('ach-close').onclick = () => this.hide();
    this.el.onclick = (e) => { if (e.target === this.el) this.hide(); };

    for (const btn of this.el.querySelectorAll('.ach-filter')) {
      btn.onclick = () => {
        this._filter = btn.dataset.filter;
        for (const b of this.el.querySelectorAll('.ach-filter')) b.classList.toggle('active', b === btn);
        this.render();
      };
    }
  }

  show() {
    this.open = true;
    this.el.classList.remove('hidden');
    this.render();
    this._startAnim();
  }

  hide() {
    this.open = false;
    this.el.classList.add('hidden');
    this._stopAnim();
    this.onHide && this.onHide();
  }

  toggle() { this.open ? this.hide() : this.show(); }

  _startAnim() {
    if (this._rafId) return;
    let last = 0;
    const scrollParent = this.body;
    const tick = (t) => {
      this._rafId = requestAnimationFrame(tick);
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      const sp = scrollParent.getBoundingClientRect();
      for (const p of this._previews) {
        p.angle += ROTATION_SPEED * dt;
        const r = p.cvs.getBoundingClientRect();
        if (r.bottom < sp.top - 200 || r.top > sp.bottom + 200) continue;
        try { renderPreviewFrame(p.key, p.cvs, p.angle); } catch (_) {}
      }
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopAnim() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._previews = [];
  }

  _makePreview(modelKey) {
    const key = resolveModelKey(modelKey);
    const cvs = document.createElement('canvas');
    cvs.className = 'ach-preview-canvas';
    cvs.width = PREVIEW_PX;
    cvs.height = PREVIEW_PX;
    this._previews.push({ key, cvs, angle: Math.random() * Math.PI * 2 });
    return cvs;
  }

  _previewKey(a) {
    return a.cosmetic || a.item || a.preview || null;
  }

  render() {
    const g = this.game;
    const unlocked = g.s.achievements;
    this._previews = [];

    const f = this._filter;
    const pool = f === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCategory(a) === f);

    const completed = pool.filter(a => unlocked.includes(a.id));
    const locked = pool.filter(a => !unlocked.includes(a.id) && !isSecretToPlayer(a, unlocked));
    const secret = pool.filter(a => isSecretToPlayer(a, unlocked));

    const allDone = ACHIEVEMENTS.filter(a => unlocked.includes(a.id));
    $('ach-screen-count').textContent = allDone.length;
    $('ach-screen-total').textContent = ACHIEVEMENTS.length;

    const body = this.body;
    body.innerHTML = '';

    if (completed.length > 0) {
      const section = this._section('Completed', `${completed.length} earned`);
      const grid = this._grid();
      for (const a of completed) grid.appendChild(this._card(a, 'done'));
      section.appendChild(grid);
      body.appendChild(section);
    }

    if (locked.length > 0) {
      const section = this._section('Locked', `${locked.length} remaining`);
      const grid = this._grid();
      for (const a of locked) grid.appendChild(this._card(a, 'locked'));
      section.appendChild(grid);
      body.appendChild(section);
    }

    if (secret.length > 0) {
      const section = this._section('Secret', `${secret.length} hidden`);
      const grid = this._grid();
      for (const a of secret) grid.appendChild(this._card(a, 'secret'));
      section.appendChild(grid);
      body.appendChild(section);
    }

    if (completed.length === 0 && locked.length === 0 && secret.length === 0) {
      const msg = f === 'all' ? 'No achievements yet. Get out there and hustle.'
        : f === 'cosmetic' ? 'No cosmetic achievements yet.'
        : f === 'placeable' ? 'No placeable achievements yet.'
        : 'No trophy achievements yet.';
      body.innerHTML = '<div class="ach-empty">' + msg + '</div>';
    }

    if (this.open) this._startAnim();
  }

  _section(title, subtitle) {
    const s = document.createElement('div');
    s.className = 'ach-section';
    const h = document.createElement('div');
    h.className = 'ach-section-header';
    const t = document.createElement('span');
    t.className = 'ach-section-title';
    t.textContent = title;
    const c = document.createElement('span');
    c.className = 'ach-section-count';
    c.textContent = subtitle;
    const l = document.createElement('span');
    l.className = 'ach-section-line';
    h.append(t, c, l);
    s.appendChild(h);
    return s;
  }

  _grid() {
    const g = document.createElement('div');
    g.className = 'ach-card-grid';
    return g;
  }

  _card(a, state) {
    const g = this.game;
    const isDone = state === 'done';
    const isSecret = state === 'secret';
    const isLocked = state === 'locked';
    const hasItem = !!a.item;
    const hasCosmetic = !!a.cosmetic;
    const modelKey = this._previewKey(a);
    const placeEquipped = isDone && hasItem && g.isEquipped(a.item);
    const cosWorn = isDone && hasCosmetic && g.isWorn(a.cosmetic);
    const equipped = placeEquipped || cosWorn;

    const card = document.createElement('div');
    card.className = 'ach-card-v2 ' + state;
    if (equipped) card.classList.add('equipped');

    // --- visual area: always a 3D preview ---
    const visual = document.createElement('div');
    visual.className = 'ach-visual';

    if (isSecret) {
      visual.classList.add('ach-visual-secret');
      visual.appendChild(this._makePreview('__placeholder__'));
      const lockBadge = document.createElement('div');
      lockBadge.className = 'ach-lock-badge';
      lockBadge.innerHTML = ICONS.lock;
      visual.appendChild(lockBadge);
    } else if (isLocked) {
      visual.classList.add('ach-visual-locked');
      visual.appendChild(this._makePreview(modelKey || '__placeholder__'));
      const lockBadge = document.createElement('div');
      lockBadge.className = 'ach-lock-badge';
      lockBadge.innerHTML = ICONS.lock;
      visual.appendChild(lockBadge);
    } else if (isDone && modelKey) {
      visual.appendChild(this._makePreview(modelKey));
      if (equipped) {
        const badge = document.createElement('div');
        badge.className = 'ach-equipped-badge';
        badge.textContent = hasCosmetic ? 'WORN' : 'DISPLAYED';
        visual.appendChild(badge);
      }
    } else {
      visual.appendChild(this._makePreview('__placeholder__'));
    }

    // --- progress data ---
    let prog = null;
    if (a.progress) {
      try { prog = a.progress(g.s, g.stats); } catch (_) {}
    }

    // --- info area ---
    const info = document.createElement('div');
    info.className = 'ach-info';

    const name = document.createElement('div');
    name.className = 'ach-card-title';
    name.textContent = isSecret ? '???' : a.name;
    info.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'ach-card-desc';
    if (isSecret) {
      desc.textContent = 'Hidden achievement';
    } else if (isDone && prog && prog.target > 1) {
      desc.textContent = fmtProgress(prog.target, prog.fmt) + (prog.fmt === 'money' ? ' earned' : prog.fmt === 'time' ? ' played' : ' reached');
    } else {
      desc.textContent = a.hint;
    }
    info.appendChild(desc);

    if (!isSecret && hasCosmetic) {
      const itemLabel = document.createElement('div');
      itemLabel.className = 'ach-card-reward-item' + (isDone ? ' earned' : '');
      itemLabel.innerHTML = icon('star') + ' <span>' + cosmeticLabel(a.cosmetic) + '</span>';
      info.appendChild(itemLabel);
    }

    if (!isSecret && hasItem) {
      const itemLabel = document.createElement('div');
      itemLabel.className = 'ach-card-reward-item' + (isDone ? ' earned' : '');
      itemLabel.innerHTML = icon('star') + ' <span>' + (ITEM_LABELS[a.item] || a.item) + '</span>';
      info.appendChild(itemLabel);
    }

    // progress bar for locked achievements
    if (isLocked && prog && prog.target > 1) {
      const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
      const bar = document.createElement('div');
      bar.className = 'ach-progress-bar';

      const track = document.createElement('div');
      track.className = 'ach-progress-track';
      const fill = document.createElement('div');
      fill.className = 'ach-progress-fill';
      fill.style.width = pct + '%';
      track.appendChild(fill);

      const label = document.createElement('div');
      label.className = 'ach-progress-label';
      label.textContent = fmtProgress(prog.current, prog.fmt) + ' / ' + fmtProgress(prog.target, prog.fmt);

      bar.appendChild(track);
      bar.appendChild(label);
      info.appendChild(bar);
    }

    // --- footer ---
    const footer = document.createElement('div');
    footer.className = 'ach-card-footer';

    if (isDone) {
      if (hasCosmetic) {
        const btn = document.createElement('button');
        btn.className = 'ach-equip-btn';
        btn.textContent = 'OPEN WARDROBE';
        btn.onclick = (e) => {
          e.stopPropagation();
          this.onOpenWardrobe && this.onOpenWardrobe(a.cosmetic);
        };
        footer.appendChild(btn);
      } else if (hasItem) {
        const btn = document.createElement('button');
        btn.className = 'ach-equip-btn';
        btn.textContent = 'OPEN BUILD TOOL';
        btn.onclick = (e) => {
          e.stopPropagation();
          this.onOpenBuild && this.onOpenBuild(a.item);
        };
        footer.appendChild(btn);
      } else {
        // Trophy case not built yet — null/disabled CTA
        const btn = document.createElement('button');
        btn.className = 'ach-equip-btn disabled';
        btn.textContent = 'TROPHY CASE';
        btn.disabled = true;
        btn.title = 'Coming soon';
        footer.appendChild(btn);
      }
    } else if (!isSecret) {
      if (a.reward) {
        const cash = document.createElement('span');
        cash.className = 'ach-card-cash';
        cash.textContent = '+' + fmtMoney(a.reward);
        footer.appendChild(cash);
      }
    }

    card.append(visual, info, footer);
    return card;
  }
}
