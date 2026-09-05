import { ACHIEVEMENTS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { icon, ICONS } from './icons.js';
import { renderPreviewFrame, resolveModelKey, SIZE as PREVIEW_PX, ROTATION_SPEED } from './model-preview.js';

const $ = id => document.getElementById(id);

const ITEM_LABELS = {
  toilet: 'Gold Toilet', selfstatue: 'Statue of Yourself', namelights: 'Your Name in Lights',
  tiger: 'Pet Tiger', fountain: 'Champagne Fountain',
};

export class AchievementsScreen {
  constructor(game) {
    this.game = game;
    this.el = $('achievements');
    this.body = $('ach-body');
    this.open = false;
    this._previews = [];
    this._rafId = null;
    $('ach-close').onclick = () => this.hide();
    this.el.onclick = (e) => { if (e.target === this.el) this.hide(); };
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

  render() {
    const g = this.game;
    const unlocked = g.s.achievements;
    this._previews = [];

    const doneCount = unlocked.length;
    $('ach-screen-count').textContent = doneCount;
    $('ach-screen-total').textContent = ACHIEVEMENTS.length;

    const body = this.body;
    body.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'ach-grid';

    for (const a of ACHIEVEMENTS) {
      const done = unlocked.includes(a.id);
      const isHidden = a.hidden && !done;

      const card = document.createElement('div');
      card.className = 'ach-card' + (done ? ' done' : '') + (isHidden ? ' hidden-ach' : '');

      const left = document.createElement('div');
      left.className = 'ach-card-icon';

      if (a.item && done) {
        const key = resolveModelKey(a.item);
        const cvs = document.createElement('canvas');
        cvs.className = 'ach-card-preview';
        cvs.width = PREVIEW_PX;
        cvs.height = PREVIEW_PX;
        this._previews.push({ key, cvs, angle: Math.random() * Math.PI * 2 });
        left.appendChild(cvs);
      } else {
        left.innerHTML = isHidden
          ? ICONS.lock || ICONS.star
          : done ? ICONS.trophy : (ICONS[a.icon] || ICONS.star);
      }

      const mid = document.createElement('div');
      mid.className = 'ach-card-body';

      const name = document.createElement('div');
      name.className = 'ach-card-name';
      name.textContent = isHidden ? '???' : a.name;

      const hint = document.createElement('div');
      hint.className = 'ach-card-hint';
      hint.textContent = isHidden ? 'Hidden achievement' : (done ? 'Completed' : a.hint);

      mid.appendChild(name);
      mid.appendChild(hint);

      if (a.item && !isHidden) {
        const itemTag = document.createElement('div');
        itemTag.className = 'ach-card-item' + (done ? ' earned' : '');
        itemTag.innerHTML = icon('star') + '<span>' + (ITEM_LABELS[a.item] || a.item) + '</span>';
        mid.appendChild(itemTag);
      }

      const right = document.createElement('div');
      right.className = 'ach-card-reward';

      if (done) {
        right.innerHTML = '<span class="ach-done-check">' + icon('check') + '</span>';
      } else if (!isHidden) {
        const parts = [];
        if (a.reward) parts.push('<span class="ach-cash">+' + fmtMoney(a.reward) + '</span>');
        right.innerHTML = parts.join('');
      }

      card.appendChild(left);
      card.appendChild(mid);
      card.appendChild(right);
      grid.appendChild(card);
    }

    body.appendChild(grid);
    if (this.open) this._startAnim();
  }
}
