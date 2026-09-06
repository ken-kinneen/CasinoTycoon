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
export function glow(color, intensity = 1.2, opts = {}) { return mat(color, { emissive: color, emissiveIntensity: Math.min(intensity, 1.2), roughness: 0.4, ...opts }); }
export const GOLD = () => mat(0xe8b923, { metalness: 0.85, roughness: 0.28, flatShading: false, envMapIntensity: 0.3 });
export const CHROME = () => mat(0xb8bcc6, { metalness: 0.85, roughness: 0.32, flatShading: false, envMapIntensity: 0.25 });
export const BLACK_GLOSS = () => mat(0x0c0c12, { metalness: 0.3, roughness: 0.25, flatShading: false });
const texMatCache = new Map();
export function texMat(map, opts = {}) {
  const key = `${map.uuid}|${JSON.stringify(opts)}`;
  if (!texMatCache.has(key)) texMatCache.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0.02, ...opts }));
  return texMatCache.get(key);
}

const geoCache = new Map();
function cachedBoxGeo(w, h, d) {
  const k = `b${w},${h},${d}`;
  if (!geoCache.has(k)) { const g = new THREE.BoxGeometry(w, h, d); g._cached = true; geoCache.set(k, g); }
  return geoCache.get(k);
}
function cachedCylGeo(rt, rb, h, seg) {
  const k = `c${rt},${rb},${h},${seg}`;
  if (!geoCache.has(k)) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g._cached = true; geoCache.set(k, g); }
  return geoCache.get(k);
}
function cachedSphGeo(r, seg) {
  const k = `s${r},${seg}`;
  if (!geoCache.has(k)) { const g = new THREE.SphereGeometry(r, seg, seg); g._cached = true; geoCache.set(k, g); }
  return geoCache.get(k);
}
function cachedCapGeo(radius, length, capSeg, radialSeg) {
  const k = `cap${radius},${length},${capSeg},${radialSeg}`;
  if (!geoCache.has(k)) {
    const g = new THREE.CapsuleGeometry(radius, length, capSeg, radialSeg);
    g._cached = true;
    geoCache.set(k, g);
  }
  return geoCache.get(k);
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cachedBoxGeo(w, h, d), material);
  m.position.set(x, y, z);
  const big = w > 1.0 && h > 0.5 && d > 1.0;
  m.castShadow = big; m.receiveShadow = true; return m;
}
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(cachedCylGeo(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  const big = Math.max(rt, rb) > 0.5 && h > 0.5;
  m.castShadow = big; m.receiveShadow = true; return m;
}
export function sph(r, material, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(cachedSphGeo(r, seg), material);
  m.position.set(x, y, z); m.castShadow = r > 0.5; return m;
}
/** Capsule along Y. `length` is the cylindrical midsection height (total height ≈ length + 2*radius). */
export function capsule(radius, length, material, x = 0, y = 0, z = 0, { capSeg = 4, radialSeg = 8, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Mesh(cachedCapGeo(radius, length, capSeg, radialSeg), material);
  m.position.set(x, y, z);
  if (sx !== 1 || sy !== 1 || sz !== 1) m.scale.set(sx, sy, sz);
  m.castShadow = radius > 0.08; m.receiveShadow = true;
  return m;
}
export function torus(r, tube, material, x = 0, y = 0, z = 0, arc = Math.PI * 2) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24, arc), material);
  m.position.set(x, y, z); m.castShadow = r > 0.3; return m;
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
export function makeNeonSign(text, color = '#ffcc00', w = 7, { intensity = 6, font } = {}) {
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
  // stool
  const stool = makeStool(); stool.position.set(0, 0, 0.85); g.add(stool);
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
  const chipCols = [0xff3333, 0x2b6bff, 0x111111, 0x2ecc71, 0xe0ddd5];
  for (let i = 0; i < 6; i++) g.add(cyl(0.05, 0.05, 0.08, mat(chipCols[i % 5], { roughness: 0.4, envMapIntensity: 0.15 }), -0.35 + i * 0.14, 1.04, -0.05, 10));
  g.add(box(0.28, 0.12, 0.2, BLACK_GLOSS(), 0.9, 1.0, 0.0));
  for (let i = 0; i < 4; i++) { const c = box(0.16, 0.005, 0.22, mat(0xd8d0c0, { roughness: 0.85, envMapIntensity: 0.05 }), -0.6 + i * 0.35, 0.96, 0.55); c.rotation.y = (Math.random() - 0.5) * 0.5; g.add(c); }
  // scattered chips on the felt
  for (let i = 0; i < 8; i++) g.add(cyl(0.05, 0.05, 0.02 + Math.random() * 0.08, mat(chipCols[i % 5], { roughness: 0.4, envMapIntensity: 0.15 }), (Math.random() - 0.5) * 2.2, 0.98, 0.3 + Math.random() * 0.7, 10));
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
  const deskLamp = new THREE.PointLight(0x7fffb0, 2.5, 3.5, 2); deskLamp.position.set(-0.7, 1.05, -0.1); g.add(deskLamp);
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

export function makeChandelier(r = 1.2, useLight = true) {
  const g = new THREE.Group();
  g.add(cyl(0.02, 0.02, 1.2, GOLD(), 0, 0.6, 0, 6));
  g.add(torus(r, 0.05, GOLD(), 0, 0, 0).rotateX(Math.PI / 2));
  g.add(torus(r * 0.55, 0.04, GOLD(), 0, -0.35, 0).rotateX(Math.PI / 2));
  const n = 10;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.add(sph(0.07, glow(0xfff2c0, 2.2), Math.cos(a) * r, 0.12, Math.sin(a) * r, 8)); g.add(cyl(0.015, 0.015, 0.2, GOLD(), Math.cos(a) * r, 0.02, Math.sin(a) * r, 6)); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(sph(0.06, glow(0xfff2c0, 2.2), Math.cos(a) * r * 0.55, -0.25, Math.sin(a) * r * 0.55, 8)); }
  // crystals
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; g.add(box(0.04, 0.16 + Math.random() * 0.1, 0.04, mat(0xffffff, { metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.7, flatShading: false }), Math.cos(a) * r, -0.12, Math.sin(a) * r)); }
  if (useLight) {
    const l = new THREE.PointLight(0xffe2b0, 10, 18, 1.6); l.position.y = -0.2; g.add(l);
    g.userData.light = l;
  } else {
    g.add(sph(0.3, glow(0xffe2b0, 1.0, { transparent: true, opacity: 0.5 }), 0, -0.15, 0, 8));
    g.userData.light = { intensity: 0, color: { set() {} } };
  }
  return g;
}

export function makeVelvetRope(len = 3) {
  const g = new THREE.Group();
  for (const x of [-len / 2, len / 2]) { g.add(cyl(0.03, 0.03, 1.0, GOLD(), x, 0.5, 0, 8)); g.add(cyl(0.16, 0.18, 0.04, GOLD(), x, 0.02, 0, 12)); g.add(sph(0.05, GOLD(), x, 1.02, 0, 8)); }
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-len / 2, 0.98, 0), new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(len / 2, 0.98, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.035, 8), mat(0x8b0020, { roughness: 0.6 })));
  return g;
}

export function makeColumn(h = 4.5, style = 'doric') {
  const g = new THREE.Group();
  const marble = mat(0xd8d0c8, { roughness: 0.25, metalness: 0.05, flatShading: false });
  const goldTrim = GOLD();
  // plinth
  g.add(box(0.6, 0.18, 0.6, marble, 0, 0.09, 0));
  g.add(box(0.52, 0.06, 0.52, goldTrim, 0, 0.21, 0));
  // shaft
  const shaftH = h - 0.8;
  g.add(cyl(0.18, 0.2, shaftH, marble, 0, 0.24 + shaftH / 2, 0, 14));
  // fluting grooves (visual detail)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.add(box(0.015, shaftH - 0.2, 0.04, mat(0xc0b8aa, { roughness: 0.4 }), Math.cos(a) * 0.19, 0.24 + shaftH / 2, Math.sin(a) * 0.19).rotateY(-a));
  }
  // capital
  if (style === 'ionic') {
    g.add(box(0.55, 0.12, 0.55, marble, 0, 0.24 + shaftH + 0.06, 0));
    g.add(box(0.65, 0.08, 0.65, goldTrim, 0, 0.24 + shaftH + 0.16, 0));
    // volutes (scroll shapes as small cylinders on the sides)
    for (const sx of [-0.3, 0.3]) g.add(cyl(0.08, 0.08, 0.06, marble, sx, 0.24 + shaftH + 0.06, 0, 10).rotateZ(Math.PI / 2));
  } else {
    g.add(box(0.5, 0.1, 0.5, marble, 0, 0.24 + shaftH + 0.05, 0));
    g.add(box(0.58, 0.06, 0.58, goldTrim, 0, 0.24 + shaftH + 0.13, 0));
  }
  return g;
}

export function makeLoungeChair() {
  const g = new THREE.Group();
  const velvet = mat(0x1a2848, { roughness: 0.5 });
  const wood = mat(0x2a1608, { roughness: 0.35, flatShading: false });
  // seat cushion
  g.add(box(0.7, 0.16, 0.6, velvet, 0, 0.44, 0));
  // back cushion
  g.add(box(0.7, 0.55, 0.12, velvet, 0, 0.8, -0.24));
  // armrests
  for (const sx of [-0.35, 0.35]) {
    g.add(box(0.06, 0.28, 0.5, wood, sx, 0.5, 0.02));
    g.add(box(0.1, 0.06, 0.56, wood, sx, 0.66, 0.02));
  }
  // legs
  for (const [lx, lz] of [[-0.28, 0.22], [0.28, 0.22], [-0.28, -0.22], [0.28, -0.22]])
    g.add(cyl(0.025, 0.03, 0.35, GOLD(), lx, 0.175, lz, 8));
  // button tufting (small gold studs on the back)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
    g.add(sph(0.015, GOLD(), -0.18 + i * 0.18, 0.65 + j * 0.2, -0.17, 6));
  return g;
}

export function makePlanter() {
  const g = new THREE.Group();
  g.add(cyl(0.32, 0.26, 0.55, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.28, 0, 10));
  g.add(cyl(0.34, 0.34, 0.04, GOLD(), 0, 0.56, 0, 10));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const leaf = box(0.12, 0.9, 0.02, mat(0x1f7a3a, { side: THREE.DoubleSide }), Math.cos(a) * 0.15, 1.0, Math.sin(a) * 0.15); leaf.rotation.y = -a; leaf.rotation.z = (i % 2 ? 0.35 : -0.35) * Math.cos(a); leaf.rotation.x = 0.35; g.add(leaf); }
  return g;
}

export function makeFireplace(tier = 'duck') {
  const g = new THREE.Group();
  const isMarble = tier !== 'duck';
  const surround = isMarble
    ? mat(0xd8d0c8, { roughness: 0.25, flatShading: false })
    : mat(0x6b3a1a, { roughness: 0.7 });
  const brick = mat(0x4a2210, { roughness: 0.95 });
  // firebox opening
  g.add(box(1.8, 1.4, 0.16, surround, 0, 0.7, 0));
  g.add(box(1.2, 1.0, 0.12, brick, 0, 0.5, 0.04));
  // mantel shelf
  g.add(box(2.1, 0.1, 0.4, isMarble ? surround : mat(0x3a1a08, { roughness: 0.4 }), 0, 1.42, 0.12));
  // mantel legs
  for (const sx of [-0.8, 0.8]) g.add(box(0.14, 1.32, 0.14, surround, sx, 0.66, 0.12));
  // decorative crown above mantel
  g.add(box(2.0, 0.08, 0.06, GOLD(), 0, 1.52, 0.14));
  // hearth base
  g.add(box(2.0, 0.08, 0.5, brick, 0, 0.04, 0.17));
  // logs inside
  for (let i = 0; i < 3; i++) {
    const lx = -0.25 + i * 0.25, lz = 0.04;
    g.add(cyl(0.06, 0.07, 0.7, mat(0x3a2010, { roughness: 0.9 }), lx, 0.17, lz, 8).rotateZ(Math.PI / 2 + (i - 1) * 0.15));
  }
  // fire glow
  g.add(box(0.8, 0.4, 0.1, glow(0xff5500, 2.8, { transparent: true, opacity: 0.7 }), 0, 0.35, 0.06));
  g.add(box(0.5, 0.25, 0.06, glow(0xffaa00, 2.2, { transparent: true, opacity: 0.6 }), 0.1, 0.45, 0.08));
  const fireLight = new THREE.PointLight(0xff6a20, 6, 6, 2);
  fireLight.position.set(0, 0.5, 0.6); g.add(fireLight);
  // fire screen (mesh grid)
  g.add(box(1.15, 0.9, 0.01, mat(0x222222, { transparent: true, opacity: 0.3, metalness: 0.5, roughness: 0.3 }), 0, 0.5, 0.13));
  // poker set on the side
  g.add(cyl(0.04, 0.06, 0.04, mat(0x111111), 0.75, 0.06, 0.3, 8));
  g.add(cyl(0.015, 0.015, 0.8, mat(0x222222, { metalness: 0.6 }), 0.75, 0.46, 0.3, 6));
  g.add(cyl(0.015, 0.015, 0.8, mat(0x222222, { metalness: 0.6 }), 0.79, 0.46, 0.3, 6));
  // mantel decorations: small trophy + candles
  g.add(cyl(0.04, 0.06, 0.18, GOLD(), -0.5, 1.56, 0.12, 8));
  g.add(cyl(0.03, 0.03, 0.14, mat(0xeee8d5), 0.5, 1.54, 0.12, 8));
  g.add(sph(0.02, glow(0xffcc44, 3), 0.5, 1.63, 0.12, 6));
  g.add(cyl(0.03, 0.03, 0.1, mat(0xeee8d5), 0.6, 1.52, 0.12, 8));
  g.add(sph(0.02, glow(0xffcc44, 3), 0.6, 1.59, 0.12, 6));
  g.userData = { fireLight };
  return g;
}

export function makeWallPainting(seed = 0) {
  const g = new THREE.Group();
  const pw = 1.0 + (seed % 3) * 0.3;
  const ph = 0.8 + ((seed + 1) % 3) * 0.2;
  // gold frame
  g.add(box(pw + 0.12, ph + 0.12, 0.04, GOLD(), 0, 0, 0));
  // dark backing
  const bgColors = [0x1a1a2e, 0x2e1a1a, 0x1a2e1a, 0x2a1a2e, 0x1e2a3a];
  const bg = bgColors[seed % bgColors.length];
  g.add(box(pw, ph, 0.03, mat(bg, { roughness: 0.85 }), 0, 0, 0.02));
  // abstract shapes that suggest a scene (landscape, portrait, abstract)
  const type = seed % 4;
  if (type === 0) {
    // landscape: horizon + moon
    g.add(box(pw * 0.9, ph * 0.25, 0.01, mat(0x2a4a2a), 0, -ph * 0.2, 0.04));
    g.add(box(pw * 0.9, ph * 0.08, 0.01, mat(0x3a3a7a), 0, -ph * 0.05, 0.04));
    g.add(sph(0.08, glow(0xfff8cc, 0.6), pw * 0.25, ph * 0.2, 0.04, 8));
  } else if (type === 1) {
    // portrait silhouette
    g.add(sph(0.14, mat(0x1a1a1a), 0, ph * 0.15, 0.04, 8));
    g.add(box(0.18, 0.25, 0.01, mat(0x1a1a1a), 0, -ph * 0.1, 0.04));
  } else if (type === 2) {
    // abstract color blocks
    const cols = [0x8b0000, 0xc8a020, 0x1a4a7a];
    for (let i = 0; i < 3; i++) g.add(box(pw * 0.25, ph * 0.6, 0.01, mat(cols[i]), -pw * 0.25 + i * pw * 0.25, 0, 0.04));
  } else {
    // playing cards motif
    g.add(box(0.15, 0.22, 0.01, mat(0xf0ece0), -0.12, 0.05, 0.04));
    g.add(box(0.15, 0.22, 0.01, mat(0xf0ece0), 0.04, 0, 0.04).rotateZ(0.2));
    g.add(box(0.15, 0.22, 0.01, mat(0xf0ece0), 0.18, -0.04, 0.04).rotateZ(-0.15));
    g.add(sph(0.04, mat(0xcc2222), -0.12, 0.1, 0.05, 6));
    g.add(sph(0.03, mat(0x111111), 0.06, 0.05, 0.05, 6));
  }
  return g;
}

export function makeCoffeeStation() {
  const g = new THREE.Group();
  const wood = mat(0x3a2010, { roughness: 0.45, flatShading: false });
  const counter = mat(0x1a1a1e, { roughness: 0.2, metalness: 0.3, flatShading: false });
  // counter body
  g.add(box(2.4, 0.96, 0.7, wood, 0, 0.48, 0));
  g.add(box(2.5, 0.06, 0.8, counter, 0, 0.99, 0));
  // coffee urn (tall cylinder with spigot)
  const urnMat = mat(0xc0c0cc, { metalness: 0.7, roughness: 0.25, flatShading: false });
  g.add(cyl(0.14, 0.16, 0.5, urnMat, -0.7, 1.27, 0, 12));
  g.add(cyl(0.16, 0.16, 0.03, urnMat, -0.7, 1.53, 0, 12));
  g.add(cyl(0.02, 0.02, 0.08, urnMat, -0.7, 1.56, 0, 6));
  g.add(box(0.04, 0.04, 0.08, mat(0x111111), -0.7, 1.12, 0.1));
  // "COFFEE" label
  g.add(box(0.2, 0.12, 0.01, mat(0x4a2a0a), -0.7, 1.35, 0.17));
  // stacked cups
  for (let i = 0; i < 3; i++) {
    g.add(cyl(0.04, 0.035, 0.07, mat(0xf0ece0), -0.35 + i * 0.1, 1.06, -0.1, 8));
  }
  // donut/pastry tray
  g.add(box(0.5, 0.04, 0.3, mat(0xf0ece0), 0.15, 1.04, 0));
  // donuts (small tori)
  for (let i = 0; i < 4; i++) {
    const dx = -0.05 + (i % 2) * 0.18, dz = -0.06 + Math.floor(i / 2) * 0.13;
    const donutColors = [0xd4881c, 0xe8638a, 0xc8a020, 0x8b4513];
    g.add(torus(0.04, 0.018, mat(donutColors[i], { roughness: 0.6 }), 0.15 + dx, 1.09, dz).rotateX(Math.PI / 2));
  }
  // napkin dispenser
  g.add(box(0.12, 0.16, 0.08, mat(0xc0c0cc, { metalness: 0.5, roughness: 0.35 }), 0.55, 1.1, 0.1));
  g.add(box(0.1, 0.02, 0.06, mat(0xf0ece0), 0.55, 1.19, 0.1));
  // second urn (hot water / tea)
  g.add(cyl(0.1, 0.12, 0.36, urnMat, 0.75, 1.2, 0, 10));
  g.add(cyl(0.12, 0.12, 0.03, urnMat, 0.75, 1.39, 0, 10));
  // sugar packets / stirrers holder
  g.add(box(0.14, 0.12, 0.08, mat(0x5a3a1a), -0.35, 1.08, 0.15));
  // small sign
  g.add(box(0.3, 0.2, 0.02, mat(0x2a1608), 0, 1.5, 0.41));
  g.add(box(0.26, 0.16, 0.01, mat(0xf0ece0), 0, 1.5, 0.42));
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
  const l = new THREE.PointLight(0xffd070, 4, 5, 2); l.position.set(0, 2.4, 1); g.add(l);
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
  const l = new THREE.PointLight(0xffe8a0, 4, 8, 2); l.position.y = 2.5; g.add(l);
  g.userData.jet = jet;
  return g;
}

export function makeVolcano() {
  const g = new THREE.Group();
  g.add(cyl(0.9, 2.6, 2.6, mat(0x3a2418, { roughness: 0.95 }), 0, 1.3, 0, 14));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(box(0.3, 0.5, 0.3, mat(0x2a1a10), Math.cos(a) * 2.0, 0.6, Math.sin(a) * 2.0).rotateY(a)); }
  const lava = cyl(0.8, 0.8, 0.2, glow(0xff4400, 2.5), 0, 2.65, 0, 14); g.add(lava);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(box(0.12, 1.2, 0.12, glow(0xff5a00, 1.8), Math.cos(a) * 1.2, 1.4, Math.sin(a) * 1.2).rotateZ(Math.cos(a) * 0.9).rotateX(Math.sin(a) * 0.9)); }
  const light = new THREE.PointLight(0xff5500, 6, 14, 1.8); light.position.y = 3; g.add(light);
  g.add(torus(3.0, 0.15, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.08, 0).rotateX(Math.PI / 2));
  g.userData = { lava, light };
  return g;
}

export function makeTower(color = 0x3a1a1a) {
  const g = new THREE.Group();
  g.add(box(14, 30, 10, mat(color, { roughness: 0.6 }), 0, 15, 0));
  g.add(box(14.4, 0.4, 10.4, GOLD(), 0, 30.2, 0));

  // Windows via InstancedMesh (was ~200 individual boxes)
  const winGeoFront = cachedBoxGeo(0.9, 1.2, 0.06);
  const winGeoSide = cachedBoxGeo(0.06, 1.2, 0.9);
  const winMat = glow(0xffe08a, 0.5);
  const positions = [];
  for (let y = 2; y < 29; y += 2.2) for (let x = -5.5; x <= 5.5; x += 1.6) if (Math.random() < 0.8) positions.push({ x, y, z: 5.04, side: false });
  const sidePosns = [];
  for (let y = 2; y < 29; y += 2.2) for (let z = -3.5; z <= 3.5; z += 1.6) if (Math.random() < 0.8) sidePosns.push({ x: 7.04, y, z, side: true });

  if (positions.length) {
    const im = new THREE.InstancedMesh(winGeoFront, winMat, positions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      dummy.position.set(positions[i].x, positions[i].y, positions[i].z);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    g.add(im);
  }
  if (sidePosns.length) {
    const im = new THREE.InstancedMesh(winGeoSide, winMat, sidePosns.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < sidePosns.length; i++) {
      dummy.position.set(sidePosns[i].x, sidePosns[i].y, sidePosns[i].z);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    g.add(im);
  }

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
  const head = new THREE.SpotLight(0xfff2b0, 12, 18, 0.5, 0.6, 1.5); head.position.set(3, 0.9, 0); head.target.position.set(12, 0, 0); g.add(head); g.add(head.target);
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
  for (const x of [-3, 0, 3]) { const l = new THREE.SpotLight(0xffffff, 10, 10, 0.7, 0.5, 1.2); l.position.set(x, 4.6, 1.6); l.target.position.set(x, 7, 0); g.add(l); g.add(l.target); }
  return g;
}

/**
 * Full 3D facade for The Lucky Duck — a proper model with wall depth,
 * recessed window bays, real glass panes, protruding columns, physical
 * trim, and a mounted "CASINO" sign box.
 * Origin is at ground level, center of the front face.
 * +Z faces outward (toward the street).
 */
export function makeDuckFacade(W, H) {
  const g = new THREE.Group();
  const DEPTH = 1.2;
  const FH = H + 3.0;         // facade is taller than the interior ceiling

  const tileMat = mat(0xd0c4a8, { roughness: 0.7 });
  const maroon = mat(0x6b1e28, { roughness: 0.65 });
  maroon.polygonOffset = true; maroon.polygonOffsetFactor = -2; maroon.polygonOffsetUnits = -2;
  const teal = mat(0x4a8a8e, { roughness: 0.45, metalness: 0.15 });
  teal.polygonOffset = true; teal.polygonOffsetFactor = -3; teal.polygonOffsetUnits = -3;
  const frameMat = mat(0x2a2a2e, { roughness: 0.45, metalness: 0.2 });
  const glassMat = mat(0x6aabb0, { roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0.22, flatShading: false, side: THREE.DoubleSide });
  glassMat.polygonOffset = true; glassMat.polygonOffsetFactor = -1; glassMat.polygonOffsetUnits = -1;
  const dirtGlass = mat(0x4a8a8e, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35, flatShading: false, side: THREE.DoubleSide });
  dirtGlass.polygonOffset = true; dirtGlass.polygonOffsetFactor = -1; dirtGlass.polygonOffsetUnits = -1;
  // trim pieces (sills, lintels) get offset to avoid Z-fighting with walls
  const trimMat = tileMat.clone(); trimMat.polygonOffset = true; trimMat.polygonOffsetFactor = 1; trimMat.polygonOffsetUnits = 1;

  const splitH = FH * 0.48;   // lower/upper boundary — gives plenty of upper room
  const upperH = FH - splitH;
  const doorW = 3.2;

  // ====== LOWER STORY (cream tile) ======
  const leftSolidW = (W - doorW) / 2;
  // kick plate (solid wall below windows)
  g.add(box(leftSolidW, 0.7, DEPTH, tileMat, -(doorW / 2 + leftSolidW / 2), 0.35, 0));
  g.add(box(leftSolidW, 0.7, DEPTH, tileMat, (doorW / 2 + leftSolidW / 2), 0.35, 0));
  // header above ground windows — stops below maroon band
  g.add(box(leftSolidW, 0.3, DEPTH, tileMat, -(doorW / 2 + leftSolidW / 2), splitH - 0.22, 0));
  g.add(box(leftSolidW, 0.3, DEPTH, tileMat, (doorW / 2 + leftSolidW / 2), splitH - 0.22, 0));
  // above the door — stops below maroon band
  const aboveDoorH = splitH - 3.3 - 0.08;
  g.add(box(doorW + 0.4, aboveDoorH, DEPTH, tileMat, 0, 3.3 + aboveDoorH / 2, 0));

  // columns between window bays
  const numBaysPerSide = 2;
  const bayTotalW = leftSolidW - 0.6;
  const colW = 0.35, colDepth = 0.35;
  const bayW = (bayTotalW - colW * (numBaysPerSide + 1)) / numBaysPerSide;
  const winH = splitH - 1.4;
  const winY = 0.75 + winH / 2;

  for (const side of [-1, 1]) {
    const sideOffset = side * (doorW / 2);
    const startX = sideOffset + side * 0.3;

    for (let i = 0; i <= numBaysPerSide; i++) {
      const cx = startX + side * (colW / 2 + i * (bayW + colW));
      const colH = splitH - 0.08;
      g.add(box(colW, colH, DEPTH + colDepth, tileMat, cx, colH / 2, colDepth / 2));
      g.add(box(colW + 0.08, 0.08, DEPTH + colDepth + 0.08, mat(0xb8ac90, { roughness: 0.5 }), cx, colH - 0.02, colDepth / 2));
    }

    for (let i = 0; i < numBaysPerSide; i++) {
      const bx = startX + side * (colW + bayW / 2 + i * (bayW + colW));
      // sill + lintel — nudged forward to avoid Z-fighting with kick/header walls
      g.add(box(bayW, 0.06, DEPTH + 0.02, trimMat, bx, 0.75 - 0.03, 0.02));
      g.add(box(bayW, 0.06, DEPTH + 0.02, trimMat, bx, 0.75 + winH + 0.03, 0.02));
      // glass pane — NO dark backing, truly see-through
      const isBroken = (side === 1 && i === 1) || (side === -1 && i === 0);
      g.add(box(bayW - 0.08, winH - 0.08, 0.04, isBroken ? dirtGlass : glassMat, bx, winY, 0.1));
      // mullion cross
      g.add(box(0.04, winH - 0.12, 0.05, frameMat, bx, winY, 0.12));
      g.add(box(bayW - 0.12, 0.04, 0.05, frameMat, bx, winY, 0.12));
    }
  }

  // ====== UPPER STORY (maroon band) ======
  // solid strips below and above the upper windows — raised slightly above cream header
  g.add(box(W + 0.4, 0.5, DEPTH, maroon, 0, splitH + 0.32, 0));
  g.add(box(W + 0.4, 0.5, DEPTH, maroon, 0, FH - 0.28, 0));

  const numUpperBays = 4;
  const upperBayW = (W - 1.6) / numUpperBays;
  const upperWinH = upperH - 1.6;
  const upperWinY = splitH + 0.65 + upperWinH / 2;

  // pier walls between upper bays — slightly recessed to avoid coplanar fighting with strips
  for (let i = 0; i <= numUpperBays; i++) {
    const px = -W / 2 + 0.6 + i * upperBayW;
    g.add(box(0.3, upperH, DEPTH - 0.04, maroon, px, splitH + upperH / 2, -0.02));
  }

  for (let i = 0; i < numUpperBays; i++) {
    const bx = -W / 2 + 0.6 + upperBayW / 2 + i * upperBayW;
    const bw = upperBayW - 0.5;

    // window frame — nudged past the wall face to avoid Z-fighting
    g.add(box(bw + 0.12, upperWinH + 0.12, 0.08, frameMat, bx, upperWinY, DEPTH / 2 + 0.06));

    // glass — no dark backing, see-through into the interior
    const isSmashed = i >= 2;
    if (isSmashed) {
      const smashedMat = mat(0x5a9a9e, { roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.28, flatShading: false, side: THREE.DoubleSide });
      smashedMat.polygonOffset = true; smashedMat.polygonOffsetFactor = -1; smashedMat.polygonOffsetUnits = -1;
      g.add(box(bw - 0.06, upperWinH - 0.06, 0.03, smashedMat, bx, upperWinY, 0.15));
      // holes where glass is missing — just open (no dark plane)
      // shards still in the frame as small glass triangles
      for (let s = 0; s < 3 + i; s++) {
        const sx = bx + (Math.sin(s * 3.7 + i) * 0.4) * (bw * 0.35);
        const sy = upperWinY + upperWinH * 0.35 - s * 0.25;
        g.add(box(0.15 + s * 0.05, 0.08, 0.03, frameMat, sx, sy, 0.16));
      }
    } else {
      g.add(box(bw - 0.06, upperWinH - 0.06, 0.03, glassMat, bx, upperWinY, 0.15));
    }

    // mullions
    for (let m = 1; m <= 2; m++) {
      const mx = bx - bw / 2 + m * bw / 3;
      g.add(box(0.05, upperWinH - 0.1, 0.06, frameMat, mx, upperWinY, DEPTH / 2 + 0.07));
    }
    g.add(box(bw - 0.1, 0.05, 0.06, frameMat, bx, upperWinY, DEPTH / 2 + 0.07));
  }

  // ====== TRIM & DETAILS ======
  g.add(box(W + 0.6, 0.15, 0.25, teal, 0, splitH + 0.08, DEPTH / 2 + 0.13));
  g.add(box(W + 0.6, 0.12, 0.2, teal, 0, FH + 0.08, DEPTH / 2 + 0.1));

  // "CASINO" sign — 3D box mounted on the upper maroon wall
  const signBoxW = W * 0.55;
  const signBoxH = 1.6;
  const signBoxD = 0.35;
  const signY = splitH + upperH / 2 + 0.1;
  g.add(box(signBoxW, signBoxH, signBoxD, mat(0x1a1a1e, { roughness: 0.3 }), 0, signY, DEPTH / 2 + signBoxD / 2 + 0.05));
  const casinoText = textPlane('CASINO', { w: signBoxW - 0.2, h: signBoxH - 0.2, color: '#e8e0d0', font: 'bold 200px Impact, Arial Black, sans-serif', glowColor: '#ffe8c0', emissive: true });
  casinoText.position.set(0, signY, DEPTH / 2 + signBoxD + 0.07);
  g.add(casinoText);
  const signLight = new THREE.PointLight(0xffe8c0, 3, 8, 2);
  signLight.position.set(0, signY + 1.2, DEPTH / 2 + signBoxD + 0.5);
  g.add(signLight);

  // side returns
  g.add(box(0.12, FH + 0.3, DEPTH + 0.3, tileMat, -W / 2 - 0.06, FH / 2 + 0.15, 0));
  g.add(box(0.12, FH + 0.3, DEPTH + 0.3, tileMat, W / 2 + 0.06, FH / 2 + 0.15, 0));

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
  const l = new THREE.PointLight(0xffd9a0, 18, 22, 1.7); l.position.set(0, 5, 0); g.add(l);
  g.userData.light = l;
  return g;
}

// ---------------------------------------------------------------------------
// luxury casino props — Palazzo Diablo room dividers, arches, urns, etc.
// ---------------------------------------------------------------------------

/** Decorative archway: two pillars with a curved arch and gold keystone. */
export function makeArch(w = 3.5, h = 4.5) {
  const g = new THREE.Group();
  const marble = mat(0xd8d0c8, { roughness: 0.25, metalness: 0.05, flatShading: false });
  const gold = GOLD();
  // pillars
  for (const sx of [-w / 2, w / 2]) {
    g.add(box(0.35, h - 1.2, 0.35, marble, sx, (h - 1.2) / 2, 0));
    g.add(box(0.5, 0.12, 0.5, marble, sx, 0.06, 0));
    g.add(box(0.5, 0.12, 0.5, marble, sx, h - 1.25, 0));
    g.add(box(0.55, 0.06, 0.55, gold, sx, h - 1.13, 0));
  }
  // arch curve — approximated with boxes
  const archSegs = 12;
  for (let i = 0; i <= archSegs; i++) {
    const a = (i / archSegs) * Math.PI;
    const ax = Math.cos(a) * (w / 2 - 0.15);
    const ay = h - 1.2 + Math.sin(a) * 1.1;
    const seg = box(0.25, 0.15, 0.35, marble, ax, ay, 0);
    seg.rotation.z = -a + Math.PI / 2;
    g.add(seg);
  }
  // keystone at top
  g.add(box(0.2, 0.25, 0.38, gold, 0, h + 0.1, 0));
  // gold filigree line along the arch
  for (let i = 1; i < archSegs; i += 2) {
    const a = (i / archSegs) * Math.PI;
    g.add(sph(0.035, gold, Math.cos(a) * (w / 2 - 0.15), h - 1.2 + Math.sin(a) * 1.1, 0.18, 6));
  }
  return g;
}

/** Grand ornamental urn on a pedestal. */
export function makeOrnateUrn() {
  const g = new THREE.Group();
  const marble = mat(0xd8d0c8, { roughness: 0.25, flatShading: false });
  const gold = GOLD();
  // pedestal
  g.add(box(0.5, 0.4, 0.5, marble, 0, 0.2, 0));
  g.add(box(0.55, 0.06, 0.55, gold, 0, 0.43, 0));
  // urn body
  g.add(cyl(0.14, 0.25, 0.15, marble, 0, 0.52, 0, 12));
  g.add(cyl(0.3, 0.14, 0.5, marble, 0, 0.8, 0, 12));
  g.add(cyl(0.22, 0.3, 0.3, marble, 0, 1.2, 0, 12));
  g.add(cyl(0.18, 0.22, 0.1, marble, 0, 1.4, 0, 12));
  // gold rim and handles
  g.add(torus(0.22, 0.02, gold, 0, 1.38, 0).rotateX(Math.PI / 2));
  g.add(torus(0.3, 0.015, gold, 0, 1.05, 0).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) {
    const handle = torus(0.08, 0.02, gold, sx * 0.32, 1.1, 0, Math.PI);
    handle.rotation.z = sx * Math.PI / 2;
    g.add(handle);
  }
  // dried flower sprigs
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const stem = cyl(0.01, 0.01, 0.4, mat(0x2a5a2a), Math.cos(a) * 0.06, 1.6, Math.sin(a) * 0.06, 4);
    stem.rotation.z = (i % 2 ? 0.3 : -0.3) * Math.cos(a);
    stem.rotation.x = 0.3 * Math.sin(a);
    g.add(stem);
  }
  return g;
}

/** Ceiling rosette: ornamental disc at a ceiling beam intersection. */
export function makeCeilingRosette(r = 0.6) {
  const g = new THREE.Group();
  const gold = GOLD();
  const cream = mat(0xe8e0d0, { roughness: 0.3, flatShading: false });
  g.add(cyl(r, r, 0.04, cream, 0, 0, 0, 20));
  g.add(torus(r, 0.03, gold, 0, -0.01, 0).rotateX(Math.PI / 2));
  g.add(torus(r * 0.6, 0.02, gold, 0, -0.02, 0).rotateX(Math.PI / 2));
  // petal relief
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(r * 0.35, 0.02, 0.06, gold, Math.cos(a) * r * 0.42, -0.02, Math.sin(a) * r * 0.42).rotateY(-a));
  }
  g.add(sph(0.08, gold, 0, -0.06, 0, 8));
  return g;
}

/** Palm tree: tall tropical plant for luxury interiors. */
export function makePalmTree() {
  const g = new THREE.Group();
  const gold = GOLD();
  // pot
  g.add(cyl(0.35, 0.28, 0.6, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.3, 0, 10));
  g.add(cyl(0.37, 0.37, 0.04, gold, 0, 0.62, 0, 10));
  // trunk
  g.add(cyl(0.06, 0.09, 2.0, mat(0x6b5a3a, { roughness: 0.8 }), 0, 1.6, 0, 8));
  // trunk rings
  for (let y = 0.8; y < 2.5; y += 0.25) g.add(torus(0.075, 0.012, mat(0x5a4a2a, { roughness: 0.8 }), 0, y, 0).rotateX(Math.PI / 2));
  // fronds — larger leaf shapes
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = new THREE.Group();
    frond.add(box(0.06, 0.02, 1.2, mat(0x1f7a3a, { side: THREE.DoubleSide, roughness: 0.6 }), 0, 0, 0.6));
    // leaf blades along the stem
    for (let j = 0; j < 5; j++) {
      const lz = 0.2 + j * 0.22;
      for (const side of [-1, 1]) {
        const blade = box(0.3 - j * 0.03, 0.01, 0.06, mat(0x1f7a3a, { side: THREE.DoubleSide, roughness: 0.6 }), side * 0.18, 0, lz);
        blade.rotation.y = side * 0.3;
        frond.add(blade);
      }
    }
    frond.position.set(0, 2.6, 0);
    frond.rotation.y = a;
    frond.rotation.x = 0.5 + Math.sin(i) * 0.15;
    g.add(frond);
  }
  return g;
}

/** Large luxury aquarium on a marble stand with coral, sand, and fish. */
export function makeAquarium(w = 4, h = 2.2, d = 1.2) {
  const g = new THREE.Group();
  const marble = mat(0xd8d0c8, { roughness: 0.25, flatShading: false });
  const gold = GOLD();
  const glass = mat(0x88ccee, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, flatShading: false, side: THREE.DoubleSide });
  const water = mat(0x2a6a8a, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, flatShading: false });

  // marble stand
  g.add(box(w + 0.2, 0.8, d + 0.2, marble, 0, 0.4, 0));
  g.add(box(w + 0.3, 0.06, d + 0.3, gold, 0, 0.83, 0));
  // stand legs (ornate pedestal style)
  for (const [lx, lz] of [[-w / 2 + 0.15, -d / 2 + 0.15], [w / 2 - 0.15, -d / 2 + 0.15], [-w / 2 + 0.15, d / 2 - 0.15], [w / 2 - 0.15, d / 2 - 0.15]])
    g.add(box(0.18, 0.04, 0.18, gold, lx, 0.02, lz));

  // tank frame — gold edges
  const tankY = 0.86 + h / 2;
  g.add(box(w + 0.06, 0.06, d + 0.06, gold, 0, 0.86, 0));
  g.add(box(w + 0.06, 0.06, d + 0.06, gold, 0, 0.86 + h, 0));
  for (const [cx, cz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]])
    g.add(box(0.06, h, 0.06, gold, cx, tankY, cz));

  // glass panels
  g.add(box(w, h, 0.03, glass, 0, tankY, d / 2));
  g.add(box(w, h, 0.03, glass, 0, tankY, -d / 2));
  g.add(box(0.03, h, d, glass, -w / 2, tankY, 0));
  g.add(box(0.03, h, d, glass, w / 2, tankY, 0));

  // water fill
  g.add(box(w - 0.1, h - 0.15, d - 0.1, water, 0, tankY - 0.07, 0));

  // sand bed
  g.add(box(w - 0.12, 0.12, d - 0.12, mat(0xd4c090, { roughness: 0.9 }), 0, 0.92, 0));

  // coral pieces
  const coralCols = [0xff6b6b, 0xff9a5c, 0xc77dff, 0x5ce1e6, 0xffd93d];
  for (let i = 0; i < 5; i++) {
    const cx = (i - 2) * (w * 0.18);
    const coralH = 0.3 + Math.random() * 0.5;
    g.add(cyl(0.06, 0.12, coralH, mat(coralCols[i], { roughness: 0.7 }), cx, 1.0 + coralH / 2, (Math.random() - 0.5) * (d * 0.5), 6));
    // branching bits
    for (let b = 0; b < 2; b++) {
      const bh = coralH * 0.5;
      const branch = cyl(0.03, 0.06, bh, mat(coralCols[(i + 1) % 5], { roughness: 0.7 }),
        cx + (b - 0.5) * 0.15, 1.0 + coralH * 0.6 + bh / 2, (Math.random() - 0.5) * (d * 0.4), 5);
      branch.rotation.z = (b - 0.5) * 0.5;
      g.add(branch);
    }
  }

  // rocks
  for (let i = 0; i < 4; i++) {
    const rx = (Math.random() - 0.5) * (w * 0.7);
    const rz = (Math.random() - 0.5) * (d * 0.4);
    g.add(sph(0.08 + Math.random() * 0.08, mat(0x6a6a70, { roughness: 0.8 }), rx, 0.98, rz, 6));
  }

  // fish — small colored ellipsoids that will be animated
  const fishGroup = new THREE.Group();
  const fishColors = [0xff6347, 0xffd700, 0x4169e1, 0xff69b4, 0x00ced1, 0xff8c00, 0x9370db, 0x32cd32];
  for (let i = 0; i < 8; i++) {
    const fish = new THREE.Group();
    const bodyMat = mat(fishColors[i], { roughness: 0.3, metalness: 0.15, flatShading: false });
    // body
    const fb = sph(0.06, bodyMat, 0, 0, 0, 8);
    fb.scale.set(1.6, 0.8, 0.6);
    fish.add(fb);
    // tail
    fish.add(box(0.06, 0.05, 0.04, bodyMat, -0.1, 0, 0));
    // eye
    fish.add(sph(0.015, mat(0x111111), 0.06, 0.01, 0.025, 4));

    fish.position.set(
      (Math.random() - 0.5) * (w * 0.7),
      1.2 + Math.random() * (h * 0.6),
      (Math.random() - 0.5) * (d * 0.4)
    );
    fish.rotation.y = Math.random() * Math.PI * 2;
    fish.userData.phase = Math.random() * Math.PI * 2;
    fish.userData.speed = 0.3 + Math.random() * 0.4;
    fish.userData.radius = 0.3 + Math.random() * (w * 0.25);
    fish.userData.baseY = fish.position.y;
    fishGroup.add(fish);
  }
  g.add(fishGroup);

  // bubbles — small transparent spheres
  const bubbleGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const bubble = sph(0.02 + Math.random() * 0.02,
      mat(0xffffff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, flatShading: false }),
      (Math.random() - 0.5) * (w * 0.6),
      1.0 + Math.random() * h,
      (Math.random() - 0.5) * (d * 0.4), 6);
    bubble.userData.baseX = bubble.position.x;
    bubble.userData.phase = Math.random() * Math.PI * 2;
    bubbleGroup.add(bubble);
  }
  g.add(bubbleGroup);

  // tank light (blue-green glow)
  const tankLight = new THREE.PointLight(0x4ac9e0, 3, 6, 2);
  tankLight.position.set(0, 0.86 + h, 0);
  g.add(tankLight);
  g.add(box(w * 0.8, 0.04, d * 0.6, glow(0x4ac9e0, 0.8), 0, 0.86 + h - 0.02, 0));

  g.userData = { fish: fishGroup, bubbles: bubbleGroup, tankLight, h, w: w, d: d, baseY: 0.86 };
  return g;
}

/** Royal executive desk — bigger and fancier than the regular desk. */
export function makeExecutiveDesk() {
  const g = new THREE.Group();
  const mahogany = mat(0x3a1608, { roughness: 0.3, metalness: 0.08, flatShading: false });
  const leather = mat(0x1a1a1a, { roughness: 0.25, metalness: 0.05, flatShading: false });
  const gold = GOLD();

  // desktop — wider and deeper
  g.add(box(3.0, 0.1, 1.4, mahogany, 0, 0.82, 0));
  // leather inlay on top
  g.add(box(2.6, 0.01, 1.0, mat(0x1a3a1a, { roughness: 0.5 }), 0, 0.88, 0));
  // gold edge trim
  g.add(box(3.04, 0.02, 0.02, gold, 0, 0.84, 0.71));
  g.add(box(3.04, 0.02, 0.02, gold, 0, 0.84, -0.71));
  g.add(box(0.02, 0.02, 1.44, gold, -1.52, 0.84, 0));
  g.add(box(0.02, 0.02, 1.44, gold, 1.52, 0.84, 0));

  // pedestal sides
  g.add(box(0.9, 0.78, 1.3, mahogany, -0.95, 0.39, 0));
  g.add(box(0.9, 0.78, 1.3, mahogany, 0.95, 0.39, 0));
  // drawer handles
  for (let i = 0; i < 3; i++) {
    g.add(box(0.25, 0.02, 0.02, gold, -0.95, 0.22 + i * 0.22, 0.66));
    g.add(box(0.25, 0.02, 0.02, gold, 0.95, 0.22 + i * 0.22, 0.66));
  }
  // modesty panel
  g.add(box(1.0, 0.68, 0.06, mahogany, 0, 0.36, -0.67));

  // desk items: globe, pen set, cigar box, nameplate
  // globe
  g.add(sph(0.14, mat(0x4a7a9a, { roughness: 0.4, flatShading: false }), -1.1, 1.04, -0.3, 12));
  g.add(cyl(0.02, 0.02, 0.12, gold, -1.1, 0.94, -0.3, 6));
  g.add(cyl(0.1, 0.12, 0.03, gold, -1.1, 0.88, -0.3, 10));

  // pen set
  g.add(box(0.3, 0.04, 0.12, mat(0x111111, { roughness: 0.2 }), 0.3, 0.9, -0.4));
  g.add(cyl(0.01, 0.01, 0.2, gold, 0.3, 1.0, -0.4, 6).rotateZ(0.4));

  // cigar box
  g.add(box(0.3, 0.1, 0.18, mahogany, 1.1, 0.93, -0.3));
  g.add(box(0.28, 0.01, 0.16, gold, 1.1, 0.985, -0.3));

  // gold nameplate
  g.add(box(0.5, 0.12, 0.04, gold, 0, 0.94, 0.5));

  // executive chair (bigger, higher back)
  g.add(box(0.8, 0.16, 0.8, mat(0x3a0a0a, { roughness: 0.3 }), 0, 0.52, -1.15));
  g.add(box(0.8, 1.2, 0.14, mat(0x3a0a0a, { roughness: 0.3 }), 0, 1.15, -1.53));
  // headrest
  g.add(box(0.5, 0.2, 0.1, mat(0x3a0a0a, { roughness: 0.3 }), 0, 1.85, -1.53));
  // armrests
  for (const sx of [-0.4, 0.4]) {
    g.add(box(0.06, 0.3, 0.55, mahogany, sx, 0.55, -1.25));
    g.add(box(0.14, 0.04, 0.6, mahogany, sx, 0.72, -1.25));
  }
  // chair base
  g.add(cyl(0.06, 0.06, 0.42, CHROME(), 0, 0.21, -1.15, 8));
  g.add(cyl(0.35, 0.35, 0.03, CHROME(), 0, 0.015, -1.15, 12));
  // casters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(sph(0.04, mat(0x111111), Math.cos(a) * 0.3, 0.04, -1.15 + Math.sin(a) * 0.3, 6));
  }

  return g;
}

/** Gold rope barrier with ornate posts — fancier than velvet rope for room dividers. */
export function makeGoldRopeDivider(len = 4) {
  const g = new THREE.Group();
  const gold = GOLD();
  for (const x of [-len / 2, len / 2]) {
    // ornate post
    g.add(box(0.22, 0.08, 0.22, gold, x, 0.04, 0));
    g.add(cyl(0.04, 0.06, 1.1, gold, x, 0.6, 0, 8));
    g.add(cyl(0.08, 0.04, 0.08, gold, x, 0.12, 0, 8));
    g.add(cyl(0.08, 0.04, 0.08, gold, x, 1.12, 0, 8));
    // finial
    g.add(sph(0.06, gold, x, 1.22, 0, 8));
    g.add(cyl(0.03, 0.06, 0.06, gold, x, 1.14, 0, 8));
  }
  // twin draped gold chains
  for (const yOff of [0, -0.15]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-len / 2, 1.0 + yOff, 0),
      new THREE.Vector3(0, 0.7 + yOff, 0),
      new THREE.Vector3(len / 2, 1.0 + yOff, 0)
    );
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6), gold));
  }
  // tassel at the center sag point
  g.add(cyl(0.03, 0.01, 0.15, gold, 0, 0.55, 0, 6));
  return g;
}

// ---------------------------------------------------------------------------
// skill icon models — small diorama-style pieces for the ledger
// ---------------------------------------------------------------------------

/** Sleight of Hand — white-gloved hand fanning playing cards, gold rings */
export function makeSkillSleight() {
  const g = new THREE.Group();
  const white = mat(0xf0ece0, { roughness: 0.85 });
  const card = mat(0xf5f0e4, { roughness: 0.7 });
  const cardBack = mat(0x8b0000, { roughness: 0.6 });
  const gold = GOLD();

  // fanned cards (5 cards in a spread)
  for (let i = 0; i < 5; i++) {
    const angle = (i - 2) * 0.2;
    const c = new THREE.Group();
    // card face
    c.add(box(0.4, 0.005, 0.58, card, 0, 0, 0));
    // card back pattern stripe
    c.add(box(0.32, 0.006, 0.48, cardBack, 0, -0.004, 0));
    // suit pip (small red or black diamond)
    const pipColor = i % 2 === 0 ? 0xcc2222 : 0x111111;
    const pip = box(0.06, 0.007, 0.06, mat(pipColor), 0, 0.004, 0.15);
    pip.rotation.y = Math.PI / 4;
    c.add(pip);
    c.position.set(i * 0.08 - 0.16, 0.6 + i * 0.012, 0);
    c.rotation.z = angle;
    c.rotation.x = -0.15;
    g.add(c);
  }

  // gloved hand (simplified palm + fingers)
  const palm = box(0.5, 0.16, 0.4, white, 0, 0.28, 0.15);
  palm.rotation.x = 0.3;
  g.add(palm);
  // thumb
  g.add(box(0.12, 0.14, 0.2, white, -0.28, 0.38, 0.2));
  // fingers (4 curved segments)
  for (let i = 0; i < 4; i++) {
    const fx = -0.15 + i * 0.1;
    g.add(box(0.08, 0.22, 0.1, white, fx, 0.44, -0.02));
  }

  // gold rings on fingers
  g.add(torus(0.055, 0.015, gold, -0.05, 0.42, -0.02).rotateX(Math.PI / 2));
  g.add(torus(0.055, 0.015, gold, 0.15, 0.42, -0.02).rotateX(Math.PI / 2));
  // diamond on pinky ring
  const diamond = box(0.04, 0.04, 0.04, mat(0x99ddff, { roughness: 0.05, metalness: 0.4, flatShading: false }), 0.15, 0.5, -0.02);
  diamond.rotation.y = Math.PI / 4;
  g.add(diamond);

  // ace of spades peeking from sleeve
  const ace = box(0.35, 0.005, 0.5, card, -0.35, 0.12, -0.15);
  ace.rotation.z = 0.3;
  g.add(ace);
  const spade = sph(0.04, mat(0x111111), -0.35, 0.13, -0.05, 6);
  g.add(spade);

  return g;
}

/** Sharp Memory — open vault with glowing brain and cash spilling out */
export function makeSkillMemory() {
  const g = new THREE.Group();
  const steel = mat(0x2f3a45, { metalness: 0.6, roughness: 0.4, flatShading: false });
  const gold = GOLD();
  const cash = mat(0x3cb371, { roughness: 0.7 });

  // vault body
  g.add(box(1.0, 1.0, 0.7, steel, 0, 0.5, 0));
  g.add(box(1.06, 0.06, 0.76, mat(0x222830, { metalness: 0.5, roughness: 0.5 }), 0, 0.03, 0));
  // vault door (swung open)
  const door = new THREE.Group();
  door.add(box(0.08, 0.85, 0.6, mat(0x3f4a55, { metalness: 0.7, roughness: 0.3, flatShading: false }), 0.04, 0, 0));
  door.add(box(0.02, 0.9, 0.64, gold, -0.01, 0, 0));
  // wheel on door
  door.add(cyl(0.12, 0.12, 0.06, CHROME(), 0.1, 0.1, 0, 14));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    door.add(cyl(0.02, 0.02, 0.18, CHROME(), 0.12 + Math.cos(a) * 0.06, 0.1, Math.sin(a) * 0.06, 4).rotateZ(a + Math.PI / 2));
  }
  door.position.set(0.52, 0.5, 0.3);
  door.rotation.y = -1.2;
  g.add(door);

  // brain inside (stacked pink spheres in a brain-like cluster)
  const brain = mat(0xe898a8, { roughness: 0.6 });
  g.add(sph(0.18, brain, 0, 0.65, 0.05, 8));
  g.add(sph(0.15, brain, 0.12, 0.72, -0.02, 8));
  g.add(sph(0.15, brain, -0.12, 0.72, -0.02, 8));
  g.add(sph(0.13, brain, 0.06, 0.82, 0.02, 7));
  g.add(sph(0.13, brain, -0.06, 0.82, 0.02, 7));
  // brain glow
  g.add(sph(0.22, glow(0xff88aa, 0.6, { transparent: true, opacity: 0.4 }), 0, 0.72, 0.02, 8));

  // cash spilling out
  for (let i = 0; i < 6; i++) {
    const cx = 0.3 + Math.random() * 0.5;
    const cz = (Math.random() - 0.5) * 0.6;
    const bill = box(0.2, 0.01, 0.1, cash, cx, 0.06 + i * 0.015, cz);
    bill.rotation.y = Math.random() * 1.5;
    g.add(bill);
  }
  // gold coins tumbling out
  for (let i = 0; i < 4; i++) {
    g.add(cyl(0.06, 0.06, 0.02, gold, 0.4 + i * 0.12, 0.04, -0.15 + i * 0.08, 10));
  }

  return g;
}

/** Poker Face — top hat with cards, chips, and cigar */
export function makeSkillPoker() {
  const g = new THREE.Group();
  const black = mat(0x111116, { roughness: 0.35, metalness: 0.15, flatShading: false });
  const gold = GOLD();
  const felt = mat(0x0f5a3a, { roughness: 0.9 });
  const card = mat(0xf5f0e4, { roughness: 0.7 });

  // felt base (mini table)
  g.add(cyl(0.7, 0.7, 0.06, felt, 0, 0.03, 0, 16));
  g.add(cyl(0.74, 0.74, 0.03, mat(0x2b1a10, { roughness: 0.5 }), 0, 0.005, 0, 16));

  // top hat
  g.add(cyl(0.4, 0.4, 0.08, black, 0, 0.07, 0, 16));  // brim
  g.add(cyl(0.26, 0.28, 0.55, black, 0, 0.38, 0, 14));  // crown
  g.add(torus(0.27, 0.025, gold, 0, 0.14, 0).rotateX(Math.PI / 2));  // gold band
  // hat sheen highlight
  g.add(cyl(0.2, 0.15, 0.05, mat(0x2a2a33, { metalness: 0.4, roughness: 0.1, flatShading: false }), 0, 0.62, 0, 14));

  // pair of cards leaning against hat
  const c1 = box(0.3, 0.005, 0.42, card, 0.35, 0.22, 0.1);
  c1.rotation.z = -0.25;
  c1.rotation.y = 0.3;
  g.add(c1);
  const c2 = box(0.3, 0.005, 0.42, card, 0.4, 0.23, 0.02);
  c2.rotation.z = -0.2;
  c2.rotation.y = 0.15;
  g.add(c2);
  // red heart pip on front card
  g.add(sph(0.03, mat(0xcc2222), 0.38, 0.24, 0.18, 6));

  // chip stacks beside hat
  const chipCols = [0xff3333, 0x111111, 0x2b6bff];
  for (let s = 0; s < 3; s++) {
    const sx = -0.4 + s * 0.16;
    const count = 3 + s;
    for (let j = 0; j < count; j++) {
      g.add(cyl(0.09, 0.09, 0.025, mat(chipCols[s], { roughness: 0.4, metalness: 0.15 }), sx, 0.07 + j * 0.028, -0.3, 10));
    }
  }

  // smoldering cigar resting on brim
  g.add(cyl(0.025, 0.02, 0.35, mat(0x6b4226, { roughness: 0.8 }), 0.32, 0.1, -0.15, 8).rotateZ(0.15));
  g.add(cyl(0.015, 0.01, 0.06, mat(0x888888, { roughness: 0.9 }), 0.48, 0.12, -0.15, 6)); // ash tip
  g.add(sph(0.02, glow(0xff5500, 2.5), 0.46, 0.12, -0.15, 6)); // ember

  return g;
}

/** Silver Tongue — gold microphone with chains and money swirl */
export function makeSkillTongue() {
  const g = new THREE.Group();
  const gold = GOLD();
  const chrome = CHROME();
  const cash = mat(0x3cb371, { roughness: 0.7 });

  // microphone stand base
  g.add(cyl(0.35, 0.38, 0.06, mat(0x1a1a1a, { roughness: 0.3 }), 0, 0.03, 0, 14));

  // microphone shaft
  g.add(cyl(0.035, 0.035, 1.0, chrome, 0, 0.55, 0, 8));

  // microphone head — gold bulb
  g.add(sph(0.14, gold, 0, 1.12, 0, 12));
  // mesh grille lines on mic head
  for (let i = 0; i < 5; i++) {
    const y = 1.04 + i * 0.04;
    g.add(torus(0.12, 0.005, mat(0xc09020, { metalness: 0.7, roughness: 0.4 }), 0, y, 0).rotateX(Math.PI / 2));
  }

  // gold chains draped around the base
  for (let c = 0; c < 2; c++) {
    const startAngle = c * Math.PI;
    for (let i = 0; i < 8; i++) {
      const a = startAngle + (i / 8) * Math.PI;
      const r = 0.28 + Math.sin(i * 0.8) * 0.05;
      const y = 0.08 + Math.sin(i * 1.2) * 0.04;
      g.add(sph(0.025, gold, Math.cos(a) * r, y, Math.sin(a) * r, 6));
    }
  }

  // dollar bills floating/spiraling upward
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    const r = 0.25 + i * 0.06;
    const y = 0.4 + i * 0.18;
    const bill = box(0.18, 0.005, 0.09, cash, Math.cos(a) * r, y, Math.sin(a) * r);
    bill.rotation.y = a + 0.5;
    bill.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(bill);
  }

  // speech waves (curved arcs emanating from mic)
  for (let i = 0; i < 3; i++) {
    const arc = torus(0.2 + i * 0.12, 0.01, glow(0xffd700, 0.8 - i * 0.2, { transparent: true, opacity: 0.5 - i * 0.1 }), 0, 1.12, 0.2 + i * 0.08, Math.PI * 0.7);
    arc.rotation.y = -Math.PI * 0.35;
    arc.rotation.z = Math.PI * 0.1;
    g.add(arc);
  }

  // gold tooth (small decorative element at base)
  const tooth = box(0.06, 0.08, 0.04, gold, 0.2, 0.08, 0.2);
  tooth.rotation.y = 0.5;
  g.add(tooth);

  return g;
}

/** Fast Feet — winged shoe with speed lines */
export function makeSkillFeet() {
  const g = new THREE.Group();
  const leather = mat(0x8b0000, { roughness: 0.35, metalness: 0.1, flatShading: false });
  const sole = mat(0x1a1a1a, { roughness: 0.6 });
  const gold = GOLD();
  const chrome = CHROME();

  // sole
  g.add(box(0.85, 0.06, 0.36, sole, 0, 0.03, 0));
  // slight front upturn
  g.add(box(0.15, 0.06, 0.32, sole, 0.48, 0.06, 0).rotateZ(-0.25));

  // shoe body (oxford style)
  g.add(box(0.7, 0.2, 0.34, leather, -0.03, 0.16, 0));
  // toe cap
  g.add(box(0.25, 0.18, 0.32, leather, 0.35, 0.14, 0));
  const toeCurve = sph(0.17, leather, 0.46, 0.13, 0, 8);
  toeCurve.scale.set(1, 0.7, 1.1);
  g.add(toeCurve);
  // heel
  g.add(box(0.2, 0.14, 0.34, sole, -0.38, 0.1, 0));
  // lace area
  g.add(box(0.3, 0.04, 0.12, mat(0x111111), 0.05, 0.28, 0));
  // gold buckle/lace accent
  g.add(box(0.08, 0.08, 0.14, gold, 0.05, 0.3, 0));

  // Hermes-style wing (right side)
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Group();
    // 3 feathers per wing, fanning out
    for (let f = 0; f < 3; f++) {
      const angle = (f - 1) * 0.35;
      const len = 0.25 - f * 0.04;
      const feather = box(len, 0.015, 0.08 - f * 0.01, gold, len * 0.5, 0, 0);
      feather.rotation.z = angle;
      feather.position.y = f * 0.03;
      wing.add(feather);
    }
    wing.position.set(-0.2, 0.25, side * 0.2);
    wing.rotation.y = side * 0.3;
    g.add(wing);
  }

  // speed lines (trailing behind the shoe)
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * 0.07;
    const z = (i - 1.5) * 0.1;
    g.add(box(0.4 - i * 0.06, 0.012, 0.012, glow(0xffd700, 1.2 - i * 0.25, { transparent: true, opacity: 0.7 - i * 0.15 }), -0.7 - i * 0.05, y, z));
  }

  // gold cane leaning beside the shoe
  g.add(cyl(0.02, 0.02, 0.7, gold, 0.55, 0.35, 0.25, 6).rotateZ(-0.15));
  g.add(sph(0.04, gold, 0.58, 0.72, 0.25, 8));

  // small dust puff at the back
  for (let i = 0; i < 3; i++) {
    const r = 0.04 + i * 0.03;
    g.add(sph(r, mat(0x888888, { transparent: true, opacity: 0.2 - i * 0.05 }), -0.55 - i * 0.1, 0.08, (i - 1) * 0.06, 6));
  }

  return g;
}

export function makeFlyer() {
  const g = new THREE.Group();
  const paper = mat(0xf0e8d8, { roughness: 0.9 });
  g.add(box(0.6, 0.8, 0.01, paper, 0, 0.4, 0));
  g.add(box(0.4, 0.06, 0.01, mat(0xcc2222), 0, 0.65, 0.006));
  g.add(box(0.35, 0.04, 0.01, mat(0x333333), 0, 0.55, 0.006));
  for (let i = 0; i < 3; i++) g.add(box(0.4, 0.025, 0.01, mat(0x888888), 0, 0.38 - i * 0.08, 0.006));
  g.add(box(0.25, 0.12, 0.01, glow(0xffd700, 0.6), 0, 0.15, 0.006));
  return g;
}

export function makeCardStock() {
  const g = new THREE.Group();
  const gold = GOLD();
  for (let i = 0; i < 5; i++) {
    const card = box(0.55, 0.35, 0.008, mat(0xf5f0e0, { roughness: 0.5, metalness: 0.1 }), (i - 2) * 0.08, 0.18 + i * 0.02, i * 0.04);
    card.rotation.z = (i - 2) * 0.08;
    g.add(card);
  }
  g.add(box(0.15, 0.03, 0.008, gold, 0, 0.3, 0.2));
  return g;
}

export function makeLemonadeCup() {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.09, 0.3, mat(0xf0f0f0, { roughness: 0.3 }), 0, 0.15, 0, 8));
  g.add(cyl(0.1, 0.08, 0.25, mat(0xf0e060, { transparent: true, opacity: 0.7 }), 0, 0.14, 0, 8));
  g.add(cyl(0.01, 0.01, 0.35, mat(0xdddd00), 0.05, 0.3, 0, 4));
  g.add(sph(0.03, mat(0xffee00), 0, 0.08, 0, 6));
  g.add(box(0.4, 0.25, 0.01, mat(0xffffff, { roughness: 0.9 }), 0, 0.35, 0.15));
  g.add(box(0.25, 0.04, 0.01, mat(0xff4444), 0, 0.42, 0.151));
  return g;
}

export function makeRadio() {
  const g = new THREE.Group();
  const body = mat(0x2a2a2a, { roughness: 0.4, metalness: 0.3 });
  g.add(box(0.7, 0.45, 0.3, body, 0, 0.225, 0));
  g.add(cyl(0.12, 0.12, 0.02, mat(0x888888, { metalness: 0.5 }), -0.15, 0.25, 0.16, 16));
  g.add(cyl(0.06, 0.06, 0.02, mat(0x888888, { metalness: 0.5 }), 0.15, 0.15, 0.16, 12));
  g.add(cyl(0.04, 0.04, 0.02, mat(0x888888, { metalness: 0.5 }), 0.15, 0.3, 0.16, 12));
  g.add(cyl(0.015, 0.015, 0.4, mat(0xcccccc, { metalness: 0.6 }), 0.25, 0.55, 0, 4));
  g.add(sph(0.025, glow(0xff3333, 0.8), -0.25, 0.43, 0.14, 6));
  return g;
}

export function makeTestimonialBoard() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.02, 0.02, mat(0x8b6914), 0, 0.7, 0));
  g.add(box(0.7, 0.9, 0.02, mat(0x3a2a1a, { roughness: 0.8 }), 0, 0.35, 0));
  for (let i = 0; i < 3; i++) {
    g.add(box(0.2, 0.15, 0.01, mat(0xf0e8d8), -0.15, 0.6 - i * 0.25, 0.015));
    g.add(box(0.2, 0.08, 0.01, mat(0xdddddd), 0.15, 0.6 - i * 0.25, 0.015));
  }
  g.add(box(0.15, 0.04, 0.01, glow(0xffd700, 0.5), 0, 0.1, 0.015));
  return g;
}

export function makePhone() {
  const g = new THREE.Group();
  const body = mat(0x1a1a2a, { roughness: 0.15, metalness: 0.4 });
  g.add(box(0.3, 0.55, 0.025, body, 0, 0.275, 0));
  g.add(box(0.26, 0.44, 0.01, glow(0x2244aa, 0.6), 0, 0.3, 0.015));
  for (let i = 0; i < 4; i++) g.add(box(0.2, 0.02, 0.005, mat(0x88ff88), -0.01, 0.45 - i * 0.06, 0.02));
  g.add(sph(0.02, mat(0x222222), 0, 0.52, 0.015, 6));
  return g;
}

export function makeChurchBulletin() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.7, 0.015, mat(0xf5f0e8, { roughness: 0.9 }), 0, 0.35, 0));
  g.add(box(0.08, 0.15, 0.01, mat(0xccaa33), 0, 0.6, 0.01));
  for (let i = 0; i < 5; i++) g.add(box(0.35, 0.02, 0.005, mat(0x666666), 0, 0.42 - i * 0.06, 0.01));
  g.add(box(0.3, 0.08, 0.005, glow(0xff3366, 0.5), 0, 0.1, 0.01));
  return g;
}

export function makeMoneyStack() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    g.add(box(0.5, 0.02, 0.25, mat(0x3a8a3a, { roughness: 0.7 }), (Math.random() - 0.5) * 0.04, i * 0.022, (Math.random() - 0.5) * 0.03));
  }
  g.add(box(0.08, 0.02, 0.3, mat(0xf0e8d0), 0, 0.09, 0));
  return g;
}

export function makePeanutBowl() {
  const g = new THREE.Group();
  g.add(cyl(0.25, 0.18, 0.12, mat(0x8b4513, { roughness: 0.6 }), 0, 0.06, 0, 10));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.1 + Math.random() * 0.08;
    g.add(sph(0.035, mat(0xd4a860, { roughness: 0.8 }), Math.cos(a) * r, 0.12 + Math.random() * 0.03, Math.sin(a) * r, 5));
  }
  return g;
}

export function makeBadge() {
  const g = new THREE.Group();
  const gold = GOLD();
  g.add(cyl(0.01, 0.01, 0.3, gold, 0, 0.4, 0, 4));
  const star = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    star.add(box(0.06, 0.25, 0.02, gold, Math.cos(a) * 0.05, Math.sin(a) * 0.05 + 0.25, 0).rotateZ(a + Math.PI / 2));
  }
  g.add(star);
  g.add(cyl(0.12, 0.12, 0.03, gold, 0, 0.25, 0, 6));
  return g;
}

export function makeHopper() {
  const g = new THREE.Group();
  const metal = mat(0x888888, { roughness: 0.3, metalness: 0.6 });
  g.add(box(0.5, 0.35, 0.35, metal, 0, 0.175, 0));
  g.add(box(0.45, 0.05, 0.3, mat(0x222222), 0, 0.35, 0));
  g.add(box(0.12, 0.12, 0.02, glow(0x44ff44, 0.6), 0.12, 0.25, 0.18));
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.08, 0.08, 0.02, mat(0xffd700, { metalness: 0.4 }), -0.12 + i * 0.06, 0.38, (Math.random() - 0.5) * 0.1, 8));
  }
  return g;
}

export function makeGasMask() {
  const g = new THREE.Group();
  g.add(sph(0.25, mat(0x3a5a3a, { roughness: 0.5 }), 0, 0.3, 0, 10));
  g.add(cyl(0.08, 0.06, 0.15, mat(0x2a2a2a, { roughness: 0.4 }), 0, 0.25, 0.25, 8));
  g.add(cyl(0.06, 0.08, 0.12, mat(0x2a2a2a), -0.12, 0.2, 0.22, 8));
  g.add(cyl(0.06, 0.06, 0.04, mat(0x888888, { metalness: 0.5 }), 0, 0.25, 0.39, 8));
  for (const x of [-0.1, 0.1]) g.add(cyl(0.06, 0.06, 0.02, mat(0x446688, { transparent: true, opacity: 0.7 }), x, 0.35, 0.22, 10));
  return g;
}

export function makeHotelKey() {
  const g = new THREE.Group();
  g.add(box(0.4, 0.25, 0.015, mat(0xf0e8d0, { roughness: 0.4, metalness: 0.1 }), 0, 0.125, 0));
  g.add(box(0.1, 0.15, 0.02, glow(0xffd700, 0.4), 0.1, 0.1, 0.01));
  g.add(box(0.25, 0.03, 0.01, mat(0x222222), -0.05, 0.18, 0.01));
  g.add(cyl(0.03, 0.03, 0.015, mat(0xff3333), -0.12, 0.1, 0.01, 6));
  return g;
}

export function makeVaultDoor() {
  const g = new THREE.Group();
  const steel = mat(0x808080, { roughness: 0.2, metalness: 0.7 });
  g.add(box(0.8, 0.9, 0.1, steel, 0, 0.45, 0));
  g.add(cyl(0.25, 0.25, 0.05, mat(0x606060, { metalness: 0.8 }), 0, 0.45, 0.08, 16));
  g.add(box(0.04, 0.35, 0.06, mat(0x555555, { metalness: 0.6 }), 0, 0.45, 0.08));
  g.add(box(0.35, 0.04, 0.06, mat(0x555555, { metalness: 0.6 }), 0, 0.45, 0.08));
  g.add(cyl(0.04, 0.04, 0.08, GOLD(), 0.3, 0.45, 0.06, 8));
  for (let i = 0; i < 3; i++) g.add(cyl(0.015, 0.015, 0.13, steel, -0.42, 0.2 + i * 0.25, 0, 4));
  return g;
}

export function makeSportsbook() {
  const g = new THREE.Group();
  g.add(box(0.9, 0.55, 0.04, mat(0x111111, { roughness: 0.2 }), 0, 0.4, 0));
  g.add(box(0.85, 0.5, 0.02, glow(0x001a33, 0.4), 0, 0.4, 0.02));
  for (let i = 0; i < 4; i++) {
    const y = 0.55 - i * 0.1;
    g.add(box(0.3, 0.02, 0.01, mat(0x88ff88), -0.2, y, 0.03));
    g.add(box(0.15, 0.02, 0.01, mat(i === 1 ? 0xff4444 : 0xffd700), 0.25, y, 0.03));
  }
  g.add(box(0.5, 0.04, 0.01, glow(0xff3366, 0.6), 0, 0.2, 0.03));
  return g;
}

export function makeSlotChip() {
  const g = new THREE.Group();
  const gold = GOLD();
  g.add(cyl(0.3, 0.3, 0.04, mat(0x880000, { roughness: 0.3 }), 0, 0.02, 0, 20));
  g.add(cyl(0.22, 0.22, 0.045, mat(0xaa0000, { roughness: 0.4 }), 0, 0.02, 0, 20));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.03, 0.05, 0.06, gold, Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26).rotateY(a));
  }
  g.add(cyl(0.08, 0.08, 0.05, gold, 0, 0.02, 0, 8));
  return g;
}

export function makeFilmReel() {
  const g = new THREE.Group();
  const dark = mat(0x1a1a1a, { roughness: 0.4 });
  g.add(cyl(0.3, 0.3, 0.04, dark, 0, 0.3, 0, 20));
  g.add(cyl(0.08, 0.08, 0.05, dark, 0, 0.3, 0, 12));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cyl(0.04, 0.04, 0.05, dark, Math.cos(a) * 0.18, 0.3 + Math.sin(a) * 0.18, 0, 6));
  }
  g.add(box(0.5, 0.02, 0.03, mat(0x3a2a1a, { transparent: true, opacity: 0.8 }), 0.1, 0.05, 0));
  return g;
}

export function makeTVScreen() {
  const g = new THREE.Group();
  g.add(box(1.0, 0.6, 0.04, mat(0x111111, { roughness: 0.15 }), 0, 0.4, 0));
  g.add(box(0.92, 0.52, 0.02, glow(0x1a2a4a, 0.5), 0, 0.4, 0.025));
  g.add(box(0.6, 0.08, 0.01, glow(0xffd700, 0.6), 0, 0.5, 0.04));
  g.add(box(0.4, 0.04, 0.01, mat(0xffffff), 0, 0.35, 0.04));
  g.add(box(0.15, 0.15, 0.04, mat(0x222222), 0, 0.05, -0.02));
  g.add(cyl(0.02, 0.04, 0.12, mat(0x333333), 0, 0.11, 0, 6));
  return g;
}

export function makeExitSign() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.2, 0.03, mat(0x115511, { roughness: 0.5 }), 0, 0.5, 0));
  g.add(box(0.45, 0.15, 0.01, glow(0x33ff33, 0.8), 0, 0.5, 0.02));
  g.add(cyl(0.015, 0.015, 0.2, mat(0x888888, { metalness: 0.5 }), 0, 0.62, 0, 4));
  return g;
}

export function makeTrainCart() {
  const g = new THREE.Group();
  const metal = mat(0x888888, { roughness: 0.3, metalness: 0.5 });
  g.add(box(0.8, 0.25, 0.3, metal, 0, 0.2, 0));
  g.add(box(0.7, 0.15, 0.25, mat(0xffd700, { metalness: 0.3 }), 0, 0.32, 0));
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.18, 0.18]) {
      g.add(cyl(0.05, 0.05, 0.02, mat(0x333333), x, 0.05, z, 8));
    }
  }
  g.add(box(0.84, 0.02, 0.04, mat(0x555555, { metalness: 0.4 }), 0, 0.01, 0));
  return g;
}

export function makeSlotWrench() {
  const g = new THREE.Group();
  const metal = mat(0x888888, { roughness: 0.3, metalness: 0.6 });
  g.add(box(0.06, 0.5, 0.02, metal, 0, 0.35, 0));
  g.add(box(0.18, 0.12, 0.02, metal, 0, 0.6, 0));
  g.add(box(0.08, 0.12, 0.02, mat(0x000000, { roughness: 1 }), 0.05, 0.6, 0));
  g.add(cyl(0.04, 0.04, 0.03, mat(0x333333, { roughness: 0.6 }), 0, 0.08, 0, 8));
  return g;
}

export function makeMegaphone() {
  const g = new THREE.Group();
  const body = mat(0xcc2222, { roughness: 0.4 });
  g.add(cyl(0.04, 0.2, 0.5, body, 0, 0.35, 0, 10).rotateZ(0.3));
  g.add(box(0.12, 0.04, 0.04, mat(0x333333), -0.12, 0.15, 0));
  return g;
}
