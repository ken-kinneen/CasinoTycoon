// Advertising: Operation-style. Guide an ad card from your hand into a
// passer-by's pocket through a winding gap without touching the fabric.
// One attempt per person — succeed or fail, then back to the street.
// Layout: left panel = character portrait + stats, right = clean game area.
import * as THREE from 'three';
import { MiniGame, GW, GH, PAL } from './base.js';
import { DIFFICULTY_TIERS } from '../world/customers.js';
import { makeOwner } from '../world/people.js';
import { quip } from '../ui/hud.js';

const LEFT_W = 280;
const GAME_X = LEFT_W + 16;
const GAME_W = GW - GAME_X - 16;
const GAME_Y = 16;
const GAME_H = GH - 32;

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
  constructor(game, victim) {
    super('SLIP THE AD');
    this.game = game;
    this.who = victim.name;
    this.markDifficulty = victim.difficulty;
    this.markTier = DIFFICULTY_TIERS[victim.difficulty];
    this.cardW = 15.5;
    this.cardH = 9.5;
    this.halfWidth = (26 + this.cardW) * game.stats.cardWidth * this.markTier.channelMul;
    this.holding = false;
    this.done = false;
    this.resultTimer = 0;
    this.success = false;
    this.flash = 0;
    this.msg = ''; this.msgT = 0; this.msgGood = true;
    this.sparks = [];
    this.pop = 0;
    this.buildPath();

    this._init3DPreview();
  }

  _init3DPreview() {
    const PW = 260, PH = 300;
    this._pvCanvas3D = document.createElement('canvas');
    this._pvCanvas3D.width = PW; this._pvCanvas3D.height = PH;
    this._pvRenderer = new THREE.WebGLRenderer({ canvas: this._pvCanvas3D, alpha: true, antialias: true });
    this._pvRenderer.setSize(PW, PH);
    this._pvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._pvRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._pvRenderer.toneMappingExposure = 1.0;

    this._pvScene = new THREE.Scene();
    this._pvScene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffd080, 2.0);
    key.position.set(2, 3, 3);
    this._pvScene.add(key);
    const rim = new THREE.DirectionalLight(0xff2e88, 0.6);
    rim.position.set(-2, 1, -2);
    this._pvScene.add(rim);
    const fill = new THREE.DirectionalLight(0x38e8ff, 0.3);
    fill.position.set(-1, 2, 1);
    this._pvScene.add(fill);

    this._pvCamera = new THREE.PerspectiveCamera(30, PW / PH, 0.1, 100);
    this._pvCamera.position.set(0, 1.0, 4.8);
    this._pvCamera.lookAt(0, 0.8, 0);

    this._pvModel = makeOwner(this.game.s.skills, this.game.wardrobeMap());
    this._pvModel.rotation.y = 0.3;
    this._pvScene.add(this._pvModel);

    this._pvAngle = 0.3;
    this._pvRaycaster = new THREE.Raycaster();
    this._pvReactions = [];

    this._onClickBound = (e) => this._onPlayerClick(e);
    this.canvas.addEventListener('click', this._onClickBound);
  }

  _onPlayerClick(e) {
    if (!this._pvModel) return;
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * GW / rect.width;
    const canvasY = (e.clientY - rect.top) * GH / rect.height;

    const pvX = 10, pvY = 80;
    const PW = 260, PH = 300;
    if (canvasX < pvX || canvasX > pvX + PW || canvasY < pvY || canvasY > pvY + PH) return;

    const mouse = new THREE.Vector2(
      ((canvasX - pvX) / PW) * 2 - 1,
      -(((canvasY - pvY) / PH) * 2 - 1)
    );
    this._pvRaycaster.setFromCamera(mouse, this._pvCamera);
    const hits = this._pvRaycaster.intersectObjects(this._pvModel.children, true);
    if (!hits.length) return;

    const hitPart = 'body';

    const QUIPS = [
      "Hey, I'm working here!", "Quit it!", "Not now!", "Focus!",
      "Stop poking me.", "What?", "Easy, pal.", "Ow!", "Rude.",
      "I'm trying to concentrate.", "Hands off!", "Do you mind?",
    ];
    quip(QUIPS[Math.floor(Math.random() * QUIPS.length)], 3000);
    this._pvReactions.push({ part: hitPart, t: 0, duration: 0.5 });
  }

  _applyReactions(dt) {
    if (!this._pvModel) return;
    const u = this._pvModel.userData;
    for (let i = this._pvReactions.length - 1; i >= 0; i--) {
      const r = this._pvReactions[i];
      r.t += dt;
      const p = Math.min(r.t / r.duration, 1);
      const wave = Math.sin(p * Math.PI * 4) * (1 - p);
      const part = u[r.part === 'body' ? 'body' : r.part];
      if (!part) { this._pvReactions.splice(i, 1); continue; }

      switch (r.part) {
        case 'head': part.rotation.z = wave * 0.4; part.rotation.x = wave * 0.15; break;
        case 'armL': part.rotation.x = wave * -1.2; part.rotation.z = wave * 0.3; break;
        case 'armR': part.rotation.x = wave * -1.2; part.rotation.z = wave * -0.3; break;
        case 'legL': part.rotation.x = wave * 0.8; break;
        case 'legR': part.rotation.x = wave * 0.8; break;
        case 'body': {
          const leg = u.legR || u.legL;
          if (leg) leg.rotation.x = wave * -1.0;
          break;
        }
      }

      if (p >= 1) {
        part.rotation.x = 0; part.rotation.z = 0;
        this._pvReactions.splice(i, 1);
      }
    }
  }

  _dispose3DPreview() {
    if (this._pvRenderer) {
      this._pvRenderer.dispose();
      this._pvRenderer = null;
    }
    if (this._onClickBound) {
      this.canvas.removeEventListener('click', this._onClickBound);
      this._onClickBound = null;
    }
    this._pvScene = null;
    this._pvModel = null;
  }

  finish(result) {
    this._dispose3DPreview();
    super.finish(result);
  }

  buildPath() {
    const margin = 40;
    const spanX = (GAME_W - margin * 2) * 0.75;
    const spanY = (GAME_H - margin * 2) * 0.75;
    const ox = GAME_X + margin + (GAME_W - margin * 2 - spanX) / 2;
    const oy = GAME_Y + GAME_H - margin;
    const pts = [{ x: ox + 20, y: oy }];
    const baseN = 2 + Math.floor(Math.random() * 3);
    const n = this.markDifficulty === 'hard' ? baseN + 2 : this.markDifficulty === 'easy' ? Math.max(2, baseN - 1) : baseN;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const wobble = this.markDifficulty === 'hard' ? 105 : this.markDifficulty === 'easy' ? 60 : 82;
      pts.push({
        x: ox + t * spanX + (Math.random() - 0.5) * wobble,
        y: oy - t * spanY + (Math.random() - 0.5) * (wobble * 1.2),
      });
    }
    pts.push({ x: ox + spanX - 20 + Math.random() * 25, y: oy - spanY + 10 + Math.random() * 30 });
    this.path = catmull(pts);
    this.start = this.path[0];
    this.end = this.path[this.path.length - 1];
  }

  distToPath(x, y) {
    let best = Infinity;
    for (const p of this.path) { const d = Math.hypot(p.x - x, p.y - y); if (d < best) best = d; }
    return best;
  }

  onDown() {
    if (!this.done && !this.holding && Math.hypot(this.mouse.x - this.start.x, this.mouse.y - this.start.y) < 40) this.holding = true;
  }

  burst(x, y, color, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + Math.random() * 0.4, max: 0.9, color });
    }
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 3);
    this.msgT = Math.max(0, this.msgT - dt);
    this.pop = Math.max(0, this.pop - dt * 2.5);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.97;
      p.life -= dt; if (p.life <= 0) this.sparks.splice(i, 1);
    }

    if (this._pvModel && this._pvRenderer) {
      this._pvAngle += 0.008;
      this._pvModel.rotation.y = this._pvAngle;
      const u = this._pvModel.userData;
      if (u && u.head) u.head.rotation.y = Math.sin(this.t * 0.7) * 0.2;
      this._applyReactions(dt);
      this._pvRenderer.render(this._pvScene, this._pvCamera);
    }

    if (this.done) {
      this.resultTimer -= dt;
      if (this.resultTimer <= 0) this.finish({ deposited: this.success ? 1 : 0, busted: this.success ? 0 : 1 });
      return;
    }
    if (this.holding) {
      const mx = this.mouse.x, my = this.mouse.y;
      const cw = this.cardW, ch = this.cardH;
      const worst = Math.max(
        this.distToPath(mx - cw, my - ch),
        this.distToPath(mx + cw, my - ch),
        this.distToPath(mx - cw, my + ch),
        this.distToPath(mx + cw, my + ch),
      );
      if (Math.hypot(mx - this.end.x, my - this.end.y) < 22) {
        this.success = true; this.done = true; this.resultTimer = 1.8;
        this.msg = `Card slipped in.`; this.msgT = 2; this.msgGood = true;
        this.pop = 1; this.burst(this.end.x, this.end.y, PAL.green, 24);
      } else if (worst > this.halfWidth - 6) {
        this.success = false; this.done = true; this.resultTimer = 1.8;
        this.flash = 1; this.msg = `They felt that.`; this.msgT = 2; this.msgGood = false;
        this.burst(mx, my, PAL.red, 16);
      }
    }
  }

  /** Left panel: 3D player model + mark info */
  drawLeftPanel(ctx) {
    const t = this.t;
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,14,0.92)';
    this.roundRect(ctx, 8, 8, LEFT_W - 16, GH - 16, 12); ctx.fill();
    ctx.strokeStyle = this.rgba(this.markTier.color, 0.25); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const spot = ctx.createRadialGradient(LEFT_W / 2, 60, 10, LEFT_W / 2, 180, 200);
    spot.addColorStop(0, 'rgba(255,226,168,0.08)'); spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(8, 8, LEFT_W - 16, GH - 16);
    ctx.restore();

    if (this._pvCanvas3D) {
      ctx.drawImage(this._pvCanvas3D, 10, 80, 260, 300);
    }

    this.label(ctx, 'you', LEFT_W / 2, 70, 10, PAL.dim, 'center');

    this.panel(ctx, 20, 395, LEFT_W - 40, 90, { accent: this.markTier.color, corner: 12, r: 8 });
    this.label(ctx, 'the mark', LEFT_W / 2, 413, 10, PAL.dim, 'center');
    this.neon(ctx, this.who, LEFT_W / 2, 437, 20, PAL.gold, 'center', 10, 1);
    ctx.save();
    const bw = 66, bx = LEFT_W / 2 - bw / 2;
    ctx.fillStyle = this.rgba(this.markTier.color, 0.18);
    this.roundRect(ctx, bx, 453, bw, 20, 4); ctx.fill();
    ctx.strokeStyle = this.rgba(this.markTier.color, 0.6); ctx.lineWidth = 1; ctx.stroke();
    this.label(ctx, this.markTier.label, LEFT_W / 2, 463, 10, this.markTier.color, 'center');
    ctx.restore();

    this.panel(ctx, 20, 499, LEFT_W - 40, 68, { accent: PAL.gold, corner: 10, r: 8 });
    this.label(ctx, 'channel', 40, 523, 10, PAL.dim);
    const chanLabel = this.markDifficulty === 'easy' ? 'Wide' : this.markDifficulty === 'hard' ? 'Tight' : 'Normal';
    this.text(ctx, chanLabel, 40, 543, 22, this.markTier.color, 'left', undefined, 'bold');

    ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2;
    this.label(ctx, 'esc to cancel', LEFT_W / 2, GH - 22, 9, PAL.dim, 'center');
    ctx.restore();
  }

  /** Right game area: clean field with channel */
  drawGameArea(ctx) {
    const t = this.t;

    // game area background
    ctx.save();
    const bg = ctx.createRadialGradient(GAME_X + GAME_W / 2, GAME_Y + GAME_H * 0.45, 30, GAME_X + GAME_W / 2, GAME_Y + GAME_H / 2, GAME_W * 0.7);
    bg.addColorStop(0, '#14101e'); bg.addColorStop(0.6, '#0c0914'); bg.addColorStop(1, '#08060e');
    ctx.fillStyle = bg;
    this.roundRect(ctx, GAME_X, GAME_Y, GAME_W, GAME_H, 12); ctx.fill();
    ctx.strokeStyle = this.rgba(PAL.pink, 0.15); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    // clip to game area
    ctx.save();
    this.roundRect(ctx, GAME_X, GAME_Y, GAME_W, GAME_H, 12); ctx.clip();

    // subtle fabric texture lines
    ctx.save(); ctx.globalAlpha = 0.03; ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 1;
    for (let x = GAME_X; x < GAME_X + GAME_W; x += 8) {
      ctx.beginPath(); ctx.moveTo(x, GAME_Y); ctx.lineTo(x, GAME_Y + GAME_H); ctx.stroke();
    }
    ctx.restore();

    // pocket target
    const e = this.end;
    ctx.save();
    ctx.strokeStyle = this.rgba(PAL.green, 0.55); ctx.lineWidth = 3;
    ctx.shadowColor = PAL.green; ctx.shadowBlur = 14;
    this.roundRect(ctx, e.x - 48, e.y - 18, 96, 72, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.restore();
    this.label(ctx, 'pocket', e.x, e.y + 48, 11, PAL.green, 'center');

    // the channel
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = () => { ctx.beginPath(); ctx.moveTo(this.path[0].x, this.path[0].y); for (const q of this.path) ctx.lineTo(q.x, q.y); ctx.stroke(); };
    // danger halo
    ctx.save();
    ctx.strokeStyle = this.flash > 0 ? `rgba(255,77,94,${0.35 + 0.65 * this.flash})` : this.rgba(PAL.pink, 0.45);
    ctx.shadowColor = this.flash > 0 ? PAL.red : PAL.pink; ctx.shadowBlur = 14 + this.flash * 22;
    ctx.lineWidth = this.halfWidth * 2 + 6; trace(); ctx.restore();
    // channel interior
    ctx.strokeStyle = 'rgba(6,4,10,0.95)'; ctx.lineWidth = this.halfWidth * 2; trace();
    // guide line
    ctx.save(); ctx.setLineDash([8, 12]); ctx.lineDashOffset = -t * 36;
    ctx.strokeStyle = this.rgba(PAL.cyan, 0.28); ctx.lineWidth = 1.5; trace(); ctx.restore();

    // start marker
    const pulse = 1 + Math.sin(t * 4) * 0.12;
    ctx.save(); ctx.shadowColor = PAL.gold; ctx.shadowBlur = 16; ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(this.start.x, this.start.y, 10 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // end marker
    ctx.save();
    ctx.shadowColor = PAL.green; ctx.shadowBlur = 18 + this.pop * 28; ctx.fillStyle = PAL.green;
    ctx.beginPath(); ctx.arc(e.x, e.y, 11 * (1 + this.pop * 0.9), 0, Math.PI * 2); ctx.fill(); ctx.restore();

    // prompt to click
    if (!this.holding && !this.done) {
      ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.4;
      this.label(ctx, 'click to grab the card', this.start.x, this.start.y - 30, 11, PAL.gold, 'center');
      ctx.restore();
    }

    // card only (no hand) — small glowing card follows the mouse
    if (!this.done) {
      const cx = this.holding ? this.mouse.x : this.start.x;
      const cy = this.holding ? this.mouse.y : this.start.y;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.15 + Math.sin(t * 3) * 0.04);
      ctx.shadowColor = this.holding ? this.rgba(PAL.cyan, 0.6) : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = this.holding ? 12 : 8;
      ctx.shadowOffsetY = this.holding ? 0 : 3;
      // card body
      ctx.fillStyle = '#f7f3e8';
      this.roundRect(ctx, -16, -10, 32, 20, 3); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // card stripe
      ctx.fillStyle = PAL.pink; ctx.fillRect(-16, -10, 32, 5);
      // card text lines
      ctx.fillStyle = '#c9c2b4'; ctx.fillRect(-12, -2, 18, 2); ctx.fillRect(-12, 2, 14, 2);
      // gold seal
      ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(10, 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // sparks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // hint at bottom of game area
    if (!this.done) {
      ctx.save(); ctx.globalAlpha = 0.45;
      this.label(ctx, "don't touch the edges", GAME_X + GAME_W / 2, GAME_Y + GAME_H - 16, 10, PAL.dim, 'center');
      ctx.restore();
    }

    ctx.restore(); // unclip
  }

  draw(ctx) {
    // full backdrop
    this.backdrop(ctx, PAL.pink, this.t);

    this.drawLeftPanel(ctx);
    this.drawGameArea(ctx);

    // result banner across both panels
    if (this.msgT > 0) {
      this.banner(ctx, this.msg, GH / 2, this.msgGood ? PAL.green : PAL.red, 34, Math.min(1, this.msgT * 2));
    }
  }
}
