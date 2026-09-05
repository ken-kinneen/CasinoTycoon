// People: guests and the owner. Boxy stylised bodies with painted faces.
import * as THREE from 'three';
import * as T from '../engine/textures.js';
import { mat, glow, box, cyl, sph, GOLD, CHROME, BLACK_GLOSS, texMat } from './models.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x95a5a6, 0x34495e, 0xff6b81, 0x70a1ff];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1f2a44, 0x222222, 0x6d4c41];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673f'];
const HAIR = [0x1a1a1a, 0x3b2314, 0x6b4423, 0xc9a227, 0xb03030, 0x888888, 0xe8e8e8];
const geo = {};
const G = (k, make) => geo[k] || (geo[k] = make());

function head(skinHex, mood) {
  const skinMat = mat(parseInt(skinHex.slice(1), 16), { roughness: 0.65, flatShading: false });
  const face = texMat(T.faceTexture(mood, skinHex), { roughness: 0.65 });
  const h = new THREE.Mesh(G('head', () => new THREE.BoxGeometry(0.4, 0.42, 0.4)), [skinMat, skinMat, skinMat, skinMat, face, skinMat]);
  h.castShadow = true; return h;
}

/** Guest. type: 'drunk' | 'regular' | 'sharp' | 'whale' */
export function makeCustomer(type = 'regular') {
  const g = new THREE.Group();
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
  const skinMat = mat(parseInt(skin.slice(1), 16), { roughness: 0.65, flatShading: false });
  const shirtCol = type === 'whale' ? 0xf8f8f8 : type === 'sharp' ? 0x1a1a24 : SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const shirt = mat(shirtCol, { roughness: 0.7 });
  const pants = mat(type === 'whale' ? 0x111111 : PANTS[Math.floor(Math.random() * PANTS.length)], { roughness: 0.8 });
  const mood = type === 'drunk' ? 'drunk' : type === 'sharp' ? 'cool' : Math.random() < 0.5 ? 'happy' : 'neutral';

  const torso = new THREE.Mesh(G('torso', () => new THREE.BoxGeometry(0.5, 0.62, 0.3)), shirt); torso.position.y = 0.93; torso.castShadow = true; g.add(torso);
  const hips = new THREE.Mesh(G('hips', () => new THREE.BoxGeometry(0.48, 0.16, 0.3)), pants); hips.position.y = 0.55; g.add(hips);
  const hd = head(skin, mood); hd.position.y = 1.5; g.add(hd);
  const neck = new THREE.Mesh(G('neck', () => new THREE.BoxGeometry(0.14, 0.1, 0.14)), skinMat); neck.position.y = 1.27; g.add(neck);
  const legGeo = G('leg', () => new THREE.BoxGeometry(0.19, 0.5, 0.2));
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.13, 0.25, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.13, 0.25, 0); g.add(legR);
  const shoeGeo = G('shoe', () => new THREE.BoxGeometry(0.2, 0.08, 0.28));
  const shoeMat = mat(type === 'whale' ? 0x111111 : 0x2a2a2a, { roughness: type === 'whale' ? 0.2 : 0.8 });
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat); shoeL.position.set(0, -0.27, 0.04); legL.add(shoeL);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat); shoeR.position.set(0, -0.27, 0.04); legR.add(shoeR);
  const armGeo = G('arm', () => new THREE.BoxGeometry(0.13, 0.56, 0.14));
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.33, 0.92, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.33, 0.92, 0); g.add(armR);
  const handGeo = G('hand', () => new THREE.BoxGeometry(0.12, 0.12, 0.12));
  armL.add(new THREE.Mesh(handGeo, skinMat).translateY(-0.33)); armR.add(new THREE.Mesh(handGeo, skinMat).translateY(-0.33));
  // shift arm pivots to the shoulder so rotation swings from the top
  for (const a of [armL, armR, legL, legR]) { a.geometry = a.geometry.clone(); a.geometry.translate(0, -0.25, 0); a.position.y += 0.25; for (const ch of a.children) ch.position.y -= 0.25; }

  // hair / hats
  const hairCol = HAIR[Math.floor(Math.random() * HAIR.length)];
  const hairMat = mat(hairCol, { roughness: 0.9 });
  const style = type === 'whale' ? 'tophat' : type === 'sharp' ? 'slick' : ['short', 'long', 'bald', 'cap', 'beanie', 'long', 'short'][Math.floor(Math.random() * 7)];
  if (style === 'short' || style === 'slick') { hd.add(box(0.42, 0.12, 0.42, hairMat, 0, 0.24, 0)); hd.add(box(0.42, 0.2, 0.08, hairMat, 0, 0.12, -0.18)); }
  if (style === 'long') { hd.add(box(0.44, 0.12, 0.44, hairMat, 0, 0.24, 0)); hd.add(box(0.44, 0.5, 0.1, hairMat, 0, -0.05, -0.2)); hd.add(box(0.08, 0.4, 0.3, hairMat, -0.22, 0.0, -0.05)); hd.add(box(0.08, 0.4, 0.3, hairMat, 0.22, 0.0, -0.05)); }
  if (style === 'cap') { hd.add(box(0.44, 0.12, 0.44, mat(SHIRTS[(Math.random() * SHIRTS.length) | 0]), 0, 0.24, 0)); hd.add(box(0.4, 0.03, 0.2, mat(0x222222), 0, 0.2, 0.3)); }
  if (style === 'beanie') { hd.add(box(0.44, 0.2, 0.44, mat(0xc0392b), 0, 0.22, 0)); }
  if (style === 'tophat') { hd.add(cyl(0.3, 0.3, 0.04, BLACK_GLOSS(), 0, 0.23, 0, 14)); hd.add(cyl(0.2, 0.2, 0.34, BLACK_GLOSS(), 0, 0.42, 0, 14)); hd.add(cyl(0.21, 0.21, 0.05, mat(0x8b0000), 0, 0.28, 0, 14)); }
  // type extras
  if (type === 'whale') {
    g.add(box(0.52, 0.64, 0.32, mat(0x111111, { roughness: 0.4 }), 0, 0.93, -0.02));   // tux jacket
    g.add(box(0.14, 0.5, 0.02, mat(0xf8f8f8), 0, 0.95, 0.16));                         // shirt front
    g.add(box(0.14, 0.06, 0.03, mat(0x111111), 0, 1.17, 0.17));                        // bow tie
    g.add(cyl(0.02, 0.02, 0.12, mat(0x5a2a0a), 0.1, 1.42, 0.24, 6).rotateX(Math.PI / 2)); g.add(sph(0.025, glow(0xff4400, 3), 0.1, 1.42, 0.3, 6)); // cigar
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 14), GOLD()); chain.position.set(0, 1.2, 0.14); chain.rotation.x = 1.3; g.add(chain);
    armR.add(cyl(0.03, 0.03, 0.015, GOLD(), 0.05, -0.6, 0.06, 8));
  } else if (type === 'sharp') {
    g.add(box(0.52, 0.64, 0.32, mat(0x1a1a24, { roughness: 0.4 }), 0, 0.93, -0.02));
    g.add(box(0.06, 0.4, 0.02, mat(0x8b0000), 0, 1.0, 0.17));
    armL.add(box(0.06, 0.1, 0.02, mat(0x111111, { emissive: 0x2244ff, emissiveIntensity: 0.6 }), -0.02, -0.6, 0.08)); // phone
  } else if (type === 'drunk') {
    armR.add(cyl(0.035, 0.045, 0.24, mat(0x6b3a0a, { roughness: 0.15, transparent: true, opacity: 0.85, flatShading: false }), 0, -0.62, 0.1, 8));
    g.add(box(0.5, 0.2, 0.04, mat(0x222222), 0, 0.8, 0.16)); // untucked look: dark stain band
  } else if (Math.random() < 0.4) {
    armL.add(box(0.16, 0.2, 0.08, mat(SHIRTS[(Math.random() * SHIRTS.length) | 0], { roughness: 0.5 }), -0.08, -0.55, 0.02)); // purse
  }
  g.userData = { legL, legR, armL, armR, head: hd, body: torso, type, idleT: Math.random() * 10 };
  return g;
}

/** The owner, Victor Vane. `skills` = {sleight, back, poker, tongue, feet} levels. */
export function makeOwner(skills = {}) {
  const g = new THREE.Group();
  const skin = '#e0ac69';
  const skinMat = mat(0xe0ac69, { roughness: 0.65, flatShading: false });
  const suitTex = T.pinstripeTexture(skills.tongue >= 5 ? '#5a0a2a' : '#1c1030');
  const suit = texMat(suitTex, { roughness: 0.55 });
  const suitPlain = mat(skills.tongue >= 5 ? 0x5a0a2a : 0x1c1030, { roughness: 0.55 });
  const gold = GOLD();
  const shoulders = 0.74 + (skills.back || 0) * 0.04;

  // torso + long coat
  const torso = box(shoulders, 0.8, 0.42, suit, 0, 1.08, 0); g.add(torso);
  g.add(box(shoulders + 0.06, 0.12, 0.46, suitPlain, 0, 1.44, -0.01));          // shoulder pads
  g.add(box(shoulders * 0.9, 0.5, 0.4, suit, 0, 0.5, -0.04));                   // coat skirt
  const tailL = box(shoulders * 0.45, 0.45, 0.06, suit, -shoulders * 0.24, 0.575, -0.24); g.add(tailL);
  const tailR = box(shoulders * 0.45, 0.45, 0.06, suit, shoulders * 0.24, 0.575, -0.24); g.add(tailR);
  for (const t of [tailL, tailR]) { t.geometry = t.geometry.clone(); t.geometry.translate(0, -0.225, 0); }
  g.add(box(0.04, 0.9, 0.44, mat(0x8b0000, { roughness: 0.5 }), -shoulders / 2 - 0.005, 0.85, 0)); // red lining edges
  g.add(box(0.04, 0.9, 0.44, mat(0x8b0000, { roughness: 0.5 }), shoulders / 2 + 0.005, 0.85, 0));
  g.add(box(0.26, 0.74, 0.02, mat(0xf5f5f5, { roughness: 0.6 }), 0, 1.06, 0.215));                  // shirt
  g.add(box(0.14, 0.08, 0.03, mat(0xf5f5f5), 0, 1.4, 0.22));                                     // collar
  g.add(box(0.09, 0.5, 0.025, mat(0x9b0000, { roughness: 0.35 }), 0, 1.08, 0.235));                // tie
  g.add(box(0.1, 0.02, 0.02, gold, 0, 1.0, 0.25));                                                 // tie clip
  g.add(box(0.1, 0.1, 0.03, mat(0xf5f5f5), -0.28, 1.35, 0.22));                                    // pocket square
  // head
  const hd = head(skin, 'sneer'); hd.scale.set(1.08, 1.1, 1.08); hd.position.y = 1.78; g.add(hd);
  g.add(box(0.16, 0.12, 0.16, skinMat, 0, 1.52, 0));
  const hair = mat(0x0d0d0d, { roughness: 0.35, flatShading: false });
  hd.add(box(0.44, 0.12, 0.44, hair, 0, 0.25, -0.01));
  hd.add(box(0.44, 0.26, 0.1, hair, 0, 0.1, -0.18));                     // back
  hd.add(box(0.14, 0.05, 0.1, hair, 0, 0.22, 0.2));                      // widow's peak
  hd.add(box(0.05, 0.18, 0.12, hair, -0.2, 0.06, 0.06)); hd.add(box(0.05, 0.18, 0.12, hair, 0.2, 0.06, 0.06)); // sideburns
  // cigarette (default) or cigar (Poker Face 3)
  if (skills.poker >= 3) { const c = cyl(0.035, 0.03, 0.3, mat(0x5a2a0a), 0.12, 1.66, 0.3, 8); c.rotation.x = Math.PI / 2; g.add(c); g.add(sph(0.035, glow(0xff4400, 3), 0.12, 1.66, 0.46, 6)); }
  else { const c = cyl(0.012, 0.012, 0.2, mat(0xffffff), 0.1, 1.66, 0.28, 6); c.rotation.x = Math.PI / 2; c.rotation.z = -0.2; g.add(c); g.add(sph(0.015, glow(0xff5500, 4), 0.09, 1.66, 0.38, 6)); }
  // limbs
  const legL = box(0.22, 0.62, 0.24, suitPlain, -0.15, 0.31, 0); g.add(legL);
  const legR = box(0.22, 0.62, 0.24, suitPlain, 0.15, 0.31, 0); g.add(legR);
  const shoeMat = skills.feet >= 2 ? mat(0xc0392b, { roughness: 0.15, flatShading: false }) : BLACK_GLOSS();
  legL.add(box(0.23, 0.09, 0.34, shoeMat, 0, -0.29, 0.05)); legR.add(box(0.23, 0.09, 0.34, shoeMat, 0, -0.29, 0.05));
  const sleeveMat = skills.back >= 1 ? skinMat : suit;
  const armL = box(0.16, 0.66, 0.16, sleeveMat, -shoulders / 2 - 0.1, 1.08, 0); g.add(armL);
  const armR = box(0.16, 0.66, 0.16, sleeveMat, shoulders / 2 + 0.1, 1.08, 0); g.add(armR);
  const glove = skills.sleight >= 1 ? mat(0xf5f5f5) : skinMat;
  armL.add(box(0.14, 0.14, 0.14, glove, 0, -0.38, 0)); armR.add(box(0.14, 0.14, 0.14, glove, 0, -0.38, 0));
  for (const a of [armL, armR, legL, legR]) { a.geometry = a.geometry.clone(); a.geometry.translate(0, -0.3, 0); a.position.y += 0.3; for (const ch of a.children) ch.position.y -= 0.3; }
  armR.add(cyl(0.025, 0.025, 0.02, gold, 0.06, -0.72, 0.04, 8)); // pinky ring, always

  // ---- Sleight of Hand: gloves(1), rings(2), diamond(3), watch(4), ace up sleeve(5)
  if (skills.sleight >= 2) for (let i = 0; i < 3; i++) armR.add(cyl(0.025, 0.025, 0.02, gold, -0.05 + i * 0.05, -0.74, 0.07, 6));
  if (skills.sleight >= 3) armL.add(sph(0.04, glow(0xccffff, 1.2), 0.07, -0.74, 0.07, 6));
  if (skills.sleight >= 4) armL.add(box(0.18, 0.06, 0.18, gold, 0, -0.58, 0));
  if (skills.sleight >= 5) armR.add(box(0.12, 0.17, 0.02, mat(0xffffff), 0.1, -0.5, 0.05));
  // ---- Strong Back: rolled sleeves(1), shoulders(2), belt(3), money bags(4,5)
  if (skills.back >= 3) g.add(box(shoulders * 0.92, 0.1, 0.44, mat(0x6b3a1a, { roughness: 0.5 }), 0, 0.72, -0.02));
  if (skills.back >= 4) { const b = sph(0.22, mat(0x6b4f2a, { roughness: 0.9 }), -shoulders / 2 - 0.3, 0.8, -0.1, 8); g.add(b); g.add(box(0.14, 0.1, 0.04, glow(0x3cb371, 0.3), -shoulders / 2 - 0.3, 0.8, 0.1)); }
  if (skills.back >= 5) { const b = sph(0.22, mat(0x6b4f2a, { roughness: 0.9 }), shoulders / 2 + 0.3, 0.8, -0.1, 8); g.add(b); }
  // ---- Poker Face: visor(1), shades(2), cigar(3), top hat(4), gold top hat(5)
  if (skills.poker >= 1 && skills.poker < 4) hd.add(box(0.46, 0.05, 0.3, glow(0x00aa66, 0.6, { transparent: true, opacity: 0.7 }), 0, 0.14, 0.25));
  if (skills.poker >= 2) { hd.add(box(0.44, 0.09, 0.06, mat(0x050505, { roughness: 0.05, flatShading: false }), 0, 0.03, 0.21)); }
  if (skills.poker >= 4) { const hm = skills.poker >= 5 ? gold : BLACK_GLOSS(); hd.add(cyl(0.32, 0.32, 0.04, hm, 0, 0.25, 0, 16)); hd.add(cyl(0.22, 0.22, 0.4, hm, 0, 0.46, 0, 16)); hd.add(cyl(0.23, 0.23, 0.06, mat(0x8b0000), 0, 0.31, 0, 16)); }
  // ---- Silver Tongue: gold tooth(1, in face), chain(2), 2 chains(3), fur collar(4), fur coat(5)
  if (skills.tongue >= 2) { const ch = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), gold); ch.position.set(0, 1.38, 0.18); ch.rotation.x = 1.3; g.add(ch); }
  if (skills.tongue >= 3) { const ch = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 6, 16), gold); ch.position.set(0, 1.3, 0.2); ch.rotation.x = 1.3; g.add(ch); g.add(box(0.1, 0.12, 0.03, gold, 0, 1.1, 0.26)); }
  if (skills.tongue >= 4) g.add(box(shoulders + 0.14, 0.18, 0.5, mat(0xf0e2c8, { roughness: 1 }), 0, 1.47, -0.01));
  if (skills.tongue >= 5) { g.add(box(shoulders + 0.22, 0.9, 0.52, mat(0xf0e2c8, { roughness: 1 }), 0, 1.0, -0.06)); }
  // ---- Fast Feet: shine(1), red shoes(2), cane(3), gold cane(4), cape(5)
  if (skills.feet >= 3) { armR.add(cyl(0.02, 0.02, 1.0, skills.feet >= 4 ? gold : mat(0x1a0a0a), 0, -0.85, 0.16, 8)); armR.add(sph(0.05, gold, 0, -0.36, 0.16, 8)); }
  if (skills.feet >= 5) { const cape = box(shoulders + 0.1, 1.3, 0.05, mat(0x8b0000, { roughness: 0.6, side: THREE.DoubleSide }), 0, 0.85, -0.27); cape.geometry = cape.geometry.clone(); cape.geometry.translate(0, -0.6, 0); cape.position.y = 1.45; g.add(cape); g.userData.cape = cape; }

  g.userData = { ...g.userData, legL, legR, armL, armR, head: hd, body: torso, tailL, tailR };
  return g;
}

/** Bouncer: a very large guest in black with an earpiece. */
export function makeBouncer() {
  const g = makeCustomer('sharp');
  g.scale.set(1.35, 1.25, 1.35);
  g.userData.head.add(sph(0.03, mat(0x111111), 0.2, 0.0, 0.05, 6));
  g.userData.head.add(cyl(0.008, 0.008, 0.25, mat(0x111111), 0.2, -0.15, 0.02, 4));
  return g;
}

/** Shared idle/walk animation for a person group. */
export function animatePerson(g, dt, { walking, walkT, drunk = false }) {
  const u = g.userData;
  u.idleT = (u.idleT || 0) + dt;
  const blend = 1 - Math.exp(-8 * dt);
  if (walking) {
    const s = Math.sin(walkT * 9) * 0.65;
    u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
    g.position.y = Math.abs(Math.sin(walkT * 9)) * 0.03;
    if (u.tailL) { u.tailL.rotation.x = -0.35 - Math.sin(walkT * 9) * 0.1; u.tailR.rotation.x = -0.35 + Math.sin(walkT * 9) * 0.1; }
    if (u.cape) u.cape.rotation.x = 0.35 + Math.sin(walkT * 4) * 0.08;
    if (drunk) g.rotation.z = Math.sin(walkT * 3) * 0.12;
  } else {
    u.legL.rotation.x += (0 - u.legL.rotation.x) * blend; u.legR.rotation.x += (0 - u.legR.rotation.x) * blend;
    g.position.y += (0 - g.position.y) * blend;
    if (u.tailL) { u.tailL.rotation.x += (-0.05 - u.tailL.rotation.x) * blend; u.tailR.rotation.x = u.tailL.rotation.x; }
    if (u.cape) u.cape.rotation.x += (0.05 - u.cape.rotation.x) * blend;
    u.body.scale.y = 1 + Math.sin(u.idleT * 2) * 0.012;
    u.head.rotation.y = Math.sin(u.idleT * 0.7) * 0.25 + (drunk ? Math.sin(u.idleT * 2.3) * 0.15 : 0);
    u.head.rotation.z = drunk ? Math.sin(u.idleT * 1.1) * 0.12 : 0;
    g.rotation.z += (0 - g.rotation.z) * blend;
  }
}
