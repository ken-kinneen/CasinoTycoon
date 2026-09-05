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

const FOOTPRINT = { machine: { hw: 0.6, hd: 0.6 }, table: { hw: 2.0, hd: 1.6 }, prop: { hw: 1.0, hd: 1.0 } };

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

    this.playerPos = new THREE.Vector3();
    this._clickScreenPos = { x: 0, y: 0 };

    // callbacks
    this.onSelect = null;     // (info|null, screenPos)
    this.onChange = null;      // ()
    this.onMoveUpdate = null; // (screenX, screenY, valid) — called each frame during move

    // visual indicators
    this.hoverRing = this._makeRing(0x38e8ff, 0.5, 0.08);
    this.hoverRing.visible = false;
    scene.add(this.hoverRing);

    this.selectRing = this._makeSelectRing();
    this.selectRing.visible = false;
    scene.add(this.selectRing);

    this.validRing = this._makeRing(0x44ff44, 0.6, 0.15);
    this.validRing.visible = false;
    scene.add(this.validRing);

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
    // canvas gets mousedown so it only fires on the 3D viewport
    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('contextmenu', this._onCtx);
    // mousemove on window so we track even when cursor leaves canvas
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('keydown', this._onKey);
  }

  stop() {
    if (!this.enabled) return;
    this.enabled = false;
    this.deselect();
    this._clearHover();
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('contextmenu', this._onCtx);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('keydown', this._onKey);
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

  _makeSelectRing() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.5, toneMapped: false });
    const arrows = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), arrowMat);
      const a = (i * Math.PI) / 2;
      arrow.position.set(Math.sin(a) * 1.25, 0.15, Math.cos(a) * 1.25);
      arrow.lookAt(arrow.position.clone().multiplyScalar(2));
      arrow.rotateX(Math.PI / 2);
      arrows.add(arrow);
    }
    g.add(arrows);
    g.userData = { ring, inner, arrows };
    return g;
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
    this.hovered = null;
    this.hoverRing.visible = false;
    if (!this.moveMode) this.canvas.style.cursor = '';
  }

  _setHover(info) {
    if (this._isSame(this.hovered, info)) return;
    this.hovered = info;
    if (!info || this._isSame(info, this.selected)) {
      this.hoverRing.visible = false;
      return;
    }
    this.hoverRing.visible = true;
    const s = info.type === 'table' ? 2.0 : info.type === 'prop' ? Math.max(info.data.hw, info.data.hd) * 1.1 : 1.0;
    this.hoverRing.scale.setScalar(s);
    this.hoverRing.position.set(info.obj.position.x, 0.16, info.obj.position.z);
    if (!this.moveMode) this.canvas.style.cursor = 'pointer';
  }

  // --- select / deselect (IDLE state) ---------------------------------------

  select(info) {
    if (this.moveMode) this.cancelMove();
    this.selected = info;
    this.selectRing.visible = true;
    this._syncSelectRing();
    this._emitSelect();
  }

  deselect() {
    if (!this.selected) return;
    if (this.moveMode) this.cancelMove();
    this.selected = null;
    this.selectRing.visible = false;
    this._emitSelect();
  }

  _emitSelect() {
    if (this.onSelect) this.onSelect(this.getInfo(), this._clickScreenPos);
  }

  _syncSelectRing() {
    if (!this.selected) return;
    const p = this.selected.obj.position;
    this.selectRing.position.set(p.x, 0.16, p.z);
    const sc = this.selected.type === 'table' ? 2.0 : this.selected.type === 'prop' ? Math.max(this.selected.data.hw, this.selected.data.hd) * 1.1 : 1.0;
    this.selectRing.scale.setScalar(sc);
  }

  // --- MOVING state ---------------------------------------------------------

  enterMoveMode() {
    if (!this.selected || this.moveMode) return;
    this.moveMode = true;
    this._savedPos = {
      x: this.selected.obj.position.x,
      z: this.selected.obj.position.z,
      ry: this.selected.obj.rotation.y
    };
    this._placementValid = true;
    this.canvas.style.cursor = 'none';
    this.validRing.visible = true;
    this.hoverRing.visible = false;
    this._emitSelect();
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
    this._finishMove();
  }

  confirmMove() {
    if (!this.moveMode || !this.selected || !this._placementValid) return;
    this._finishMove();
    if (this.onChange) this.onChange();
  }

  _finishMove() {
    this.moveMode = false;
    this._savedPos = null;
    this._placementValid = true;
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

  _checkPlacement(x, z, type, skipIndex) {
    let fp = FOOTPRINT[type] || FOOTPRINT.machine;
    if (type === 'prop' && this.selected && this.selected.data) {
      fp = { hw: this.selected.data.hw, hd: this.selected.data.hd };
    }
    const hw = fp.hw + 0.3;
    const hd = fp.hd + 0.3;

    for (const c of this.world.colliders) {
      if ((x + hw) > c.minX && (x - hw) < c.maxX &&
          (z + hd) > c.minZ && (z - hd) < c.maxZ) return false;
    }

    const W = this.world.W, D = this.world.D;
    if (x - hw < -W / 2 + 0.5 || x + hw > W / 2 - 0.5) return false;
    if (z - hd < -D / 2 + 0.5 || z + hd > D / 2 - 0.5) return false;

    for (let i = 0; i < this.world.machines.length; i++) {
      if (type === 'machine' && i === skipIndex) continue;
      const m = this.world.machines[i];
      if (Math.abs(x - m.pos.x) < hw + FOOTPRINT.machine.hw &&
          Math.abs(z - m.pos.z) < hd + FOOTPRINT.machine.hd) return false;
    }
    for (let i = 0; i < this.world.tables.length; i++) {
      if (type === 'table' && i === skipIndex) continue;
      const t = this.world.tables[i];
      if (Math.abs(x - t.pos.x) < hw + FOOTPRINT.table.hw &&
          Math.abs(z - t.pos.z) < hd + FOOTPRINT.table.hd) return false;
    }
    for (let i = 0; i < this.world.props.length; i++) {
      if (type === 'prop' && i === skipIndex) continue;
      const p = this.world.props[i];
      if (Math.abs(x - p.pos.x) < hw + p.hw &&
          Math.abs(z - p.pos.z) < hd + p.hd) return false;
    }
    return true;
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

    // ---- MOVING: left-click = stamp down ----
    if (this.moveMode && this.selected) {
      if (this._placementValid) this.confirmMove();
      return;
    }

    // ---- IDLE: left-click = select, or pick up if already selected ----
    const picked = this._pickObject(e);
    if (picked) {
      this._clickScreenPos = { x: e.clientX, y: e.clientY };
      if (this.arrangeMode) {
        // arrange mode: click any item to pick it up immediately
        this.select(picked);
        this.enterMoveMode();
      } else if (this._isSame(picked, this.selected)) {
        // second click on same item = pick it up
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
      const fp = this._getItemFootprint(this.selected);
      const W = this.world.W, D = this.world.D;
      const minX = -W / 2 + fp.hw + 0.5;
      const maxX =  W / 2 - fp.hw - 0.5;
      const minZ = -D / 2 + fp.hd + 0.5;
      const maxZ =  D / 2 - fp.hd - 0.5;
      const nx = snap(Math.max(minX, Math.min(maxX, pt.x)));
      const nz = snap(Math.max(minZ, Math.min(maxZ, pt.z)));
      this.selected.obj.position.x = nx;
      this.selected.obj.position.z = nz;
      this.selected.data.pos.set(nx, 0, nz);
      this._updateUsePos(this.selected);
      this._syncSelectRing();

      this._placementValid = this._checkPlacement(nx, nz, this.selected.type, this.selected.index);
      const vs = this.selected.type === 'table' ? 2.0 : this.selected.type === 'prop' ? Math.max(this.selected.data.hw, this.selected.data.hd) * 1.1 : 1.0;
      this.validRing.scale.setScalar(vs);
      this.validRing.position.set(nx, 0.18, nz);
      this.validRing.userData.ring.material.color.setHex(this._placementValid ? 0x44ff44 : 0xff4444);
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
        this._placementValid = this._checkPlacement(
          this.selected.obj.position.x, this.selected.obj.position.z,
          this.selected.type, this.selected.index);
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
    if (this.hoverRing.visible && this.hovered) {
      this.hoverRing.position.set(this.hovered.obj.position.x, 0.16, this.hovered.obj.position.z);
      this.hoverRing.userData.ring.material.opacity = 0.35 + Math.sin(t * 5) * 0.15;
    }
    if (this.selectRing.visible) {
      this._syncSelectRing();
      this.selectRing.userData.ring.material.opacity = 0.6 + Math.sin(t * 4) * 0.2;
      this.selectRing.userData.arrows.rotation.y = t * 0.5;
    }
    if (this.validRing.visible) {
      this.validRing.userData.ring.material.opacity = 0.5 + Math.sin(t * 6) * 0.2;
    }
    // project tooltip position during move mode
    if (this.moveMode && this.selected && this.onMoveUpdate) {
      const h = this.selected.type === 'table' ? 3.5 : this.selected.type === 'prop' ? 3.8 : 3.2;
      const topPos = new THREE.Vector3(
        this.selected.obj.position.x, h,
        this.selected.obj.position.z
      );
      const sp = this._projectToScreen(topPos);
      this.onMoveUpdate(sp.x, sp.y, this._placementValid);
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
      this._placementValid = this._checkPlacement(
        this.selected.obj.position.x, this.selected.obj.position.z,
        this.selected.type, this.selected.index);
    } else if (this.onChange) {
      this.onChange();
    }
    this._emitSelect();
  }
}
