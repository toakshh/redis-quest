// Tests for MovementSystem: prev-position bookkeeping, gravity, friction,
// integration, and the BLOCKED-flag freeze.

import { describe, it, expect } from 'vitest'
import { createMovementSystem } from './MovementSystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'
import { FEEL } from '../../config/feel.js'
import { FLAGS } from '../entity/EntityStore.js'

function makeWorld() {
  const runtime = createRuntime({ seed: 'move', now: () => 0 })
  const w = createSimWorld({ runtime, seed: 'move', clock: () => 0 })
  w.addSystem(createMovementSystem())
  return w
}

const DT = 1 / 60

describe('MovementSystem', () => {
  it('registers at the MOVEMENT order', () => {
    expect(createMovementSystem().order).toBe(30)
  })

  it('writes prev position before integrating', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 2, 5, -3)
    w.entities.velX[id] = 1
    w.step(DT)
    expect(w.entities.prevX[id]).toBe(2)
    expect(w.entities.prevY[id]).toBe(5)
    expect(w.entities.prevZ[id]).toBe(-3)
  })

  it('integrates horizontal velocity into position', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 0, 0, 0)
    w.entities.velX[id] = 6
    w.step(DT)
    // friction applies first, then integrate
    const keep = 1 - FEEL.move.groundFriction * DT
    expect(w.entities.posX[id]).toBeCloseTo(6 * keep * DT, 6)
  })

  it('applies gravity to vertical velocity', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 0, 10, 0)
    w.step(DT)
    expect(w.entities.velY[id]).toBeCloseTo(FEEL.move.gravity * DT, 6)
  })

  it('applies ground friction to horizontal velocity', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 0, 0, 0)
    w.entities.velX[id] = 10
    w.entities.velZ[id] = -10
    w.step(DT)
    const keep = 1 - FEEL.move.groundFriction * DT
    expect(w.entities.velX[id]).toBeCloseTo(10 * keep, 6)
    expect(w.entities.velZ[id]).toBeCloseTo(-10 * keep, 6)
  })

  it('freezes a BLOCKED entity in place', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 1, 0, 1)
    w.entities.velX[id] = 5
    w.entities.flags[id] = FLAGS.BLOCKED
    w.step(DT)
    expect(w.entities.posX[id]).toBe(1)
    expect(w.entities.velX[id]).toBe(5) // untouched
    expect(w.entities.prevX[id]).toBe(1)
  })

  it('does nothing when dt is zero', () => {
    const w = makeWorld()
    const id = w.entities.spawn(0, 0, 100, 0)
    w.timeScale = 0
    w.step(DT)
    expect(w.entities.velY[id]).toBe(0)
    expect(w.entities.posY[id]).toBe(100)
  })
})
