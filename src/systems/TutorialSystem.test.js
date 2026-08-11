import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTutorialState,
  getModeState,
  getModeConfig,
  setMode,
  startTutorial,
  advanceTutorialStep,
  getCurrentTutorialStep,
  skipTutorial,
  completeTutorial,
  resetTutorial,
  shouldShowTutorial,
  getTutorialProgress,
  updateTutorialFromCommand,
  getCurrentHintSituation,
  getCurrentStepXPReward,
  TUTORIAL_STEPS,
  MODES,
} from './TutorialSystem.js'
import { load, save, remove } from '../store/persistence.js'

// Mock localStorage
const mockStorage = {}
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => { mockStorage[key] = value },
  removeItem: (key) => { delete mockStorage[key] },
}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  resetTutorial()
  // Reset mode to beginner
  save('redis-quest:player-mode', { mode: 'beginner', selectedAt: Date.now() })
})

afterEach(() => {
  resetTutorial()
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
})

describe('TUTORIAL_STEPS catalog', () => {
  it('has 5 steps for Memory Village', () => {
    expect(TUTORIAL_STEPS.length).toBe(5)
    expect(TUTORIAL_STEPS[0].id).toBe('welcome')
    expect(TUTORIAL_STEPS[1].id).toBe('retrieve')
    expect(TUTORIAL_STEPS[2].id).toBe('counter')
    expect(TUTORIAL_STEPS[3].id).toBe('expire')
    expect(TUTORIAL_STEPS[4].id).toBe('boss-intro')
  })

  it('each step has required properties', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.id).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.description).toBeTruthy()
      expect(step.hintSituation).toBeTruthy()
      expect(typeof step.completeWhen).toBe('function')
      expect(step.xpReward).toBeGreaterThan(0)
    }
  })

  it('first four steps target core commands', () => {
    expect(TUTORIAL_STEPS[0].targetCommand).toBe('SET')
    expect(TUTORIAL_STEPS[1].targetCommand).toBe('GET')
    expect(TUTORIAL_STEPS[2].targetCommand).toBe('INCR')
    expect(TUTORIAL_STEPS[3].targetCommand).toBe('EXPIRE')
  })
})

describe('MODES configuration', () => {
  it('has beginner and pro modes', () => {
    expect(MODES.beginner).toBeTruthy()
    expect(MODES.pro).toBeTruthy()
  })

  it('beginner has higher XP multiplier and shorter hint cooldown', () => {
    expect(MODES.beginner.xpMultiplier).toBe(1.5)
    expect(MODES.pro.xpMultiplier).toBe(1.0)
    expect(MODES.beginner.hintCooldownMs).toBeLessThan(MODES.pro.hintCooldownMs)
  })

  it('beginner shows tutorial, pro does not', () => {
    expect(MODES.beginner.showTutorial).toBe(true)
    expect(MODES.pro.showTutorial).toBe(false)
  })

  it('beginner has comfortable UI, pro has compact', () => {
    expect(MODES.beginner.uiDensity).toBe('comfortable')
    expect(MODES.pro.uiDensity).toBe('compact')
  })
})

describe('Mode persistence', () => {
  it('getModeState returns default beginner mode', () => {
    const state = getModeState()
    expect(state.mode).toBe('beginner')
  })

  it('setMode persists and returns true', () => {
    expect(setMode('pro')).toBe(true)
    expect(getModeState().mode).toBe('pro')
    // Persists across calls
    expect(getModeState().mode).toBe('pro')
  })

  it('setMode rejects invalid mode', () => {
    expect(setMode('invalid')).toBe(false)
    expect(getModeState().mode).toBe('beginner')
  })

  it('getModeConfig returns correct config', () => {
    setMode('pro')
    expect(getModeConfig().xpMultiplier).toBe(1.0)
    expect(getModeConfig('beginner').xpMultiplier).toBe(1.5)
  })
})

describe('Tutorial lifecycle', () => {
  it('startTutorial initializes state at step 0', () => {
    startTutorial()
    const state = getTutorialState()
    expect(state.currentStep).toBe(0)
    expect(state.completed).toBe(false)
    expect(state.skipped).toBe(false)
    expect(state.completedSteps.length).toBe(0)
  })

  it('getCurrentTutorialStep returns first step', () => {
    startTutorial()
    const step = getCurrentTutorialStep()
    expect(step.id).toBe('welcome')
    expect(step.targetCommand).toBe('SET')
  })

  it('advanceTutorialStep moves to next step when condition met', () => {
    startTutorial()
    // Simulate SET command success
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    let step = getCurrentTutorialStep()
    expect(step.id).toBe('retrieve')

    // Simulate GET command success
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'GET', lastCommandSuccess: true, bossPhase: 0 })
    step = getCurrentTutorialStep()
    expect(step.id).toBe('counter')
  })

  it('does not advance on failed command', () => {
    startTutorial()
    advanceTutorialStep({ wellCrystals: 0, lastCommand: 'SET', lastCommandSuccess: false, bossPhase: 0 })
    expect(getCurrentTutorialStep().id).toBe('welcome')
  })

  it('completes tutorial after all steps', () => {
    startTutorial()
    // Complete all steps
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'GET', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'INCR', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'TTL', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'ANY', lastCommandSuccess: true, bossPhase: 1 })

    const state = getTutorialState()
    expect(state.completed).toBe(true)
    expect(getCurrentTutorialStep()).toBeNull()
  })

  it('skipTutorial marks as completed and skipped', () => {
    startTutorial()
    skipTutorial()
    const state = getTutorialState()
    expect(state.skipped).toBe(true)
    expect(state.completed).toBe(true)
    expect(getCurrentTutorialStep()).toBeNull()
  })

  it('completeTutorial marks as completed', () => {
    startTutorial()
    completeTutorial()
    const state = getTutorialState()
    expect(state.completed).toBe(true)
    expect(state.skipped).toBe(false)
  })

  it('resetTutorial clears all progress', () => {
    startTutorial()
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    resetTutorial()
    const state = getTutorialState()
    expect(state.currentStep).toBe(0)
    expect(state.completed).toBe(false)
    expect(state.completedSteps.length).toBe(0)
  })
})

describe('Tutorial progress and hints', () => {
  it('shouldShowTutorial is true for beginner mode with incomplete tutorial', () => {
    setMode('beginner')
    startTutorial()
    expect(shouldShowTutorial()).toBe(true)
  })

  it('shouldShowTutorial is false for pro mode', () => {
    setMode('pro')
    startTutorial()
    expect(shouldShowTutorial()).toBe(false)
  })

  it('shouldShowTutorial is false when tutorial completed', () => {
    setMode('beginner')
    startTutorial()
    completeTutorial()
    expect(shouldShowTutorial()).toBe(false)
  })

  it('getTutorialProgress returns 0-1', () => {
    startTutorial()
    expect(getTutorialProgress()).toBe(0) // 0/5

    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    expect(getTutorialProgress()).toBeCloseTo(0.2) // 1/5

    completeTutorial()
    expect(getTutorialProgress()).toBe(1)
  })

  it('getCurrentHintSituation returns situation for current step', () => {
    startTutorial()
    expect(getCurrentHintSituation()).toBe('memory-village:first-set')
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    expect(getCurrentHintSituation()).toBe('memory-village:get-crystal')
  })

  it('getCurrentStepXPReward returns XP for current step', () => {
    startTutorial()
    expect(getCurrentStepXPReward()).toBe(10)
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'SET', lastCommandSuccess: true, bossPhase: 0 })
    expect(getCurrentStepXPReward()).toBe(10)
    // Last step has 20
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'GET', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'INCR', lastCommandSuccess: true, bossPhase: 0 })
    advanceTutorialStep({ wellCrystals: 1, lastCommand: 'TTL', lastCommandSuccess: true, bossPhase: 0 })
    expect(getCurrentStepXPReward()).toBe(20)
  })
})

describe('updateTutorialFromCommand', () => {
  it('advances tutorial based on command and game state', () => {
    startTutorial()
    updateTutorialFromCommand('SET', { type: 'simple', value: 'OK' }, { wellCrystals: 1, boss: { phase: 0 } })
    expect(getCurrentTutorialStep().id).toBe('retrieve')
  })

  it('does nothing when tutorial completed', () => {
    startTutorial()
    completeTutorial()
    updateTutorialFromCommand('SET', { type: 'simple', value: 'OK' }, { wellCrystals: 1, boss: { phase: 0 } })
    expect(getCurrentTutorialStep()).toBeNull()
  })

  it('does nothing when tutorial skipped', () => {
    startTutorial()
    skipTutorial()
    updateTutorialFromCommand('SET', { type: 'simple', value: 'OK' }, { wellCrystals: 1, boss: { phase: 0 } })
    expect(getCurrentTutorialStep()).toBeNull()
  })
})