import * as THREE from 'three';
import * as M from '../world/models.js';
import * as T from '../engine/textures.js';
import { makeBouncer } from '../world/people.js';
import { CASINOS } from '../data/casinos.js';

function makeCasinoBuilding(index) {
  const def = CASINOS[index];
  const tier = index;
  const g = new THREE.Group();
  const brickTex = T.brickTexture(
    tier === 2 ? '#c8c0b8' : tier === 1 ? '#2a2a34' : '#3b2418',
    tier === 2 ? '#a8a098' : tier === 1 ? '#15151c' : '#1a0e08'
  );
  const wallMat = M.texMat(brickTex, { roughness: 0.9 });
  const gold = M.GOLD();
  const bw = tier === 2 ? 8 : tier === 1 ? 6 : 4.5;
  const bh = tier === 2 ? 7 : tier === 1 ? 5 : 3.5;
  const bd = tier === 2 ? 5 : tier === 1 ? 4 : 3;
  g.add(M.box(bw, bh, bd, wallMat, 0, bh / 2, 0));
  g.add(M.box(bw + 0.1, 0.15, bd + 0.1, gold, 0, bh + 0.08, 0));
  const doorW = tier === 2 ? 1.6 : 1.0;
  const doorH = tier === 2 ? 2.8 : 2.0;
  g.add(M.box(doorW, doorH, 0.15, M.mat(0x1a0a06, { roughness: 0.3 }), 0, doorH / 2, bd / 2 + 0.05));
  g.add(M.box(doorW + 0.3, 0.1, 0.2, gold, 0, doorH + 0.1, bd / 2 + 0.05));
  if (tier > 0) {
    for (let i = 0; i < (tier === 2 ? 3 : 2); i++) {
      const wx = -bw / 2 + 1.2 + i * (bw - 2.4) / (tier === 2 ? 2 : 1);
      g.add(M.box(0.7, 0.9, 0.08, M.glow(0x3a5a8a, 0.5, { transparent: true, opacity: 0.8 }), wx, bh * 0.55, bd / 2 + 0.08));
    }
  }
  const signColor = '#' + def.signColor.toString(16).padStart(6, '0');
  const shortName = def.name.replace(', Las Vegas', '').toUpperCase();
  const sign = M.makeNeonSign(shortName.length > 12 ? shortName.slice(0, 12) : shortName, signColor, Math.min(bw - 0.5, 5), { intensity: 15 });
  sign.position.set(0, bh + 1, bd / 2 + 0.2);
  g.add(sign);
  if (tier >= 1) g.add(M.box(doorW + 1, 0.12, 1.0, M.mat(0x8b0000, { roughness: 0.5 }), 0, doorH + 0.3, bd / 2 + 0.5));
  if (tier === 2) {
    for (const cx of [-bw / 2 + 0.4, bw / 2 - 0.4])
      g.add(M.cyl(0.15, 0.15, bh, M.mat(0xe0d8c8, { roughness: 0.3, metalness: 0.1 }), cx, bh / 2, bd / 2 + 0.2, 8));
  }
  g.add(M.box(bw + 4, 0.06, bd + 4, M.mat(0x0b0b10, { roughness: 0.15, metalness: 0.1 }), 0, -0.03, 0));
  g.add(M.box(bw + 2, 0.08, 1.5, M.mat(0x2e2e34, { roughness: 0.85 }), 0, 0.01, bd / 2 + 1.5));
  return g;
}

const BUILDERS = {
  casino_duck: () => makeCasinoBuilding(0),
  casino_rat: () => makeCasinoBuilding(1),
  casino_diablo: () => makeCasinoBuilding(2),
  machines: () => M.makeSlotMachine(0),
  tables: () => M.makeDealerTable(),
  roulette: () => M.makeRouletteTable(),
  bar: () => M.makeBar(2),
  buffet: () => M.makeBar(2),
  atm: () => M.makeATM(),
  bouncer: () => makeBouncer(),
  cart: () => M.makeCart(),
  vip: () => M.makeLoungeChair(),
  neon: () => M.makeNeonSign('LUCKY', '#ff3366', 2.5),
  carpet: () => M.box(1.2, 0.02, 0.8, M.mat(0x882222, { roughness: 0.9 }), 0, 0.01, 0),
  noclocks: () => M.makeClock(),
  windows: () => M.box(0.6, 0.8, 0.04, M.mat(0x3a2a1a, { roughness: 0.8 }), 0, 0.4, 0),
  vents: () => M.makeVent(),
  gas: () => M.makeGasMask(),
  fog: () => M.makeVent(),
  cameras: () => M.makeCamera(),
  sky: () => M.box(1.0, 0.6, 0.04, M.glow(0x4488cc, 0.5), 0, 0.3, 0),
  volcano: () => M.makeVolcano(),
  fountain: () => M.makeFountain(),
  bus: () => M.makeBus(0xffcc00, 'WIN!'),
  shuttle: () => M.makeBus(0xdddddd, 'SHUTTLE'),
  billboard: () => M.makeBillboard('WIN*', '*no'),
  jet: () => M.makeJet(),
  tower: () => M.makeTower(),
  toilet: () => M.makeToilet(),
  selfstatue: () => M.makeStatue('self'),
  statue: () => M.makeStatue('rat'),
  namelights: () => M.makeNeonSign('VV', '#ffcc00', 2),
  tiger: () => M.makeTiger(),
  skill_sleight: () => M.makeSkillSleight(),
  skill_back: () => M.makeSkillMemory(),
  skill_poker: () => M.makeSkillPoker(),
  skill_tongue: () => M.makeSkillTongue(),
  skill_feet: () => M.makeSkillFeet(),
  flyer: () => M.makeFlyer(),
  cardstock: () => M.makeCardStock(),
  lemonade: () => M.makeLemonadeCup(),
  radio: () => M.makeRadio(),
  testimonials: () => M.makeTestimonialBoard(),
  phone: () => M.makePhone(),
  church: () => M.makeChurchBulletin(),
  moneystack: () => M.makeMoneyStack(),
  filmreel: () => M.makeFilmReel(),
  airportshuttle: () => M.makeBus(0x222288, 'VIP'),
  tvscreen: () => M.makeTVScreen(),
  slotwrench: () => M.makeSlotWrench(),
  peanuts: () => M.makePeanutBowl(),
  badge: () => M.makeBadge(),
  hopper: () => M.makeHopper(),
  hotelkey: () => M.makeHotelKey(),
  vault: () => M.makeVaultDoor(),
  sportsbook: () => M.makeSportsbook(),
  traincart: () => M.makeTrainCart(),
  bigchip: () => M.makeSlotChip(),
  exitsign: () => M.makeExitSign(),
};

function makePlaceholder() {
  const g = new THREE.Group();
  const gold = M.GOLD();
  const chipColors = [0xff3333, 0x2b6bff, 0x111111, 0x2ecc71, 0xe0ddd5];
  for (let i = 0; i < 5; i++) {
    const stack = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < count; j++) {
      stack.add(M.cyl(0.18, 0.18, 0.04, M.mat(chipColors[i], { roughness: 0.4, metalness: 0.15 }), 0, j * 0.045, 0, 12));
    }
    const angle = (i / 5) * Math.PI * 2;
    stack.position.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
    g.add(stack);
  }
  const d1 = M.box(0.22, 0.22, 0.22, M.mat(0xf0ece0, { roughness: 0.3 }), 0, 0.35, 0);
  d1.rotation.set(0.6, 0.8, 0.3);
  g.add(d1);
  for (const [fx, fy, fz] of [[0.08, 0.08, 0.12], [-0.08, 0.08, 0.12], [0, 0.12, 0]]) {
    g.add(M.sph(0.018, M.mat(0x111111), 0.08 + fx, 0.35 + fy, fz, 4));
  }
  const card1 = M.box(0.25, 0.005, 0.35, M.mat(0xf0ece0, { roughness: 0.85 }), 0.45, 0.12, 0.15);
  card1.rotation.y = 0.4;
  g.add(card1);
  const card2 = M.box(0.25, 0.005, 0.35, M.mat(0xf0ece0, { roughness: 0.85 }), 0.5, 0.13, 0.1);
  card2.rotation.y = 0.2;
  g.add(card2);
  g.add(M.cyl(0.06, 0.08, 0.18, gold, -0.45, 0.09, -0.2, 8));
  g.add(M.cyl(0.03, 0.03, 0.25, gold, -0.45, 0.27, -0.2, 6));
  g.add(M.sph(0.04, gold, -0.45, 0.42, -0.2, 8));
  return g;
}

const CSS_SIZE = 280;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const SIZE = Math.round(CSS_SIZE * DPR);
const ROTATION_SPEED = 0.12;

const sceneCache = new Map();
let renderer = null;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
  return renderer;
}

function stripLights(obj) {
  const lights = [];
  obj.traverse(c => { if (c.isLight) lights.push(c); });
  for (const l of lights) l.removeFromParent();
}

function buildScene(builderFn) {
  const scene = new THREE.Scene();
  const model = builderFn();
  stripLights(model);

  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  const bbox = new THREE.Box3().setFromObject(model);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  model.position.sub(center);

  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, maxDim * 20);
  const dist = maxDim / (2 * Math.tan(Math.PI * 30 / 360)) * 1.35;
  cam.position.set(0, dist * 0.35, dist);
  cam.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.8);
  dir.position.set(3, 5, 4);
  scene.add(dir);
  const rim = new THREE.DirectionalLight(0xffc880, 0.6);
  rim.position.set(-2, 1, -3);
  scene.add(rim);

  return { scene, cam, pivot };
}

function getScene(key) {
  if (sceneCache.has(key)) return sceneCache.get(key);
  const builderFn = key === '__placeholder__' ? makePlaceholder : BUILDERS[key];
  if (!builderFn) return null;
  const entry = buildScene(builderFn);
  sceneCache.set(key, entry);
  return entry;
}

/**
 * Render one frame of the given model into the target canvas.
 * Called by the ledger animation loop every frame.
 */
export function renderPreviewFrame(modelKey, canvas, angle) {
  const entry = getScene(modelKey);
  if (!entry) return;
  const r = getRenderer();
  entry.pivot.rotation.y = angle;
  r.render(entry.scene, entry.cam);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(r.domElement, 0, 0);
}

export function resolveModelKey(key) {
  if (key && BUILDERS[key]) return key;
  return '__placeholder__';
}

export { SIZE, CSS_SIZE, ROTATION_SPEED };
