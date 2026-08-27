// CombatSystem — resolves queued damage once per tick.
// Sim layer: no three.js, no react, no DOM. Emits events on the runtime bus.
//
// Damage is queued (never applied inline) so every hit in a tick resolves at
// the same simulation instant, in a deterministic order. Invulnerability
// frames are tracked in a pre-allocated per-entity timer array; while the
// timer is positive the entity carries FLAGS.INVULNERABLE and ignores hits.
// A landed hit sets world.hitStopUntilMs to freeze the frame briefly (juice).

import { FEEL } from '../../config/feel.js'
import { SYSTEM_ORDER } from '../SimWorld.js'
import { FLAGS, MAX_ENTITIES } from '../entity/EntityStore.js'

export function createCombatSystem({ capacity = MAX_ENTITIES, iframeSeconds = 0.5 } = {}) {
  // Pre-allocated once (Law L10). iframeTimer[id] = seconds of invuln left.
  const iframeTimer = new Float32Array(capacity)
  // Damage queue: flat parallel arrays reused across ticks, length-reset only.
  const qTarget = []
  const qAmount = []
  const qSource = []

  const system = {
    name: 'combat',
    order: SYSTEM_ORDER.COMBAT,
    iframeTimer,

    // Enqueue a damage event to be resolved on the next update().
    queueDamage(targetId, amount, sourceId = -1) {
      qTarget.push(targetId)
      qAmount.push(amount)
      qSource.push(sourceId)
    },

    update(world, dt) {
      const e = world.entities
      const { alive, health, flags } = e

      // 1. Tick down invulnerability timers, clearing the flag on expiry.
      for (let id = 0; id < e.capacity; id++) {
        if (iframeTimer[id] > 0) {
          iframeTimer[id] -= dt
          if (iframeTimer[id] <= 0) {
            iframeTimer[id] = 0
            flags[id] &= ~FLAGS.INVULNERABLE
          }
        }
      }

      // 2. Drain the damage queue.
      for (let i = 0; i < qTarget.length; i++) {
        const id = qTarget[i]
        const amount = qAmount[i]
        const source = qSource[i]
        if (alive[id] === 0) continue
        if ((flags[id] & FLAGS.INVULNERABLE) !== 0) continue
        if (amount <= 0) continue
        const before = health[id]
        health[id] = before - amount
        // Grant i-frames so the same entity can't be multi-hit this instant.
        flags[id] |= FLAGS.INVULNERABLE
        iframeTimer[id] = iframeSeconds
        // Hit-stop: freeze the frame briefly for impact weight.
        world.hitStopUntilMs = world.clock() + FEEL.impact.hitStopMs
        world.bus.emit('sim:damage', { id, amount, source, health: health[id] })
        if (before > 0 && health[id] <= 0) {
          world.bus.emit('sim:death', { id, source })
        }
      }

      // Reset the queue for the next tick without reallocating.
      qTarget.length = 0
      qAmount.length = 0
      qSource.length = 0
    },
  }

  return system
}
