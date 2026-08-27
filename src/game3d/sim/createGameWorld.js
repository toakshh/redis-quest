// createGameWorld — the assembly point. Everything the sim needs to be a
// GAME rather than a pile of systems happens here: the runtime is created,
// systems are registered in their fixed order, the level's entities are
// spawned, and the opening Redis state is written.
//
// This is deliberately headless and framework-free. The R3F layer calls it
// and then only ever *reads* the resulting world — which is what lets the
// whole game loop be tested without a GPU (see createGameWorld.test.js).
//
// Sim layer: no three.js, no react, no DOM.

import { createRuntime } from '../bootstrap.js'
import { createSimWorld } from './SimWorld.js'
import { FLAGS } from './entity/EntityStore.js'
import { ARCHETYPE, ARCHETYPE_STATS } from './entity/archetypes.js'
import { createMovementSystem } from './systems/MovementSystem.js'
import { createCollisionSystem } from './systems/CollisionSystem.js'
import { createAISystem } from './systems/AISystem.js'
import { createCombatSystem } from './systems/CombatSystem.js'
import { createThreatSystem } from './systems/ThreatSystem.js'
import { createTtlLifeSystem } from './systems/TtlLifeSystem.js'
import { createMemoryPressureSystem } from './systems/MemoryPressureSystem.js'
import { createLatencySystem } from './systems/LatencySystem.js'
import { createObjectiveSystem } from './systems/ObjectiveSystem.js'
import { createDirectorSystem } from './systems/DirectorSystem.js'
import { createScareSystem } from './systems/ScareSystem.js'
import { createRedisActionBridge } from './redis/RedisActionBridge.js'
import { CH1_LEVEL } from '../content/chapters/ch1/level.js'

export const PLAYER_KEY = 'session:7742'

// The session starts with 90 seconds of life. Long enough to explore, short
// enough that the countdown is always the loudest thing in the player's head.
export const START_TTL_SECONDS = 90
export const MAX_TTL_MS = 90_000

const ARCHETYPE_BY_NAME = {
  crawler: ARCHETYPE.CRAWLER,
  stalker: ARCHETYPE.STALKER,
  resident: ARCHETYPE.RESIDENT,
}

export function createGameWorld({ seed = 'protocol-zero', level = CH1_LEVEL, now = null } = {}) {
  const runtime = createRuntime({ seed, now })
  const world = createSimWorld({ runtime, seed, clock: now ?? runtime.clock })

  // --- Opening Redis state. Written before any system runs so the very first
  // tick already sees a live session key rather than a dead player.
  const engine = runtime.engine
  engine.execute(`SETEX ${PLAYER_KEY} ${START_TTL_SECONDS} alive`)
  // MARGIT's orphaned key: exists, but with no expiry. Objective obj_ttl is
  // satisfied by giving it one — the lesson is "a key with no TTL is forever".
  engine.execute('SET margit:ledger 4417')

  // --- Systems, registered in SYSTEM_ORDER. addSystem keeps them sorted, so
  // registration order here is for readability only.
  const bridge = createRedisActionBridge()
  const movement = createMovementSystem()
  const collision = createCollisionSystem({ colliders: level.colliders })
  const ai = createAISystem()
  const combat = createCombatSystem()
  const threat = createThreatSystem({ playerKey: PLAYER_KEY })
  const ttlLife = createTtlLifeSystem({ playerKey: PLAYER_KEY, maxTtlMs: MAX_TTL_MS })
  const memoryPressure = createMemoryPressureSystem()
  const latency = createLatencySystem()
  const objectives = createObjectiveSystem({ objectives: level.objectives })
  const director = createDirectorSystem()
  const scare = createScareSystem()

  world.addSystem(bridge)
  world.addSystem(movement)
  world.addSystem(collision)
  world.addSystem(ai)
  world.addSystem(combat)
  world.addSystem(threat)
  world.addSystem(ttlLife)
  world.addSystem(memoryPressure)
  world.addSystem(latency)
  world.addSystem(objectives)
  world.addSystem(director)
  world.addSystem(scare)

  // Track damage times for the Director
  world.bus.on('sim:damage', () => {
    world.lastDamageMs = world.clock()
  })

  // Track command times for the ScareSystem / Fairness rules
  world.bus.on('sim:commandResult', () => {
    world.lastCommandMs = world.clock()
  })

  // --- Entities.
  const spawn = level.spawnPoints.find((s) => s.id === 'player_start')
  const start = spawn ? spawn.position : [0, 1, 0]
  const playerId = world.entities.spawn(ARCHETYPE.PLAYER, start[0], start[1], start[2])
  world.entities.maxHealth[playerId] = 1
  world.entities.health[playerId] = 1
  world.entities.flags[playerId] |= FLAGS.TTL_BOUND
  world.entities.keyRef[playerId] = PLAYER_KEY
  world.playerId = playerId

  // Hostile placement is jittered from the seeded rng, so two runs of the
  // same chapter are never laid out identically — the player cannot memorise
  // where the first crawler is. The jitter is small enough that the authored
  // encounter shape survives, and it comes from runtime.rng so a given seed
  // still replays exactly (the Phase 2 determinism gate).
  const SPAWN_JITTER_M = 3.5
  const enemyIds = []
  for (const def of level.enemySpawns || []) {
    const arch = ARCHETYPE_BY_NAME[def.archetype]
    if (arch === undefined) continue
    const [bx, y, bz] = def.position
    const x = bx + (runtime.rng() * 2 - 1) * SPAWN_JITTER_M
    const z = bz + (runtime.rng() * 2 - 1) * SPAWN_JITTER_M
    const id = world.entities.spawn(arch, x, y, z)
    if (id < 0) break
    const stats = ARCHETYPE_STATS[arch]
    world.entities.maxHealth[id] = stats ? stats.health : 1
    world.entities.health[id] = stats ? stats.health : 1
    world.entities.flags[id] |= FLAGS.HOSTILE
    if (arch === ARCHETYPE.STALKER) {
      // THE EVICTOR cannot be killed, only outrun. Marking it invulnerable is
      // the mechanic, not a balance shortcut (plan §9).
      world.entities.flags[id] |= FLAGS.INVULNERABLE | FLAGS.STALKER
    }
    enemyIds.push(id)
  }

  // --- Player-facing state the view reads each frame. Seeded here so the HUD
  // has real numbers on frame 1 instead of undefined.
  world.playerHealth01 = 1
  world.playerTtlMs = START_TTL_SECONDS * 1000
  world.maxTtlMs = MAX_TTL_MS
  world.memoryPressure = 0
  world.latencyP99Ms = 0
  world.contactWeight = 0
  world.objectiveStatus = {}
  world.objectivesComplete = false
  world.level = level
  // Handles the view needs every frame. Exposed on the world (rather than
  // threaded through React props) because the render layer already holds a
  // world reference and these are read-only from its side.
  world.grounded = collision.grounded
  world.combat = combat

  return {
    runtime,
    world,
    level,
    playerId,
    enemyIds,
    systems: { bridge, movement, collision, ai, combat, threat, ttlLife, memoryPressure, latency, objectives, director, scare },

    // Queue a raw Redis command line from the player. Returns nothing — the
    // result arrives on the bus as 'sim:commandResult' next tick, so the UI
    // and the sim never disagree about when a command took effect.
    submitCommand(line) {
      bridge.enqueue({ line, toolId: 'RAW', targetKey: null })
    },

    dispose() {
      runtime.dispose()
    },
  }
}
