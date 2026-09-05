// Vault crack: watch the keypad light up a sequence, then enter it from memory.
// 4 rounds: 3 → 4 → 5 → 6 digits. Bank more the further you get.
import { MiniGame, GW, GH, fmtMoney, PAL } from './base.js';
import * as sfx from '../audio/sfx.js';

const ROUNDS = 4;
const START_LEN = 3;
const PRESS_DUR = 0.35;
const GAP_DUR = 0.18;
const PAUSE_BEFORE = 0.5;
const PAUSE_AFTER = 0.4;

// 3×4 phone-style keypad: 1-9, then bottom row is [empty, 0, empty]
const PAD_LAYOUT = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [-1, 0, -1],
];
const PAD_COLS = 3;
const PAD_ROWS = 4;
const PAD_BTN = 80;
const PAD_GAP = 10;
const PAD_W = PAD_COLS * PAD_BTN + (PAD_COLS - 1) * PAD_GAP;
const PAD_H = PAD_ROWS * PAD_BTN + (PAD_ROWS - 1) * PAD_GAP;
const PAD_X = GW / 2 - PAD_W / 2;
const PAD_Y = 180;

function padPos(digit) {
  for (let r = 0; r < PAD_ROWS; r++)
    for (let c = 0; c < PAD_COLS; c++)
      if (PAD_LAYOUT[r][c] === digit) return { bx: PAD_X + c * (PAD_BTN + PAD_GAP), by: PAD_Y + r * (PAD_BTN + PAD_GAP) };
  return null;
}

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
    this.showIdx = -1;
    this.showPressT = 0;
    this.msg = '';
    this.msgT = 0;
    this.msgGood = true;
    this.lockPulse = 0;
    this.shakeT = 0;
    this.sparks = [];
    this.inputFlash = {};
    this.startRound();
  }

  seqLen() { return START_LEN + this.round - 1; }
  get perRoundValue() { return this.total / ROUNDS; }

  showDuration() {
    const n = this.sequence.length;
    return PAUSE_BEFORE + n * PRESS_DUR + (n - 1) * GAP_DUR + PAUSE_AFTER;
  }

  startRound() {
    this.round++;
    this.sequence = genSequence(this.seqLen());
    this.input = [];
    this.phase = 'show';
    this.phaseT = 0;
    this.showIdx = -1;
    this.showPressT = 0;
    this.inputFlash = {};
  }

  bankAmount() { return Math.floor(this.roundsCleared * this.perRoundValue); }

  burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, max: 0.8, color });
    }
  }

  activeShowDigit() {
    if (this.phase !== 'show') return -1;
    const elapsed = this.phaseT - PAUSE_BEFORE;
    if (elapsed < 0) return -1;
    const step = PRESS_DUR + GAP_DUR;
    const idx = Math.floor(elapsed / step);
    if (idx >= this.sequence.length) return -1;
    const within = elapsed - idx * step;
    if (within > PRESS_DUR) return -1;
    return idx;
  }

  submitDigit(d) {
    if (this.phase !== 'input') return;
    sfx.play('keypad', d);
    const idx = this.input.length;
    this.input.push(d);
    this.inputFlash[d] = 0.3;
    const pp = padPos(d);
    if (pp) this.burst(pp.bx + PAD_BTN / 2, pp.by + PAD_BTN / 2, d === this.sequence[idx] ? PAL.green : PAL.red, 8);

    if (d !== this.sequence[idx]) {
      this.phase = 'fail';
      this.phaseT = 0;
      this.shakeT = 0.4;
      this.msg = 'Wrong code';
      this.msgT = 1.5;
      this.msgGood = false;
      return;
    }
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

  hitTestPad(mx, my) {
    for (let r = 0; r < PAD_ROWS; r++)
      for (let c = 0; c < PAD_COLS; c++) {
        const d = PAD_LAYOUT[r][c];
        if (d < 0) continue;
        const bx = PAD_X + c * (PAD_BTN + PAD_GAP);
        const by = PAD_Y + r * (PAD_BTN + PAD_GAP);
        if (mx >= bx && mx <= bx + PAD_BTN && my >= by && my <= by + PAD_BTN) return d;
      }
    return -1;
  }

  onDown() {
    if (this.phase !== 'input') return;
    const d = this.hitTestPad(this.mouse.x, this.mouse.y);
    if (d >= 0) this.submitDigit(d);
  }

  onKey(e) {
    const k = e.key;
    if (k >= '0' && k <= '9') this.submitDigit(parseInt(k, 10));
  }

  update(dt) {
    this.phaseT += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.lockPulse = Math.max(0, this.lockPulse - dt * 2);
    this.msgT = Math.max(0, this.msgT - dt);
    for (const d in this.inputFlash) {
      this.inputFlash[d] = Math.max(0, this.inputFlash[d] - dt);
      if (this.inputFlash[d] <= 0) delete this.inputFlash[d];
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vx *= 0.97;
      p.life -= dt; if (p.life <= 0) this.sparks.splice(i, 1);
    }

    if (this.phase === 'show') {
      const cur = this.activeShowDigit();
      if (cur >= 0 && cur !== this.showIdx) {
        this.showIdx = cur;
        sfx.play('keypad', this.sequence[cur]);
      } else if (cur < 0 && this.showIdx >= 0) {
        this.showIdx = -1;
      }
      if (this.phaseT >= this.showDuration()) {
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
    const vx = GW - 240, vy = 100, vw = 180, vh = 240;
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

    for (let i = 0; i < this.roundsCleared; i++) {
      const by = vy + vh - 24 - i * 50;
      ctx.fillStyle = '#1f6b3f'; this.roundRect(ctx, vx + 14, by, vw - 28, 34, 4); ctx.fill();
      ctx.fillStyle = '#2f8d55'; ctx.fillRect(vx + 14, by, vw - 28, 8);
      ctx.fillStyle = PAL.pink; ctx.fillRect(vx + vw / 2 - 6, by, 12, 34);
      this.text(ctx, fmtMoney(this.perRoundValue), vx + vw / 2, by + 17, 11, '#0b2e1c', 'center');
    }

    const doorWidth = vw * (1 - openFrac * 0.85);
    const dg = ctx.createLinearGradient(vx, 0, vx + Math.max(20, doorWidth), 0);
    dg.addColorStop(0, '#525d6a'); dg.addColorStop(1, '#242b33');
    ctx.fillStyle = dg;
    ctx.fillRect(vx, vy, Math.max(20, doorWidth), vh);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, Math.max(20, doorWidth), vh);

    if (openFrac < 1) {
      const hx = vx + doorWidth * 0.6, hy = vy + vh / 2, rr = 22;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 1.5 + openFrac * Math.PI);
      ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke(); }
      ctx.fillStyle = '#b9c4d0'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const lockY = vy + vh + 32;
    for (let i = 0; i < ROUNDS; i++) {
      const lx = vx + (i + 0.5) * vw / ROUNDS;
      const cleared = i < this.roundsCleared;
      const pulse = cleared && this.lockPulse > 0 && i === this.roundsCleared - 1;
      ctx.save();
      if (pulse) { ctx.shadowColor = PAL.green; ctx.shadowBlur = 16; }
      ctx.fillStyle = cleared ? PAL.green : this.rgba(PAL.dim, 0.3);
      ctx.beginPath(); ctx.arc(lx, lockY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (cleared) this.text(ctx, '✓', lx, lockY, 10, '#000', 'center', undefined, '800');
    }
    this.label(ctx, `${this.roundsCleared} / ${ROUNDS} locks`, vx + vw / 2, lockY + 20, 11, PAL.dim, 'center');
    ctx.restore();
  }

  drawPad(ctx) {
    const mx = this.mouse.x, my = this.mouse.y;
    const activeIdx = this.activeShowDigit();
    const activeDigit = activeIdx >= 0 ? this.sequence[activeIdx] : -1;
    const isInput = this.phase === 'input';

    for (let r = 0; r < PAD_ROWS; r++) {
      for (let c = 0; c < PAD_COLS; c++) {
        const d = PAD_LAYOUT[r][c];
        if (d < 0) continue;
        const bx = PAD_X + c * (PAD_BTN + PAD_GAP);
        const by = PAD_Y + r * (PAD_BTN + PAD_GAP);
        const hover = isInput && mx >= bx && mx <= bx + PAD_BTN && my >= by && my <= by + PAD_BTN;
        const showLit = d === activeDigit;
        const inputLit = (this.inputFlash[d] || 0) > 0;

        ctx.save();

        if (showLit) {
          ctx.shadowColor = PAL.gold; ctx.shadowBlur = 24;
          ctx.fillStyle = this.rgba(PAL.gold, 0.35);
          this.roundRect(ctx, bx - 2, by - 2, PAD_BTN + 4, PAD_BTN + 4, 12); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = this.rgba(PAL.gold, 0.25);
        } else if (inputLit) {
          ctx.fillStyle = this.rgba(PAL.green, 0.22);
        } else if (hover) {
          ctx.fillStyle = this.rgba(PAL.gold, 0.14);
        } else {
          ctx.fillStyle = 'rgba(14,10,22,0.72)';
        }

        this.roundRect(ctx, bx, by, PAD_BTN, PAD_BTN, 10); ctx.fill();
        ctx.strokeStyle = showLit ? this.rgba(PAL.gold, 0.9) : hover ? this.rgba(PAL.gold, 0.6) : this.rgba(PAL.gold, 0.15);
        ctx.lineWidth = showLit ? 3 : hover ? 2 : 1.5; ctx.stroke();

        const textColor = showLit ? PAL.gold : hover ? PAL.gold : isInput ? PAL.bone : this.rgba(PAL.bone, 0.5);
        const glowAmt = showLit ? 22 : hover ? 14 : 6;
        this.neon(ctx, `${d}`, bx + PAD_BTN / 2, by + PAD_BTN / 2, 36, textColor, 'center', glowAmt, 2);

        ctx.restore();
      }
    }
  }

  drawInputSlots(ctx) {
    const n = this.sequence.length;
    const slotW = 36, slotGap = 8;
    const totalW = n * slotW + (n - 1) * slotGap;
    const sx = GW / 2 - totalW / 2;
    const sy = PAD_Y + PAD_H + 20;

    for (let i = 0; i < n; i++) {
      const x = sx + i * (slotW + slotGap);
      const filled = i < this.input.length;
      const correct = filled && this.input[i] === this.sequence[i];
      const wrong = filled && !correct;
      const current = i === this.input.length && this.phase === 'input';

      ctx.save();
      const color = wrong ? PAL.red : correct ? PAL.green : current ? PAL.cyan : PAL.dim;
      ctx.fillStyle = this.rgba(color, filled ? 0.18 : current ? 0.1 + Math.sin(this.t * 5) * 0.04 : 0.04);
      this.roundRect(ctx, x, sy, slotW, slotW, 6); ctx.fill();
      ctx.strokeStyle = this.rgba(color, filled ? 0.6 : 0.2); ctx.lineWidth = 1.5; ctx.stroke();

      if (filled) {
        this.neon(ctx, `${this.input[i]}`, x + slotW / 2, sy + slotW / 2, 22, wrong ? PAL.red : PAL.green, 'center', 10, 1);
      } else if (this.phase === 'show') {
        const aidx = this.activeShowDigit();
        if (aidx >= 0 && i <= aidx) {
          this.neon(ctx, `${this.sequence[i]}`, x + slotW / 2, sy + slotW / 2, 22, i === aidx ? PAL.gold : this.rgba(PAL.gold, 0.4), 'center', i === aidx ? 12 : 4, 1);
        }
      }
      ctx.restore();
    }
  }

  draw(ctx) {
    const t = this.t;
    this.backdrop(ctx, PAL.cyan, t);

    ctx.save();
    if (this.shakeT > 0) ctx.translate(Math.sin(t * 60) * this.shakeT * 12, Math.cos(t * 47) * this.shakeT * 6);

    // info panel — top left
    this.panel(ctx, 30, 100, 240, 100, { accent: PAL.gold });
    this.readout(ctx, 50, 112, 'in the hoppers', fmtMoney(this.total), PAL.gold, 'left', 24);
    this.readout(ctx, 50, 156, 'secured so far', fmtMoney(this.bankAmount()), PAL.green, 'left', 24);

    // round indicator
    this.panel(ctx, 30, 220, 240, 46, { accent: PAL.cyan });
    this.label(ctx, `sequence ${this.round} of ${ROUNDS}  ·  ${this.seqLen()} digits`, 150, 236, 11, PAL.cyan, 'center');
    const barW = 200, barX = 50, barY = 252;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.roundRect(ctx, barX, barY, barW, 5, 3); ctx.fill();
    ctx.fillStyle = PAL.cyan;
    this.roundRect(ctx, barX, barY, barW * (this.round / ROUNDS), 5, 3); ctx.fill();

    // phase instruction
    let instruction = '';
    if (this.phase === 'show') instruction = 'watch the keypad';
    else if (this.phase === 'input') instruction = 'enter the code';
    else if (this.phase === 'correct') instruction = 'correct — next sequence';
    else if (this.phase === 'fail') instruction = 'vault lockout — wrong code';
    else if (this.phase === 'win') instruction = 'all sequences cracked!';
    this.label(ctx, instruction, GW / 2, PAD_Y - 20, 14, this.phase === 'fail' ? PAL.red : this.phase === 'win' ? PAL.gold : PAL.bone, 'center');

    this.drawPad(ctx);
    this.drawInputSlots(ctx);
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
    if (this.msgT > 0) this.banner(ctx, this.msg, GH / 2 + 40, this.msgGood ? PAL.green : PAL.red, 30, Math.min(1, this.msgT * 2));
  }
}
