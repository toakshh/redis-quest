// Tests for AISystem: the integer FSM, stateTime accumulation/reset, and
// distance-driven transitions using the spatial hash for targeting.

import { describe, it, expect } from 'vitest'
import { createAISystem, AI_STATE } from './AISystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'
import { FLAGS } from '../entity/EntityStore.js'

function makeWorld(opts) {
  const runtime = createRuntime({ seed: 'ai', now: () => 0 })
  const w = createSimWorld({ runtime, seed: 'ai', clock: () => 0 })
  w.addSystem(createAISystem(opts))
  return w
}

// Spawn a hostile hunter and a prey (player) at the given separation on X.
function scene(w, sep) {
  const hunter = w.entities.spawn(1, 0, 0, 0)
  w.entities.flags[hunter] = FLAGS.HOSTILE
  w.entities.health[hunter] = 100
  w.entities.maxHealth[hunter] = 100
  const prey = w.entities.spawn(0, sep, 0, 0)
  w.entities.health[prey] = 100
  w.entities.maxHealth[prey] = 100
  return { hunter, prey }
}

const DT = 1 / 60

describe('AISystem', () => {
  it('registers at the AI order', () => {
    expect(createAISystem().order).toBe(50)
  })

  it('exposes integer state constants', () => {
    expect(AI_STATE.IDLE).toBe(0)
    expect(AI_STATE.DYING).toBe(6)
    expect(typeof AI_STATE.CHASE).toBe('number')
  })

  it('patrols when no prey is within the alert radius', () => {
    const w = makeWorld({ alertRadius: 5 })
    const { hunter } = scene(w, 50)
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.PATROL)
  })

  it('alerts when prey is inside alert but outside chase range', () => {
    const w = makeWorld({ alertRadius: 12, chaseRadius: 9, attackRadius: 1.6 })
    const { hunter } = scene(w, 10)
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.ALERT)
  })

  it('chases and steers toward prey inside chase range', () => {
    const w = makeWorld({ chaseRadius: 9, attackRadius: 1.6, chaseSpeed: 4 })
    const { hunter } = scene(w, 5)
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.CHASE)
    expect(w.entities.velX[hunter]).toBeGreaterThan(0) // toward +X prey
  })

  it('attacks when prey is within attack range', () => {
    const w = makeWorld({ attackRadius: 1.6 })
    const { hunter } = scene(w, 1)
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.ATTACK)
  })

  it('flees when its health drops below the flee fraction', () => {
    const w = makeWorld({ fleeHealthFraction: 0.25 })
    const { hunter } = scene(w, 3)
    w.entities.health[hunter] = 10 // 10% of 100
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.FLEE)
    expect(w.entities.velX[hunter]).toBeLessThan(0) // away from +X prey
  })

  it('enters DYING when health hits zero', () => {
    const w = makeWorld()
    const { hunter } = scene(w, 3)
    w.entities.health[hunter] = 0
    w.step(DT)
    expect(w.entities.state[hunter]).toBe(AI_STATE.DYING)
  })

  it('accumulates stateTime while a state persists and resets on transition', () => {
    const w = makeWorld({ alertRadius: 5 })
    const { hunter } = scene(w, 50) // always PATROL
    w.step(DT)
    w.step(DT)
    expect(w.entities.stateTime[hunter]).toBeCloseTo(DT, 6) // reset once, +1
    // Now bring prey (id 1) into attack range → transition resets stateTime.
    w.entities.posX[1] = 1
    w.step(DT)
    expect(w.entities.stateTime[hunter]).toBe(0)
  })

  it('ignores non-hostile entities', () => {
    const w = makeWorld()
    const prey = w.entities.spawn(0, 0, 0, 0)
    w.entities.health[prey] = 100
    w.step(DT)
    expect(w.entities.state[prey]).toBe(AI_STATE.IDLE) // never touched
  })
})
