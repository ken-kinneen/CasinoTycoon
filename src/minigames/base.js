// Shared scaffolding for the three 2D activity minigames. Each game draws into
// a fixed-size canvas that is CSS-scaled to fit the window.
export const GW = 960, GH = 600;

// Neon-noir palette, matched to style.css
export const PAL = {
  ink: '#08060e', ink2: '#120c1c', panel: 'rgba(14,10,22,0.82)',
  gold: '#f5c542', goldDim: '#9a7a1e', pink: '#ff2e88', cyan: '#38e8ff',
  green: '#3ddc84', red: '#ff4d5e', bone: '#efe6d2', dim: '#7e7490',
};
export const DISPLAY = '"Bebas Neue", Impact, sans-serif';
export const BODY = 'Rubik, Arial, sans-serif';
export const SERIF = '"Playfair Display", Georgia, serif';

export class MiniGame {
  constructor(title) {
    this.title = title;
    this.overlay = document.getElementById('minigame');
    this.canvas = document.getElementById('minigame-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.titleEl = document.getElementById('minigame-title');
    this.hintEl = document.getElementById('minigame-hint');
    this.running = false;
    this.t = 0;
    this.mouse = { x: 0, y: 0, down: false };
    this._onMove = e => { const r = this.canvas.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) * GW / r.width; this.mouse.y = (e.clientY - r.top) * GH / r.height; };
    this._onDown = e => { this._onMove(e); this.mouse.down = true; this.onDown && this.onDown(); };
    this._onUp = e => { this.mouse.down = false; this.onUp && this.onUp(); };
    this._onKey = e => { if (e.code === 'Escape') this.finish({ aborted: true }); else this.onKey && this.onKey(e); };
  }

  open(hint) {
    this.canvas.width = GW; this.canvas.height = GH;
    this.titleEl.textContent = this.title;
    this.hintEl.textContent = hint;
    this.overlay.classList.remove('hidden');
    window.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
    window.addEventListener('keydown', this._onKey);
    this.running = true;
    this.last = performance.now();
    const loop = t => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
      this.t += dt;
      this.update(dt); this.draw(this.ctx);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  finish(result) {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mouseup', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    this.overlay.classList.add('hidden');
    this.onDone && this.onDone(result);
  }

  // ---------- drawing helpers (neon-noir kit) ----------
  text(ctx, s, x, y, size = 24, color = '#fff', align = 'left', font = BODY, weight = 'bold') {
    ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  /** Display type with a neon halo. Bebas has no weights, so letterspace it. */
  neon(ctx, s, x, y, size = 32, color = PAL.gold, align = 'center', glow = 18, track = 2) {
    ctx.save();
    ctx.font = `${size}px ${DISPLAY}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${track}px`;
    ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.fillStyle = color;
    ctx.fillText(s, x, y); ctx.fillText(s, x, y);
    ctx.restore();
  }
  label(ctx, s, x, y, size = 13, color = PAL.dim, align = 'left') {
    ctx.save(); ctx.font = `600 ${size}px ${BODY}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px';
    ctx.fillStyle = color; ctx.fillText(s.toUpperCase(), x, y); ctx.restore();
  }
  roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  /** Dark room: radial pool of light, haze, floor grade, film grain, vignette. */
  backdrop(ctx, tint = PAL.pink, t = 0) {
    const g = ctx.createRadialGradient(GW / 2, GH * 0.38, 40, GW / 2, GH * 0.45, GW * 0.78);
    g.addColorStop(0, '#1b1226'); g.addColorStop(0.55, '#0e0917'); g.addColorStop(1, PAL.ink);
    ctx.fillStyle = g; ctx.fillRect(0, 0, GW, GH);
    // two coloured wash lights raking the room
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const w1 = ctx.createRadialGradient(120, -60, 10, 120, -60, 520);
    w1.addColorStop(0, this.rgba(tint, 0.20)); w1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = w1; ctx.fillRect(0, 0, GW, GH);
    const w2 = ctx.createRadialGradient(GW - 80, GH + 60, 10, GW - 80, GH + 60, 560);
    w2.addColorStop(0, this.rgba(PAL.cyan, 0.13)); w2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = w2; ctx.fillRect(0, 0, GW, GH);
    ctx.restore();
    // drifting haze bands
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#c9b8ff';
    for (let i = 0; i < 4; i++) {
      const y = 90 + i * 150 + Math.sin(t * 0.4 + i) * 18;
      ctx.beginPath(); ctx.ellipse(GW / 2 + Math.cos(t * 0.25 + i) * 120, y, 560, 46, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.grain(ctx);
    this.vignette(ctx);
  }
  vignette(ctx, strength = 0.85) {
    const v = ctx.createRadialGradient(GW / 2, GH / 2, GH * 0.35, GW / 2, GH / 2, GH * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, GW, GH);
  }
  grain(ctx) {
    if (!MiniGame._grain) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), d = g.createImageData(128, 128);
      for (let i = 0; i < d.data.length; i += 4) { const n = 118 + Math.random() * 40; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); MiniGame._grain = c;
    }
    ctx.save(); ctx.globalAlpha = 0.055; ctx.globalCompositeOperation = 'overlay';
    const p = ctx.createPattern(MiniGame._grain, 'repeat');
    ctx.fillStyle = p; ctx.translate((Math.random() * 20) | 0, (Math.random() * 20) | 0);
    ctx.fillRect(-20, -20, GW + 40, GH + 40); ctx.restore();
  }
  /** Smoked-glass panel with gold corner brackets, matching .frame in the DOM. */
  panel(ctx, x, y, w, h, { accent = PAL.gold, fill = PAL.panel, r = 10, corner = 16 } = {}) {
    ctx.save();
    ctx.fillStyle = fill; this.roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = this.rgba(accent, 0.22); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineCap = 'square';
    ctx.shadowColor = accent; ctx.shadowBlur = 8;
    const c = corner;
    const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx + sx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * c); ctx.stroke();
    }
    ctx.restore();
  }
  /** Chase-light bulb strip, like the marquee frame on the title screen. */
  bulbs(ctx, x, y, w, t, { count = 0, color = PAL.gold, r = 3.2 } = {}) {
    const n = count || Math.max(4, Math.round(w / 26));
    ctx.save();
    for (let i = 0; i < n; i++) {
      const bx = x + (i + 0.5) * (w / n);
      const on = (Math.floor(t * 6) + i) % 3 === 0;
      ctx.fillStyle = on ? color : this.rgba(color, 0.22);
      ctx.shadowColor = color; ctx.shadowBlur = on ? 12 : 0;
      ctx.beginPath(); ctx.arc(bx, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  /** Segmented timer bar under a title plate. */
  timerBar(ctx, frac, color = PAL.gold, y = 22) {
    const w = 420, x = GW / 2 - w / 2, h = 10;
    frac = Math.max(0, Math.min(1, frac));
    const hot = frac < 0.25;
    const c = hot ? PAL.red : color;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; this.roundRect(ctx, x, y, w, h, 5); ctx.fill();
    ctx.strokeStyle = this.rgba(c, 0.3); ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); this.roundRect(ctx, x, y, w * frac, h, 5); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, this.rgba(c, 0.55)); g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    for (let sx = x; sx < x + w; sx += 14) ctx.fillRect(sx + 11, y, 3, h);
    ctx.restore();
    ctx.shadowColor = c; ctx.shadowBlur = hot ? 16 : 9;
    ctx.fillStyle = c; ctx.fillRect(x + w * frac - 2, y - 2, 3, h + 4);
    ctx.restore();
  }
  /** Stat readout: small caps label above a display-face value. */
  readout(ctx, x, y, label, value, color = PAL.bone, align = 'left', size = 30) {
    this.label(ctx, label, x, y, 11, PAL.dim, align);
    this.neon(ctx, value, x, y + 22, size, color, align, 10, 1);
  }
  /** Centre banner used for hit/miss and status callouts. */
  banner(ctx, s, y, color, size = 40, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(6,4,10,0.72)';
    ctx.fillRect(0, y - size * 0.72, GW, size * 1.44);
    ctx.strokeStyle = this.rgba(color, 0.75); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y - size * 0.72); ctx.lineTo(GW, y - size * 0.72);
    ctx.moveTo(0, y + size * 0.72); ctx.lineTo(GW, y + size * 0.72); ctx.stroke();
    this.neon(ctx, s, GW / 2, y, size, color, 'center', 22, 4);
    ctx.restore();
  }
  rgba(hex, a) {
    if (hex.startsWith('rgb')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
}

export function fmtMoney(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + Math.floor(n).toLocaleString();
}
