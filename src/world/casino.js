// Builds the current casino (interior + street outside) from the casino def
// plus whatever upgrade models the player owns. Rebuilt on every purchase that
// has a `model` key, so the world visibly changes with upgrades.
import * as THREE from 'three';
import * as M from './models.js';
import * as T from '../engine/textures.js';
import { makeBouncer } from './people.js';

const PALETTE = {
  duck:   { carpet: ['#3a0b1e', '#c99a2e', '#7a2a5a'], wall: ['#3b2418', '#b8862a'], felt: '#0f5a3a', facade: 'brick', neighbours: ['pawn', 'bail'], ceiling: 0x120a10, warm: 0xffb060 },
  rat:    { carpet: ['#101a3a', '#d4af37', '#3a2a6a'], wall: ['#1e1a30', '#d4af37'], felt: '#123e6b', facade: 'stone', neighbours: ['LIQUOR', 'TATTOO'], ceiling: 0x0c0a18, warm: 0xffc070 },
  diablo: { carpet: ['#2a0710', '#ffd700', '#8a1030'], wall: ['#2a0c14', '#ffd700'], felt: '#0a4a7a', facade: 'marble', neighbours: [], ceiling: 0x14060a, warm: 0xffd0a0 },
};

export class CasinoWorld {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.machines = []; this.tables = []; this.colliders = []; this.zones = {}; this.animated = []; this.lampXs = [];
  }

  clear() {
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.machines = []; this.tables = []; this.colliders = []; this.zones = {}; this.animated = []; this.lampXs = []; this.neonSigns = [];
  }

  addCollider(x, z, w, d) { this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }

  build(def, game) {
    this.clear();
    const st = game.stats;
    const has = k => game.hasModel(k);
    const P = PALETTE[def.id];
    const W = def.width, D = def.depth, H = 4.8;
    this.W = W; this.D = D; this.H = H;
    const R = this.root;
    const add = (o) => { R.add(o); return o; };

    // =====================================================================
    // STREET
    // =====================================================================
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.18, metalness: 0.15 }); // wet look
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), asphalt);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; add(ground);
    // puddles
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 1.6, 12), new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.03, metalness: 0.3 }));
      p.rotation.x = -Math.PI / 2; p.position.set((Math.random() - 0.5) * (W + 40), 0.0, D / 2 + 7 + Math.random() * 10); p.scale.x = 1.6; add(p);
    }
    const sidewalk = M.box(W + 24, 0.16, 6.2, M.mat(0x2e2e34, { roughness: 0.85 }), 0, 0.0, D / 2 + 3.1); add(sidewalk);
    add(M.box(W + 24, 0.18, 0.2, M.mat(0x44444c), 0, 0.0, D / 2 + 6.2)); // curb
    for (let x = -W / 2 - 12; x < W / 2 + 12; x += 2) add(M.box(0.04, 0.17, 6.2, M.mat(0x26262c), x, 0.0, D / 2 + 3.1)); // paving lines
    for (let x = -W / 2 - 40; x < W / 2 + 40; x += 4) add(M.box(2, 0.01, 0.18, M.mat(0xd9c25a, { roughness: 0.6 }), x, 0.0, D / 2 + 11));
    add(M.box(W + 80, 0.01, 0.12, M.mat(0xffffff, { roughness: 0.6 }), 0, 0.0, D / 2 + 6.6));
    // far side of the street: dark buildings silhouette
    for (let i = -4; i <= 4; i++) {
      const bw = 8 + Math.random() * 6, bh = 8 + Math.random() * 14;
      const b = M.box(bw, bh, 8, M.texMat(T.brickTexture('#22181a', '#100c0e'), { roughness: 0.95 }), i * 14 + (Math.random() - 0.5) * 3, bh / 2, D / 2 + 24); add(b);
      for (let y = 2; y < bh - 1; y += 2.5) for (let x = -bw / 2 + 1; x < bw / 2 - 0.5; x += 2) if (Math.random() < 0.35) add(M.box(0.8, 1.0, 0.05, M.glow([0xffe08a, 0x9ad0ff, 0xffb0c0][(Math.random() * 3) | 0], 0.5 + Math.random() * 0.5), b.position.x + x, y, D / 2 + 19.97));
    }
    // street lamps + light cones
    this.lampXs = [-W / 2 - 4, -W / 6, W / 6, W / 2 + 4];
    for (const x of this.lampXs) { const l = M.makeStreetLamp(); l.position.set(x, 0, D / 2 + 5.5); add(l); this.animated.push({ type: 'lamp', obj: l.userData.light, t: Math.random() * 10, base: 60 }); }
    // parked cars, hydrant, dumpster, trash
    const carCols = [0x8b0000, 0x1a2a4a, 0x2a2a2a, 0xd0d0d0, 0x6b3a8a];
    for (let i = 0; i < 3; i++) { const c = M.makeCar(carCols[(i * 2 + def.width) % carCols.length]); c.position.set(-W / 2 - 10 + i * 6.5 + (i > 0 ? W + 3 : 0), 0, D / 2 + 8.2); c.rotation.y = Math.PI * (i % 2); add(c); }
    const moving = M.makeCar(0xf1c40f); moving.position.set(-60, 0, D / 2 + 13.5); add(moving); this.animated.push({ type: 'car', obj: moving, t: Math.random() * 20, z: D / 2 + 13.5, range: W + 120 });
    const hyd = M.makeHydrant(); hyd.position.set(W / 2 + 1.5, 0.08, D / 2 + 5.4); add(hyd);
    const dump = M.makeDumpster(); dump.position.set(-W / 2 - 2.6, 0, D / 2 - 3); dump.rotation.y = Math.PI / 2; add(dump);
    for (let i = 0; i < 8; i++) add(M.box(0.25, 0.04, 0.35, M.mat([0xdddddd, 0xc0392b, 0x8b6b3a][i % 3]), -W / 2 - 3 + Math.random() * (W + 6), 0.09, D / 2 + 0.6 + Math.random() * 5.2).rotateY(Math.random() * 3));
    // neighbouring shops
    if (P.neighbours.length) {
      const n1 = M.makeNeighbourShop(P.neighbours[0], 10, H + 0.6); n1.position.set(-W / 2 - 5.2, 0, D / 2); add(n1); this.animated.push({ type: 'neon', obj: n1.userData.sign, t: 2, flick: 0.5 });
      const n2 = M.makeNeighbourShop(P.neighbours[1], 10, H + 1.4); n2.position.set(W / 2 + 5.2, 0, D / 2); add(n2); this.animated.push({ type: 'neon', obj: n2.userData.sign, t: 5, flick: 0.2 });
    }

    // =====================================================================
    // BUILDING SHELL
    // =====================================================================
    const carpetTex = T.carpetTexture(P.carpet[0], P.carpet[1], P.carpet[2], def.id.length, [W / 2.2, D / 2.2]);
    const floor = M.box(W, 0.12, D, has('carpet') ? M.texMat(T.carpetTexture('#3a0630', '#ffd700', '#ff2e88', 7, [W / 1.6, D / 1.6]), { roughness: 0.9 }) : M.texMat(carpetTex, { roughness: 0.9 }), 0, 0.06, 0);
    floor.receiveShadow = true; add(floor);
    // marble walkway from the door to the tables + a runner outside
    const marble = M.texMat(T.marbleTexture('#a09888', '#787068', [1, 2]), { roughness: 0.6, metalness: 0.02, envMapIntensity: 0.1 });
    add(M.box(3.4, 0.13, 6, marble, 0, 0.065, D / 2 - 3)); add(M.box(3.6, 0.02, 6.2, M.mat(0xc8a020, { metalness: 0.5, roughness: 0.5, flatShading: false }), 0, 0.125, D / 2 - 3).translateY(-0.01));
    add(M.box(3, 0.05, 6, M.mat(0x8b0000, { roughness: 0.9 }), 0, 0.17, D / 2 + 3.2)); // red carpet outside
    // walls
    const wallMat = M.texMat(T.wallTexture(P.wall[0], P.wall[1], [W / 4, 1]), { roughness: 0.85 });
    const wallMatSide = M.texMat(T.wallTexture(P.wall[0], P.wall[1], [D / 4, 1]), { roughness: 0.85 });
    add(M.box(W, H, 0.4, wallMat, 0, H / 2, -D / 2));
    add(M.box(0.4, H, D, wallMatSide, -W / 2, H / 2, 0));
    add(M.box(0.4, H, D, wallMatSide, W / 2, H / 2, 0));
    const doorW = 3.2;
    add(M.box((W - doorW) / 2, H, 0.4, wallMat, -(W / 4 + doorW / 4), H / 2, D / 2));
    add(M.box((W - doorW) / 2, H, 0.4, wallMat, (W / 4 + doorW / 4), H / 2, D / 2));
    add(M.box(doorW + 0.4, H - 3.3, 0.4, wallMat, 0, H - (H - 3.3) / 2, D / 2));
    this.addCollider(0, -D / 2, W, 0.4); this.addCollider(-W / 2, 0, 0.4, D); this.addCollider(W / 2, 0, 0.4, D);
    this.addCollider(-(W / 4 + doorW / 4), D / 2, (W - doorW) / 2, 0.4); this.addCollider((W / 4 + doorW / 4), D / 2, (W - doorW) / 2, 0.4);
    // exterior cladding on the front (brick / stone / marble)
    const cladTex = P.facade === 'brick' ? T.brickTexture() : P.facade === 'stone' ? T.brickTexture('#2a2a34', '#15151c') : null;
    const clad = cladTex ? M.texMat(cladTex, { roughness: 0.9 }) : M.mat(0x2a0c14, { roughness: 0.3, metalness: 0.1, flatShading: false });
    add(M.box((W - doorW) / 2 - 0.2, H + 0.6, 0.12, clad, -(W / 4 + doorW / 4) - 0.1, (H + 0.6) / 2, D / 2 + 0.26));
    add(M.box((W - doorW) / 2 - 0.2, H + 0.6, 0.12, clad, (W / 4 + doorW / 4) + 0.1, (H + 0.6) / 2, D / 2 + 0.26));
    add(M.box(W + 0.6, H + 0.8, 0.12, clad, 0, (H + 0.8) / 2, -D / 2 - 0.26)); // back
    add(M.box(0.12, H + 0.8, D + 0.6, clad, -W / 2 - 0.26, (H + 0.8) / 2, 0)); add(M.box(0.12, H + 0.8, D + 0.6, clad, W / 2 + 0.26, (H + 0.8) / 2, 0));
    // roof + parapet + rooftop clutter
    add(M.box(W + 0.6, 0.3, D + 0.6, M.mat(0x1a1a20, { roughness: 0.95 }), 0, H + 0.15, 0));
    add(M.box(W + 0.7, 0.5, 0.3, M.GOLD(), 0, H + 0.55, D / 2 + 0.2));
    for (let i = 0; i < 3; i++) add(M.box(1.2, 0.8, 1.2, M.mat(0x555560, { metalness: 0.5 }), -W / 3 + i * W / 3, H + 0.7, -D / 4));
    // ceiling
    const ceilMat = has('sky') ? M.glow(0x9ad0ff, 0.45) : M.mat(P.ceiling, { roughness: 0.9 });
    add(M.box(W, 0.2, D, ceilMat, 0, H, 0));
    if (has('sky')) { for (let i = 0; i < 14; i++) add(M.sph(0.9 + Math.random() * 1.2, M.glow(0xffffff, 0.6, { flatShading: false }), (Math.random() - 0.5) * W * 0.9, H - 0.6, (Math.random() - 0.5) * D * 0.9, 8)); }
    // coffered ceiling beams
    for (let x = -W / 2 + 4; x < W / 2; x += 4) add(M.box(0.2, 0.25, D, M.mat(P.wall[1] === '#ffd700' ? 0x6b5a1a : 0x3a2a1a), x, H - 0.12, 0));
    // door: swung-open double doors + awning with bulbs
    const dl = M.makeDoubleDoor(doorW, 3.2); dl.position.set(0, 0.12, D / 2); add(dl);
    dl.children[0].rotation.y = -Math.PI / 2 + 0.2; dl.children[0].position.set(-doorW / 2 + 0.05, 0, doorW / 4 + 0.2);
    dl.children[1].rotation.y = Math.PI / 2 - 0.2; dl.children[1].position.set(doorW / 2 - 0.05, 0, doorW / 4 + 0.2);
    add(M.box(doorW + 1.2, 0.25, 2.2, M.mat(0x8b0000, { roughness: 0.6 }), 0, 3.45, D / 2 + 1.1));
    add(M.box(doorW + 1.3, 0.06, 2.3, M.mat(0xc8a020, { metalness: 0.5, roughness: 0.45, flatShading: false }), 0, 3.6, D / 2 + 1.1));
    const awningBulbs = new THREE.Mesh(new THREE.PlaneGeometry(doorW + 1.2, 0.14), new THREE.MeshBasicMaterial({ map: T.bulbStripTexture(), transparent: true, toneMapped: true }));
    awningBulbs.position.set(0, 3.36, D / 2 + 2.21); add(awningBulbs);
    const doorLight = new THREE.PointLight(0xffd080, 14, 10, 1.8); doorLight.position.set(0, 3.2, D / 2 + 1.2); add(doorLight);
    for (const x of [-doorW / 2 - 0.6, doorW / 2 + 0.6]) { const r = M.makeVelvetRope(2.6); r.position.set(x + (x < 0 ? 0 : 0), 0.16, D / 2 + 3.2); r.rotation.y = Math.PI / 2; add(r); }
    // windows: boarded or glowing
    for (const x of [-W / 4 - 1, W / 4 + 1]) {
      add(M.box(2.4, 2.0, 0.2, M.mat(0x2a1608), x, 2.3, D / 2 + 0.28));
      if (has('windows')) { for (let i = 0; i < 4; i++) add(M.box(2.5, 0.32, 0.08, M.mat(0x6b5030, { roughness: 1 }), x, 1.6 + i * 0.5, D / 2 + 0.42).rotateZ((i % 2 ? 1 : -1) * 0.12)); }
      else { add(M.box(2.1, 1.7, 0.06, M.glow(0x3a4a7a, 0.7, { transparent: true, opacity: 0.85 }), x, 2.3, D / 2 + 0.4)); add(M.textPlane('OPEN 24 HRS', { w: 1.8, h: 0.35, color: '#ff4466', glowColor: '#ff4466', emissive: true }).translateX(x).translateY(2.3).translateZ(D / 2 + 0.44)); }
    }
    // facade neon + marquee bulbs + blade sign
    const signW = Math.min(W - 2, 18);
    const displayName = game.casinoDisplayName();
    const sign = M.makeNeonSign(displayName.toUpperCase().replace(', LAS VEGAS', ''), '#' + def.signColor.toString(16).padStart(6, '0'), signW, { intensity: 30 });
    sign.position.set(0, H + 2.2, D / 2 + 0.35); add(sign);
    this.animated.push({ type: 'neon', obj: sign, t: Math.random() * 10, flick: (def.id === 'duck' && !has('neon')) ? 0.9 : 0.12 });
    add(M.box(signW + 1, signW * 0.26 + 0.8, 0.2, M.mat(0x0a0a0e, { roughness: 0.4 }), 0, H + 2.2, D / 2 + 0.2));
    const bulbFrame = new THREE.Mesh(new THREE.PlaneGeometry(signW + 1, 0.16), new THREE.MeshBasicMaterial({ map: T.bulbStripTexture(), transparent: true, toneMapped: false }));
    bulbFrame.position.set(0, H + 2.2 + signW * 0.13 + 0.3, D / 2 + 0.31); add(bulbFrame); add(bulbFrame.clone().translateY(-(signW * 0.26 + 0.6)));
    if (has('namelights')) { const nlName = game.s.playerName ? game.s.playerName.toUpperCase() : 'VICTOR VANE'; const nl = M.makeNeonSign(`★ ${nlName} PRESENTS ★`, '#ff44aa', Math.min(W - 2, 14), { intensity: 20 }); nl.position.set(0, H + 2.2 + signW * 0.13 + 1.2, D / 2 + 0.35); add(nl); this.animated.push({ type: 'neon', obj: nl, t: 3, flick: 0.1 }); }
    if (def.id !== 'duck') { const blade = M.makeNeonSign('CASINO', '#ffffff', 4.5, { intensity: 14 }); blade.position.set(W / 2 + 0.45, 3.6, D / 2 - 3); blade.rotation.y = Math.PI / 2; blade.rotation.z = Math.PI / 2; add(blade); this.animated.push({ type: 'neon', obj: blade, t: 1, flick: 0.1 }); }

    // =====================================================================
    // INTERIOR LIGHTING
    // =====================================================================
    const cols = Math.max(2, Math.round(W / 11)), rows = Math.max(2, Math.round(D / 11));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = -W / 2 + (i + 0.5) * W / cols, z = -D / 2 + (j + 0.5) * D / rows;
      if (def.id !== 'duck') { const ch = M.makeChandelier(def.id === 'diablo' ? 1.5 : 1.1); ch.position.set(x, H - 1.3, z); add(ch); ch.userData.light.intensity = has('sky') ? 24 : 34; ch.userData.light.color.set(has('sky') ? 0xcfe8ff : P.warm); }
      else { const l = new THREE.PointLight(P.warm, 40, 16, 1.6); l.position.set(x, H - 0.5, z); add(l); add(M.cyl(0.25, 0.3, 0.1, M.glow(0xffe0b0, 1.4), x, H - 0.16, z, 10)); }
    }
    // sconces along the side walls
    for (let z = -D / 2 + 3; z < D / 2 - 2; z += 6) {
      const s1 = M.makeSconce(P.warm); s1.position.set(-W / 2 + 0.24, 2.6, z); s1.rotation.y = Math.PI / 2; add(s1); s1.userData.light.intensity = 3;
      const s2 = M.makeSconce(P.warm); s2.position.set(W / 2 - 0.24, 2.6, z); s2.rotation.y = -Math.PI / 2; add(s2); s2.userData.light.intensity = 3;
    }
    // clocks unless removed
    if (!has('noclocks')) { const c1 = M.makeClock(); c1.position.set(-W / 2 + 0.25, 3.6, 0); c1.rotation.y = Math.PI / 2; add(c1); const c2 = M.makeClock(); c2.position.set(0, 3.8, -D / 2 + 0.25); add(c2); }
    // vents / gas / cameras
    if (has('vents') || has('gas') || has('fog')) for (let i = 0; i < 4; i++) {
      const v = M.makeVent(); v.position.set(-W / 2 + (i + 0.5) * W / 4, H - 0.5, -D / 2 + 0.26); add(v);
      if (has('gas') || has('fog')) { const puff = M.sph(0.5, new THREE.MeshStandardMaterial({ color: has('fog') ? 0xfff2b0 : 0x9bffb0, transparent: true, opacity: 0.25, emissive: has('fog') ? 0xfff2b0 : 0x9bffb0, emissiveIntensity: 0.3 }), v.position.x, H - 1.1, -D / 2 + 1); add(puff); this.animated.push({ type: 'puff', obj: puff, t: Math.random() * 6, y0: H - 1.1 }); }
    }
    if (has('cameras')) for (let i = 0; i < 6; i++) { const c = M.makeCamera(); c.position.set((Math.random() - 0.5) * (W - 3), H - 0.45, (Math.random() - 0.5) * (D - 3)); add(c); }

    // =====================================================================
    // OFFICE (back-left): desk, safe, cage
    // =====================================================================
    const ox = -W / 2 + 3.2, oz = -D / 2 + 2.4;
    const desk = M.makeDesk(); desk.position.set(ox, 0.12, oz); add(desk); this.addCollider(ox, oz, 2.5, 1.3);
    const safe = M.makeSafe(); safe.position.set(-W / 2 + 1.1, 0.12, -D / 2 + 5.4); safe.rotation.y = Math.PI / 2; add(safe); this.safe = safe; this.addCollider(-W / 2 + 1.1, -D / 2 + 5.4, 1.3, 1.5);
    const cage = M.makeCashierCage(4.5); cage.position.set(-W / 2 + 6.2, 0.12, -D / 2 + 3.6); cage.rotation.y = Math.PI / 2; add(cage); this.addCollider(-W / 2 + 6.2, -D / 2 + 3.6, 0.6, 4.5);
    const rope1 = M.makeVelvetRope(2.6); rope1.position.set(-W / 2 + 6.2, 0.12, -D / 2 + 7.2); rope1.rotation.y = Math.PI / 2; add(rope1);
    add(M.textPlane('OFFICE · STAFF ONLY (that means me)', { w: 4.2, h: 0.5, color: '#ffd700', glowColor: '#ffd700' }).translateX(-W / 2 + 3.2).translateY(3.0).translateZ(-D / 2 + 0.22));
    const pl = M.makePlanter(); pl.position.set(-W / 2 + 0.7, 0.12, -D / 2 + 0.8); add(pl);
    this.zones.office = { pos: new THREE.Vector3(ox, 0, oz + 1.3), r: 1.5, label: 'Open the Ledger', key: 'office', icon: 'ledger' };
    this.zones.safe = { pos: new THREE.Vector3(-W / 2 + 2.9, 0, -D / 2 + 5.6), r: 1.6, label: 'Cash run', key: 'cashrun', icon: 'safe' };

    // =====================================================================
    // FEATURES FROM UPGRADES
    // =====================================================================
    if (has('bar') || has('buffet')) {
      const len = Math.min(7, D * 0.35);
      const bar = M.makeBar(len); bar.position.set(W / 2 - 1.3, 0.12, -D / 2 + 2 + len / 2); bar.rotation.y = -Math.PI / 2; add(bar);
      this.addCollider(W / 2 - 1.3, -D / 2 + 2 + len / 2, 1.6, len);
      if (has('buffet')) { const t = M.textPlane('ALL-YOU-CAN-EAT · VERY SALTY', { w: 4, h: 0.4, color: '#ffb0c0', glowColor: '#ff2e88', emissive: true }); t.position.set(W / 2 - 0.25, 3.6, -D / 2 + 2 + len / 2); t.rotation.y = -Math.PI / 2; add(t); }
    }
    if (has('atm')) { const a = M.makeATM(); a.position.set(W / 2 - 0.7, 0.12, D / 2 - 2.4); a.rotation.y = -Math.PI / 2; add(a); this.addCollider(W / 2 - 0.7, D / 2 - 2.4, 0.8, 0.8); }
    if (has('bouncer')) { const b = makeBouncer(); b.position.set(2.6, 0.12, D / 2 - 1.1); b.rotation.y = Math.PI; add(b); this.addCollider(2.6, D / 2 - 1.1, 1, 0.7); this.animated.push({ type: 'person', obj: b, t: 0 }); }
    if (has('cart')) { const c = M.makeCart(); c.position.set(-W / 2 + 8, 0.12, -D / 2 + 1.3); add(c); this.animated.push({ type: 'cart', obj: c, t: 0, x0: -W / 2 + 8, range: W - 11 }); }
    if (has('vip')) {
      const vx = W / 2 - 4, vz = -D / 2 + 4;
      add(M.box(7, 0.14, 6, M.texMat(T.carpetTexture('#2a0a3a', '#ffd700', '#7a2aa0', 3, [3, 3]), { roughness: 0.9 }), vx, 0.13, vz));
      for (let i = 0; i < 3; i++) { const r = M.makeVelvetRope(2.2); r.position.set(vx - 2.3 + i * 2.3, 0.14, vz + 3); add(r); }
      const r2 = M.makeVelvetRope(6); r2.position.set(vx - 3.5, 0.14, vz); r2.rotation.y = Math.PI / 2; add(r2);
      add(M.makeNeonSign('VIP', '#ffd700', 3, { intensity: 10 }).translateX(vx).translateY(3.2).translateZ(-D / 2 + 0.25));
      add(M.box(2.4, 0.5, 1.0, M.mat(0x8b0000, { roughness: 0.5 }), vx, 0.45, vz - 1.5)); add(M.box(2.4, 0.9, 0.25, M.mat(0x8b0000, { roughness: 0.5 }), vx, 0.8, vz - 2.0));
      add(M.cyl(0.4, 0.3, 0.5, M.mat(0x111111, { roughness: 0.2 }), vx, 0.4, vz - 0.2, 12)); add(M.cyl(0.1, 0.1, 0.4, M.CHROME(), vx, 0.85, vz - 0.2, 8)); // champagne bucket
      this.addCollider(vx, vz - 1.6, 2.6, 1.4);
    }
    // awards row along the front-left wall
    let ax = -W / 2 + 8.5;
    const placeAward = (obj, w = 2) => { obj.position.set(ax, 0.12, D / 2 - 2.4); add(obj); this.addCollider(ax, D / 2 - 2.4, w, w); ax += w + 1.2; };
    if (has('toilet')) placeAward(M.makeToilet(), 1.8);
    if (has('selfstatue')) placeAward(M.makeStatue('owner'), 1.6);
    if (has('statue')) placeAward(M.makeStatue('rat'), 1.6);
    if (has('tiger')) { const t = M.makeTiger(); placeAward(t, 3.0); this.animated.push({ type: 'tiger', obj: t, t: 0 }); }
    if (has('fountain')) { const f = M.makeFountain(); f.position.set(0, 0.12, D / 2 - 9.5); add(f); this.addCollider(0, D / 2 - 9.5, 3.4, 3.4); this.animated.push({ type: 'fountain', obj: f, t: 0 }); }
    if (has('volcano')) { const v = M.makeVolcano(); v.position.set(W / 2 - 5, 0.12, 2); add(v); this.addCollider(W / 2 - 5, 2, 6, 6); this.animated.push({ type: 'volcano', obj: v, t: 0 }); }

    // =====================================================================
    // DEALER TABLES (front-middle)
    // =====================================================================
    const nTables = Math.round(st.tables);
    const tableZ = D / 2 - 6.2;
    const span = (nTables - 1) * 5;
    for (let i = 0; i < nTables; i++) {
      const x = 4 - span / 2 + i * 5;
      const initials = (game.s.playerName || 'Victor Vane').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'VV';
      const t = M.makeDealerTable(P.felt, initials); t.position.set(x, 0.12, tableZ); add(t);
      this.addCollider(x, tableZ, 3.4, 2.6);
      const seats = [];
      for (let s = 0; s < 3; s++) { const a = Math.PI * (0.25 + s * 0.25); seats.push(new THREE.Vector3(x + Math.cos(a) * 2.35, 0, tableZ + Math.sin(a) * 1.95)); }
      seats.push(new THREE.Vector3(x - 2.2, 0, tableZ + 0.9));
      this.tables.push({ group: t, pos: new THREE.Vector3(x, 0, tableZ), seats, dealerSpot: new THREE.Vector3(x, 0, tableZ - 1.5), occupants: [], cash: 0, aisleZ: tableZ + 2.6 });
    }
    if (this.tables.length) this.zones.dealer = { pos: this.tables[0].dealerSpot.clone(), r: 1.5, label: 'Deal a hand', key: 'dealer', icon: 'cards' };
    if (has('roulette')) { const r = M.makeRouletteTable(); r.position.set(W / 2 - 3.2, 0.12, D / 2 - 7); r.rotation.y = Math.PI / 2; add(r); this.addCollider(W / 2 - 3.2, D / 2 - 7, 1.8, 3.4); this.animated.push({ type: 'wheel', obj: r.userData.wheel }); }

    // =====================================================================
    // SLOT BANKS (back-to-back rows) with a corridor down the right side
    // =====================================================================
    const nMachines = Math.round(st.machines);
    const xMin = -W / 2 + 8, xMax = W / 2 - 4;
    this.corridorX = W / 2 - 2.0;
    const zFirst = -D / 2 + 3.2, zLast = tableZ - 4.6;
    const maxBanks = Math.max(1, Math.floor((zLast - zFirst) / 4.2) + 1);
    const nBanks = Math.max(1, Math.min(maxBanks, Math.ceil(nMachines / 10)));
    const maxPerRow = Math.max(1, Math.floor((xMax - xMin) / 1.2));
    const perRow = Math.min(maxPerRow, Math.max(3, Math.ceil(nMachines / (2 * nBanks))));
    let idx = 0;
    for (let b = 0; b < nBanks && idx < nMachines; b++) {
      const zb = zFirst + b * ((nBanks > 1) ? (zLast - zFirst) / (nBanks - 1) : 0);
      for (const side of [-1, 1]) { // -1: faces the back wall, +1: faces the door
        const count = Math.min(perRow, nMachines - idx); if (count <= 0) break;
        const rowW = count * 1.2, startX = (xMin + xMax) / 2 - rowW / 2 + 0.6;
        for (let i = 0; i < count; i++, idx++) {
          const m = M.makeSlotMachine(idx); const x = startX + i * 1.2, z = zb + side * 0.45;
          m.position.set(x, 0.12, z); m.rotation.y = side === 1 ? 0 : Math.PI; add(m);
          this.machines.push({ group: m, pos: new THREE.Vector3(x, 0, z), usePos: new THREE.Vector3(x, 0, z + side * 0.95), aisleZ: zb + side * 2.1, occupant: null, cash: 0 });
        }
      }
      this.addCollider((xMin + xMax) / 2, zb, perRow * 1.2 + 0.2, 1.9);
      // end caps + a planter at each end of the bank
      for (const s of [-1, 1]) { const p = M.makePlanter(); p.position.set((xMin + xMax) / 2 + s * (perRow * 0.6 + 0.6), 0.12, zb); add(p); }
    }
    this.backAisleZ = zFirst - 2.1;

    // ashtray stands + a couple of planters near the entrance
    for (const x of [-2.6, 2.6]) { add(M.cyl(0.12, 0.15, 0.9, M.CHROME(), x, 0.57, D / 2 - 1.2, 8)); add(M.cyl(0.18, 0.12, 0.08, M.mat(0x111111), x, 1.05, D / 2 - 1.2, 10)); }

    // =====================================================================
    // OUTSIDE PROPS FROM AD UPGRADES
    // =====================================================================
    if (has('bus')) { const b = M.makeBus(0xffcc00, 'LUCKY DUCK · KIDS RIDE FREE*'); b.position.set(-W / 2 - 6, 0, D / 2 + 13.5); add(b); this.animated.push({ type: 'bus', obj: b, t: 0, z: D / 2 + 13.5, range: W + 110 }); }
    if (has('shuttle')) { const s = M.makeBus(0xeeeeee, 'SUNSET ACRES → CASINO (one way)'); s.position.set(W / 2 + 9, 0, D / 2 + 8.6); s.rotation.y = 0; add(s); }
    if (has('billboard')) { const bbName = game.s.playerName ? game.s.playerName.toUpperCase() : 'VICTOR VANE'; const bb = M.makeBillboard(`${bbName} SAYS: YOU WILL WIN*`, '*results not typical. or possible.'); bb.position.set(W / 2 + 14, 0, D / 2 - 4); bb.rotation.y = -0.5; add(bb); }
    if (has('tower')) { const t = M.makeTower(0x2a0c14); t.position.set(0, 0, -D / 2 - 6); add(t); this.animated.push({ type: 'neon', obj: t.userData.sign, t: 0, flick: 0.05 }); }
    if (has('jet')) { const j = M.makeJet(); j.position.set(W / 2 + 16, 6, -8); j.rotation.y = 0.4; add(j); this.animated.push({ type: 'jet', obj: j, t: 0 }); }

    // =====================================================================
    // ZONES & NAVIGATION
    // =====================================================================
    this.streetPos = new THREE.Vector3(0, 0, D / 2 + 3.6);
    this.doorInside = new THREE.Vector3(0, 0, D / 2 - 1.6);
    this.doorOutside = new THREE.Vector3(0, 0, D / 2 + 1.6);
    this.spawnPoint = new THREE.Vector3(0, 0, D / 2 + 8);
    this.aisleZ = tableZ + 2.6;   // front walkway (also the tables' aisle)
    const mat = M.textPlane('WELCOME · NO REFUNDS · NO EXITS', { w: 3, h: 0.4, color: '#b89830' }); mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.14, D / 2 - 0.8); add(mat);
  }

  freeMachine() { const free = this.machines.filter(m => !m.occupant); return free.length ? free[Math.floor(Math.random() * free.length)] : null; }
  freeTableSeat() { for (const t of this.tables) if (t.occupants.length < t.seats.length) return t; return null; }

  /** Waypoints from the door to a spot on the floor (machine or table seat). */
  pathTo(fromPos, target, targetAisleZ) {
    const cx = this.corridorX;
    if (Math.abs(targetAisleZ - this.aisleZ) < 0.5) return [new THREE.Vector3(target.x, 0, targetAisleZ), target.clone()];
    return [new THREE.Vector3(cx, 0, this.aisleZ), new THREE.Vector3(cx, 0, targetAisleZ), new THREE.Vector3(target.x, 0, targetAisleZ), target.clone()];
  }
  pathOut(fromPos, aisleZ) {
    const cx = this.corridorX;
    const out = [];
    if (Math.abs(aisleZ - this.aisleZ) >= 0.5) { out.push(new THREE.Vector3(fromPos.x, 0, aisleZ), new THREE.Vector3(cx, 0, aisleZ), new THREE.Vector3(cx, 0, this.aisleZ)); }
    else out.push(new THREE.Vector3(fromPos.x, 0, aisleZ));
    out.push(this.doorInside.clone(), this.doorOutside.clone(), this.spawnPoint.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, 2)));
    return out;
  }

  /** Push a circle (x,z,r) out of the colliders. Mutates pos.
   *  Runs multiple passes so being pushed out of one box doesn't leave
   *  the player stuck inside an adjacent one. */
  collide(pos, r) {
    for (let pass = 0; pass < 3; pass++) {
      let pushed = false;
      for (const c of this.colliders) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-6) { pos.z += r; pushed = true; continue; }
          const d = Math.sqrt(d2);
          const pen = r - d;
          pos.x += dx / d * pen;
          pos.z += dz / d * pen;
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    pos.x = Math.max(-this.W / 2 - 22, Math.min(this.W / 2 + 22, pos.x));
    pos.z = Math.max(-this.D / 2 + 0.6, Math.min(this.D / 2 + 12, pos.z));
  }

  update(dt, time) {
    // chase lights: shared bulb texture offset, stepped
    T.bulbStripTexture().offset.x = Math.floor(time * 6) / 8;
    for (const a of this.animated) {
      a.t += dt;
      switch (a.type) {
        case 'neon': {
          if (!a.obj || !a.obj.userData.light) break;
          const flick = (Math.sin(a.t * 13) > 1 - a.flick * 0.4 || Math.sin(a.t * 7.3 + 1) > 0.995 - a.flick * 0.1) ? 0.15 : 1;
          a.obj.userData.light.intensity = a.obj.userData.baseIntensity * flick;
          a.obj.userData.plane.material.opacity = 0.35 + 0.65 * flick;
          break;
        }
        case 'lamp': a.obj.intensity = a.base * (0.92 + Math.sin(a.t * 40) * 0.03 + Math.sin(a.t * 3) * 0.05); break;
        case 'puff': a.obj.position.y = a.y0 - (a.t % 6) * 0.35; a.obj.material.opacity = 0.3 * (1 - (a.t % 6) / 6); a.obj.scale.setScalar(0.6 + (a.t % 6) * 0.4); break;
        case 'tiger': a.obj.userData.tail.rotation.y = Math.sin(a.t * 3) * 0.5; break;
        case 'fountain': a.obj.userData.jet.scale.y = 0.85 + Math.sin(a.t * 6) * 0.15; break;
        case 'volcano': { const e = (a.t % 15) < 2.5; a.obj.userData.light.intensity = e ? 60 + Math.sin(a.t * 30) * 30 : 14; a.obj.userData.lava.scale.y = e ? 3 : 1; break; }
        case 'wheel': a.obj.rotation.y += dt * 2; break;
        case 'bus': a.obj.position.x = -a.range / 2 + ((a.t * 5) % a.range); break;
        case 'car': a.obj.position.x = -a.range / 2 + ((a.t * 11) % a.range); break;
        case 'cart': a.obj.position.x = a.x0 + (Math.sin(a.t * 0.3) * 0.5 + 0.5) * a.range; break;
        case 'jet': a.obj.position.y = 6 + Math.sin(a.t * 0.5) * 0.6; a.obj.rotation.z = Math.sin(a.t * 0.3) * 0.05; break;
        case 'person': { const u = a.obj.userData; u.idleT = (u.idleT || 0) + dt; u.head.rotation.y = Math.sin(u.idleT * 0.6) * 0.5; break; }
      }
    }
    // slot machines: candle blink, reels spin while occupied
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i], u = m.group.userData;
      const blink = Math.sin(time * 4 + i * 1.7) > 0.3;
      u.candle.material = blink ? M.glow(0xff3d00, 2.2) : M.glow(0xffaa00, 0.6);
      if (m.occupant) {
        for (let r = 0; r < 3; r++) { const phase = (time * 0.8 + i * 0.37 + r * 0.33) % 1; if (phase < 0.55) u.reels[r].rotation.y += dt * (14 - r * 3); }
        u.light.intensity = 1.6 + Math.sin(time * 12 + i) * 0.5;
      } else u.light.intensity = 0.8;
    }
  }
}
