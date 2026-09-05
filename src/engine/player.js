// Third-person owner controller.
// Standard pattern: camera orbits the player, WASD movement is derived from
// the camera's actual forward/right vectors so it always matches what's on
// screen. Camera auto-follows behind the player when not manually orbited.
import * as THREE from 'three';
import { makeOwner, animatePerson } from '../world/people.js';

function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }

// Reusable scratch vectors (zero per-frame allocations).
const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _move    = new THREE.Vector3();
const _target  = new THREE.Vector3();
const _off     = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _probe   = new THREE.Vector3();

const MAX_SUBSTEPS  = 4;
const PLAYER_RADIUS = 0.4;
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(scene, camera, game) {
    this.scene = scene; this.camera = camera; this.game = game;
    this.pos = new THREE.Vector3(0, 0, 4);
    this.yaw = 0;
    this.camYaw = 0;
    this.camPitch = 0.45;
    this.camDist = 7;
    this.keys = {};
    this.walkT = 0;
    this.moving = false;
    this.enabled = true;
    this.model = null;
    this.dragging = false;
    this.orbitCooldown = 0;
    this.rebuildModel();

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    let lastX = 0, lastY = 0;
    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', e => { this.dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!this.dragging || !this.enabled) return;
      this.camYaw -= (e.clientX - lastX) * 0.006;
      this.camPitch = Math.max(0.15, Math.min(1.2, this.camPitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      this.orbitCooldown = 0.6;
    });
    canvas.addEventListener('wheel', e => { this.camDist = Math.max(3.5, Math.min(14, this.camDist + Math.sign(e.deltaY) * 0.8)); }, { passive: true });
  }

  rebuildModel() {
    if (this.model) this.scene.remove(this.model);
    this.model = makeOwner(this.game.s.skills);
    this.model.position.copy(this.pos);
    this.scene.add(this.model);
  }

  teleport(x, z) {
    this.pos.set(x, 0, z);
    this.model.position.copy(this.pos);
    this.camYaw = this.yaw + Math.PI;
    this.snapCamera = true;
  }

  update(dt, world) {
    // ---- 1. Read input -------------------------------------------------------
    const k = this.keys;
    let inputX = 0, inputZ = 0;
    if (this.enabled) {
      if (k.KeyW || k.ArrowUp)    inputZ += 1;   // +Z = forward (toward camera look dir)
      if (k.KeyS || k.ArrowDown)  inputZ -= 1;
      if (k.KeyA || k.ArrowLeft)  inputX -= 1;    // -X = left
      if (k.KeyD || k.ArrowRight) inputX += 1;
      if (k.KeyQ) this.camYaw += dt * 2;
    }

    // ---- 2. Derive camera forward & right on the XZ plane -------------------
    // Forward = from camera toward the look target, flattened to XZ, normalized.
    _forward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).normalize();
    _right.crossVectors(_forward, UP).normalize();

    // ---- 3. Combine input with camera vectors for world-space movement ------
    this.moving = (inputX !== 0 || inputZ !== 0);
    if (this.moving) {
      _move.set(0, 0, 0);
      _move.addScaledVector(_forward, inputZ);
      _move.addScaledVector(_right, inputX);
      _move.y = 0;
      _move.normalize();

      const speed = this.game.stats.walkSpeed;
      const totalDist = speed * dt;

      const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(totalDist / (PLAYER_RADIUS * 0.8))));
      const stepDist = totalDist / steps;
      for (let s = 0; s < steps; s++) {
        this.pos.x += _move.x * stepDist;
        this.pos.z += _move.z * stepDist;
        world.collide(this.pos, PLAYER_RADIUS);
      }

      this.yaw = Math.atan2(_move.x, _move.z);
      this.walkT += dt * speed;
    }

    // ---- 4. Camera auto-follow behind the player ----------------------------
    // While walking forward, gently pull camera behind the player. Skip during
    // mouse orbit (and for a short cooldown after) so manual look isn't fought.
    this.orbitCooldown = Math.max(0, this.orbitCooldown - dt);
    if (!this.dragging && this.orbitCooldown <= 0 && this.moving && inputZ > 0) {
      const behindYaw = this.yaw + Math.PI;
      let camDelta = behindYaw - this.camYaw;
      camDelta = Math.atan2(Math.sin(camDelta), Math.cos(camDelta));
      this.camYaw += camDelta * damp(3, dt);
    }

    // ---- 5. Update model position & rotation --------------------------------
    this.model.position.copy(this.pos);

    let d = this.yaw - this.model.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.model.rotation.y += d * damp(12, dt);

    animatePerson(this.model, dt, { walking: this.moving, walkT: this.walkT * 0.18 });
    if (!this.moving) {
      const u = this.model.userData;
      const armK = damp(8, dt);
      u.armL.rotation.x *= (1 - armK);
      u.armR.rotation.x *= (1 - armK);
    }

    // ---- 6. Position the camera ---------------------------------------------
    _target.set(this.pos.x, 1.45, this.pos.z);
    _off.set(
      Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      Math.sin(this.camPitch) * this.camDist + 0.5,
      Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
    );
    _desired.copy(_target).add(_off);

    if (world) {
      const W = world.W, D = world.D, H = world.H || 4.8;
      const inRoom = p => Math.abs(p.x) < W / 2 - 0.3 && p.z > -D / 2 + 0.3 && p.z < D / 2 - 0.3;
      const inDoor = p => Math.abs(p.x) < 1.2 && p.z >= D / 2 - 0.3 && p.z <= D / 2 + 0.3;
      const playerInside = inRoom(this.pos);
      if (playerInside) _desired.y = Math.min(_desired.y, H - 0.5);
      let ok = 1;
      for (let t = 0.05; t <= 1; t += 0.05) {
        _probe.lerpVectors(_target, _desired, t);
        const inside = inRoom(_probe) || inDoor(_probe);
        if (inside !== playerInside && !inDoor(_probe)) break;
        ok = t;
      }
      _desired.lerpVectors(_target, _desired, Math.max(0.25, ok));
    }

    this.camera.position.lerp(_desired, this.snapCamera ? 1 : damp(6, dt));
    this.snapCamera = false;
    this.camera.lookAt(_target);
  }
}
