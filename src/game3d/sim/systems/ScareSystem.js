import { SYSTEM_ORDER } from '../SimWorld.js'
import { createScareDirector } from '../horror/ScareDirector.js'
import { SCARE_TYPES } from '../horror/scareTypes.js'

export function createScareSystem() {
  const scareDirector = createScareDirector()
  let initialized = false

  return {
    name: 'scare',
    order: SYSTEM_ORDER.SCARE,
    scareDirector,

    update(world, dt) {
      if (!world.scareEvents) {
        world.scareEvents = []
      }
      world.scareEvents.length = 0

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

      const scare = scareDirector.update(clockMs, finalTension, SCARE_TYPES, contextFits)
      
      if (scare) {
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
