// Atmosphere: rain over the street, haze inside, cigarette smoke, and floating
// money numbers. All cheap sprites / point clouds, rebuilt per casino.
import * as THREE from 'three';
import { softSpriteTexture, rainTexture } from '../engine/textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.floaters = [];
    this.time = 0;
  }

  clear() {
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.rain = null; this.haze = []; this.smoke = [];
    for (const f of this.floaters) this.scene.remove(f.sprite);
    this.floaters = [];
  }

  build(world, def) {
    this.clear();
    const W = world.W, D = world.D;
    // ---- rain over the street --------------------------------------------------
    const n = 1400;
    const pos = new Float32Array(n * 3);
    this.rainBounds = { x0: -W / 2 - 30, x1: W / 2 + 30, z0: D / 2 + 0.6, z1: D / 2 + 34, y: 18 };
    for (let i = 0; i < n; i++) this.resetDrop(pos, i, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ map: rainTexture(), size: 0.9, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    this.root.add(this.rain);

    // ---- haze sprites inside (volumetric feel under the bloom) ---------------------
    const hazeMat = new THREE.SpriteMaterial({ map: softSpriteTexture(def.id === 'diablo' ? '255,120,160' : '255,190,120'), transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(hazeMat);
      s.position.set((Math.random() - 0.5) * (W - 4), 1.5 + Math.random() * 2, (Math.random() - 0.5) * (D - 4));
      const sc = 5 + Math.random() * 6; s.scale.set(sc, sc * 0.6, 1);
      s.userData = { vx: (Math.random() - 0.5) * 0.15, vz: (Math.random() - 0.5) * 0.15, t: Math.random() * 10 };
      this.root.add(s); this.haze.push(s);
    }
    // ---- cigarette smoke wisps rising from the machine rows ----------------------------
    const smokeMat = new THREE.SpriteMaterial({ map: softSpriteTexture('200,200,220'), transparent: true, opacity: 0.18, depthWrite: false });
    this.smokeSources = world.machines.map(m => m.usePos);
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(smokeMat.clone());
      this.resetSmoke(s, true);
      this.root.add(s); this.smoke.push(s);
    }
    // ---- streetlamp light cones ------------------------------------------------------
    for (const x of world.lampXs || []) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      cone.position.set(x, 2.55, D / 2 + 5.5); cone.rotation.x = Math.PI; this.root.add(cone);
    }
  }

  resetDrop(pos, i, randomY) {
    const b = this.rainBounds;
    pos[i * 3] = b.x0 + Math.random() * (b.x1 - b.x0);
    pos[i * 3 + 1] = randomY ? Math.random() * b.y : b.y;
    pos[i * 3 + 2] = b.z0 + Math.random() * (b.z1 - b.z0);
  }
  resetSmoke(s, randomAge) {
    if (!this.smokeSources.length) { s.visible = false; return; }
    const src = this.smokeSources[Math.floor(Math.random() * this.smokeSources.length)];
    s.userData = { age: randomAge ? Math.random() * 4 : 0, life: 3.5 + Math.random() * 2, x: src.x + (Math.random() - 0.5) * 0.4, z: src.z + (Math.random() - 0.5) * 0.4, drift: (Math.random() - 0.5) * 0.3 };
    s.visible = true;
  }

  /** Floating text sprite that rises and fades. */
  float(x, y, z, text, color = '#3cb371', size = 1.1) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 56px Rubik, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(text, 128, 48);
    ctx.fillStyle = color; ctx.fillText(text, 128, 48);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, z); sprite.scale.set(size * 2.6, size, 1);
    this.scene.add(sprite);
    this.floaters.push({ sprite, t: 0 });
    if (this.floaters.length > 30) { const f = this.floaters.shift(); this.scene.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose(); }
  }

  update(dt) {
    this.time += dt;
    if (this.rain) {
      const a = this.rain.geometry.attributes.position; const p = a.array;
      for (let i = 0; i < a.count; i++) {
        p[i * 3 + 1] -= dt * 14; p[i * 3] += dt * 1.2;
        if (p[i * 3 + 1] < 0) this.resetDrop(p, i, false);
      }
      a.needsUpdate = true;
    }
    for (const h of this.haze) {
      h.userData.t += dt;
      h.position.x += h.userData.vx * dt; h.position.z += h.userData.vz * dt;
      h.material.opacity = 0.04 + Math.sin(h.userData.t * 0.4) * 0.015;
    }
    for (const s of this.smoke) {
      const u = s.userData; if (!s.visible) continue;
      u.age += dt;
      if (u.age > u.life) { this.resetSmoke(s, false); continue; }
      const k = u.age / u.life;
      s.position.set(u.x + Math.sin(u.age * 1.5) * 0.15 + u.drift * u.age, 1.4 + u.age * 0.45, u.z);
      const sc = 0.25 + k * 0.9; s.scale.set(sc, sc, 1);
      s.material.opacity = 0.16 * (1 - k) * Math.min(1, u.age * 3);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.t += dt;
      f.sprite.position.y += dt * 0.9;
      f.sprite.material.opacity = f.t < 1.2 ? 1 : Math.max(0, 1 - (f.t - 1.2) / 0.6);
      if (f.t > 1.8) { this.scene.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose(); this.floaters.splice(i, 1); }
    }
  }
}
