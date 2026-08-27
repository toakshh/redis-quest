import { SYSTEM_ORDER } from '../SimWorld.js'
import { createDirector } from '../director/Director.js'

export function createDirectorSystem() {
  const director = createDirector()

  return {
    name: 'director',
    order: SYSTEM_ORDER.DIRECTOR,
    director,

    update(world, dt) {
      // Build context for Director
      // Needs: pttl, memoryBytes, memoryLimit, hitRatio, hostilesNear, timeSinceDamage, errorRate
      const clockMs = world.clock()
      
      const pttl = world.playerTtlMs || 0
      
      const engine = world.engine
      const memStats = typeof engine.getMemoryStats === 'function' 
        ? engine.getMemoryStats() 
        : { used: 0, limit: 1 }
      const hitRatio = typeof engine.hitRatio === 'function' ? engine.hitRatio() : 1
      const errorRate = engine.stats ? (engine.stats.errors || 0) / Math.max(1, (world.timeMs / 60000)) : 0

      // Hostiles near: count from world.contactWeight or radius
      const hostilesNear = world.contactWeight || 0

      // Damage tracking
      const timeSinceDamage = world.lastDamageMs ? clockMs - world.lastDamageMs : 10000

      const context = {
        pttl,
        memoryBytes: memStats.used,
        memoryLimit: memStats.limit,
        hitRatio,
        hostilesNear,
        timeSinceDamage,
        errorRate
      }

      director.update(clockMs, context)

      const state = director.getState()
      world.ambientTension = state.ambientTension
      world.directorStress = state.stress
      world.reliefWindow = state.reliefWindow
    }
  }
}
