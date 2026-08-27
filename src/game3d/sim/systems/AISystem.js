// AISystem — a per-entity finite state machine for hostile archetypes.
// Sim layer: no three.js, no react, no DOM, no allocation in the hot loop.
//
// States are integers (not strings) so they live in the entity store's
// Uint8 `state` array and cost nothing to compare. `stateTime` accumulates
// the seconds spent in the current state and resets to 0 on every transition.
// Targeting is done through the spatial hash's queryNearest — the AI never
// scans the whole entity list.

import { SYSTEM_ORDER } from '../SimWorld.js'
import { FLAGS } from '../entity/EntityStore.js'

export const AI_STATE = Object.freeze({
  IDLE: 0,
  PATROL: 1,
  ALERT: 2,
  CHASE: 3,
  ATTACK: 4,
  FLEE: 5,
  DYING: 6,
})

// Default sensing rings (metres) and the health fraction below which an
// entity breaks and flees. Overridable per system instance.
const DEFAULTS = {
  alertRadius: 12,
  chaseRadius: 9,
  attackRadius: 1.6,
  fleeHealthFraction: 0.25,
  chaseSpeed: 3.5,
}

export function createAISystem(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts }

  // Reusable filter state so queryNearest's predicate allocates nothing.
  let selfId = -1
  let hostileArr = null
  function preyFilter(id) {
    // A valid target is not the searcher and is not itself hostile — the
    // player and other prey are hostile-flag-free.
    return id !== selfId && (hostileArr[id] & FLAGS.HOSTILE) === 0
  }

  return {
    name: 'ai',
    order: SYSTEM_ORDER.AI,
    update(world, dt) {
      const e = world.entities
      const { alive, posX, posZ, velX, velZ, health, maxHealth, state, stateTime, flags } = e
      hostileArr = flags

      for (let id = 0; id < e.capacity; id++) {
        if (alive[id] === 0) continue
        if ((flags[id] & FLAGS.HOSTILE) === 0) continue

        stateTime[id] += dt
        const prevState = state[id]
        let next = prevState

        // Death overrides everything and is terminal.
        if (health[id] <= 0) {
          next = AI_STATE.DYING
        } else if (next === AI_STATE.DYING) {
          // already dying but somehow healed — fall through to normal logic
          next = AI_STATE.IDLE
        }

        if (next !== AI_STATE.DYING) {
          const hurt = maxHealth[id] > 0 && health[id] / maxHealth[id] <= cfg.fleeHealthFraction
          selfId = id
          const target = world.hash.queryNearest(posX[id], posZ[id], cfg.alertRadius, preyFilter)

          if (hurt) {
            next = AI_STATE.FLEE
          } else if (target === -1) {
            next = AI_STATE.PATROL
          } else {
            const dx = posX[target] - posX[id]
            const dz = posZ[target] - posZ[id]
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist <= cfg.attackRadius) {
              next = AI_STATE.ATTACK
            } else if (dist <= cfg.chaseRadius) {
              next = AI_STATE.CHASE
              // Steer toward the target; MovementSystem integrates + damps.
              const inv = dist > 0 ? cfg.chaseSpeed / dist : 0
              velX[id] = dx * inv
              velZ[id] = dz * inv
            } else {
              next = AI_STATE.ALERT
            }
          }

          if (next === AI_STATE.FLEE && target !== -1) {
            // Run directly away from the threat.
            const dx = posX[id] - posX[target]
            const dz = posZ[id] - posZ[target]
            const dist = Math.sqrt(dx * dx + dz * dz)
            const inv = dist > 0 ? cfg.chaseSpeed / dist : 0
            velX[id] = dx * inv
            velZ[id] = dz * inv
          }
        }

        state[id] = next
        if (next !== prevState) stateTime[id] = 0
      }
    },
  }
}
