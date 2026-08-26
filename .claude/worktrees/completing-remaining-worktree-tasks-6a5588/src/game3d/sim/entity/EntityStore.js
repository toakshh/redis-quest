// EntityStore — struct-of-arrays entity storage for the 3D sim.
// Sim layer: no three.js, no react, no DOM, no Date.now, no Math.random.
// All typed arrays are allocated once and never reallocated (Law L10): the
// store has a fixed capacity and hands out slots from a free list.

import { BUDGETS } from '../../config/budgets.js'

export const MAX_ENTITIES = 400

// Bitfield flags stored in the `flags` Uint16Array.
export const FLAGS = Object.freeze({
  HOSTILE: 1,
  INVULNERABLE: 2,
  TTL_BOUND: 4,
  MARKED: 8,
  BLOCKED: 16,
  STALKER: 32,
})

export function createEntityStore(capacity = MAX_ENTITIES) {
  // Free list: a stack of currently-unused slot indices. Pre-filled with every
  // slot in descending order so the first spawn hands out slot 0.
  const freeList = new Int32Array(capacity)
  for (let i = 0; i < capacity; i++) {
    freeList[i] = capacity - 1 - i
  }
  let freeTop = capacity // number of entries currently in freeList

  const store = {
    capacity,
    count: 0,
    alive: new Uint8Array(capacity),
    archetype: new Uint8Array(capacity),
    posX: new Float32Array(capacity),
    posY: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    velX: new Float32Array(capacity),
    velY: new Float32Array(capacity),
    velZ: new Float32Array(capacity),
    prevX: new Float32Array(capacity),
    prevY: new Float32Array(capacity),
    prevZ: new Float32Array(capacity),
    yaw: new Float32Array(capacity),
    health: new Float32Array(capacity),
    maxHealth: new Float32Array(capacity),
    state: new Uint8Array(capacity),
    stateTime: new Float32Array(capacity),
    ttlAt: new Float64Array(capacity),
    flags: new Uint16Array(capacity),
    keyRef: new Array(capacity).fill(null),

    spawn(archetypeIndex, x, y, z) {
      if (freeTop === 0) return -1
      freeTop -= 1
      const id = freeList[freeTop]
      this.alive[id] = 1
      this.archetype[id] = archetypeIndex
      this.posX[id] = x
      this.posY[id] = y
      this.posZ[id] = z
      this.prevX[id] = x
      this.prevY[id] = y
      this.prevZ[id] = z
      this.velX[id] = 0
      this.velY[id] = 0
      this.velZ[id] = 0
      this.yaw[id] = 0
      this.health[id] = 0
      this.maxHealth[id] = 0
      this.state[id] = 0
      this.stateTime[id] = 0
      this.ttlAt[id] = 0
      this.flags[id] = 0
      this.keyRef[id] = null
      this.count += 1
      return id
    },

    despawn(id) {
      if (this.alive[id] === 0) return
      this.alive[id] = 0
      this.keyRef[id] = null
      freeList[freeTop] = id
      freeTop += 1
      this.count -= 1
    },

    reset() {
      this.alive.fill(0)
      for (let i = 0; i < capacity; i++) {
        this.keyRef[i] = null
        freeList[i] = capacity - 1 - i
      }
      freeTop = capacity
      this.count = 0
    },

    forEachAlive(fn) {
      for (let id = 0; id < capacity; id++) {
        if (this.alive[id] === 1) fn(id)
      }
    },
  }

  return store
}

// Sanity: the exported cap must match the perf budget so tests read one source.
if (MAX_ENTITIES !== BUDGETS.sim.maxEntities) {
  throw new Error('MAX_ENTITIES must equal BUDGETS.sim.maxEntities')
}
