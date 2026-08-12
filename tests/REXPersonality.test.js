import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createREXPersonality } from '../src/systems/REXPersonality.js'
import DIALOGUE from '../src/data/rex-dialogue/personalities.json'

describe('REXPersonality', () => {
  let personality
  let rng
  let now

  beforeEach(() => {
    rng = vi.fn(() => 0.5)
    now = 1000000
    personality = createREXPersonality({ dialogue: DIALOGUE, rng, now: () => now })
  })

  describe('pickIntro', () => {
    it('returns intro for known region', () => {
      const intro = personality.pickIntro('memory-village')
      expect(intro).toBeTruthy()
      expect(typeof intro).toBe('string')
      expect(intro.length).toBeGreaterThan(0)
    })

    it('falls back to generic for unknown region', () => {
      const intro = personality.pickIntro('unknown-region')
      expect(intro).toBeTruthy()
    })
  })

  describe('pickHint', () => {
    it('returns hint for level 1', () => {
      const hint = personality.pickHint('memory-village', 1)
      expect(hint).toBeTruthy()
    })

    it('returns hint for level 2', () => {
      const hint = personality.pickHint('memory-village', 2)
      expect(hint).toBeTruthy()
    })

    it('returns hint for level 3', () => {
      const hint = personality.pickHint('memory-village', 3)
      expect(hint).toBeTruthy()
    })

    it('returns hint for level 4', () => {
      const hint = personality.pickHint('memory-village', 4)
      expect(hint).toBeTruthy()
    })

    it('falls back to generic hints if region has none', () => {
      const hint = personality.pickHint('unknown-region', 1)
      expect(hint).toBeTruthy()
    })
  })

  describe('react', () => {
    it('returns reaction for ok', () => {
      const reaction = personality.react('ok', 'memory-village')
      expect(reaction).toBeTruthy()
    })

    it('returns reaction for error', () => {
      const reaction = personality.react('error', 'memory-village')
      expect(reaction).toBeTruthy()
    })

    it('returns reaction for wrongtype', () => {
      const reaction = personality.react('wrongtype', 'memory-village')
      expect(reaction).toBeTruthy()
    })

    it('falls back to generic reactions', () => {
      const reaction = personality.react('unknown', 'unknown-region')
      expect(reaction).toBeTruthy()
    })
  })

  describe('dominantTrait', () => {
    it('returns curiosity for memory-village', () => {
      expect(personality.dominantTrait('memory-village')).toBe('curiosity')
    })

    it('returns humor for list-harbor', () => {
      expect(personality.dominantTrait('list-harbor')).toBe('humor')
    })

    it('returns sternness for set-caverns', () => {
      expect(personality.dominantTrait('set-caverns')).toBe('sternness')
    })

    it('returns wisdom for hash-city', () => {
      expect(personality.dominantTrait('hash-city')).toBe('wisdom')
    })

    it('returns sternness for redis-core', () => {
      expect(personality.dominantTrait('redis-core')).toBe('sternness')
    })

    it('returns default curiosity for unknown region', () => {
      expect(personality.dominantTrait('unknown')).toBe('curiosity')
    })
  })

  describe('pickTraitLine', () => {
    it('returns a trait line', () => {
      const line = personality.pickTraitLine('memory-village')
      expect(line).toBeTruthy()
    })

    it('tracks traits seen per region', () => {
      personality.pickTraitLine('memory-village')
      personality.pickTraitLine('memory-village')
      // traitsSeen should contain the region
      const state = personality.serialize()
      expect(state.traitsSeen).toContain('memory-village')
    })
  })

  describe('observe (playstyle learning)', () => {
    it('tracks total commands', () => {
      personality.observe({ at: now, ok: true, isFirst: 'SET' })
      personality.observe({ at: now + 100, ok: true, isFirst: 'GET' })
      personality.observe({ at: now + 200, ok: false })
      const state = personality.serialize()
      expect(state.totalCommands).toBe(3)
    })

    it('tracks failures', () => {
      personality.observe({ at: now, ok: true })
      personality.observe({ at: now + 100, ok: false })
      personality.observe({ at: now + 200, ok: false })
      const state = personality.serialize()
      expect(state.failures).toBe(2)
    })

    it('tracks unique commands', () => {
      personality.observe({ at: now, ok: true, isFirst: 'SET' })
      personality.observe({ at: now + 100, ok: true, isFirst: 'SET' })
      personality.observe({ at: now + 200, ok: true, isFirst: 'GET' })
      const state = personality.serialize()
      expect(state.uniqueCommands).toContain('SET')
      expect(state.uniqueCommands).toContain('GET')
    })

    it('tracks cadence samples', () => {
      personality.observe({ at: now, ok: true })
      personality.observe({ at: now + 1000, ok: true })
      personality.observe({ at: now + 2000, ok: true })
      const state = personality.serialize()
      expect(state.cadenceSamples.length).toBeGreaterThan(0)
    })

    it('limits cadence samples to MAX_CADENCE_SAMPLES (12)', () => {
      for (let i = 0; i < 20; i++) {
        personality.observe({ at: now + i * 100, ok: true })
      }
      const state = personality.serialize()
      expect(state.cadenceSamples.length).toBeLessThanOrEqual(12)
    })
  })

  describe('pace', () => {
    it('returns rushed for fast commands', () => {
      // Simulate fast commands (< 2000ms)
      personality.observe({ at: now, ok: true })
      personality.observe({ at: now + 1000, ok: true })
      personality.observe({ at: now + 2000, ok: true })
      personality.observe({ at: now + 3000, ok: true })
      expect(personality.playstyleTags().pace).toBe('rushed')
    })

    it('returns steady for moderate pace', () => {
      // Simulate moderate commands (2000-6000ms)
      personality.observe({ at: now, ok: true })
      personality.observe({ at: now + 3000, ok: true })
      personality.observe({ at: now + 6000, ok: true })
      personality.observe({ at: now + 9000, ok: true })
      expect(personality.playstyleTags().pace).toBe('steady')
    })

    it('returns careful for slow commands', () => {
      // Simulate slow commands (> 6000ms)
      personality.observe({ at: now, ok: true })
      personality.observe({ at: now + 7000, ok: true })
      personality.observe({ at: now + 14000, ok: true })
      personality.observe({ at: now + 21000, ok: true })
      expect(personality.playstyleTags().pace).toBe('careful')
    })

    it('returns steady with no samples', () => {
      expect(personality.playstyleTags().pace).toBe('steady')
    })
  })

  describe('style', () => {
    it('returns experimental for high first-time ratio', () => {
      // Many unique commands, few repeats
      for (let i = 0; i < 10; i++) {
        personality.observe({ at: now + i * 100, ok: true, isFirst: `CMD${i}` })
      }
      expect(personality.playstyleTags().style).toBe('experimental')
    })

    it('returns byTheBook for low first-time ratio', () => {
      // Same command repeated
      for (let i = 0; i < 10; i++) {
        personality.observe({ at: now + i * 100, ok: true, isFirst: 'SET' })
      }
      expect(personality.playstyleTags().style).toBe('byTheBook')
    })

    it('returns experimental with high failure rate and some first-time commands', () => {
      // Mix of failures and some new commands
      for (let i = 0; i < 8; i++) {
        personality.observe({ at: now + i * 100, ok: false, isFirst: `CMD${i}` })
      }
      for (let i = 0; i < 2; i++) {
        personality.observe({ at: now + 800 + i * 100, ok: true })
      }
      expect(personality.playstyleTags().style).toBe('experimental')
    })
  })

  describe('pickPlaystyle', () => {
    it('returns a playstyle line', () => {
      const line = personality.pickPlaystyle()
      expect(line).toBeTruthy()
    })

    it('uses pace and style pools', () => {
      // Set up rushed + experimental
      for (let i = 0; i < 5; i++) {
        personality.observe({ at: now + i * 500, ok: true, isFirst: `CMD${i}` })
      }
      const line = personality.pickPlaystyle()
      expect(line).toBeTruthy()
    })
  })

  describe('Structured lines (boss/tutorial/mode)', () => {
    it('pickBoss returns engaged line', () => {
      const line = personality.pickBoss('engaged')
      expect(line).toBeTruthy()
    })

    it('pickBoss returns solved line', () => {
      const line = personality.pickBoss('solved')
      expect(line).toBeTruthy()
    })

    it('pickBoss returns miss line', () => {
      const line = personality.pickBoss('miss')
      expect(line).toBeTruthy()
    })

    it('pickBoss returns defeated line', () => {
      const line = personality.pickBoss('defeated')
      expect(line).toBeTruthy()
    })

    it('pickTutorial returns start line', () => {
      const line = personality.pickTutorial('start')
      expect(line).toBeTruthy()
    })

    it('pickTutorial returns stepDone line', () => {
      const line = personality.pickTutorial('stepDone')
      expect(line).toBeTruthy()
    })

    it('pickTutorial returns complete line', () => {
      const line = personality.pickTutorial('complete')
      expect(line).toBeTruthy()
    })

    it('pickTutorial returns proSkip line', () => {
      const line = personality.pickTutorial('proSkip')
      expect(line).toBeTruthy()
    })

    it('pickMode returns beginner line', () => {
      const line = personality.pickMode('beginner')
      expect(line).toBeTruthy()
    })

    it('pickMode returns pro line', () => {
      const line = personality.pickMode('pro')
      expect(line).toBeTruthy()
    })
  })

  describe('serialize/hydrate', () => {
    it('preserves state across serialization', () => {
      personality.observe({ at: now, ok: true, isFirst: 'SET' })
      personality.observe({ at: now + 1000, ok: false })
      const saved = personality.serialize()

      const personality2 = createREXPersonality({ dialogue: DIALOGUE, rng, now: () => now })
      personality2.hydrate(saved)

      expect(personality2.serialize().totalCommands).toBe(saved.totalCommands)
      expect(personality2.serialize().failures).toBe(saved.failures)
      expect(personality2.serialize().uniqueCommands).toEqual(saved.uniqueCommands)
      expect(personality2.serialize().traitsSeen).toEqual(saved.traitsSeen)
    })
  })

  describe('No-repeat picking', () => {
    it('does not repeat same line consecutively for same slot', () => {
      // With rng returning 0.5, we should get different indices
      const lines = new Set()
      for (let i = 0; i < 10; i++) {
        lines.add(personality.pickHint('memory-village', 1))
      }
      // Should have some variety (not all identical)
      expect(lines.size).toBeGreaterThan(1)
    })
  })
})