// ObjectiveSystem — bridges the incident objective evaluator into the 3D sim.
// It re-evaluates the current objective set every 12 ticks (5×/second at
// 60Hz) rather than every tick, and only publishes 'sim:objectiveChanged'
// when an individual objective's pass/fail state actually flips.
//
// Sim layer: no three.js, no react, no DOM. evaluateObjectives is a pure
// function of (objectives, engine), so importing it does not break mode
// isolation — no 2D singleton is touched.

import { SYSTEM_ORDER } from '../SimWorld.js'
import { evaluateObjectives } from '../../../systems/incidents/IncidentEvaluator.js'

export function createObjectiveSystem({ objectives = [], intervalTicks = 12 } = {}) {
  // Last-seen pass state per objective id, for transition detection.
  const lastStatus = new Map()

  return {
    name: 'objective',
    order: SYSTEM_ORDER.OBJECTIVE,
    objectives,

    update(world) {
      if (world.tick % intervalTicks !== 0) return

      const { allPassed, statusMap } = evaluateObjectives(this.objectives, world.engine)
      world.objectiveStatus = statusMap
      world.objectivesComplete = allPassed

      for (const id in statusMap) {
        const passed = statusMap[id]
        if (lastStatus.get(id) !== passed) {
          lastStatus.set(id, passed)
          world.bus.emit('sim:objectiveChanged', { id, passed, allPassed })
        }
      }
    },

    // Swap the active objective set (e.g. on a new beat) and reset transition
    // tracking so the next evaluation re-announces everything.
    setObjectives(next) {
      this.objectives = next
      lastStatus.clear()
    },
  }
}
