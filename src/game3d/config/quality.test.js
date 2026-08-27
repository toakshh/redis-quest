import { describe, it, expect } from 'vitest'
import { QUALITY_LADDER, createQualityManager } from './quality.js'

describe('quality', () => {
  it('1. Exports QUALITY_LADDER correctly', () => {
    expect(QUALITY_LADDER).toHaveLength(6)
    expect(QUALITY_LADDER[0].id).toBe('ssaoOff')
    expect(QUALITY_LADDER[1].id).toBe('shadows1024')
    expect(QUALITY_LADDER[2].id).toBe('dprDrop1')
    expect(QUALITY_LADDER[3].id).toBe('particlesHalved')
    expect(QUALITY_LADDER[4].id).toBe('bloomMipsDown')
    expect(QUALITY_LADDER[5].id).toBe('fogOff')
  })

  it('2. createQualityManager handles degrade and restore based on fps', () => {
    const qm = createQualityManager()

    // Initial state
    expect(qm.getSettings().ssao).toBe(true)

    // Degrade 1 step
    const changed = qm.update(49)
    expect(changed).toBe(true)
    expect(qm.currentSteps).toBe(1)
    expect(qm.getSettings().ssao).toBe(false)
    expect(qm.getSettings().shadowSize).toBe(2048) // unchanged yet

    // Stable between 50 and 58 -> no change
    const changed2 = qm.update(55)
    expect(changed2).toBe(false)
    expect(qm.currentSteps).toBe(1)

    // Restore 1 step
    const changed3 = qm.update(59)
    expect(changed3).toBe(true)
    expect(qm.currentSteps).toBe(0)
    expect(qm.getSettings().ssao).toBe(true)
  })

  it('3. Does not exceed bounds', () => {
    const qm = createQualityManager()

    // Degrade fully
    for (let i = 0; i < 10; i++) {
        qm.update(20)
    }
    expect(qm.currentSteps).toBe(QUALITY_LADDER.length)

    // Restore fully
    for (let i = 0; i < 10; i++) {
        qm.update(60)
    }
    expect(qm.currentSteps).toBe(0)
  })
})
