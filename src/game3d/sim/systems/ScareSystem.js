import { SYSTEM_ORDER } from '../SimWorld.js'
import { createScareDirector } from '../horror/ScareDirector.js'
import { SCARE_TYPES } from '../horror/scareTypes.js'
import { evaluateFairness } from '../horror/scareFairness.js'

export function createScareSystem() {
  let scareDirector = null
  let initialized = false

  return {
    name: 'scare',
    order: SYSTEM_ORDER.SCARE,
    get scareDirector() { return scareDirector },

    update(world, dt) {
      if (!world.scareEvents) {
        world.scareEvents = []
      }
      world.scareEvents.length = 0

      if (!scareDirector) {
        scareDirector = createScareDirector({ rng: world.rng })
      }

      const clockMs = world.clock()
      
      // We rely on DirectorSystem having set world.ambientTension (SCARE runs after DIRECTOR)
      const tension = world.ambientTension || 'Low'

      if (!initialized) {
        scareDirector.start(clockMs, tension)
        initialized = true
      }

      // Check context fits (e.g., if reliefWindow, favor T7)
      const contextFits = {}
      if (world.reliefWindow) {
        contextFits['T7'] = 10.0 // highly favor relief punish if in a relief window
      } else {
        contextFits['T7'] = 0.0
      }

      // If in debrief, pass 'Debrief' as tension
      const finalTension = world.objectivesComplete ? 'Debrief' : tension

      const checkFairness = (candidate, timeMs) => {
        const timeSincePreciseInput = world.lastCommandMs ? (timeMs - world.lastCommandMs) : 10000
        const context = {
          timeSincePreciseInput,
          isPressureTest: false,
          recentScares: world.recentScares || [],
          inDebrief: world.objectivesComplete
        }
        return evaluateFairness(candidate, context)
      }

      const scare = scareDirector.update(clockMs, finalTension, SCARE_TYPES, contextFits, checkFairness)
      
      if (scare) {
        if (!world.recentScares) {
          world.recentScares = []
        }
        world.recentScares.push(scare.id)
        if (world.recentScares.length > 3) {
          world.recentScares.shift()
        }

        world.scareEvents.push({
          type: 'scare',
          scareDef: scare,
          soundId: scare.audioCue || 'sfx_lunge',
          intensity: world.directorStress || 0.5
        })
        world.scareFlash = 0.5 // visual flash duration in seconds
      }

      // Decay scare flash
      if (world.scareFlash !== undefined && world.scareFlash > 0) {
        world.scareFlash -= dt
        if (world.scareFlash < 0) world.scareFlash = 0
      }
    }
  }
}
