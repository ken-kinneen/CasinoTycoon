// Vault Crack: memorize increasingly long number sequences to crack the vault.
// Each round a gambler sits; crack enough sequences to win their bet.
// Sequence length scales with difficulty.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const QUIPS = {
  win: ['"Vault cracked. The house keeps everything."', '"Safe opened. Money secured."', '"The combination was child\'s play."'],
  lose: ['"Wrong code. They walk with the cash."', '"Lockout. How embarrassing."', '"The vault wins this round."'],
  perfect: ['"Every lock, first try. Terrifying."', '"Flawless cracking. The safe weeps."', '"You belong in a heist movie."'],
};

const ROUNDS = { easy: 3, medium: 4, hard: 5 };
const START_LEN = { easy: 2, medium: 3, hard: 3 };
const SHOW_BASE = 2.4;
const SHOW_PER_DIGIT = 0.5;
const DIGIT_SIZE = 68;
const PAD_COLS = 5;
const PAD_BTN = 64;
const PAD_GAP = 10;
const PAD_Y = GH - 160;

function genSequence(len) {
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(Math.floor(Math.random() * 10));
  return seq;
}

export class CashRunGame extends MiniGame {
  constructor(game, players) {
    super('VAULT CRACK');
    this.game = game;
    this.players = players.length ? players.slice(0, 3) : [{ type: 'regular', difficulty: 'medium' }];
    this.hand = 0;
    this.results = [];
    this.won = 0;
    this.lost = 0;
    this.phase = 'intro';
    this.phaseT = 1.6;
    this.chips = [];
    this.shakeT = 0;
    this.setupHand();
  }

  burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260;
      this.chips.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10, life: 0.5 + Math.random() * 0.4, max: 0.9, color });
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
    this.numRounds = ROUNDS[diff];
    this.subRound = 0;
    this.roundsCleared = 0;
    this.lockPulse = 0;
    this.setupSubRound();
  }

  setupSubRound() {
    const diff = this.current.difficulty;
    const len = START_LEN[diff] + this.subRound;
    this.sequence = genSequence(len);
    this.input = [];
    this.subPhase = 'show';
    this.showTimer = SHOW_BASE + len * SHOW_PER_DIGIT;
    this.digitReveal = this.sequence.map(() => 0);
    this.subPhaseT = 0;
    this.feedback = null;
    this.feedbackT = 0;
  }

  get padW() { return PAD_COLS * (PAD_BTN + PAD_GAP) - PAD_GAP; }
  get padX() { return GW / 2 - this.padW / 2; }

  onDown() {
    if (this.phase !== 'play' || this.subPhase !== 'input') return;
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
    if (this.phase !== 'play' || this.subPhase !== 'input') return;
    const n = parseInt(e.key);
    if (!isNaN(n) && n >= 0 && n <= 9) {
      e.preventDefault();
      this.submitDigit(n);
    }
  }

  submitDigit(d) {
    const idx = this.input.length;
    this.input.push(d);
    sfx.play('keypad', d);

    if (d !== this.sequence[idx]) {
      this.feedback = { correct: false, num: d, expected: this.sequence[idx] };
      this.feedbackT = 0.8;
      this.shakeT = 0.35;
      this.burst(GW / 2, 260, PAL.red, 16);
      this.advanceSubRound(false);
      return;
    }

    this.feedback = { correct: true, num: d };
    this.feedbackT = 0.25;
    const slotW = DIGIT_SIZE + 14;
    const startX = GW / 2 - (this.sequence.length * slotW - 14) / 2;
    this.burst(startX + idx * slotW + DIGIT_SIZE / 2, 260, PAL.green, 8);

    if (this.input.length === this.sequence.length) {
      this.roundsCleared++;
      this.lockPulse = 1;
      this.burst(GW / 2, 260, PAL.gold, 20);
      this.advanceSubRound(true);
    }
  }

  advanceSubRound(success) {
    this.subRound++;
    if (!success || this.subRound >= this.numRounds) {
      setTimeout(() => this.resolveHand(success && this.subRound >= this.numRounds), success ? 600 : 900);
    } else {
      setTimeout(() => this.setupSubRound(), 700);
    }
  }

  resolveHand(allCleared) {
    const st = this.game.stats;
    const bet = this.current.bet;
    const hit = this.roundsCleared >= Math.ceil(this.numRounds / 2);
    const perfect = allCleared;

    const mul = perfect ? 2 : 1;
    const amount = hit ? Math.round(bet * st.houseEdge * mul) : bet;
    if (hit) { this.won += amount; this.game.addMoney(amount, 'vault'); }
    else { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    const pool = perfect ? QUIPS.perfect : QUIPS[hit ? 'win' : 'lose'];
    this.results.push({
      hit, perfect, amount,
      quip: pool[Math.floor(Math.random() * pool.length)],
      cleared: this.roundsCleared, total: this.numRounds,
    });

    if (perfect) {
      sfx.play('bullseye');
      this.burst(GW / 2, 300, PAL.gold, 40);
      this.shakeT = 0.6;
    } else if (hit) {
      sfx.playRandom('happy', 'chuckle', 'ching');
      this.burst(GW / 2, 300, PAL.gold, 24);
      this.shakeT = 0.3;
    } else {
      sfx.playRandom('groan', 'oof', 'frustrate');
      this.burst(GW / 2, 300, PAL.red, 14);
      this.shakeT = 0.45;
    }
    this.phase = 'result';
    this.phaseT = perfect ? 2.6 : 2.0;
  }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt * 1.6);
    this.lockPulse = Math.max(0, this.lockPulse - dt * 2);
    this.feedbackT = Math.max(0, this.feedbackT - dt);
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const p = this.chips[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; p.vx *= 0.98; p.r += p.vr * dt;
      p.life -= dt; if (p.life <= 0) this.chips.splice(i, 1);
    }
    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.phase = 'play';
      return;
    }
    if (this.phase === 'play') {
      this.subPhaseT += dt;
      if (this.subPhase === 'show') {
        const dur = SHOW_BASE + this.sequence.length * SHOW_PER_DIGIT;
        for (let i = 0; i < this.digitReveal.length; i++) {
          const start = 0.3 + i * SHOW_PER_DIGIT * 0.7;
          this.digitReveal[i] = Math.min(1, Math.max(0, (this.subPhaseT - start) / 0.3));
        }
        if (this.subPhaseT >= dur) {
          this.subPhase = 'input';
          this.subPhaseT = 0;
          this.input = [];
        }
      }
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

  // ---- drawing ----

  drawVault(ctx, t) {
    const vx = GW - 210, vy = 78, vw = 170, vh = 220;
    const openFrac = this.roundsCleared / this.numRounds;

    ctx.save();
    ctx.fillStyle = '#0b0910';
    this.roundRect(ctx, vx - 16, vy - 16, vw + 32, vh + 32, 8); ctx.fill();
    const steel = ctx.createLinearGradient(vx - 16, vy, vx + vw + 16, vy);
    steel.addColorStop(0, '#2a3038'); steel.addColorStop(0.4, '#48525e'); steel.addColorStop(0.62, '#333b45'); steel.addColorStop(1, '#1e242b');
    ctx.fillStyle = steel;
    this.roundRect(ctx, vx - 10, vy - 10, vw + 20, vh + 20, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5; ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const ry = vy - 2 + i * (vh + 4) / 4;
      ctx.fillStyle = '#5d6874';
      ctx.beginPath(); ctx.arc(vx - 6, ry, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(vx + vw + 6, ry, 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#05040a'; ctx.fillRect(vx, vy, vw, vh);
    const glow = ctx.createLinearGradient(0, vy, 0, vy + vh);
    glow.addColorStop(0, this.rgba(PAL.gold, 0.12)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(vx, vy, vw, vh);

    const shelves = this.roundsCleared;
    for (let i = 0; i < shelves; i++) {
      const by = vy + vh - 22 - i * 38;
      ctx.fillStyle = '#1f6b3f'; this.roundRect(ctx, vx + 14, by, vw - 28, 26, 4); ctx.fill();
      ctx.fillStyle = '#2f8d55'; ctx.fillRect(vx + 14, by, vw - 28, 6);
      ctx.fillStyle = PAL.pink; ctx.fillRect(vx + vw / 2 - 5, by, 10, 26);
    }

    const doorWidth = vw * (1 - openFrac * 0.85);
    const dg = ctx.createLinearGradient(vx, 0, vx + Math.max(16, doorWidth), 0);
    dg.addColorStop(0, '#525d6a'); dg.addColorStop(1, '#242b33');
    ctx.fillStyle = dg;
    ctx.fillRect(vx, vy, Math.max(16, doorWidth), vh);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, Math.max(16, doorWidth), vh);

    if (openFrac < 1) {
      const hx = vx + doorWidth * 0.6, hy = vy + vh / 2, rr = 20;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 1.5 + openFrac * Math.PI);
      ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke(); }
      ctx.fillStyle = '#b9c4d0'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // lock indicators
    const lockY = vy + vh + 28;
    for (let i = 0; i < this.numRounds; i++) {
      const lx = vx + (i + 0.5) * vw / this.numRounds;
      const cleared = i < this.roundsCleared;
      const glow2 = cleared && this.lockPulse > 0 && i === this.roundsCleared - 1;
      ctx.save();
      if (glow2) { ctx.shadowColor = PAL.green; ctx.shadowBlur = 14; }
      ctx.fillStyle = cleared ? PAL.green : this.rgba(PAL.dim, 0.3);
      ctx.beginPath(); ctx.arc(lx, lockY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (cleared) {
        this.text(ctx, '✓', lx, lockY, 10, '#000', 'center', undefined, '800');
      }
    }
    ctx.restore();
  }

  drawSequence(ctx) {
    const seq = this.sequence;
    const totalSlots = seq.length;
    const slotW = DIGIT_SIZE + 14;
    const startX = GW / 2 - (totalSlots * slotW - 14) / 2;
    const cy = 260;

    for (let i = 0; i < totalSlots; i++) {
      const sx = startX + i * slotW;
      ctx.save();

      if (this.subPhase === 'show') {
        const reveal = this.digitReveal[i] || 0;
        ctx.fillStyle = this.rgba(PAL.gold, 0.06 + reveal * 0.1);
        this.roundRect(ctx, sx, cy - DIGIT_SIZE / 2, DIGIT_SIZE, DIGIT_SIZE, 8); ctx.fill();
        ctx.strokeStyle = this.rgba(PAL.gold, 0.2 + reveal * 0.4); ctx.lineWidth = 1.5; ctx.stroke();
        if (reveal > 0.1) {
          ctx.globalAlpha = reveal;
          this.neon(ctx, `${seq[i]}`, sx + DIGIT_SIZE / 2, cy, DIGIT_SIZE * 0.65, PAL.gold, 'center', 6, 2);
        }
      } else {
        const filled = i < this.input.length;
        const correct = filled && this.input[i] === seq[i];
        const wrong = filled && !correct;
        const current = i === this.input.length && this.subPhase === 'input';

        const bgAlpha = current ? 0.14 + Math.sin(this.t * 4) * 0.04 : filled ? 0.12 : 0.04;
        const borderColor = wrong ? PAL.red : correct ? PAL.green : current ? PAL.cyan : PAL.dim;

        ctx.fillStyle = this.rgba(wrong ? PAL.red : correct ? PAL.green : PAL.gold, bgAlpha);
        this.roundRect(ctx, sx, cy - DIGIT_SIZE / 2, DIGIT_SIZE, DIGIT_SIZE, 8); ctx.fill();
        ctx.strokeStyle = this.rgba(borderColor, current ? 0.7 : 0.35); ctx.lineWidth = 1.5; ctx.stroke();

        if (filled) {
          const color = wrong ? PAL.red : PAL.green;
          this.neon(ctx, `${this.input[i]}`, sx + DIGIT_SIZE / 2, cy, DIGIT_SIZE * 0.65, color, 'center', 4, 2);
        } else if (current) {
          ctx.globalAlpha = 0.4 + Math.sin(this.t * 5) * 0.2;
          this.text(ctx, '?', sx + DIGIT_SIZE / 2, cy, 30, PAL.cyan, 'center');
        } else {
          this.text(ctx, '·', sx + DIGIT_SIZE / 2, cy, 28, this.rgba(PAL.dim, 0.3), 'center');
        }
      }
      ctx.restore();
    }
  }

  drawPad(ctx) {
    if (this.subPhase !== 'input') return;
    const mx = this.mouse.x, my = this.mouse.y;
    for (let i = 0; i < 10; i++) {
      const col = i % PAD_COLS, row = Math.floor(i / PAD_COLS);
      const bx = this.padX + col * (PAD_BTN + PAD_GAP);
      const by = PAD_Y + row * (PAD_BTN + PAD_GAP);
      const hover = mx >= bx && mx <= bx + PAD_BTN && my >= by && my <= by + PAD_BTN;

      ctx.save();
      ctx.fillStyle = hover ? this.rgba(PAL.gold, 0.15) : 'rgba(14,10,22,0.65)';
      this.roundRect(ctx, bx, by, PAD_BTN, PAD_BTN, 8); ctx.fill();
      ctx.strokeStyle = hover ? this.rgba(PAL.gold, 0.5) : this.rgba(PAL.gold, 0.15);
      ctx.lineWidth = hover ? 2 : 1; ctx.stroke();
      this.neon(ctx, `${i}`, bx + PAD_BTN / 2, by + PAD_BTN / 2, 28, hover ? PAL.gold : PAL.bone, 'center', hover ? 4 : 0, 1);
      ctx.restore();
    }
  }

  draw(ctx) {
    const t = this.t, cur = this.current;
    ctx.save();
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * this.shakeT * 14, (Math.random() - 0.5) * this.shakeT * 8);

    this.backdrop(ctx, PAL.cyan, t);

    // gambler info
    const tint = { drunk: PAL.pink, regular: PAL.cyan, sharp: '#b39ddb', whale: PAL.gold }[cur.type] || PAL.cyan;
    this.panel(ctx, 26, 78, 240, 90, { accent: tint });
    this.label(ctx, `hand ${this.hand + 1} of ${this.players.length}`, 46, 90, 11, PAL.dim);
    this.text(ctx, `${cur.label.toUpperCase()} GAMBLER`, 46, 112, 17, tint, 'left', SERIF, 'bold');
    this.label(ctx, 'bet', 46, 132, 10, PAL.dim);
    this.text(ctx, fmtMoney(cur.bet), 46, 150, 20, PAL.green, 'left', SERIF, 'bold');
    this.text(ctx, cur.tierLabel.toUpperCase(), 170, 150, 13, cur.tierColor, 'left', SERIF, '600');

    // sequence progress
    if (this.phase === 'play') {
      this.panel(ctx, 26, 180, 240, 36, { accent: PAL.cyan });
      this.label(ctx, `sequence ${this.subRound + 1} of ${this.numRounds}`, 146, 192, 11, PAL.cyan, 'center');
      const barW = 200, barX = 46, barY = 206;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.roundRect(ctx, barX, barY, barW, 5, 3); ctx.fill();
      ctx.fillStyle = PAL.cyan;
      this.roundRect(ctx, barX, barY, barW * ((this.subRound + 1) / this.numRounds), 5, 3); ctx.fill();
    }

    // vault
    this.drawVault(ctx, t);

    if (this.phase === 'play') {
      // phase instruction
      let instruction = '';
      if (this.subPhase === 'show') instruction = 'memorize the code';
      else if (this.subPhase === 'input') instruction = 'enter the code — click or type';
      ctx.save(); ctx.globalAlpha = 0.7;
      this.label(ctx, instruction, GW / 2, 200, 12, PAL.bone, 'center');
      ctx.restore();

      this.drawSequence(ctx);
      this.drawPad(ctx);
    }

    // feedback flash
    if (this.feedback && this.feedbackT > 0) {
      const a = Math.min(1, this.feedbackT * 3);
      ctx.save(); ctx.globalAlpha = a * 0.15;
      ctx.fillStyle = this.feedback.correct ? PAL.green : PAL.red;
      ctx.fillRect(0, 0, GW, GH);
      ctx.restore();
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(4,3,8,0.55)';
      this.roundRect(ctx, GW / 2 - 300, 220, 600, 140, 12); ctx.fill();
      this.neon(ctx, `A ${cur.label.toLowerCase()} sits down`, GW / 2, 260, 40, PAL.bone, 'center', 6, 2);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 296, 22, cur.tierColor, 'center', 4, 2);
      this.text(ctx, `Betting ${fmtMoney(cur.bet)} — crack the vault to win.`, GW / 2, 330, 16, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.perfect) {
        this.banner(ctx, `VAULT CRACKED!  2x  +${fmtMoney(r.amount)}`, 62, PAL.gold, 36);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 62, r.hit ? PAL.gold : PAL.red, 32);
      }
      this.label(ctx, `${r.cleared} / ${r.total} locks cracked`, GW / 2, 102, 13, PAL.bone, 'center');
      ctx.save(); ctx.font = `italic 17px ${SERIF}`; ctx.fillStyle = PAL.bone; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r.quip, GW / 2, 540); ctx.restore();
    }

    // flying chips
    ctx.save();
    for (const p of this.chips) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 8 * Math.abs(Math.cos(p.r)) + 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-8, -1, 16, 2);
      ctx.restore();
    }
    ctx.restore();

    // scoreline
    this.vignette(ctx, 0.4);
    ctx.fillStyle = 'rgba(4,3,8,0.7)'; ctx.fillRect(0, 0, GW, 62);
    ctx.strokeStyle = this.rgba(PAL.gold, 0.2); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(GW, 62); ctx.stroke();
    this.readout(ctx, 30, 20, 'house took', fmtMoney(this.won), PAL.green, 'left', 26);
    this.readout(ctx, GW - 30, 20, 'paid out', fmtMoney(this.lost), this.lost ? PAL.red : PAL.dim, 'right', 26);
    ctx.restore();
  }
}
