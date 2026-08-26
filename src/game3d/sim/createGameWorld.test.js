// Proof that the assembled world is an actual GAME — a player who can stand
// on a floor, enemies that hunt, a life clock that runs down, commands that
// change the outcome, and objectives that notice.
//
// All headless: no GPU, no DOM. If this file passes, the game loop works and
// only the rendering is left to verify.

import { describe, it, expect } from 'vitest'
import { createGameWorld, PLAYER_KEY, START_TTL_SECONDS } from './createGameWorld.js'
import { FLAGS } from './entity/EntityStore.js'
import { ARCHETYPE } from './entity/archetypes.js'
import { AI_STATE } from './systems/AISystem.js'

const TICK = 1 / 60

// A clock we control, so "60 seconds pass" costs no wall-clock time and the
// run stays deterministic.
function fakeClock(startMs = 1_000_000) {
  let t = startMs
  const fn = () => t
  fn.advance = (ms) => { t += ms }
  return fn
}

// Step the world while keeping the injected clock in lockstep with sim time.
// The advance must be the exact fractional 16.666ms, not a truncated 16 —
// over a 90-second run that rounding loses nearly two seconds of TTL.
function run(game, clock, ticks) {
  for (let i = 0; i < ticks; i++) {
    clock.advance(TICK * 1000)
    game.world.step(TICK)
  }
}

function newGame(seed = 'test-seed') {
  const clock = fakeClock()
  const game = createGameWorld({ seed, now: clock })
  return { game, clock }
}

describe('createGameWorld — world construction', () => {
  it('spawns a player and the level’s enemies', () => {
    const { game } = newGame()
    expect(game.playerId).toBeGreaterThanOrEqual(0)
    expect(game.enemyIds.length).toBe(game.level.enemySpawns.length)
    expect(game.world.entities.alive[game.playerId]).toBe(1)
  })

  it('writes the opening Redis state before the first tick', () => {
    const { game } = newGame()
    const ttl = game.runtime.engine.execute(`TTL ${PLAYER_KEY}`)
    expect(ttl.value).toBeGreaterThan(0)
    expect(ttl.value).toBeLessThanOrEqual(START_TTL_SECONDS)
    // MARGIT's key exists but deliberately has NO expiry — that is the lesson.
    expect(game.runtime.engine.execute('TTL margit:ledger').value).toBe(-1)
  })

  it('registers every system in ascending SYSTEM_ORDER', () => {
    const { game } = newGame()
    const orders = game.world.systems.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(game.world.systems.length).toBe(12)
  })

  it('marks the stalker unkillable and the crawlers not', () => {
    const { game } = newGame()
    const e = game.world.entities
    const stalker = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.STALKER)
    const crawler = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.CRAWLER)
    expect(e.flags[stalker] & FLAGS.INVULNERABLE).toBeTruthy()
    expect(e.flags[crawler] & FLAGS.INVULNERABLE).toBeFalsy()
  })
})

describe('createGameWorld — the world is solid', () => {
  it('rests the player on the floor instead of dropping them through it', () => {
    const { game, clock } = newGame()
    run(game, clock, 120)
    // Floor top face is y = 0.5 for the ch1 shell.
    expect(game.world.entities.posY[game.playerId]).toBeCloseTo(0.5, 3)
  })

  it('keeps every enemy inside the room after a long run', () => {
    const { game, clock } = newGame()
    run(game, clock, 600)
    const e = game.world.entities
    for (const id of game.enemyIds) {
      expect(Math.abs(e.posX[id])).toBeLessThan(30)
      expect(Math.abs(e.posZ[id])).toBeLessThan(30)
      expect(e.posY[id]).toBeGreaterThan(-1)
    }
  })
})

describe('createGameWorld — hostiles hunt', () => {
  it('drives a nearby crawler into a chase state and closes the distance', () => {
    const { game, clock } = newGame()
    const e = game.world.entities
    const crawler = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.CRAWLER)

    // Put the crawler within its alert ring but outside attack range.
    e.posX[crawler] = e.posX[game.playerId] + 6
    e.posZ[crawler] = e.posZ[game.playerId]

    const before = Math.abs(e.posX[crawler] - e.posX[game.playerId])
    run(game, clock, 60)
    const after = Math.hypot(
      e.posX[crawler] - e.posX[game.playerId],
      e.posZ[crawler] - e.posZ[game.playerId],
    )

    expect([AI_STATE.CHASE, AI_STATE.ATTACK]).toContain(e.state[crawler])
    expect(after).toBeLessThan(before)
  })
})

describe('createGameWorld — TTL is the health bar', () => {
  it('drains the session as real time passes', () => {
    const { game, clock } = newGame()
    run(game, clock, 60) // one second
    const first = game.world.playerTtlMs
    run(game, clock, 600) // ten more seconds
    expect(game.world.playerTtlMs).toBeLessThan(first)
  })

  it('reports health as a 0..1 fraction the HUD can draw', () => {
    const { game, clock } = newGame()
    run(game, clock, 6)
    expect(game.world.playerHealth01).toBeGreaterThan(0)
    expect(game.world.playerHealth01).toBeLessThanOrEqual(1)
  })

  it('ends the run when the session key expires', () => {
    const { game, clock } = newGame()
    let expired = false
    game.runtime.bus.on('sim:playerExpired', () => { expired = true })

    // Blow past the full 90-second session.
    run(game, clock, 60 * (START_TTL_SECONDS + 2))

    expect(expired).toBe(true)
    expect(game.world.playerHealth01).toBe(0)
  })

  it('burns extra life when hostiles are in contact', () => {
    const e = 'contact-seed'
    const a = createGameWorld({ seed: e, now: fakeClock() })
    const b = createGameWorld({ seed: e, now: fakeClock() })

    // In run B, park two crawlers on top of the player.
    const be = b.world.entities
    const crawlers = b.enemyIds.filter((id) => be.archetype[id] === ARCHETYPE.CRAWLER).slice(0, 2)
    for (const id of crawlers) {
      be.posX[id] = be.posX[b.playerId]
      be.posZ[id] = be.posZ[b.playerId]
    }

    const clockA = fakeClock()
    const clockB = fakeClock()
    // Re-drive each with its own clock for 3 seconds.
    for (let i = 0; i < 180; i++) {
      clockA.advance(16); a.world.step(TICK)
      clockB.advance(16); b.world.step(TICK)
      // keep the crawlers glued to the player in run B
      for (const id of crawlers) {
        be.posX[id] = be.posX[b.playerId]
        be.posZ[id] = be.posZ[b.playerId]
      }
    }

    expect(b.world.contactWeight).toBeGreaterThan(0)
    expect(b.world.playerTtlMs).toBeLessThan(a.world.playerTtlMs)
  })
})

describe('createGameWorld — combat', () => {
  it('kills a crawler once enough damage lands', () => {
    const { game, clock } = newGame()
    const e = game.world.entities
    const crawler = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.CRAWLER)
    const deaths = []
    game.runtime.bus.on('sim:death', (p) => deaths.push(p))

    // Health is 3 and each hit grants i-frames, so the shots must be spread
    // across ticks — exactly as a real fire rate does.
    for (let shot = 0; shot < 4; shot++) {
      game.world.combat.queueDamage(crawler, 1, game.playerId)
      run(game, clock, 40)
    }

    expect(e.health[crawler]).toBeLessThanOrEqual(0)
    expect(deaths.some((d) => d.id === crawler)).toBe(true)
  })

  it('cannot kill THE EVICTOR — it is escaped, not fought', () => {
    const { game, clock } = newGame()
    const e = game.world.entities
    const stalker = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.STALKER)
    const before = e.health[stalker]

    for (let shot = 0; shot < 20; shot++) {
      game.world.combat.queueDamage(stalker, 5, game.playerId)
      run(game, clock, 40)
    }

    expect(e.health[stalker]).toBe(before)
  })

  it('grants i-frames so one tick of contact cannot multi-hit', () => {
    const { game, clock } = newGame()
    const e = game.world.entities
    const crawler = game.enemyIds.find((id) => e.archetype[id] === ARCHETYPE.CRAWLER)
    const before = e.health[crawler]

    // Three hits queued in the same tick: only the first should land.
    game.world.combat.queueDamage(crawler, 1, game.playerId)
    game.world.combat.queueDamage(crawler, 1, game.playerId)
    game.world.combat.queueDamage(crawler, 1, game.playerId)
    run(game, clock, 1)

    expect(e.health[crawler]).toBe(before - 1)
  })
})

describe('createGameWorld — player commands change the world', () => {
  it('executes a submitted command and reports the result on the bus', () => {
    const { game, clock } = newGame()
    const seen = []
    game.runtime.bus.on('sim:commandResult', (p) => seen.push(p))

    game.submitCommand('SET cache:manifest v1')
    run(game, clock, 2)

    expect(seen.length).toBe(1)
    expect(seen[0].reply.type).not.toBe('error')
    expect(game.runtime.engine.execute('GET cache:manifest').value).toBe('v1')
  })

  it('lets the player buy time by refreshing their own TTL', () => {
    const { game, clock } = newGame()
    run(game, clock, 60 * 30) // burn 30 seconds
    const before = game.world.playerTtlMs

    game.submitCommand(`EXPIRE ${PLAYER_KEY} 90`)
    run(game, clock, 12)

    expect(game.world.playerTtlMs).toBeGreaterThan(before)
  })

  it('surfaces an invalid command as an error rather than crashing the tick', () => {
    const { game, clock } = newGame()
    const seen = []
    game.runtime.bus.on('sim:commandResult', (p) => seen.push(p))

    game.submitCommand('NOTACOMMAND foo')
    run(game, clock, 2)

    expect(seen[0].reply.type).toBe('error')
    expect(game.world.entities.alive[game.playerId]).toBe(1)
  })
})

describe('createGameWorld — objectives', () => {
  it('starts with the caching objective unmet', () => {
    const { game, clock } = newGame()
    run(game, clock, 12)
    expect(game.world.objectiveStatus.obj_cache).toBe(false)
  })

  it('flips an objective and announces it once the player satisfies it', () => {
    const { game, clock } = newGame()
    const changes = []
    game.runtime.bus.on('sim:objectiveChanged', (p) => changes.push(p))

    run(game, clock, 12)
    game.submitCommand('SET cache:manifest ok')
    run(game, clock, 24)

    expect(game.world.objectiveStatus.obj_cache).toBe(true)
    expect(changes.some((c) => c.id === 'obj_cache' && c.passed)).toBe(true)
  })

  it('teaches the TTL lesson: EXPIRE on the orphaned key completes obj_ttl', () => {
    const { game, clock } = newGame()
    run(game, clock, 12)
    expect(game.world.objectiveStatus.obj_ttl).toBe(false)

    game.submitCommand('EXPIRE margit:ledger 120')
    run(game, clock, 24)

    expect(game.world.objectiveStatus.obj_ttl).toBe(true)
  })
})

describe('createGameWorld — determinism survives assembly', () => {
  it('produces an identical state hash from the same seed and inputs', () => {
    function once() {
      const clock = fakeClock()
      const game = createGameWorld({ seed: 'determinism', now: clock })
      for (let i = 0; i < 300; i++) {
        if (i === 100) game.submitCommand('SET cache:manifest x')
        clock.advance(16)
        game.world.step(TICK)
      }
      return game.world.stateHash()
    }
    expect(once()).toBe(once())
  })

  it('diverges on a different seed', () => {
    function once(seed) {
      const clock = fakeClock()
      const game = createGameWorld({ seed, now: clock })
      for (let i = 0; i < 300; i++) {
        clock.advance(16)
        game.world.step(TICK)
      }
      return game.world.stateHash()
    }
    // Different seeds jitter hostile spawn placement, so the layout — and
    // therefore every chase that follows from it — differs run to run.
    expect(once('seed-a')).not.toBe(once('seed-b'))
  })
})
