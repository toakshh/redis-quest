import { describe, it, expect, beforeEach } from 'vitest'
import {
  MasteryEngine,
  recordCommandUsage,
  getCommandMastery,
  getAllMastery,
  defaultMasteryEngine,
} from './MasteryEngine.js'

describe('MasteryEngine', () => {
  let engine

  beforeEach(() => {
    engine = new MasteryEngine()
    defaultMasteryEngine.reset()
  })

  describe('getCommandMastery', () => {
    it('returns default unrecorded structure for unknown command', () => {
      const mastery = engine.getCommandMastery('GET')
      expect(mastery).toEqual({
        introduced: false,
        guidedUses: 0,
        independentUses: 0,
        failures: 0,
        masteryScore: 0.0,
      })
    })

    it('returns copy of recorded command mastery', () => {
      engine.recordCommandUsage('SET', true, false)
      const mastery1 = engine.getCommandMastery('SET')
      expect(mastery1.introduced).toBe(true)

      // Verify returned object is a copy
      mastery1.guidedUses = 99
      const mastery2 = engine.getCommandMastery('SET')
      expect(mastery2.guidedUses).toBe(1)
    })
  })

  describe('recordCommandUsage', () => {
    it('normalizes command names to uppercase and trimmed', () => {
      engine.recordCommandUsage('  hset ', true, false)
      const mastery = engine.getCommandMastery('HSET')
      expect(mastery.introduced).toBe(true)
      expect(mastery.guidedUses).toBe(1)
    })

    it('records guided usage when contextual is false', () => {
      engine.recordCommandUsage('GET', true, false)
      const mastery = engine.getCommandMastery('GET')
      expect(mastery.introduced).toBe(true)
      expect(mastery.guidedUses).toBe(1)
      expect(mastery.independentUses).toBe(0)
      expect(mastery.failures).toBe(0)
    })

    it('records independent usage when contextual is true', () => {
      engine.recordCommandUsage('GET', true, true)
      const mastery = engine.getCommandMastery('GET')
      expect(mastery.introduced).toBe(true)
      expect(mastery.guidedUses).toBe(0)
      expect(mastery.independentUses).toBe(1)
      expect(mastery.failures).toBe(0)
    })

    it('records failures when success is false', () => {
      engine.recordCommandUsage('DEL', false, false)
      const mastery = engine.getCommandMastery('DEL')
      expect(mastery.introduced).toBe(true)
      expect(mastery.guidedUses).toBe(0)
      expect(mastery.independentUses).toBe(0)
      expect(mastery.failures).toBe(1)
    })

    it('accumulates multiple uses and updates metrics', () => {
      engine.recordCommandUsage('LPUSH', true, false) // guided
      engine.recordCommandUsage('LPUSH', true, true)  // independent
      engine.recordCommandUsage('LPUSH', false, true) // failure
      engine.recordCommandUsage('LPUSH', true, true)  // independent

      const mastery = engine.getCommandMastery('LPUSH')
      expect(mastery.guidedUses).toBe(1)
      expect(mastery.independentUses).toBe(2)
      expect(mastery.failures).toBe(1)
    })
  })

  describe('Mastery Score Progression', () => {
    it('increases mastery score on guided and independent uses', () => {
      let m = engine.recordCommandUsage('ZADD', true, false) // guided: +0.10
      expect(m.masteryScore).toBe(0.10)

      m = engine.recordCommandUsage('ZADD', true, true) // independent: +0.20
      expect(m.masteryScore).toBe(0.30)
    })

    it('progresses faster with independent uses than guided uses', () => {
      const guidedEngine = new MasteryEngine()
      const independentEngine = new MasteryEngine()

      guidedEngine.recordCommandUsage('SADD', true, false)
      independentEngine.recordCommandUsage('SADD', true, true)

      const guidedMastery = guidedEngine.getCommandMastery('SADD')
      const independentMastery = independentEngine.getCommandMastery('SADD')

      expect(independentMastery.masteryScore).toBeGreaterThan(guidedMastery.masteryScore)
    })

    it('deducts penalty from score on failures', () => {
      engine.recordCommandUsage('INCR', true, true) // +0.20
      let m = engine.getCommandMastery('INCR')
      expect(m.masteryScore).toBe(0.20)

      engine.recordCommandUsage('INCR', false, true) // -0.05
      m = engine.getCommandMastery('INCR')
      expect(m.masteryScore).toBe(0.15)
    })

    it('clamps masteryScore within range 0.0 to 1.0', () => {
      // Test lower bound (0.0)
      engine.recordCommandUsage('EXPIRE', false, false)
      let m = engine.getCommandMastery('EXPIRE')
      expect(m.masteryScore).toBe(0.0)

      // Test upper bound (1.0)
      for (let i = 0; i < 10; i++) {
        engine.recordCommandUsage('EXPIRE', true, true)
      }
      m = engine.getCommandMastery('EXPIRE')
      expect(m.masteryScore).toBe(1.0)
    })
  })

  describe('getAllMastery', () => {
    it('returns all recorded command mastery data', () => {
      engine.recordCommandUsage('SET', true, true)
      engine.recordCommandUsage('GET', true, false)

      const all = engine.getAllMastery()
      expect(Object.keys(all).sort()).toEqual(['GET', 'SET'])
      expect(all.SET.independentUses).toBe(1)
      expect(all.GET.guidedUses).toBe(1)
    })
  })

  describe('Initial Data Loading', () => {
    it('loads initial state in constructor or loadMasteryData', () => {
      const customEngine = new MasteryEngine({
        SET: { guidedUses: 2, independentUses: 3, failures: 0, introduced: true },
      })

      const mastery = customEngine.getCommandMastery('SET')
      expect(mastery.guidedUses).toBe(2)
      expect(mastery.independentUses).toBe(3)
      expect(mastery.masteryScore).toBe(0.8)
    })
  })

  describe('Standalone Exported Functions', () => {
    it('operates on default master engine singleton', () => {
      recordCommandUsage('PING', true, true)
      const mastery = getCommandMastery('PING')
      expect(mastery.introduced).toBe(true)
      expect(mastery.independentUses).toBe(1)

      const all = getAllMastery()
      expect(all.PING).toBeDefined()
    })
  })
})
