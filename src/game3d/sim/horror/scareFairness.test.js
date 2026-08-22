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
