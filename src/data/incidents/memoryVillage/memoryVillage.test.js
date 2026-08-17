import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../../../engine/engine.js'
import {
  MEMORY_VILLAGE_INCIDENTS,
  brokenGateIncident,
  staleCacheIncident,
  endlessShieldIncident,
  corruptedUserIncident,
  cacheRotStalkerIncident,
} from './index.js'

describe('Memory Village Incidents Catalog', () => {
  let engine

  beforeEach(() => {
    engine = new MockRedisEngine()
  })

  it('exports MEMORY_VILLAGE_INCIDENTS with 5 incidents', () => {
    expect(Array.isArray(MEMORY_VILLAGE_INCIDENTS)).toBe(true)
    expect(MEMORY_VILLAGE_INCIDENTS.length).toBe(5)
  })

  it('has valid structure for all incident definitions', () => {
    MEMORY_VILLAGE_INCIDENTS.forEach((incident) => {
      expect(typeof incident.id).toBe('string')
      expect(incident.id.length).toBeGreaterThan(0)

      expect(typeof incident.title).toBe('string')
      expect(incident.title.length).toBeGreaterThan(0)

      expect(typeof incident.description).toBe('string')
      expect(incident.description.length).toBeGreaterThan(0)

      expect(Array.isArray(incident.commands)).toBe(true)
      expect(incident.commands.length).toBeGreaterThan(0)

      expect(typeof incident.setup).toBe('function')
      expect(typeof incident.isResolved).toBe('function')

      // Check objective structure
      expect(Array.isArray(incident.objectives)).toBe(true)
      expect(incident.objectives.length).toBeGreaterThan(0)
      incident.objectives.forEach((obj) => {
        expect(typeof obj.id).toBe('string')
        expect(typeof obj.description).toBe('string')
      })

      // Check 3-tier hints
      expect(Array.isArray(incident.hints)).toBe(true)
      expect(incident.hints.length).toBe(3)
      incident.hints.forEach((hint) => {
        expect(typeof hint).toBe('string')
        expect(hint.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Incident 1: brokenGate', () => {
    it('sets up initial state correctly', () => {
      brokenGateIncident.setup(engine)
      const gateMode = engine.rawExecute('GET', 'api:gate:mode')
      expect(gateMode.value).toBe('open')
      expect(brokenGateIncident.isResolved(engine)).toBe(false)
    })

    it('solves cleanly with GET and SET', () => {
      brokenGateIncident.setup(engine)

      // Step 1: inspect
      const inspectReply = engine.execute('GET api:gate:mode')
      expect(inspectReply.value).toBe('open')

      // Step 2: repair
      const repairReply = engine.execute('SET api:gate:mode locked')
      expect(repairReply.value).toBe('OK')

      expect(brokenGateIncident.isResolved(engine)).toBe(true)
    })
  })

  describe('Incident 2: staleCache', () => {
    it('sets up initial state correctly', () => {
      staleCacheIncident.setup(engine)
      const cacheVal = engine.rawExecute('GET', 'cache:user:42')
      expect(cacheVal.value).toBe('corrupted')
      expect(staleCacheIncident.isResolved(engine)).toBe(false)
    })

    it('solves cleanly with DEL', () => {
      staleCacheIncident.setup(engine)
      engine.execute('DEL cache:user:42')
      expect(staleCacheIncident.isResolved(engine)).toBe(true)
    })

    it('solves cleanly with SET', () => {
      staleCacheIncident.setup(engine)
      engine.execute('SET cache:user:42 valid')
      expect(staleCacheIncident.isResolved(engine)).toBe(true)
    })
  })

  describe('Incident 3: endlessShield', () => {
    it('sets up initial state correctly with TTL -1', () => {
      endlessShieldIncident.setup(engine)
      const shieldVal = engine.rawExecute('GET', 'village:shield')
      const shieldTtl = engine.rawExecute('TTL', 'village:shield')
      expect(shieldVal.value).toBe('active')
      expect(shieldTtl.value).toBe(-1)
      expect(endlessShieldIncident.isResolved(engine)).toBe(false)
    })

    it('solves cleanly with TTL and EXPIRE', () => {
      endlessShieldIncident.setup(engine)
      const ttlReply = engine.execute('TTL village:shield')
      expect(ttlReply.value).toBe(-1)

      const expireReply = engine.execute('EXPIRE village:shield 30')
      expect(expireReply.value).toBe(1)
      expect(endlessShieldIncident.isResolved(engine)).toBe(true)
    })
  })

  describe('Incident 4: corruptedUser', () => {
    it('sets up initial hash with poisoned field', () => {
      corruptedUserIncident.setup(engine)
      const statusVal = engine.rawExecute('HGET', 'user:42', 'status')
      expect(statusVal.value).toBe('poisoned')
      expect(corruptedUserIncident.isResolved(engine)).toBe(false)
    })

    it('solves cleanly with HGETALL and HSET', () => {
      corruptedUserIncident.setup(engine)
      const hashReply = engine.execute('HGETALL user:42')
      const fields = hashReply.value.map((item) => item.value)
      expect(fields).toEqual(['name', 'Alex', 'status', 'poisoned', 'role', 'villager'])

      const setReply = engine.execute('HSET user:42 status active')
      expect(setReply.value).toBe(0) // HSET returns 0 when updating existing field

      expect(corruptedUserIncident.isResolved(engine)).toBe(true)
    })
  })

  describe('Mini-Boss: cacheRotStalker', () => {
    it('sets up initial state with toxic spores, core, status, and shield', () => {
      cacheRotStalkerIncident.setup(engine)
      expect(engine.rawExecute('GET', 'stalker:spore:1').value).toBe('toxic')
      expect(engine.rawExecute('GET', 'stalker:spore:2').value).toBe('toxic')
      expect(engine.rawExecute('GET', 'stalker:rot:core').value).toBe('expanding')
      expect(engine.rawExecute('GET', 'village:status').value).toBe('corrupted')
      expect(engine.rawExecute('GET', 'village:shield').value).toBe('decayed')
      expect(cacheRotStalkerIncident.isResolved(engine)).toBe(false)
    })

    it('solves cleanly across all phases', () => {
      cacheRotStalkerIncident.setup(engine)

      // Phase 1: Purge Rot Spores
      engine.execute('DEL stalker:spore:1')
      engine.execute('DEL stalker:spore:2')
      expect(cacheRotStalkerIncident.phases[0].isCompleted(engine)).toBe(true)

      // Phase 2: Contain Stalker Core
      engine.execute('TTL stalker:rot:core')
      engine.execute('EXPIRE stalker:rot:core 30')
      expect(cacheRotStalkerIncident.phases[1].isCompleted(engine)).toBe(true)

      // Phase 3: Restore Village Stability
      engine.execute('GET village:status')
      engine.execute('SET village:status stable')
      engine.execute('SET village:shield active')
      engine.execute('EXPIRE village:shield 60')
      expect(cacheRotStalkerIncident.phases[2].isCompleted(engine)).toBe(true)

      // Overall resolution
      expect(cacheRotStalkerIncident.isResolved(engine)).toBe(true)
    })
  })
})
