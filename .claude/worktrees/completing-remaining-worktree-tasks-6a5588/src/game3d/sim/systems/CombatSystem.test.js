// Tests for CombatSystem: queued damage resolution, i-frames, hit-stop, and
// the sim:damage / sim:death bus events.

import { describe, it, expect } from 'vitest'
import { createCombatSystem } from './CombatSystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'
import { FLAGS } from '../entity/EntityStore.js'
import { FEEL } from '../../config/feel.js'

function makeWorld(opts) {
  let t = 1000
  const runtime = createRuntime({ seed: 'combat', now: () => t })
  const w = createSimWorld({ runtime, seed: 'combat', clock: () => t })
  const combat = createCombatSystem(opts)
  w.addSystem(combat)
  return { w, combat, setClock: (v) => { t = v } }
}

const DT = 1 / 60

function victim(w, hp = 100) {
  const id = w.entities.spawn(0, 0, 0, 0)
  w.entities.health[id] = hp
  w.entities.maxHealth[id] = hp
  return id
}

describe('CombatSystem', () => {
  it('registers at the COMBAT order', () => {
    expect(createCombatSystem().order).toBe(60)
  })

  it('applies queued damage on the next tick', () => {
    const { w, combat } = makeWorld()
    const id = victim(w)
    combat.queueDamage(id, 30)
    w.step(DT)
    expect(w.entities.health[id]).toBe(70)
  })

  it('drains the queue so damage is not re-applied', () => {
    const { w, combat } = makeWorld()
    const id = victim(w)
    combat.queueDamage(id, 30)
    w.step(DT)
    w.step(DT)
    expect(w.entities.health[id]).toBe(70)
  })

  it('grants i-frames that block a second hit in the same instant', () => {
    const { w, combat } = makeWorld({ iframeSeconds: 0.5 })
    const id = victim(w)
    combat.queueDamage(id, 30)
    combat.queueDamage(id, 30)
    w.step(DT)
    expect(w.entities.health[id]).toBe(70) // only the first hit landed
    expect(w.entities.flags[id] & FLAGS.INVULNERABLE).toBeTruthy()
  })

  it('clears i-frames after the timer expires', () => {
    const { w, combat } = makeWorld({ iframeSeconds: 0.01 })
    const id = victim(w)
    combat.queueDamage(id, 10)
    w.step(DT) // ~0.0167s elapsed, still invuln
    expect(w.entities.flags[id] & FLAGS.INVULNERABLE).toBeTruthy()
    w.step(DT) // timer crosses zero
    expect(w.entities.flags[id] & FLAGS.INVULNERABLE).toBeFalsy()
    combat.queueDamage(id, 10)
    w.step(DT)
    expect(w.entities.health[id]).toBe(80)
  })

  it('sets world.hitStopUntilMs on a landed hit', () => {
    const { w, combat } = makeWorld()
    const id = victim(w)
    combat.queueDamage(id, 5)
    w.step(DT)
    expect(w.hitStopUntilMs).toBe(1000 + FEEL.impact.hitStopMs)
  })

  it('emits sim:damage with the post-hit health', () => {
    const { w, combat } = makeWorld()
    const id = victim(w)
    const events = []
    w.bus.on('sim:damage', (p) => events.push(p))
    combat.queueDamage(id, 40, 7)
    w.step(DT)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id, amount: 40, source: 7, health: 60 })
  })

  it('emits sim:death exactly once when health reaches zero', () => {
    const { w, combat } = makeWorld()
    const id = victim(w, 20)
    let deaths = 0
    w.bus.on('sim:death', () => deaths++)
    combat.queueDamage(id, 25)
    w.step(DT)
    expect(w.entities.health[id]).toBeLessThanOrEqual(0)
    expect(deaths).toBe(1)
  })

  it('ignores damage to a dead/despawned slot', () => {
    const { w, combat } = makeWorld()
    const id = victim(w)
    w.entities.despawn(id)
    combat.queueDamage(id, 10)
    expect(() => w.step(DT)).not.toThrow()
  })
})
