// ReplayHarness — runs the whole simulation headlessly and deterministically.
// Given a seed and an input log it builds its OWN runtime (Law: 3D mode never
// borrows the 2D engine), wires the full Phase-2 system stack in fixed order,
// replays the inputs tick-for-tick, and reports a state hash. Two runs with
// the same seed + inputs MUST return the same hash — that guarantee is what
// makes replays, bug reports, and balance testing possible.
//
// No DOM, no three.js, no react, no wall-clock: time is a pure function of the
// tick counter, so the run is reproducible on any machine.

import { createRuntime } from '../../bootstrap.js'
import { createSimWorld } from '../SimWorld.js'
import { createRedisActionBridge } from '../redis/RedisActionBridge.js'
import { createMovementSystem } from '../systems/MovementSystem.js'
import { createAISystem } from '../systems/AISystem.js'
import { createCombatSystem } from '../systems/CombatSystem.js'
import { createTtlLifeSystem } from '../systems/TtlLifeSystem.js'
import { createMemoryPressureSystem } from '../systems/MemoryPressureSystem.js'
import { createLatencySystem } from '../systems/LatencySystem.js'
import { createObjectiveSystem } from '../systems/ObjectiveSystem.js'
import { FLAGS } from '../entity/EntityStore.js'

const DT = 1 / 60
const DT_MS = 1000 / 60
const PLAYER_KEY = 'session:7742'

// Normalize inputs into a Map<tick, intent[]>. Accepts either a raw array of
// { tick, intent } or anything exposing entries() (an InputLog).
function indexInputs(inputs) {
  const byTick = new Map()
  if (!inputs) return byTick
  // Accept a raw array as-is; only call entries() on non-array sources (an
  // InputLog). Native arrays ALSO expose .entries(), but that yields
  // [index, value] pairs — not what we want — so array must be checked first.
  const list = Array.isArray(inputs)
    ? inputs
    : typeof inputs.entries === 'function' ? inputs.entries() : inputs
  for (const { tick, intent } of list) {
    let arr = byTick.get(tick)
    if (arr === undefined) { arr = []; byTick.set(tick, arr) }
    arr.push(intent)
  }
  return byTick
}

export function runHeadless({ seed, inputs, ticks = 0, entities = 8, objectives = [] } = {}) {
  // Deterministic clock: advances one fixed step per tick, no Date.now.
  let simMs = 0
  const now = () => simMs

  const runtime = createRuntime({ seed, now })
  const world = createSimWorld({ runtime, seed, clock: now })

  const bridge = createRedisActionBridge()
  world.addSystem(bridge)
  world.addSystem(createMovementSystem())
  world.addSystem(createAISystem())
  world.addSystem(createCombatSystem())
  world.addSystem(createTtlLifeSystem({ playerKey: PLAYER_KEY }))
  world.addSystem(createMemoryPressureSystem())
  world.addSystem(createLatencySystem())
  world.addSystem(createObjectiveSystem({ objectives }))

  // Give the player a life clock so the spine mechanic is live during replay.
  runtime.engine.execute(`SET ${PLAYER_KEY} alive PX 600000`)

  // Seed the world with hostile entities at rng-derived positions. Because rng
  // is seeded, identical seeds produce identical starting states — and DIFFERENT
  // seeds produce different ones, which is what the divergence test checks.
  const cap = world.entities.capacity
  const n = Math.min(entities, cap)
  for (let i = 0; i < n; i++) {
    const x = (world.rng() * 2 - 1) * 20
    const z = (world.rng() * 2 - 1) * 20
    const id = world.entities.spawn(1, x, 0, z)
    if (id === -1) break
    world.entities.flags[id] = FLAGS.HOSTILE
    world.entities.health[id] = 100
    world.entities.maxHealth[id] = 100
  }

  const byTick = indexInputs(inputs)

  // Track ending + beats via the bus.
  let ending = null
  const passedObjectives = new Set()
  world.bus.on('sim:playerExpired', () => { if (ending === null) ending = 'expired' })
  world.bus.on('sim:objectiveChanged', (p) => {
    if (p.passed) passedObjectives.add(p.id)
  })

  for (let i = 0; i < ticks; i++) {
    // Inputs are scheduled against the tick number they were recorded at.
    const scheduled = byTick.get(world.tick + 1)
    if (scheduled) for (const intent of scheduled) bridge.enqueue(intent)

    simMs += DT_MS
    world.step(DT)

    if (ending === null && world.objectivesComplete && objectives.length > 0) {
      ending = 'complete'
    }
  }

  runtime.dispose()

  return {
    stateHash: world.stateHash(),
    beatsPlayed: passedObjectives.size,
    ending,
    tick: world.tick,
  }
}
