// The Ledger: upgrade screen. Every card shows the exact stat change it makes.
import { STAT_META, CASINOS, AD_UPGRADES, CASINO_UPGRADES, AWARDS, SKILLS, SKILL_COSTS } from '../state.js';
import { fmtMoney } from '../minigames/base.js';
import { quip } from './hud.js';
import { ICONS, icon, iconFor } from './icons.js';

const $ = id => document.getElementById(id);

const BUY_QUIPS = ['Money well spent. Their money.', 'Every purchase is an investment in someone else\'s misery.', 'I\'m not a monster. I\'m a businessman. Same thing, better suits.', 'The ledger balances. Morally? Different ledger.', 'Sign here, here, and where it says "victim".', 'That\'s the sound of progress. And a little screaming.'];
const TAB_META = {
  casino: { heading: 'Casino Upgrades', intro: (g, list, owned) => `Improvements for ${g.casinoDisplayName()}. ${owned}/${list.length} installed. Each casino has its own set.` },
  ads: { heading: 'Advertising', intro: (g, list, owned) => `Getting people through the door. ${owned}/${list.length} campaigns running. Advertising follows you to every casino.` },
  skills: { heading: 'My Skills', intro: () => 'Five ways to become a worse person. Each path has 5 levels and changes how Victor looks.' },
  awards: { heading: 'Awards', intro: (g, list, owned) => `Monuments to yourself. ${owned}/${list.length}. "Cosmetic." They still pull numbers.` },
  expand: { heading: 'Expansion', intro: () => 'Three casinos. One dream. Skills and ad campaigns come with you; each casino has its own upgrades.' },
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
    $('ledger-close').onclick = () => this.hide();
    $('ledger-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(); this.onTabChange && this.onTabChange(this.tab); });
    game.on('money', () => { if (this.open) $('ledger-money').textContent = fmtMoney(game.s.money); });
  }
  show(tab) { if (tab) this.tab = tab; this.open = true; this.el.classList.remove('hidden'); this.render(); }
  hide() { this.open = false; this.el.classList.add('hidden'); this.onHide && this.onHide(); }
  toggle() { this.open ? this.hide() : this.show(); }

  deltaHtml(effects) {
    return this.game.previewEffects(effects).map(d => {
      const meta = STAT_META[d.key];
      const better = (d.to - d.from) * meta.good > 0;
      const same = Math.abs(d.to - d.from) < 1e-6;
      return `<div class="fx"><span>${meta.label}</span><span class="delta ${same ? '' : better ? 'good' : 'bad'}">${meta.fmt(d.from)} ${icon('arrow')} ${meta.fmt(d.to)}</span></div>`;
    }).join('');
  }
  ownedHtml(effects) {
    return effects.map(e => `<div class="fx"><span>${STAT_META[e.stat].label}</span><span class="delta ${(e.add !== undefined ? e.add : e.mul - 1) * STAT_META[e.stat].good > 0 ? 'good' : 'bad'}">${e.add !== undefined ? (e.add > 0 ? '+' : '') + STAT_META[e.stat].fmt(e.add) : 'x' + e.mul}</span></div>`).join('');
  }

  card(u, list, owned, canAfford, onBuy) {
    const tier = tierOf(u, list);
    const div = document.createElement('div');
    div.className = `card ${tier} ${owned ? 'owned' : ''}`;
    div.innerHTML = `
      <div class="card-head"><div class="card-icon">${icon(iconFor(u))}</div><div class="card-title"><div class="card-name">${u.name}</div><div class="card-tier">${owned ? 'INSTALLED' : tier.toUpperCase()}</div></div></div>
      ${owned ? '<div class="stamp">OWNED</div>' : ''}
      <div class="card-body">
        <div class="blurb">“${u.blurb}”</div>
        <div class="effects">${owned ? this.ownedHtml(u.effects) : this.deltaHtml(u.effects)}</div>
        <div class="card-foot"><div class="cost ${owned ? 'owned' : ''}">${owned ? icon('check') + ' Paid' : fmtMoney(u.cost)}</div><button class="buy ${owned ? 'owned' : ''}" ${owned || !canAfford ? 'disabled' : ''}>${owned ? 'Installed' : canAfford ? 'Buy' : 'Too poor'}</button></div>
      </div>`;
    if (!owned && canAfford) div.querySelector('button').onclick = () => { if (onBuy()) { quip(BUY_QUIPS[Math.floor(Math.random() * BUY_QUIPS.length)]); this.render(); this.onChange && this.onChange(u); } };
    return div;
  }

  render() {
    const g = this.game;
    $('ledger-money').textContent = fmtMoney(g.s.money);
    $('ledger-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
    $('ledger-heading').textContent = TAB_META[this.tab].heading;
    const body = this.body; body.innerHTML = '';
    const grid = document.createElement('div'); grid.className = 'cards';

    const afford = (cost) => g.godMode || g.s.money >= cost;
    if (this.tab === 'casino') {
      const list = CASINO_UPGRADES[g.casinoDef.id];
      $('ledger-intro').textContent = TAB_META.casino.intro(g, list, list.filter(u => g.ownsCasinoUpgrade(u.id)).length);
      for (const u of list) grid.appendChild(this.card(u, list, g.ownsCasinoUpgrade(u.id), afford(u.cost), () => g.buyCasinoUpgrade(u.id)));
    } else if (this.tab === 'ads') {
      $('ledger-intro').textContent = TAB_META.ads.intro(g, AD_UPGRADES, AD_UPGRADES.filter(u => g.ownsAd(u.id)).length);
      for (const u of AD_UPGRADES) grid.appendChild(this.card(u, AD_UPGRADES, g.ownsAd(u.id), afford(u.cost), () => g.buyAd(u.id)));
    } else if (this.tab === 'awards') {
      $('ledger-intro').textContent = TAB_META.awards.intro(g, AWARDS, AWARDS.filter(a => g.ownsAward(a.id)).length);
      for (const a of AWARDS) grid.appendChild(this.card(a, AWARDS, g.ownsAward(a.id), afford(a.cost), () => g.buyAward(a.id)));
    } else if (this.tab === 'skills') {
      $('ledger-intro').textContent = TAB_META.skills.intro();
      const skillIcons = { sleight: 'hand', back: 'muscle', poker: 'hat', tongue: 'snake', feet: 'shoe' };
      for (const sk of SKILLS) {
        const lvl = g.skillLevel(sk.id), cost = g.skillCost(sk.id);
        const tier = ['common', 'rare', 'epic', 'legendary', 'legendary'][Math.min(4, lvl)];
        const div = document.createElement('div');
        div.className = `card ${tier} ${lvl >= 5 ? 'owned' : ''}`;
        div.innerHTML = `
          <div class="card-head"><div class="card-icon">${icon(skillIcons[sk.id])}</div><div class="card-title"><div class="card-name">${sk.name}</div><div class="card-tier">LEVEL ${lvl} / 5 · ${sk.activity.toUpperCase()}</div></div></div>
          <div class="card-body">
            <div class="pips">${[0, 1, 2, 3, 4].map(i => `<span class="${i < lvl ? 'on' : ''}"></span>`).join('')}</div>
            <div class="blurb">“${sk.blurb}”</div>
            <div class="look">Look: ${lvl > 0 ? sk.cosmetic.slice(0, lvl).join(', ') : 'nothing yet'}${lvl < 5 ? ` → next <b>${sk.cosmetic[lvl]}</b>` : ''}</div>
            <div class="effects">${lvl < 5 ? this.deltaHtml(sk.perLevel) : '<div class="fx"><span>Mastered</span><span class="delta good">MAX</span></div>'}</div>
            <div class="card-foot"><div class="cost ${cost === null ? 'owned' : ''}">${cost === null ? icon('check') + ' Mastered' : fmtMoney(cost)}</div><button class="buy ${lvl >= 5 ? 'owned' : ''}" ${cost === null || !afford(cost) ? 'disabled' : ''}>${cost === null ? 'Maxed' : afford(cost) ? 'Train' : 'Too poor'}</button></div>
          </div>`;
        if (cost !== null && afford(cost)) div.querySelector('button').onclick = () => { if (g.buySkill(sk.id)) { quip(`${sk.cosmetic[lvl]}. Looking sharp. Feeling sharper.`); this.render(); this.onChange && this.onChange(sk); } };
        grid.appendChild(div);
      }
    } else if (this.tab === 'expand') {
      $('ledger-intro').textContent = TAB_META.expand.intro();
      CASINOS.forEach((c, i) => {
        const owned = g.s.ownedCasinos.includes(i), current = g.s.casino === i;
        const div = document.createElement('div');
        div.className = `card casino-card ${['rare', 'epic', 'legendary'][i]} ${owned ? 'owned' : ''} ${current ? 'current' : ''}`;
        const b = c.base;
        div.innerHTML = `
          <div class="card-head"><div class="card-icon">${icon(['building', 'building', 'tower'][i])}</div><div class="card-title"><div class="card-name">${g.casinoDisplayName(i)}</div><div class="card-tier">CASINO ${i + 1} OF 3${current ? ' · YOU ARE HERE' : owned ? ' · OWNED' : ''}</div></div></div>
          <div class="card-body">
            <div class="tagline">“${c.tagline}”</div>
            <div class="stat-strip">
              <div><span>Machines</span><b>${b.machines}</b></div><div><span>Tables</span><b>${b.tables}</b></div>
              <div><span>Walk-ins</span><b>${b.trafficPerMin}/min</b></div><div><span>Spend/guest</span><b>$${b.spendPerMin}/min</b></div>
              <div><span>Hopper cap</span><b>$${b.hopperCap}</b></div><div><span>Prestige</span><b>${b.prestige}</b></div>
            </div>
            <div class="card-foot"><div class="cost ${owned ? 'owned' : ''}">${owned ? icon('check') + (current ? ' Current' : ' Owned') : fmtMoney(c.price)}</div><button class="buy ${owned ? 'owned' : ''}" ${current || (!owned && !afford(c.price)) ? 'disabled' : ''}>${current ? 'Here' : owned ? 'Move in' : afford(c.price) ? 'Buy' : 'Too poor'}</button></div>
          </div>`;
        const btn = div.querySelector('button');
        if (!current && (owned || afford(c.price))) btn.onclick = () => { const ok = owned ? g.moveToCasino(i) : g.buyCasino(i); if (ok) { this.hide(); this.onChange && this.onChange({ casino: i }); } };
        grid.appendChild(div);
      });
    }
    body.appendChild(grid);
  }
}
