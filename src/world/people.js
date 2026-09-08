// People: guests and the owner. Boxy stylised bodies with painted faces.
import * as THREE from "three";
import * as T from "../engine/textures.js";
import { mat, glow, box, cyl, sph, GOLD, CHROME, BLACK_GLOSS, texMat } from "./models.js";

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x95a5a6, 0x34495e, 0xff6b81, 0x70a1ff];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1f2a44, 0x222222, 0x6d4c41];
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#a0673f"];
const HAIR = [0x1a1a1a, 0x3b2314, 0x6b4423, 0xc9a227, 0xb03030, 0x888888, 0xe8e8e8];
const geo = {};
const G = (k, make) => geo[k] || (geo[k] = make());

function head(skinHex, mood) {
    const skinMat = mat(parseInt(skinHex.slice(1), 16), { roughness: 0.65, flatShading: false });
    const face = texMat(T.faceTexture(mood, skinHex), { roughness: 0.65 });
    const h = new THREE.Mesh(
        G("head", () => new THREE.BoxGeometry(0.4, 0.42, 0.4)),
        [skinMat, skinMat, skinMat, skinMat, face, skinMat],
    );
    h.castShadow = true;
    return h;
}

/** Guest. type: 'drunk' | 'regular' | 'sharp' | 'whale' */
export function makeCustomer(type = 'regular') {
  const g = new THREE.Group();
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
  const skinMat = mat(parseInt(skin.slice(1), 16), { roughness: 0.65, flatShading: false });
  const shirtCol = type === 'whale' ? 0xf8f8f8 : type === 'sharp' ? 0x1a1a24 : SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const shirt = mat(shirtCol, { roughness: 0.7 });
  const pantsCol = type === 'whale' ? 0x111111 : PANTS[Math.floor(Math.random() * PANTS.length)];
  const pants = mat(pantsCol, { roughness: 0.8 });
  const mood = type === 'drunk' ? 'drunk' : type === 'sharp' ? 'cool' : Math.random() < 0.5 ? 'happy' : 'neutral';

  // torso — upper chest + waist taper
  const torso = box(0.50, 0.42, 0.30, shirt, 0, 1.02, 0); g.add(torso);
  g.add(box(0.46, 0.22, 0.28, shirt, 0, 0.72, 0));
  g.add(box(0.44, 0.10, 0.26, pants, 0, 0.58, 0));

  // head + neck
  const hd = head(skin, mood); hd.position.y = 1.5; g.add(hd);
  g.add(box(0.10, 0.08, 0.10, skinMat, 0, 1.27, 0));

  // legs (pre-shift coords; pivot shift = -0.25)
  const legL = box(0.19, 0.50, 0.20, pants, -0.13, 0.25, 0); g.add(legL);
  const legR = box(0.19, 0.50, 0.20, pants, 0.13, 0.25, 0); g.add(legR);

  // shoes (pre-shift; will shift -0.25)
  const shoeCol = type === 'whale' ? 0x111111 : 0x2a2a2a;
  const shoeMat = mat(shoeCol, { roughness: type === 'whale' ? 0.2 : 0.8 });
  const soleMat = mat(0x1a1a1a, { roughness: 0.9 });
  for (const leg of [legL, legR]) {
    leg.add(box(0.16, 0.07, 0.24, shoeMat, 0, -0.22, 0.02));
    leg.add(box(0.12, 0.05, 0.10, shoeMat, 0, -0.22, 0.15));
    leg.add(box(0.17, 0.03, 0.28, soleMat, 0, -0.27, 0.04));
    leg.add(box(0.16, 0.03, 0.06, soleMat, 0, -0.25, -0.08));
  }

  // arms
  const armL = box(0.13, 0.56, 0.14, shirt, -0.33, 0.92, 0); g.add(armL);
  const armR = box(0.13, 0.56, 0.14, shirt, 0.33, 0.92, 0); g.add(armR);
  // sleeve cuffs
  const cuffCol = type === 'whale' ? 0x0a0a0a : type === 'sharp' ? 0x12121c : shirtCol;
  armL.add(box(0.14, 0.03, 0.15, mat(cuffCol, { roughness: 0.5 }), 0, -0.26, 0));
  armR.add(box(0.14, 0.03, 0.15, mat(cuffCol, { roughness: 0.5 }), 0, -0.26, 0));
  // hands
  armL.add(box(0.11, 0.10, 0.11, skinMat, 0, -0.33, 0));
  armR.add(box(0.11, 0.10, 0.11, skinMat, 0, -0.33, 0));

  // pivot shift — swings limbs from the shoulder/hip
  for (const a of [armL, armR, legL, legR]) {
    a.geometry = a.geometry.clone(); a.geometry.translate(0, -0.25, 0);
    a.position.y += 0.25; for (const ch of a.children) ch.position.y -= 0.25;
  }

  // hair / hats
  const hairCol = HAIR[Math.floor(Math.random() * HAIR.length)];
  const hairMat = mat(hairCol, { roughness: 0.9, flatShading: true });
  const style = type === 'whale' ? 'tophat' : type === 'sharp' ? 'slick'
    : ['short', 'long', 'bald', 'cap', 'beanie', 'long', 'short'][Math.floor(Math.random() * 7)];
  if (style === 'short' || style === 'slick') {
    hd.add(box(0.42, 0.10, 0.42, hairMat, 0, 0.24, 0));
    hd.add(box(0.04, 0.12, 0.34, hairMat, -0.20, 0.17, -0.03));
    hd.add(box(0.04, 0.12, 0.34, hairMat, 0.20, 0.17, -0.03));
    hd.add(box(0.42, 0.16, 0.06, hairMat, 0, 0.14, -0.18));
  }
  if (style === 'long') {
    hd.add(box(0.44, 0.10, 0.44, hairMat, 0, 0.24, 0));
    hd.add(box(0.05, 0.30, 0.38, hairMat, -0.22, 0.06, -0.03));
    hd.add(box(0.05, 0.30, 0.38, hairMat, 0.22, 0.06, -0.03));
    hd.add(box(0.44, 0.34, 0.08, hairMat, 0, 0.06, -0.18));
  }
  if (style === 'cap') {
    const capMat = mat(SHIRTS[(Math.random() * SHIRTS.length) | 0]);
    hd.add(box(0.44, 0.10, 0.44, capMat, 0, 0.24, 0));
    hd.add(box(0.04, 0.08, 0.34, capMat, -0.20, 0.18, -0.03));
    hd.add(box(0.04, 0.08, 0.34, capMat, 0.20, 0.18, -0.03));
    hd.add(box(0.40, 0.03, 0.20, mat(0x222222), 0, 0.20, 0.30));
  }
  if (style === 'beanie') {
    hd.add(box(0.44, 0.18, 0.44, mat(0xc0392b), 0, 0.22, 0));
    hd.add(box(0.40, 0.06, 0.40, mat(0xa02020), 0, 0.12, 0));
  }
  if (style === 'tophat') {
    hd.add(cyl(0.30, 0.30, 0.04, BLACK_GLOSS(), 0, 0.23, 0, 14));
    hd.add(cyl(0.20, 0.20, 0.34, BLACK_GLOSS(), 0, 0.42, 0, 14));
    hd.add(cyl(0.21, 0.21, 0.05, mat(0x8b0000), 0, 0.28, 0, 14));
  }

  // type extras
  if (type === 'whale') {
    g.add(box(0.52, 0.50, 0.32, mat(0x111111, { roughness: 0.4 }), 0, 0.98, -0.02));
    g.add(box(0.48, 0.12, 0.30, mat(0x111111, { roughness: 0.4 }), 0, 1.24, 0));
    g.add(box(0.12, 0.40, 0.02, mat(0xf8f8f8), 0, 0.95, 0.16));
    g.add(box(0.12, 0.06, 0.03, mat(0x111111), 0, 1.17, 0.17));
    g.add(cyl(0.02, 0.02, 0.12, mat(0x5a2a0a), 0.1, 1.42, 0.24, 6).rotateX(Math.PI / 2));
    g.add(sph(0.025, glow(0xff4400, 3), 0.1, 1.42, 0.30, 6));
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 14), GOLD());
    chain.position.set(0, 1.2, 0.14); chain.rotation.x = 1.3; g.add(chain);
    armR.add(cyl(0.03, 0.03, 0.015, GOLD(), 0.05, -0.60, 0.06, 8));
  } else if (type === 'sharp') {
    g.add(box(0.52, 0.50, 0.32, mat(0x1a1a24, { roughness: 0.4 }), 0, 0.98, -0.02));
    g.add(box(0.48, 0.12, 0.30, mat(0x1a1a24, { roughness: 0.4 }), 0, 1.24, 0));
    g.add(box(0.06, 0.36, 0.02, mat(0x8b0000), 0, 1.0, 0.17));
    armL.add(box(0.06, 0.10, 0.02, mat(0x111111, { emissive: 0x2244ff, emissiveIntensity: 0.6 }), -0.02, -0.60, 0.08));
  } else if (type === 'drunk') {
    armR.add(cyl(0.035, 0.045, 0.24, mat(0x6b3a0a, { roughness: 0.15, transparent: true, opacity: 0.85, flatShading: false }), 0, -0.62, 0.10, 8));
    g.add(box(0.48, 0.16, 0.04, mat(0x222222), 0, 0.76, 0.16));
  } else if (Math.random() < 0.4) {
    armL.add(box(0.14, 0.18, 0.08, mat(SHIRTS[(Math.random() * SHIRTS.length) | 0], { roughness: 0.5 }), -0.08, -0.55, 0.02));
  }
  g.userData = { legL, legR, armL, armR, head: hd, body: torso, type, idleT: Math.random() * 10 };
  return g;
}

/**
 * The owner character.
 * `skills` = {sleight, back, poker, tongue, feet} — raw skill levels (for stat effects).
 * `wardrobe` = { hat: 'poker_5', glasses: 'poker_2', ... } — what's equipped per slot.
 *   If omitted, all cosmetics at or below the skill level are shown (legacy behaviour).
 */
export function makeOwner(skills = {}, wardrobe) {
    const has = (key) => {
        if (!wardrobe) {
            const [src, lvl] = key.split("_");
            return (skills[src] || 0) >= parseInt(lvl, 10);
        }
        return Object.values(wardrobe).includes(key);
    };
    const g = new THREE.Group();
    const skin = "#e0ac69";
    const skinMat = mat(0xe0ac69, { roughness: 0.65, flatShading: false });
    const hasFurCoat = has("tongue_5");
    const suitTex = T.pinstripeTexture(hasFurCoat ? "#5a0a2a" : "#1c1030");
    const suit = texMat(suitTex, { roughness: 0.55 });
    const suitPlain = mat(hasFurCoat ? 0x5a0a2a : 0x1c1030, { roughness: 0.55 });
    const gold = GOLD();
    const hasBroadShoulders = has("back_2");
    const shoulders = 0.74 + (hasBroadShoulders ? (skills.back || 0) * 0.04 : 0);

    // torso — upper chest + lower waist give a shaped silhouette
    // upper torso: y 0.88–1.48 (center 1.18, height 0.60)
    const torso = box(shoulders, 0.6, 0.42, suit, 0, 1.18, 0);
    g.add(torso);
    // lower torso / waist: y 0.68–0.90 — slightly narrower for a fitted look
    g.add(box(shoulders - 0.06, 0.22, 0.4, suit, 0, 0.79, 0));
    // shoulder pads — no wider than the torso
    g.add(box(shoulders, 0.08, 0.42, suitPlain, 0, 1.46, -0.01));
    g.add(box(shoulders - 0.1, 0.05, 0.38, suitPlain, 0, 1.49, 0));
    // coat skirt — split panels below the waist
    g.add(box(shoulders * 0.44, 0.46, 0.38, suit, -shoulders * 0.24, 0.48, -0.02));
    g.add(box(shoulders * 0.44, 0.46, 0.38, suit, shoulders * 0.24, 0.48, -0.02));
    // coat tails (kept as invisible references for animation compatibility)
    const tailL = new THREE.Group();
    g.add(tailL);
    const tailR = new THREE.Group();
    g.add(tailR);
    // lapels
    const lapelMat = mat(hasFurCoat ? 0x4a0820 : 0x14092a, { roughness: 0.45 });
    g.add(box(0.1, 0.5, 0.03, lapelMat, -0.1, 1.16, 0.22));
    g.add(box(0.1, 0.5, 0.03, lapelMat, 0.1, 1.16, 0.22));
    // shirt front
    const shirtMat = mat(0xf5f5f5, { roughness: 0.6 });
    g.add(box(0.16, 0.4, 0.02, shirtMat, 0, 1.22, 0.215));
    g.add(box(0.22, 0.2, 0.02, shirtMat, 0, 1.38, 0.215));
    // collar wings
    g.add(box(0.1, 0.06, 0.03, shirtMat, -0.06, 1.44, 0.22));
    g.add(box(0.1, 0.06, 0.03, shirtMat, 0.06, 1.44, 0.22));
    // tie
    const tieMat = mat(0x9b0000, { roughness: 0.35 });
    g.add(box(0.06, 0.06, 0.03, tieMat, 0, 1.4, 0.235));
    g.add(box(0.08, 0.36, 0.02, tieMat, 0, 1.16, 0.235));
    g.add(box(0.1, 0.08, 0.02, tieMat, 0, 0.96, 0.235));
    g.add(box(0.08, 0.02, 0.02, gold, 0, 1.1, 0.25));
    // pocket square + breast pocket
    g.add(box(0.08, 0.06, 0.03, shirtMat, -0.26, 1.36, 0.22));
    g.add(box(0.06, 0.04, 0.03, shirtMat, -0.26, 1.4, 0.22));
    g.add(box(0.1, 0.12, 0.01, suitPlain, -0.26, 1.3, 0.22));
    // head
    const hd = head(skin, "sneer");
    hd.scale.set(1.08, 1.1, 1.08);
    hd.position.y = 1.78;
    g.add(hd);
    g.add(box(0.12, 0.1, 0.12, skinMat, 0, 1.54, 0));
    const hairTop = mat(0x0d0d0d, { roughness: 0.85, flatShading: true });
    const hairFade = mat(0x141414, { roughness: 0.95, flatShading: true });
    // top volume: thick textured crown swept back — the signature Italian quiff
    hd.add(box(0.4, 0.12, 0.4, hairTop, 0, 0.27, -0.02));
    hd.add(box(0.34, 0.08, 0.32, hairTop, 0, 0.34, -0.06));
    hd.add(box(0.26, 0.05, 0.22, hairTop, 0, 0.38, -0.1));
    // short tapered sides — tight fade that doesn't extend below the ears
    hd.add(box(0.05, 0.16, 0.36, hairFade, -0.21, 0.18, -0.04));
    hd.add(box(0.05, 0.16, 0.36, hairFade, 0.21, 0.18, -0.04));
    // even thinner lower fade — just a hint of stubble depth at ear level
    hd.add(box(0.04, 0.06, 0.3, hairFade, -0.21, 0.08, -0.06));
    hd.add(box(0.04, 0.06, 0.3, hairFade, 0.21, 0.08, -0.06));
    // back: short tapered neckline
    hd.add(box(0.4, 0.18, 0.06, hairFade, 0, 0.18, -0.19));
    hd.add(box(0.34, 0.06, 0.05, hairFade, 0, 0.08, -0.19));
    // textured front fringe — slightly messy for that styled Italian look
    hd.add(box(0.12, 0.05, 0.08, hairTop, 0, 0.26, 0.19));
    hd.add(box(0.08, 0.04, 0.06, hairTop, -0.08, 0.25, 0.17));
    hd.add(box(0.08, 0.04, 0.06, hairTop, 0.1, 0.26, 0.17));

    // ---- SMOKING slot: cigar or default cigarette (parented to head so they follow head rotation)
    {
        const sg = new THREE.Group();
        sg.position.set(0.05, -0.09, 0.21);
        sg.rotation.set(0, 0, -0.2);
        if (has("poker_3") || has("ach_boss_cigar")) {
            const c = cyl(0.035, 0.03, 0.3, mat(0x5a2a0a), 0, 0, 0.15, 8);
            c.rotation.x = Math.PI / 2;
            sg.add(c);
            sg.add(sph(0.035, glow(0xff4400, 3), 0, 0, 0.3, 6));
        } else {
            const c = cyl(0.012, 0.012, 0.2, mat(0xffffff), 0, 0, 0.1, 6);
            c.rotation.x = Math.PI / 2;
            sg.add(c);
            sg.add(sph(0.015, glow(0xff5500, 4), 0, 0, 0.2, 6));
        }
        hd.add(sg);
    }

    // legs — same root dimensions as original so pivot math stays correct
    // Root box: 0.62 tall at y=0.31. Pivot shift moves geo -0.3, pos +0.3, children -0.3.
    const legL = box(0.22, 0.62, 0.24, suitPlain, -0.15, 0.31, 0);
    g.add(legL);
    const legR = box(0.22, 0.62, 0.24, suitPlain, 0.15, 0.31, 0);
    g.add(legR);
    // trouser crease (pre-shift coords; will shift -0.3)
    const crease = mat(hasFurCoat ? 0x500820 : 0x120828, { roughness: 0.4 });
    legL.add(box(0.02, 0.5, 0.01, crease, 0, -0.04, 0.12));
    legR.add(box(0.02, 0.5, 0.01, crease, 0, -0.04, 0.12));

    // ---- SHOES slot (pre-shift coords; children shift -0.3)
    let shoeMat = BLACK_GLOSS();
    if (has("feet_2")) shoeMat = mat(0xc0392b, { roughness: 0.15, flatShading: false });
    else if (has("feet_1")) shoeMat = mat(0x0c0c12, { metalness: 0.5, roughness: 0.1, flatShading: false });
    const soleMat = mat(0x1a1a1a, { roughness: 0.9 });
    for (const leg of [legL, legR]) {
        leg.add(box(0.18, 0.08, 0.28, shoeMat, 0, -0.16, 0.02));        // shoe body
        leg.add(box(0.14, 0.06, 0.12, shoeMat, 0, -0.16, 0.18));        // pointed toe
        leg.add(box(0.19, 0.03, 0.32, soleMat, 0, -0.21, 0.04));        // sole
        leg.add(box(0.18, 0.04, 0.08, soleMat, 0, -0.19, -0.10));       // heel
    }

    // ---- ARMS slot — positioned at shoulder edge
    const sleeveMat = has("back_1") ? skinMat : suit;
    const armX = shoulders / 2 + 0.02;
    const armL = box(0.16, 0.66, 0.16, sleeveMat, -armX, 1.08, 0);
    g.add(armL);
    const armR = box(0.16, 0.66, 0.16, sleeveMat, armX, 1.08, 0);
    g.add(armR);
    // sleeve cuffs (pre-shift coords)
    const cuffMat = mat(hasFurCoat ? 0x4a0820 : 0x14092a, { roughness: 0.4 });
    armL.add(box(0.17, 0.04, 0.17, cuffMat, 0, -0.28, 0));
    armR.add(box(0.17, 0.04, 0.17, cuffMat, 0, -0.28, 0));
    // shirt cuff peeking out
    armL.add(box(0.14, 0.03, 0.14, shirtMat, 0, -0.31, 0));
    armR.add(box(0.14, 0.03, 0.14, shirtMat, 0, -0.31, 0));

    // ---- HANDS slot (pre-shift coords)
    const glove = has("sleight_1") ? mat(0xf5f5f5) : skinMat;
    armL.add(box(0.14, 0.14, 0.14, glove, 0, -0.38, 0));
    armR.add(box(0.14, 0.14, 0.14, glove, 0, -0.38, 0));

    for (const a of [armL, armR, legL, legR]) {
        a.geometry = a.geometry.clone();
        a.geometry.translate(0, -0.3, 0);
        a.position.y += 0.3;
        for (const ch of a.children) ch.position.y -= 0.3;
    }
    armR.add(cyl(0.025, 0.025, 0.02, gold, 0.06, -0.72, 0.04, 8)); // pinky ring, always

    if (has("sleight_2")) for (let i = 0; i < 3; i++) armR.add(cyl(0.025, 0.025, 0.02, gold, -0.05 + i * 0.05, -0.74, 0.07, 6));
    if (has("sleight_3")) armL.add(sph(0.04, glow(0xccffff, 1.2), 0.07, -0.74, 0.07, 6));

    // ---- WRIST slot: gold watch
    if (has("sleight_4")) armL.add(box(0.18, 0.06, 0.18, gold, 0, -0.58, 0));

    // ---- SLEEVE slot: ace up sleeve
    if (has("sleight_5")) armR.add(box(0.12, 0.17, 0.02, mat(0xffffff), 0.1, -0.5, 0.05));

    // ---- BELT slot: weight belt
    if (has("back_3")) g.add(box(shoulders * 0.92, 0.1, 0.44, mat(0x6b3a1a, { roughness: 0.5 }), 0, 0.72, -0.02));

    // ---- HIP slot: money bags
    if (has("back_5")) {
        g.add(sph(0.22, mat(0x6b4f2a, { roughness: 0.9 }), -shoulders / 2 - 0.3, 0.8, -0.1, 8));
        g.add(box(0.14, 0.1, 0.04, glow(0x3cb371, 0.3), -shoulders / 2 - 0.3, 0.8, 0.1));
        g.add(sph(0.22, mat(0x6b4f2a, { roughness: 0.9 }), shoulders / 2 + 0.3, 0.8, -0.1, 8));
    } else if (has("back_4")) {
        g.add(sph(0.22, mat(0x6b4f2a, { roughness: 0.9 }), -shoulders / 2 - 0.3, 0.8, -0.1, 8));
        g.add(box(0.14, 0.1, 0.04, glow(0x3cb371, 0.3), -shoulders / 2 - 0.3, 0.8, 0.1));
    }

    // ---- HAT slot: crown, visor, top hat, or gold top hat
    if (has("ach_crown")) {
        // gaudy gold crown with spikes
        hd.add(cyl(0.28, 0.24, 0.12, gold, 0, 0.32, 0, 12));
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            hd.add(box(0.06, 0.16, 0.06, gold, Math.cos(a) * 0.22, 0.44, Math.sin(a) * 0.22));
            hd.add(sph(0.03, glow(0xffdd44, 1.5), Math.cos(a) * 0.22, 0.54, Math.sin(a) * 0.22, 6));
        }
    } else if (has("poker_5")) {
        hd.add(cyl(0.32, 0.32, 0.04, gold, 0, 0.25, 0, 16));
        hd.add(cyl(0.22, 0.22, 0.4, gold, 0, 0.46, 0, 16));
        hd.add(cyl(0.23, 0.23, 0.06, mat(0x8b0000), 0, 0.31, 0, 16));
    } else if (has("poker_4")) {
        hd.add(cyl(0.32, 0.32, 0.04, BLACK_GLOSS(), 0, 0.25, 0, 16));
        hd.add(cyl(0.22, 0.22, 0.4, BLACK_GLOSS(), 0, 0.46, 0, 16));
        hd.add(cyl(0.23, 0.23, 0.06, mat(0x8b0000), 0, 0.31, 0, 16));
    } else if (has("poker_1")) {
        hd.add(box(0.46, 0.05, 0.3, glow(0x00aa66, 0.6, { transparent: true, opacity: 0.7 }), 0, 0.14, 0.25));
    }

    // ---- GLASSES slot: diamond shades, mirrored shades, or sunglasses
    if (has("ach_diamond_shades")) {
        hd.add(box(0.46, 0.1, 0.07, mat(0x111122, { metalness: 0.9, roughness: 0.05, flatShading: false }), 0, 0.03, 0.22));
        hd.add(box(0.48, 0.02, 0.08, gold, 0, 0.08, 0.22));
        hd.add(box(0.48, 0.02, 0.08, gold, 0, -0.02, 0.22));
        hd.add(sph(0.025, glow(0xccffff, 2), -0.18, 0.03, 0.26, 6));
        hd.add(sph(0.025, glow(0xccffff, 2), 0.18, 0.03, 0.26, 6));
    } else if (has("ach_shades")) {
        hd.add(box(0.46, 0.1, 0.07, mat(0xc0c8d0, { metalness: 1.0, roughness: 0.02, flatShading: false }), 0, 0.03, 0.22));
        hd.add(box(0.48, 0.015, 0.08, mat(0x888888, { metalness: 0.8, roughness: 0.1 }), 0, 0.08, 0.22));
    } else if (has("poker_2")) {
        hd.add(box(0.44, 0.09, 0.06, mat(0x050505, { roughness: 0.05, flatShading: false }), 0, 0.03, 0.21));
    }

    // ---- NECK slot: gold tooth, chain(s), street chain
    if (has("tongue_3")) {
        const ch = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 6, 16), gold);
        ch.position.set(0, 1.3, 0.2);
        ch.rotation.x = 1.3;
        g.add(ch);
        g.add(box(0.1, 0.12, 0.03, gold, 0, 1.1, 0.26));
        const ch2 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), gold);
        ch2.position.set(0, 1.38, 0.18);
        ch2.rotation.x = 1.3;
        g.add(ch2);
    } else if (has("ach_street_chain")) {
        const ch = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16), gold);
        ch.position.set(0, 1.34, 0.2);
        ch.rotation.x = 1.3;
        g.add(ch);
        g.add(box(0.12, 0.14, 0.04, gold, 0, 1.12, 0.28));
    } else if (has("tongue_2")) {
        const ch = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), gold);
        ch.position.set(0, 1.38, 0.18);
        ch.rotation.x = 1.3;
        g.add(ch);
    }

    // ---- COAT slot: fur collar or full fur coat
    if (has("tongue_5")) {
        g.add(box(shoulders + 0.22, 0.9, 0.52, mat(0xf0e2c8, { roughness: 1 }), 0, 1.0, -0.06));
        g.add(box(shoulders + 0.14, 0.18, 0.5, mat(0xf0e2c8, { roughness: 1 }), 0, 1.47, -0.01));
    } else if (has("tongue_4")) {
        g.add(box(shoulders + 0.14, 0.18, 0.5, mat(0xf0e2c8, { roughness: 1 }), 0, 1.47, -0.01));
    }

    // ---- HELD slot: cane or gold cane
    if (has("feet_4")) {
        armR.add(cyl(0.02, 0.02, 1.0, gold, 0, -0.85, 0.16, 8));
        armR.add(sph(0.05, gold, 0, -0.36, 0.16, 8));
    } else if (has("feet_3")) {
        armR.add(cyl(0.02, 0.02, 1.0, mat(0x1a0a0a), 0, -0.85, 0.16, 8));
        armR.add(sph(0.05, gold, 0, -0.36, 0.16, 8));
    }

    g.userData = { ...g.userData, legL, legR, armL, armR, head: hd, body: torso, tailL, tailR };
    return g;
}

const PED_NAMES = [
    "a tourist",
    "a nurse off shift",
    "a retiree",
    "a pastor",
    "a bus driver",
    "a student",
    "a bride-to-be",
    "a tax inspector",
    "someone's grandmother",
    "a birthday boy",
    'a man who "quit"',
    "a jogger",
    "a divorcee",
    "a pawn shop regular",
    "an off-duty cop",
    "a hungover groom",
];
const PED_TYPES = ["regular", "drunk", "regular", "regular", "sharp", "whale", "drunk", "regular"];

/** Street pedestrian with randomised appearance and a type/name for targeting. */
export function makePedestrian() {
    const type = PED_TYPES[Math.floor(Math.random() * PED_TYPES.length)];
    const name = PED_NAMES[Math.floor(Math.random() * PED_NAMES.length)];
    const g = makeCustomer(type);
    g.userData.pedType = type;
    g.userData.pedName = name;
    g.userData.isPedestrian = true;
    return g;
}

/** Bouncer: a very large guest in black with an earpiece. */
export function makeBouncer() {
    const g = makeCustomer("sharp");
    g.scale.set(1.35, 1.25, 1.35);
    g.userData.head.add(sph(0.03, mat(0x111111), 0.2, 0.0, 0.05, 6));
    g.userData.head.add(cyl(0.008, 0.008, 0.25, mat(0x111111), 0.2, -0.15, 0.02, 4));
    return g;
}

/** Subtle difficulty indicator above the customer's head. */
export function applyDifficultyTint(group, difficulty) {
    const colors = { easy: 0x3ddc84, medium: 0xf5c542, hard: 0xff4d5e };
    const color = colors[difficulty] || colors.medium;
    const indicator = new THREE.Mesh(
        G("diffDot", () => new THREE.SphereGeometry(0.06, 6, 6)),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, toneMapped: false }),
    );
    indicator.position.set(0, 1.88, 0);
    group.add(indicator);
    group.userData.diffIndicator = indicator;
    group.userData.difficulty = difficulty;
}

/** Shared idle/walk animation for a person group. */
export function animatePerson(g, dt, { walking, walkT, drunk = false }) {
    const u = g.userData;
    u.idleT = (u.idleT || 0) + dt;
    const blend = 1 - Math.exp(-8 * dt);
    if (walking) {
        const s = Math.sin(walkT * 9) * 0.65;
        u.legL.rotation.x = s;
        u.legR.rotation.x = -s;
        u.armL.rotation.x = -s * 0.7;
        u.armR.rotation.x = s * 0.7;
        g.position.y = Math.abs(Math.sin(walkT * 9)) * 0.03;
        if (u.tailL) {
            u.tailL.rotation.x = -0.35 - Math.sin(walkT * 9) * 0.1;
            u.tailR.rotation.x = -0.35 + Math.sin(walkT * 9) * 0.1;
        }
        if (u.cape) u.cape.rotation.x = 0.35 + Math.sin(walkT * 4) * 0.08;
        if (drunk) g.rotation.z = Math.sin(walkT * 3) * 0.12;
    } else {
        u.legL.rotation.x += (0 - u.legL.rotation.x) * blend;
        u.legR.rotation.x += (0 - u.legR.rotation.x) * blend;
        g.position.y += (0 - g.position.y) * blend;
        if (u.tailL) {
            u.tailL.rotation.x += (-0.05 - u.tailL.rotation.x) * blend;
            u.tailR.rotation.x = u.tailL.rotation.x;
        }
        if (u.cape) u.cape.rotation.x += (0.05 - u.cape.rotation.x) * blend;
        u.body.scale.y = 1 + Math.sin(u.idleT * 2) * 0.012;
        u.head.rotation.y = Math.sin(u.idleT * 0.7) * 0.25 + (drunk ? Math.sin(u.idleT * 2.3) * 0.15 : 0);
        u.head.rotation.z = drunk ? Math.sin(u.idleT * 1.1) * 0.12 : 0;
        g.rotation.z += (0 - g.rotation.z) * blend;
    }
}

/** Set a character's gaze target (no-op for boxy characters). */
export function setGaze() {}

/** Change a character's mood (no-op for boxy characters). */
export function setMood() {}
