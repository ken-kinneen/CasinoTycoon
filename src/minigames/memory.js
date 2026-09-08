// Number Memory: a sequence of numbers flashes on screen, then the player must
// recall them in order. Each round a gambler sits; remember enough to win their
// bet. Sequence length scales with difficulty.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const QUIPS = {
  win: ['"Sharp memory. The house remembers too."', '"Every number. Every dollar."', '"The brain is the real machine."'],
  lose: ['"Forgot already? Shame."', '"Memory like a goldfish. They keep the pot."', '"Wrong. Try counting cards next time."'],
  perfect: ['"Photographic. You terrify me."', '"Perfect recall. The dealers are nervous."', '"Not a single miss. Legendary."'],
};

const SEQ_LENGTH = { easy: 4, medium: 6, hard: 8 };
const SHOW_TIME = { easy: 3.0, medium: 2.5, hard: 2.0 };
const INPUT_TIME = { easy: 10, medium: 8, hard: 6 };
const NUM_ROUNDS = 3;

export class MemoryGame extends MiniGame {
  constructor(game, players) {
    super('NUMBER MEMORY');
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
    this.subRound = 0;
    this.totalCorrect = 0;
    this.totalAttempted = 0;
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
      bet: Math.round(info.bet * st.dealerBet * betScale * tier.betMul),
    };
    this.subRound = 0;
    this.totalCorrect = 0;
    this.totalAttempted = 0;
    this.setupSubRound();
  }

  setupSubRound() {
    const diff = this.current.difficulty;
    const baseLen = SEQ_LENGTH[diff];
    const len = baseLen + this.subRound;
    this.sequence = [];
    for (let i = 0; i < len; i++) {
      this.sequence.push(Math.floor(Math.random() * 10));
    }
    this.showTimer = SHOW_TIME[diff];
    this.inputTimer = INPUT_TIME[diff];
    this.inputTimeTotal = INPUT_TIME[diff];
    this.inputSeq = [];
    this.inputIdx = 0;
    this.subPhase = 'show';
    this.feedback = null;
    this.feedbackT = 0;
    this.correctThisRound = 0;
  }

  onDown() {
    if (this.phase !== 'play' || this.subPhase !== 'input') return;
    const mx = this.mouse.x, my = this.mouse.y;

    // check numpad button hits
    for (let n = 0; n <= 9; n++) {
      const bx = this.numpadX(n), by = this.numpadY(n);
      if (mx >= bx && mx <= bx + 68 && my >= by && my <= by + 68) {
        this.inputNumber(n);
        return;
      }
    }
  }

  onKey(e) {
    if (this.phase !== 'play' || this.subPhase !== 'input') return;
    const n = parseInt(e.key);
    if (!isNaN(n) && n >= 0 && n <= 9) {
      e.preventDefault();
      this.inputNumber(n);
    }
  }

  numpadX(n) {
    if (n === 0) return GW / 2 - 34;
    const col = (n - 1) % 3;
    return GW / 2 - 118 + col * 84;
  }

  numpadY(n) {
    if (n === 0) return 440;
    const row = Math.floor((n - 1) / 3);
    return 200 + row * 80;
  }

  inputNumber(n) {
    sfx.play('keypad', n);
    const expected = this.sequence[this.inputIdx];
    this.inputSeq.push(n);

    if (n === expected) {
      this.correctThisRound++;
      this.inputIdx++;
      this.feedback = { correct: true, num: n };
      this.feedbackT = 0.3;

      if (this.inputIdx >= this.sequence.length) {
        this.totalCorrect += this.correctThisRound;
        this.totalAttempted += this.sequence.length;
        this.advanceSubRound(true);
      }
    } else {
      this.totalCorrect += this.correctThisRound;
      this.totalAttempted += this.sequence.length;
      this.feedback = { correct: false, num: n, expected };
      this.feedbackT = 0.8;
      this.advanceSubRound(false);
    }
  }

  advanceSubRound(success) {
    if (success) {
      this.burst(GW / 2, 300, PAL.gold, 12);
    } else {
      this.burst(GW / 2, 300, PAL.red, 8);
      this.shakeT = 0.3;
    }
    this.subRound++;
    if (this.subRound >= NUM_ROUNDS) {
      setTimeout(() => this.resolveHand(), success ? 600 : 1000);
    } else {
      setTimeout(() => {
        this.setupSubRound();
      }, success ? 600 : 1000);
    }
  }

  resolveHand() {
    const ratio = this.totalAttempted > 0 ? this.totalCorrect / this.totalAttempted : 0;
    const hit = ratio >= 0.5;
    const perfect = ratio === 1;
    const st = this.game.stats;
    const bet = this.current.bet;

    const mul = perfect ? 2 : 1;
    const amount = hit ? Math.round(bet * st.houseEdge * mul) : bet;
    if (hit) { this.won += amount; this.game.addMoney(amount, 'memory'); }
    else { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    const pool = perfect ? QUIPS.perfect : QUIPS[hit ? 'win' : 'lose'];
    this.results.push({ hit, perfect, amount, quip: pool[Math.floor(Math.random() * pool.length)], correct: this.totalCorrect, total: this.totalAttempted });

    if (perfect) {
      sfx.play('bullseye');
      this.burst(GW / 2, 300, PAL.gold, 40);
      this.shakeT = 0.6;
    } else if (hit) {
      sfx.playRandom('happy', 'chuckle', 'ching');
      this.burst(GW / 2, 300, PAL.gold, 28);
      this.shakeT = 0.35;
    } else {
      sfx.playRandom('groan', 'oof', 'frustrate');
      this.burst(GW / 2, 300, PAL.red, 14);
      this.shakeT = 0.5;
    }
    this.phase = 'result';
    this.phaseT = perfect ? 2.6 : 2.0;
  }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt * 1.6);
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
    if (this.phase === 'play' && this.subPhase === 'show') {
      this.showTimer -= dt;
      if (this.showTimer <= 0) {
        this.subPhase = 'input';
      }
    }
    if (this.phase === 'play' && this.subPhase === 'input') {
      this.inputTimer -= dt;
      if (this.inputTimer <= 0) {
        this.inputTimer = 0;
        this.totalCorrect += this.correctThisRound;
        this.totalAttempted += this.sequence.length;
        this.feedback = { correct: false, num: -1, expected: this.sequence[this.inputIdx] };
        this.feedbackT = 0.8;
        this.advanceSubRound(false);
      }
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

  drawTable(ctx) {
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
    this.neon(ctx, 'REMEMBER THE NUMBERS', cx, GH - 22, 22, PAL.gold, 'center', 0, 6);
    ctx.restore();
  }

  drawSequence(ctx) {
    const seq = this.sequence;
    const totalW = seq.length * 60 + (seq.length - 1) * 12;
    const sx = GW / 2 - totalW / 2;
    const sy = 160;

    for (let i = 0; i < seq.length; i++) {
      const x = sx + i * 72;
      const revealed = this.subPhase === 'show' || i < this.inputIdx;
      const current = this.subPhase === 'input' && i === this.inputIdx;
      const wrong = this.feedback && !this.feedback.correct && i === this.inputIdx && this.feedbackT > 0;

      ctx.save();
      if (current) {
        const pulse = 0.8 + Math.sin(this.t * 6) * 0.2;
        ctx.shadowColor = PAL.gold;
        ctx.shadowBlur = 12 * pulse;
      }

      // card background
      if (wrong) {
        ctx.fillStyle = this.rgba(PAL.red, 0.3);
      } else if (revealed) {
        ctx.fillStyle = 'rgba(20,16,36,0.9)';
      } else {
        ctx.fillStyle = current ? 'rgba(30,24,50,0.9)' : 'rgba(14,10,24,0.7)';
      }
      this.roundRect(ctx, x, sy, 56, 72, 8);
      ctx.fill();

      // card border
      ctx.strokeStyle = wrong ? PAL.red : revealed ? this.rgba(PAL.cyan, 0.6) : current ? this.rgba(PAL.gold, 0.6) : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = current ? 2.5 : 1.5;
      ctx.stroke();

      // number
      if (revealed) {
        const col = wrong ? PAL.red : PAL.cyan;
        this.neon(ctx, `${seq[i]}`, x + 28, sy + 36, 36, col, 'center', 14, 1);
      } else if (current) {
        this.neon(ctx, '?', x + 28, sy + 36, 36, PAL.gold, 'center', 10, 1);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.arc(x + 28, sy + 36, 4, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  drawNumpad(ctx) {
    const mx = this.mouse.x, my = this.mouse.y;

    for (let n = 0; n <= 9; n++) {
      const bx = this.numpadX(n), by = this.numpadY(n);
      const hover = mx >= bx && mx <= bx + 68 && my >= by && my <= by + 68;

      ctx.save();
      ctx.fillStyle = hover ? this.rgba(PAL.gold, 0.25) : 'rgba(20,16,36,0.7)';
      this.roundRect(ctx, bx, by, 68, 68, 10);
      ctx.fill();
      ctx.strokeStyle = hover ? PAL.gold : this.rgba(PAL.bone, 0.2);
      ctx.lineWidth = hover ? 2 : 1;
      ctx.stroke();
      this.neon(ctx, `${n}`, bx + 34, by + 34, 32, hover ? PAL.gold : PAL.bone, 'center', hover ? 14 : 6, 1);
      ctx.restore();
    }
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

    if (this.phase === 'play') {
      // sub-round indicator
      this.panel(ctx, GW - 180, 88, 154, 56, { accent: PAL.gold });
      this.label(ctx, 'sequence', GW - 160, 106, 10, PAL.dim);
      this.neon(ctx, `${this.subRound + 1} / ${NUM_ROUNDS}`, GW - 160, 130, 24, PAL.gold, 'left', 10, 1);

      if (this.subPhase === 'show') {
        // show the sequence
        this.drawSequence(ctx);

        // countdown bar
        const total = SHOW_TIME[cur.difficulty];
        const frac = this.showTimer / total;
        this.timerBar(ctx, frac, PAL.cyan, 142);

        ctx.save(); ctx.globalAlpha = 0.65 + Math.sin(t * 4) * 0.35;
        this.label(ctx, 'memorize the numbers', GW / 2, 260, 14, PAL.bone, 'center');
        ctx.restore();
      } else if (this.subPhase === 'input') {
        this.drawSequence(ctx);
        this.drawNumpad(ctx);

        const frac = this.inputTimer / this.inputTimeTotal;
        this.timerBar(ctx, frac, PAL.gold, 142);

        ctx.save(); ctx.globalAlpha = 0.5;
        this.label(ctx, 'click or type the numbers in order', GW / 2, 530, 11, PAL.bone, 'center');
        ctx.restore();
      }

      // feedback flash
      if (this.feedback && this.feedbackT > 0) {
        const a = Math.min(1, this.feedbackT * 3);
        if (this.feedback.correct) {
          ctx.save(); ctx.globalAlpha = a * 0.15;
          ctx.fillStyle = PAL.green; ctx.fillRect(0, 0, GW, GH);
          ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha = a * 0.2;
          ctx.fillStyle = PAL.red; ctx.fillRect(0, 0, GW, GH);
          ctx.restore();
        }
      }
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      this.neon(ctx, `A ${cur.label.toLowerCase()} sits down`, GW / 2, 240, 44, PAL.bone, 'center', 20, 3);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 282, 26, cur.tierColor, 'center', 14, 2);
      this.text(ctx, `They're betting ${fmtMoney(cur.bet)} — remember the numbers to win.`, GW / 2, 320, 18, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.perfect) {
        this.banner(ctx, `PERFECT MEMORY!  2x  +${fmtMoney(r.amount)}`, 62, PAL.gold, 42);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 62, r.hit ? PAL.gold : PAL.red, 38);
      }
      this.label(ctx, `${r.correct} / ${r.total} correct`, GW / 2, 102, 14, PAL.bone, 'center');
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
