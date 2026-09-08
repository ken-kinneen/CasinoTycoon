// Click Skill: targets appear on a casino table — click them before they vanish.
// Each round a gambler sits down; hit enough targets to win their bet.
// Speed and target size scale with difficulty tier + Poker Face stats.
import { MiniGame, GW, GH, fmtMoney, PAL, SERIF } from './base.js';
import { TYPE_INFO, DIFFICULTY_TIERS } from '../world/customers.js';
import * as sfx from '../audio/sfx.js';

const QUIPS = {
  win: ['"Fast hands. The house approves."', '"Click. Cash. Beautiful."', '"Reflexes of a casino owner."'],
  lose: ['"Too slow. The chips walk."', '"My grandmother clicks faster."', '"Pathetic. They kept their money."'],
  perfect: ['"Every single one. Terrifying."', '"Flawless. The pit boss is impressed."', '"Not a miss. You scare me."'],
};

const ROUND_TIME = { easy: 12, medium: 10, hard: 8 };
const TARGET_COUNT = { easy: 8, medium: 12, hard: 16 };
const TARGET_LIFE = { easy: 2.0, medium: 1.4, hard: 0.9 };
const TARGET_SIZE = { easy: 42, medium: 34, hard: 26 };
const WIN_RATIO = 0.6;

export class ClickSkillGame extends MiniGame {
  constructor(game, players) {
    super('CLICK SKILL');
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
    this.targets = [];
    this.hits = 0;
    this.misses = 0;
    this.spawned = 0;
    this.spawnTimer = 0;
    this.pops = [];
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
    this.countdown = ROUND_TIME[diff];
    this.totalTargets = TARGET_COUNT[diff];
    this.targetLife = TARGET_LIFE[diff] / (st.dealerSpeed || 1);
    this.targetSize = TARGET_SIZE[diff];
    this.hits = 0;
    this.misses = 0;
    this.spawned = 0;
    this.spawnTimer = 0;
    this.targets = [];
    this.pops = [];
  }

  spawnTarget() {
    if (this.spawned >= this.totalTargets) return;
    const margin = 80;
    const x = margin + Math.random() * (GW - margin * 2);
    const y = 140 + Math.random() * (GH - 260);
    const sz = this.targetSize + (Math.random() - 0.5) * 8;

    const shapes = ['circle', 'diamond', 'star'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    const colors = [PAL.gold, PAL.cyan, PAL.pink, PAL.green];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.targets.push({ x, y, size: sz, life: this.targetLife, maxLife: this.targetLife, shape, color, hit: false });
    this.spawned++;
  }

  onDown() {
    if (this.phase !== 'play') return;
    const mx = this.mouse.x, my = this.mouse.y;
    let hitAny = false;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.hit) continue;
      const d = Math.hypot(mx - t.x, my - t.y);
      if (d <= t.size) {
        t.hit = true;
        this.hits++;
        hitAny = true;
        sfx.play('keypad', 1);
        this.pops.push({ x: t.x, y: t.y, t: 0, color: t.color });
        this.burst(t.x, t.y, t.color, 8);
        break;
      }
    }
    if (!hitAny) {
      this.misses++;
    }
  }

  onKey(e) {
    // no keyboard controls for this game
  }

  resolveHand() {
    const needed = Math.ceil(this.totalTargets * WIN_RATIO);
    const hit = this.hits >= needed;
    const perfect = this.hits === this.totalTargets;
    const st = this.game.stats;
    const bet = this.current.bet;

    const mul = perfect ? 2 : 1;
    const amount = hit ? Math.round(bet * st.houseEdge * mul) : bet;
    if (hit) { this.won += amount; this.game.addMoney(amount, 'clickskill'); }
    else { const pay = Math.min(amount, this.game.s.money); this.game.spend(pay); this.lost += pay; }

    const pool = perfect ? QUIPS.perfect : QUIPS[hit ? 'win' : 'lose'];
    this.results.push({ hit, perfect, amount, quip: pool[Math.floor(Math.random() * pool.length)], hits: this.hits, total: this.totalTargets });

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
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const p = this.chips[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; p.vx *= 0.98; p.r += p.vr * dt;
      p.life -= dt; if (p.life <= 0) this.chips.splice(i, 1);
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      this.pops[i].t += dt;
      if (this.pops[i].t > 0.5) this.pops.splice(i, 1);
    }
    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.phase = 'play';
      return;
    }
    if (this.phase === 'play') {
      this.countdown -= dt;

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawned < this.totalTargets) {
        this.spawnTarget();
        const interval = ROUND_TIME[this.current.difficulty] / this.totalTargets;
        this.spawnTimer = interval * (0.6 + Math.random() * 0.8);
      }

      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        if (!t.hit) {
          t.life -= dt;
          if (t.life <= 0) {
            this.targets.splice(i, 1);
          }
        }
      }

      if (this.countdown <= 0 || (this.spawned >= this.totalTargets && this.targets.filter(t => !t.hit).length === 0)) {
        this.resolveHand();
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

  drawTarget(ctx, t) {
    const frac = t.life / t.maxLife;
    const pulse = 1 + Math.sin(this.t * 8 + t.x) * 0.06;
    const sz = t.size * pulse;
    const alpha = frac < 0.3 ? frac / 0.3 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;

    // ring that shrinks as time runs out
    ctx.strokeStyle = this.rgba(t.color, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, sz + 6 + (1 - frac) * 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = this.rgba(t.color, 0.15 + frac * 0.15);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2.5;

    if (t.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(t.x, t.y, sz, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (t.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - sz);
      ctx.lineTo(t.x + sz, t.y);
      ctx.lineTo(t.x, t.y + sz);
      ctx.lineTo(t.x - sz, t.y);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      // star
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? sz : sz * 0.45;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](t.x + Math.cos(a) * r, t.y + Math.sin(a) * r);
        const a2 = ((i + 0.5) * 2 * Math.PI / 5) - Math.PI / 2;
        ctx.lineTo(t.x + Math.cos(a2) * sz * 0.45, t.y + Math.sin(a2) * sz * 0.45);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // timer arc around target
    ctx.strokeStyle = this.rgba(t.color, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, sz + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();

    ctx.restore();
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
    felt.addColorStop(0, '#1a1232'); felt.addColorStop(0.45, '#0e0820'); felt.addColorStop(1, '#06030e');
    ctx.fillStyle = felt; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.clip();
    ctx.globalAlpha = 0.05; ctx.strokeStyle = '#9f8eff'; ctx.lineWidth = 1;
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
    this.neon(ctx, 'CLICK THE TARGETS', cx, GH - 22, 22, PAL.gold, 'center', 0, 6);
    ctx.restore();
  }

  draw(ctx) {
    const t = this.t, cur = this.current;
    ctx.save();
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * this.shakeT * 16, (Math.random() - 0.5) * this.shakeT * 16);

    this.backdrop(ctx, PAL.cyan, t);
    this.drawTable(ctx);

    // gambler info
    const tint = { drunk: PAL.pink, regular: PAL.cyan, sharp: '#b39ddb', whale: PAL.gold }[cur.type] || PAL.cyan;
    this.panel(ctx, 26, 88, 220, 120, { accent: tint });
    this.label(ctx, `round ${this.hand + 1} of ${this.players.length}`, 46, 100, 11, PAL.dim);
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
      // score panel
      this.panel(ctx, GW - 210, 88, 184, 96, { accent: PAL.gold });
      this.label(ctx, 'hits', GW - 190, 108, 10, PAL.dim);
      this.neon(ctx, `${this.hits}`, GW - 190, 136, 32, PAL.green, 'left', 10, 1);
      const needed = Math.ceil(this.totalTargets * WIN_RATIO);
      this.label(ctx, `need ${needed}`, GW - 190, 162, 10, this.hits >= needed ? PAL.green : PAL.dim);

      // countdown timer
      const cdc = this.countdown < 3 ? PAL.red : PAL.gold;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(GW - 80, 136, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = cdc; ctx.lineCap = 'round';
      ctx.shadowColor = cdc; ctx.shadowBlur = this.countdown < 3 ? 20 : 10;
      const total = ROUND_TIME[cur.difficulty];
      ctx.beginPath(); ctx.arc(GW - 80, 136, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, this.countdown / total)); ctx.stroke();
      ctx.restore();
      this.neon(ctx, `${Math.max(0, Math.ceil(this.countdown))}`, GW - 80, 136, 22, cdc, 'center', 10, 1);

      // draw active targets
      for (const tgt of this.targets) {
        if (!tgt.hit) this.drawTarget(ctx, tgt);
      }
    }

    // pop effects for hit targets
    for (const p of this.pops) {
      const a = 1 - p.t / 0.5;
      const scale = 1 + p.t * 3;
      ctx.save();
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.phase === 'intro') {
      const a = Math.min(1, (1.6 - this.phaseT) * 4);
      ctx.save(); ctx.globalAlpha = a;
      this.neon(ctx, `A ${cur.label.toLowerCase()} sits down`, GW / 2, 240, 44, PAL.bone, 'center', 20, 3);
      this.neon(ctx, cur.tierLabel.toUpperCase(), GW / 2, 282, 26, cur.tierColor, 'center', 14, 2);
      const needed = Math.ceil(this.totalTargets * WIN_RATIO);
      this.text(ctx, `They're betting ${fmtMoney(cur.bet)} — click ${needed} of ${this.totalTargets} targets to win.`, GW / 2, 320, 18, PAL.gold, 'center', undefined, '500');
      ctx.restore();
    }

    if (this.phase === 'result') {
      const r = this.results[this.results.length - 1];
      if (r.perfect) {
        this.banner(ctx, `PERFECT!  2x  +${fmtMoney(r.amount)}`, 62, PAL.gold, 42);
      } else {
        this.banner(ctx, r.hit ? `HOUSE WINS  +${fmtMoney(r.amount)}` : `GAMBLER WINS  −${fmtMoney(r.amount)}`, 62, r.hit ? PAL.gold : PAL.red, 38);
      }
      this.label(ctx, `${r.hits} / ${r.total} targets`, GW / 2, 102, 14, PAL.bone, 'center');
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
