// Third-person owner controller. WASD / arrows move relative to the camera,
// drag the mouse (or use Q/E) to orbit, scroll to zoom.
import * as THREE from 'three';
import { makeOwner, animatePerson } from '../world/people.js';

export class Player {
  constructor(scene, camera, game) {
    this.scene = scene; this.camera = camera; this.game = game;
    this.pos = new THREE.Vector3(0, 0, 4);
    this.yaw = 0;              // facing direction of the owner
    this.camYaw = 0;           // camera orbit (0 = behind the owner, looking into the casino)
    this.camPitch = 0.45;
    this.camDist = 7;
    this.keys = {};
    this.walkT = 0;
    this.moving = false;
    this.enabled = true;
    this.model = null;
    this.rebuildModel();

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    let dragging = false, lastX = 0, lastY = 0;
    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!dragging || !this.enabled) return;
      this.camYaw -= (e.clientX - lastX) * 0.006;
      this.camPitch = Math.max(0.15, Math.min(1.2, this.camPitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('wheel', e => { this.camDist = Math.max(3.5, Math.min(14, this.camDist + Math.sign(e.deltaY) * 0.8)); }, { passive: true });
  }

  rebuildModel() {
    if (this.model) this.scene.remove(this.model);
    this.model = makeOwner(this.game.s.skills);
    this.model.position.copy(this.pos);
    this.scene.add(this.model);
  }

  teleport(x, z) { this.pos.set(x, 0, z); this.model.position.copy(this.pos); this.snapCamera = true; }

  update(dt, world) {
    const k = this.keys;
    let mx = 0, mz = 0;
    if (this.enabled) {
      if (k.KeyW || k.ArrowUp) mz -= 1;
      if (k.KeyS || k.ArrowDown) mz += 1;
      if (k.KeyA || k.ArrowLeft) mx -= 1;
      if (k.KeyD || k.ArrowRight) mx += 1;
      if (k.KeyQ) this.camYaw += dt * 2;
      if (k.KeyE && false) this.camYaw -= dt * 2; // E is the interact key
    }
    this.moving = (mx !== 0 || mz !== 0);
    if (this.moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      // move relative to camera yaw
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const dx = mx * cos - mz * sin;
      const dz = mx * sin + mz * cos;
      const speed = this.game.stats.walkSpeed;
      this.pos.x += dx * speed * dt;
      this.pos.z += dz * speed * dt;
      this.yaw = Math.atan2(dx, dz);
      this.walkT += dt * speed;
      world.collide(this.pos, 0.4);
    }
    this.model.position.copy(this.pos);
    // smooth turn
    let d = this.yaw - this.model.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.model.rotation.y += d * Math.min(1, dt * 12);
    animatePerson(this.model, dt, { walking: this.moving, walkT: this.walkT * 0.18 });
    if (!this.moving) { const u = this.model.userData; u.armL.rotation.x += (0 - u.armL.rotation.x) * Math.min(1, dt * 8); u.armR.rotation.x += (0 - u.armR.rotation.x) * Math.min(1, dt * 8); }

    // camera
    const target = new THREE.Vector3(this.pos.x, 1.45, this.pos.z);
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      Math.sin(this.camPitch) * this.camDist + 0.5,
      Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
    );
    const desired = target.clone().add(off);
    // keep the camera on the same side of the walls as the owner: march from the
    // owner toward the desired spot and stop before crossing a wall/ceiling
    if (world) {
      const W = world.W, D = world.D, H = world.H || 4.8;
      const inRoom = p => Math.abs(p.x) < W / 2 - 0.3 && p.z > -D / 2 + 0.3 && p.z < D / 2 - 0.3;
      const inDoor = p => Math.abs(p.x) < 1.2 && p.z >= D / 2 - 0.3 && p.z <= D / 2 + 0.3;
      const playerInside = inRoom(this.pos);
      // indoors the camera stays under the ceiling (flatter angle, same distance)
      if (playerInside) desired.y = Math.min(desired.y, H - 0.5);
      const p = new THREE.Vector3();
      let ok = 1;
      for (let t = 0.05; t <= 1; t += 0.05) {
        p.lerpVectors(target, desired, t);
        const inside = inRoom(p) || inDoor(p);
        if (inside !== playerInside && !inDoor(p)) break;
        ok = t;
      }
      desired.lerpVectors(target, desired, Math.max(0.25, ok));
    }
    this.camera.position.lerp(desired, this.snapCamera ? 1 : Math.min(1, dt * 6));
    this.snapCamera = false;
    this.camera.lookAt(target);
  }
}
