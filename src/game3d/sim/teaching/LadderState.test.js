import { describe, it, expect } from 'vitest'
import { createLadderState } from './LadderState.js'

describe('LadderState', () => {
  it('1. Never decreases tier on setTier', () => {
    const ls = createLadderState()
    expect(ls.getTier('ping')).toBe(0)

    ls.setTier('ping', 2)
    expect(ls.getTier('ping')).toBe(2)

    ls.setTier('ping', 1) // should be ignored
    expect(ls.getTier('ping')).toBe(2)

    ls.setTier('ping', 5) // max 3
    expect(ls.getTier('ping')).toBe(3)
  })

  it('2. canUseTier respects current chapter', () => {
    const ls = createLadderState({ currentChapter: 1 })
    expect(ls.canUseTier(1)).toBe(true)
    expect(ls.canUseTier(2)).toBe(false)

    ls.currentChapter = 2
    expect(ls.canUseTier(2)).toBe(true)
    expect(ls.canUseTier(3)).toBe(false)
  })

  it('3. recordUsage accumulates in the ledger', () => {
    const ls = createLadderState()
    ls.recordUsage('ping', 1)
    ls.recordUsage('ping', 1)
    ls.recordUsage('ping', 2)
    ls.recordUsage('get', 1)

    const ledger = ls.getLedger()
    expect(ledger).toContainEqual({ conceptId: 'ping', tier: 1, count: 2 })
    expect(ledger).toContainEqual({ conceptId: 'ping', tier: 2, count: 1 })
    expect(ledger).toContainEqual({ conceptId: 'get', tier: 1, count: 1 })
  })

  it('4. serializes and deserializes correctly', () => {
    const ls = createLadderState({ currentChapter: 2 })
    ls.setTier('ping', 2)
    ls.recordUsage('ping', 1)

    const str = ls.serialize()
    const ls2 = createLadderState().deserialize(str)

    expect(ls2.currentChapter).toBe(2)
    expect(ls2.getTier('ping')).toBe(2)
    expect(ls2.getLedger()).toEqual([{ conceptId: 'ping', tier: 1, count: 1 }])
  })
})
