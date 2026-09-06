// Builds the current casino (interior + street outside) from the casino def
// plus whatever upgrade models the player owns. Rebuilt on every purchase that
// has a `model` key, so the world visibly changes with upgrades.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from './models.js';
import * as T from '../engine/textures.js';
import { makeBouncer } from './people.js';

function _disposeHierarchy(obj) {
  obj.traverse(child => {
    // Skip cached geometries (from geoCache) — they're reused across builds.
    // Dispose unique geometries like ExtrudeGeometry, TubeGeometry created inline.
    if (child.geometry && !child.geometry._cached) child.geometry.dispose();
    // Dispose lights' shadow maps
    if (child.shadow && child.shadow.map) {
      child.shadow.map.dispose();
      child.shadow.map = null;
    }
  });
}

const PALETTE = {
  duck:   { carpet: ['#3a0b1e', '#c99a2e', '#7a2a5a'], wall: ['#3b2418', '#b8862a'], felt: '#0f5a3a', facade: 'brick', neighbours: ['pawn', 'bail'], ceiling: 0x120a10, warm: 0xffb060 },
  rat:    { carpet: ['#0e1428', '#b89840', '#1a2040'], wall: ['#161c2e', '#8a7a50'], felt: '#0e3a5a', facade: 'stone', neighbours: ['LIQUOR', 'TATTOO'], ceiling: 0x10141e, warm: 0xffc878 },
  diablo: { carpet: ['#f0e8d8', '#d4af37', '#c8bca8'], wall: ['#e8e0d0', '#d4af37'], felt: '#0a4a7a', facade: 'marble', neighbours: [], ceiling: 0xf0ece0, warm: 0xfff0d0 },
};

export class CasinoWorld {
  static _candleOn = M.glow(0xff3d00, 2.2);
  static _candleOff = M.glow(0xffaa00, 0.6);

  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.machines = []; this.tables = []; this.props = []; this.colliders = []; this.zones = {}; this.animated = []; this.lampXs = [];
  }

  clear() {
    _disposeHierarchy(this.root);
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.machines = []; this.tables = []; this.props = []; this.colliders = []; this.zones = {}; this.animated = []; this.lampXs = []; this.neonSigns = [];
  }

  addCollider(x, z, w, d, dynamic = false) { this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, dynamic }); }

  rebuildColliders() {
    this.colliders = this.colliders.filter(c => !c.dynamic);
    for (const t of this.tables) {
      this.addCollider(t.group.position.x, t.group.position.z, 3.4, 2.6, true);
    }
    for (const m of this.machines) {
      this.addCollider(m.group.position.x, m.group.position.z, 1.2, 1.2, true);
    }
  }

  addProp(group, name, x, z, hw, hd, opts = {}) {
    group.position.set(x, group.position.y || 0.12, z);
    this.root.add(group);
    const prop = { group, name, pos: new THREE.Vector3(x, 0, z), hw, hd, ...opts };
    this.props.push(prop);
    return prop;
  }

  build(def, game) {
    this.clear();
    const st = game.stats;
    const has = k => game.hasModel(k);
    const P = PALETTE[def.id];
    const W = def.width, D = def.depth, H = 4.8;
    this.W = W; this.D = D; this.H = H;
    const R = this.root;
    const add = (o) => { R.add(o); return o; };
    const tier = def.id === 'duck' ? 0 : def.id === 'rat' ? 1 : 2;

    // =====================================================================
    // STREET
    // =====================================================================
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.18, metalness: 0.15 }); // wet look
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), asphalt);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; add(ground);
    // puddles (instanced)
    {
      const puddleGeo = new THREE.CircleGeometry(1.4, 12);
      const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.03, metalness: 0.3 });
      const puddleIM = new THREE.InstancedMesh(puddleGeo, puddleMat, 14);
      const puddleDummy = new THREE.Object3D();
      for (let i = 0; i < 14; i++) {
        puddleDummy.position.set((Math.random() - 0.5) * (W + 40), 0.0, D / 2 + 7 + Math.random() * 10);
        puddleDummy.rotation.set(-Math.PI / 2, 0, 0);
        puddleDummy.scale.set(1.6, 0.6 + Math.random() * 1.0, 1);
        puddleDummy.updateMatrix();
        puddleIM.setMatrixAt(i, puddleDummy.matrix);
      }
      add(puddleIM);
    }
    const sidewalk = M.box(W + 24, 0.16, 6.2, M.mat(0x2e2e34, { roughness: 0.85 }), 0, 0.0, D / 2 + 3.1); add(sidewalk);
    add(M.box(W + 24, 0.18, 0.2, M.mat(0x44444c), 0, 0.0, D / 2 + 6.2)); // curb
    // paving lines (instanced)
    {
      const pavGeo = new THREE.BoxGeometry(0.04, 0.17, 6.2);
      const pavMat = M.mat(0x26262c);
      const pavPositions = [];
      for (let x = -W / 2 - 12; x < W / 2 + 12; x += 2) pavPositions.push(x);
      const pavIM = new THREE.InstancedMesh(pavGeo, pavMat, pavPositions.length);
      const pavDummy = new THREE.Object3D();
      for (let i = 0; i < pavPositions.length; i++) {
        pavDummy.position.set(pavPositions[i], 0.0, D / 2 + 3.1);
        pavDummy.updateMatrix();
        pavIM.setMatrixAt(i, pavDummy.matrix);
      }
      pavIM.receiveShadow = true;
      add(pavIM);
    }
    // road dashes (instanced)
    {
      const dashGeo = new THREE.BoxGeometry(2, 0.01, 0.18);
      const dashMat = M.mat(0xd9c25a, { roughness: 0.6 });
      const dashXs = [];
      for (let x = -W / 2 - 40; x < W / 2 + 40; x += 4) dashXs.push(x);
      const dashIM = new THREE.InstancedMesh(dashGeo, dashMat, dashXs.length);
      const dashDummy = new THREE.Object3D();
      for (let i = 0; i < dashXs.length; i++) {
        dashDummy.position.set(dashXs[i], 0.0, D / 2 + 11);
        dashDummy.updateMatrix();
        dashIM.setMatrixAt(i, dashDummy.matrix);
      }
      add(dashIM);
    }
    add(M.box(W + 80, 0.01, 0.12, M.mat(0xffffff, { roughness: 0.6 }), 0, 0.0, D / 2 + 6.6));
    // far side of the street: dark buildings silhouette
    {
      const farWinPositions = [];
      for (let i = -4; i <= 4; i++) {
        const bw = 8 + Math.random() * 6, bh = 8 + Math.random() * 14;
        const bx = i * 14 + (Math.random() - 0.5) * 3;
        const b = M.box(bw, bh, 8, M.texMat(T.brickTexture('#22181a', '#100c0e'), { roughness: 0.95 }), bx, bh / 2, D / 2 + 24); add(b);
        for (let y = 2; y < bh - 1; y += 2.5) for (let x = -bw / 2 + 1; x < bw / 2 - 0.5; x += 2) if (Math.random() < 0.35) farWinPositions.push(bx + x, y, D / 2 + 19.97);
      }
      if (farWinPositions.length > 0) {
        const winGeo = new THREE.BoxGeometry(0.8, 1.0, 0.05);
        const winMat = M.glow(0xffe08a, 0.6);
        const count = farWinPositions.length / 3;
        const im = new THREE.InstancedMesh(winGeo, winMat, count);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          dummy.position.set(farWinPositions[i * 3], farWinPositions[i * 3 + 1], farWinPositions[i * 3 + 2]);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        }
        add(im);
      }
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
    const marbleW = def.id === 'duck' ? 3.4 : 4.2;
    const marble = M.texMat(T.marbleTexture(def.id === 'duck' ? '#a09888' : '#c8c0b4', def.id === 'duck' ? '#787068' : '#a8a098', [1, 2]), { roughness: def.id === 'duck' ? 0.6 : 0.3, metalness: def.id === 'duck' ? 0.02 : 0.06, envMapIntensity: 0.1 });
    const walkLen = def.id === 'duck' ? 6 : D - 2;
    add(M.box(marbleW, 0.13, walkLen, marble, 0, 0.065, D / 2 - walkLen / 2));
    add(M.box(marbleW + 0.2, 0.02, walkLen + 0.2, M.mat(0xc8a020, { metalness: 0.5, roughness: 0.5, flatShading: false }), 0, 0.125, D / 2 - walkLen / 2).translateY(-0.01));
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
    const beamMat = M.mat(tier === 2 ? 0xd4c8b0 : tier === 1 ? 0x2a3048 : 0x3a2a1a, { roughness: 0.4, metalness: tier === 0 ? 0 : 0.15 });
    const beamW = def.id === 'duck' ? 0.2 : 0.25;
    for (let x = -W / 2 + 4; x < W / 2; x += 4) add(M.box(beamW, 0.25, D, beamMat, x, H - 0.12, 0));
    if (def.id !== 'duck') { for (let z = -D / 2 + 4; z < D / 2; z += 4) add(M.box(W, 0.25, beamW, beamMat, 0, H - 0.12, z)); }
    // door: swung-open double doors + awning with bulbs
    const dl = M.makeDoubleDoor(doorW, 3.2); dl.position.set(0, 0.12, D / 2); add(dl);
    dl.children[0].rotation.y = -Math.PI / 2 + 0.2; dl.children[0].position.set(-doorW / 2 + 0.05, 0, doorW / 4 + 0.2);
    dl.children[1].rotation.y = Math.PI / 2 - 0.2; dl.children[1].position.set(doorW / 2 - 0.05, 0, doorW / 4 + 0.2);
    add(M.box(doorW + 1.2, 0.25, 2.2, M.mat(0x8b0000, { roughness: 0.6 }), 0, 3.45, D / 2 + 1.1));
    add(M.box(doorW + 1.3, 0.06, 2.3, M.mat(0xc8a020, { metalness: 0.5, roughness: 0.45, flatShading: false }), 0, 3.6, D / 2 + 1.1));
    const awningBulbs = new THREE.Mesh(new THREE.PlaneGeometry(doorW + 1.2, 0.14), new THREE.MeshBasicMaterial({ map: T.bulbStripTexture(), transparent: true, toneMapped: true }));
    awningBulbs.position.set(0, 3.36, D / 2 + 2.21); add(awningBulbs);
    const doorLight = new THREE.PointLight(0xffd080, 5, 10, 1.8); doorLight.position.set(0, 3.2, D / 2 + 1.2); add(doorLight);
    { let ropeN = 1;
      for (const x of [-doorW / 2 - 0.6, doorW / 2 + 0.6]) { const r = M.makeVelvetRope(2.6); r.rotation.y = Math.PI / 2; r.position.y = 0.16; this.addProp(r, `Velvet Rope ${ropeN++}`, x, D / 2 + 3.2, 0.2, 1.4); }
    }
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
    const MAX_CHANDELIER_LIGHTS = 12;
    let chandelierLightCount = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = -W / 2 + (i + 0.5) * W / cols, z = -D / 2 + (j + 0.5) * D / rows;
      if (def.id !== 'duck') {
        const useRealLight = chandelierLightCount < MAX_CHANDELIER_LIGHTS;
        const ch = M.makeChandelier(def.id === 'diablo' ? 1.5 : 1.1, useRealLight);
        ch.position.set(x, H - 1.3, z); add(ch);
        if (useRealLight) { ch.userData.light.intensity = has('sky') ? 24 : 34; ch.userData.light.color.set(has('sky') ? 0xcfe8ff : P.warm); }
        chandelierLightCount++;
      }
      else { const l = new THREE.PointLight(P.warm, 6, 16, 1.6); l.position.set(x, H - 0.5, z); add(l); add(M.cyl(0.25, 0.3, 0.1, M.glow(0xffe0b0, 1.4), x, H - 0.16, z, 10)); }
    }
    // sconces along the side walls
    const sconceSpacing = def.id === 'duck' ? 6 : 4.5;
    const sconceIntensity = def.id === 'duck' ? 3 : 5;
    for (let z = -D / 2 + 3; z < D / 2 - 2; z += sconceSpacing) {
      const s1 = M.makeSconce(P.warm); s1.position.set(-W / 2 + 0.24, 2.6, z); s1.rotation.y = Math.PI / 2; add(s1); s1.userData.light.intensity = sconceIntensity;
      const s2 = M.makeSconce(P.warm); s2.position.set(W / 2 - 0.24, 2.6, z); s2.rotation.y = -Math.PI / 2; add(s2); s2.userData.light.intensity = sconceIntensity;
      // rat + diablo: also sconces along the back wall
      if (def.id !== 'duck' && z > -D / 2 + 4 && z < 0) {
        const s3 = M.makeSconce(P.warm); s3.position.set(z, 2.6, -D / 2 + 0.24); add(s3); s3.userData.light.intensity = sconceIntensity;
      }
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
    // WALL & FLOOR DRESSING
    // =====================================================================
    const gold = M.GOLD(), chrome = M.CHROME();

    // wainscoting / baseboard trim along all interior walls
    const trimMat = M.mat(tier === 2 ? 0xd8d0c0 : tier === 1 ? 0x2a3048 : 0x3a2a1a, { roughness: tier === 2 ? 0.3 : 0.5, metalness: tier > 0 ? 0.25 : 0.15 });
    const trimH = tier > 0 ? 0.7 : 0.5;
    add(M.box(W, trimH, 0.06, trimMat, 0, trimH / 2 + 0.12, -D / 2 + 0.22));
    add(M.box(0.06, trimH, D, trimMat, -W / 2 + 0.22, trimH / 2 + 0.12, 0));
    add(M.box(0.06, trimH, D, trimMat, W / 2 - 0.22, trimH / 2 + 0.12, 0));
    add(M.box(W, 0.04, 0.02, gold, 0, trimH + 0.14, -D / 2 + 0.24));
    add(M.box(0.02, 0.04, D, gold, -W / 2 + 0.24, trimH + 0.14, 0));
    add(M.box(0.02, 0.04, D, gold, W / 2 - 0.24, trimH + 0.14, 0));

    // crown moulding at ceiling (rat + diablo)
    if (tier > 0) {
      const crownMat = M.mat(tier === 2 ? 0xe0d8c8 : 0x3a4058, { roughness: 0.4, metalness: 0.2 });
      add(M.box(W, 0.12, 0.12, crownMat, 0, H - 0.06, -D / 2 + 0.22));
      add(M.box(0.12, 0.12, D, crownMat, -W / 2 + 0.22, H - 0.06, 0));
      add(M.box(0.12, 0.12, D, crownMat, W / 2 - 0.22, H - 0.06, 0));
      add(M.box(W, 0.04, 0.04, gold, 0, H - 0.14, -D / 2 + 0.22));
      add(M.box(0.04, 0.04, D, gold, -W / 2 + 0.22, H - 0.14, 0));
      add(M.box(0.04, 0.04, D, gold, W / 2 - 0.22, H - 0.14, 0));
    }

    // marble floor inlays (rat + diablo): entrance medallion + border
    if (tier > 0) {
      const marbleDark = M.mat(tier === 2 ? 0xc8c0b4 : 0x2a2a34, { roughness: 0.2, metalness: 0.05, flatShading: false });
      const marbleLight = M.texMat(T.marbleTexture(tier === 2 ? '#f0ece0' : '#c0b8a8', tier === 2 ? '#d8d0c0' : '#9a9088', [2, 2]), { roughness: 0.3, metalness: 0.03 });
      // border strip around the entire floor (raised above carpet top at y=0.12)
      add(M.box(W - 1, 0.02, 0.18, gold, 0, 0.16, -D / 2 + 0.7));
      add(M.box(W - 1, 0.02, 0.18, gold, 0, 0.16, D / 2 - 0.7));
      add(M.box(0.18, 0.02, D - 1, gold, -W / 2 + 0.7, 0.16, 0));
      add(M.box(0.18, 0.02, D - 1, gold, W / 2 - 0.7, 0.16, 0));
      if (tier < 2) {
        // medallion near the entrance (between the door and the tables) — rat only
        const medZ = D / 2 - D * 0.35;
        const med = M.box(3.0, 0.02, 3.0, marbleLight, 0, 0.16, medZ);
        med.rotation.y = Math.PI / 4; add(med);
        add(M.cyl(1.8, 1.8, 0.02, marbleDark, 0, 0.17, medZ, 24));
        add(M.cyl(1.4, 1.4, 0.02, marbleLight, 0, 0.175, medZ, 20));
        add(M.cyl(0.25, 0.25, 0.02, gold, 0, 0.18, medZ, 12));
      }
    }

    // columns (rat + diablo) — flanking the gaming floor, along the edges of the slot zone
    if (tier > 0) {
      const colStyle = tier === 2 ? 'ionic' : 'doric';
      const colXL = -W / 2 + 3.5;
      const colXR = W / 2 - 2.5;
      const colZStart = -D / 2 + 4;
      const colZEnd = D / 2 - 7;
      const colCount = Math.max(2, Math.round((colZEnd - colZStart) / 6));
      let colN = 1;
      for (let i = 0; i < colCount; i++) {
        const z = colZStart + i * (colZEnd - colZStart) / (colCount - 1);
        for (const cx of [colXL, colXR]) {
          const col = M.makeColumn(H - 0.3, colStyle);
          this.addProp(col, `Column ${colN++}`, cx, z, 0.35, 0.35);
        }
      }
    }

    // =====================================================================
    // PALAZZO DIABLO — MULTI-ROOM LUXURY LAYOUT
    // Real interior walls with doorways creating distinct rooms:
    //   - Grand Entrance Hall (front section)
    //   - Central Gaming Hall (main floor)
    //   - Left Wing with awards & side games
    //   - Right Lounge Wing with bar area
    //   - Back VIP Wing / High-Roller area
    //   - Royal Office (back-left, with aquarium)
    // =====================================================================
    if (tier === 2) {
      const goldLine = M.mat(0xd4af37, { metalness: 0.7, roughness: 0.3, flatShading: false });
      const marbleTileMat = M.texMat(T.marbleTileTexture('#f0ece0', '#d8d0c0', '#d4af37', [W / 5, D / 5]), { roughness: 0.25, metalness: 0.04, envMapIntensity: 0.08 });
      const herringMat = M.texMat(T.herringboneTexture('#c8b898', '#b8a888', '#d4af37', [5, 5]), { roughness: 0.5, metalness: 0.02 });
      const medallionMat = M.texMat(T.medallionTexture('#e8e0d0', '#d4af37', '#a09080', [1, 1]), { roughness: 0.3, metalness: 0.05, envMapIntensity: 0.1 });
      const roomWallMat = M.texMat(T.wallTexture(P.wall[0], P.wall[1], [3, 1]), { roughness: 0.85 });

      // --- ROOM BOUNDARY COORDINATES ---
      const divZ1 = D / 2 - 12;       // entrance hall → gaming hall
      const divZ2 = -D / 2 + 12;      // gaming hall → back wing
      const divX1 = -W / 2 + 13;      // left wing boundary
      const divX2 = W / 2 - 10;       // right wing boundary
      const officeZ = -D / 2 + 12;    // royal office top boundary
      const officeX = -W / 2 + 13;    // royal office right boundary
      const doorGap = 3.6;

      // ~~~ INTERIOR WALLS (real geometry, not just floor lines) ~~~

      // WALL: entrance hall ↔ gaming hall (horizontal, with wide central doorway)
      const wallFrontL = (divX1 + W / 2 - doorGap / 2) / 2;
      const wallFrontR = (W / 2 - divX2 + doorGap / 2) / 2;
      // left section
      add(M.box(divX1 - (-W / 2) - doorGap / 2 - 0.5, H, 0.3, roomWallMat, (-W / 2 + divX1 - doorGap / 2) / 2, H / 2, divZ1));
      this.addCollider((-W / 2 + divX1 - doorGap / 2) / 2, divZ1, divX1 - (-W / 2) - doorGap / 2 - 0.5, 0.3);
      // center-left section
      add(M.box((divX1 + doorGap / 2) - (-doorGap / 2) - doorGap, H, 0.3, roomWallMat, (divX1 - doorGap / 2 + (-doorGap / 2)) / 2, H / 2, divZ1));
      // right section
      add(M.box(W / 2 - divX2 - doorGap / 2 - 0.5, H, 0.3, roomWallMat, (W / 2 + divX2 + doorGap / 2) / 2, H / 2, divZ1));
      this.addCollider((W / 2 + divX2 + doorGap / 2) / 2, divZ1, W / 2 - divX2 - doorGap / 2 - 0.5, 0.3);
      // center-right section
      add(M.box((doorGap / 2) - (-divX2 + doorGap / 2) + doorGap, H, 0.3, roomWallMat, (doorGap / 2 + divX2 - doorGap / 2) / 2, H / 2, divZ1));
      // gold trim on top
      add(M.box(W - 1, 0.06, 0.06, gold, 0, H - 0.04, divZ1));
      // grand entrance arch in the center doorway
      const entryArch = M.makeArch(doorGap, H - 0.3);
      entryArch.position.set(0, 0.12, divZ1); add(entryArch);

      // WALL: gaming hall ↔ back wing (horizontal, with central doorway)
      const backWallLeftLen = (officeX - (-W / 2)) - doorGap / 2;
      add(M.box(backWallLeftLen, H, 0.3, roomWallMat, -W / 2 + backWallLeftLen / 2, H / 2, divZ2));
      this.addCollider(-W / 2 + backWallLeftLen / 2, divZ2, backWallLeftLen, 0.3);
      const backWallRightLen = W / 2 - (doorGap / 2);
      add(M.box(backWallRightLen - 0.5, H, 0.3, roomWallMat, doorGap / 2 + (backWallRightLen - 0.5) / 2, H / 2, divZ2));
      this.addCollider(doorGap / 2 + (backWallRightLen - 0.5) / 2, divZ2, backWallRightLen - 0.5, 0.3);
      add(M.box(W - 1, 0.06, 0.06, gold, 0, H - 0.04, divZ2));
      const backArch = M.makeArch(doorGap, H - 0.3);
      backArch.position.set(0, 0.12, divZ2); add(backArch);

      // WALL: left wing (vertical, with doorway at mid-height of gaming hall)
      const leftWallFrontLen = divZ1 - doorGap / 2 - 0;
      const leftWallBackLen = 0 - (divZ2 + doorGap / 2);
      add(M.box(0.3, H, leftWallFrontLen, roomWallMat, divX1, H / 2, divZ1 - leftWallFrontLen / 2));
      this.addCollider(divX1, divZ1 - leftWallFrontLen / 2, 0.3, leftWallFrontLen);
      add(M.box(0.3, H, leftWallBackLen, roomWallMat, divX1, H / 2, divZ2 + doorGap / 2 + leftWallBackLen / 2));
      this.addCollider(divX1, divZ2 + doorGap / 2 + leftWallBackLen / 2, 0.3, leftWallBackLen);
      add(M.box(0.06, 0.06, divZ1 - divZ2, gold, divX1, H - 0.04, (divZ1 + divZ2) / 2));
      const leftArch = M.makeArch(doorGap, H - 0.3);
      leftArch.position.set(divX1, 0.12, 0); leftArch.rotation.y = Math.PI / 2; add(leftArch);

      // WALL: right wing (vertical, with doorway)
      add(M.box(0.3, H, leftWallFrontLen, roomWallMat, divX2, H / 2, divZ1 - leftWallFrontLen / 2));
      this.addCollider(divX2, divZ1 - leftWallFrontLen / 2, 0.3, leftWallFrontLen);
      add(M.box(0.3, H, leftWallBackLen, roomWallMat, divX2, H / 2, divZ2 + doorGap / 2 + leftWallBackLen / 2));
      this.addCollider(divX2, divZ2 + doorGap / 2 + leftWallBackLen / 2, 0.3, leftWallBackLen);
      add(M.box(0.06, 0.06, divZ1 - divZ2, gold, divX2, H - 0.04, (divZ1 + divZ2) / 2));
      const rightArch = M.makeArch(doorGap, H - 0.3);
      rightArch.position.set(divX2, 0.12, 0); rightArch.rotation.y = Math.PI / 2; add(rightArch);

      // WALL: royal office partition (back-left corner, from left outer wall to divX1)
      // Horizontal wall along officeZ from outer left wall to divX1, with doorway
      const officeWallLen = officeX - (-W / 2) - doorGap - 0.5;
      add(M.box(officeWallLen / 2, H, 0.3, roomWallMat, -W / 2 + officeWallLen / 4, H / 2, officeZ));
      this.addCollider(-W / 2 + officeWallLen / 4, officeZ, officeWallLen / 2, 0.3);
      add(M.box(officeWallLen / 2, H, 0.3, roomWallMat, officeX - officeWallLen / 4, H / 2, officeZ));
      this.addCollider(officeX - officeWallLen / 4, officeZ, officeWallLen / 2, 0.3);
      add(M.box(officeX - (-W / 2), 0.06, 0.06, gold, (-W / 2 + officeX) / 2, H - 0.04, officeZ));
      const officeArch = M.makeArch(doorGap, H - 0.3);
      officeArch.position.set((-W / 2 + officeX) / 2, 0.12, officeZ); add(officeArch);

      // ~~~ FLOOR OVERLAYS per room ~~~

      // Floor overlays use y=0.18+ to sit well above the main carpet (top at y=0.12)
      const floorY = 0.18;

      // Grand Entrance Hall: polished marble tiles
      const entranceD = D / 2 - divZ1;
      add(M.box(W - 3, 0.04, entranceD - 1, marbleTileMat, 0, floorY, D / 2 - entranceD / 2));

      // Grand medallion at entrance center
      const grandMedZ = D / 2 - entranceD / 2;
      add(M.box(6, 0.02, 6, medallionMat, 0, floorY + 0.03, grandMedZ));
      add(M.cyl(3.2, 3.2, 0.02, M.mat(0xd4af37, { metalness: 0.6, roughness: 0.3 }), 0, floorY + 0.045, grandMedZ, 32));
      add(M.cyl(2.8, 2.8, 0.02, M.mat(0xe8e0d0, { roughness: 0.25 }), 0, floorY + 0.05, grandMedZ, 28));
      add(M.cyl(0.6, 0.6, 0.02, gold, 0, floorY + 0.06, grandMedZ, 16));

      // Back VIP wing: herringbone parquet
      const backD = divZ2 - (-D / 2);
      add(M.box(W - 3, 0.04, backD - 1, herringMat, 0, floorY, -D / 2 + backD / 2));

      // Royal Office: dark herringbone with gold border
      const roW = officeX - (-W / 2) - 1;
      const roD = officeZ - (-D / 2) - 1;
      const roCX = (-W / 2 + officeX) / 2;
      const roCZ = (-D / 2 + officeZ) / 2;
      add(M.box(roW, 0.06, roD, M.texMat(T.herringboneTexture('#4a3020', '#3a2418', '#8b6b3a', [3, 3]), { roughness: 0.4, metalness: 0.03 }), roCX, floorY, roCZ));
      // gold border around office floor
      add(M.box(roW, 0.02, 0.1, goldLine, roCX, floorY + 0.04, -D / 2 + 1));
      add(M.box(roW, 0.02, 0.1, goldLine, roCX, floorY + 0.04, officeZ - 0.5));
      add(M.box(0.1, 0.02, roD, goldLine, -W / 2 + 1, floorY + 0.04, roCZ));
      add(M.box(0.1, 0.02, roD, goldLine, officeX - 0.5, floorY + 0.04, roCZ));

      // ~~~ GOLD INLAY LINES on gaming hall floor ~~~
      // Perimeter of central gaming hall
      const gL = divX1 + 1, gR = divX2 - 1, gF = divZ1 - 1, gB = divZ2 + 1;
      const gW = gR - gL, gD = gF - gB, gCX = (gL + gR) / 2, gCZ = (gF + gB) / 2;
      add(M.box(gW, 0.015, 0.08, goldLine, gCX, floorY + 0.03, gF));
      add(M.box(gW, 0.015, 0.08, goldLine, gCX, floorY + 0.03, gB));
      add(M.box(0.08, 0.015, gD, goldLine, gL, floorY + 0.03, gCZ));
      add(M.box(0.08, 0.015, gD, goldLine, gR, floorY + 0.03, gCZ));
      // secondary inner border
      add(M.box(gW - 2, 0.015, 0.04, goldLine, gCX, floorY + 0.03, gF - 0.5));
      add(M.box(gW - 2, 0.015, 0.04, goldLine, gCX, floorY + 0.03, gB + 0.5));
      add(M.box(0.04, 0.015, gD - 2, goldLine, gL + 0.5, floorY + 0.03, gCZ));
      add(M.box(0.04, 0.015, gD - 2, goldLine, gR - 0.5, floorY + 0.03, gCZ));

      // Gold runner lines along the marble walkway
      add(M.box(0.06, 0.015, D - 3, goldLine, -marbleW / 2 - 0.3, 0.14, 0));
      add(M.box(0.06, 0.015, D - 3, goldLine, marbleW / 2 + 0.3, 0.14, 0));

      // ~~~ ROOM ACCENT FEATURES ~~~

      // Oversized columns flanking the entrance
      for (const cx of [-4, 4]) {
        const ec = M.makeColumn(H - 0.3, 'ionic');
        ec.position.set(cx, 0.12, D / 2 - 2.5); add(ec);
      }

      // Ornamental urns at wall intersections
      let urnN = 1;
      for (const [ux, uz] of [
        [divX1 + 0.8, divZ1 - 1], [divX1 + 0.8, divZ2 + 1],
        [divX2 - 0.8, divZ1 - 1], [divX2 - 0.8, divZ2 + 1],
        [-W / 2 + 1, divZ1 - 1], [W / 2 - 1, divZ1 - 1],
      ]) {
        const urn = M.makeOrnateUrn();
        this.addProp(urn, `Urn ${urnN++}`, ux, uz, 0.35, 0.35);
      }

      // Palm trees in the entrance hall
      let palmN = 1;
      for (const [px, pz] of [
        [-W / 2 + 2.5, D / 2 - 3], [W / 2 - 2.5, D / 2 - 3],
        [-W / 2 + 2.5, D / 2 - 9], [W / 2 - 2.5, D / 2 - 9],
        [-6, D / 2 - 3], [6, D / 2 - 3],
      ]) {
        const palm = M.makePalmTree();
        this.addProp(palm, `Palm ${palmN++}`, px, pz, 0.4, 0.4);
      }

      // Ceiling rosettes at beam intersections (instanced)
      {
        const rosettePositions = [];
        for (let x = -W / 2 + 8; x < W / 2; x += 8)
          for (let z = -D / 2 + 8; z < D / 2; z += 8)
            rosettePositions.push([x, H - 0.2, z]);
        if (rosettePositions.length) {
          const proto = M.makeCeilingRosette(0.5);
          for (let i = 1; i < rosettePositions.length; i++) {
            const clone = proto.clone();
            clone.position.set(...rosettePositions[i]); add(clone);
          }
          proto.position.set(...rosettePositions[0]); add(proto);
        }
      }

      // Wall pilasters on exterior walls
      const pilasterMat = M.mat(0xd8d0c0, { roughness: 0.3, metalness: 0.1, flatShading: false });
      for (let z = -D / 2 + 6; z < D / 2 - 3; z += 7) {
        add(M.box(0.1, H - 0.5, 0.3, pilasterMat, -W / 2 + 0.28, H / 2, z));
        add(M.box(0.18, 0.08, 0.36, gold, -W / 2 + 0.28, H - 0.3, z));
        add(M.box(0.1, H - 0.5, 0.3, pilasterMat, W / 2 - 0.28, H / 2, z));
        add(M.box(0.18, 0.08, 0.36, gold, W / 2 - 0.28, H - 0.3, z));
      }
      for (let x = -W / 2 + 6; x < W / 2 - 3; x += 7) {
        add(M.box(0.3, H - 0.5, 0.1, pilasterMat, x, H / 2, -D / 2 + 0.28));
        add(M.box(0.36, 0.08, 0.18, gold, x, H - 0.3, -D / 2 + 0.28));
      }

      // Accent spotlights at every archway
      for (const [sx, sz] of [[0, divZ1], [0, divZ2], [divX1, 0], [divX2, 0], [roCX, officeZ]]) {
        const spot = new THREE.PointLight(0xffd070, 5, 8, 2);
        spot.position.set(sx, H - 0.5, sz); add(spot);
      }

      // Gold rope dividers flanking the entrance arch
      const ropeW1 = (W / 2 - doorGap / 2 - 2);
      for (const side of [-1, 1]) {
        const rd = M.makeGoldRopeDivider(Math.min(ropeW1, 8));
        rd.position.set(side * (doorGap / 2 + Math.min(ropeW1, 8) / 2 + 0.5), 0.12, divZ1);
        add(rd);
      }

      // ~~~ ROYAL OFFICE (back-left corner) ~~~
      // Dark mahogany & gold room — the owner's sanctum

      // Office sign above the arch
      add(M.textPlane('THE ROYAL OFFICE', { w: 4, h: 0.5, color: '#d4af37', glowColor: '#d4af37', emissive: true }).translateX(roCX).translateY(H - 0.5).translateZ(officeZ + 0.2));

      // Executive desk (replaces the old desk for diablo)
      const exDesk = M.makeExecutiveDesk();
      exDesk.position.set(-W / 2 + 4, 0.12, -D / 2 + 4);
      add(exDesk);
      this.addCollider(-W / 2 + 4, -D / 2 + 4, 3.2, 2.0);

      // THE AQUARIUM — centerpiece of the royal office
      const aquarium = M.makeAquarium(5, 2.0, 1.0);
      aquarium.position.set(roCX, 0.12, -D / 2 + 2);
      aquarium.rotation.y = 0;
      add(aquarium);
      this.animated.push({ type: 'aquarium', obj: aquarium, t: 0 });
      this.addCollider(roCX, -D / 2 + 2, 5.2, 1.2);

      // Leather sofas facing each other
      for (const [sx, sr] of [[roCX - 2.5, Math.PI / 2], [roCX + 2.5, -Math.PI / 2]]) {
        const sofa = new THREE.Group();
        sofa.add(M.box(2.0, 0.45, 0.8, M.mat(0x2a0808, { roughness: 0.3 }), 0, 0.35, 0));
        sofa.add(M.box(2.0, 0.7, 0.15, M.mat(0x2a0808, { roughness: 0.3 }), 0, 0.6, -0.33));
        // armrests
        for (const ax of [-0.95, 0.95])
          sofa.add(M.box(0.15, 0.5, 0.7, M.mat(0x2a0808, { roughness: 0.3 }), ax, 0.4, -0.05));
        // gold feet
        for (const [fx, fz] of [[-0.85, 0.3], [0.85, 0.3], [-0.85, -0.3], [0.85, -0.3]])
          sofa.add(M.cyl(0.04, 0.05, 0.08, gold, fx, 0.04, fz, 6));
        // tufting buttons
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
          sofa.add(M.sph(0.015, gold, -0.5 + i * 0.5, 0.5 + j * 0.2, -0.27, 4));
        sofa.rotation.y = sr;
        sofa.position.set(sx, 0.12, officeZ / 2 + (-D / 2) / 2 + 2);
        add(sofa);
      }

      // Coffee table between sofas
      const ctX = roCX, ctZ = officeZ / 2 + (-D / 2) / 2 + 2;
      add(M.box(1.2, 0.06, 0.6, M.mat(0x3a1608, { roughness: 0.3, flatShading: false }), ctX, 0.45, ctZ));
      add(M.box(1.24, 0.02, 0.64, gold, ctX, 0.48, ctZ));
      for (const [lx, lz] of [[-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2]])
        add(M.cyl(0.03, 0.04, 0.38, gold, ctX + lx, 0.19, ctZ + lz, 6));
      // whiskey decanter on coffee table
      add(M.cyl(0.06, 0.08, 0.18, M.mat(0xc27b1a, { roughness: 0.1, transparent: true, opacity: 0.8, flatShading: false }), ctX, 0.56, ctZ, 10));
      add(M.cyl(0.03, 0.02, 0.08, M.mat(0xc27b1a, { roughness: 0.1, transparent: true, opacity: 0.8, flatShading: false }), ctX, 0.68, ctZ, 8));
      add(M.sph(0.035, M.CHROME(), ctX, 0.73, ctZ, 8));

      // Bookshelf against back-left wall
      const bsX = -W / 2 + 1.2, bsZ = roCZ;
      add(M.box(0.6, 3.0, 3.0, M.mat(0x3a1608, { roughness: 0.35, flatShading: false }), bsX, 1.6, bsZ));
      // shelves
      for (let sh = 0; sh < 4; sh++)
        add(M.box(0.55, 0.04, 2.9, M.mat(0x3a1608, { roughness: 0.35 }), bsX, 0.5 + sh * 0.7, bsZ));
      // books (colored spines)
      const bookColors = [0x8b0000, 0x1a3a5a, 0x2a5a2a, 0x5a3a1a, 0x3a1a4a, 0x4a4a1a];
      for (let sh = 0; sh < 4; sh++) {
        let bx = bsX + 0.05;
        for (let b = 0; b < 6; b++) {
          const bw = 0.04 + Math.random() * 0.03;
          const bh = 0.4 + Math.random() * 0.2;
          add(M.box(bw, bh, 0.2, M.mat(bookColors[(b + sh) % bookColors.length], { roughness: 0.7 }),
            bx, 0.55 + sh * 0.7 + bh / 2, bsZ - 1.1 + b * 0.45));
        }
      }

      // Office rug under the seating area
      add(M.box(6, 0.02, 4, M.texMat(T.carpetTexture('#2a0a0a', '#d4af37', '#5a1a2a', 5, [2, 2]), { roughness: 0.9 }), roCX, floorY + 0.05, ctZ));

      // Wall-mounted paintings in the office
      for (let i = 0; i < 2; i++) {
        const p = M.makeWallPainting(10 + i);
        p.position.set(-W / 2 + 0.24, 2.8, -D / 2 + 3 + i * 5);
        p.rotation.y = Math.PI / 2; add(p);
      }

      // Office chandelier (smaller, intimate)
      const officeCh = M.makeChandelier(0.9);
      officeCh.position.set(roCX, H - 1.3, roCZ + 2);
      add(officeCh);
      officeCh.userData.light.intensity = 20;
      officeCh.userData.light.color.set(0xffd070);
    }

    // fireplace
    const fp = M.makeFireplace(def.id);
    fp.rotation.y = -Math.PI / 2;
    this.addProp(fp, 'Fireplace', W / 2 - 0.22, -D / 4, 0.4, 1.1);
    this.animated.push({ type: 'fire', obj: fp, t: Math.random() * 10 });

    // framed paintings along the back wall
    { let seed = 0;
      for (let x = -W / 2 + 5; x < W / 2 - 5; x += W / (tier === 0 ? 2.5 : 4)) {
        const p = M.makeWallPainting(seed++);
        p.position.set(x, 2.8, -D / 2 + 0.24); add(p);
      }
    }
    // paintings along the right wall (between sconces, skip near the fireplace)
    { let seed = 4;
      for (let z = -D / 2 + 4; z < D / 2 - 4; z += D / (tier === 0 ? 2 : 3)) {
        if (Math.abs(z - (-D / 4)) < 1.6) continue;
        const p = M.makeWallPainting(seed++);
        p.position.set(W / 2 - 0.22, 2.8, z); p.rotation.y = -Math.PI / 2; add(p);
      }
    }

    // coffee & snacks station
    const coffeeZ = tier === 0 ? D * 0.12 : D / 2 - 5;
    const coffee = M.makeCoffeeStation();
    coffee.rotation.y = Math.PI / 2;
    this.addProp(coffee, 'Coffee Station', -W / 2 + 1.5, coffeeZ, 0.5, 1.3);

    // lounge seating near the entrance (rat + diablo)
    if (tier > 0) {
      let chairN = 1;
      for (const [lx, lr] of [[-W / 2 + 2.5, Math.PI / 4], [W / 2 - 2.5, -Math.PI / 4]]) {
        const ch = M.makeLoungeChair();
        ch.rotation.y = lr;
        this.addProp(ch, `Lounge Chair ${chairN++}`, lx, D / 2 - 2.0, 0.6, 0.6);
      }
    }

    // fire extinguisher on the left wall (duck only — nicer casinos hide them)
    if (tier === 0) {
      const fex = -W / 2 + 0.26, fez = -D / 2 + D * 0.65;
      add(M.cyl(0.08, 0.08, 0.45, M.mat(0xcc2222, { roughness: 0.3 }), fex, 1.1, fez, 10));
      add(M.cyl(0.03, 0.03, 0.12, M.mat(0x111111), fex, 1.38, fez, 6));
      add(M.box(0.04, 0.16, 0.1, chrome, fex, 1.45, fez));
    }

    // trash cans (duck: bare bins, rat+: brass with lids)
    { let trashN = 1;
      for (const [tx, tz] of [[W / 2 - 0.6, D / 2 - 1.0], [-W / 2 + 0.6, D / 2 - 1.0]]) {
        const g = new THREE.Group();
        if (tier === 0) {
          g.add(M.cyl(0.2, 0.16, 0.65, M.mat(0x222228, { roughness: 0.6 }), 0, 0.32, 0, 10));
          g.add(M.cyl(0.22, 0.22, 0.04, M.mat(0x222228, { roughness: 0.6 }), 0, 0.65, 0, 10));
        } else {
          g.add(M.cyl(0.16, 0.14, 0.7, M.mat(0x6b5a3a, { roughness: 0.35, metalness: 0.3 }), 0, 0.35, 0, 12));
          g.add(M.cyl(0.17, 0.17, 0.04, gold, 0, 0.71, 0, 12));
          g.add(M.sph(0.06, gold, 0, 0.76, 0, 8));
        }
        this.addProp(g, `Trash Can ${trashN++}`, tx, tz, 0.25, 0.25);
      }
    }

    // floor-level cable covers (duck only — nicer casinos have clean floors)
    if (tier === 0) add(M.box(W * 0.6, 0.04, 0.2, M.mat(0x2a2a2e, { roughness: 0.9 }), 0, 0.14, -D / 2 + 0.8));

    // ashtray stands along the right wall corridor
    { let ashN = 1;
      for (let z = -D / 2 + 6; z < D / 2 - 6; z += D / 3) {
        const ashMat = tier > 0 ? gold : chrome;
        const g = new THREE.Group();
        g.add(M.cyl(0.12, 0.15, 0.9, ashMat, 0, 0.45, 0, 8));
        g.add(M.cyl(0.18, 0.12, 0.08, tier > 0 ? M.mat(0x2a1608, { roughness: 0.4 }) : M.mat(0x111111), 0, 0.93, 0, 10));
        this.addProp(g, `Ashtray ${ashN++}`, W / 2 - 1.0, z, 0.2, 0.2);
      }
    }

    // stanchion posts near the entrance (rat + diablo)
    if (tier > 0) {
      let stanchN = 1;
      for (const sx of [-4.5, 4.5]) {
        const g = new THREE.Group();
        g.add(M.cyl(0.03, 0.03, 1.0, gold, 0, 0.50, 0, 8));
        g.add(M.cyl(0.16, 0.18, 0.04, gold, 0, 0.02, 0, 12));
        g.add(M.sph(0.05, gold, 0, 1.02, 0, 8));
        this.addProp(g, `Stanchion ${stanchN++}`, sx, D / 2 - 2.8, 0.2, 0.2);
      }
    }

    // planters
    let planterN = 1;
    const addPlanter = (x, z) => { const p = M.makePlanter(); this.addProp(p, `Planter ${planterN++}`, x, z, 0.35, 0.35); };
    addPlanter(-W / 2 + 0.7, coffeeZ + 1.8);
    addPlanter(W / 2 - 0.7, -D / 2 + 1.2);
    if (tier > 0) {
      addPlanter(-2.0, D / 2 - 1.5);
      addPlanter(2.0, D / 2 - 1.5);
      addPlanter(W / 2 - 0.7, D / 2 - 1.2);
      addPlanter(-W / 2 + 0.7, D / 2 - 1.2);
    }

    // =====================================================================
    // OFFICE (back-left): desk, safe, cage
    // Diablo gets a royal office (built in the luxury section above),
    // with the safe and cage placed inside the larger room.
    // =====================================================================
    if (tier === 2) {
      // Royal office — desk is built in the diablo section above, just place safe + cage in the room
      const roCX = (-W / 2 + (-W / 2 + 13)) / 2;
      const safe = M.makeSafe(); safe.position.set(-W / 2 + 1.5, 0.12, -D / 2 + 8); safe.rotation.y = Math.PI / 2; add(safe); this.safe = safe; this.addCollider(-W / 2 + 1.5, -D / 2 + 8, 1.3, 1.5);
      const cage = M.makeCashierCage(5); cage.position.set(-W / 2 + 8, 0.12, -D / 2 + 4); cage.rotation.y = Math.PI / 2; add(cage); this.addCollider(-W / 2 + 8, -D / 2 + 4, 0.6, 5);
      { const pl = M.makePlanter(); this.addProp(pl, 'Office Planter', -W / 2 + 0.7, -D / 2 + 0.8, 0.35, 0.35); }
      this.zones.office = { pos: new THREE.Vector3(-W / 2 + 4, 0, -D / 2 + 5.5), r: 2.0, label: 'Open Upgrades', key: 'office', icon: 'ledger' };
      this.zones.safe = { pos: new THREE.Vector3(-W / 2 + 3, 0, -D / 2 + 8.5), r: 1.6, label: 'Vault crack', key: 'cashrun', icon: 'safe' };
    } else {
      const ox = -W / 2 + 3.2, oz = -D / 2 + 2.4;
      const desk = M.makeDesk(); desk.position.set(ox, 0.12, oz); add(desk); this.addCollider(ox, oz, 2.5, 1.3);
      const safe = M.makeSafe(); safe.position.set(-W / 2 + 1.1, 0.12, -D / 2 + 5.4); safe.rotation.y = Math.PI / 2; add(safe); this.safe = safe; this.addCollider(-W / 2 + 1.1, -D / 2 + 5.4, 1.3, 1.5);
      const cage = M.makeCashierCage(4.5); cage.position.set(-W / 2 + 6.2, 0.12, -D / 2 + 3.6); cage.rotation.y = Math.PI / 2; add(cage); this.addCollider(-W / 2 + 6.2, -D / 2 + 3.6, 0.6, 4.5);
      { const rope1 = M.makeVelvetRope(2.6); rope1.rotation.y = Math.PI / 2; this.addProp(rope1, 'Office Rope', -W / 2 + 6.2, -D / 2 + 7.2, 0.2, 1.4); }
      add(M.textPlane('OFFICE · STAFF ONLY (that means me)', { w: 4.2, h: 0.5, color: '#ffd700', glowColor: '#ffd700' }).translateX(-W / 2 + 3.2).translateY(3.0).translateZ(-D / 2 + 0.22));
      { const pl = M.makePlanter(); this.addProp(pl, 'Office Planter', -W / 2 + 0.7, -D / 2 + 0.8, 0.35, 0.35); }
      this.zones.office = { pos: new THREE.Vector3(ox, 0, oz + 1.3), r: 1.5, label: 'Open Upgrades', key: 'office', icon: 'ledger' };
      this.zones.safe = { pos: new THREE.Vector3(-W / 2 + 2.9, 0, -D / 2 + 5.6), r: 1.6, label: 'Vault crack', key: 'cashrun', icon: 'safe' };
    }

    // =====================================================================
    // FEATURES FROM UPGRADES
    // =====================================================================
    if (has('bar') || has('buffet')) {
      const len = Math.min(7, D * 0.35);
      const bx = W / 2 - 1.3, bz = -D / 2 + 2 + len / 2;
      const bar = M.makeBar(len); bar.rotation.y = -Math.PI / 2;
      this.addProp(bar, has('buffet') ? 'Buffet Bar' : 'Bar', bx, bz, 0.8, len / 2);
      if (has('buffet')) { const t = M.textPlane('ALL-YOU-CAN-EAT · VERY SALTY', { w: 4, h: 0.4, color: '#ffb0c0', glowColor: '#ff2e88', emissive: true }); t.position.set(W / 2 - 0.25, 3.6, bz); t.rotation.y = -Math.PI / 2; add(t); }
    }
    if (has('atm')) { const a = M.makeATM(); a.rotation.y = -Math.PI / 2; this.addProp(a, 'ATM', W / 2 - 0.7, D / 2 - 2.4, 0.4, 0.4); }
    if (has('bouncer')) { const b = makeBouncer(); b.rotation.y = Math.PI; const bp = this.addProp(b, 'Bouncer', 2.6, D / 2 - 1.1, 0.5, 0.35); this.animated.push({ type: 'person', obj: b, t: 0 }); }
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
    // =====================================================================
    // GAMING FLOOR — real casino layout: central table pit, slot pods
    // against walls and in sections with separators, clear entrance aisle
    // =====================================================================
    const officeW = tier === 0 ? 4 : 7;
    const wallPad = 1.8;
    this.corridorX = W / 2 - 2.0;
    // awards along the left wall (away from the entrance)
    let az = -D / 2 + officeW + 2;
    const awardX = -W / 2 + 1.4;
    const placeAwardProp = (obj, name, w = 2) => { this.addProp(obj, name, awardX, az, w / 2, w / 2); az += w + 1.2; };
    if (has('planter')) placeAwardProp(M.makePlanter(), 'Casino Planter', 1.2);
    if (has('velvetrope')) placeAwardProp(M.makeVelvetRope(2), 'Velvet Rope', 1.8);
    if (has('ornateurn')) placeAwardProp(M.makeOrnateUrn(), 'Ornate Urn', 1.0);
    if (has('toilet')) placeAwardProp(M.makeToilet(), 'Gold Toilet', 1.8);
    if (has('selfstatue')) placeAwardProp(M.makeStatue('owner'), 'Owner Statue', 1.6);
    if (has('palmtree')) placeAwardProp(M.makePalmTree(), 'Palm Tree', 1.6);
    if (has('statue')) placeAwardProp(M.makeStatue('rat'), 'Rat Statue', 1.6);
    if (has('fireplace')) placeAwardProp(M.makeFireplace(def.id), 'Grand Fireplace', 2.2);
    if (has('megaphone')) placeAwardProp(M.makeMegaphone(), 'Gold Megaphone', 1.2);
    if (has('tiger')) { const t = M.makeTiger(); placeAwardProp(t, 'Tiger', 3.0); this.animated.push({ type: 'tiger', obj: t, t: 0 }); }
    if (has('chandelier')) { const ch = M.makeChandelier(1.0, true); ch.position.set(awardX + 3, H - 0.3, az); this.root.add(ch); }
    if (has('aquarium')) { const aq = M.makeAquarium(3, 1.8, 1.0); placeAwardProp(aq, 'Exotic Aquarium', 3.0); }
    if (has('fountain')) { const f = M.makeFountain(); this.addProp(f, 'Fountain', 0, 0, 1.7, 1.7); this.animated.push({ type: 'fountain', obj: f, t: 0 }); }
    if (has('volcano')) { const v = M.makeVolcano(); this.addProp(v, 'Volcano', W / 2 - 5, -D / 4, 3, 3); this.animated.push({ type: 'volcano', obj: v, t: 0 }); }
    const initials = (game.s.playerName || 'Victor Vane').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'VV';

    // --- TABLE PIT: tables flanking the marble walkway, evenly spaced ---
    // Occupied footprints for clash prevention — {x, z, hw, hd} (half-width, half-depth)
    const occupied = [];
    const clashes = (x, z, hw, hd) => occupied.some(o =>
      Math.abs(o.x - x) < o.hw + hw + 0.6 && Math.abs(o.z - z) < o.hd + hd + 0.6);
    const occupy = (x, z, hw, hd) => occupied.push({ x, z, hw, hd });

    const hasFountain = has('fountain');
    if (hasFountain) occupy(0, 0, 2, 2);
    if (has('volcano')) occupy(W / 2 - 5, -D / 4, 3.5, 3.5);
    if (has('vip')) occupy(W / 2 - 4, -D / 2 + 4, 4, 3.5);
    if (has('bar') || has('buffet')) { const len = Math.min(7, D * 0.35); occupy(W / 2 - 1.3, -D / 2 + 2 + len / 2, 2, len / 2 + 1); }

    // Floor layout is the source of truth — create meshes at saved positions
    const floorLayout = (game.s.floorLayouts || {})[def.id];
    const tableEntries = floorLayout?.tables || [];
    const machineEntries = floorLayout?.machines || [];
    const marbleHalfW = def.id === 'duck' ? 2.0 : 2.5;
    const tableOffsetX = marbleHalfW + 2.5;

    const clampXZ = (x, z, pad = 2.5) => ({
      x: Math.max(-W / 2 + pad, Math.min(W / 2 - pad, x)),
      z: Math.max(-D / 2 + pad, Math.min(D / 2 - pad, z)),
    });

    const TABLE_HW = 2.0, TABLE_HD = 1.6;
    const placeTableAt = (sx, sz, ry = 0) => {
      const p = clampXZ(sx, sz, 3);
      const x = p.x, z = p.z;
      const t = M.makeDealerTable(P.felt, initials);
      t.position.set(x, 0.12, z);
      t.rotation.y = ry;
      add(t);
      this.addCollider(x, z, 3.4, 2.6, true);
      occupy(x, z, TABLE_HW, TABLE_HD);
      const seats = [];
      for (let s = 0; s < 3; s++) {
        const a = Math.PI * (0.25 + s * 0.25) + ry;
        seats.push(new THREE.Vector3(x + Math.cos(a) * 2.35, 0, z + Math.sin(a) * 1.95));
      }
      seats.push(new THREE.Vector3(x - 2.2, 0, z + 0.9));
      this.tables.push({
        group: t, pos: new THREE.Vector3(x, 0, z), seats,
        dealerSpot: new THREE.Vector3(x, 0, z + 2.0),
        occupants: [], cash: 0, aisleZ: z + 2.6,
      });
    };

    for (const s of tableEntries) placeTableAt(s.x, s.z, s.ry || 0);

    // dealer zone removed — tables are now interacted with via the click/info panel
    if (has('roulette')) {
      const ROUL_HW = 1.2, ROUL_HD = 2.0;
      let rx = -tableOffsetX - 4.5, rz = 0;
      if (clashes(rx, rz, ROUL_HW, ROUL_HD)) {
        for (let nudge = 1; nudge <= 10; nudge++) {
          if (!clashes(rx, rz + nudge * 2, ROUL_HW, ROUL_HD)) { rz += nudge * 2; break; }
          if (!clashes(rx, rz - nudge * 2, ROUL_HW, ROUL_HD)) { rz -= nudge * 2; break; }
        }
      }
      rx = Math.max(-W / 2 + 3, rx);
      const r = M.makeRouletteTable(); r.rotation.y = Math.PI / 2;
      this.addProp(r, 'Roulette', rx, rz, ROUL_HW, ROUL_HD);
      occupy(rx, rz, ROUL_HW, ROUL_HD);
      this.animated.push({ type: 'wheel', obj: r.userData.wheel });
    }

    // --- SLOT MACHINES: one mesh per layout entry at its saved position ---
    for (let i = 0; i < machineEntries.length; i++) {
      const s = machineEntries[i];
      const p = clampXZ(s.x, s.z, 1.5);
      const ry = s.ry || 0;
      const m = M.makeSlotMachine(i);
      m.position.set(p.x, 0.12, p.z);
      m.rotation.y = ry;
      add(m);
      this.addCollider(p.x, p.z, 1.2, 1.2, true);
      const useX = p.x + Math.sin(ry) * 0.95;
      const useZ = p.z + Math.cos(ry) * 0.95;
      this.machines.push({
        group: m, pos: new THREE.Vector3(p.x, 0, p.z),
        usePos: new THREE.Vector3(useX, 0, useZ),
        aisleZ: useZ, occupant: null, cash: 0,
      });
      occupy(p.x, p.z, 0.6, 0.6);
    }
    this.backAisleZ = -D / 2 + 2;

    // ashtray stands near the entrance
    { let eAshN = 1;
      for (const x of [-2.6, 2.6]) {
        const g = new THREE.Group();
        g.add(M.cyl(0.12, 0.15, 0.9, M.CHROME(), 0, 0.45, 0, 8));
        g.add(M.cyl(0.18, 0.12, 0.08, M.mat(0x111111), 0, 0.93, 0, 10));
        this.addProp(g, `Entry Ashtray ${eAshN++}`, x, D / 2 - 1.2, 0.2, 0.2);
      }
    }

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
    this.aisleZ = D / 2 - 8;   // front walkway between entrance and gaming area
    const mat = M.textPlane('WELCOME · NO REFUNDS · NO EXITS', { w: 3, h: 0.4, color: '#b89830' }); mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.14, D / 2 - 0.8); add(mat);

    // --- PERFORMANCE: merge static geometry by material to cut draw calls ---
    this._mergeStaticGeometry();
  }

  _mergeStaticGeometry() {
    const interactive = new Set();
    for (const m of this.machines) this._markSubtree(m.group, interactive);
    for (const t of this.tables) this._markSubtree(t.group, interactive);
    for (const p of this.props) this._markSubtree(p.group, interactive);
    for (const a of this.animated) {
      if (a.obj && a.obj.isObject3D) this._markSubtree(a.obj, interactive);
      if (a.obj && a.obj.parent) this._markSubtree(a.obj.parent, interactive);
    }
    for (const ns of this.neonSigns || []) if (ns && ns.isObject3D) this._markSubtree(ns, interactive);

    this.root.updateMatrixWorld(true);
    const byMat = new Map();
    const toRemove = [];
    this.root.traverse(child => {
      if (!child.isMesh) return;
      if (interactive.has(child)) return;
      // only merge direct-to-root meshes (avoid breaking Group structures like doors, chandeliers)
      if (child.parent !== this.root) return;
      const m = child.material;
      if (!m || Array.isArray(m)) return;
      if (m.transparent) return;
      const key = m.uuid;
      if (!byMat.has(key)) byMat.set(key, { mat: m, meshes: [] });
      byMat.get(key).meshes.push(child);
    });

    for (const [, group] of byMat) {
      if (group.meshes.length < 2) continue;
      const geos = [];
      let castShadow = false, receiveShadow = false;
      for (const mesh of group.meshes) {
        const g = mesh.geometry.clone();
        g.applyMatrix4(mesh.matrixWorld);
        geos.push(g);
        if (mesh.castShadow) castShadow = true;
        if (mesh.receiveShadow) receiveShadow = true;
      }
      try {
        const merged = mergeGeometries(geos, false);
        if (!merged) { for (const g of geos) g.dispose(); continue; }
        const mergedMesh = new THREE.Mesh(merged, group.mat);
        mergedMesh.castShadow = castShadow;
        mergedMesh.receiveShadow = receiveShadow;
        for (const mesh of group.meshes) toRemove.push(mesh);
        this.root.add(mergedMesh);
      } catch (e) { /* merge may fail for incompatible attributes */ }
      for (const g of geos) g.dispose();
    }
    for (const mesh of toRemove) this.root.remove(mesh);
  }

  _markSubtree(obj, set) {
    obj.traverse(child => set.add(child));
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
        case 'fire': { const fl = a.obj.userData.fireLight; fl.intensity = 5 + Math.sin(a.t * 8) * 1.5 + Math.sin(a.t * 13.7) * 0.8; break; }
        case 'wheel': a.obj.rotation.y += dt * 2; break;
        case 'bus': a.obj.position.x = -a.range / 2 + ((a.t * 5) % a.range); break;
        case 'car': a.obj.position.x = -a.range / 2 + ((a.t * 11) % a.range); break;
        case 'cart': a.obj.position.x = a.x0 + (Math.sin(a.t * 0.3) * 0.5 + 0.5) * a.range; break;
        case 'jet': a.obj.position.y = 6 + Math.sin(a.t * 0.5) * 0.6; a.obj.rotation.z = Math.sin(a.t * 0.3) * 0.05; break;
        case 'person': { const u = a.obj.userData; u.idleT = (u.idleT || 0) + dt; u.head.rotation.y = Math.sin(u.idleT * 0.6) * 0.5; break; }
        case 'aquarium': {
          const aq = a.obj.userData;
          if (!aq || !aq.fish) break;
          // fish swimming in lazy circles
          for (const fish of aq.fish.children) {
            const fd = fish.userData;
            const angle = fd.phase + a.t * fd.speed;
            fish.position.x = Math.cos(angle) * fd.radius;
            fish.position.z = Math.sin(angle) * fd.radius * 0.4;
            fish.position.y = fd.baseY + Math.sin(a.t * 0.7 + fd.phase) * 0.15;
            fish.rotation.y = angle + Math.PI / 2;
          }
          // bubbles rising and resetting
          for (const bubble of aq.bubbles.children) {
            bubble.position.y += dt * 0.3;
            bubble.position.x = bubble.userData.baseX + Math.sin(a.t * 2 + bubble.userData.phase) * 0.05;
            if (bubble.position.y > aq.baseY + aq.h) {
              bubble.position.y = aq.baseY + 0.2;
            }
          }
          // tank light subtle pulse
          aq.tankLight.intensity = 3 + Math.sin(a.t * 0.8) * 0.5;
          break;
        }
      }
    }
    // slot machines: candle blink, reels spin while occupied
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i], u = m.group.userData;
      const blink = Math.sin(time * 4 + i * 1.7) > 0.3;
      u.candle.material = blink ? CasinoWorld._candleOn : CasinoWorld._candleOff;
      if (m.occupant) {
        for (let r = 0; r < 3; r++) { const phase = (time * 0.8 + i * 0.37 + r * 0.33) % 1; if (phase < 0.55) u.reels[r].rotation.y += dt * (14 - r * 3); }
        u.light.intensity = 1.6 + Math.sin(time * 12 + i) * 0.5;
      } else u.light.intensity = 0.8;
    }
  }
}
