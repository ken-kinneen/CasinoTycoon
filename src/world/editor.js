// Floor editor — pick-up / put-down pattern (SimCity / The Sims / RCT style).
//
// Two clean states, no drag conflicts:
//   IDLE   — hover highlights objects, click selects (shows info panel)
//   MOVING — object follows cursor every frame, left-click stamps, right/Esc cancels
//
// All mouse input goes through the canvas. The UI panel uses pointerdown with
// stopPropagation so button clicks never leak to the 3D scene. The player
// camera checks `editor.moveMode` and skips orbit when true.
import * as THREE from 'three';

const GRID = 0.6;
const ROTATE_STEP = Math.PI / 2;

const _ray = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
const _hit = new THREE.Vector3();

function snap(v) { return Math.round(v / GRID) * GRID; }

const FOOTPRINT = { machine: { hw: 0.55, hd: 0.55 }, table: { hw: 1.8, hd: 1.4 }, prop: { hw: 1.0, hd: 1.0 } };

export class FloorEditor {
  constructor(scene, camera, canvas, world) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.enabled = false;

    // state
    this.hovered = null;      // { type, index, obj, data }
    this.selected = null;     // { type, index, obj, data }
    this.moveMode = false;    // picked-up, following cursor
    this.arrangeMode = false; // when true, clicking any item picks it up immediately
    this._savedPos = null;    // snap-back on cancel
    this._placementValid = true;
    this._placementReason = null;
    this._rejectFlash = 0;

    this.playerPos = new THREE.Vector3();
    this._clickScreenPos = { x: 0, y: 0 };

    // callbacks
    this.onSelect = null;     // (info|null, screenPos)
    this.onChange = null;      // ()
    this.onMoveUpdate = null; // (screenX, screenY, valid) — called each frame during move
    this.onPlacementRejected = null; // (reason) — called when click in invalid spot

    // visual indicators
    this._glowMeshes = [];  // hover glow
    this._glowT = 0;
    this._moveGlowMeshes = [];  // blue pulse while moving
    this._confirmGlowMeshes = [];  // green flash after placing
    this._confirmGlowTimer = -1;

    this._selectGlowMeshes = [];  // [{mesh, origEmissive, origIntensity}]

    this.validRing = this._makeRing(0x44ff44, 0.6, 0.15);
    this.validRing.visible = false;
    scene.add(this.validRing);

    this.confirmFx = this._makeConfirmFx();
    this.confirmFx.visible = false;
    scene.add(this.confirmFx);
    this._confirmTimer = -1;

    // bound handlers
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onCtx = this._onCtx.bind(this);
  }

  // --- lifecycle ------------------------------------------------------------

  start() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.addEventListener('pointerdown', this._onDown);
    this.canvas.addEventListener('contextmenu', this._onCtx);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('keydown', this._onKey);
    // prevent legacy mousedown from leaking to camera orbit when editor handles the click
    this._onMouseBlock = (e) => { if (this._handledPointer) { e.stopImmediatePropagation(); this._handledPointer = false; } };
    this.canvas.addEventListener('mousedown', this._onMouseBlock);
  }

  stop() {
    if (!this.enabled) return;
    this.enabled = false;
    this.deselect();
    this._clearHover();
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('contextmenu', this._onCtx);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('keydown', this._onKey);
    if (this._onMouseBlock) this.canvas.removeEventListener('mousedown', this._onMouseBlock);
  }

  setWorld(world) {
    this.world = world;
    this._rayTargetsCache = null;
    this.deselect();
    this._clearHover();
  }

  // --- ring builders --------------------------------------------------------

  _makeRing(color, opacity, thickness) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 0.9 + thickness, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    g.userData = { ring };
    return g;
  }

  _collectMeshes(obj) {
    const list = [];
    obj.traverse(c => {
      if (c.isMesh && c.material && c.material.emissive) {
        const orig = c.material;
        const clone = orig.clone();
        c.material = clone;
        list.push({
          mesh: c,
          origMat: orig,
          origColor: orig.emissive.getHex(),
          origIntensity: orig.emissiveIntensity || 0,
        });
      }
    });
    return list;
  }

  _restoreMeshes(list) {
    for (const g of list) {
      g.mesh.material.dispose();
      g.mesh.material = g.origMat;
    }
  }

  _tintColor = new THREE.Color();

  _applyTint(meshList, tintHex, blend, intensityBoost) {
    this._tintColor.setHex(tintHex);
    for (const g of meshList) {
      g.mesh.material.emissive.setHex(g.origColor);
      g.mesh.material.emissive.lerp(this._tintColor, blend);
      g.mesh.material.emissiveIntensity = g.origIntensity + intensityBoost;
    }
  }

  _applySelectGlow(obj) {
    this._clearSelectGlow();
    this._selectGlowMeshes = this._collectMeshes(obj);
  }

  _clearSelectGlow() {
    this._restoreMeshes(this._selectGlowMeshes);
    this._selectGlowMeshes = [];
  }

  _makeConfirmFx() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.45, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    const burst = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })
    );
    burst.rotation.x = -Math.PI / 2;
    g.add(burst);
    g.userData = { disc, burst };
    return g;
  }

  _playConfirmFx(x, z, scale) {
    this._confirmTimer = 0;
    this.confirmFx.position.set(x, 0.2, z);
    this.confirmFx.visible = true;
    this.confirmFx.userData.baseScale = scale;
  }

  // --- raycasting -----------------------------------------------------------

  _ndcFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _raycastFloor(e) {
    this._ndcFromEvent(e);
    _ray.setFromCamera(_mouse, this.camera);
    return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
  }

  _buildRayTargets() {
    const targets = [];
    for (const m of this.world.machines) m.group.traverse(c => { if (c.isMesh) targets.push(c); });
    for (const t of this.world.tables) t.group.traverse(c => { if (c.isMesh) targets.push(c); });
    for (const p of this.world.props) p.group.traverse(c => { if (c.isMesh) targets.push(c); });
    this._rayTargetsCache = targets;
    return targets;
  }

  _pickObject(e) {
    this._ndcFromEvent(e);
    _ray.setFromCamera(_mouse, this.camera);
    const targets = this._rayTargetsCache || this._buildRayTargets();
    const hits = _ray.intersectObjects(targets, false);
    if (!hits.length) return null;
    const hitObj = hits[0].object;
    for (let i = 0; i < this.world.machines.length; i++) {
      if (this._isDescendant(hitObj, this.world.machines[i].group))
        return { type: 'machine', index: i, obj: this.world.machines[i].group, data: this.world.machines[i] };
    }
    for (let i = 0; i < this.world.tables.length; i++) {
      if (this._isDescendant(hitObj, this.world.tables[i].group))
        return { type: 'table', index: i, obj: this.world.tables[i].group, data: this.world.tables[i] };
    }
    for (let i = 0; i < this.world.props.length; i++) {
      if (this._isDescendant(hitObj, this.world.props[i].group))
        return { type: 'prop', index: i, obj: this.world.props[i].group, data: this.world.props[i] };
    }
    return null;
  }

  _isDescendant(obj, ancestor) {
    for (let p = obj; p; p = p.parent) if (p === ancestor) return true;
    return false;
  }

  _isSame(a, b) {
    return a && b && a.type === b.type && a.index === b.index;
  }

  // --- hover ----------------------------------------------------------------

  _clearHover() {
    this._restoreMeshes(this._glowMeshes);
    this._glowMeshes = [];
    this._glowT = 0;
    this.hovered = null;
    if (!this.moveMode) this.canvas.style.cursor = '';
  }

  _setHover(info) {
    if (this._isSame(this.hovered, info)) return;
    this._restoreMeshes(this._glowMeshes);
    this._glowMeshes = [];
    this._glowT = 0;
    this.hovered = info;
    if (!info || this._isSame(info, this.selected)) return;
    this._glowMeshes = this._collectMeshes(info.obj);
    if (!this.moveMode) this.canvas.style.cursor = 'pointer';
  }

  // --- select / deselect (IDLE state) ---------------------------------------

  select(info) {
    if (this.moveMode) this.cancelMove();
    this._clearSelectGlow();
    this._clearHover();
    this.selected = info;
    if (info) this._applySelectGlow(info.obj);
    this._emitSelect();
  }

  deselect() {
    if (!this.selected) return;
    if (this.moveMode) this.cancelMove();
    this._clearSelectGlow();
    this.selected = null;
    this._emitSelect();
  }

  _emitSelect() {
    if (this.onSelect) this.onSelect(this.getInfo(), this._clickScreenPos);
  }

  _syncSelectRing() {
    // no-op: selection now uses emissive glow, not a ring
  }

  // --- MOVING state ---------------------------------------------------------

  enterMoveMode(initialEvent) {
    if (!this.selected || this.moveMode) return;
    this.moveMode = true;
    this._savedPos = {
      x: this.selected.obj.position.x,
      z: this.selected.obj.position.z,
      ry: this.selected.obj.rotation.y
    };
    this._placementValid = true;
    this.canvas.style.cursor = 'none';
    this._clearHover();
    // blue move glow on the item being moved
    this._moveGlowMeshes = this._collectMeshes(this.selected.obj);
    this._emitSelect();
    // snap item to current cursor position so it doesn't sit at (0,0)
    if (initialEvent) {
      this._onMove(initialEvent);
    }
  }

  cancelMove() {
    if (!this.moveMode || !this.selected) return;
    if (this._savedPos) {
      this.selected.obj.position.x = this._savedPos.x;
      this.selected.obj.position.z = this._savedPos.z;
      this.selected.obj.rotation.y = this._savedPos.ry;
      this.selected.data.pos.set(this._savedPos.x, 0, this._savedPos.z);
      this._updateUsePos(this.selected);
    }
    this._restoreMeshes(this._moveGlowMeshes || []);
    this._moveGlowMeshes = [];
    this._finishMove();
  }

  confirmMove() {
    if (!this.moveMode || !this.selected) return;
    if (!this._placementValid) {
      this._rejectFlash = 0.3;
      if (this.onPlacementRejected) this.onPlacementRejected(this._placementReason);
      return;
    }
    const px = this.selected.obj.position.x;
    const pz = this.selected.obj.position.z;
    const sc = this.selected.type === 'table' ? 2.0 : this.selected.type === 'prop' ? Math.max(this.selected.data.hw, this.selected.data.hd) * 1.1 : 1.0;
    // start green confirm glow on the placed item
    this._confirmGlowMeshes = this._moveGlowMeshes || this._collectMeshes(this.selected.obj);
    this._confirmGlowTimer = 0;
    this._moveGlowMeshes = [];
    this._finishMove();
    if (this.onChange) this.onChange();
  }

  _finishMove() {
    this.moveMode = false;
    this._savedPos = null;
    this._placementValid = true;
    this._placementReason = null;
    this.validRing.visible = false;
    this.canvas.style.cursor = '';
    this._syncSelectRing();
    this._emitSelect();
  }

  // --- collision detection --------------------------------------------------

  _getItemFootprint(item) {
    if (item.type === 'prop') return { hw: item.data.hw, hd: item.data.hd };
    return FOOTPRINT[item.type] || FOOTPRINT.machine;
  }

  _getRotatedFootprint(fp, ry) {
    const turns = Math.round(ry / (Math.PI / 2)) & 3;
    return (turns === 1 || turns === 3) ? { hw: fp.hd, hd: fp.hw } : fp;
  }

  _checkPlacement(x, z, type, skipIndex) {
    let fp = FOOTPRINT[type] || FOOTPRINT.machine;
    if (type === 'prop' && this.selected && this.selected.data) {
      fp = { hw: this.selected.data.hw, hd: this.selected.data.hd };
    }
    const ry = this.selected ? this.selected.obj.rotation.y : 0;
    fp = this._getRotatedFootprint(fp, ry);
    const PAD = 0.1;
    const hw = fp.hw + PAD;
    const hd = fp.hd + PAD;

    for (const c of this.world.colliders) {
      if (c.dynamic || c.wall) continue;
      if ((x + hw) > c.minX && (x - hw) < c.maxX &&
          (z + hd) > c.minZ && (z - hd) < c.maxZ) {
        return c.label || 'Blocked by obstacle';
      }
    }

    const W = this.world.W, D = this.world.D;
    const WALL_INSET = 0.05;
    if (x - hw < -W / 2 + WALL_INSET || x + hw > W / 2 - WALL_INSET) return 'Too close to wall';
    if (z - hd < -D / 2 + WALL_INSET || z + hd > D / 2 - WALL_INSET) return 'Too close to wall';

    for (let i = 0; i < this.world.machines.length; i++) {
      if (type === 'machine' && i === skipIndex) continue;
      const m = this.world.machines[i];
      const mfp = this._getRotatedFootprint(FOOTPRINT.machine, m.group.rotation.y);
      if (Math.abs(x - m.pos.x) < hw + mfp.hw &&
          Math.abs(z - m.pos.z) < hd + mfp.hd) return `Overlaps Machine #${i + 1}`;
    }
    for (let i = 0; i < this.world.tables.length; i++) {
      if (type === 'table' && i === skipIndex) continue;
      const t = this.world.tables[i];
      const tfp = this._getRotatedFootprint(FOOTPRINT.table, t.group.rotation.y);
      if (Math.abs(x - t.pos.x) < hw + tfp.hw &&
          Math.abs(z - t.pos.z) < hd + tfp.hd) return `Overlaps Table #${i + 1}`;
    }
    for (let i = 0; i < this.world.props.length; i++) {
      if (type === 'prop' && i === skipIndex) continue;
      const p = this.world.props[i];
      const pfp = this._getRotatedFootprint({ hw: p.hw, hd: p.hd }, p.group.rotation.y);
      if (Math.abs(x - p.pos.x) < hw + pfp.hw &&
          Math.abs(z - p.pos.z) < hd + pfp.hd) return `Overlaps ${p.name || 'Prop'}`;
    }
    return null;
  }

  // --- proximity check ------------------------------------------------------

  isPlayerNear(item) {
    if (!item) return false;
    return this.playerPos.distanceTo(item.data.pos) < (item.type === 'table' ? 5 : 3);
  }

  // --- info for UI ----------------------------------------------------------

  getInfo() {
    if (!this.selected) return null;
    const s = this.selected, d = s.data;
    const near = this.isPlayerNear(s);
    const base = {
      moveMode: this.moveMode,
      placementValid: this._placementValid,
      near,
    };
    if (s.type === 'machine') {
      const theme = s.obj.userData.theme;
      return { ...base, type: 'Slot Machine', name: `Machine #${s.index + 1}`, canInteract: false,
        stats: [
          { label: 'Theme', value: ['Ruby', 'Sapphire', 'Emerald', 'Topaz', 'Amethyst', 'Onyx'][theme % 6] },
          { label: 'Hopper', value: `$${Math.round(d.cash)}` },
          { label: 'Status', value: d.occupant ? 'In Use' : 'Idle' },
        ] };
    }
    if (s.type === 'prop') {
      return { ...base, type: d.name || 'Prop', name: d.name || `Prop #${s.index + 1}`,
        canInteract: false, stats: [] };
    }
    return { ...base, type: 'Dealer Table', name: `Table #${s.index + 1}`,
      canInteract: near && d.occupants.length > 0,
      stats: [
        { label: 'Seats', value: `${d.occupants.length}/${d.seats.length}` },
        { label: 'Hopper', value: `$${Math.round(d.cash)}` },
        { label: 'Status', value: d.occupants.length > 0 ? 'Active' : 'Empty' },
      ] };
  }

  // --- input handlers -------------------------------------------------------

  _onCtx(e) {
    if (this.moveMode) { e.preventDefault(); this.cancelMove(); }
    else if (this.selected) { e.preventDefault(); this.deselect(); }
  }

  _onDown(e) {
    if (e.button !== 0) return;
    this._handledPointer = false;

    // ---- MOVING: left-click = stamp or reject ----
    if (this.moveMode && this.selected) {
      e.preventDefault();
      e.stopPropagation();
      this._handledPointer = true;
      this.confirmMove();
      return;
    }

    // ---- IDLE: left-click = select, or pick up if already selected ----
    const picked = this._pickObject(e);
    if (picked) {
      this._handledPointer = true;
      this._clickScreenPos = { x: e.clientX, y: e.clientY };
      if (this.arrangeMode) {
        this.select(picked);
        this.enterMoveMode();
      } else if (this._isSame(picked, this.selected)) {
        this.enterMoveMode();
      } else {
        this.select(picked);
      }
    } else {
      this.deselect();
    }
  }

  _onMove(e) {
    if (!this.enabled) return;

    // ---- MOVING: object tracks cursor, clamped inside casino walls ----
    if (this.moveMode && this.selected) {
      const pt = this._raycastFloor(e);
      if (!pt) return;
      const rawFp = this._getItemFootprint(this.selected);
      const fp = this._getRotatedFootprint(rawFp, this.selected.obj.rotation.y);
      const W = this.world.W, D = this.world.D;
      const WALL_INSET = 0.05;
      const minX = -W / 2 + fp.hw + WALL_INSET;
      const maxX =  W / 2 - fp.hw - WALL_INSET;
      const minZ = -D / 2 + fp.hd + WALL_INSET;
      const maxZ =  D / 2 - fp.hd - WALL_INSET;
      const nx = snap(Math.max(minX, Math.min(maxX, pt.x)));
      const nz = snap(Math.max(minZ, Math.min(maxZ, pt.z)));
      this.selected.obj.position.x = nx;
      this.selected.obj.position.z = nz;
      this.selected.data.pos.set(nx, 0, nz);
      this._updateUsePos(this.selected);
      this._syncSelectRing();

      this._placementReason = this._checkPlacement(nx, nz, this.selected.type, this.selected.index);
      this._placementValid = this._placementReason === null;
      return;
    }

    // ---- IDLE: hover highlight ----
    const picked = this._pickObject(e);
    if (picked) this._setHover(picked);
    else this._clearHover();
  }

  _onKey(e) {
    if (this.moveMode && this.selected) {
      if (e.code === 'KeyR') {
        e.preventDefault();
        this.selected.obj.rotation.y += ROTATE_STEP * (e.shiftKey ? -1 : 1);
        this._updateUsePos(this.selected);
        this._syncSelectRing();
        this._placementReason = this._checkPlacement(
          this.selected.obj.position.x, this.selected.obj.position.z,
          this.selected.type, this.selected.index);
        this._placementValid = this._placementReason === null;
        this._emitSelect();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.cancelMove();
      }
      return;
    }
    if (!this.selected) return;
    if (e.code === 'KeyR') {
      e.preventDefault();
      this.selected.obj.rotation.y += ROTATE_STEP * (e.shiftKey ? -1 : 1);
      this._updateUsePos(this.selected);
      this._syncSelectRing();
      if (this.onChange) this.onChange();
      this._emitSelect();
    } else if (e.code === 'Escape') {
      this.deselect();
    }
  }

  // --- position helpers -----------------------------------------------------

  _updateUsePos(item) {
    if (!item || item.type === 'prop') return;
    if (item.type === 'machine') {
      const ry = item.obj.rotation.y;
      item.data.usePos.set(
        item.data.pos.x + Math.sin(ry) * 0.95, 0,
        item.data.pos.z + Math.cos(ry) * 0.95);
    } else {
      const p = item.data.pos;
      for (let i = 0; i < item.data.seats.length; i++) {
        const a = Math.PI * (0.25 + i * 0.25);
        item.data.seats[i].set(p.x + Math.cos(a) * 2.35, 0, p.z + Math.sin(a) * 1.95);
      }
      item.data.dealerSpot.set(p.x, 0, p.z + 2.0);
    }
  }

  // --- spawn outside --------------------------------------------------------

  spawnOutside(type, index) {
    if (!this.world) return;
    const item = type === 'machine' ? this.world.machines[index] : this.world.tables[index];
    if (!item) return;
    const spawnX = (Math.random() - 0.5) * 6;
    const spawnZ = this.world.D / 2 + 4 + Math.random() * 2;
    item.group.position.set(spawnX, item.group.position.y, spawnZ);
    item.pos.set(spawnX, 0, spawnZ);
    this._updateUsePos({ type, index, obj: item.group, data: item });
  }

  // --- per-frame update -----------------------------------------------------

  _projectToScreen(pos3d) {
    const v = pos3d.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-v.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }

  update(dt, time) {
    if (!this.enabled) return;
    const t = time || 0;
    // hover: gentle breathe
    if (this.hovered && this._glowMeshes.length) {
      this._glowT += dt;
      const wave = 0.5 + Math.sin(this._glowT * 4) * 0.5; // 0→1 smooth
      this._applyTint(this._glowMeshes, 0x88bbff, 0.12 + wave * 0.08, 0.06 + wave * 0.06);
    }
    // selected: steady subtle pulse
    if (this.selected && this._selectGlowMeshes.length && !this.moveMode) {
      const wave = 0.5 + Math.sin(t * 3) * 0.5;
      this._applyTint(this._selectGlowMeshes, 0x88bbff, 0.15 + wave * 0.1, 0.08 + wave * 0.07);
    }
    // moving: slightly stronger breathe
    if (this.moveMode && this._moveGlowMeshes.length) {
      const wave = 0.5 + Math.sin(t * 4.5) * 0.5;
      this._applyTint(this._moveGlowMeshes, 0x66aaff, 0.18 + wave * 0.12, 0.1 + wave * 0.08);
    }
    // placed: green flash that fades out
    if (this._confirmGlowTimer >= 0 && this._confirmGlowMeshes.length) {
      this._confirmGlowTimer += dt;
      const dur = 0.5;
      const p = Math.min(this._confirmGlowTimer / dur, 1);
      const fade = (1 - p) * (1 - p);
      this._applyTint(this._confirmGlowMeshes, 0x66ff99, fade * 0.25, fade * 0.15);
      if (p >= 1) {
        this._restoreMeshes(this._confirmGlowMeshes);
        this._confirmGlowMeshes = [];
        this._confirmGlowTimer = -1;
      }
    }
    // project tooltip position during move mode
    if (this.moveMode && this.selected && this.onMoveUpdate) {
      const h = this.selected.type === 'table' ? 3.5 : this.selected.type === 'prop' ? 3.8 : 3.2;
      const topPos = new THREE.Vector3(
        this.selected.obj.position.x, h,
        this.selected.obj.position.z
      );
      const sp = this._projectToScreen(topPos);
      this.onMoveUpdate(sp.x, sp.y, this._placementValid, this._placementReason);
    }
  }

  // --- layout save/load -----------------------------------------------------

  getLayout() {
    return {
      machines: this.world.machines.map(m => ({ x: m.group.position.x, z: m.group.position.z, ry: m.group.rotation.y })),
      tables: this.world.tables.map(t => ({ x: t.group.position.x, z: t.group.position.z, ry: t.group.rotation.y })),
      props: this.world.props.map(p => ({ name: p.name, x: p.group.position.x, z: p.group.position.z, ry: p.group.rotation.y })),
    };
  }

  applyLayout(layout) {
    if (!layout) return;
    if (layout.machines) {
      for (let i = 0; i < Math.min(layout.machines.length, this.world.machines.length); i++) {
        const s = layout.machines[i], m = this.world.machines[i];
        m.group.position.set(s.x, m.group.position.y, s.z);
        m.group.rotation.y = s.ry;
        m.pos.set(s.x, 0, s.z);
        m.usePos.set(s.x + Math.sin(s.ry) * 0.95, 0, s.z + Math.cos(s.ry) * 0.95);
      }
    }
    if (layout.tables) {
      for (let i = 0; i < Math.min(layout.tables.length, this.world.tables.length); i++) {
        const s = layout.tables[i], t = this.world.tables[i];
        t.group.position.set(s.x, t.group.position.y, s.z);
        t.group.rotation.y = s.ry;
        t.pos.set(s.x, 0, s.z);
        for (let j = 0; j < t.seats.length; j++) {
          const a = Math.PI * (0.25 + j * 0.25);
          t.seats[j].set(s.x + Math.cos(a) * 2.35, 0, s.z + Math.sin(a) * 1.95);
        }
        t.dealerSpot.set(s.x, 0, s.z + 2.0);
      }
    }
    if (layout.props) {
      for (const saved of layout.props) {
        const p = this.world.props.find(wp => wp.name === saved.name);
        if (!p) continue;
        p.group.position.set(saved.x, p.group.position.y, saved.z);
        p.group.rotation.y = saved.ry;
        p.pos.set(saved.x, 0, saved.z);
      }
    }
  }

  rotate() {
    if (!this.selected) return;
    this.selected.obj.rotation.y += ROTATE_STEP;
    this._updateUsePos(this.selected);
    this._syncSelectRing();
    if (this.moveMode) {
      this._placementReason = this._checkPlacement(
        this.selected.obj.position.x, this.selected.obj.position.z,
        this.selected.type, this.selected.index);
      this._placementValid = this._placementReason === null;
    } else if (this.onChange) {
      this.onChange();
    }
    this._emitSelect();
  }
}
