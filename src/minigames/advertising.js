// Advertising: Operation-style. Guide an ad card from your hand into a
// passer-by's pocket through a winding gap without touching the fabric.
import { MiniGame, GW, GH, PAL } from './base.js';

const JACKETS = [
  { coat: '#4a3a24', dark: '#2e2214', trim: '#6b5334' },
  { coat: '#22374f', dark: '#152232', trim: '#33506f' },
  { coat: '#38254f', dark: '#221532', trim: '#503470' },
  { coat: '#1f4a38', dark: '#122e22', trim: '#2e6b50' },
  { coat: '#4f2020', dark: '#301313', trim: '#6f3030' },
  { coat: '#2b2b33', dark: '#18181e', trim: '#41414d' },
  { coat: '#5b4620', dark: '#382b13', trim: '#7d6330' },
];
const SKINS = ['#d9a679', '#b3805a', '#8a5c3c', '#e8c39e', '#6f472e'];
const NAMES = ['a tourist', 'a nurse off shift', 'a retiree', 'a pastor', 'a bus driver', 'a student', 'a bride-to-be', 'a tax inspector', 'someone\'s grandmother', 'a birthday boy', 'a man who "quit"', 'a jogger'];

function catmull(points, samples = 14) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export class AdvertisingGame extends MiniGame {
  constructor(game) {
    super('SLIP THE ADS');
    this.game = game;
    this.timeLeft = game.stats.cardTime;
    this.totalTime = this.timeLeft;
    this.halfWidth = 26 * game.stats.cardWidth;
    this.deposited = 0; this.busted = 0;
    this.holding = false;
    this.flash = 0; this.msg = ''; this.msgT = 0; this.msgGood = true;
    this.sparks = [];
    this.pop = 0;
    this.newTarget();
  }

  newTarget() {
    // random winding channel from the start (bottom-left) to a pocket (upper-right area)
    const pts = [{ x: 140, y: 500 }];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      pts.push({ x: 140 + t * 480 + (Math.random() - 0.5) * 140, y: 500 - t * 300 + (Math.random() - 0.5) * 220 });
    }
    pts.push({ x: 660 + Math.random() * 60, y: 170 + Math.random() * 60 });
    this.path = catmull(pts);
    this.start = this.path[0]; this.end = this.path[this.path.length - 1];
    this.jacket = JACKETS[Math.floor(Math.random() * JACKETS.length)];
    this.skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    this.hairSeed = Math.random();
    this.who = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.holding = false;
  }

  distToPath(x, y) {
    let best = Infinity;
    for (const p of this.path) { const d = Math.hypot(p.x - x, p.y - y); if (d < best) best = d; }
    return best;
  }

  onDown() {
    if (!this.holding && Math.hypot(this.mouse.x - this.start.x, this.mouse.y - this.start.y) < 40) this.holding = true;
  }

  burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + Math.random() * 0.4, max: 0.9, color });
    }
  }

  update(dt) {
    this.timeLeft -= dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.msgT = Math.max(0, this.msgT - dt);
    this.pop = Math.max(0, this.pop - dt * 2.5);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.97;
      p.life -= dt; if (p.life <= 0) this.sparks.splice(i, 1);
    }
    if (this.timeLeft <= 0) { this.finish({ deposited: this.deposited, busted: this.busted }); return; }
    if (this.holding) {
      const d = this.distToPath(this.mouse.x, this.mouse.y);
      if (Math.hypot(this.mouse.x - this.end.x, this.mouse.y - this.end.y) < 22) {
        this.deposited++; this.msg = `Card slipped into ${this.who}'s pocket.`; this.msgT = 1.6; this.msgGood = true;
        this.pop = 1; this.burst(this.end.x, this.end.y, PAL.green, 24); this.newTarget();
      } else if (d > this.halfWidth - 6) {
        this.busted++; this.flash = 1; this.msg = `${this.who} felt that. They're gone.`; this.msgT = 1.6; this.msgGood = false;
        this.burst(this.mouse.x, this.mouse.y, PAL.red, 16); this.newTarget();
      }
    }
  }

  /** The mark, seen from behind under a streetlamp. */
  drawMark(ctx) {
    const j = this.jacket, sway = Math.sin(this.t * 1.1) * 4;
    ctx.save(); ctx.translate(sway, 0);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(500, GH - 8, 250, 34, 0, 0, Math.PI * 2); ctx.fill();
    // neck + head
    ctx.fillStyle = this.skin; ctx.fillRect(478, 96, 44, 60);
    ctx.beginPath(); ctx.arc(500, 84, 50, 0, Math.PI * 2); ctx.fill();
    // hair from behind
    ctx.fillStyle = this.hairSeed > 0.5 ? '#20161a' : '#4a3524';
    ctx.beginPath(); ctx.arc(500, 78, 50, Math.PI * 0.92, Math.PI * 0.08); ctx.fill();
    ctx.fillRect(452, 74, 96, 26);
    // ears
    ctx.fillStyle = this.skin;
    ctx.beginPath(); ctx.arc(452, 92, 9, 0, Math.PI * 2); ctx.arc(548, 92, 9, 0, Math.PI * 2); ctx.fill();
    // coat body
    const grad = ctx.createLinearGradient(260, 0, 740, 0);
    grad.addColorStop(0, j.dark); grad.addColorStop(0.42, j.coat); grad.addColorStop(1, j.dark);
    ctx.fillStyle = grad; this.roundRect(ctx, 268, 140, 464, 470, 44); ctx.fill();
    // shoulders highlight (lamp above)
    const hl = ctx.createLinearGradient(0, 140, 0, 260);
    hl.addColorStop(0, this.rgba(j.trim, 0.55)); hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hl; this.roundRect(ctx, 268, 140, 464, 130, 44); ctx.fill();
    // centre seam + collar
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(496, 150, 8, 460);
    ctx.fillStyle = j.trim; this.roundRect(ctx, 420, 138, 160, 30, 12); ctx.fill();
    // fabric folds
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = 230 + i * 78;
      ctx.beginPath(); ctx.moveTo(300 + (i % 2) * 30, y);
      ctx.quadraticCurveTo(400, y + 22, 486, y + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(700 - (i % 2) * 30, y + 30);
      ctx.quadraticCurveTo(600, y + 52, 514, y + 36); ctx.stroke();
    }
    // arms
    ctx.fillStyle = j.dark;
    this.roundRect(ctx, 250, 190, 62, 330, 30); ctx.fill();
    this.roundRect(ctx, 688, 190, 62, 330, 30); ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    const t = this.t;
    this.backdrop(ctx, PAL.pink, t);
    // wet sidewalk band + streetlamp cone from the top-left
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(160, 0, 520, GH);
    cone.addColorStop(0, 'rgba(255,226,168,0.13)'); cone.addColorStop(1, 'rgba(255,226,168,0)');
    ctx.fillStyle = cone; ctx.beginPath();
    ctx.moveTo(120, -20); ctx.lineTo(300, -20); ctx.lineTo(720, GH); ctx.lineTo(60, GH); ctx.closePath(); ctx.fill();
    ctx.restore();

    this.drawMark(ctx);

    // ---- pocket target ----
    const e = this.end;
    ctx.save();
    ctx.strokeStyle = this.rgba(PAL.green, 0.55); ctx.lineWidth = 3;
    ctx.shadowColor = PAL.green; ctx.shadowBlur = 14;
    this.roundRect(ctx, e.x - 62, e.y - 22, 124, 94, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.restore();

    // ---- the channel ----
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = p => { ctx.beginPath(); ctx.moveTo(this.path[0].x, this.path[0].y); for (const q of this.path) ctx.lineTo(q.x, q.y); ctx.stroke(); };
    // danger halo (the fabric edge)
    ctx.save();
    ctx.strokeStyle = this.flash > 0 ? `rgba(255,77,94,${0.35 + 0.65 * this.flash})` : this.rgba(PAL.pink, 0.5);
    ctx.shadowColor = this.flash > 0 ? PAL.red : PAL.pink; ctx.shadowBlur = 18 + this.flash * 26;
    ctx.lineWidth = this.halfWidth * 2 + 7; trace(); ctx.restore();
    // channel interior
    ctx.strokeStyle = 'rgba(6,4,10,0.95)'; ctx.lineWidth = this.halfWidth * 2; trace();
    // inner guide line
    ctx.save(); ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 40;
    ctx.strokeStyle = this.rgba(PAL.cyan, 0.32); ctx.lineWidth = 1.5; trace(); ctx.restore();

    // ---- markers ----
    const pulse = 1 + Math.sin(t * 4) * 0.12;
    ctx.save(); ctx.shadowColor = PAL.gold; ctx.shadowBlur = 16; ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(this.start.x, this.start.y, 11 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save();
    ctx.shadowColor = PAL.green; ctx.shadowBlur = 20 + this.pop * 30; ctx.fillStyle = PAL.green;
    ctx.beginPath(); ctx.arc(e.x, e.y, 13 * (1 + this.pop * 0.9), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    this.label(ctx, 'pocket', e.x, e.y + 46, 12, PAL.green, 'center');
    if (!this.holding) {
      ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.4;
      const hy = this.start.y > 90 ? this.start.y - 40 : this.start.y + 74;
      this.label(ctx, 'click to take a card', Math.max(110, Math.min(GW - 110, this.start.x)), hy, 12, PAL.gold, 'center');
      ctx.restore();
    }

    // ---- hand + card ----
    const cx = this.holding ? this.mouse.x : this.start.x, cy = this.holding ? this.mouse.y : this.start.y;
    ctx.save();
    ctx.fillStyle = '#e0ac69'; ctx.strokeStyle = '#8a5c3c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx + 10, cy + 28, 21, 24, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d09a5e';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx + 2 + i * 9, cy + 12, 5, 11, -0.25, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.28 + Math.sin(t * 3) * 0.05);
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#f7f3e8'; this.roundRect(ctx, -19, -12, 38, 24, 3); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = PAL.pink; ctx.fillRect(-19, -12, 38, 7);
    ctx.fillStyle = '#c9c2b4'; ctx.fillRect(-15, -2, 22, 2); ctx.fillRect(-15, 3, 16, 2);
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(12, 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- sparks ----
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ---- HUD ----
    this.vignette(ctx, 0.5);
    ctx.fillStyle = 'rgba(4,3,8,0.72)'; ctx.fillRect(0, 0, GW, 72);
    ctx.strokeStyle = this.rgba(PAL.gold, 0.24); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 72); ctx.lineTo(GW, 72); ctx.stroke();
    this.timerBar(ctx, this.timeLeft / this.totalTime);
    this.neon(ctx, `${Math.ceil(this.timeLeft)}`, GW / 2, 56, 30, this.timeLeft < 8 ? PAL.red : PAL.bone, 'center', 12, 2);

    this.panel(ctx, 24, 78, 210, 92, { accent: PAL.green });
    this.readout(ctx, 44, 104, 'planted', String(this.deposited), PAL.green);
    this.readout(ctx, 150, 104, 'caught', String(this.busted), this.busted ? PAL.red : PAL.dim);

    this.panel(ctx, GW - 258, 78, 234, 92, { accent: PAL.gold });
    this.label(ctx, 'the mark', GW - 238, 100, 11, PAL.dim);
    this.text(ctx, this.who, GW - 238, 122, 17, PAL.gold, 'left', undefined, '600');
    this.text(ctx, `${Math.round(this.game.stats.cardConversion * 100)}% of cards become a guest`, GW - 238, 150, 12, PAL.dim, 'left', undefined, '500');

    if (this.msgT > 0) this.banner(ctx, this.msg, GH - 52, this.msgGood ? PAL.green : PAL.red, 26, Math.min(1, this.msgT * 2));
    else this.label(ctx, "don't touch the fabric", GW / 2, GH - 40, 12, PAL.dim, 'center');
  }
}
