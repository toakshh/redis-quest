// Tests for the struct-of-arrays EntityStore: spawn/despawn lifecycle,
// capacity limits, free-slot reuse, flags, and the no-allocation guarantee.

import { describe, it, expect } from 'vitest'
import { createEntityStore, MAX_ENTITIES, FLAGS } from './EntityStore.js'

describe('EntityStore', () => {
  it('exposes the budgeted capacity by default', () => {
    const s = createEntityStore()
    expect(s.capacity).toBe(MAX_ENTITIES)
    expect(s.count).toBe(0)
  })

  it('spawns an entity and marks it alive', () => {
    const s = createEntityStore(8)
    const id = s.spawn(2, 1, 2, 3)
    expect(id).toBe(0)
    expect(s.alive[id]).toBe(1)
    expect(s.archetype[id]).toBe(2)
    expect(s.posX[id]).toBe(1)
    expect(s.posY[id]).toBe(2)
    expect(s.posZ[id]).toBe(3)
    expect(s.count).toBe(1)
  })

  it('initializes prev position to spawn position', () => {
    const s = createEntityStore(8)
    const id = s.spawn(0, 5, 6, 7)
    expect(s.prevX[id]).toBe(5)
    expect(s.prevY[id]).toBe(6)
    expect(s.prevZ[id]).toBe(7)
  })

  it('returns distinct slots for sequential spawns', () => {
    const s = createEntityStore(8)
    const a = s.spawn(0, 0, 0, 0)
    const b = s.spawn(0, 0, 0, 0)
    expect(a).not.toBe(b)
    expect(s.count).toBe(2)
  })

  it('returns -1 when at capacity', () => {
    const s = createEntityStore(3)
    expect(s.spawn(0, 0, 0, 0)).toBe(0)
    expect(s.spawn(0, 0, 0, 0)).toBe(1)
    expect(s.spawn(0, 0, 0, 0)).toBe(2)
    expect(s.spawn(0, 0, 0, 0)).toBe(-1)
    expect(s.count).toBe(3)
  })

  it('reuses a freed slot after despawn', () => {
    const s = createEntityStore(3)
    const a = s.spawn(0, 0, 0, 0)
    s.spawn(0, 0, 0, 0)
    s.spawn(0, 0, 0, 0)
    expect(s.spawn(0, 0, 0, 0)).toBe(-1)
    s.despawn(a)
    expect(s.count).toBe(2)
    const reused = s.spawn(0, 0, 0, 0)
    expect(reused).toBe(a)
    expect(s.count).toBe(3)
  })

  it('despawn clears keyRef and is idempotent', () => {
    const s = createEntityStore(4)
    const id = s.spawn(0, 0, 0, 0)
    s.keyRef[id] = 'session:7742'
    s.despawn(id)
    expect(s.keyRef[id]).toBe(null)
    expect(s.alive[id]).toBe(0)
    const before = s.count
    s.despawn(id) // second despawn is a no-op
    expect(s.count).toBe(before)
  })

  it('forEachAlive visits only alive slots', () => {
    const s = createEntityStore(8)
    const a = s.spawn(0, 0, 0, 0)
    const b = s.spawn(0, 0, 0, 0)
    const c = s.spawn(0, 0, 0, 0)
    s.despawn(b)
    const seen = []
    s.forEachAlive((id) => seen.push(id))
    expect(seen.sort()).toEqual([a, c].sort())
  })

  it('reset clears every entity and refills the free list', () => {
    const s = createEntityStore(4)
    s.spawn(0, 0, 0, 0)
    s.spawn(0, 0, 0, 0)
    s.reset()
    expect(s.count).toBe(0)
    // all four slots should be spawnable again
    for (let i = 0; i < 4; i++) expect(s.spawn(0, 0, 0, 0)).not.toBe(-1)
    expect(s.spawn(0, 0, 0, 0)).toBe(-1)
  })

  it('exposes frozen flag constants', () => {
    expect(FLAGS.HOSTILE).toBe(1)
    expect(FLAGS.INVULNERABLE).toBe(2)
    expect(FLAGS.TTL_BOUND).toBe(4)
    expect(FLAGS.MARKED).toBe(8)
    expect(FLAGS.BLOCKED).toBe(16)
    expect(FLAGS.STALKER).toBe(32)
    expect(Object.isFrozen(FLAGS)).toBe(true)
  })

  it('stores flags as a bitfield', () => {
    const s = createEntityStore(2)
    const id = s.spawn(0, 0, 0, 0)
    s.flags[id] = FLAGS.HOSTILE | FLAGS.MARKED
    expect(s.flags[id] & FLAGS.HOSTILE).toBeTruthy()
    expect(s.flags[id] & FLAGS.MARKED).toBeTruthy()
    expect(s.flags[id] & FLAGS.BLOCKED).toBeFalsy()
  })

  it('never reallocates across 10,000 spawn/despawn cycles', () => {
    const s = createEntityStore(16)
    const posXRef = s.posX
    for (let i = 0; i < 10000; i++) {
      const id = s.spawn(0, i, 0, 0)
      expect(id).not.toBe(-1)
      s.despawn(id)
    }
    expect(s.capacity).toBe(16)
    expect(s.posX).toBe(posXRef) // same backing array object
    expect(s.count).toBe(0)
  })
})
