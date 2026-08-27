import { describe, it, expect } from 'vitest'
import {
  ruleNoScareNearPreciseInput,
  ruleNoInstantKillWithoutTelegraph,
  ruleNoScareDuringDebrief,
  ruleNoRepeatsWithinFour,
  ruleMustHaveAudioCue,
  evaluateFairness
} from './scareFairness.js'

describe('Scare Fairness Predicates', () => {
  it('1. ruleNoScareNearPreciseInput', () => {
    // Fails if < 3000ms unless pressure test
    expect(ruleNoScareNearPreciseInput({}, { timeSincePreciseInput: 2000 })).toBe(false)
    expect(ruleNoScareNearPreciseInput({}, { timeSincePreciseInput: 2000, isPressureTest: true })).toBe(true)
    expect(ruleNoScareNearPreciseInput({}, { timeSincePreciseInput: 3000 })).toBe(true)
  })

  it('2. ruleNoInstantKillWithoutTelegraph', () => {
    expect(ruleNoInstantKillWithoutTelegraph({ isInstantKill: true, hasTelegraph: false }, {})).toBe(false)
    expect(ruleNoInstantKillWithoutTelegraph({ isInstantKill: true, hasTelegraph: true }, {})).toBe(true)
    expect(ruleNoInstantKillWithoutTelegraph({ isInstantKill: false }, {})).toBe(true)
  })

  it('3. ruleNoScareDuringDebrief', () => {
    expect(ruleNoScareDuringDebrief({}, { inDebrief: true })).toBe(false)
    expect(ruleNoScareDuringDebrief({}, { inDebrief: false })).toBe(true)
  })

  it('4. ruleNoRepeatsWithinFour', () => {
    // recentScares contains IDs of past scares. The candidate matches if its id is in the last 3.
    expect(ruleNoRepeatsWithinFour({ id: 'T1' }, { recentScares: ['T2', 'T3', 'T4'] })).toBe(true)
    expect(ruleNoRepeatsWithinFour({ id: 'T1' }, { recentScares: ['T1', 'T2', 'T3'] })).toBe(false)
    expect(ruleNoRepeatsWithinFour({ id: 'T1' }, { recentScares: ['T2', 'T1', 'T3'] })).toBe(false)
    // If it was 4 events ago, it's fine (only last 3 are checked for a "not within 4" rule,
    // wait: if it's the 4th event, that means the sequence is T1, T2, T3, [T4 is candidate].
    // So the last 3 scares were T1, T2, T3. If candidate is T1, it repeats on the 4th event. Is that within 4?
    // "No two identical types within four events." This means events E_i, E_i-1, E_i-2, E_i-3 cannot share types.
    // If we are choosing E_i, it must not match E_i-1, E_i-2, E_i-3. So recentThree is correct.
    expect(ruleNoRepeatsWithinFour({ id: 'T1' }, { recentScares: ['T1', 'T2', 'T3', 'T4'] })).toBe(true) // T1 is 4th ago
  })

  it('5. ruleMustHaveAudioCue', () => {
    expect(ruleMustHaveAudioCue({ audioCue: 'sfx_lunge' }, {})).toBe(true)
    expect(ruleMustHaveAudioCue({}, {})).toBe(false)
    expect(ruleMustHaveAudioCue({ audioCue: '' }, {})).toBe(false)
  })

  it('6. evaluateFairness checks all rules', () => {
    const validCandidate = { id: 'T1', audioCue: 'sound' }
    const validContext = { recentScares: ['T2'] }
    expect(evaluateFairness(validCandidate, validContext)).toBe(true)

    // Breaches one rule
    const invalidContext = { recentScares: ['T2'], inDebrief: true }
    expect(evaluateFairness(validCandidate, invalidContext)).toBe(false)
  })
})

import { createScareDirector } from './ScareDirector.js'

describe('ScareFairness Property Testing (T-067)', () => {
  it('Simulates 1000 runs and ensures no fairness rules broken', () => {
    // 1000 seeds
    for (let run = 0; run < 1000; run++) {
      let seed = run
      const rng = () => {
        // basic mulberry32
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
      
      const dir = createScareDirector({ rng })
      dir.start(0, 'Medium')
      
      const types = [
        { id: 'T1', baseEffectiveness: 1.0, minTension: 'Medium', audioCue: 'c' },
        { id: 'T2', baseEffectiveness: 0.9, minTension: 'Medium', audioCue: 'c' },
        { id: 'T3', baseEffectiveness: 0.5, minTension: 'Low', audioCue: 'c' },
        { id: 'T4', baseEffectiveness: 0.9, minTension: 'High', audioCue: 'c' },
        { id: 'T5', baseEffectiveness: 1.0, minTension: 'Medium', audioCue: 'c' },
        { id: 'T6', baseEffectiveness: 1.2, minTension: 'High', audioCue: 'c' },
        { id: 'T7', baseEffectiveness: 1.1, minTension: 'Low', audioCue: 'c' },
        { id: 'T8', baseEffectiveness: 1.5, minTension: 'High', audioCue: 'c' }
      ]
      
      const context = {
        isPressureTest: false,
        timeSincePreciseInput: 10000,
        inDebrief: false,
        recentScares: []
      }
      
      let clockMs = 0
      const endTime = 20 * 60 * 1000 // 20 minutes
      const scareLog = []
      
      while (clockMs < endTime) {
        clockMs += 1000 // Advance sim by 1 second
        
        // Randomly simulate precise input
        if (rng() < 0.05) {
          context.timeSincePreciseInput = 0
        } else {
          context.timeSincePreciseInput += 1000
        }

        // Random tension shifting
        let tension = 'Medium'
        const tensionRoll = rng()
        if (tensionRoll > 0.8) tension = 'High'
        else if (tensionRoll < 0.2) tension = 'Low'

        // Check if director spawns a scare
        const scare = dir.update(clockMs, tension, types, {}, (candidate, ctxTime) => {
           return evaluateFairness(candidate, context)
        })
        
        if (scare) {
          scareLog.push({ id: scare.id, time: clockMs, gapFromRequiredInput: context.timeSincePreciseInput })
          context.recentScares.push(scare.id)
          if (context.recentScares.length > 3) {
            context.recentScares.shift()
          }
        }
      }
      
      // Analyze run
      // 1. GAP from precise input
      expect(scareLog.every(s => s.gapFromRequiredInput >= 3000)).toBe(true)
      
      // 2. No repeats within 4
      const maxConsecutiveSameType = (log) => {
         for (let i = 0; i < log.length - 3; i++) {
           const id = log[i].id
           if (log[i+1].id === id || log[i+2].id === id || log[i+3].id === id) {
             return 2 // means repeated within 4
           }
         }
         return 0
      }
      expect(maxConsecutiveSameType(scareLog)).toBeLessThan(2)
    }
  })
})
