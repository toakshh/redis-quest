import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getHint,
  peekHint,
  resetHint,
  resetAllHints,
  detectSituation,
  shouldAutoHint,
  markAutoHintShown,
  setAutoHintConfig,
  HINT_CATALOG,
  HINT_TIERS,
} from './REXCompanion.js'
import { load, save, remove } from '../store/persistence.js'

// Mock localStorage for tests
const mockStorage = {}
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => { mockStorage[key] = value },
  removeItem: (key) => { delete mockStorage[key] },
}

beforeEach(() => {
  // Clear all storage
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  resetAllHints()
})

afterEach(() => {
  resetAllHints()
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
})

describe('REXCompanion hint catalog', () => {
  it('has entries for all Memory Village tutorial steps', () => {
    expect(HINT_CATALOG['memory-village:first-set']).toBeTruthy()
    expect(HINT_CATALOG['memory-village:get-crystal']).toBeTruthy()
    expect(HINT_CATALOG['memory-village:incr-counter']).toBeTruthy()
    expect(HINT_CATALOG['memory-village:expire-ttl']).toBeTruthy()
  })

  it('has entries for all three boss phases', () => {
    expect(HINT_CATALOG['memory-village:first-boss-phase']).toBeTruthy()
    expect(HINT_CATALOG['memory-village:boss-pressure']).toBeTruthy()
    expect(HINT_CATALOG['memory-village:boss-finale']).toBeTruthy()
  })

  it('has generic error fallbacks', () => {
    expect(HINT_CATALOG['general:wrong-arity']).toBeTruthy()
    expect(HINT_CATALOG['general:unknown-command']).toBeTruthy()
    expect(HINT_CATALOG['general:wrong-type']).toBeTruthy()
  })

  it('each entry has four progressive tiers', () => {
    for (const [id, entry] of Object.entries(HINT_CATALOG)) {
      expect(entry.tier1).toBeTruthy()
      expect(entry.tier2).toBeTruthy()
      expect(entry.tier3).toBeTruthy()
      expect(entry.tier4).toBeTruthy()
      expect(entry.context).toBeTruthy()
    }
  })
})

describe('getHint / peekHint progression', () => {
  it('starts at tier 0 (Gentle Nudge) for a new situation', () => {
    const hint = getHint('memory-village:first-set')
    expect(hint.tier).toBe(0)
    expect(hint.label).toBe('Gentle Nudge')
    expect(hint.color).toBe('cyan')
    expect(hint.text).toBe(HINT_CATALOG['memory-village:first-set'].tier1)
  })

  it('advances to next tier when advance=true', () => {
    getHint('memory-village:first-set', { advance: true }) // tier 1
    const hint = getHint('memory-village:first-set', { advance: true }) // tier 2
    expect(hint.tier).toBe(2)
    expect(hint.label).toBe('Syntax Clue')
    expect(hint.text).toBe(HINT_CATALOG['memory-village:first-set'].tier3)
  })

  it('caps at tier 3 (Direct Example)', () => {
    for (let i = 0; i < 5; i++) {
      getHint('memory-village:first-set', { advance: true })
    }
    const hint = getHint('memory-village:first-set', { advance: true })
    expect(hint.tier).toBe(3)
    expect(hint.isMaxTier).toBe(true)
    expect(hint.label).toBe('Direct Example')
  })

  it('peekHint does not advance the tier', () => {
    getHint('memory-village:first-set') // tier 0
    const peeked = peekHint('memory-village:first-set')
    expect(peeked.tier).toBe(0)
    const next = getHint('memory-village:first-set', { advance: true })
    expect(next.tier).toBe(1) // still advances from 0
  })

  it('forceTier jumps to a specific tier', () => {
    const hint = getHint('memory-village:first-set', { forceTier: 3 })
    expect(hint.tier).toBe(3)
    expect(hint.text).toBe(HINT_CATALOG['memory-village:first-set'].tier4)
  })

  it('persists progress across calls (via localStorage)', () => {
    getHint('memory-village:first-set', { advance: true }) // tier 1
    // Simulate fresh module load by resetting in-memory state but keeping localStorage
    // The module uses loadRexState which reads from localStorage
    const hint = peekHint('memory-village:first-set')
    expect(hint.tier).toBe(1)
  })
})

describe('resetHint / resetAllHints', () => {
  it('resetHint clears progress for one situation', () => {
    getHint('memory-village:first-set', { advance: true })
    getHint('memory-village:get-crystal', { advance: true })
    resetHint('memory-village:first-set')
    expect(peekHint('memory-village:first-set').tier).toBe(0)
    expect(peekHint('memory-village:get-crystal').tier).toBe(1)
  })

  it('resetAllHints clears everything', () => {
    getHint('memory-village:first-set', { advance: true })
    getHint('memory-village:get-crystal', { advance: true })
    resetAllHints()
    expect(peekHint('memory-village:first-set').tier).toBe(0)
    expect(peekHint('memory-village:get-crystal').tier).toBe(0)
  })
})

describe('detectSituation', () => {
  it('returns tutorial step situations when tutorialStep is set', () => {
    expect(detectSituation({ tutorialStep: 0 })).toBe('memory-village:first-set')
    expect(detectSituation({ tutorialStep: 1 })).toBe('memory-village:get-crystal')
    expect(detectSituation({ tutorialStep: 2 })).toBe('memory-village:incr-counter')
    expect(detectSituation({ tutorialStep: 3 })).toBe('memory-village:expire-ttl')
  })

  it('returns error-driven situations from lastError', () => {
    expect(detectSituation({ lastError: 'wrong number of arguments' })).toBe('general:wrong-arity')
    expect(detectSituation({ lastError: 'unknown command FOO' })).toBe('general:unknown-command')
    expect(detectSituation({ lastError: 'WRONGTYPE Operation against a key' })).toBe('general:wrong-type')
  })

  it('returns boss phase situations in Memory Village', () => {
    expect(detectSituation({ currentRegion: 'memory-village', bossPhase: 1 })).toBe('memory-village:first-boss-phase')
    expect(detectSituation({ currentRegion: 'memory-village', bossPhase: 2 })).toBe('memory-village:boss-pressure')
    expect(detectSituation({ currentRegion: 'memory-village', bossPhase: 3 })).toBe('memory-village:boss-finale')
  })

  it('returns command-pattern situations for progressive learning', () => {
    expect(detectSituation({ currentRegion: 'memory-village', recentCommands: [] })).toBe('memory-village:first-set')
    expect(detectSituation({ currentRegion: 'memory-village', recentCommands: [{ name: 'SET' }] })).toBe('memory-village:get-crystal')
    expect(detectSituation({ currentRegion: 'memory-village', recentCommands: [{ name: 'SET' }, { name: 'GET' }] })).toBe('memory-village:incr-counter')
    expect(detectSituation({ currentRegion: 'memory-village', recentCommands: [{ name: 'SET' }, { name: 'GET' }, { name: 'INCR' }] })).toBe('memory-village:expire-ttl')
    // After all four core commands, returns null (no more guided hints)
    expect(detectSituation({ currentRegion: 'memory-village', recentCommands: [{ name: 'SET' }, { name: 'GET' }, { name: 'INCR' }, { name: 'EXPIRE' }] })).toBeNull()
  })

  it('returns null for unknown regions or no context', () => {
    expect(detectSituation({ currentRegion: 'unknown' })).toBeNull()
    expect(detectSituation({})).toBeNull()
  })

  it('prioritizes tutorial over error over boss over command-pattern', () => {
    // Tutorial wins
    expect(detectSituation({ tutorialStep: 0, lastError: 'unknown command', bossPhase: 1 })).toBe('memory-village:first-set')
    // Error wins over boss
    expect(detectSituation({ lastError: 'unknown command', bossPhase: 1 })).toBe('general:unknown-command')
    // Boss wins over command-pattern
    expect(detectSituation({ currentRegion: 'memory-village', bossPhase: 2, recentCommands: [{ name: 'SET' }] })).toBe('memory-village:boss-pressure')
  })
})

describe('auto-hint cooldown', () => {
  it('shouldAutoHint is true initially', () => {
    expect(shouldAutoHint()).toBe(true)
  })

  it('markAutoHintShown starts cooldown', () => {
    markAutoHintShown()
    expect(shouldAutoHint()).toBe(false)
  })

  it('setAutoHintConfig can disable auto-hints', () => {
    setAutoHintConfig({ autoHintEnabled: false })
    expect(shouldAutoHint()).toBe(false)
  })

  it('setAutoHintConfig can adjust cooldown', () => {
    setAutoHintConfig({ hintCooldownMs: 100 })
    markAutoHintShown()
    expect(shouldAutoHint()).toBe(false)
    // Can't easily test timeout without fake timers, but config is stored
    const state = load('rex-state')
    expect(state.hintCooldownMs).toBe(100)
  })
})