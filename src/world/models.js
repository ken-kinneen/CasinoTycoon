// Procedural low-poly models, pass 2. Everything is built from primitives and
// canvas textures so there are no downloads and models can change with upgrades.
import * as THREE from 'three';
import * as T from '../engine/textures.js';

// ---------------------------------------------------------------------------
// materials & primitives
// ---------------------------------------------------------------------------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.05, ...opts }));
  return matCache.get(key);
}
export function glow(color, intensity = 1.2, opts = {}) { return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...opts }); }
export const GOLD = () => mat(0xe8b923, { metalness: 0.85, roughness: 0.28, flatShading: false });
export const CHROME = () => mat(0xd8dde6, { metalness: 0.9, roughness: 0.22, flatShading: false });
export const BLACK_GLOSS = () => mat(0x0c0c12, { metalness: 0.3, roughness: 0.25, flatShading: false });
export function texMat(map, opts = {}) { return new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0.02, ...opts }); }

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export function sph(r, material, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
  m.position.set(x, y, z); m.castShadow = true; return m;
}
export function torus(r, tube, material, x = 0, y = 0, z = 0, arc = Math.PI * 2) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24, arc), material);
  m.position.set(x, y, z); m.castShadow = true; return m;
}
export function plane(w, h, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z); return m;
}

/** A plane with canvas-rendered text (transparent). */
export function textPlane(text, { w = 4, h = 1, color = '#ffcc00', font = 'bold 110px Impact, Arial Black, sans-serif', glowColor = null, stroke = null, emissive = false } = {}) {
  const tex = T.textTexture(text, { color, font, glow: glowColor, w: 1024, h: Math.max(64, Math.round(1024 * h / w)), stroke });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: !emissive }));
  return m;
}

/** Neon tube text: bright emissive plane + a coloured point light. */
export function makeNeonSign(text, color = '#ffcc00', w = 7, { intensity = 12, font } = {}) {
  const g = new THREE.Group();
  const t = textPlane(text, { w, h: w * 0.26, color: '#ffffff', glowColor: color, emissive: true, font });
  t.material.color = new THREE.Color(color).multiplyScalar(2.2);
  const back = textPlane(text, { w, h: w * 0.26, color, glowColor: color, font }); back.position.z = -0.01; back.material.opacity = 0.9;
  g.add(back); g.add(t);
  const l = new THREE.PointLight(new THREE.Color(color), intensity, 16, 1.6); l.position.set(0, 0, 1.2); g.add(l);
  g.userData = { light: l, plane: t, back, baseIntensity: intensity };
  return g;
}

// ---------------------------------------------------------------------------
// slot machines
// ---------------------------------------------------------------------------
const SLOT_THEMES = [
  { body: 0xb71c1c, accent: 0xffd54f, name: 'LUCKY 7s', screen: 0xff3d00 },
  { body: 0x1565c0, accent: 0x80d8ff, name: 'BLUE MOON', screen: 0x00e5ff },
  { body: 0x6a1b9a, accent: 0xea80fc, name: 'ROYAL FLUSH', screen: 0xd500f9 },
  { body: 0x00695c, accent: 0xa7ffeb, name: 'JADE DRAGON', screen: 0x1de9b6 },
  { body: 0xe65100, accent: 0xffe0b2, name: 'HOT STREAK', screen: 0xffab00 },
  { body: 0x2e7d32, accent: 0xb9f6ca, name: 'CASH COW', screen: 0x76ff03 },
];

export function makeSlotMachine(i = 0) {
  const th = SLOT_THEMES[i % SLOT_THEMES.length];
  const g = new THREE.Group();
  const body = mat(th.body, { roughness: 0.5, metalness: 0.15 });
  const accent = mat(th.accent, { metalness: 0.5, roughness: 0.35 });
  g.add(box(0.96, 0.18, 0.78, BLACK_GLOSS(), 0, 0.09, 0));                  // plinth
  g.add(box(0.9, 1.05, 0.7, body, 0, 0.7, 0));                              // lower cabinet
  g.add(box(0.9, 0.08, 0.74, accent, 0, 1.24, 0));                          // waist trim
  g.add(box(0.9, 0.75, 0.66, body, 0, 1.64, -0.02));                        // upper cabinet
  // side racing stripes
  for (const sx of [-0.46, 0.46]) g.add(box(0.02, 1.6, 0.12, accent, sx, 1.1, 0.2));
  // belly glass (lit)
  const belly = box(0.7, 0.55, 0.04, glow(th.screen, 0.55), 0, 0.72, 0.35); g.add(belly);
  g.add(textPlane(th.name, { w: 0.68, h: 0.2, color: '#fff', glowColor: '#fff' }).translateY(0.85).translateZ(0.38));
  // reels window
  g.add(box(0.74, 0.34, 0.04, mat(0x0a0a0a), 0, 1.66, 0.32));
  const reelTex = T.reelTexture();
  const reels = [];
  for (let r = -1; r <= 1; r++) {
    const pivot = new THREE.Group(); pivot.rotation.z = Math.PI / 2; pivot.position.set(r * 0.22, 1.66, 0.24);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 20, 1, false), new THREE.MeshStandardMaterial({ map: reelTex, roughness: 0.6 }));
    reel.rotation.y = Math.random() * 6;
    pivot.add(reel); g.add(pivot); reels.push(reel);
  }
  g.add(box(0.76, 0.02, 0.06, accent, 0, 1.5, 0.34)); g.add(box(0.76, 0.02, 0.06, accent, 0, 1.83, 0.34));
  // button deck
  g.add(box(0.84, 0.06, 0.28, BLACK_GLOSS(), 0, 1.3, 0.42).rotateX(0.3));
  [0xff1744, 0xffea00, 0x00e676].forEach((c, k) => g.add(cyl(0.05, 0.05, 0.03, glow(c, 1.2), -0.2 + k * 0.2, 1.36, 0.46, 10)));
  // marquee top with chase bulbs
  g.add(box(1.0, 0.42, 0.5, body, 0, 2.22, -0.05));
  g.add(box(1.04, 0.05, 0.54, accent, 0, 2.0, -0.05));
  const marquee = textPlane('JACKPOT', { w: 0.9, h: 0.25, color: '#fff2b0', glowColor: '#ffcc00', emissive: true }); marquee.position.set(0, 2.24, 0.21); g.add(marquee);
  const bulbs = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.09), new THREE.MeshBasicMaterial({ map: T.bulbStripTexture(), transparent: true, toneMapped: false }));
  bulbs.material.map.repeat.set(1, 1); bulbs.position.set(0, 2.4, 0.21); g.add(bulbs);
  const bulbs2 = bulbs.clone(); bulbs2.position.y = 2.06; g.add(bulbs2);
  // candle (top light)
  const candle = cyl(0.06, 0.07, 0.22, glow(0xff3d00, 2.0), 0, 2.54, -0.05, 10); g.add(candle);
  g.add(cyl(0.07, 0.07, 0.04, CHROME(), 0, 2.44, -0.05, 10));
  // lever
  const lever = new THREE.Group();
  lever.add(cyl(0.025, 0.025, 0.55, CHROME(), 0, 0.27, 0, 8));
  lever.add(sph(0.075, mat(0xff1744, { roughness: 0.2, flatShading: false }), 0, 0.55, 0, 10));
  lever.position.set(0.52, 1.2, 0.05); g.add(lever);
  g.add(cyl(0.04, 0.04, 0.12, CHROME(), 0.51, 1.2, 0.05, 8).rotateZ(Math.PI / 2));
  // coin tray + cash pile
  g.add(box(0.7, 0.06, 0.26, mat(0x111111), 0, 0.29, 0.42));
  g.add(box(0.7, 0.14, 0.03, CHROME(), 0, 0.33, 0.55));
  const cash = box(0.5, 0.25, 0.2, glow(0x3cb371, 0.25), 0, 0.44, 0.42); cash.scale.y = 0.05; g.add(cash);
  g.userData = { belly, candle, lever, cash, reels, light: { intensity: 0 }, theme: th };
  return g;
}

// ---------------------------------------------------------------------------
// tables & seating
// ---------------------------------------------------------------------------
export function makeDealerTable(feltColor = '#0f5a3a', logo = 'VV') {
  const g = new THREE.Group();
  // half-ellipse top: straight edge at -z (dealer), curve toward +z
  const shape = new THREE.Shape();
  shape.moveTo(-1.6, 0);
  shape.absellipse(0, 0, 1.6, 1.25, Math.PI, 0, true);
  shape.lineTo(-1.6, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2);
  const felt = new THREE.Mesh(geo, texMat(T.feltTexture(feltColor, logo), { roughness: 0.9 }));
  felt.position.y = 0.9; felt.rotation.y = Math.PI; felt.castShadow = true; felt.receiveShadow = true; g.add(felt);
  // fix UVs: project top face to texture
  const uv = geo.attributes.uv; const p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) { uv.setXY(i, (p.getX(i) + 1.6) / 3.2, (p.getZ(i) + 0.05) / 1.35); }
  // padded rail
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 32, Math.PI), mat(0x2b1a10, { roughness: 0.5 }));
  rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI; rail.scale.set(1, 1.25 / 1.5 * 1.0, 1); rail.position.y = 0.94; g.add(rail);
  // base
  g.add(box(2.4, 0.78, 1.0, mat(0x24140c), 0, 0.4, 0.2));
  g.add(box(2.6, 0.06, 1.3, mat(0x1a0e08), 0, 0.03, 0.2));
  // chip rack + shoe + cards
  g.add(box(0.9, 0.08, 0.22, BLACK_GLOSS(), 0, 0.98, -0.05));
  const chipCols = [0xff3333, 0x2b6bff, 0x111111, 0x2ecc71, 0xffffff];
  for (let i = 0; i < 6; i++) g.add(cyl(0.05, 0.05, 0.08, mat(chipCols[i % 5], { roughness: 0.3 }), -0.35 + i * 0.14, 1.04, -0.05, 10));
  g.add(box(0.28, 0.12, 0.2, BLACK_GLOSS(), 0.9, 1.0, 0.0));
  for (let i = 0; i < 4; i++) { const c = box(0.16, 0.005, 0.22, mat(0xd8d0c0, { roughness: 0.85 }), -0.6 + i * 0.35, 0.96, 0.55); c.rotation.y = (Math.random() - 0.5) * 0.5; g.add(c); }
  // scattered chips on the felt
  for (let i = 0; i < 8; i++) g.add(cyl(0.05, 0.05, 0.02 + Math.random() * 0.08, mat(chipCols[i % 5], { roughness: 0.3 }), (Math.random() - 0.5) * 2.2, 0.98, 0.3 + Math.random() * 0.7, 10));
  // stools along the arc
  for (let s = 0; s < 3; s++) { const a = Math.PI * (0.25 + s * 0.25); const st = makeStool(); st.position.set(Math.cos(a) * 2.0, 0, Math.sin(a) * 1.65); g.add(st); }
  // lamp over the table
  const lamp = new THREE.PointLight(0xffe0a0, 6, 6, 2); lamp.position.set(0, 2.6, 0.3); g.add(lamp);
  g.add(cyl(0.35, 0.15, 0.25, mat(0x1c5a2e, { roughness: 0.4 }), 0, 2.9, 0.3, 12));
  g.add(cyl(0.01, 0.01, 1.4, CHROME(), 0, 3.7, 0.3, 6));
  return g;
}

export function makeStool() {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.2, 0.08, mat(0x8b0000, { roughness: 0.4 }), 0, 0.62, 0, 12));
  g.add(cyl(0.03, 0.03, 0.55, CHROME(), 0, 0.33, 0, 8));
  g.add(cyl(0.18, 0.2, 0.03, CHROME(), 0, 0.02, 0, 12));
  return g;
}

export function makeRouletteTable() {
  const g = new THREE.Group();
  g.add(box(3.2, 0.1, 1.5, texMat(T.feltTexture('#0f5a3a', '00'), { roughness: 0.9 }), 0.2, 0.88, 0));
  g.add(box(3.2, 0.78, 1.5, mat(0x24140c), 0.2, 0.42, 0));
  const wheel = new THREE.Group();
  wheel.add(cyl(0.62, 0.66, 0.16, mat(0x3a1a0a, { roughness: 0.4 }), 0, 0, 0, 24));
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; wheel.add(box(0.12, 0.03, 0.22, mat(i % 2 ? 0xc0392b : 0x111111), Math.cos(a) * 0.45, 0.09, Math.sin(a) * 0.45).rotateY(-a)); }
  wheel.add(cyl(0.3, 0.32, 0.06, GOLD(), 0, 0.1, 0, 16));
  wheel.add(cyl(0.04, 0.04, 0.35, GOLD(), 0, 0.25, 0, 8));
  wheel.add(sph(0.05, mat(0xffffff, { flatShading: false }), 0.4, 0.14, 0, 8));
  wheel.position.set(-1.1, 1.0, 0); g.add(wheel);
  g.userData.wheel = wheel;
  return g;
}

// ---------------------------------------------------------------------------
// office & furniture
// ---------------------------------------------------------------------------
export function makeSafe() {
  const g = new THREE.Group();
  const steel = mat(0x2f3a45, { metalness: 0.6, roughness: 0.4, flatShading: false });
  g.add(box(1.4, 1.9, 1.2, steel, 0, 0.95, 0));
  g.add(box(1.5, 0.12, 1.3, BLACK_GLOSS(), 0, 0.06, 0));
  const door = box(1.2, 1.6, 0.1, mat(0x3f4a55, { metalness: 0.7, roughness: 0.3, flatShading: false }), 0, 0.95, 0.6); g.add(door);
  g.add(box(1.28, 1.68, 0.02, GOLD(), 0, 0.95, 0.56));
  g.add(cyl(0.2, 0.2, 0.12, CHROME(), 0, 0.95, 0.7, 16));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(cyl(0.03, 0.03, 0.3, CHROME(), Math.cos(a) * 0.1, 0.95, 0.72, 6).rotateZ(a + Math.PI / 2)); }
  g.add(box(0.06, 0.6, 0.06, CHROME(), 0.42, 0.95, 0.72));
  const light = sph(0.06, glow(0x00ff66, 2.5), -0.45, 1.6, 0.66); g.add(light);
  g.add(textPlane('VAULT', { w: 0.8, h: 0.2, color: '#e8b923' }).translateY(1.72).translateZ(0.66));
  g.userData = { door, light };
  return g;
}

export function makeDesk() {
  const g = new THREE.Group();
  const wood = mat(0x4a2a12, { roughness: 0.4, flatShading: false });
  g.add(box(2.3, 0.08, 1.1, wood, 0, 0.8, 0));
  g.add(box(2.3, 0.03, 1.1, mat(0x2a1608, { roughness: 0.25 }), 0, 0.845, 0));
  g.add(box(0.7, 0.76, 1.0, wood, -0.75, 0.38, 0)); g.add(box(0.7, 0.76, 1.0, wood, 0.75, 0.38, 0));
  for (let i = 0; i < 3; i++) { g.add(box(0.5, 0.02, 0.02, GOLD(), 0.75, 0.2 + i * 0.22, 0.51)); g.add(box(0.5, 0.02, 0.02, GOLD(), -0.75, 0.2 + i * 0.22, 0.51)); }
  // banker's lamp
  g.add(cyl(0.08, 0.1, 0.03, GOLD(), -0.7, 0.87, -0.2, 10)); g.add(cyl(0.015, 0.015, 0.3, GOLD(), -0.7, 1.0, -0.2, 6));
  g.add(box(0.36, 0.14, 0.2, glow(0x1e8a4a, 0.9), -0.7, 1.15, -0.2));
  const lamp = new THREE.PointLight(0x7fffb0, 2.5, 3.5, 2); lamp.position.set(-0.7, 1.05, -0.1); g.add(lamp);
  // ledger, cash, whiskey, ashtray
  g.add(box(0.45, 0.06, 0.6, mat(0x2b1a10), 0.1, 0.88, 0.1));
  g.add(box(0.4, 0.14, 0.28, glow(0x3cb371, 0.15), 0.7, 0.92, 0.25));
  g.add(cyl(0.06, 0.05, 0.14, mat(0xc27b1a, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: false }), 0.85, 0.92, -0.2, 10));
  g.add(cyl(0.07, 0.05, 0.03, CHROME(), 0.4, 0.86, -0.3, 10));
  // leather chair
  g.add(box(0.7, 0.14, 0.7, mat(0x5a0a0a, { roughness: 0.35 }), 0, 0.5, -0.95));
  g.add(box(0.7, 1.0, 0.14, mat(0x5a0a0a, { roughness: 0.35 }), 0, 1.0, -1.28));
  g.add(cyl(0.05, 0.05, 0.4, CHROME(), 0, 0.22, -0.95, 8));
  g.add(cyl(0.3, 0.3, 0.03, CHROME(), 0, 0.03, -0.95, 12));
  return g;
}

export function makeCashierCage(w = 3) {
  const g = new THREE.Group();
  g.add(box(w, 1.1, 0.5, mat(0x3a2414), 0, 0.55, 0));
  g.add(box(w + 0.1, 0.06, 0.6, GOLD(), 0, 1.13, 0));
  for (let x = -w / 2 + 0.15; x <= w / 2; x += 0.18) g.add(cyl(0.012, 0.012, 1.6, GOLD(), x, 1.9, 0, 6));
  g.add(box(w, 0.08, 0.08, GOLD(), 0, 2.7, 0));
  const s = textPlane('CASHIER · NO CASH-OUTS AFTER 9', { w: w - 0.2, h: 0.28, color: '#ffe08a', glowColor: '#ffcc00' }); s.position.set(0, 2.95, 0.05); g.add(s);
  return g;
}

export function makeBar(len = 4) {
  const g = new THREE.Group();
  const wood = mat(0x3a1e0e, { roughness: 0.4, flatShading: false });
  g.add(box(len, 1.05, 0.8, wood, 0, 0.55, 0));
  g.add(box(len + 0.2, 0.08, 1.0, mat(0x111116, { roughness: 0.2, metalness: 0.3, flatShading: false }), 0, 1.12, 0));
  g.add(box(len + 0.1, 0.05, 0.05, glow(0xff2e88, 2.0), 0, 0.12, 0.42)); // LED underglow
  const led = new THREE.PointLight(0xff2e88, 4, 4, 2); led.position.set(0, 0.3, 0.8); g.add(led);
  // back bar with mirror + bottles
  g.add(box(len, 2.6, 0.12, wood, 0, 1.3, -1.1));
  g.add(box(len - 0.3, 1.2, 0.02, mat(0x8090a0, { metalness: 0.95, roughness: 0.05, flatShading: false }), 0, 1.9, -1.03));
  g.add(box(len, 0.06, 0.32, wood, 0, 1.55, -0.9)); g.add(box(len, 0.06, 0.32, wood, 0, 2.15, -0.9));
  const cols = [0x2ecc71, 0xe67e22, 0x3498db, 0xecf0f1, 0x9b59b6, 0xf1c40f];
  for (let row = 0; row < 2; row++) for (let i = 0; i < len * 3; i++) {
    const x = -len / 2 + 0.25 + i * (len - 0.5) / (len * 3 - 1);
    g.add(cyl(0.035, 0.05, 0.3, mat(cols[(i + row) % cols.length], { roughness: 0.1, transparent: true, opacity: 0.85, flatShading: false }), x, 1.58 + row * 0.6 + 0.15, -0.9, 8));
    g.add(cyl(0.015, 0.015, 0.1, mat(0x222222), x, 1.58 + row * 0.6 + 0.35, -0.9, 6));
  }
  const strip = new THREE.PointLight(0xffb060, 3, 5, 2); strip.position.set(0, 2.3, -0.8); g.add(strip);
  for (let i = 0; i < Math.floor(len / 1.1); i++) { const st = makeStool(); st.position.set(-len / 2 + 0.6 + i * 1.1, 0, 0.9); g.add(st); }
  const sign = textPlane('FREE DRINKS', { w: 2.2, h: 0.5, color: '#fff', glowColor: '#ff2e88', emissive: true }); sign.material.color = new THREE.Color('#ff2e88').multiplyScalar(2); sign.position.set(0, 2.45, -1.0); g.add(sign);
  return g;
}

export function makeATM() {
  const g = new THREE.Group();
  g.add(box(0.8, 1.7, 0.6, mat(0x1f3a5a, { roughness: 0.4, metalness: 0.2, flatShading: false }), 0, 0.85, 0));
  g.add(box(0.84, 0.08, 0.64, CHROME(), 0, 1.72, 0));
  g.add(box(0.5, 0.36, 0.04, glow(0x99ddff, 0.9), 0, 1.25, 0.31));
  g.add(box(0.5, 0.05, 0.04, mat(0x050505), 0, 0.82, 0.31));
  g.add(box(0.5, 0.18, 0.04, mat(0x0a0a0a), 0, 0.98, 0.31));
  for (let i = 0; i < 12; i++) g.add(box(0.08, 0.02, 0.06, mat(0xdddddd), -0.15 + (i % 3) * 0.15, 1.06 - Math.floor(i / 3) * 0.05, 0.33));
  const s = textPlane('ATM · 9% FEE', { w: 0.7, h: 0.18, color: '#fff', glowColor: '#99ddff' }); s.position.set(0, 1.55, 0.31); g.add(s);
  const l = new THREE.PointLight(0x99ddff, 1.5, 3, 2); l.position.set(0, 1.3, 0.6); g.add(l);
  return g;
}

export function makeSconce(color = 0xffb060) {
  const g = new THREE.Group();
  g.add(box(0.14, 0.4, 0.06, GOLD(), 0, 0, 0));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 12, 1, true), glow(0xfff0c0, 0.8, { side: THREE.DoubleSide })); shade.rotation.x = Math.PI; shade.position.set(0, 0.22, 0.12); g.add(shade);
  g.add(sph(0.06, glow(0xfff0c0, 3), 0, 0.2, 0.12, 8));
  g.userData.light = { intensity: 0 };
  return g;
}

export function makeChandelier(r = 1.2) {
  const g = new THREE.Group();
  g.add(cyl(0.02, 0.02, 1.2, GOLD(), 0, 0.6, 0, 6));
  g.add(torus(r, 0.05, GOLD(), 0, 0, 0).rotateX(Math.PI / 2));
  g.add(torus(r * 0.55, 0.04, GOLD(), 0, -0.35, 0).rotateX(Math.PI / 2));
  const n = 10;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.add(sph(0.07, glow(0xfff2c0, 2.2), Math.cos(a) * r, 0.12, Math.sin(a) * r, 8)); g.add(cyl(0.015, 0.015, 0.2, GOLD(), Math.cos(a) * r, 0.02, Math.sin(a) * r, 6)); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(sph(0.06, glow(0xfff2c0, 2.2), Math.cos(a) * r * 0.55, -0.25, Math.sin(a) * r * 0.55, 8)); }
  // crystals
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; g.add(box(0.04, 0.16 + Math.random() * 0.1, 0.04, mat(0xffffff, { metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.7, flatShading: false }), Math.cos(a) * r, -0.12, Math.sin(a) * r)); }
  const l = new THREE.PointLight(0xffe2b0, 30, 18, 1.6); l.position.y = -0.2; g.add(l);
  g.userData.light = l;
  return g;
}

export function makeVelvetRope(len = 3) {
  const g = new THREE.Group();
  for (const x of [-len / 2, len / 2]) { g.add(cyl(0.03, 0.03, 1.0, GOLD(), x, 0.5, 0, 8)); g.add(cyl(0.16, 0.18, 0.04, GOLD(), x, 0.02, 0, 12)); g.add(sph(0.05, GOLD(), x, 1.02, 0, 8)); }
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-len / 2, 0.98, 0), new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(len / 2, 0.98, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.035, 8), mat(0x8b0020, { roughness: 0.6 })));
  return g;
}

export function makePlanter() {
  const g = new THREE.Group();
  g.add(cyl(0.32, 0.26, 0.55, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.28, 0, 10));
  g.add(cyl(0.34, 0.34, 0.04, GOLD(), 0, 0.56, 0, 10));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const leaf = box(0.12, 0.9, 0.02, mat(0x1f7a3a, { side: THREE.DoubleSide }), Math.cos(a) * 0.15, 1.0, Math.sin(a) * 0.15); leaf.rotation.y = -a; leaf.rotation.z = (i % 2 ? 0.35 : -0.35) * Math.cos(a); leaf.rotation.x = 0.35; g.add(leaf); }
  return g;
}

export function makeDoubleDoor(w = 3, h = 3.2) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const d = new THREE.Group();
    d.add(box(w / 2 - 0.05, h, 0.08, mat(0x2a1608, { roughness: 0.35, flatShading: false }), 0, h / 2, 0));
    d.add(cyl(0.22, 0.22, 0.1, mat(0x203040, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7, flatShading: false }), 0, h * 0.62, 0, 16).rotateX(Math.PI / 2));
    d.add(box(0.5, 0.05, 0.05, GOLD(), 0, h * 0.4, 0.07));
    d.position.x = s * w / 4; g.add(d);
  }
  g.add(box(w + 0.3, 0.15, 0.3, GOLD(), 0, h + 0.05, 0));
  for (const x of [-w / 2 - 0.08, w / 2 + 0.08]) g.add(box(0.15, h + 0.1, 0.3, GOLD(), x, h / 2, 0));
  return g;
}

export function makeVent() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.3, 0.08, mat(0xb0b4bb, { metalness: 0.7, roughness: 0.35, flatShading: false }), 0, 0, 0));
  for (let i = -2; i <= 2; i++) g.add(box(0.7, 0.025, 0.02, mat(0x333333), 0, i * 0.05, 0.05));
  return g;
}

export function makeCamera() {
  const g = new THREE.Group();
  g.add(sph(0.16, mat(0x101014, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9, flatShading: false }), 0, 0, 0, 12));
  g.add(cyl(0.18, 0.18, 0.04, CHROME(), 0, 0.12, 0, 12));
  g.add(sph(0.03, glow(0xff0000, 3), 0, -0.05, 0.13, 6));
  return g;
}

export function makeClock() {
  const g = new THREE.Group();
  g.add(cyl(0.36, 0.36, 0.06, GOLD(), 0, 0, 0, 20).rotateX(Math.PI / 2));
  g.add(cyl(0.32, 0.32, 0.02, mat(0xf5f0e0), 0, 0, 0.03, 20).rotateX(Math.PI / 2));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(box(0.02, 0.05, 0.01, mat(0x111111), Math.sin(a) * 0.27, Math.cos(a) * 0.27, 0.045).rotateZ(-a)); }
  g.add(box(0.025, 0.22, 0.01, mat(0x111111), 0, 0.09, 0.05));
  g.add(box(0.025, 0.16, 0.01, mat(0x111111), 0.05, 0.05, 0.05).rotateZ(-1));
  return g;
}

export function makeCart() {
  const g = new THREE.Group();
  g.add(box(1.2, 0.8, 0.8, mat(0x4a5a6a, { metalness: 0.6, roughness: 0.4, flatShading: false }), 0, 0.7, 0));
  g.add(box(1.24, 0.04, 0.84, GOLD(), 0, 1.11, 0));
  g.add(box(1.0, 0.25, 0.6, glow(0x3cb371, 0.3), 0, 1.22, 0));
  g.add(textPlane('ARMORED', { w: 0.9, h: 0.2, color: '#fff' }).translateY(0.7).translateZ(0.41));
  for (const x of [-0.4, 0.4]) for (const z of [-0.42, 0.42]) g.add(cyl(0.15, 0.15, 0.1, mat(0x111111), x, 0.15, z, 12).rotateX(Math.PI / 2));
  g.add(cyl(0.025, 0.025, 1.0, CHROME(), -0.75, 1.0, 0, 8));
  return g;
}

// ---------------------------------------------------------------------------
// statues, awards, showpieces
// ---------------------------------------------------------------------------
export function makeStatue(kind = 'rat') {
  const g = new THREE.Group();
  const gold = GOLD();
  g.add(box(1.4, 0.5, 1.4, mat(0x1a1a1a, { roughness: 0.2, metalness: 0.2, flatShading: false }), 0, 0.25, 0));
  g.add(box(1.5, 0.06, 1.5, gold, 0, 0.53, 0));
  if (kind === 'rat') {
    g.add(sph(0.55, gold, 0, 1.05, 0, 12));
    g.add(sph(0.32, gold, 0, 1.6, 0.35, 12));
    g.add(sph(0.14, gold, -0.22, 1.85, 0.3, 8)); g.add(sph(0.14, gold, 0.22, 1.85, 0.3, 8));
    g.add(sph(0.06, mat(0x111111, { roughness: 0.1 }), 0, 1.6, 0.66, 8));
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.7, -0.5), new THREE.Vector3(0.5, 0.6, -1.1), new THREE.Vector3(0.9, 0.9, -1.0)), 10, 0.05, 6), gold); g.add(tail);
    g.add(cyl(0.04, 0.02, 0.5, gold, 0.45, 1.9, 0.45, 6).rotateZ(-0.5)); // whisker-ish
  } else {
    // the owner, heroic pose, pointing at the future
    g.add(cyl(0.38, 0.45, 1.5, gold, 0, 1.3, 0, 12));
    g.add(box(0.9, 0.5, 0.5, gold, 0, 2.15, 0));
    g.add(box(0.44, 0.5, 0.44, gold, 0, 2.62, 0));
    g.add(box(0.5, 0.12, 0.5, gold, 0, 2.9, -0.02));
    g.add(cyl(0.09, 0.09, 1.1, gold, 0.6, 2.35, 0.35, 8).rotateX(-1.4).rotateZ(-0.3));
    g.add(cyl(0.09, 0.09, 0.9, gold, -0.55, 1.75, 0, 8));
    g.add(cyl(0.03, 0.03, 1.1, gold, -0.55, 1.2, 0.05, 6)); // cane
  }
  const l = new THREE.PointLight(0xffd070, 6, 6, 2); l.position.set(0, 2.4, 1); g.add(l);
  return g;
}

export function makeToilet() {
  const g = new THREE.Group();
  const gold = GOLD();
  g.add(cyl(0.3, 0.26, 0.42, gold, 0, 0.21, 0.05, 14));
  g.add(box(0.5, 0.7, 0.28, gold, 0, 0.6, -0.32));
  g.add(cyl(0.34, 0.34, 0.05, gold, 0, 0.45, 0.05, 14));
  g.add(cyl(0.26, 0.26, 0.02, mat(0x8fd3ff, { roughness: 0.05, metalness: 0.2, flatShading: false }), 0, 0.46, 0.05, 14));
  g.add(cyl(0.02, 0.02, 0.2, gold, 0.18, 1.0, -0.32, 6));
  g.add(box(1.0, 0.06, 1.0, mat(0x8b0000, { roughness: 0.6 }), 0, 0.03, 0));
  const spot = new THREE.PointLight(0xffd070, 5, 4, 2); spot.position.set(0, 1.6, 0.5); g.add(spot);
  const rope = makeVelvetRope(1.6); rope.position.z = 0.8; g.add(rope);
  const s = textPlane('SOLID GOLD · DO NOT SIT', { w: 1.4, h: 0.2, color: '#e8b923' }); s.position.set(0, 1.25, -0.2); g.add(s);
  return g;
}

export function makeTiger() {
  const g = new THREE.Group();
  const orange = mat(0xe67e22, { roughness: 0.7 });
  const body = box(1.4, 0.6, 0.6, orange, 0, 0.7, 0); g.add(body);
  for (let i = -2; i <= 2; i++) g.add(box(0.1, 0.62, 0.62, mat(0x111111), i * 0.28, 0.7, 0));
  g.add(box(0.55, 0.5, 0.5, orange, 0.95, 0.9, 0));
  g.add(box(0.2, 0.15, 0.32, mat(0xffffff), 1.2, 0.78, 0));
  g.add(box(0.12, 0.12, 0.12, orange, 1.05, 1.2, 0.16)); g.add(box(0.12, 0.12, 0.12, orange, 1.05, 1.2, -0.16));
  g.add(sph(0.05, glow(0xffee00, 1.5), 1.22, 0.98, 0.14, 6)); g.add(sph(0.05, glow(0xffee00, 1.5), 1.22, 0.98, -0.14, 6));
  for (const [x, z] of [[-0.5, 0.2], [-0.5, -0.2], [0.5, 0.2], [0.5, -0.2]]) g.add(box(0.18, 0.5, 0.18, orange, x, 0.25, z));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.7, 0.85, 0), new THREE.Vector3(-1.3, 1.1, 0), new THREE.Vector3(-1.5, 0.7, 0.2)), 10, 0.04, 6), orange); g.add(tail);
  // gilded cage
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(cyl(0.03, 0.03, 2.0, GOLD(), Math.cos(a) * 1.4, 1.0, Math.sin(a) * 1.4, 6)); }
  g.add(torus(1.4, 0.04, GOLD(), 0, 2.0, 0).rotateX(Math.PI / 2)); g.add(torus(1.4, 0.04, GOLD(), 0, 0.05, 0).rotateX(Math.PI / 2));
  const s = textPlane('AUDIT', { w: 1.2, h: 0.3, color: '#e8b923', glowColor: '#e8b923' }); s.position.set(0, 2.3, 1.4); g.add(s);
  g.userData.tail = tail;
  return g;
}

export function makeFountain() {
  const g = new THREE.Group();
  const marble = mat(0xd8d0c8, { roughness: 0.25, flatShading: false });
  g.add(cyl(1.5, 1.6, 0.4, marble, 0, 0.2, 0, 24));
  g.add(cyl(1.35, 1.35, 0.1, mat(0xf5d76e, { roughness: 0.05, metalness: 0.3, flatShading: false }), 0, 0.42, 0, 24));
  g.add(cyl(0.2, 0.32, 1.2, marble, 0, 0.9, 0, 12));
  g.add(cyl(0.7, 0.75, 0.2, marble, 0, 1.5, 0, 16));
  g.add(cyl(0.6, 0.6, 0.06, mat(0xf5d76e, { roughness: 0.05, flatShading: false }), 0, 1.6, 0, 16));
  g.add(cyl(0.1, 0.16, 0.7, marble, 0, 1.95, 0, 10));
  const jet = cyl(0.08, 0.02, 0.9, glow(0xfff2b0, 0.6, { transparent: true, opacity: 0.8 }), 0, 2.7, 0, 8); g.add(jet);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(cyl(0.03, 0.01, 0.9, glow(0xfff2b0, 0.5, { transparent: true, opacity: 0.6 }), Math.cos(a) * 0.5, 1.3, Math.sin(a) * 0.5, 6).rotateZ(Math.cos(a) * 0.6).rotateX(-Math.sin(a) * 0.6)); }
  const l = new THREE.PointLight(0xffe8a0, 8, 8, 2); l.position.y = 2.5; g.add(l);
  g.userData.jet = jet;
  return g;
}

export function makeVolcano() {
  const g = new THREE.Group();
  g.add(cyl(0.9, 2.6, 2.6, mat(0x3a2418, { roughness: 0.95 }), 0, 1.3, 0, 14));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(box(0.3, 0.5, 0.3, mat(0x2a1a10), Math.cos(a) * 2.0, 0.6, Math.sin(a) * 2.0).rotateY(a)); }
  const lava = cyl(0.8, 0.8, 0.2, glow(0xff4400, 2.5), 0, 2.65, 0, 14); g.add(lava);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(box(0.12, 1.2, 0.12, glow(0xff5a00, 1.8), Math.cos(a) * 1.2, 1.4, Math.sin(a) * 1.2).rotateZ(Math.cos(a) * 0.9).rotateX(Math.sin(a) * 0.9)); }
  const light = new THREE.PointLight(0xff5500, 14, 14, 1.8); light.position.y = 3; g.add(light);
  g.add(torus(3.0, 0.15, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.08, 0).rotateX(Math.PI / 2));
  g.userData = { lava, light };
  return g;
}

export function makeTower(color = 0x3a1a1a) {
  const g = new THREE.Group();
  g.add(box(14, 30, 10, mat(color, { roughness: 0.6 }), 0, 15, 0));
  g.add(box(14.4, 0.4, 10.4, GOLD(), 0, 30.2, 0));
  for (let y = 2; y < 29; y += 2.2) for (let x = -5.5; x <= 5.5; x += 1.6) if (Math.random() < 0.8) g.add(box(0.9, 1.2, 0.06, glow(0xffe08a, 0.3 + Math.random() * 0.6), x, y, 5.04));
  for (let y = 2; y < 29; y += 2.2) for (let z = -3.5; z <= 3.5; z += 1.6) if (Math.random() < 0.8) g.add(box(0.06, 1.2, 0.9, glow(0xffe08a, 0.3 + Math.random() * 0.6), 7.04, y, z));
  g.add(box(2, 3, 2, mat(color), 0, 32, 0)); g.add(cyl(0.05, 0.05, 6, CHROME(), 0, 36, 0, 6)); g.add(sph(0.2, glow(0xff0000, 4), 0, 39, 0, 8));
  const t = makeNeonSign('PALAZZO DIABLO', '#ff2255', 12, { intensity: 20 }); t.position.set(0, 27, 5.2); g.add(t);
  g.userData.sign = t;
  return g;
}

export function makeJet() {
  const g = new THREE.Group();
  const white = mat(0xf0f0f0, { roughness: 0.25, metalness: 0.1, flatShading: false });
  g.add(cyl(0.6, 0.6, 8, white, 0, 0, 0, 14).rotateZ(Math.PI / 2));
  g.add(cyl(0.05, 0.6, 1.6, white, 4.8, 0, 0, 14).rotateZ(-Math.PI / 2));
  g.add(cyl(0.6, 0.45, 1.2, white, -4.6, 0.05, 0, 14).rotateZ(Math.PI / 2));
  g.add(box(1.2, 0.1, 7, white, 0, -0.2, 0).rotateY(0.1));
  g.add(box(2, 1.5, 0.1, white, -3.6, 0.9, 0)); g.add(box(0.1, 0.4, 2.4, white, -4.2, 0.3, 0));
  g.add(cyl(0.3, 0.3, 1.3, mat(0x333333, { metalness: 0.7, roughness: 0.3, flatShading: false }), -2.4, -0.3, 1.2, 10).rotateZ(Math.PI / 2));
  g.add(cyl(0.3, 0.3, 1.3, mat(0x333333, { metalness: 0.7, roughness: 0.3, flatShading: false }), -2.4, -0.3, -1.2, 10).rotateZ(Math.PI / 2));
  for (let i = 0; i < 6; i++) g.add(box(0.3, 0.3, 0.04, glow(0xffe08a, 0.8), 2.5 - i * 0.9, 0.15, 0.6));
  g.add(box(1.4, 0.06, 0.06, mat(0x8b0000), 0, 0.55, 0.6));
  g.add(sph(0.08, glow(0xff0000, 3), 0, 0.0, 3.4, 6)); g.add(sph(0.08, glow(0x00ff44, 3), 0, 0.0, -3.4, 6));
  return g;
}

// ---------------------------------------------------------------------------
// street
// ---------------------------------------------------------------------------
export function makeBus(color = 0xffcc00, text = 'PLAY TO WIN!') {
  const g = new THREE.Group();
  const paint = mat(color, { roughness: 0.4, metalness: 0.1, flatShading: false });
  g.add(box(6, 1.9, 2.2, paint, 0, 1.45, 0));
  g.add(box(6.1, 0.5, 2.3, mat(0x222222), 0, 0.55, 0));
  g.add(box(6, 0.1, 2.24, mat(0x333333), 0, 2.42, 0));
  for (let i = -2; i <= 2; i++) for (const s of [1, -1]) g.add(box(0.85, 0.6, 0.06, mat(0x203050, { roughness: 0.1, metalness: 0.4, flatShading: false }), i * 1.1, 1.75, s * 1.11));
  g.add(box(0.06, 0.9, 1.9, mat(0x203050, { roughness: 0.1, metalness: 0.4, flatShading: false }), 3.01, 1.6, 0));
  for (const z of [-0.7, 0.7]) { g.add(sph(0.14, glow(0xfff2b0, 3), 3.05, 0.95, z, 8)); g.add(sph(0.1, glow(0xff2222, 2.5), -3.05, 0.95, z, 8)); }
  const head = new THREE.SpotLight(0xfff2b0, 40, 18, 0.5, 0.6, 1.5); head.position.set(3, 0.9, 0); head.target.position.set(12, 0, 0); g.add(head); g.add(head.target);
  for (const x of [-2, 2]) for (const z of [-1.1, 1.1]) { g.add(cyl(0.45, 0.45, 0.3, mat(0x111111), x, 0.45, z, 14).rotateX(Math.PI / 2)); g.add(cyl(0.25, 0.25, 0.32, CHROME(), x, 0.45, z, 10).rotateX(Math.PI / 2)); }
  const t = textPlane(text, { w: 5.2, h: 0.7, color: '#111', font: 'bold 110px Impact, Arial Black' });
  t.position.set(0, 1.0, 1.16); g.add(t);
  const t2 = t.clone(); t2.rotation.y = Math.PI; t2.position.z = -1.16; g.add(t2);
  return g;
}

export function makeCar(color = 0x8b0000) {
  const g = new THREE.Group();
  const paint = mat(color, { roughness: 0.25, metalness: 0.4, flatShading: false });
  g.add(box(4.2, 0.6, 1.9, paint, 0, 0.6, 0));
  g.add(box(2.4, 0.6, 1.7, paint, -0.2, 1.15, 0));
  g.add(box(2.2, 0.5, 1.74, mat(0x203050, { roughness: 0.05, metalness: 0.5, flatShading: false }), -0.2, 1.17, 0));
  for (const x of [-1.4, 1.4]) for (const z of [-0.95, 0.95]) { g.add(cyl(0.36, 0.36, 0.26, mat(0x111111), x, 0.36, z, 14).rotateX(Math.PI / 2)); g.add(cyl(0.2, 0.2, 0.28, CHROME(), x, 0.36, z, 10).rotateX(Math.PI / 2)); }
  for (const z of [-0.6, 0.6]) { g.add(box(0.05, 0.2, 0.35, glow(0xfff2b0, 2.5), 2.1, 0.7, z)); g.add(box(0.05, 0.15, 0.4, glow(0xff2222, 2.5), -2.1, 0.7, z)); }
  g.add(box(0.1, 0.1, 1.8, CHROME(), 2.12, 0.45, 0));
  return g;
}

export function makeBillboard(text = 'YOU WILL WIN*', sub = '*you will not win') {
  const g = new THREE.Group();
  g.add(cyl(0.25, 0.3, 6, mat(0x444444, { metalness: 0.5, roughness: 0.5 }), 0, 3, 0, 10));
  g.add(box(9.4, 4.4, 0.25, mat(0x1a1a1a), 0, 7, -0.05));
  g.add(box(9, 4, 0.1, mat(0xf4f0e6, { roughness: 0.9 }), 0, 7, 0.1));
  // bulb frame
  for (let i = 0; i < 16; i++) { g.add(sph(0.1, glow(0xfff2b0, 2), -4.4 + i * 0.58, 9.1, 0.2, 6)); g.add(sph(0.1, glow(0xfff2b0, 2), -4.4 + i * 0.58, 4.9, 0.2, 6)); }
  const t = textPlane(text, { w: 8.5, h: 2.0, color: '#c0392b' }); t.position.set(0, 7.6, 0.17); g.add(t);
  const s = textPlane(sub, { w: 8.5, h: 0.7, color: '#555', font: 'italic 50px Georgia' }); s.position.set(0, 5.7, 0.17); g.add(s);
  // the owner's face, smug
  const face = plane(1.6, 1.6, new THREE.MeshBasicMaterial({ map: T.faceTexture('sneer', '#e0ac69') }), -3.4, 7.1, 0.17); g.add(face);
  for (const x of [-3, 0, 3]) { const l = new THREE.SpotLight(0xffffff, 30, 10, 0.7, 0.5, 1.2); l.position.set(x, 4.6, 1.6); l.target.position.set(x, 7, 0); g.add(l); g.add(l.target); }
  return g;
}

export function makeNeighbourShop(kind = 'pawn', w = 8, h = 5) {
  const g = new THREE.Group();
  g.add(box(w, h, 6, texMat(T.brickTexture(), { roughness: 0.95 }), 0, h / 2, -3));
  g.add(box(w + 0.2, 0.3, 6.2, mat(0x222222), 0, h + 0.1, -3));
  g.add(box(w - 1, 2.2, 0.1, mat(0x101820, { roughness: 0.1, metalness: 0.4, flatShading: false }), 0, 1.6, 0.05));
  g.add(box(w - 0.9, 0.5, 0.3, mat(0x2a1a10), 0, 2.9, 0.1));
  if (kind === 'pawn') {
    const s = makeNeonSign('PAWN · LOANS · GOLD', '#4dff88', w - 1.5, { intensity: 6 }); s.position.set(0, 3.8, 0.2); g.add(s);
    for (let i = 0; i < 3; i++) g.add(sph(0.22, GOLD(), -0.5 + i * 0.5, 0.9 + (i === 1 ? -0.35 : 0), 0.1, 10));
    g.add(box(1.2, 1.4, 0.08, mat(0x111111), 2, 1.2, 0.1)); // grated door
    for (let i = 0; i < 6; i++) g.add(box(0.03, 1.4, 0.1, CHROME(), 1.5 + i * 0.2, 1.2, 0.15));
  } else if (kind === 'bail') {
    const s = makeNeonSign('24HR BAIL BONDS', '#ff5533', w - 1.5, { intensity: 6 }); s.position.set(0, 3.8, 0.2); g.add(s);
    g.add(textPlane('OPEN', { w: 1.2, h: 0.5, color: '#ff2222', glowColor: '#ff2222', emissive: true }).translateX(-2).translateY(1.9).translateZ(0.12));
  } else {
    const s = makeNeonSign(kind, '#ff44aa', w - 1.5, { intensity: 6 }); s.position.set(0, 3.8, 0.2); g.add(s);
  }
  g.userData.sign = g.children.find(c => c.userData && c.userData.light);
  return g;
}

export function makeDumpster() {
  const g = new THREE.Group();
  g.add(box(2, 1.2, 1.1, mat(0x2d5a3a, { roughness: 0.8 }), 0, 0.65, 0));
  g.add(box(2.05, 0.12, 1.15, mat(0x1e3d28), 0, 1.28, 0).rotateX(-0.1));
  g.add(box(0.5, 0.35, 0.4, mat(0x111111), 0.7, 1.45, 0.1)); g.add(box(0.4, 0.3, 0.3, mat(0x3a3a3a), -0.4, 1.4, -0.1));
  for (const x of [-0.8, 0.8]) g.add(cyl(0.12, 0.12, 0.1, mat(0x111111), x, 0.06, 0.4, 8).rotateX(Math.PI / 2));
  return g;
}

export function makeHydrant() {
  const g = new THREE.Group();
  const red = mat(0xc0392b, { roughness: 0.4 });
  g.add(cyl(0.14, 0.16, 0.7, red, 0, 0.35, 0, 10)); g.add(sph(0.15, red, 0, 0.72, 0, 10));
  g.add(cyl(0.06, 0.06, 0.34, red, 0, 0.45, 0, 8).rotateZ(Math.PI / 2)); g.add(cyl(0.05, 0.05, 0.2, red, 0, 0.5, 0.18, 8).rotateX(Math.PI / 2));
  return g;
}

export function makeStreetLamp() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.11, 5.2, mat(0x2a2a30, { metalness: 0.6, roughness: 0.5 }), 0, 2.6, 0, 8));
  g.add(cyl(0.2, 0.25, 0.3, mat(0x2a2a30, { metalness: 0.6 }), 0, 0.15, 0, 8));
  g.add(box(0.4, 0.14, 0.4, mat(0x2a2a30), 0, 5.2, 0));
  g.add(box(0.3, 0.16, 0.3, glow(0xffd9a0, 2.2), 0, 5.06, 0));
  const l = new THREE.PointLight(0xffd9a0, 60, 22, 1.7); l.position.set(0, 5, 0); g.add(l);
  g.userData.light = l;
  return g;
}
