import { describe, it, expect } from 'vitest'
import { SCARE_TYPES } from './scareTypes.js'

describe('scareTypes', () => {
  it('1. Exports SCARE_TYPES array', () => {
    expect(Array.isArray(SCARE_TYPES)).toBe(true)
  })

  it('2. Contains exactly 8 types', () => {
    expect(SCARE_TYPES.length).toBe(8)
  })

  it('3. Every type has the required fields', () => {
    SCARE_TYPES.forEach(type => {
      expect(type).toHaveProperty('id')
      expect(type).toHaveProperty('baseEffectiveness')
      expect(type).toHaveProperty('cooldownMs')
      expect(type).toHaveProperty('minTension')
      expect(type).toHaveProperty('requiresLineOfSight')
      expect(type).toHaveProperty('audioCue')

      expect(typeof type.id).toBe('string')
      expect(typeof type.baseEffectiveness).toBe('number')
      expect(typeof type.cooldownMs).toBe('number')
      expect(typeof type.minTension).toBe('string')
      expect(typeof type.requiresLineOfSight).toBe('boolean')
      expect(typeof type.audioCue).toBe('string')
    })
  })
})
