import { describe, it, expect } from 'vitest'
import { createRecallGate } from './RecallGate.js'

describe('RecallGate', () => {
  it('1. Starts in pending state', () => {
    const gate = createRecallGate()
    gate.start(1000)
    expect(gate.update(1000)).toBe('pending')
    expect(gate.hasHint).toBe(false)
  })

  it('2. Returns passed if pass() is called before timeout', () => {
    const gate = createRecallGate()
    gate.start(1000)
    expect(gate.update(1500)).toBe('pending')

    gate.pass()
    expect(gate.update(1600)).toBe('passed')
  })

  it('3. Returns failed if time expires', () => {
    const gate = createRecallGate({ timeLimitMs: 45000 })
    gate.start(1000)

    expect(gate.update(1000 + 44000)).toBe('pending')
    expect(gate.update(1000 + 45000)).toBe('failed')
  })
})
