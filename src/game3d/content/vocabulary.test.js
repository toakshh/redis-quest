import { describe, it, expect } from 'vitest'
import { VOCABULARY } from './vocabulary.js'

describe('VOCABULARY content', () => {
  it('1. Exports VOCABULARY array', () => {
    expect(Array.isArray(VOCABULARY)).toBe(true)
  })

  it('2. Array has at least 24 elements', () => {
    expect(VOCABULARY.length).toBeGreaterThanOrEqual(24)
  })

  it('3. Every element has id, physical, game, real, firstSeenChapter fields', () => {
    VOCABULARY.forEach(item => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('physical')
      expect(item).toHaveProperty('game')
      expect(item).toHaveProperty('real')
      expect(item).toHaveProperty('firstSeenChapter')
      expect(typeof item.id).toBe('string')
      expect(typeof item.physical).toBe('string')
      expect(typeof item.game).toBe('string')
      expect(typeof item.real).toBe('string')
      expect(typeof item.firstSeenChapter).toBe('number')
    })
  })
})
