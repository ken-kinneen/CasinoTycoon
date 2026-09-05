// Upgrades screen. Every card shows the exact stat change it makes.
import { STAT_META, CASINOS, AD_UPGRADES, CASINO_UPGRADES, SKILLS, SKILL_COSTS, CUSTOMER_TYPES } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { quip, STAT_ICON } from './hud.js';
import { icon } from './icons.js';
import { renderPreviewFrame, resolveModelKey, SIZE as PREVIEW_PX, CSS_SIZE as PREVIEW_CSS, ROTATION_SPEED } from './model-preview.js';

const $ = id => document.getElementById(id);

const BUY_QUIPS = ['Money well spent. Their money.', 'Every purchase is an investment in someone else\'s misery.', 'I\'m not a monster. I\'m a businessman. Same thing, better suits.', 'The books balance. Morally? Different books.', 'Sign here, here, and where it says "victim".', 'That\'s the sound of progress. And a little screaming.'];

const MODEL_LABELS = {
  machines: 'Adds slot machines', tables: 'Adds dealer table', roulette: 'Adds roulette table',
  bar: 'Adds bar', buffet: 'Adds buffet', atm: 'Adds ATM', bouncer: 'Adds bouncer',
  cart: 'Adds armored cart', vip: 'Adds VIP lounge', neon: 'Updates signage', carpet: 'New carpet',
  noclocks: 'Removes clocks', windows: 'Boards windows', vents: 'Adds AC vents',
  gas: 'Adds gas to vents', fog: 'Adds fog machines', cameras: 'Adds cameras',
  sky: 'Changes ceiling', volcano: 'Adds volcano show', fountain: 'Adds fountain',
  bus: 'Bus appears outside', shuttle: 'Shuttle appears', billboard: 'Billboard outside',
  jet: 'Private jet arrivals', tower: 'Hotel tower outside',
  toilet: 'Placed in lobby', selfstatue: 'Statue in lobby', statue: 'Statue in lobby',
  namelights: 'Name on marquee', tiger: 'Tiger in lobby',
};
const TAB_META = {
  casino: { heading: 'Casino Upgrades', intro: (g, list, owned) => `Improvements for ${g.casinoDisplayName()}. ${owned}/${list.length} installed. Each casino has its own set.` },
  ads: { heading: 'Advertising', intro: (g, list, owned) => `Getting people through the door. ${owned}/${list.length} campaigns running. Advertising follows you to every casino.` },
  skills: { heading: 'My Skills', intro: () => 'Five ways to become a worse person. Each path has 5 levels and changes how Victor looks.' },
  expand: { heading: 'Casinos', intro: () => 'Three casinos. One dream. Skills and ad campaigns come with you; each casino has its own upgrades.' },
};

/** Fortnite-style tiers by relative cost within the list. */
function tierOf(u, list) {
  const sorted = [...list].sort((a, b) => a.cost - b.cost);
  const i = sorted.indexOf(u) / Math.max(1, sorted.length - 1);
  return i < 0.3 ? 'common' : i < 0.6 ? 'rare' : i < 0.87 ? 'epic' : 'legendary';
}

export class Ledger {
  constructor(game, onChange) {
    this.game = game; this.onChange = onChange;
    this.el = $('ledger'); this.body = $('ledger-body');
    this.tab = 'casino';
    this.open = false;
    this._previews = [];
    this._rafId = null;
    $('ledger-close').onclick = () => this.hide();
    $('ledger-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(); this.onTabChange && this.onTabChange(this.tab); });
    game.on('money', () => { if (this.open) $('ledger-money').textContent = fmtMoney(game.s.money); });
  }
  show(tab) { if (tab) this.tab = tab; this.open = true; this.el.classList.remove('hidden'); this.render(); this._startAnim(); }
  hide() { this.open = false; this.el.classList.add('hidden'); this._stopAnim(); this.onHide && this.onHide(); }
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

  deltaHtml(effects) {
    return '<div class="stats-grid">' + this.game.previewEffects(effects).map(d => {
      const meta = STAT_META[d.key];
      const better = (d.to - d.from) * meta.good > 0;
      const same = Math.abs(d.to - d.from) < 1e-6;
      const cls = same ? '' : better ? 'good' : 'bad';
      return `<div class="k">${icon(STAT_ICON[d.key] || 'star')}${meta.label}</div><div class="v">${meta.fmt(d.from)} ${icon('arrow')} <span class="${cls}">${meta.fmt(d.to)}</span></div>`;
    }).join('') + '</div>';
  }
  ownedHtml(effects) {
    return '<div class="stats-grid">' + effects.map(e => {
      const cls = (e.add !== undefined ? e.add : e.mul - 1) * STAT_META[e.stat].good > 0 ? 'good' : 'bad';
      const val = e.add !== undefined ? (e.add > 0 ? '+' : '') + STAT_META[e.stat].fmt(e.add) : 'x' + e.mul;
      return `<div class="k">${icon(STAT_ICON[e.stat] || 'star')}${STAT_META[e.stat].label}</div><div class="v"><span class="${cls}">${val}</span></div>`;
    }).join('') + '</div>';
  }

  heroEl(u, tier, owned) {
    const key = resolveModelKey(u.model);
    const tierLabel = owned ? 'OWNED' : tier.toUpperCase();
    const wrap = document.createElement('div');
    wrap.className = 'card-hero';
    const pip = document.createElement('span');
    pip.className = 'card-tier-pip';
    pip.textContent = tierLabel;
    const cvs = document.createElement('canvas');
    cvs.className = 'card-preview';
    cvs.width = PREVIEW_PX;
    cvs.height = PREVIEW_PX;
    this._previews.push({ key, cvs, angle: Math.random() * Math.PI * 2 });
    wrap.appendChild(cvs);
    wrap.appendChild(pip);
    return wrap;
  }

  card(u, list, owned, canAfford, onBuy) {
    const tier = tierOf(u, list);
    const div = document.createElement('div');
    div.className = 'card' + (owned ? ' owned' : '');
    const heroEl = this.heroEl(u, tier, owned);
    div.appendChild(heroEl);
    if (owned) { const st = document.createElement('div'); st.className = 'stamp'; st.textContent = 'OWNED'; div.appendChild(st); }
    const body = document.createElement('div');
    body.className = 'card-body';
    const modelLabel = u.model && MODEL_LABELS[u.model] ? '<div class="card-model-label">' + MODEL_LABELS[u.model] + '</div>' : '';
    body.innerHTML = '<div class="card-name">' + u.name + '</div><div class="blurb">' + u.blurb + '</div>' + modelLabel + (owned ? this.ownedHtml(u.effects) : this.deltaHtml(u.effects)) + '<div class="card-foot"><div class="cost' + (owned ? ' owned' : '') + '">' + (owned ? icon('check') + ' Paid' : fmtMoney(u.cost)) + '</div><button class="buy' + (owned ? ' owned' : '') + '"' + (owned || !canAfford ? ' disabled' : '') + '>' + (owned ? 'Installed' : canAfford ? 'Buy' : 'Too poor') + '</button></div>';
    div.appendChild(body);
    if (!owned && canAfford) div.querySelector('button').onclick = () => { if (onBuy()) { quip(BUY_QUIPS[Math.floor(Math.random() * BUY_QUIPS.length)]); this.render(); this.onChange && this.onChange(u); } };
    return div;
  }

  tierSection(tier, cards, body) {
    if (!cards.length) return;
    const TIER_NAMES = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY' };
    const sec = document.createElement('div');
    sec.className = 'tier-section ' + tier;
    sec.innerHTML = '<div class="tier-header"><span class="tier-dot"></span><span class="tier-label">' + TIER_NAMES[tier] + '</span><span class="tier-line"></span></div>';
    const grid = document.createElement('div');
    grid.className = 'cards';
    for (const c of cards) grid.appendChild(c);
    sec.appendChild(grid);
    body.appendChild(sec);
  }

  renderTiered(list, ownedFn, affordFn, buyFn, body) {
    const buckets = { common: [], rare: [], epic: [], legendary: [] };
    for (const u of list) {
      const t = tierOf(u, list);
      buckets[t].push(this.card(u, list, ownedFn(u), affordFn(u), () => buyFn(u)));
    }
    for (const t of ['common', 'rare', 'epic', 'legendary']) this.tierSection(t, buckets[t], body);
  }


  _makeHero(label, modelKey) {
    const key = resolveModelKey(modelKey);
    const wrap = document.createElement('div');
    wrap.className = 'card-hero';
    const pip = document.createElement('span');
    pip.className = 'card-tier-pip';
    pip.textContent = label;
    const cvs = document.createElement('canvas');
    cvs.className = 'card-preview';
    cvs.width = PREVIEW_PX;
    cvs.height = PREVIEW_PX;
    this._previews.push({ key, cvs, angle: Math.random() * Math.PI * 2 });
    wrap.appendChild(cvs);
    wrap.appendChild(pip);
    return wrap;
  }

  render() {
    const g = this.game;
    this._previews = [];
    $('ledger-money').textContent = fmtMoney(g.s.money);
    $('ledger-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
    $('ledger-heading').textContent = TAB_META[this.tab].heading;
    const body = this.body; body.innerHTML = '';

    const afford = (cost) => g.godMode || g.s.money >= cost;
    if (this.tab === 'casino') {
      const list = CASINO_UPGRADES[g.casinoDef.id];
      $('ledger-intro').textContent = TAB_META.casino.intro(g, list, list.filter(u => g.ownsCasinoUpgrade(u.id)).length);
      this.renderTiered(list, u => g.ownsCasinoUpgrade(u.id), u => afford(u.cost), u => g.buyCasinoUpgrade(u.id), body);
    } else if (this.tab === 'ads') {
      $('ledger-intro').textContent = TAB_META.ads.intro(g, AD_UPGRADES, AD_UPGRADES.filter(u => g.ownsAd(u.id)).length);
      this.renderTiered(AD_UPGRADES, u => g.ownsAd(u.id), u => afford(u.cost), u => g.buyAd(u.id), body);
    } else if (this.tab === 'skills') {
      $('ledger-intro').textContent = TAB_META.skills.intro();
      const grid = document.createElement('div'); grid.className = 'cards';
      for (const sk of SKILLS) {
        const lvl = g.skillLevel(sk.id), cost = g.skillCost(sk.id);
        const div = document.createElement('div');
        div.className = 'card' + (lvl >= 5 ? ' owned' : '');
        div.appendChild(this._makeHero('LVL ' + lvl + ' / 5', 'skill_' + sk.id));
        const pips = '<div class="pips">' + [0, 1, 2, 3, 4].map(i => '<span class="' + (i < lvl ? 'on' : '') + '"></span>').join('') + '</div>';
        const name = '<div class="card-name">' + sk.name + '</div>';
        const blurb = '<div class="blurb">' + sk.blurb + '</div>';
        const look = '<div class="look">' + (lvl > 0 ? sk.cosmetic.slice(0, lvl).join(', ') : '') + (lvl < 5 ? (lvl > 0 ? ' \u2192 ' : '') + 'Next: <b>' + sk.cosmetic[lvl] + '</b>' : '') + '</div>';
        const fx = lvl < 5 ? this.deltaHtml(sk.perLevel) : '<div class="stats-grid"><div class="k">' + icon('star') + 'Mastered</div><div class="v"><span class="good">MAX</span></div></div>';
        const costLabel = cost === null ? icon('check') + ' Mastered' : fmtMoney(cost);
        const btnLabel = cost === null ? 'Maxed' : afford(cost) ? 'Train' : 'Too poor';
        const btnDisabled = cost === null || !afford(cost) ? ' disabled' : '';
        const foot = '<div class="card-foot"><div class="cost' + (cost === null ? ' owned' : '') + '">' + costLabel + '</div><button class="buy' + (lvl >= 5 ? ' owned' : '') + '"' + btnDisabled + '>' + btnLabel + '</button></div>';
        const bd = document.createElement('div'); bd.className = 'card-body';
        bd.innerHTML = pips + name + blurb + look + fx + foot;
        div.appendChild(bd);
        if (cost !== null && afford(cost)) div.querySelector('button').onclick = () => { if (g.buySkill(sk.id)) { quip(sk.cosmetic[lvl] + '. Looking sharp. Feeling sharper.'); this.render(); this.onChange && this.onChange(sk); } };
        grid.appendChild(div);
      }
      body.appendChild(grid);
    } else if (this.tab === 'expand') {
      $('ledger-intro').textContent = TAB_META.expand.intro();
      const grid = document.createElement('div'); grid.className = 'casino-list';
      CASINOS.forEach((c, i) => {
        const owned = g.s.ownedCasinos.includes(i), current = g.s.casino === i;
        const div = document.createElement('div');
        div.className = 'casino-big-card' + (owned ? ' owned' : '') + (current ? ' current' : '');
        const b = c.base;

        const tierLabel = current ? 'YOU ARE HERE' : owned ? 'OWNED' : 'CASINO ' + (i + 1);
        const heroWrap = document.createElement('div');
        heroWrap.className = 'cbc-hero';
        const pip = document.createElement('span');
        pip.className = 'card-tier-pip';
        pip.textContent = tierLabel;
        const cvs = document.createElement('canvas');
        cvs.className = 'cbc-preview';
        cvs.width = PREVIEW_PX;
        cvs.height = PREVIEW_PX;
        const modelKey = 'casino_' + c.id;
        this._previews.push({ key: resolveModelKey(modelKey), cvs, angle: Math.random() * Math.PI * 2 });
        heroWrap.appendChild(cvs);
        heroWrap.appendChild(pip);
        div.appendChild(heroWrap);

        const bd = document.createElement('div'); bd.className = 'cbc-body';
        const name = '<div class="cbc-name">' + g.casinoDisplayName(i) + '</div>';
        const tagline = '<div class="cbc-tagline">"' + c.tagline + '"</div>';

        const allKeys = ['capacity', 'machines', 'tables', 'trafficPerMin', 'spendPerMin', 'stayTime', 'sharpness', 'houseEdge', 'hopperCap', 'autoCollect', 'prestige', 'heat'];
        const validKeys = allKeys.filter(k => b[k] !== undefined && STAT_META[k]);
        const half = Math.ceil(validKeys.length / 2);
        const col = (keys) => keys.map(k => '<div class="k">' + icon(STAT_ICON[k] || 'star') + STAT_META[k].label + '</div><div class="v">' + STAT_META[k].fmt(b[k]) + '</div>').join('');
        const statsHtml = '<div class="cbc-section-title">Base Stats</div><div class="cbc-stats-cols"><div class="stats-grid">' + col(validKeys.slice(0, half)) + '</div><div class="stats-grid">' + col(validKeys.slice(half)) + '</div></div>';

        let custHtml = '';
        if (c.customers && c.customers.length) {
          custHtml = '<div class="cbc-section-title">Customer Types <span class="cbc-count">' + c.customers.length + '</span></div><div class="cbc-customers">';
          for (let ci = 0; ci < c.customers.length; ci++) {
            const ct = CUSTOMER_TYPES[c.customers[ci]];
            if (!ct) continue;
            const spendHi = ct.spend >= 2.0 ? ' hi' : '';
            const stayHi = ct.stay >= 1.5 ? ' hi' : '';
            const sharpHi = ct.sharpness >= 0.8 ? ' hi' : '';
            custHtml += '<div class="cbc-cust"><span class="cbc-cust-icon">' + ct.icon + '</span><span class="cbc-cust-name">' + ct.name + '</span><div class="cbc-cust-vals"><span class="cbc-cust-val' + spendHi + '"><b>x' + ct.spend.toFixed(1) + '</b> spend</span><span class="cbc-cust-val' + stayHi + '"><b>x' + ct.stay.toFixed(1) + '</b> stay</span><span class="cbc-cust-val' + sharpHi + '"><b>' + Math.round(ct.sharpness * 100) + '%</b> sharp</span></div></div>';
          }
          custHtml += '</div>';
        }

        const costLabel = owned ? icon('check') + (current ? ' Current Casino' : ' Owned') : fmtMoney(c.price);
        const btnLabel = current ? 'You Are Here' : owned ? 'Move In' : afford(c.price) ? 'Buy Casino' : 'Too Poor';
        const btnDisabled = current || (!owned && !afford(c.price)) ? ' disabled' : '';
        const foot = '<div class="cbc-foot"><div class="cost' + (owned ? ' owned' : '') + '">' + costLabel + '</div><button class="buy' + (owned ? ' owned' : '') + '"' + btnDisabled + '>' + btnLabel + '</button></div>';

        bd.innerHTML = name + tagline + statsHtml + custHtml + foot;
        div.appendChild(bd);
        const btn = div.querySelector('button');
        if (!current && (owned || afford(c.price))) btn.onclick = () => { const ok = owned ? g.moveToCasino(i) : g.buyCasino(i); if (ok) { this.hide(); this.onChange && this.onChange({ casino: i }); } };
        grid.appendChild(div);
      });
      body.appendChild(grid);
    }

    if (this.open) this._startAnim();
  }
}
