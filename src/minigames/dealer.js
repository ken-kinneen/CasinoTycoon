// Roulette: a target number is drawn, a 10-second countdown starts and a ball
// cursor sweeps around a circular wheel. Hit SPACE / click to stop it. Land on
// or near the target and the house takes the bet. Bullseye (exact) pays 2x.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const QUIPS = {
  win: ['"The ball falls where I tell it."', '"House wins. House always wins."', '"Oh no, so close!" (it wasn\'t close)', '"Would you like a complimentary drink?"'],
  lose: ['"...Congratulations." *grinds teeth*', '"That one\'s on the house. The house is furious."', '"Enjoy it. I know where you live."', '"A fluke. Spin again."'],
  bullseye: ['"Dead center. You\'re terrifying."', '"Perfection. The pit boss is watching."', '"Right on the number. Literally."'],
};

const BULLSEYE_RADIUS = 0;
const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const TWO_PI = Math.PI * 2;
const SLOT_ANGLE = TWO_PI / WHEEL_NUMBERS.length;

function wheelIndexOf(num) {
  return WHEEL_NUMBERS.indexOf(num);
}

export class DealerGame extends MiniGame {
  constructor(game, players) {
    super('ROULETTE');
    this.game = game;
    this.players = players.length ? players.slice(0, 3) : [{ type: 'regular', difficulty: 'medium' }];
    this.hand = 0;
    this.results = [];
    this.won = 0; this.lost = 0;
    this.phase = 'intro'; this.phaseT = 1.6;
    this.angle = 0;
    this.shake = 0;
    this.chips = [];
    this.bullseyeFlash = 0;
    this.setupHand();
  }

  burst(x, y, color, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TWO_PI, s = 90 + Math.random() * 260;
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
      margin: Math.max(1, Math.round((info.margin + st.dealerMargin) * tier.dealerMarginMul)),
      bet: Math.round(info.bet * st.dealerBet * betScale * tier.betMul),
      target: WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)],
    };
    this.countdown = 10;
    this.angularSpeed = 8.5 * st.dealerSpeed;
    this.angle = Math.random() * TWO_PI;
    this.locked = null;
    this.lockedAngle = null;
  }

  currentWheelNumber() {
    let a = ((this.angle % TWO_PI) + TWO_PI) % TWO_PI;
    let idx = Math.round(a / SLOT_ANGLE) % WHEEL_NUMBERS.length;
    return WHEEL_NUMBERS[idx];
  }

  lock() {
    if (this.phase !== 'play') return;
    this.locked = this.currentWheelNumber();
    this.lockedAngle = this.angle;
    const tIdx = wheelIndexOf(this.current.target);
    const lIdx = wheelIndexOf(this.locked);
    let slotDiff = Math.abs(tIdx - lIdx);
    if (slotDiff > WHEEL_NUMBERS.length / 2) slotDiff = WHEEL_NUMBERS.length - slotDiff;
    const hit = slotDiff <= this.current.margin;
    const bullseye = slotDiff <= BULLSEYE_RADIUS;
    this.resolve(hit, bullseye);
  }

  resolve(hit, bullseye = false) {
    const st = this.game.stats;
    const mul = bullseye ? 2 : 1;
    const amount = hit ? Math.round(this.current.bet * st.houseEdge * mul) : this.current.bet;
    if (hit) { this.won += amount; this.game.addMoney(amount, 'roulette'); }
    else { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    const pool = bullseye ? QUIPS.bullseye : QUIPS[hit ? 'win' : 'lose'];
    this.results.push({ hit, bullseye, amount, quip: pool[Math.floor(Math.random() * pool.length)] });

    const wcx = GW / 2, wcy = 300;
    if (bullseye) {
      sfx.play('bullseye');
      this.burst(wcx, wcy, PAL.gold, 40);
      this.burst(wcx, wcy, '#fff', 16);
      this.shake = 0.6;
      this.bullseyeFlash = 1;
    } else if (hit) {
      sfx.playRandom('happy', 'chuckle', 'ching');
      this.burst(wcx, wcy, PAL.gold, 28);
      this.shake = 0.35;
    } else {
      sfx.playRandom('groan', 'oof', 'frustrate');
      this.burst(wcx, wcy, PAL.red, 14);
      this.shake = 0.5;
    }
    this.phase = 'result'; this.phaseT = bullseye ? 2.6 : 2.0;
  }

  onDown() { this.lock(); }
  onKey(e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.lock(); } }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.bullseyeFlash = Math.max(0, this.bullseyeFlash - dt * 0.8);
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const p = this.chips[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; p.vx *= 0.98; p.r += p.vr * dt;
      p.life -= dt; if (p.life <= 0) this.chips.splice(i, 1);
    }

    if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'play'; return; }
    if (this.phase === 'play') {
      this.countdown -= dt;
      this.angle += this.angularSpeed * dt;
      if (this.countdown <= 0) { this.locked = null; this.lockedAngle = null; this.resolve(false); }
      return;
    }
    if (this.phase === 'result') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.hand++;
        if (this.hand >= this.players.length) this.finish({ won: this.won, lost: this.lost, hands: this.results });
        else { this.setupHand(); this.phase = 'intro'; this.phaseT = 1.2; }
      }
    }
  }

  drawFelt(ctx) {
    const cx = GW / 2, cy = GH + 60;
    const felt = ctx.createRadialGradient(cx, cy - 260, 40, cx, cy, 640);
    felt.addColorStop(0, '#12492d'); felt.addColorStop(0.45, '#092e1d'); felt.addColorStop(1, '#03110b');
    ctx.fillStyle = felt;
    ctx.fillRect(0, 50, GW, GH - 102);
    ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = '#9fe8bd'; ctx.lineWidth = 1;
    for (let x = 0; x < GW; x += 7) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, GH - 52); ctx.stroke(); }
    ctx.restore();
  }

  drawWheel(ctx, cur, t) {
    const wcx = GW / 2, wcy = 300;
    const outerR = 180, innerR = 105, numR = 148, fretR = outerR + 1;
    const N = WHEEL_NUMBERS.length;
    const tIdx = wheelIndexOf(cur.target);

    ctx.save();

    // drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.beginPath(); ctx.arc(wcx, wcy, outerR + 18, 0, TWO_PI); ctx.fill();
    ctx.restore();

    // outer chrome ring
    const chrome = ctx.createRadialGradient(wcx, wcy - outerR * 0.3, outerR * 0.2, wcx, wcy, outerR + 18);
    chrome.addColorStop(0, '#a8956e'); chrome.addColorStop(0.3, '#7a6840'); chrome.addColorStop(0.6, '#4a3820');
    chrome.addColorStop(0.85, '#2a1c0e'); chrome.addColorStop(1, '#1a1008');
    ctx.fillStyle = chrome;
    ctx.beginPath(); ctx.arc(wcx, wcy, outerR + 18, 0, TWO_PI); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#c8b070'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wcx, wcy, outerR + 16, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.3); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wcx, wcy, outerR + 8, 0, TWO_PI); ctx.stroke();

    // number slots — always red/black/green, with outline indicators for aiming
    for (let i = 0; i < N; i++) {
      const a0 = i * SLOT_ANGLE - Math.PI / 2;
      const a1 = a0 + SLOT_ANGLE;
      const num = WHEEL_NUMBERS[i];
      const isTarget = (num === cur.target);

      const slotDist = Math.abs(i - tIdx);
      const wrapDist = Math.min(slotDist, N - slotDist);
      const inMargin = wrapDist <= cur.margin && wrapDist > BULLSEYE_RADIUS;
      const isBullseye = wrapDist <= BULLSEYE_RADIUS;

      // real roulette colors only
      let baseColor, highlightColor;
      if (num === 0) { baseColor = '#0d6b35'; highlightColor = '#15944a'; }
      else if (RED_NUMBERS.has(num)) { baseColor = '#9b1b2a'; highlightColor = '#c42838'; }
      else { baseColor = '#151528'; highlightColor = '#252540'; }

      const midA = a0 + SLOT_ANGLE / 2;
      const gx = wcx + Math.cos(midA) * (outerR * 0.5);
      const gy = wcy + Math.sin(midA) * (outerR * 0.5);
      const slotGrad = ctx.createRadialGradient(gx, gy, 5, wcx, wcy, outerR);
      slotGrad.addColorStop(0, highlightColor);
      slotGrad.addColorStop(1, baseColor);

      // draw slot shape (ring segment)
      const slotPath = () => {
        ctx.beginPath();
        ctx.moveTo(wcx + Math.cos(a0) * innerR, wcy + Math.sin(a0) * innerR);
        ctx.arc(wcx, wcy, outerR, a0, a1);
        ctx.lineTo(wcx + Math.cos(a1) * innerR, wcy + Math.sin(a1) * innerR);
        ctx.arc(wcx, wcy, innerR, a1, a0, true);
        ctx.closePath();
      };

      slotPath();
      ctx.fillStyle = slotGrad;
      ctx.fill();

      // bullseye slot: gold/yellow outline (the exact target)
      if (isBullseye) {
        const pulse = 0.6 + Math.sin(t * 5) * 0.4;
        ctx.save();
        ctx.shadowColor = PAL.gold; ctx.shadowBlur = 14 + pulse * 8;
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
        slotPath(); ctx.stroke();
        ctx.restore();
      }
      // margin slots: green outline (the acceptable range)
      else if (inMargin) {
        ctx.save();
        ctx.shadowColor = PAL.green; ctx.shadowBlur = 8;
        ctx.strokeStyle = PAL.green; ctx.lineWidth = 2;
        slotPath(); ctx.stroke();
        ctx.restore();
      }

      // metallic fret dividers
      ctx.strokeStyle = 'rgba(200,180,120,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wcx + Math.cos(a0) * innerR, wcy + Math.sin(a0) * innerR);
      ctx.lineTo(wcx + Math.cos(a0) * fretR, wcy + Math.sin(a0) * fretR);
      ctx.stroke();

      // number labels
      const tx = wcx + Math.cos(midA) * numR;
      const ty = wcy + Math.sin(midA) * numR;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midA + Math.PI / 2);
      ctx.font = `bold 11px ${SERIF}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (isBullseye) {
        ctx.fillStyle = PAL.gold; ctx.shadowColor = PAL.gold; ctx.shadowBlur = 12;
      } else if (inMargin) {
        ctx.fillStyle = PAL.green; ctx.shadowColor = PAL.green; ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = '#ccc';
      }
      ctx.fillText(`${num}`, 0, 0);
      ctx.restore();
    }

    // inner hub
    const hubGrad = ctx.createRadialGradient(wcx - 15, wcy - 20, 10, wcx, wcy, innerR);
    hubGrad.addColorStop(0, '#1e1630'); hubGrad.addColorStop(0.5, '#110c1e'); hubGrad.addColorStop(1, '#08060e');
    ctx.fillStyle = hubGrad;
    ctx.beginPath(); ctx.arc(wcx, wcy, innerR, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.2); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wcx, wcy, innerR, 0, TWO_PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wcx, wcy, innerR - 12, 0, TWO_PI); ctx.stroke();
    const bossGrad = ctx.createRadialGradient(wcx - 4, wcy - 5, 2, wcx, wcy, 22);
    bossGrad.addColorStop(0, '#3a2f4a'); bossGrad.addColorStop(1, '#0e0a16');
    ctx.fillStyle = bossGrad;
    ctx.beginPath(); ctx.arc(wcx, wcy, 22, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wcx, wcy, 22, 0, TWO_PI); ctx.stroke();

    // hub content: result number OR countdown
    if (this.phase === 'result') {
      if (this.locked !== null) {
        const col = this.results[this.results.length - 1]?.hit ? PAL.green : PAL.red;
        this.neon(ctx, `${this.locked}`, wcx, wcy, 42, col, 'center', 16, 2);
      } else {
        this.neon(ctx, '--', wcx, wcy, 42, PAL.dim, 'center', 10, 2);
      }
    } else {
      // countdown timer arc
      const cdc = this.countdown < 3 ? PAL.red : PAL.gold;
      const timerR = innerR - 20;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(wcx, wcy, timerR, 0, TWO_PI); ctx.stroke();
      ctx.strokeStyle = cdc; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.shadowColor = cdc; ctx.shadowBlur = this.countdown < 3 ? 16 : 6;
      ctx.beginPath(); ctx.arc(wcx, wcy, timerR, -Math.PI / 2, -Math.PI / 2 + TWO_PI * Math.max(0, this.countdown / 10)); ctx.stroke();
      ctx.restore();
      const puls = this.countdown < 3 ? 1 + Math.sin(t * 12) * 0.06 : 1;
      this.neon(ctx, `${Math.max(0, Math.ceil(this.countdown))}`, wcx, wcy, 28 * puls, cdc, 'center', 8, 1);
    }

    // ball
    const ballR = outerR + 4;
    const drawAngle = this.phase === 'result' && this.lockedAngle !== null ? this.lockedAngle : this.angle;
    const ba = drawAngle - Math.PI / 2;
    const bx = wcx + Math.cos(ba) * ballR;
    const by = wcy + Math.sin(ba) * ballR;

    if (this.phase === 'play') {
      for (let i = 1; i <= 16; i++) {
        const tA = ba - i * 0.04;
        const trx = wcx + Math.cos(tA) * ballR;
        const try_ = wcy + Math.sin(tA) * ballR;
        ctx.save();
        ctx.globalAlpha = (1 - i / 16) * 0.18;
        ctx.fillStyle = '#e0d4c0';
        ctx.beginPath(); ctx.arc(trx, try_, 7 - i * 0.3, 0, TWO_PI); ctx.fill();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 14;
    const ballGrad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 8);
    ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.3, '#e8e0d0');
    ballGrad.addColorStop(0.7, '#b0a890'); ballGrad.addColorStop(1, '#786848');
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); ctx.arc(bx, by, 8, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(bx - 2.5, by - 3, 2.5, 0, TWO_PI); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /** Unified HUD bar across the bottom */
  drawHUD(ctx, cur) {
    const tint = { drunk: PAL.pink, regular: PAL.cyan, sharp: '#b39ddb', whale: PAL.gold }[cur.type] || PAL.cyan;
    const barH = 52;
    const barY = GH - barH;

    ctx.save();
    ctx.fillStyle = 'rgba(4,3,8,0.7)';
    ctx.fillRect(0, barY, GW, barH);
    ctx.strokeStyle = this.rgba(PAL.gold, 0.15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(GW, barY); ctx.stroke();
    ctx.restore();

    const cy = barY + barH / 2;

    // left: gambler type + difficulty
    this.label(ctx, `spin ${this.hand + 1}/${this.players.length}`, 24, cy - 10, 11, PAL.dim);
    this.text(ctx, cur.label.toUpperCase(), 24, cy + 8, 18, tint, 'left', SERIF, 'bold');
    this.text(ctx, cur.tierLabel.toUpperCase(), 140, cy + 8, 13, cur.tierColor, 'left', SERIF, '600');

    // center-left: bet
    this.label(ctx, 'bet', 240, cy - 10, 11, PAL.dim, 'left');
    this.text(ctx, fmtMoney(cur.bet), 240, cy + 8, 20, PAL.green, 'left', SERIF, 'bold');

    // center-right: margin
    this.label(ctx, 'margin', 370, cy - 10, 11, PAL.dim, 'left');
    this.text(ctx, `±${cur.margin}`, 370, cy + 8, 20, PAL.bone, 'left', SERIF, 'bold');

    // right: target number with colored dot
    this.label(ctx, 'target', GW - 90, cy - 10, 11, PAL.dim, 'left');
    const numCol = cur.target === 0 ? '#0d6b35' : RED_NUMBERS.has(cur.target) ? '#9b1b2a' : '#252540';
    ctx.save();
    ctx.fillStyle = numCol;
    ctx.beginPath(); ctx.arc(GW - 80, cy + 8, 12, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.3); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(GW - 80, cy + 8, 12, 0, TWO_PI); ctx.stroke();
    ctx.restore();
    this.text(ctx, `${cur.target}`, GW - 80, cy + 8, 16, '#fff', 'center', SERIF, 'bold');
    this.text(ctx, `#${cur.target}`, GW - 56, cy + 8, 20, PAL.gold, 'left', SERIF, 'bold');
  }

  draw(ctx) {
    const t = this.t, cur = this.current;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 16, (Math.random() - 0.5) * this.shake * 16);

    this.backdrop(ctx, PAL.green, t);

    if (this.bullseyeFlash > 0) {
      ctx.save(); ctx.globalAlpha = this.bullseyeFlash * 0.25;
      ctx.fillStyle = PAL.gold; ctx.fillRect(0, 0, GW, GH);
      ctx.restore();
    }

    this.drawFelt(ctx);

    if (this.phase === 'play' || this.phase === 'result') {
      this.drawWheel(ctx, cur, t);

      if (this.phase === 'play') {
        ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.35;
        this.label(ctx, 'space / click to stop', GW / 2, 530, 13, PAL.bone, 'center');
        ctx.restore();
      }
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(4,3,8,0.55)';
      this.roundRect(ctx, GW / 2 - 320, 210, 640, 150, 12); ctx.fill();
      this.neon(ctx, `A ${cur.label.toLowerCase()} steps up`, GW / 2, 250, 42, PAL.bone, 'center', 18, 3);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 288, 24, cur.tierColor, 'center', 12, 2);
      this.text(ctx, `Betting ${fmtMoney(cur.bet)} — land within ±${cur.margin} of the number.`, GW / 2, 326, 17, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.bullseye) {
        this.banner(ctx, `EXACT!  2x  +${fmtMoney(r.amount)}`, 510, PAL.gold, 36);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 510, r.hit ? PAL.gold : PAL.red, 32);
      }
      ctx.save(); ctx.font = `italic 16px ${SERIF}`; ctx.fillStyle = PAL.bone; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r.quip, GW / 2, 552); ctx.restore();
    }

    // flying chips
    ctx.save();
    for (const p of this.chips) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 9 * Math.abs(Math.cos(p.r)) + 2, 0, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-9, -1.5, 18, 3);
      ctx.restore();
    }
    ctx.restore();

    // top score bar
    this.vignette(ctx, 0.3);
    ctx.fillStyle = 'rgba(4,3,8,0.7)'; ctx.fillRect(0, 0, GW, 50);
    ctx.strokeStyle = this.rgba(PAL.gold, 0.15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(GW, 50); ctx.stroke();

    this.label(ctx, 'house took', 24, 14, 11, PAL.dim);
    this.text(ctx, fmtMoney(this.won), 24, 34, 20, PAL.green, 'left', SERIF, 'bold');
    this.label(ctx, 'paid out', GW - 24, 14, 11, PAL.dim, 'right');
    this.text(ctx, fmtMoney(this.lost), GW - 24, 34, 20, this.lost ? PAL.red : PAL.dim, 'right', SERIF, 'bold');

    // bottom HUD
    this.drawHUD(ctx, cur);
    ctx.restore();
  }
}
