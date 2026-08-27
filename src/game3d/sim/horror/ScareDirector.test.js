import { describe, it, expect } from 'vitest'
import { createScareDirector } from './ScareDirector.js'

const MOCK_TYPES = [
  { id: 'T1', baseEffectiveness: 1.0, minTension: 'Medium' },
  { id: 'T3', baseEffectiveness: 0.5, minTension: 'Low' },
  { id: 'T4', baseEffectiveness: 1.0, minTension: 'High' }
]

describe('ScareDirector', () => {
  it('1. Schedules initial scare within cadence bounds', () => {
    const rng = () => 0.5 // Midpoint
    const dir = createScareDirector({ rng })
    dir.start(1000, 'Medium')
    // Medium bounds: 60s - 120s (60000 - 120000), mid is 90000. Start is 1000.
    expect(dir.getNextScareTime()).toBe(1000 + 90000)
  })

  it('2. Never scares during Debrief', () => {
    const dir = createScareDirector({ rng: () => 0 })
    dir.start(0, 'Debrief')
    expect(dir.getNextScareTime()).toBe(Infinity)

    dir.start(0, 'Medium')
    dir._forceNextTime(100)
    const scare = dir.update(100, 'Debrief', MOCK_TYPES)
    expect(scare).toBeNull()
  })

  it('3. Applies fatigue that decays over 240 seconds', () => {
    const dir = createScareDirector({ rng: () => 0 })
    dir.start(0, 'High')
    dir._forceNextTime(1000)

    const scare = dir.update(1000, 'High', MOCK_TYPES)
    expect(scare).toBeTruthy()

    // Immediately after scare, fatigue is 1
    expect(dir.getFatigue(scare.id, 1000)).toBe(1)

    // 120 seconds (120000 ms) later, fatigue is 0.5
    expect(dir.getFatigue(scare.id, 1000 + 120000)).toBe(0.5)

    // 240 seconds later, fatigue is 0
    expect(dir.getFatigue(scare.id, 1000 + 240000)).toBe(0)
  })

  it('4. Respects tension gates (no High scares in Medium)', () => {
    const dir = createScareDirector({ rng: () => 0 })
    dir.start(0, 'Medium')
    dir._forceNextTime(1000)

    // T4 is High, T1 is Medium, T3 is Low
    const scare = dir.update(1000, 'Medium', MOCK_TYPES)
    // Should pick T1 because T4 is filtered out, T1 is first valid.
    expect(scare.id).toBe('T1')
  })

  it('5. Selection weight uses base * (1-fatigue) * contextFit', () => {
    const dir = createScareDirector({ rng: () => 0.9 })
    dir.start(0, 'High')
    dir._forceNextTime(1000)

    // Trigger T1 to max out its fatigue
    dir._forceNextTime(1000)
    dir.update(1000, 'Medium', [{ id: 'T1', baseEffectiveness: 1.0, minTension: 'Medium'}])

    // Re-evaluate at time 2000 with T4 favored by context fit
    dir._forceNextTime(2000)
    const scare = dir.update(2000, 'High', MOCK_TYPES, { 'T4': 2.0 })
    expect(scare.id).toBe('T4')
  })

  it('6. Heavily weights T3 in Low tension', () => {
    const types = [
       { id: 'T3', baseEffectiveness: 0.5, minTension: 'Low' }, // Weight: 0.5 * 5 = 2.5
       { id: 'T7', baseEffectiveness: 1.1, minTension: 'Low' }  // Weight: 1.1
    ]

    const selectedIds = []
    for (let i = 0; i < 10; i++) {
        const dir = createScareDirector({ rng: () => (i / 10) })
        dir.start(0, 'Low')
        dir._forceNextTime(1000)
        const scare = dir.update(1000, 'Low', types)
        if (scare) selectedIds.push(scare.id)
    }

    const countT3 = selectedIds.filter(id => id === 'T3').length
    const countT7 = selectedIds.filter(id => id === 'T7').length
    expect(countT3).toBeGreaterThan(countT7)
  })
})
