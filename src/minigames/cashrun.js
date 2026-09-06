// Blackjack: simple 21 card game. Dealer deals cards, player hits or stands.
// Beat the dealer's hand without going over 21.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = { A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };

function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += RANK_VALUES[c.rank]; if (c.rank === 'A') aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isRed(card) { return card.suit === '♥' || card.suit === '♦'; }

const QUIPS = {
  win: ['"Blackjack. The house always wins."', '"Better luck next time."', '"Twenty-one. The sweetest number."'],
  lose: ['"...Congratulations." *grinds teeth*', '"Enjoy it. I know where you live."', '"A fluke. Deal again."'],
  push: ['"A tie. How boring."', '"Push. Nobody wins. The house still wins."'],
  blackjack: ['"Natural blackjack. The cards love me."', '"Twenty-one on the deal. Textbook."'],
};

export class CashRunGame extends MiniGame {
  constructor(game, players) {
    super('BLACKJACK');
    this.game = game;
    this.players = players.slice(0, 3);
    this.hand = 0;
    this.results = [];
    this.won = 0;
    this.lost = 0;
    this.deck = makeDeck();
    this.phase = 'intro';
    this.phaseT = 1.6;
    this.chips = [];
    this.shakeT = 0;
    this.playerCards = [];
    this.dealerCards = [];
    this.setupHand();
  }

  draw1() {
    if (this.deck.length < 10) this.deck = makeDeck();
    return this.deck.pop();
  }

  burst(x, y, color, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 90 + Math.random() * 260;
      this.chips.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10, life: 0.7 + Math.random() * 0.5, max: 1.2, color });
    }
  }

  setupHand() {
    const st = this.game.stats;
    const c = this.players[this.hand];
    const info = TYPE_INFO[c.type];
    const diff = c.difficulty || 'medium';
    const tier = DIFFICULTY_TIERS[diff];
    const betScale = Math.sqrt(st.spendPerMin / 40);
    this.current = {
      type: c.type, difficulty: diff, label: info.label, tierLabel: tier.label, tierColor: tier.color,
      bet: Math.round(info.bet * st.dealerBet * betScale * tier.betMul),
    };
    this.playerCards = [this.draw1(), this.draw1()];
    this.dealerCards = [this.draw1(), this.draw1()];
    this.stood = false;
    this.dealerRevealed = false;

    if (handValue(this.playerCards) === 21) {
      this.dealerRevealed = true;
      this.stood = true;
      this.resolveHand();
      return;
    }
  }

  hit() {
    if (this.phase !== 'play' || this.stood) return;
    sfx.play('keypad', 1);
    this.playerCards.push(this.draw1());
    if (handValue(this.playerCards) > 21) {
      this.stood = true;
      this.dealerRevealed = true;
      this.resolveHand();
    } else if (handValue(this.playerCards) === 21) {
      this.stand();
    }
  }

  stand() {
    if (this.phase !== 'play' || this.stood) return;
    sfx.play('keypad', 5);
    this.stood = true;
    this.dealerRevealed = true;
    while (handValue(this.dealerCards) < 17) this.dealerCards.push(this.draw1());
    this.resolveHand();
  }

  resolveHand() {
    const pv = handValue(this.playerCards);
    const dv = handValue(this.dealerCards);
    const st = this.game.stats;
    const bet = this.current.bet;
    let hit, quipPool;
    const isBlackjack = pv === 21 && this.playerCards.length === 2;

    if (pv > 21) {
      hit = false; quipPool = QUIPS.lose;
    } else if (dv > 21) {
      hit = true; quipPool = QUIPS.win;
    } else if (isBlackjack && !(dv === 21 && this.dealerCards.length === 2)) {
      hit = true; quipPool = QUIPS.blackjack;
    } else if (pv > dv) {
      hit = true; quipPool = QUIPS.win;
    } else if (pv < dv) {
      hit = false; quipPool = QUIPS.lose;
    } else {
      hit = null; quipPool = QUIPS.push;
    }

    const mul = isBlackjack && hit ? 1.5 : 1;
    const amount = hit ? Math.round(bet * st.houseEdge * mul) : hit === false ? bet : 0;
    if (hit === true) { this.won += amount; this.game.addMoney(amount, 'blackjack'); }
    else if (hit === false) { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    this.results.push({ hit: hit === true, blackjack: isBlackjack && hit, amount, quip: quipPool[Math.floor(Math.random() * quipPool.length)], push: hit === null, pv, dv });

    if (isBlackjack && hit) {
      sfx.play('bullseye');
      this.burst(GW / 2, 300, PAL.gold, 40);
      this.shakeT = 0.6;
    } else if (hit) {
      sfx.playRandom('happy', 'chuckle', 'ching');
      this.burst(GW / 2, 300, PAL.gold, 28);
      this.shakeT = 0.35;
    } else if (hit === false) {
      sfx.playRandom('groan', 'oof', 'frustrate');
      this.burst(GW / 2, 300, PAL.red, 14);
      this.shakeT = 0.5;
    } else {
      sfx.play('huff');
      this.shakeT = 0.2;
    }
    this.phase = 'result';
    this.phaseT = isBlackjack ? 2.6 : 2.0;
  }

  onDown() {
    if (this.phase !== 'play' || this.stood) return;
    const mx = this.mouse.x, my = this.mouse.y;
    const btnY = 490, btnH = 50, btnW = 140;
    if (my >= btnY && my <= btnY + btnH) {
      if (mx >= GW / 2 - btnW - 20 && mx <= GW / 2 - 20) this.hit();
      else if (mx >= GW / 2 + 20 && mx <= GW / 2 + 20 + btnW) this.stand();
    }
  }

  onKey(e) {
    if (e.code === 'KeyH' || e.code === 'Space') { e.preventDefault(); this.hit(); }
    else if (e.code === 'KeyS' || e.code === 'Enter') { e.preventDefault(); this.stand(); }
  }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt * 1.6);
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const p = this.chips[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; p.vx *= 0.98; p.r += p.vr * dt;
      p.life -= dt; if (p.life <= 0) this.chips.splice(i, 1);
    }
    if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'play'; return; }
    if (this.phase === 'result') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.hand++;
        if (this.hand >= this.players.length) this.finish({ won: this.won, lost: this.lost, hands: this.results });
        else { this.setupHand(); this.phase = 'intro'; this.phaseT = 1.2; }
      }
    }
  }

  drawCard(ctx, card, x, y, faceDown = false) {
    const cw = 70, ch = 100, r = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = faceDown ? '#1a2040' : '#f7f3e8';
    this.roundRect(ctx, x, y, cw, ch, r); ctx.fill();
    ctx.strokeStyle = faceDown ? '#3a4a6a' : '#c8c0b0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.shadowBlur = 0;
    if (faceDown) {
      ctx.fillStyle = '#2a3a5a';
      for (let dx = 8; dx < cw - 4; dx += 12) for (let dy = 8; dy < ch - 4; dy += 12) {
        ctx.fillRect(x + dx, y + dy, 6, 6);
      }
    } else {
      const col = isRed(card) ? PAL.red : '#111';
      ctx.fillStyle = col;
      ctx.font = `bold 22px ${SERIF}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(card.rank, x + 6, y + 4);
      ctx.font = `18px ${SERIF}`;
      ctx.fillText(card.suit, x + 6, y + 26);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold 32px ${SERIF}`;
      ctx.fillText(card.suit, x + cw / 2, y + ch / 2 + 8);
    }
    ctx.restore();
  }

  drawTable(ctx) {
    const t = this.t;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createRadialGradient(GW / 2, 210, 20, GW / 2, 380, 520);
    cone.addColorStop(0, 'rgba(255,214,150,0.16)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = cone; ctx.beginPath();
    ctx.moveTo(GW / 2 - 60, 0); ctx.lineTo(GW / 2 + 60, 0); ctx.lineTo(GW / 2 + 470, GH); ctx.lineTo(GW / 2 - 470, GH); ctx.closePath(); ctx.fill();
    ctx.restore();
    const cx = GW / 2, cy = GH + 90, rx = 640, ry = 430;
    const felt = ctx.createRadialGradient(cx, cy - ry * 0.6, 40, cx, cy, rx);
    felt.addColorStop(0, '#12492d'); felt.addColorStop(0.45, '#092e1d'); felt.addColorStop(1, '#03110b');
    ctx.fillStyle = felt; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.clip();
    ctx.globalAlpha = 0.05; ctx.strokeStyle = '#9fe8bd'; ctx.lineWidth = 1;
    for (let x = 0; x < GW; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GH); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this.rgba(PAL.gold, 0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - 90, ry - 70, 0, Math.PI, 0); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#5c3a1c'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - 9, ry - 6, 0, Math.PI, 0); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.24;
    this.neon(ctx, 'BLACKJACK PAYS 3:2', cx, GH - 22, 22, PAL.gold, 'center', 0, 6);
    ctx.restore();
  }

  draw(ctx) {
    const t = this.t, cur = this.current;
    ctx.save();
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * this.shakeT * 16, (Math.random() - 0.5) * this.shakeT * 16);

    this.backdrop(ctx, PAL.green, t);
    this.drawTable(ctx);

    // gambler info
    const tint = { drunk: PAL.pink, regular: PAL.cyan, sharp: '#b39ddb', whale: PAL.gold }[cur.type] || PAL.cyan;
    this.panel(ctx, 26, 88, 220, 120, { accent: tint });
    this.label(ctx, `hand ${this.hand + 1} of ${this.players.length}`, 46, 100, 11, PAL.dim);
    this.neon(ctx, `${cur.label} gambler`, 46, 126, 22, tint, 'left', 12, 1);
    ctx.save();
    ctx.fillStyle = this.rgba(cur.tierColor, 0.18);
    this.roundRect(ctx, 46, 140, 62, 20, 4); ctx.fill();
    ctx.strokeStyle = this.rgba(cur.tierColor, 0.6); ctx.lineWidth = 1; ctx.stroke();
    this.label(ctx, cur.tierLabel, 77, 150, 10, cur.tierColor, 'center');
    ctx.restore();
    this.label(ctx, 'bet', 46, 172, 10, PAL.dim);
    this.text(ctx, fmtMoney(cur.bet), 46, 194, 22, PAL.green, 'left');

    if (this.phase === 'play' || this.phase === 'result') {
      // dealer's cards
      this.label(ctx, 'DEALER', GW / 2, 100, 12, PAL.dim, 'center');
      const dcx = GW / 2 - (this.dealerCards.length * 80) / 2;
      for (let i = 0; i < this.dealerCards.length; i++) {
        this.drawCard(ctx, this.dealerCards[i], dcx + i * 80, 116, i === 1 && !this.dealerRevealed);
      }
      const dv = this.dealerRevealed ? handValue(this.dealerCards) : '?';
      this.neon(ctx, `${dv}`, GW / 2, 232, 28, PAL.bone, 'center', 10, 1);

      // player's cards
      this.label(ctx, 'YOUR HAND', GW / 2, 260, 12, PAL.dim, 'center');
      const pcx = GW / 2 - (this.playerCards.length * 80) / 2;
      for (let i = 0; i < this.playerCards.length; i++) {
        this.drawCard(ctx, this.playerCards[i], pcx + i * 80, 278);
      }
      const pv = handValue(this.playerCards);
      const pvCol = pv > 21 ? PAL.red : pv === 21 ? PAL.gold : PAL.bone;
      this.neon(ctx, `${pv}`, GW / 2, 396, 28, pvCol, 'center', 10, 1);

      // hit/stand buttons
      if (this.phase === 'play' && !this.stood) {
        const btnY = 430, btnH = 50, btnW = 140;
        const mx = this.mouse.x, my = this.mouse.y;
        // HIT
        const hx = GW / 2 - btnW - 20;
        const hHover = mx >= hx && mx <= hx + btnW && my >= btnY && my <= btnY + btnH;
        ctx.fillStyle = hHover ? this.rgba(PAL.green, 0.3) : this.rgba(PAL.green, 0.15);
        this.roundRect(ctx, hx, btnY, btnW, btnH, 10); ctx.fill();
        ctx.strokeStyle = PAL.green; ctx.lineWidth = 2; ctx.stroke();
        this.neon(ctx, 'HIT (H)', hx + btnW / 2, btnY + btnH / 2, 22, PAL.green, 'center', 10, 1);
        // STAND
        const sx = GW / 2 + 20;
        const sHover = mx >= sx && mx <= sx + btnW && my >= btnY && my <= btnY + btnH;
        ctx.fillStyle = sHover ? this.rgba(PAL.gold, 0.3) : this.rgba(PAL.gold, 0.15);
        this.roundRect(ctx, sx, btnY, btnW, btnH, 10); ctx.fill();
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.stroke();
        this.neon(ctx, 'STAND (S)', sx + btnW / 2, btnY + btnH / 2, 22, PAL.gold, 'center', 10, 1);
      }
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      this.neon(ctx, `A ${cur.label.toLowerCase()} sits down`, GW / 2, 240, 44, PAL.bone, 'center', 20, 3);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 282, 26, cur.tierColor, 'center', 14, 2);
      this.text(ctx, `They're betting ${fmtMoney(cur.bet)} — beat their hand to win.`, GW / 2, 320, 18, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.blackjack) {
        this.banner(ctx, `BLACKJACK!  +${fmtMoney(r.amount)}`, 62, PAL.gold, 42);
      } else if (r.push) {
        this.banner(ctx, 'PUSH — TIE GAME', 62, PAL.dim, 38);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 62, r.hit ? PAL.gold : PAL.red, 38);
      }
      ctx.save(); ctx.font = `italic 19px ${SERIF}`; ctx.fillStyle = PAL.bone; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r.quip, GW / 2, 542); ctx.restore();
    }

    // flying chips
    ctx.save();
    for (const p of this.chips) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 9 * Math.abs(Math.cos(p.r)) + 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-9, -1.5, 18, 3);
      ctx.restore();
    }
    ctx.restore();

    // scoreline
    this.vignette(ctx, 0.45);
    ctx.fillStyle = 'rgba(4,3,8,0.7)'; ctx.fillRect(0, 0, GW, 62);
    ctx.strokeStyle = this.rgba(PAL.gold, 0.28); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(GW, 62); ctx.stroke();
    this.readout(ctx, 30, 20, 'house took', fmtMoney(this.won), PAL.green, 'left', 26);
    this.readout(ctx, GW - 30, 20, 'paid out', fmtMoney(this.lost), this.lost ? PAL.red : PAL.dim, 'right', 26);
    this.bulbs(ctx, GW / 2 - 110, 30, 220, t, { count: 9, color: PAL.gold, r: 2.6 });
    ctx.restore();
  }
}
