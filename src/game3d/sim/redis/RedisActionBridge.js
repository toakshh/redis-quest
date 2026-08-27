// RedisActionBridge — the sim's outbound gate to the Redis engine.
// Sim layer: no three.js, no react, no DOM.
//
// Player/AI actions arrive as intents (built by CommandIntent). This bridge
// drains that queue once per tick and actually executes the command lines
// against world.engine, republishing each result on the bus as
// 'sim:commandResult'. A hard cap of 8 intents per tick keeps a mash of
// inputs from blowing the redis frame budget.

import { SYSTEM_ORDER } from '../SimWorld.js'

export const MAX_INTENTS_PER_TICK = 8

export function createRedisActionBridge() {
  const queue = [] // reused; drained from the front each tick

  const bridge = {
    name: 'redis-action',
    order: SYSTEM_ORDER.REDIS,
    queue,

    // Enqueue an intent { line, toolId, targetKey } from buildIntent.
    enqueue(intent) {
      queue.push(intent)
    },

    // Execute up to MAX_INTENTS_PER_TICK intents, publishing each result.
    // Returns the number of intents processed this call.
    flush(world) {
      const limit = Math.min(queue.length, MAX_INTENTS_PER_TICK)
      for (let i = 0; i < limit; i++) {
        const intent = queue[i]
        const reply = world.engine.execute(intent.line)
        const costMs = world.engine.lastCommandCostMs
        world.bus.emit('sim:commandResult', { intent, reply, costMs })
      }
      // Drop the processed prefix; anything over the cap waits for next tick.
      queue.splice(0, limit)
      return limit
    },

    update(world) {
      this.flush(world)
    },
  }

  return bridge
}
