import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMemoryVillageScene,
  createSetEffect,
  createGetEffect,
  createIncrEffect,
  createExpireEffect,
  createTtlEffect,
  createExpirePoofEffect,
  createFlushEffect,
} from './MemoryVillageScene.js'

describe('MemoryVillageScene visual effects', () => {
  describe('createSetEffect', () => {
    it('creates a crystal spawn effect with correct properties', () => {
      const well = { crystals: [], slots: 8 }
      const effect = createSetEffect({ key: 'mykey', value: 'myvalue', well })
      expect(effect.type).toBe('set-crystal-spawn')
      expect(effect.crystal.key).toBe('mykey')
      expect(effect.crystal.value).toBe('myvalue')
      expect(effect.duration).toBe(800)
      expect(effect.crystal.slotIndex).toBe(0)
      expect(well.crystals.length).toBe(1)
    })

    it('assigns colors deterministically based on value', () => {
      const well = { crystals: [], slots: 8 }
      const e1 = createSetEffect({ key: 'k1', value: 'same', well })
      const e2 = createSetEffect({ key: 'k2', value: 'same', well })
      expect(e1.crystal.color).toBe(e2.crystal.color)
    })

    it('increments slotIndex for each new crystal', () => {
      const well = { crystals: [], slots: 8 }
      createSetEffect({ key: 'a', value: '1', well })
      createSetEffect({ key: 'b', value: '2', well })
      const e3 = createSetEffect({ key: 'c', value: '3', well })
      expect(e3.crystal.slotIndex).toBe(2)
    })
  })

  describe('createGetEffect', () => {
    it('creates retrieval beam for found key', () => {
      const well = { crystals: [{ key: 'mykey', color: '#ff0000' }] }
      const effect = createGetEffect({ key: 'mykey', value: 'myvalue', well, found: true })
      expect(effect.type).toBe('get-retrieval-beam')
      expect(effect.found).toBe(true)
      expect(effect.value).toBe('myvalue')
      expect(effect.crystalColor).toBe('#ff0000')
    })

    it('creates retrieval beam for missing key', () => {
      const well = { crystals: [] }
      const effect = createGetEffect({ key: 'missing', value: null, well, found: false })
      expect(effect.found).toBe(false)
      expect(effect.value).toBeNull()
    })
  })

  describe('createIncrEffect', () => {
    it('creates counter pulse effect', () => {
      const well = { crystals: [{ key: 'counter', color: '#gold' }] }
      const effect = createIncrEffect({ key: 'counter', newValue: 5, well })
      expect(effect.type).toBe('incr-counter-pulse')
      expect(effect.newValue).toBe(5)
      expect(effect.crystalColor).toBe('#gold')
    })

    it('uses default color for unknown key', () => {
      const well = { crystals: [] }
      const effect = createIncrEffect({ key: 'unknown', newValue: 1, well })
      expect(effect.crystalColor).toBe('#ffd700')
    })
  })

  describe('createExpireEffect', () => {
    it('creates golden halo effect', () => {
      const well = { crystals: [{ key: 'beacon', color: '#cyan' }] }
      const effect = createExpireEffect({ key: 'beacon', ttl: 60, well })
      expect(effect.type).toBe('expire-golden-halo')
      expect(effect.ttl).toBe(60)
      expect(effect.crystalColor).toBe('#cyan')
    })
  })

  describe('createTtlEffect', () => {
    it('creates floating countdown effect', () => {
      const well = { crystals: [{ key: 'beacon', color: '#blue' }] }
      const effect = createTtlEffect({ key: 'beacon', ttl: 30, well })
      expect(effect.type).toBe('ttl-floating-countdown')
      expect(effect.ttl).toBe(30)
      expect(effect.crystalColor).toBe('#blue')
    })
  })

  describe('createExpirePoofEffect', () => {
    it('removes crystal from well and returns poof effect', () => {
      const well = { crystals: [{ id: 'c1', key: 'old', color: '#red' }] }
      const effect = createExpirePoofEffect({ key: 'old', well })
      expect(effect).not.toBeNull()
      expect(effect.type).toBe('expire-poof')
      expect(well.crystals.length).toBe(0)
    })

    it('returns null for missing key', () => {
      const well = { crystals: [] }
      const effect = createExpirePoofEffect({ key: 'missing', well })
      expect(effect).toBeNull()
    })
  })

  describe('createFlushEffect', () => {
    it('clears all crystals and returns shatter effect', () => {
      const well = {
        crystals: [
          { id: 'c1', key: 'a', color: '#red' },
          { id: 'c2', key: 'b', color: '#blue' },
        ],
      }
      const effect = createFlushEffect({ well })
      expect(effect.type).toBe('flush-shatter')
      expect(effect.crystals.length).toBe(2)
      expect(well.crystals.length).toBe(0)
    })
  })
})

describe('MemoryVillageScene class', () => {
  let scene

  beforeEach(() => {
    scene = createMemoryVillageScene()
  })

  it('starts with empty well and closed cave', () => {
    const state = scene.getState()
    expect(state.well.crystals.length).toBe(0)
    expect(state.cave.isOpen).toBe(false)
    expect(state.cave.corruptionLevel).toBe(0)
  })

  it('processes SET command event', () => {
    const event = { name: 'SET', args: ['SET', 'key1', 'value1'], reply: { type: 'simple', value: 'OK' } }
    scene.processCommandEvent(event)
    const state = scene.getState()
    expect(state.well.crystals.length).toBe(1)
    expect(state.well.crystals[0].key).toBe('key1')
    expect(state.activeEffects.length).toBe(1)
    expect(state.activeEffects[0].type).toBe('set-crystal-spawn')
  })

  it('processes GET command event for existing key', () => {
    // First SET a key
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'key1', 'value1'], reply: { type: 'simple', value: 'OK' } })
    // Then GET it
    scene.processCommandEvent({ name: 'GET', args: ['GET', 'key1'], reply: { type: 'bulk', value: 'value1' } })
    const state = scene.getState()
    expect(state.activeEffects.some((e) => e.type === 'get-retrieval-beam')).toBe(true)
    const beam = state.activeEffects.find((e) => e.type === 'get-retrieval-beam')
    expect(beam.found).toBe(true)
    expect(beam.value).toBe('value1')
  })

  it('processes GET command event for missing key', () => {
    scene.processCommandEvent({ name: 'GET', args: ['GET', 'missing'], reply: { type: 'nil', value: null } })
    const state = scene.getState()
    const beam = state.activeEffects.find((e) => e.type === 'get-retrieval-beam')
    expect(beam.found).toBe(false)
  })

  it('processes INCR command event', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'counter', '0'], reply: { type: 'simple', value: 'OK' } })
    scene.processCommandEvent({ name: 'INCR', args: ['INCR', 'counter'], reply: { type: 'integer', value: 1 } })
    const state = scene.getState()
    const pulse = state.activeEffects.find((e) => e.type === 'incr-counter-pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.newValue).toBe(1)
  })

  it('processes EXPIRE command event', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'key', 'val'], reply: { type: 'simple', value: 'OK' } })
    scene.processCommandEvent({ name: 'EXPIRE', args: ['EXPIRE', 'key', '60'], reply: { type: 'integer', value: 1 } })
    const state = scene.getState()
    const halo = state.activeEffects.find((e) => e.type === 'expire-golden-halo')
    expect(halo).toBeTruthy()
    expect(halo.ttl).toBe(60)
  })

  it('processes TTL command event', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'key', 'val'], reply: { type: 'simple', value: 'OK' } })
    scene.processCommandEvent({ name: 'EXPIRE', args: ['EXPIRE', 'key', '60'], reply: { type: 'integer', value: 1 } })
    scene.processCommandEvent({ name: 'TTL', args: ['TTL', 'key'], reply: { type: 'integer', value: 55 } })
    const state = scene.getState()
    const countdown = state.activeEffects.find((e) => e.type === 'ttl-floating-countdown')
    expect(countdown).toBeTruthy()
    expect(countdown.ttl).toBe(55)
  })

  it('processes FLUSHDB command event', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'a', '1'], reply: { type: 'simple', value: 'OK' } })
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'b', '2'], reply: { type: 'simple', value: 'OK' } })
    scene.processCommandEvent({ name: 'FLUSHDB', args: ['FLUSHDB'], reply: { type: 'simple', value: 'OK' } })
    const state = scene.getState()
    expect(state.well.crystals.length).toBe(0)
    const shatter = state.activeEffects.find((e) => e.type === 'flush-shatter')
    expect(shatter).toBeTruthy()
    expect(shatter.crystals.length).toBe(2)
  })

  it('handles expired event - removes crystal and shows poof', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'temp', 'val'], reply: { type: 'simple', value: 'OK' } })
    expect(scene.getState().well.crystals.length).toBe(1)
    scene.handleExpiredEvent('temp')
    const state = scene.getState()
    expect(state.well.crystals.length).toBe(0)
    expect(state.activeEffects.some((e) => e.type === 'expire-poof')).toBe(true)
  })

  it('opens cave and sets corruption level', () => {
    scene.openCave()
    expect(scene.getState().cave.isOpen).toBe(true)
    scene.setCorruptionLevel(0.5)
    expect(scene.getState().cave.corruptionLevel).toBe(0.5)
    scene.setCorruptionLevel(1.5) // clamped
    expect(scene.getState().cave.corruptionLevel).toBe(1)
    scene.setCorruptionLevel(-0.5) // clamped
    expect(scene.getState().cave.corruptionLevel).toBe(0)
  })

  it('resets scene completely', () => {
    scene.processCommandEvent({ name: 'SET', args: ['SET', 'a', '1'], reply: { type: 'simple', value: 'OK' } })
    scene.openCave()
    scene.setCorruptionLevel(0.7)
    scene.reset()
    const state = scene.getState()
    expect(state.well.crystals.length).toBe(0)
    expect(state.cave.isOpen).toBe(false)
    expect(state.cave.corruptionLevel).toBe(0)
    expect(state.activeEffects.length).toBe(0)
  })

  it('spawns and updates ambient crystals', () => {
    scene.spawnAmbientCrystal()
    expect(scene.getState().ambientCrystals.length).toBe(1)
    const initialY = scene.getState().ambientCrystals[0].y
    scene.updateAmbient(1000) // 1 second
    const afterY = scene.getState().ambientCrystals[0].y
    expect(afterY).toBeLessThan(initialY) // drifts upward
  })
})