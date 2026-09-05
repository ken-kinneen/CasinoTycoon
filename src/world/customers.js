// Customers: spawned by walk-in traffic or successful ad cards, walk in through
// the door, find a machine or table seat, spend money into the hopper, and leave.
import * as THREE from 'three';
import { makeCustomer, animatePerson, applyDifficultyTint } from './people.js';

export const TYPE_INFO = {
  drunk:   { label: 'Drunk',   spend: 1.2, margin: 8, bet: 60,  speed: 1.2 },
  regular: { label: 'Regular', spend: 1.0, margin: 5, bet: 100, speed: 1.6 },
  sharp:   { label: 'Sharp',   spend: 0.7, margin: 2, bet: 200, speed: 1.8 },
  whale:   { label: 'Whale',   spend: 4.0, margin: 4, bet: 800, speed: 1.3 },
};

export const DIFFICULTY_TIERS = {
  easy:   { label: 'Easy',   color: '#3ddc84', dealerMarginMul: 1.0, dealerSpeedMul: 1.0, betMul: 0.6, channelMul: 1.4, stayMul: 1.2 },
  medium: { label: 'Medium', color: '#f5c542', dealerMarginMul: 0.7, dealerSpeedMul: 1.0, betMul: 1.0, channelMul: 1.0, stayMul: 1.0 },
  hard:   { label: 'Hard',   color: '#ff4d5e', dealerMarginMul: 0.4, dealerSpeedMul: 1.0, betMul: 1.8, channelMul: 0.65, stayMul: 0.8 },
};

const DIFFICULTY_WEIGHTS = {
  drunk:   { easy: 0.70, medium: 0.25, hard: 0.05 },
  regular: { easy: 0.40, medium: 0.45, hard: 0.15 },
  sharp:   { easy: 0.05, medium: 0.35, hard: 0.60 },
  whale:   { easy: 0.05, medium: 0.40, hard: 0.55 },
};

export function rollDifficulty(type) {
  const w = DIFFICULTY_WEIGHTS[type];
  const r = Math.random();
  if (r < w.easy) return 'easy';
  if (r < w.easy + w.medium) return 'medium';
  return 'hard';
}

export class CustomerManager {
  constructor(scene, world, game, effects) {
    this.scene = scene; this.world = world; this.game = game; this.effects = effects;
    this.customers = [];
    this.pending = 0;          // customers queued by ad cards
    this.pendingTimer = 0;
    this.arrivalAcc = 0;
    this.events = [];
  }

  get count() { return this.customers.length; }

  rollType() {
    const st = this.game.stats;
    const r = Math.random();
    const whale = Math.min(0.4, st.prestige / 250);
    if (r < whale) return 'whale';
    const sharp = st.sharpness * 0.35;
    if (r < whale + sharp) return 'sharp';
    const drunk = (1 - st.sharpness) * 0.6;
    if (r < whale + sharp + drunk) return 'drunk';
    return 'regular';
  }

  /** Queue customers who accepted an ad card. */
  queue(n) { this.pending += n; }

  clearAll() {
    for (const c of this.customers) this.scene.remove(c.group);
    this.customers = [];
    this.pending = 0;
  }

  spawn() {
    const w = this.world;
    if (!w.freeMachine() && !w.freeTableSeat()) return false;
    const type = this.rollType();
    const difficulty = rollDifficulty(type);
    const group = makeCustomer(type);
    applyDifficultyTint(group, difficulty);
    group.position.copy(w.spawnPoint);
    group.position.x += (Math.random() - 0.5) * 3;
    this.scene.add(group);
    const c = {
      group, type, difficulty, info: TYPE_INFO[type],
      state: 'entering', path: [], seat: null, machine: null, table: null,
      useTimer: 0, walkT: Math.random() * 10, stuck: 0,
      speed: TYPE_INFO[type].speed * (0.85 + Math.random() * 0.3),
    };
    c.path = [w.doorOutside.clone(), w.doorInside.clone()];
    this.customers.push(c);
    this.game.s.lifetimeCustomers++;
    this.game.emit('customer', { type, count: this.customers.length });
    return true;
  }

  findSpot(c) {
    const w = this.world;
    // whales and sharps prefer tables, others prefer machines
    const preferTable = (c.type === 'whale' || c.type === 'sharp') ? Math.random() < 0.7 : Math.random() < 0.25;
    let table = preferTable ? w.freeTableSeat() : null;
    let machine = !table ? w.freeMachine() : null;
    if (!table && !machine) table = w.freeTableSeat();
    if (table) {
      const seat = table.seats[table.occupants.length];
      table.occupants.push(c);
      c.table = table; c.seat = seat; c.spent = 0;
      c.path = w.pathTo(c.group.position, seat, table.aisleZ);
      return true;
    }
    if (machine) {
      machine.occupant = c;
      c.machine = machine; c.spent = 0;
      c.path = w.pathTo(c.group.position, machine.usePos, machine.aisleZ);
      return true;
    }
    return false;
  }

  leave(c) {
    const w = this.world;
    const aisle = c.machine ? c.machine.aisleZ : c.table ? c.table.aisleZ : w.aisleZ;
    if (c.spent > 0 && this.effects) this.effects.float(c.group.position.x, 2.1, c.group.position.z, `+$${Math.round(c.spent)}`, c.type === 'whale' ? '#ffd700' : '#3cb371', c.type === 'whale' ? 1.4 : 1);
    if (c.machine) { c.group.position.y = 0; c.machine.occupant = null; c.machine = null; }
    if (c.table) { c.table.occupants = c.table.occupants.filter(o => o !== c); c.table = null; }
    c.state = 'leaving';
    c.path = w.pathOut(c.group.position, aisle);
  }

  update(dt) {
    const st = this.game.stats;
    const w = this.world;

    // ---- arrivals ------------------------------------------------------------
    this.arrivalAcc += dt * st.trafficPerMin / 60;
    if (this.arrivalAcc >= 1) { this.arrivalAcc -= 1; this.spawn(); }
    if (this.pending > 0) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) { this.pendingTimer = 0.6; if (this.spawn()) this.pending--; else this.pending = 0; }
    }

    // ---- per customer -------------------------------------------------------------
    const spendPerSec = st.spendPerMin / 60 * st.houseEdge;
    let totalHopper = 0;
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      const g = c.group;
      const u = g.userData;

      if (c.path.length) {
        const target = c.path[0];
        const dx = target.x - g.position.x, dz = target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        const step = c.speed * dt;
        if (dist <= step + 0.05) {
          g.position.x = target.x; g.position.z = target.z; c.path.shift();
        } else {
          g.position.x += dx / dist * step; g.position.z += dz / dist * step;
          g.rotation.y = Math.atan2(dx, dz);
          if (c.type === 'drunk') g.position.x += Math.sin(c.walkT * 5) * dt * 0.6;
        }
        c.walkT += dt;
        animatePerson(g, dt, { walking: true, walkT: c.walkT, drunk: c.type === 'drunk' });
        continue;
      }

      // reached the end of the current path
      if (c.state === 'entering') {
        if (this.findSpot(c)) { c.state = 'walking'; }
        else { c.stuck += dt; if (c.stuck > 8) this.leave(c); else { g.rotation.y += dt; } }
      } else if (c.state === 'walking') {
        c.state = 'using';
        c.useTimer = st.stayTime * (0.7 + Math.random() * 0.6) * (c.type === 'whale' ? 1.4 : 1) * DIFFICULTY_TIERS[c.difficulty].stayMul;
        if (c.machine) {
          g.rotation.y = Math.atan2(c.machine.pos.x - g.position.x, c.machine.pos.z - g.position.z);
          g.position.y = 0.19;
          u.legL.rotation.x = -Math.PI / 2;
          u.legR.rotation.x = -Math.PI / 2;
        } else g.lookAt(c.table.pos.x, g.position.y, c.table.pos.z);
        g.rotation.z = 0;
      } else if (c.state === 'using') {
        c.useTimer -= dt;
        c.walkT += dt;
        const hopper = c.machine || c.table;
        const room = st.hopperCap - hopper.cash;
        const spend = spendPerSec * c.info.spend * dt;
        if (room > 0) { const s = Math.min(room, spend); hopper.cash += s; this.game.s.machineCash += s; c.spent += s; }
        if (c.machine) {
          u.legL.rotation.x = -Math.PI / 2;
          u.legR.rotation.x = -Math.PI / 2;
          u.body.scale.y = 1 + Math.sin(c.walkT * 2) * 0.01;
          u.head.rotation.y = Math.sin(c.walkT * 0.7) * 0.15;
          u.armR.rotation.x = Math.sin(c.walkT * 4) > 0.6 ? -1.7 : -0.4;
          u.armL.rotation.x = -0.3;
        } else {
          animatePerson(g, dt, { walking: false, walkT: c.walkT, drunk: c.type === 'drunk' });
          u.armL.rotation.x = -0.9 + Math.sin(c.walkT * 2) * 0.2; u.armR.rotation.x = -0.7;
        }
        if (c.useTimer <= 0) this.leave(c);
      } else if (c.state === 'leaving') {
        this.scene.remove(g);
        this.customers.splice(i, 1);
      }
    }
    // update hopper visuals + total
    for (const m of w.machines) { totalHopper += m.cash; m.group.userData.cash.scale.y = Math.max(0.05, Math.min(1, m.cash / st.hopperCap) * 3); }
    for (const t of w.tables) totalHopper += t.cash || 0;
    this.game.s.machineCash = totalHopper;
  }

  /** Take everything from the hoppers (used after a cash run banks it). */
  drainHoppers(amount) {
    let remaining = amount;
    const all = [...this.world.machines, ...this.world.tables];
    for (const h of all) { const take = Math.min(h.cash || 0, remaining); h.cash = (h.cash || 0) - take; remaining -= take; if (remaining <= 0) break; }
    this.game.s.machineCash = Math.max(0, this.game.s.machineCash - (amount - remaining));
  }

  /** Customers currently sitting at tables, for the dealer game. */
  tablePlayers() { return this.customers.filter(c => c.state === 'using' && c.table); }
}
