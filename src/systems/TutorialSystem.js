// TutorialSystem — guided onboarding for Memory Village.
// Beginner Mode: step-by-step tutorial with progressive hints.
// Pro Mode: skip tutorial, denser UI, reduced hint frequency.

import { load, save, remove } from '../store/persistence.js'

const TUTORIAL_STORAGE_KEY = 'tutorial-state'
const MODE_STORAGE_KEY = 'player-mode'

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Memory Village',
    description: 'The Memory Well stores crystals of knowledge. Let\'s place your first one.',
    targetCommand: 'SET',
    hintSituation: 'memory-village:first-set',
    completeWhen: (state) => state.wellCrystals >= 1,
    xpReward: 10,
  },
  {
    id: 'retrieve',
    title: 'Recall Your Memory',
    description: 'Use GET to retrieve the crystal you just placed.',
    targetCommand: 'GET',
    hintSituation: 'memory-village:get-crystal',
    completeWhen: (state) => state.lastCommand === 'GET' && state.lastCommandSuccess,
    xpReward: 10,
  },
  {
    id: 'counter',
    title: 'Counting Visits',
    description: 'INCR atomically increments a counter. Try it on a visit tracker.',
    targetCommand: 'INCR',
    hintSituation: 'memory-village:incr-counter',
    completeWhen: (state) => state.lastCommand === 'INCR' && state.lastCommandSuccess,
    xpReward: 10,
  },
  {
    id: 'expire',
    title: 'Memories Fade',
    description: 'Set a TTL with EXPIRE, then check remaining time with TTL.',
    targetCommand: 'EXPIRE',
    hintSituation: 'memory-village:expire-ttl',
    completeWhen: (state) => state.lastCommand === 'TTL' && state.lastCommandSuccess,
    xpReward: 15,
  },
  {
    id: 'boss-intro',
    title: 'The Memory Goblin',
    description: 'A creature hoards false memories. Defeat it by filling the well with real ones.',
    targetCommand: null,
    hintSituation: 'memory-village:first-boss-phase',
    completeWhen: (state) => state.bossPhase >= 1,
    xpReward: 20,
  },
]

export const MODES = {
  beginner: {
    name: 'Beginner',
    description: 'Guided tutorial, generous XP, frequent hints, full UI.',
    xpMultiplier: 1.5,
    hintCooldownMs: 8000,
    showTutorial: true,
    uiDensity: 'comfortable',
    autoHintEnabled: true,
  },
  pro: {
    name: 'Pro',
    description: 'No tutorial, standard XP, minimal hints, compact UI.',
    xpMultiplier: 1.0,
    hintCooldownMs: 20000,
    showTutorial: false,
    uiDensity: 'compact',
    autoHintEnabled: false,
  },
}

function defaultTutorialState() {
  return {
    currentStep: 0,
    completed: false,
    completedSteps: [],
    stepStartTimes: {},
    totalTimeMs: 0,
    skipped: false,
  }
}

function defaultModeState() {
  return {
    mode: 'beginner', // 'beginner' | 'pro'
    selectedAt: Date.now(),
  }
}

function loadTutorialState() {
  return load(TUTORIAL_STORAGE_KEY, defaultTutorialState())
}

function saveTutorialState(state) {
  save(TUTORIAL_STORAGE_KEY, state)
}

function loadModeState() {
  return load(MODE_STORAGE_KEY, defaultModeState())
}

function saveModeState(state) {
  save(MODE_STORAGE_KEY, state)
}

/**
 * Get current tutorial state.
 */
export function getTutorialState() {
  return loadTutorialState()
}

/**
 * Get current mode state.
 */
export function getModeState() {
  return loadModeState()
}

/**
 * Get mode configuration.
 */
export function getModeConfig(mode = null) {
  const m = mode || getModeState().mode
  return MODES[m] || MODES.beginner
}

/**
 * Set player mode (beginner/pro).
 */
export function setMode(mode) {
  if (!MODES[mode]) return false
  const state = { mode, selectedAt: Date.now() }
  saveModeState(state)
  return true
}

/**
 * Start the tutorial (Beginner mode only).
 */
export function startTutorial() {
  const state = defaultTutorialState()
  state.stepStartTimes[TUTORIAL_STEPS[0].id] = Date.now()
  saveTutorialState(state)
  return state
}

/**
 * Advance to next tutorial step.
 */
export function advanceTutorialStep(gameState) {
  const state = loadTutorialState()
  if (state.completed || state.skipped) return state

  const currentStepDef = TUTORIAL_STEPS[state.currentStep]
  if (!currentStepDef) {
    completeTutorial()
    return loadTutorialState()
  }

  // Check completion condition
  if (currentStepDef.completeWhen && currentStepDef.completeWhen(gameState)) {
    const now = Date.now()
    const stepTime = now - (state.stepStartTimes[currentStepDef.id] || now)
    state.completedSteps.push({
      id: currentStepDef.id,
      completedAt: now,
      timeMs: stepTime,
    })
    state.totalTimeMs += stepTime

    state.currentStep++
    if (state.currentStep >= TUTORIAL_STEPS.length) {
      state.completed = true
      state.completedAt = Date.now()
    } else {
      state.stepStartTimes[TUTORIAL_STEPS[state.currentStep].id] = Date.now()
    }
    saveTutorialState(state)
  }
  return loadTutorialState()
}

/**
 * Get current tutorial step definition.
 */
export function getCurrentTutorialStep() {
  const state = loadTutorialState()
  if (state.completed || state.skipped || state.currentStep >= TUTORIAL_STEPS.length) {
    return null
  }
  return TUTORIAL_STEPS[state.currentStep]
}

/**
 * Skip tutorial entirely.
 */
export function skipTutorial() {
  const state = loadTutorialState()
  state.skipped = true
  state.completed = true
  state.completedAt = Date.now()
  saveTutorialState(state)
  return state
}

/**
 * Complete tutorial and award final XP.
 */
export function completeTutorial() {
  const state = loadTutorialState()
  if (state.completed) return state
  state.completed = true
  state.completedAt = Date.now()
  saveTutorialState(state)
  return state
}

/**
 * Reset tutorial progress.
 */
export function resetTutorial() {
  remove(TUTORIAL_STORAGE_KEY)
  return defaultTutorialState()
}

/**
 * Check if tutorial should be shown (Beginner mode + not completed/skipped).
 */
export function shouldShowTutorial() {
  const modeState = getModeState()
  const tutorialState = getTutorialState()
  return modeState.mode === 'beginner' && !tutorialState.completed && !tutorialState.skipped
}

/**
 * Get tutorial progress for UI (0-1).
 */
export function getTutorialProgress() {
  const state = loadTutorialState()
  if (state.completed || state.skipped) return 1
  return state.currentStep / TUTORIAL_STEPS.length
}

/**
 * Update game state from engine command for tutorial tracking.
 * Call this from the store's command handler.
 */
export function updateTutorialFromCommand(commandName, reply, gameStoreState) {
  const tutorialState = loadTutorialState()
  if (tutorialState.completed || tutorialState.skipped) return

  // Track well crystals count (approximate from commands)
  // This is a simplified tracker; the scene has exact count
  advanceTutorialStep({
    wellCrystals: gameStoreState?.wellCrystals || 0,
    lastCommand: commandName,
    lastCommandSuccess: reply?.type !== 'error',
    bossPhase: gameStoreState?.boss?.phase || 0,
  })
}

/**
 * Get the hint situation for the current tutorial step.
 */
export function getCurrentHintSituation() {
  const step = getCurrentTutorialStep()
  return step?.hintSituation || null
}

/**
 * Get XP reward for completing current step.
 */
export function getCurrentStepXPReward() {
  const step = getCurrentTutorialStep()
  return step?.xpReward || 0
}