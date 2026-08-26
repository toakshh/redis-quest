// The 3D mode's own runtime (Law L6: this module creates its OWN engine —
// it never accepts one as a parameter, and never touches the 2D App.jsx
// singleton). Everything the sim layer needs — the Redis engine, an event
// bus, a seeded rng, an injected clock — comes from here as one bundle, so
// a fresh, isolated world can be created for a new game, a replay, or a
// headless test with a single call.

import { createEngine } from '../engine/engine.js'
import { EventBus } from '../engine/EventBus.js'
import { createRng } from '../engine/rng.js'

let seedCounter = 0

function generateSeed() {
  seedCounter += 1
  return `seed-${Date.now()}-${seedCounter}`
}

export function createRuntime({ seed = null, memoryLimit = 64 * 1024 * 1024, now = null } = {}) {
  const resolvedSeed = seed ?? generateSeed()
  const clock = now ?? Date.now

  const engine = createEngine({ seed: resolvedSeed, memoryLimit, now: now ?? null })
  const bus = new EventBus({ logSize: 500 })
  const rng = createRng(resolvedSeed)

  // String-form emit(type, payload) fires BOTH the simple `.on(type, fn)`
  // handlers (receiving the raw payload, same shape as engine.on('command', ...)
  // elsewhere in the codebase) AND the normalized-event wildcard/pattern
  // subscribers. The object form `emit({type, payload, source})` reaches only
  // the latter, so it is deliberately not used here.
  const unsubCommand = engine.on('command', (payload) => {
    bus.emit('redis:command', payload)
  })
  const unsubExpired = engine.on('expired', (payload) => {
    bus.emit('redis:expired', payload)
  })

  function dispose() {
    unsubCommand()
    unsubExpired()
    bus.clear()
  }

  return Object.freeze({
    engine,
    bus,
    rng,
    seed: resolvedSeed,
    clock,
    dispose,
  })
}
