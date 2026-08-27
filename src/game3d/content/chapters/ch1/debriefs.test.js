import { describe, it, expect } from 'vitest'
import { CH1_DEBRIEFS } from './debriefs.js'

describe('ch1 debriefs', () => {
  it('1. Exports CH1_DEBRIEFS object', () => {
    expect(CH1_DEBRIEFS).toBeDefined()
    expect(typeof CH1_DEBRIEFS).toBe('object')
  })

  it('2. Every entry has the six required fields', () => {
    for (const [key, debrief] of Object.entries(CH1_DEBRIEFS)) {
      expect(debrief).toHaveProperty('whatHappened')
      expect(debrief).toHaveProperty('whatYouDid')
      expect(debrief).toHaveProperty('realWorldName')
      expect(debrief).toHaveProperty('actualCommand')
      expect(debrief).toHaveProperty('whenToUse')
      expect(debrief).toHaveProperty('ifWrong')

      expect(typeof debrief.whatHappened).toBe('string')
      expect(typeof debrief.whatYouDid).toBe('string')
      expect(typeof debrief.realWorldName).toBe('string')
      expect(typeof debrief.actualCommand).toBe('string')
      expect(typeof debrief.whenToUse).toBe('string')
      expect(typeof debrief.ifWrong).toBe('string')
    }
  })
})
