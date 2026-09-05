// Pedestrians: ambient NPCs that walk along the sidewalk outside the casino.
// Always present as street life. During "pick your mark" mode the player can
// approach one and press F to select a victim for the advertising minigame.
import * as THREE from 'three';
import { makePedestrian, animatePerson, applyDifficultyTint } from './people.js';
import { rollDifficulty } from './customers.js';

const MAX_PEDS = 8;
const SPAWN_INTERVAL_MIN = 2.5;
const SPAWN_INTERVAL_MAX = 5.5;
const INTERACT_RADIUS = 2.2;

const _v = new THREE.Vector3();

export class PedestrianManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    this.spawnTimer = 1;
    this.picking = false;
    this.highlighted = null;
  }

  /** Toggle interactive pick-your-mark mode (pedestrians keep walking either way). */
  setPicking(on) {
    this.picking = on;
    if (!on) {
      if (this.highlighted && this.highlighted.group.userData.diffIndicator) {
        this.highlighted.group.userData.diffIndicator.material.opacity = 0.85;
        this.highlighted.group.userData.diffIndicator.scale.setScalar(1);
      }
      this.highlighted = null;
    }
  }

  clearAll() {
    for (const p of this.peds) this.scene.remove(p.group);
    this.peds = [];
    this.highlighted = null;
  }

  spawn() {
    if (this.peds.length >= MAX_PEDS) return;
    const D = this.world.D, W = this.world.W;
    const group = makePedestrian();
    const type = group.userData.pedType;
    const difficulty = rollDifficulty(type);
    applyDifficultyTint(group, difficulty);

    // hide the difficulty dot during normal walking — only visible in pick mode
    if (group.userData.diffIndicator) group.userData.diffIndicator.visible = this.picking;

    const goRight = Math.random() < 0.5;
    const startX = goRight ? -W / 2 - 18 : W / 2 + 18;
    const endX = goRight ? W / 2 + 18 : -W / 2 - 18;
    const z = D / 2 + 2.5 + Math.random() * 3.5;

    group.position.set(startX, 0, z);
    group.rotation.y = goRight ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(group);

    const speed = 1.0 + Math.random() * 1.2;
    const ped = {
      group, type, difficulty,
      name: group.userData.pedName,
      speed,
      startX, endX, z,
      walkT: Math.random() * 10,
      stopped: false,
      stopTimer: 0,
    };

    if (Math.random() < 0.35) {
      ped.stopAt = startX + (endX - startX) * (0.3 + Math.random() * 0.4);
      ped.stopDuration = 2 + Math.random() * 3;
    }

    this.peds.push(ped);
  }

  /** Find the nearest interactable pedestrian to the player position. */
  nearest(playerPos) {
    let best = null, bestDist = INTERACT_RADIUS;
    for (const p of this.peds) {
      _v.copy(p.group.position);
      _v.y = 0;
      const d = _v.distanceTo(playerPos);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  update(dt, playerPos) {
    // always spawn & move pedestrians
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
      this.spawn();
    }

    // highlighting only in pick mode
    if (this.picking && playerPos) {
      const prev = this.highlighted;
      this.highlighted = this.nearest(playerPos);
      if (prev !== this.highlighted && prev && prev.group.userData.diffIndicator) {
        prev.group.userData.diffIndicator.material.opacity = 0.85;
        prev.group.userData.diffIndicator.scale.setScalar(1);
      }
    } else {
      this.highlighted = null;
    }

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      const g = p.group;
      const goRight = p.endX > p.startX;

      // show/hide difficulty dots based on pick mode
      if (g.userData.diffIndicator) g.userData.diffIndicator.visible = this.picking;

      // stop behavior
      if (p.stopAt !== undefined && !p.stopped) {
        if ((goRight && g.position.x >= p.stopAt) || (!goRight && g.position.x <= p.stopAt)) {
          p.stopped = true;
          p.stopTimer = p.stopDuration;
        }
      }

      if (p.stopped) {
        p.stopTimer -= dt;
        p.walkT += dt;
        animatePerson(g, dt, { walking: false, walkT: p.walkT, drunk: p.type === 'drunk' });
        if (p.stopTimer <= 0) {
          p.stopped = false;
          p.stopAt = undefined;
        }
      } else {
        const dir = goRight ? 1 : -1;
        g.position.x += dir * p.speed * dt;
        g.rotation.y = goRight ? Math.PI / 2 : -Math.PI / 2;
        p.walkT += dt;
        animatePerson(g, dt, { walking: true, walkT: p.walkT, drunk: p.type === 'drunk' });
      }

      // pulse the highlighted ped's indicator
      if (p === this.highlighted) {
        const ind = g.userData.diffIndicator;
        if (ind) {
          const pulse = 1.2 + Math.sin(Date.now() * 0.006) * 0.4;
          ind.scale.setScalar(pulse);
          ind.material.opacity = 1;
        }
      }

      // despawn when off-screen
      if ((goRight && g.position.x > p.endX) || (!goRight && g.position.x < p.endX)) {
        this.scene.remove(g);
        this.peds.splice(i, 1);
        if (this.highlighted === p) this.highlighted = null;
      }
    }
  }
}
