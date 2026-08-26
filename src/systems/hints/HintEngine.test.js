import { describe, it, expect, beforeEach } from 'vitest'
import { HintEngine, createHintEngine, HINT_TIERS, TIER_NAMES, DEFAULT_PENALTIES } from './HintEngine.js'

describe('HintEngine', () => {
  let hintEngine

  beforeEach(() => {
    hintEngine = new HintEngine()
  })

  describe('3-Tier Progressive Hint System', () => {
    it('provides Tier 1 (Observation) highlighting the symptom', () => {
      const hint = hintEngine.getHint('session-expiry', 1)
      expect(hint.level).toBe(1)
      expect(hint.tierName).toBe('observation')
      expect(hint.text).toBe('The session is surviving longer than it should.')
      expect(hint.speaker).toBe('REX')
    })

    it('provides Tier 2 (Concept) pointing to the Redis concept', () => {
      const hint = hintEngine.getHint('session-expiry', 2)
      expect(hint.level).toBe(2)
      expect(hint.tierName).toBe('concept')
      expect(hint.text).toBe('Check whether this key has an expiration time.')
      expect(hint.speaker).toBe('REX')
    })

    it('provides Tier 3 (Command Shape) showing the command structure', () => {
      const hint = hintEngine.getHint('session-expiry', 3)
      expect(hint.level).toBe(3)
      expect(hint.tierName).toBe('command_shape')
      expect(hint.text).toBe('TTL <key>')
      expect(hint.speaker).toBe('REX')
    })

    it('auto-escalates hint level when level is omitted', () => {
      const hint1 = hintEngine.getHint('session-expiry')
      expect(hint1.level).toBe(1)

      const hint2 = hintEngine.getHint('session-expiry')
      expect(hint2.level).toBe(2)

      const hint3 = hintEngine.getHint('session-expiry')
      expect(hint3.level).toBe(3)

      // Capped at max tier (3)
      const hint4 = hintEngine.getHint('session-expiry')
      expect(hint4.level).toBe(3)
    })

    it('clamps requested levels to range [1, 3]', () => {
      const low = hintEngine.getHint('session-expiry', 0)
      expect(low.level).toBe(1)

      const high = hintEngine.getHint('session-expiry', 99)
      expect(high.level).toBe(3)
    })

    it('supports string tier names ("observation", "concept", "command_shape")', () => {
      expect(hintEngine.getHint('session-expiry', 'observation').level).toBe(1)
      expect(hintEngine.getHint('session-expiry', 'concept').level).toBe(2)
      expect(hintEngine.getHint('session-expiry', 'command_shape').level).toBe(3)
    })

    it('handles unregistered dynamic incidents gracefully', () => {
      const hint = hintEngine.getHint('custom-incident', 1)
      expect(hint.incidentId).toBe('custom-incident')
      expect(hint.level).toBe(1)
      expect(hint.text).toContain('custom-incident')
    })
  })

  describe('Hint Tracking & Score Penalties', () => {
    it('tracks score penalty per revealed tier', () => {
      expect(hintEngine.getScorePenalty('session-expiry')).toBe(0)

      hintEngine.getHint('session-expiry', 1)
      expect(hintEngine.getScorePenalty('session-expiry')).toBe(DEFAULT_PENALTIES[1]) // 10

      hintEngine.getHint('session-expiry', 2)
      expect(hintEngine.getScorePenalty('session-expiry')).toBe(DEFAULT_PENALTIES[1] + DEFAULT_PENALTIES[2]) // 10 + 25 = 35
    })

    it('does not double penalize when requesting the same tier multiple times', () => {
      hintEngine.getHint('session-expiry', 1)
      hintEngine.getHint('session-expiry', 1)
      hintEngine.getHint('session-expiry', 1)

      expect(hintEngine.getScorePenalty('session-expiry')).toBe(DEFAULT_PENALTIES[1])
    })

    it('calculates total score penalty across all incidents', () => {
      hintEngine.getHint('session-expiry', 1) // 10
      hintEngine.getHint('memory-leak', 2) // 25
      hintEngine.getHint('wrong-data-type', 3) // 50

      expect(hintEngine.getTotalPenalty()).toBe(10 + 25 + 50)
    })

    it('provides comprehensive hint usage details via getHintUsage', () => {
      hintEngine.getHint('session-expiry', 1)
      hintEngine.getHint('session-expiry', 2)

      const usage = hintEngine.getHintUsage('session-expiry')
      expect(usage.incidentId).toBe('session-expiry')
      expect(usage.revealedTiers).toEqual([1, 2])
      expect(usage.currentLevel).toBe(2)
      expect(usage.count).toBe(2)
      expect(usage.totalPenalty).toBe(DEFAULT_PENALTIES[1] + DEFAULT_PENALTIES[2])
      expect(usage.history).toHaveLength(2)
    })
  })

  describe('REX Dialogue Trigger Handlers', () => {
    describe('onSymptom(symptomId)', () => {
      it('triggers REX dialogue with Tier 1 Observation for a known symptom', () => {
        const response = hintEngine.onSymptom('session_surviving_too_long')
        expect(response.speaker).toBe('REX')
        expect(response.type).toBe('symptom_observation')
        expect(response.symptomId).toBe('session_surviving_too_long')
        expect(response.incidentId).toBe('session-expiry')
        expect(response.level).toBe(1)
        expect(response.tierName).toBe('observation')
        expect(response.text).toBe('The session is surviving longer than it should.')
      })

      it('maps symptomId to incidentId correctly', () => {
        const response = hintEngine.onSymptom('WRONGTYPE')
        expect(response.incidentId).toBe('wrong-data-type')
        expect(response.text).toContain('operation failed')
      })
    })

    describe('onCommandResult(cmd, result, isError)', () => {
      it('handles error command execution and responds with REX guidance', () => {
        const response = hintEngine.onCommandResult('INCR string_key', 'WRONGTYPE Operation against a key holding the wrong kind of value', true)
        expect(response.speaker).toBe('REX')
        expect(response.isError).toBe(true)
        expect(response.command).toBe('INCR')
        expect(response.incidentId).toBe('wrong-data-type')
        expect(response.text).toContain('WRONGTYPE error')
        expect(response.suggestedHintLevel).toBe(2)
      })

      it('handles string and object command inputs', () => {
        const strRes = hintEngine.onCommandResult('GET mykey', 'OK', false)
        expect(strRes.command).toBe('GET')

        const objRes = hintEngine.onCommandResult({ name: 'EXPIRE', args: ['mykey', '60'] }, '1', false)
        expect(objRes.command).toBe('EXPIRE')
      })

      it('detects when command resolves an active incident', () => {
        hintEngine.onSymptom('session_surviving_too_long')
        const response = hintEngine.onCommandResult('TTL session:123', '300', false)
        
        expect(response.isError).toBe(false)
        expect(response.resolvedIncidentId).toBe('session-expiry')
        expect(response.text).toContain('resolved incident')

        const usage = hintEngine.getHintUsage('session-expiry')
        expect(usage.resolved).toBe(true)
      })
    })
  })

  describe('Custom Incidents & State Persistence', () => {
    it('allows registering custom incidents', () => {
      hintEngine.registerIncident('custom-auth', {
        symptoms: ['auth_failed'],
        hints: {
          1: 'Authentication failed for the client.',
          2: 'Check ACL rules and user permissions.',
          3: 'AUTH <username> <password>',
        },
        resolutionCommands: ['AUTH'],
      })

      const hint = hintEngine.getHint('custom-auth', 1)
      expect(hint.text).toBe('Authentication failed for the client.')

      const symptomResponse = hintEngine.onSymptom('auth_failed')
      expect(symptomResponse.incidentId).toBe('custom-auth')
    })

    it('serializes and hydratest state correctly', () => {
      hintEngine.getHint('session-expiry', 1)
      hintEngine.getHint('session-expiry', 2)

      const serialized = hintEngine.serialize()
      
      const newEngine = new HintEngine()
      newEngine.hydrate(serialized)

      expect(newEngine.getScorePenalty('session-expiry')).toBe(DEFAULT_PENALTIES[1] + DEFAULT_PENALTIES[2])
      expect(newEngine.getHintUsage('session-expiry').revealedTiers).toEqual([1, 2])
    })

    it('resets state clean when reset() is called', () => {
      hintEngine.getHint('session-expiry', 1)
      expect(hintEngine.getTotalPenalty()).toBe(DEFAULT_PENALTIES[1])

      hintEngine.reset()
      expect(hintEngine.getTotalPenalty()).toBe(0)
      expect(hintEngine.getHintUsage('session-expiry').revealedTiers).toEqual([])
    })

    it('can be instantiated via createHintEngine factory', () => {
      const engine = createHintEngine()
      expect(engine).toBeInstanceOf(HintEngine)
    })
  })
})
