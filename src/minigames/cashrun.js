// Cash run: drag cash stacks from the hoppers into the safe before the timer
// runs out. The safe door swings shut periodically. You only bank what lands.
import { MiniGame, GW, GH, fmtMoney, PAL } from './base.js';

export class CashRunGame extends MiniGame {
  constructor(game) {
    super('CASH RUN');
    this.game = game;
    const st = game.stats;
    this.timeLeft = st.cashTime; this.totalTime = this.timeLeft;
    const total = game.s.machineCash;
    const size = st.stackSize;
    const n = Math.min(60, Math.ceil(total / size));
    this.stacks = [];
    let remaining = total;
    const cols = 6;
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowH = rows > 1 ? Math.min(46, 356 / (rows - 1)) : 46;
    for (let i = 0; i < n; i++) {
      const v = Math.min(size, remaining); remaining -= v;
      const col = i % cols, row = Math.floor(i / cols);
      this.stacks.push({ x: 70 + col * 70 + (Math.random() - 0.5) * 10, y: 132 + row * rowH + (Math.random() - 0.5) * 6, value: v, banked: false, drag: false, vx: 0, vy: 0, rot: (Math.random() - 0.5) * 0.35, seed: Math.random() });
    }
    this.hidden = Math.max(0, remaining);
    this.banked = 0;
    this.held = null;
    this.doorT = 0;
    this.doorOpen = true;
    this.safe = { x: GW - 220, y: 150, w: 180, h: 300 };
    this.flash = 0; this.msg = ''; this.msgT = 0; this.msgGood = true;
    this.doorPeriod = 3.2;
    this.bankPop = 0;
    this.sparks = [];
  }

  burst(x, y, color, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 80 + Math.random() * 240;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color });
    }
  }

  onDown() {
    for (let i = this.stacks.length - 1; i >= 0; i--) {
      const s = this.stacks[i];
      if (s.banked) continue;
      if (Math.abs(this.mouse.x - s.x) < 30 && Math.abs(this.mouse.y - s.y) < 20) { this.held = s; s.drag = true; this.stacks.push(...this.stacks.splice(i, 1)); return; }
    }
  }
  onUp() {
    if (!this.held) return;
    const s = this.held; s.drag = false; this.held = null;
    const sf = this.safe;
    if (s.x > sf.x && s.x < sf.x + sf.w && s.y > sf.y && s.y < sf.y + sf.h) {
      if (this.doorOpen) {
        s.banked = true; this.banked += s.value; this.msg = `+${fmtMoney(s.value)} banked`; this.msgT = 1; this.msgGood = true;
        this.bankPop = 1; this.burst(s.x, s.y, PAL.green, 14);
      } else {
        this.flash = 1; this.msg = 'Door\'s shut. Wait for it.'; this.msgT = 1; this.msgGood = false;
        this.burst(s.x, s.y, PAL.red, 10); s.vx = -600; s.vy = -200;
      }
    }
  }

  update(dt) {
    this.timeLeft -= dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.msgT = Math.max(0, this.msgT - dt);
    this.doorT += dt;
    this.bankPop = Math.max(0, this.bankPop - dt * 2.2);
    this.doorOpen = (this.doorT % this.doorPeriod) < this.doorPeriod * 0.68;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.vx *= 0.97;
      p.life -= dt; if (p.life <= 0) this.sparks.splice(i, 1);
    }
    if (this.timeLeft <= 0) { this.finish({ banked: this.banked }); return; }
    for (const s of this.stacks) {
      if (s.banked) continue;
      if (s.drag) {
        // heavy stacks lag behind the hand
        s.x += (this.mouse.x - s.x) * Math.min(1, dt * 14);
        s.y += (this.mouse.y - s.y) * Math.min(1, dt * 14);
      } else if (s.vx || s.vy) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt;
        s.vx *= 0.96;
        if (s.y > GH - 40) { s.y = GH - 40; s.vy = 0; s.vx = 0; }
        if (s.x < 40) { s.x = 40; s.vx = 0; }
      }
    }
    if (this.stacks.every(s => s.banked) && this.stacks.length) this.finish({ banked: this.banked });
  }

  /** Brushed-steel vault set into the back-office wall. */
  drawSafe(ctx) {
    const sf = this.safe, t = this.t;
    const open = this.doorOpen;
    // wall recess + frame
    ctx.save();
    ctx.fillStyle = '#0b0910';
    this.roundRect(ctx, sf.x - 34, sf.y - 34, sf.w + 68, sf.h + 68, 10); ctx.fill();
    const steel = ctx.createLinearGradient(sf.x - 34, sf.y, sf.x + sf.w + 34, sf.y);
    steel.addColorStop(0, '#2a3038'); steel.addColorStop(0.4, '#48525e'); steel.addColorStop(0.62, '#333b45'); steel.addColorStop(1, '#1e242b');
    ctx.fillStyle = steel;
    this.roundRect(ctx, sf.x - 26, sf.y - 26, sf.w + 52, sf.h + 52, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
    // rivets
    ctx.fillStyle = '#5d6874';
    for (let i = 0; i < 7; i++) {
      const ry = sf.y - 12 + i * (sf.h + 24) / 6;
      ctx.beginPath(); ctx.arc(sf.x - 16, ry, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sf.x + sf.w + 16, ry, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // interior: dark cavity with banded cash on the shelves
    ctx.fillStyle = '#05040a'; ctx.fillRect(sf.x, sf.y, sf.w, sf.h);
    const glow = ctx.createLinearGradient(0, sf.y, 0, sf.y + sf.h);
    glow.addColorStop(0, this.rgba(PAL.gold, 0.14)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(sf.x, sf.y, sf.w, sf.h);
    const shelves = Math.min(6, Math.floor(this.banked / Math.max(1, this.game.stats.stackSize) / 3) + (this.banked > 0 ? 1 : 0));
    for (let i = 0; i < shelves; i++) {
      const by = sf.y + sf.h - 26 - i * 22;
      ctx.fillStyle = '#1f6b3f'; this.roundRect(ctx, sf.x + 22, by, sf.w - 44, 15, 3); ctx.fill();
      ctx.fillStyle = '#2f8d55'; ctx.fillRect(sf.x + 22, by, sf.w - 44, 5);
      ctx.fillStyle = PAL.pink; ctx.fillRect(sf.x + sf.w / 2 - 6, by, 12, 15);
    }
    ctx.restore();

    // the door, hinged on the left
    const openFrac = open ? 0.86 : 0;
    const dw = sf.w * (1 - openFrac);
    ctx.save();
    ctx.fillStyle = this.flash > 0 ? `rgb(${110 + 130 * this.flash},52,60)` : '#3b444f';
    const dg = ctx.createLinearGradient(sf.x, 0, sf.x + Math.max(24, dw), 0);
    dg.addColorStop(0, '#525d6a'); dg.addColorStop(1, '#242b33');
    if (this.flash <= 0) ctx.fillStyle = dg;
    ctx.fillRect(sf.x, sf.y, Math.max(20, dw), sf.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(sf.x, sf.y, Math.max(20, dw), sf.h);
    // handwheel on the door face (only readable when closed)
    if (!open) {
      const hx = sf.x + sf.w * 0.62, hy = sf.y + sf.h / 2, rr = 32;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 2.2);
      ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke(); }
      ctx.fillStyle = '#b9c4d0'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // bolts extended
      ctx.fillStyle = '#6c7681';
      for (let i = 0; i < 4; i++) ctx.fillRect(sf.x + sf.w - 6, sf.y + 30 + i * 70, 14, 12);
    } else {
      ctx.fillStyle = '#b9c4d0'; ctx.beginPath(); ctx.arc(sf.x + 10, sf.y + sf.h / 2, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // status sign above the vault
    const sc = open ? PAL.green : PAL.red;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; this.roundRect(ctx, sf.x - 26, sf.y - 78, sf.w + 52, 34, 6); ctx.fill();
    ctx.strokeStyle = this.rgba(sc, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    const flick = open ? 1 : 0.6 + Math.abs(Math.sin(t * 9)) * 0.4;
    ctx.save(); ctx.globalAlpha = flick;
    this.neon(ctx, open ? 'VAULT OPEN' : 'LOCKED', sf.x + sf.w / 2, sf.y - 61, 24, sc, 'center', 20, 3);
    ctx.restore();
    // door-cycle pip strip
    const cyc = (this.doorT % this.doorPeriod) / this.doorPeriod;
    this.bulbs(ctx, sf.x - 20, sf.y + sf.h + 40, sf.w + 40, this.doorT, { count: 12, color: sc });
    ctx.fillStyle = this.rgba(sc, 0.9);
    ctx.fillRect(sf.x - 20 + cyc * (sf.w + 40) - 1.5, sf.y + sf.h + 30, 3, 20);
  }

  drawStack(ctx, s) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.drag ? s.rot * 0.3 : s.rot);
    if (s.drag) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.scale(1.07, 1.07); }
    // side of the bundle (a few notes deep)
    ctx.fillStyle = '#16301f'; this.roundRect(ctx, -31, -14, 62, 34, 4); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#2c7a4b' : '#256540';
      this.roundRect(ctx, -30, -16 - i * 3, 60, 32, 4); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // top note
    const top = ctx.createLinearGradient(-30, 0, 30, 0);
    top.addColorStop(0, '#2f8d55'); top.addColorStop(0.5, '#43b072'); top.addColorStop(1, '#2f8d55');
    ctx.fillStyle = top; this.roundRect(ctx, -30, -25, 60, 32, 4); ctx.fill();
    // engraving
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
    ctx.strokeRect(-25, -21, 50, 24);
    ctx.fillStyle = 'rgba(240,240,220,0.9)';
    ctx.beginPath(); ctx.arc(0, -9, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c5233';
    ctx.beginPath(); ctx.arc(0, -9, 6, 0, Math.PI * 2); ctx.fill();
    // paper band
    ctx.fillStyle = PAL.pink; ctx.fillRect(-30, -18, 60, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-30, -18, 60, 2);
    ctx.restore();
    this.text(ctx, fmtMoney(s.value), s.x, s.y - 14 + (s.drag ? 0 : 0), 11, '#0b2e1c', 'center');
  }

  draw(ctx) {
    const t = this.t;
    this.backdrop(ctx, PAL.gold, t);

    // ---- hopper floor area ----
    ctx.save();
    ctx.fillStyle = 'rgba(10,7,18,0.72)';
    this.roundRect(ctx, 26, 84, 486, 428, 14); ctx.fill();
    ctx.restore();
    // slot-machine silhouettes behind the cash
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const mx = 58 + i * 76;
      ctx.fillStyle = '#171122'; this.roundRect(ctx, mx, 108, 58, 130, 8); ctx.fill();
      ctx.fillStyle = this.rgba(PAL.cyan, 0.20 + 0.14 * Math.abs(Math.sin(t * 1.4 + i))); ctx.fillRect(mx + 8, 128, 42, 34);
      ctx.fillStyle = this.rgba(PAL.pink, 0.30); ctx.fillRect(mx + 8, 116, 42, 5);
    }
    ctx.restore();
    this.panel(ctx, 26, 84, 486, 428, { accent: PAL.gold, fill: 'rgba(0,0,0,0)', r: 14, corner: 20 });
    this.label(ctx, 'the hoppers', 46, 102, 12, PAL.gold);
    if (this.hidden > 0) this.label(ctx, `+${fmtMoney(this.hidden)} still inside the machines`, 46, 496, 11, PAL.dim);

    this.drawSafe(ctx);

    // drop-zone hint while dragging
    if (this.held) {
      const sf = this.safe;
      ctx.save();
      ctx.setLineDash([9, 9]); ctx.lineDashOffset = -t * 30;
      ctx.strokeStyle = this.doorOpen ? this.rgba(PAL.green, 0.85) : this.rgba(PAL.red, 0.85);
      ctx.lineWidth = 2.5; ctx.shadowColor = this.doorOpen ? PAL.green : PAL.red; ctx.shadowBlur = 14;
      this.roundRect(ctx, sf.x + 2, sf.y + 2, sf.w - 4, sf.h - 4, 4); ctx.stroke();
      ctx.restore();
    }

    for (const s of this.stacks) { if (!s.banked) this.drawStack(ctx, s); }

    // sparks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ---- HUD ----
    this.vignette(ctx, 0.5);
    this.timerBar(ctx, this.timeLeft / this.totalTime);
    this.neon(ctx, `${Math.ceil(this.timeLeft)}`, GW / 2, 56, 30, this.timeLeft < 8 ? PAL.red : PAL.bone, 'center', 12, 2);

    const left = this.stacks.filter(s => !s.banked).reduce((a, s) => a + s.value, 0) + this.hidden;
    this.panel(ctx, 24, GH - 74, 300, 58, { accent: PAL.green });
    ctx.save();
    if (this.bankPop > 0) { ctx.translate(44, GH - 46); ctx.scale(1 + this.bankPop * 0.12, 1 + this.bankPop * 0.12); ctx.translate(-44, -(GH - 46)); }
    this.readout(ctx, 44, GH - 58, 'banked', fmtMoney(this.banked), PAL.green, 'left', 28);
    ctx.restore();
    this.readout(ctx, 196, GH - 58, 'still loose', fmtMoney(left), PAL.gold, 'left', 28);

    if (this.msgT > 0) this.banner(ctx, this.msg, 468, this.msgGood ? PAL.green : PAL.red, 26, Math.min(1, this.msgT * 2.2));
    else this.label(ctx, 'drag the bundles into the vault — only what lands is yours', 648, GH - 34, 11, PAL.dim, 'center');
  }
}
