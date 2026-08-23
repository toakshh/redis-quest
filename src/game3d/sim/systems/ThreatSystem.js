// ThreatSystem — the thing that makes hostiles matter. When an enemy reaches
// the player it does not subtract from an abstract health bar: it burns time
// off the player's Redis key. Damage is a PEXPIRE. Healing is a PEXPIRE. The
// health bar and the TTL are the same number, which is the whole teaching
// conceit of Protocol Zero (plan §6.4).
//
// Sim layer: no three.js, no react, no DOM. Uses the engine's silentExecute so
// these internal writes never count as player commands or award feedback.

import { SYSTEM_ORDER } from '../SimWorld.js'
import { FLAGS } from '../entity/EntityStore.js'
import { ARCHETYPE, ARCHETYPE_STATS } from '../entity/archetypes.js'

// Milliseconds of session life burned per second of contact, per attacker.
const DRAIN_MS_PER_SECOND = 2600

export function createThreatSystem({
  playerKey = 'session:7742',
  contactRadius = 1.7,
  intervalTicks = 6,
} = {}) {
  // Scratch buffer for spatial queries, allocated once (Law L10).
  const near = new Int32Array(64)

  return {
    name: 'threat',
    order: SYSTEM_ORDER.COMBAT,
    contactRadius,

    update(world, dt) {
      if (world.tick % intervalTicks !== 0) return

      const playerId = world.playerId
      if (playerId == null || playerId < 0) return
      const e = world.entities
      if (e.alive[playerId] === 0) return

      const px = e.posX[playerId]
      const pz = e.posZ[playerId]
      const count = world.hash.queryRadius(px, pz, contactRadius, near)

      // Sum the pressure from every attacker in contact, weighted by how
      // hard that archetype hits. Being cornered by three crawlers should
      // cost meaningfully more than brushing one.
      let weight = 0
      for (let i = 0; i < count; i++) {
        const id = near[i]
        if (id === playerId) continue
        if (e.alive[id] === 0) continue
        if ((e.flags[id] & FLAGS.HOSTILE) === 0) continue
        if (e.health[id] <= 0) continue
        const stats = ARCHETYPE_STATS[e.archetype[id]]
        weight += stats ? stats.touchDamage : 1
      }

      world.contactWeight = weight
      if (weight === 0) return

      // dt here is one tick's worth; scale by the sampling interval so the
      // drain rate is independent of how often we sample.
      const seconds = dt * intervalTicks
      const drain = Math.round(DRAIN_MS_PER_SECOND * weight * seconds)
      if (drain <= 0) return

      const reply = world.engine.silentExecute('PTTL', playerKey)
      const ms = typeof reply.value === 'number' ? reply.value : -2
      if (ms <= 0) return // already dead or unkeyed — TtlLifeSystem owns that

      const next = Math.max(0, ms - drain)
      if (next === 0) {
        // Let the key actually expire rather than sitting at 0ms forever.
        world.engine.silentExecute('DEL', playerKey)
      } else {
        world.engine.silentExecute('PEXPIRE', playerKey, String(next))
      }

      world.bus.emit('sim:playerHit', { drainMs: drain, attackers: weight, remainingMs: next })
    },
  }
}

export { DRAIN_MS_PER_SECOND, ARCHETYPE }
