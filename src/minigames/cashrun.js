// Cash run: memorize increasingly long number sequences to crack the vault.
// 5 rounds. Round 1 shows 1 digit, round 5 shows 5 digits. Bank more the
// further you get.
import { MiniGame, GW, GH, fmtMoney, PAL } from './base.js';

const ROUNDS = 5;
const SHOW_BASE = 2.4;
const SHOW_PER_DIGIT = 0.6;
const DIGIT_SIZE = 72;
const PAD_COLS = 5;
const PAD_ROWS = 2;
const PAD_BTN = 72;
const PAD_GAP = 12;
const PAD_Y = GH - 170;

function genSequence(len) {
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(Math.floor(Math.random() * 10));
  return seq;
}

export class CashRunGame extends MiniGame {
  constructor(game) {
    super('VAULT CRACK');
    this.game = game;
    this.total = game.s.machineCash;
    this.round = 0;
    this.roundsCleared = 0;
    this.phase = 'ready';
    this.phaseT = 0;
    this.sequence = [];
    this.input = [];
    this.flash = 0;
    this.flashColor = PAL.green;
    this.msg = '';
    this.msgT = 0;
    this.msgGood = true;
    this.lockPulse = 0;
    this.shakeT = 0;
    this.sparks = [];
    this.digitReveal = [];
    this.padW = PAD_COLS * (PAD_BTN + PAD_GAP) - PAD_GAP;
    this.padX = GW / 2 - this.padW / 2;
    this.startRound();
  }

  get showDuration() { return SHOW_BASE + this.sequence.length * SHOW_PER_DIGIT; }
  get perRoundValue() { return this.total / ROUNDS; }

  startRound() {
    this.round++;
    this.sequence = genSequence(this.round);
    this.input = [];
    this.phase = 'show';
    this.phaseT = 0;
    this.digitReveal = this.sequence.map(() => 0);
  }

  bankAmount() { return Math.floor(this.roundsCleared * this.perRoundValue); }

  burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, max: 0.8, color });
    }
  }

  submitDigit(d) {
    if (this.phase !== 'input') return;
    const idx = this.input.length;
    this.input.push(d);
    if (d !== this.sequence[idx]) {
      this.phase = 'fail';
      this.phaseT = 0;
      this.shakeT = 0.4;
      this.msg = 'Wrong code';
      this.msgT = 1.5;
      this.msgGood = false;
      this.burst(GW / 2, GH / 2, PAL.red, 24);
      return;
    }
    this.burst(GW / 2 + (idx - (this.sequence.length - 1) / 2) * (DIGIT_SIZE + 16), 260, PAL.green, 8);
    if (this.input.length === this.sequence.length) {
      this.roundsCleared++;
      this.lockPulse = 1;
      if (this.round >= ROUNDS) {
        this.phase = 'win';
        this.phaseT = 0;
        this.msg = 'Vault cracked!';
        this.msgT = 2;
        this.msgGood = true;
        this.burst(GW / 2, GH / 2, PAL.gold, 40);
      } else {
        this.phase = 'correct';
        this.phaseT = 0;
        this.msg = `Sequence ${this.round} cleared`;
        this.msgT = 1.2;
        this.msgGood = true;
      }
    }
  }

  onDown() {
    if (this.phase !== 'input') return;
    const mx = this.mouse.x, my = this.mouse.y;
    for (let i = 0; i < 10; i++) {
      const col = i % PAD_COLS, row = Math.floor(i / PAD_COLS);
      const bx = this.padX + col * (PAD_BTN + PAD_GAP);
      const by = PAD_Y + row * (PAD_BTN + PAD_GAP);
      if (mx >= bx && mx <= bx + PAD_BTN && my >= by && my <= by + PAD_BTN) {
        this.submitDigit(i);
        return;
      }
    }
  }

  onKey(e) {
    const k = e.key;
    if (k >= '0' && k <= '9') this.submitDigit(parseInt(k, 10));
  }

  update(dt) {
    this.phaseT += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.lockPulse = Math.max(0, this.lockPulse - dt * 2);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.msgT = Math.max(0, this.msgT - dt);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vx *= 0.97;
      p.life -= dt; if (p.life <= 0) this.sparks.splice(i, 1);
    }

    if (this.phase === 'show') {
      const dur = this.showDuration;
      for (let i = 0; i < this.digitReveal.length; i++) {
        const start = 0.3 + i * SHOW_PER_DIGIT * 0.7;
        this.digitReveal[i] = Math.min(1, Math.max(0, (this.phaseT - start) / 0.3));
      }
      if (this.phaseT >= dur) {
        this.phase = 'input';
        this.phaseT = 0;
        this.input = [];
      }
    } else if (this.phase === 'correct') {
      if (this.phaseT >= 1.2) this.startRound();
    } else if (this.phase === 'fail') {
      if (this.phaseT >= 2) this.finish({ banked: this.bankAmount() });
    } else if (this.phase === 'win') {
      if (this.phaseT >= 2.5) this.finish({ banked: this.bankAmount() });
    }
  }

  // ---- drawing ----

  drawVault(ctx, t) {
    const vx = GW - 250, vy = 80, vw = 200, vh = 260;
    const openFrac = this.roundsCleared / ROUNDS;

    ctx.save();
    ctx.fillStyle = '#0b0910';
    this.roundRect(ctx, vx - 20, vy - 20, vw + 40, vh + 40, 10); ctx.fill();
    const steel = ctx.createLinearGradient(vx - 20, vy, vx + vw + 20, vy);
    steel.addColorStop(0, '#2a3038'); steel.addColorStop(0.4, '#48525e'); steel.addColorStop(0.62, '#333b45'); steel.addColorStop(1, '#1e242b');
    ctx.fillStyle = steel;
    this.roundRect(ctx, vx - 12, vy - 12, vw + 24, vh + 24, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const ry = vy - 4 + i * (vh + 8) / 5;
      ctx.fillStyle = '#5d6874';
      ctx.beginPath(); ctx.arc(vx - 8, ry, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(vx + vw + 8, ry, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#05040a'; ctx.fillRect(vx, vy, vw, vh);
    const glow = ctx.createLinearGradient(0, vy, 0, vy + vh);
    glow.addColorStop(0, this.rgba(PAL.gold, 0.14)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(vx, vy, vw, vh);

    const shelves = this.roundsCleared;
    for (let i = 0; i < shelves; i++) {
      const by = vy + vh - 24 - i * 44;
      ctx.fillStyle = '#1f6b3f'; this.roundRect(ctx, vx + 16, by, vw - 32, 30, 4); ctx.fill();
      ctx.fillStyle = '#2f8d55'; ctx.fillRect(vx + 16, by, vw - 32, 8);
      ctx.fillStyle = PAL.pink; ctx.fillRect(vx + vw / 2 - 6, by, 12, 30);
      this.text(ctx, fmtMoney(this.perRoundValue), vx + vw / 2, by + 15, 11, '#0b2e1c', 'center');
    }

    const doorWidth = vw * (1 - openFrac * 0.85);
    const dg = ctx.createLinearGradient(vx, 0, vx + Math.max(20, doorWidth), 0);
    dg.addColorStop(0, '#525d6a'); dg.addColorStop(1, '#242b33');
    ctx.fillStyle = dg;
    ctx.fillRect(vx, vy, Math.max(20, doorWidth), vh);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, Math.max(20, doorWidth), vh);

    if (openFrac < 1) {
      const hx = vx + doorWidth * 0.6, hy = vy + vh / 2, rr = 24;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 1.5 + openFrac * Math.PI);
      ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke(); }
      ctx.fillStyle = '#b9c4d0'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // lock indicators
    const lockY = vy + vh + 36;
    for (let i = 0; i < ROUNDS; i++) {
      const lx = vx + (i + 0.5) * vw / ROUNDS;
      const cleared = i < this.roundsCleared;
      const glow2 = cleared && this.lockPulse > 0 && i === this.roundsCleared - 1;
      ctx.save();
      if (glow2) { ctx.shadowColor = PAL.green; ctx.shadowBlur = 16; }
      ctx.fillStyle = cleared ? PAL.green : this.rgba(PAL.dim, 0.3);
      ctx.beginPath(); ctx.arc(lx, lockY, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (cleared) {
        this.text(ctx, '✓', lx, lockY, 11, '#000', 'center', undefined, '800');
      }
    }
    this.label(ctx, `${this.roundsCleared} / ${ROUNDS} locks`, vx + vw / 2, lockY + 22, 11, PAL.dim, 'center');
    ctx.restore();
  }

  drawSequenceDisplay(ctx) {
    const seq = this.phase === 'show' ? this.sequence : [];
    const inputSeq = this.phase === 'input' || this.phase === 'fail' ? this.input : [];
    const totalSlots = this.sequence.length;
    const slotW = DIGIT_SIZE + 16;
    const startX = GW / 2 - (totalSlots * slotW - 16) / 2;
    const cy = 250;

    for (let i = 0; i < totalSlots; i++) {
      const sx = startX + i * slotW;

      ctx.save();
      if (this.phase === 'show') {
        const reveal = this.digitReveal[i] || 0;
        ctx.fillStyle = this.rgba(PAL.gold, 0.08 + reveal * 0.12);
        this.roundRect(ctx, sx, cy - DIGIT_SIZE / 2 - 4, DIGIT_SIZE, DIGIT_SIZE + 8, 10); ctx.fill();
        ctx.strokeStyle = this.rgba(PAL.gold, 0.2 + reveal * 0.5); ctx.lineWidth = 2; ctx.stroke();
        if (reveal > 0.1) {
          ctx.globalAlpha = reveal;
          this.neon(ctx, `${this.sequence[i]}`, sx + DIGIT_SIZE / 2, cy, DIGIT_SIZE * 0.75, PAL.gold, 'center', 20, 3);
        }
      } else if (this.phase === 'input' || this.phase === 'fail' || this.phase === 'correct' || this.phase === 'win') {
        const filled = i < inputSeq.length;
        const correct = filled && inputSeq[i] === this.sequence[i];
        const wrong = filled && !correct;
        const current = i === inputSeq.length && this.phase === 'input';

        const bgAlpha = current ? 0.18 + Math.sin(this.t * 4) * 0.06 : filled ? 0.15 : 0.06;
        const borderColor = wrong ? PAL.red : correct ? PAL.green : current ? PAL.cyan : PAL.dim;

        ctx.fillStyle = this.rgba(wrong ? PAL.red : correct ? PAL.green : PAL.gold, bgAlpha);
        this.roundRect(ctx, sx, cy - DIGIT_SIZE / 2 - 4, DIGIT_SIZE, DIGIT_SIZE + 8, 10); ctx.fill();
        ctx.strokeStyle = this.rgba(borderColor, current ? 0.8 : 0.4); ctx.lineWidth = 2; ctx.stroke();

        if (filled) {
          const color = wrong ? PAL.red : PAL.green;
          this.neon(ctx, `${inputSeq[i]}`, sx + DIGIT_SIZE / 2, cy, DIGIT_SIZE * 0.75, color, 'center', 16, 3);
        } else if (!current) {
          this.text(ctx, '·', sx + DIGIT_SIZE / 2, cy, 40, this.rgba(PAL.dim, 0.4), 'center');
        }
      }
      ctx.restore();
    }
  }

  drawPad(ctx) {
    if (this.phase !== 'input') return;
    const mx = this.mouse.x, my = this.mouse.y;

    for (let i = 0; i < 10; i++) {
      const col = i % PAD_COLS, row = Math.floor(i / PAD_COLS);
      const bx = this.padX + col * (PAD_BTN + PAD_GAP);
      const by = PAD_Y + row * (PAD_BTN + PAD_GAP);
      const hover = mx >= bx && mx <= bx + PAD_BTN && my >= by && my <= by + PAD_BTN;

      ctx.save();
      ctx.fillStyle = hover ? this.rgba(PAL.gold, 0.18) : 'rgba(14,10,22,0.7)';
      this.roundRect(ctx, bx, by, PAD_BTN, PAD_BTN, 10); ctx.fill();
      ctx.strokeStyle = hover ? this.rgba(PAL.gold, 0.6) : this.rgba(PAL.gold, 0.2);
      ctx.lineWidth = hover ? 2 : 1.5; ctx.stroke();
      this.neon(ctx, `${i}`, bx + PAD_BTN / 2, by + PAD_BTN / 2, 32, hover ? PAL.gold : PAL.bone, 'center', hover ? 14 : 8, 2);
      ctx.restore();
    }
  }

  draw(ctx) {
    const t = this.t;
    this.backdrop(ctx, PAL.cyan, t);

    ctx.save();
    if (this.shakeT > 0) ctx.translate(Math.sin(t * 60) * this.shakeT * 12, Math.cos(t * 47) * this.shakeT * 6);

    // left info panel
    this.panel(ctx, 30, 80, 280, 100, { accent: PAL.gold });
    this.readout(ctx, 50, 92, 'in the hoppers', fmtMoney(this.total), PAL.gold, 'left', 28);
    this.readout(ctx, 50, 140, 'secured so far', fmtMoney(this.bankAmount()), PAL.green, 'left', 28);

    // round indicator
    this.panel(ctx, 30, 200, 280, 50, { accent: PAL.cyan });
    this.label(ctx, `sequence ${this.round} of ${ROUNDS}`, 170, 218, 13, PAL.cyan, 'center');
    const barW = 240, barX = 50, barY = 236;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.roundRect(ctx, barX, barY, barW, 6, 3); ctx.fill();
    ctx.fillStyle = PAL.cyan;
    this.roundRect(ctx, barX, barY, barW * (this.round / ROUNDS), 6, 3); ctx.fill();

    // phase instruction
    let instruction = '';
    if (this.phase === 'show') instruction = 'memorize the code';
    else if (this.phase === 'input') instruction = 'enter the code';
    else if (this.phase === 'correct') instruction = 'correct — next sequence';
    else if (this.phase === 'fail') instruction = 'vault lockout — wrong code';
    else if (this.phase === 'win') instruction = 'all sequences cracked!';
    this.label(ctx, instruction, GW / 2, 190, 14, this.phase === 'fail' ? PAL.red : this.phase === 'win' ? PAL.gold : PAL.bone, 'center');

    this.drawSequenceDisplay(ctx);
    this.drawPad(ctx);
    this.drawVault(ctx, t);

    // sparks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    this.vignette(ctx, 0.5);
    if (this.msgT > 0) this.banner(ctx, this.msg, 380, this.msgGood ? PAL.green : PAL.red, 30, Math.min(1, this.msgT * 2));
  }
}
