// Procedural canvas textures. Everything the game "paints" is generated here
// at load time so there are no image downloads: carpets, pinstripes, brick,
// felt, slot reels, faces, neon bulbs.
import * as THREE from 'three';

const cache = new Map();
function canvasTex(key, w, h, draw, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Low-pile commercial carpet — dense fibrous texture, no grid. */
export function plainCarpetTexture(base = '#3a1a2a', fleck1 = '#5a2a3a', fleck2 = '#2a0a18', repeat = [6, 6]) {
  return canvasTex(`plaincarpet2|${base}|${fleck1}|${fleck2}`, 512, 512, (ctx, w, h) => {
    const rnd = seeded(42);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    // woven fiber lines — dense horizontal + slight vertical cross-weave
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.03})`;
      ctx.fillRect(x, 0, 1, h);
    }
    // dense flecks — fiber tufts across the surface
    for (let i = 0; i < 6000; i++) {
      const c = rnd() > 0.5 ? fleck1 : fleck2;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.1 + rnd() * 0.2;
      const fw = 1 + rnd() * 2, fh = 1 + rnd() * 3;
      ctx.fillRect(rnd() * w, rnd() * h, fw, fh);
    }
    // lighter fiber highlights
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = fleck1;
      ctx.globalAlpha = 0.06 + rnd() * 0.1;
      ctx.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 4);
    }
    ctx.globalAlpha = 1;
    // subtle wear patches — soft blotchy shading
    for (let i = 0; i < 14; i++) {
      const grad = ctx.createRadialGradient(
        rnd() * w, rnd() * h, 0,
        rnd() * w, rnd() * h, 30 + rnd() * 80
      );
      grad.addColorStop(0, `rgba(0,0,0,${0.04 + rnd() * 0.06})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }, { repeat });
}

/** Casino carpet: dark ground with swirling paisley-ish loops in an accent colour. */
export function carpetTexture(base = '#3a0b1e', accent = '#c99a2e', accent2 = '#7a2a5a', seed = 1, repeat = [8, 6]) {
  return canvasTex(`carpet|${base}|${accent}|${accent2}|${seed}`, 512, 512, (ctx, w, h) => {
    const rnd = seeded(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    // faint noise
    for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; ctx.fillRect(rnd() * w, rnd() * h, 2, 2); }
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 50;
      ctx.strokeStyle = i % 3 === 0 ? accent : accent2; ctx.lineWidth = 3 + rnd() * 4;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2.6; a += 0.2) { const rr = r * (1 - a / 9); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7; a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      // mirrored copy for tiling continuity
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2.6; a += 0.2) { const rr = r * (1 - a / 9); const px = ((x + w / 2) % w) + Math.cos(a) * rr, py = ((y + h / 2) % h) + Math.sin(a) * rr * 0.7; a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
    }
    // diamond lattice
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
    for (let i = -w; i < w * 2; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - h, h); ctx.stroke(); }
  }, { repeat });
}

/** Wall panelling: wainscot stripes with a damask-ish upper. */
export function wallTexture(color = '#3b2418', trim = '#c99a2e', repeat = [4, 1]) {
  return canvasTex(`wall|${color}|${trim}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    // vertical stripe wallpaper on the upper 65%
    for (let x = 0; x < w; x += 32) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x, 0, 14, h * 0.66); }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse((i * 97) % w, (i * 53) % (h * 0.66), 6, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    // chair rail + wainscot
    ctx.fillStyle = trim; ctx.fillRect(0, h * 0.66, w, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, h * 0.66 + 8, w, h * 0.34);
    for (let x = 8; x < w; x += 128) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3; ctx.strokeRect(x, h * 0.72, 112, h * 0.22); }
    ctx.fillStyle = trim; ctx.fillRect(0, h - 10, w, 10);
    // grime
    for (let i = 0; i < 600; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }, { repeat });
}

export function brickTexture(color = '#3a2a26', mortar = '#1a1412', repeat = [6, 3]) {
  return canvasTex(`brick|${color}|${mortar}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = mortar; ctx.fillRect(0, 0, w, h);
    const bw = 64, bh = 28;
    for (let y = 0; y < h; y += bh) {
      const off = (Math.floor(y / bh) % 2) * bw / 2;
      for (let x = -bw; x < w; x += bw) {
        const v = Math.random() * 30 - 15;
        ctx.fillStyle = `rgb(${58 + v},${42 + v},${38 + v})`;
        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
    for (let i = 0; i < 800; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
  }, { repeat });
}

/** Cream/tan tile facade — horizontal courses of light tile with darker grout. */
export function tileFacadeTexture(base = '#d8c8a8', grout = '#a09080', repeat = [4, 3]) {
  return canvasTex(`tilefacade|${base}|${grout}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h);
    const tw = 80, th = 24;
    const rnd = seeded(19);
    for (let y = 0; y < h; y += th) {
      const off = (Math.floor(y / th) % 2) * tw / 2;
      for (let x = -tw; x < w + tw; x += tw) {
        const r = 216 + (rnd() * 20 - 10) | 0;
        const g = 200 + (rnd() * 20 - 10) | 0;
        const b = 168 + (rnd() * 20 - 10) | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + off + 1, y + 1, tw - 2, th - 2);
      }
    }
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.15})`; ctx.fillRect(rnd() * w, rnd() * h, 3, 3); }
    for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(80,70,50,${rnd() * 0.12})`; ctx.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 6, 2 + rnd() * 4); }
  }, { repeat });
}

/** Cracked/dirty glass pane texture for abandoned windows. */
export function brokenGlassTexture(tint = '#8ab4b8', repeat = [1, 1]) {
  return canvasTex(`brokenglass|${tint}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, w, h);
    const rnd = seeded(55);
    // reflective patches
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(180,220,230,${0.1 + rnd() * 0.15})`;
      ctx.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 80, 30 + rnd() * 60);
    }
    // crack lines radiating from impact points
    for (let p = 0; p < 3; p++) {
      const cx = 40 + rnd() * (w - 80), cy = 40 + rnd() * (h - 80);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
      for (let r = 0; r < 8; r++) {
        const a = rnd() * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        let x = cx, y = cy;
        for (let s = 0; s < 4; s++) {
          x += Math.cos(a + (rnd() - 0.5) * 0.6) * (15 + rnd() * 25);
          y += Math.sin(a + (rnd() - 0.5) * 0.6) * (15 + rnd() * 25);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // dark holes (broken-out sections)
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.7 + rnd() * 0.3})`;
      ctx.beginPath();
      const cx = 50 + rnd() * (w - 100), cy = 50 + rnd() * (h - 100);
      ctx.moveTo(cx, cy);
      for (let v = 0; v < 6; v++) ctx.lineTo(cx + (rnd() - 0.5) * 80, cy + (rnd() - 0.5) * 60);
      ctx.closePath(); ctx.fill();
    }
    // grime streaks
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = `rgba(60,50,40,${0.08 + rnd() * 0.1})`; ctx.lineWidth = 2 + rnd() * 4;
      ctx.beginPath(); ctx.moveTo(rnd() * w, 0); ctx.lineTo(rnd() * w, h); ctx.stroke();
    }
  }, { wrap: false });
}

export function pinstripeTexture(color = '#2a1440', stripe = 'rgba(255,255,255,0.18)') {
  return canvasTex(`pin|${color}|${stripe}`, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe; for (let x = 0; x < w; x += 12) ctx.fillRect(x, 0, 2, h);
  }, { repeat: [3, 3] });
}

export function feltTexture(color = '#0f5a3a', logo = 'VV') {
  return canvasTex(`felt|${color}|${logo}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    // betting circles
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.2 + i * 0.15); ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * 170, h * 0.15 + Math.sin(a) * 200, 26, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(w / 2, h * 0.28, 140, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.font = 'bold 22px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
    ctx.fillText('DEALER MUST DRAW TO 16 · HOUSE ALWAYS WINS', w / 2, h * 0.5);
    ctx.font = 'italic bold 80px Georgia, serif'; ctx.fillStyle = 'rgba(255,215,0,0.35)'; ctx.fillText(logo, w / 2, h * 0.3);
  }, { wrap: false });
}

/** Slot reel strip laid out horizontally (wraps around a cylinder): 7, cherry, BAR, bell, lemon. */
export function reelTexture() {
  return canvasTex('reel', 640, 128, (ctx, w, h) => {
    const cw = 128;
    const draw = [
      () => { ctx.fillStyle = '#c0392b'; ctx.font = 'bold 84px Impact, Arial Black'; ctx.textAlign = 'center'; ctx.fillText('7', 64, 96); },
      () => { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(46, 80, 20, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(82, 86, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a7a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(50, 62); ctx.quadraticCurveTo(64, 22, 84, 64); ctx.stroke(); },
      () => { ctx.fillStyle = '#222'; for (let i = 0; i < 3; i++) ctx.fillRect(20, 34 + i * 22, 88, 16); ctx.fillStyle = '#ffd700'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) ctx.fillText('BAR', 64, 47 + i * 22); },
      () => { ctx.fillStyle = '#e0a800'; ctx.beginPath(); ctx.moveTo(64, 30); ctx.quadraticCurveTo(104, 60, 102, 96); ctx.lineTo(26, 96); ctx.quadraticCurveTo(24, 60, 64, 30); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(64, 102, 8, 0, 7); ctx.fill(); },
      () => { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.ellipse(64, 70, 36, 26, -0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#2a7a2a'; ctx.fillRect(84, 44, 12, 6); },
    ];
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(i * cw, 0);
      ctx.fillStyle = i % 2 ? '#ece6d8' : '#f8f4ec'; ctx.fillRect(0, 0, cw, h);
      draw[i]();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, 2, h);
      ctx.restore();
    }
  }, { wrap: true });
}

/** A face: eyes, brows, mouth. `mood`: 'neutral' | 'happy' | 'drunk' | 'sneer' | 'cool'. */
export function faceTexture(mood = 'neutral', skin = '#e0ac69') {
  return canvasTex(`face|${mood}|${skin}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = skin; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    const ey = 105;
    // eyes
    for (const ex of [88, 168]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 20, mood === 'drunk' ? 10 : 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(ex + (mood === 'drunk' ? (ex < 128 ? -6 : 6) : 0), ey + 2, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 3, ey - 2, 3, 0, 7); ctx.fill();
    }
    if (mood === 'cool') { ctx.fillStyle = '#111'; ctx.fillRect(60, ey - 18, 56, 34); ctx.fillRect(140, ey - 18, 56, 34); ctx.fillRect(116, ey - 6, 24, 6); }
    // brows
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    const tilt = mood === 'sneer' ? 14 : mood === 'happy' ? -4 : 0;
    ctx.beginPath(); ctx.moveTo(66, ey - 30 - tilt); ctx.lineTo(110, ey - 30 + tilt); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(146, ey - 30 + tilt); ctx.lineTo(190, ey - 30 - tilt); ctx.stroke();
    // nose
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, ey + 10); ctx.lineTo(120, ey + 45); ctx.lineTo(134, ey + 48); ctx.stroke();
    // mouth
    ctx.strokeStyle = '#4a1a1a'; ctx.lineWidth = 6; ctx.beginPath();
    if (mood === 'happy' || mood === 'drunk') { ctx.arc(128, 170, 30, 0.2, Math.PI - 0.2); }
    else if (mood === 'sneer') { ctx.moveTo(98, 185); ctx.quadraticCurveTo(128, 172, 162, 178); }
    else { ctx.moveTo(104, 182); ctx.lineTo(152, 182); }
    ctx.stroke();
    if (mood === 'sneer') { ctx.fillStyle = '#ffd700'; ctx.fillRect(140, 176, 10, 8); }
    if (mood === 'drunk') { ctx.fillStyle = 'rgba(220,60,60,0.35)'; ctx.beginPath(); ctx.arc(70, 150, 22, 0, 7); ctx.arc(186, 150, 22, 0, 7); ctx.fill(); }
  }, { wrap: false });
}

/** Soft radial blob for smoke/haze/glow sprites. */
export function softSpriteTexture(color = '255,255,255') {
  return canvasTex(`soft|${color}`, 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(${color},0.9)`); g.addColorStop(0.4, `rgba(${color},0.35)`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { wrap: false, srgb: false });
}

/** Rain streak. */
export function rainTexture() {
  return canvasTex('rain', 16, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(180,200,255,0)'); g.addColorStop(0.5, 'rgba(180,200,255,0.7)'); g.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(6, 0, 4, h);
  }, { wrap: false, srgb: false });
}

/** Text on transparent canvas (signs). Returns a texture, sized to fit. */
export function textTexture(text, { color = '#ffcc00', font = 'bold 120px Impact, Arial Black, sans-serif', glow = null, w = 1024, h = 256, stroke = null } = {}) {
  return canvasTex(`text|${text}|${color}|${font}|${glow}|${w}|${h}|${stroke}`, w, h, (ctx) => {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 36; }
    if (stroke) { ctx.lineWidth = 10; ctx.strokeStyle = stroke; ctx.strokeText(text, w / 2, h / 2, w * 0.94); }
    ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2, w * 0.94);
    if (glow) { ctx.shadowBlur = 0; ctx.fillText(text, w / 2, h / 2, w * 0.94); }
  }, { wrap: false });
}

/** Marble floor: warm stone with subtle veining so it doesn't reflect IBL as a flat slab. */
export function marbleTexture(base = '#a09888', vein = '#787068', repeat = [2, 3]) {
  return canvasTex(`marble|${base}|${vein}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const rnd = seeded(42);
    // subtle noise to break up uniformity
    for (let i = 0; i < 8000; i++) {
      const v = rnd() * 0.12;
      ctx.fillStyle = `rgba(0,0,0,${v})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    // veining
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = vein;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.globalAlpha = 0.15 + rnd() * 0.2;
      ctx.beginPath();
      let x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      const steps = 6 + Math.floor(rnd() * 10);
      for (let s = 0; s < steps; s++) {
        x += (rnd() - 0.5) * 80;
        y += 20 + rnd() * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // tile edge lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
  }, { repeat });
}

/** Luxury marble tile floor: large polished tiles with gold grout lines and subtle veining. */
export function marbleTileTexture(base = '#f0ece0', vein = '#d8d0c0', grout = '#d4af37', repeat = [6, 6]) {
  return canvasTex(`marbletile|${base}|${vein}|${grout}`, 512, 512, (ctx, w, h) => {
    const rnd = seeded(77);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    // subtle noise
    for (let i = 0; i < 6000; i++) {
      const v = rnd() * 0.08;
      ctx.fillStyle = `rgba(${rnd() > 0.5 ? '0,0,0' : '255,255,255'},${v})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 2, 2 + rnd() * 2);
    }
    // veining — thin elegant lines
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = vein;
      ctx.lineWidth = 0.5 + rnd() * 1.5;
      ctx.globalAlpha = 0.2 + rnd() * 0.15;
      ctx.beginPath();
      let x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 60; y += 15 + rnd() * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // gold grout lines — tile grid
    ctx.strokeStyle = grout; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    // corner accent diamonds at each intersection
    for (const [cx, cy] of [[0, 0], [w / 2, 0], [w, 0], [0, h / 2], [w / 2, h / 2], [w, h / 2], [0, h], [w / 2, h], [w, h]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = grout; ctx.globalAlpha = 0.6;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }, { repeat });
}

/** Herringbone parquet floor: warm toned wood in a V pattern. */
export function herringboneTexture(color1 = '#c8b898', color2 = '#b8a888', accent = '#d4af37', repeat = [4, 4]) {
  return canvasTex(`herring|${color1}|${color2}|${accent}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = color1; ctx.fillRect(0, 0, w, h);
    const bw = 48, bh = 16;
    const rnd = seeded(33);
    for (let row = 0; row < h / bh + 2; row++) {
      for (let col = 0; col < w / bw + 2; col++) {
        const x = col * bw + (row % 2) * bw / 2;
        const y = row * bh;
        const v = rnd() * 15 - 7;
        const isAlt = (col + row) % 2 === 0;
        ctx.fillStyle = isAlt ? color1 : color2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(isAlt ? 0.3 : -0.3);
        ctx.fillRect(-bw / 2, -bh / 2, bw - 2, bh - 2);
        // wood grain
        ctx.strokeStyle = `rgba(0,0,0,0.06)`; ctx.lineWidth = 0.5;
        for (let g = -bh / 2 + 2; g < bh / 2; g += 3) { ctx.beginPath(); ctx.moveTo(-bw / 2, g); ctx.lineTo(bw / 2, g + rnd() * 2); ctx.stroke(); }
        ctx.restore();
      }
    }
    // gold border accent line
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.globalAlpha = 1;
  }, { repeat });
}

/** Ornate medallion floor: circular rosette pattern for grand entry areas. */
export function medallionTexture(base = '#e8e0d0', gold = '#d4af37', dark = '#a09080', repeat = [1, 1]) {
  return canvasTex(`medallion|${base}|${gold}|${dark}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    // outer ring
    ctx.strokeStyle = gold; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, 240, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 230, 0, Math.PI * 2); ctx.stroke();
    // star pattern
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.strokeStyle = i % 2 === 0 ? gold : dark; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 220, cy + Math.sin(a) * 220); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // concentric decorative rings
    for (const r of [180, 140, 80]) {
      ctx.strokeStyle = gold; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    // inner rosette petals
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.fillStyle = gold; ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 55, cy + Math.sin(a) * 55, 45, 18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // center compass rose
    ctx.fillStyle = gold; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 35 : 15;
      i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // corner fleur-de-lis hints (simple curves)
    for (const [cornerX, cornerY] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) {
      ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(cornerX, cornerY, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cornerX - 10, cornerY); ctx.lineTo(cornerX + 10, cornerY); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cornerX, cornerY - 10); ctx.lineTo(cornerX, cornerY + 10); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat });
}

/** Marquee bulb strip (for chase-light animation via texture offset). */
export function bulbStripTexture(on = '#fff2b0', off = '#4a3a20') {
  return canvasTex(`bulbs|${on}|${off}`, 256, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? on : off; ctx.beginPath(); ctx.arc(16 + i * 32, 16, 9, 0, 7); ctx.fill(); }
  }, { wrap: true });
}
