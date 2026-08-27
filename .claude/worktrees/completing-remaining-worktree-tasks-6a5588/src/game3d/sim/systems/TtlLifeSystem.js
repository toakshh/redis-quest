// TtlLifeSystem — the spine mechanic (plan §6.4). The player *is* a Redis key
// with a TTL: as long as session:7742 has time left, the player is alive, and
// the remaining time IS the health bar. Let it hit zero and the run ends.
//
// Sim layer: no three.js, no react, no DOM. The PTTL read is silent so it
// never counts as a player command or awards feedback.

import { SYSTEM_ORDER } from '../SimWorld.js'

export function createTtlLifeSystem({
  playerKey = 'session:7742',
  intervalTicks = 6,
  maxTtlMs = 60_000,
} = {}) {
  let expired = false

  return {
    name: 'ttl-life',
    order: SYSTEM_ORDER.TTL_LIFE,
    playerKey,

    update(world) {
      // Sample the player's remaining lifetime only every N ticks — PTTL is
      // cheap but there is no reason to poll it 60×/second.
      if (world.tick % intervalTicks !== 0) return

      const reply = world.engine.silentExecute('PTTL', playerKey)
      const ms = typeof reply.value === 'number' ? reply.value : -2

      let health01
      if (ms === -1) {
        // No expiry set → the player is not on a clock yet: treat as full.
        health01 = 1
      } else if (ms <= 0) {
        // -2 (key gone) or 0 remaining → dead.
        health01 = 0
      } else {
        health01 = Math.min(1, ms / maxTtlMs)
      }

      world.playerHealth01 = health01
      world.playerTtlMs = ms

      if (health01 <= 0 && !expired) {
        expired = true
        world.bus.emit('sim:playerExpired', { key: playerKey })
      } else if (health01 > 0) {
        // Player was revived (a new SET/EXPIRE) — re-arm the death latch.
        expired = false
      }
    },
  }
}
