// MemoryPressureSystem — turns the engine's memory fill level into a felt
// threat. As Redis fills, THE EVICTOR speeds up: the fuller the store, the
// less escapable the unkillable enemy. (plan §10.2)
//
// Sim layer: no three.js, no react, no DOM.

import { SYSTEM_ORDER } from '../SimWorld.js'

// Evictor speed band, in m/s: 0.6 at an empty store, 2.0 at full.
const BASE_SPEED = 0.6
const SPEED_RANGE = 1.4

export function createMemoryPressureSystem() {
  return {
    name: 'memory-pressure',
    order: SYSTEM_ORDER.MEMORY_PRESSURE,

    update(world) {
      const engine = world.engine
      const limit = engine.memoryLimit
      const pressure = limit > 0
        ? Math.min(1, Math.max(0, engine.memoryBytes / limit))
        : 0
      world.memoryPressure = pressure
      world.evictorSpeed = BASE_SPEED + SPEED_RANGE * pressure
    },
  }
}
