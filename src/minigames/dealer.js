// Dealer: a target number is drawn, a 10-second countdown starts and the
// house number sweeps 0-100. Hit SPACE / click to lock it in. Land inside the
// gambler's margin of error and the house takes the bet.
// Bullseye: a tiny zone dead-center pays 2x.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const QUIPS = {
  win: ['"Better luck next time." (there is no next time)', '"House wins. House always wins."', '"Oh no, so close!" (it wasn\'t close)', '"Would you like a complimentary drink?"'],
  lose: ['"...Congratulations." *grinds teeth*', '"That one\'s on the house. The house is furious."', '"Enjoy it. I know where you live."', '"A fluke. Deal again."'],
  bullseye: ['"Dead center. You\'re terrifying."', '"Perfection. The pit boss is watching."', '"Bullseye. Remind me never to bet against you."', '"Right on the money. Literally."'],
};

const BULLSEYE_RADIUS = 1;

export class DealerGame extends MiniGame {
  constructor(game, players) {
    super('THE TABLE');
    this.game = game;
    this.players = players.slice(0, 3);
    this.hand = 0;
    this.results = [];
    this.won = 0; this.lost = 0;
    this.phase = 'intro'; this.phaseT = 1.6;
    this.number = 0; this.dir = 1;
    this.shake = 0;
    this.chips = [];
    this.bullseyeFlash = 0;
    this.setupHand();
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
      margin: Math.max(1, Math.round((info.margin + st.dealerMargin) * tier.dealerMarginMul)),
      bet: Math.round(info.bet * st.dealerBet * betScale * tier.betMul),
      target: 5 + Math.floor(Math.random() * 91),
    };
    this.countdown = 10;
    this.speed = 47 * st.dealerSpeed;
    this.number = Math.random() * 100; this.dir = 1;
    this.locked = null;
  }

  lock() {
    if (this.phase !== 'play') return;
    this.locked = Math.round(this.number);
    const diff = Math.abs(this.locked - this.current.target);
    const hit = diff <= this.current.margin;
    const bullseye = diff <= BULLSEYE_RADIUS;
    this.resolve(hit, bullseye);
  }
  resolve(hit, bullseye = false) {
    const st = this.game.stats;
    const mul = bullseye ? 2 : 1;
    const amount = hit ? Math.round(this.current.bet * st.houseEdge * mul) : this.current.bet;
    if (hit) { this.won += amount; this.game.addMoney(amount, 'dealer'); }
    else { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    const pool = bullseye ? QUIPS.bullseye : QUIPS[hit ? 'win' : 'lose'];
    this.results.push({ hit, bullseye, amount, quip: pool[Math.floor(Math.random() * pool.length)] });

    if (bullseye) {
      sfx.play('bullseye');
      this.burst(GW / 2, 262, PAL.gold, 40);
      this.burst(GW / 2, 262, '#fff', 16);
      this.shake = 0.6;
      this.bullseyeFlash = 1;
    } else if (hit) {
      sfx.playRandom('happy', 'chuckle', 'ching');
      this.burst(GW / 2, 262, PAL.gold, 28);
      this.shake = 0.35;
    } else {
      sfx.playRandom('groan', 'oof', 'frustrate');
      this.burst(GW / 2, 262, PAL.red, 14);
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
      this.number += this.dir * this.speed * dt;
      if (this.number >= 100) { this.number = 100; this.dir = -1; }
      if (this.number <= 0) { this.number = 0; this.dir = 1; }
      if (this.countdown <= 0) { this.locked = null; this.resolve(false); }
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

  /** Green felt half-round under a low pendant lamp. */
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
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - 130, ry - 100, 0, Math.PI, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save(); ctx.globalAlpha = 0.24;
    this.neon(ctx, 'THE HOUSE PAYS WHAT THE HOUSE DECIDES', cx, GH - 22, 22, PAL.gold, 'center', 0, 6);
    ctx.restore();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#5c3a1c'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - 9, ry - 6, 0, Math.PI, 0); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#1a1220'; this.roundRect(ctx, 92, GH - 92, 190, 44, 8); ctx.fill();
    const chipCols = [PAL.red, '#f7f3e8', PAL.cyan, PAL.gold];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = chipCols[i]; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(122 + i * 44, GH - 60 - k * 6, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const sx = GW - 268, sy = GH - 96;
    ctx.fillStyle = '#241a30'; this.roundRect(ctx, sx, sy, 96, 52, 8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.roundRect(ctx, sx + 6, sy + 6, 84, 26, 4); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i === 4 ? '#f7f3e8' : '#cfc6b2';
      this.roundRect(ctx, sx + 10 + i * 3, sy + 9 - i, 38, 22, 2); ctx.fill();
    }
    ctx.strokeStyle = this.rgba(PAL.red, 0.55); ctx.lineWidth = 1;
    ctx.strokeRect(sx + 25, sy + 8, 30, 16);
    ctx.fillStyle = this.rgba(PAL.gold, 0.5); ctx.fillRect(sx + 4, sy + 36, 88, 3);
    ctx.restore();
  }

  drawGambler(ctx, cur) {
    const t = this.t;
    const tint = { drunk: PAL.pink, regular: PAL.cyan, sharp: '#b39ddb', whale: PAL.gold }[cur.type] || PAL.cyan;
    this.panel(ctx, 26, 88, 268, 168, { accent: tint });
    ctx.save();
    ctx.translate(72, 150);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.shadowColor = tint; ctx.shadowBlur = 12; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c68a5e'; ctx.beginPath(); ctx.arc(0, -3 + Math.sin(t * 2) * 1.2, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1d16'; ctx.beginPath(); ctx.arc(0, -9, 15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#111';
    if (cur.type === 'sharp') { ctx.fillRect(-13, -6, 26, 6); }
    else { ctx.beginPath(); ctx.arc(-5, -4, 2, 0, Math.PI * 2); ctx.arc(5, -4, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#8a3b3b';
    ctx.beginPath(); ctx.arc(0, 4, 5, cur.type === 'drunk' ? 0 : 0.2, Math.PI - (cur.type === 'drunk' ? 0 : 0.2)); ctx.fill();
    ctx.fillStyle = tint; ctx.fillRect(-16, 14, 32, 12);
    ctx.restore();

    this.label(ctx, `hand ${this.hand + 1} of ${this.players.length}`, 118, 100, 11, PAL.dim);
    this.neon(ctx, `${cur.label} gambler`, 118, 126, 24, tint, 'left', 12, 1);
    ctx.save();
    ctx.fillStyle = this.rgba(cur.tierColor, 0.18);
    this.roundRect(ctx, 118, 140, 62, 20, 4); ctx.fill();
    ctx.strokeStyle = this.rgba(cur.tierColor, 0.6); ctx.lineWidth = 1; ctx.stroke();
    this.label(ctx, cur.tierLabel, 149, 150, 10, cur.tierColor, 'center');
    ctx.restore();

    this.label(ctx, 'margin', 118, 172, 10, PAL.dim);
    this.text(ctx, `±${cur.margin}`, 118, 194, 22, PAL.bone, 'left');
    this.label(ctx, 'bet', 214, 172, 10, PAL.dim);
    this.text(ctx, fmtMoney(cur.bet), 214, 194, 22, PAL.green, 'left');
    const pips = Math.min(10, Math.round(cur.margin / 2));
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i < pips ? this.rgba(PAL.green, 0.9) : 'rgba(255,255,255,0.10)';
      ctx.fillRect(118 + i * 15, 224, 11, 5);
    }
  }

  drawTarget(ctx, cur) {
    const x = GW - 214, y = 88, w = 188, h = 168;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#f7f3e8'; this.roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#12101a'; this.roundRect(ctx, x + 9, y + 9, w - 18, h - 18, 7); ctx.fill();
    ctx.strokeStyle = this.rgba(PAL.gold, 0.6); ctx.lineWidth = 1.5;
    this.roundRect(ctx, x + 14, y + 14, w - 28, h - 28, 5); ctx.stroke();
    this.label(ctx, 'the number', x + w / 2, y + 34, 11, PAL.gold, 'center');
    this.neon(ctx, `${cur.target}`, x + w / 2, y + 96, 78, PAL.bone, 'center', 22, 2);
    ctx.fillStyle = PAL.red;
    ctx.font = `18px ${SERIF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('♦', x + 20, y + 22); ctx.textAlign = 'right'; ctx.fillText('♦', x + w - 20, y + h - 22);
  }

  draw(ctx) {
    const t = this.t, cur = this.current;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 16, (Math.random() - 0.5) * this.shake * 16);

    this.backdrop(ctx, PAL.green, t);

    // bullseye screen flash
    if (this.bullseyeFlash > 0) {
      ctx.save(); ctx.globalAlpha = this.bullseyeFlash * 0.25;
      ctx.fillStyle = PAL.gold; ctx.fillRect(0, 0, GW, GH);
      ctx.restore();
    }

    this.drawTable(ctx);
    this.drawGambler(ctx, cur);
    this.drawTarget(ctx, cur);

    if (this.phase === 'play' || this.phase === 'result') {
      const n = this.phase === 'result' && this.locked !== null ? this.locked : Math.round(this.number);
      const diff = Math.abs(n - cur.target);
      const hit = diff <= cur.margin;
      const isBullseye = diff <= BULLSEYE_RADIUS;
      const near = hit;
      const col = this.phase === 'result'
        ? (isBullseye && hit ? PAL.gold : hit ? PAL.green : PAL.red)
        : near ? PAL.green : PAL.bone;

      // display housing
      this.panel(ctx, GW / 2 - 148, 152, 296, 190, { accent: col, fill: 'rgba(4,3,8,0.8)', r: 14, corner: 22 });
      this.bulbs(ctx, GW / 2 - 130, 168, 260, t, { count: 11, color: col, r: 2.6 });
      this.neon(ctx, this.phase === 'result' && this.locked === null ? '--' : `${n}`, GW / 2, 262, 140, col, 'center', near || this.phase === 'result' ? 46 : 26, 4);
      this.label(ctx, this.phase === 'result' ? 'locked' : 'the wheel', GW / 2, 326, 11, PAL.dim, 'center');

      // sweep track
      const tw = 600, tx = GW / 2 - tw / 2, ty = 382;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.roundRect(ctx, tx - 8, ty - 12, tw + 16, 34, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; this.roundRect(ctx, tx, ty, tw, 10, 5); ctx.fill();

      // safe band (green)
      const lo = (cur.target - cur.margin) / 100, hi = (cur.target + cur.margin) / 100;
      ctx.save(); ctx.shadowColor = PAL.green; ctx.shadowBlur = 16;
      ctx.fillStyle = this.rgba(PAL.green, 0.75);
      this.roundRect(ctx, tx + lo * tw, ty - 4, (hi - lo) * tw, 18, 4); ctx.fill();
      ctx.restore();

      // bullseye zone (bright gold diamond in the center of the green band)
      const blo = (cur.target - BULLSEYE_RADIUS) / 100, bhi = (cur.target + BULLSEYE_RADIUS) / 100;
      const bx = tx + blo * tw, bw = (bhi - blo) * tw;
      const bullPulse = 0.7 + Math.sin(t * 6) * 0.3;
      ctx.save();
      ctx.shadowColor = PAL.gold; ctx.shadowBlur = 12 + bullPulse * 6;
      ctx.fillStyle = this.rgba(PAL.gold, 0.85 * bullPulse + 0.15);
      this.roundRect(ctx, bx, ty - 6, Math.max(bw, 6), 22, 3); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // diamond icon above the bullseye
      ctx.save();
      const dmx = tx + (cur.target / 100) * tw;
      ctx.fillStyle = this.rgba(PAL.gold, 0.6 + Math.sin(t * 5) * 0.3);
      ctx.shadowColor = PAL.gold; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(dmx, ty - 18); ctx.lineTo(dmx + 5, ty - 12); ctx.lineTo(dmx, ty - 6); ctx.lineTo(dmx - 5, ty - 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // scale marks
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i <= 10; i++) ctx.fillRect(tx + i * tw / 10, ty + 16, 1, 6);
      // needle
      const nx = tx + (this.number / 100) * tw;
      ctx.save(); ctx.shadowColor = PAL.gold; ctx.shadowBlur = 18; ctx.fillStyle = PAL.gold;
      ctx.fillRect(nx - 2, ty - 14, 4, 38);
      ctx.beginPath(); ctx.moveTo(nx - 8, ty - 14); ctx.lineTo(nx + 8, ty - 14); ctx.lineTo(nx, ty - 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();

      // "2x" label next to bullseye on the track
      this.label(ctx, '2x', tx + (cur.target / 100) * tw, ty + 30, 10, PAL.gold, 'center');

      // countdown ring
      const cdc = this.countdown < 3 ? PAL.red : PAL.gold;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(GW / 2, 472, 40, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = cdc; ctx.lineCap = 'round';
      ctx.shadowColor = cdc; ctx.shadowBlur = this.countdown < 3 ? 20 : 10;
      ctx.beginPath(); ctx.arc(GW / 2, 472, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, this.countdown / 10)); ctx.stroke();
      ctx.restore();
      const puls = this.countdown < 3 ? 1 + Math.sin(t * 12) * 0.06 : 1;
      this.neon(ctx, `${Math.max(0, Math.ceil(this.countdown))}`, GW / 2, 472, 34 * puls, cdc, 'center', 14, 1);

      if (this.phase === 'play') {
        ctx.save(); ctx.globalAlpha = 0.65 + Math.sin(t * 4) * 0.35;
        this.label(ctx, 'space or click to lock it in', GW / 2, 542, 12, PAL.bone, 'center');
        ctx.restore();
      }
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      this.neon(ctx, `A ${cur.label.toLowerCase()} sits down`, GW / 2, 240, 44, PAL.bone, 'center', 20, 3);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 282, 26, cur.tierColor, 'center', 14, 2);
      this.text(ctx, `They're betting ${fmtMoney(cur.bet)} — land within ±${cur.margin} of the number.`, GW / 2, 320, 18, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.bullseye) {
        this.banner(ctx, `BULLSEYE!  2x  +${fmtMoney(r.amount)}`, 112, PAL.gold, 42);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 112, r.hit ? PAL.gold : PAL.red, 38);
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
