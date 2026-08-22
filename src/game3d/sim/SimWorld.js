// SimWorld — the deterministic heart of Protocol Zero's simulation layer.
// It owns the entity store and spatial hash, runs an ordered list of systems
// on a fixed timestep, and can hash or snapshot its entire state for replay
// verification.
//
// Sim layer laws: no three.js, no react, no DOM. Time comes only from the
// injected clock; randomness only from the seeded runtime.rng. Every system
// runs in a fixed, explicit order so the same seed + same inputs always
// produce the same stateHash.

import { hash32 } from '../../engine/rng.js'
import { createEntityStore } from './entity/EntityStore.js'
import { createSpatialHash } from './entity/spatialHash.js'

// Fixed execution order for systems. Lower numbers run first. Kept here as the
// single source of truth so a system can be slotted in by name, not guesswork.
export const SYSTEM_ORDER = Object.freeze({
  INPUT: 10,
  REDIS: 20,
  MOVEMENT: 30,
  PHYSICS_SYNC: 40,
  AI: 50,
  COMBAT: 60,
  TTL_LIFE: 70,
  MEMORY_PRESSURE: 80,
  LATENCY: 90,
  OBJECTIVE: 100,
  DIRECTOR: 110,
  SCARE: 120,
  TEACHING: 130,
})

export function createSimWorld({ runtime, seed, clock }) {
  const resolvedClock = clock ?? runtime.clock

  const world = {
    entities: createEntityStore(),
    hash: createSpatialHash(),
    tick: 0,
    timeMs: 0,
    timeScale: 1.0,
    rng: runtime.rng,
    engine: runtime.engine,
    bus: runtime.bus,
    seed: seed ?? runtime.seed,
    clock: resolvedClock,
    systems: [],

    // Register a system { name, order, update(world, dt) }, keeping the
    // systems array sorted ascending by order (stable for equal orders).
    addSystem(system) {
      let i = this.systems.length
      while (i > 0 && this.systems[i - 1].order > system.order) i--
      this.systems.splice(i, 0, system)
      return system
    },

    // Advance exactly one fixed tick. timeScale slows the dt seen by systems
    // (bullet-time in the card composer / terminal) but the tick counter
    // always increments by one so replay indexing stays integer-clean.
    step(dtSeconds) {
      const scaled = dtSeconds * this.timeScale
      this.tick += 1
      this.timeMs += scaled * 1000
      // Rebuild the broad-phase index once per tick, before systems run, so
      // every system queries positions from the end of the previous tick.
      this.hash.rebuild(this.entities)
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].update(this, scaled)
      }
    },

    // Deterministic string hash of the whole sim state. Positions and health
    // are rounded to 3 decimals BEFORE hashing — raw float noise would make
    // two mathematically-identical runs hash differently.
    stateHash() {
      let s = `t${this.tick}`
      const { posX, posY, posZ, health } = this.entities
      this.entities.forEachAlive((id) => {
        s += `|${id}:${posX[id].toFixed(3)},${posY[id].toFixed(3)},${posZ[id].toFixed(3)},${health[id].toFixed(3)}`
      })
      const keys = [...this.engine.store.keys()].sort()
      s += `|k:${keys.join(',')}`
      return hash32(s).toString(16)
    },

    // JSON-safe snapshot of the sim + engine state.
    snapshot() {
      const ents = []
      const e = this.entities
      e.forEachAlive((id) => {
        ents.push({
          id,
          archetype: e.archetype[id],
          posX: e.posX[id], posY: e.posY[id], posZ: e.posZ[id],
          velX: e.velX[id], velY: e.velY[id], velZ: e.velZ[id],
          prevX: e.prevX[id], prevY: e.prevY[id], prevZ: e.prevZ[id],
          yaw: e.yaw[id],
          health: e.health[id], maxHealth: e.maxHealth[id],
          state: e.state[id], stateTime: e.stateTime[id],
          ttlAt: e.ttlAt[id], flags: e.flags[id],
          keyRef: e.keyRef[id],
        })
      })
      return {
        tick: this.tick,
        timeMs: this.timeMs,
        timeScale: this.timeScale,
        entities: ents,
        engine: this.engine.snapshot(),
      }
    },

    // Restore a snapshot produced by snapshot(). Rebuilds the entity store
    // slot-for-slot so ids and the spatial hash stay consistent.
    restore(snap) {
      this.tick = snap.tick
      this.timeMs = snap.timeMs
      this.timeScale = snap.timeScale
      const e = this.entities
      e.reset()
      for (const ent of snap.entities) {
        const id = e.spawn(ent.archetype, ent.posX, ent.posY, ent.posZ)
        e.velX[id] = ent.velX; e.velY[id] = ent.velY; e.velZ[id] = ent.velZ
        e.prevX[id] = ent.prevX; e.prevY[id] = ent.prevY; e.prevZ[id] = ent.prevZ
        e.yaw[id] = ent.yaw
        e.health[id] = ent.health; e.maxHealth[id] = ent.maxHealth
        e.state[id] = ent.state; e.stateTime[id] = ent.stateTime
        e.ttlAt[id] = ent.ttlAt; e.flags[id] = ent.flags
        e.keyRef[id] = ent.keyRef
      }
      if (snap.engine) this.engine.restore(snap.engine)
      this.hash.rebuild(this.entities)
    },
  }

  return world
}
