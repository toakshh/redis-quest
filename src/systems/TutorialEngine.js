// TutorialEngine — validates commands against tutorial steps, tracks progress,
// and emits events for the tutorial system. Pure logic, no UI coupling.
//
// Events emitted:
// - tutorial:started { tutorialId, region }
// - tutorial:stepStarted { tutorialId, stepId, objective, hint }
// - tutorial:stepCompleted { tutorialId, stepId, explanation, reward }
// - tutorial:completed { tutorialId, totalXp }
// - tutorial:skipped { tutorialId }
// - tutorial:failed { tutorialId, stepId, reason }
// - tutorial:hintRequested { tutorialId, stepId, hintLevel }
//
import { EventBus } from './EventBus.js'
import tutorials from '../data/tutorials/tutorials.json'

const HINT_LEVELS = {
  NUDGE: 1,
  CONCEPT: 2,
  SYNTAX: 3,
  EXAMPLE: 4,
}

function parseCommand(input) {
  // Split on whitespace, preserving quoted strings
  const tokens = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

function validateCommand(input, validation) {
  if (!validation) return { valid: true }
  const tokens = parseCommand(input.trim())
  if (tokens.length === 0) return { valid: false, reason: 'empty' }

  const cmd = tokens[0].toUpperCase()
  if (validation.command && cmd !== validation.command.toUpperCase()) {
    return { valid: false, reason: `expected command ${validation.command}, got ${cmd}` }
  }

  if (validation.keyPattern) {
    // Check if any argument matches the key pattern
    const keyFound = tokens.slice(1).some(arg => arg.includes(validation.keyPattern))
    if (!keyFound) {
      return { valid: false, reason: `expected key matching ${validation.keyPattern}` }
    }
  }

  return { valid: true }
}

export function createTutorialEngine({
  eventBus = new EventBus(),
  rng = Math.random,
  now = () => Date.now(),
} = {}) {
  // Tutorial progress state
  const state = {
    currentTutorial: null,
    currentStepIndex: 0,
    completedTutorials: new Set(),
    skippedTutorials: new Set(),
    stepStartTime: null,
  }

  // Get tutorial by ID
  function getTutorial(id) {
    return tutorials.find(t => t.id === id) || null
  }

  // Get tutorials for a region
  function getTutorialsForRegion(regionId) {
    return tutorials.filter(t => t.region === regionId)
  }

  // Get next incomplete tutorial for region
  function getNextTutorial(regionId) {
    const regionTutorials = getTutorialsForRegion(regionId)
    return regionTutorials.find(t => !state.completedTutorials.has(t.id) && !state.skippedTutorials.has(t.id)) || null
  }

  // Start a tutorial
  function startTutorial(tutorialId) {
    const tutorial = getTutorial(tutorialId)
    if (!tutorial) return { success: false, reason: 'not found' }
    if (state.completedTutorials.has(tutorialId)) return { success: false, reason: 'already completed' }
    if (state.skippedTutorials.has(tutorialId)) return { success: false, reason: 'already skipped' }

    state.currentTutorial = tutorial
    state.currentStepIndex = 0
    state.stepStartTime = now()

    eventBus.emit('tutorial:started', { tutorialId, region: tutorial.region })
    return startCurrentStep()
  }

  // Start the current step
  function startCurrentStep() {
    if (!state.currentTutorial) return { success: false, reason: 'no active tutorial' }
    const step = state.currentTutorial.steps[state.currentStepIndex]
    if (!step) return { success: false, reason: 'no step' }

    state.stepStartTime = now()
    eventBus.emit('tutorial:stepStarted', {
      tutorialId: state.currentTutorial.id,
      stepId: step.id,
      objective: step.objective,
      hint: step.hint,
    })
    return { success: true, step }
  }

  // Validate a command against current step
  function validateStep(input) {
    if (!state.currentTutorial) return { valid: false, reason: 'no active tutorial' }
    const step = state.currentTutorial.steps[state.currentStepIndex]
    if (!step) return { valid: false, reason: 'tutorial complete' }

    const result = validateCommand(input, step.validate)
    if (result.valid) {
      completeStep()
    }
    return result
  }

  // Complete current step and advance
  function completeStep() {
    if (!state.currentTutorial) return
    const step = state.currentTutorial.steps[state.currentStepIndex]
    const timeSpent = now() - (state.stepStartTime || now())

    eventBus.emit('tutorial:stepCompleted', {
      tutorialId: state.currentTutorial.id,
      stepId: step.id,
      explanation: step.explanation,
      reward: step.reward,
      timeSpent,
    })

    state.currentStepIndex++
    if (state.currentStepIndex >= state.currentTutorial.steps.length) {
      completeTutorial()
    } else {
      startCurrentStep()
    }
  }

  // Complete the tutorial
  function completeTutorial() {
    if (!state.currentTutorial) return
    const tutorialId = state.currentTutorial.id
    const totalXp = state.currentTutorial.steps.reduce((sum, s) => sum + (s.reward?.xp || 0), 0)

    state.completedTutorials.add(tutorialId)
    const completedTutorial = state.currentTutorial
    state.currentTutorial = null
    state.currentStepIndex = 0

    eventBus.emit('tutorial:completed', { tutorialId, totalXp, tutorial: completedTutorial })
  }

  // Skip current tutorial (pro mode)
  function skipTutorial() {
    if (!state.currentTutorial) return { success: false, reason: 'no active tutorial' }
    const tutorialId = state.currentTutorial.id
    state.skippedTutorials.add(tutorialId)
    state.currentTutorial = null
    state.currentStepIndex = 0

    eventBus.emit('tutorial:skipped', { tutorialId })
    return { success: true }
  }

  // Request a hint for current step
  function requestHint(level = HINT_LEVELS.NUDGE) {
    if (!state.currentTutorial) return { success: false, reason: 'no active tutorial' }
    const step = state.currentTutorial.steps[state.currentStepIndex]
    if (!step) return { success: false, reason: 'no step' }

    // For now, just return the step's built-in hint
    // In future, could escalate based on level
    const hint = step.hint
    eventBus.emit('tutorial:hintRequested', {
      tutorialId: state.currentTutorial.id,
      stepId: step.id,
      hintLevel: level,
      hint,
    })
    return { success: true, hint, level }
  }

  // Get current tutorial state
  function getState() {
    return {
      currentTutorial: state.currentTutorial ? {
        id: state.currentTutorial.id,
        title: state.currentTutorial.title,
        region: state.currentTutorial.region,
        stepIndex: state.currentStepIndex,
        totalSteps: state.currentTutorial.steps.length,
      } : null,
      completedTutorials: [...state.completedTutorials],
      skippedTutorials: [...state.skippedTutorials],
    }
  }

  // Check if tutorial is completed
  function isCompleted(tutorialId) {
    return state.completedTutorials.has(tutorialId)
  }

  // Check if tutorial is skipped
  function isSkipped(tutorialId) {
    return state.skippedTutorials.has(tutorialId)
  }

  // Reset all progress (for testing)
  function reset() {
    state.currentTutorial = null
    state.currentStepIndex = 0
    state.completedTutorials.clear()
    state.skippedTutorials.clear()
    state.stepStartTime = null
  }

  // Serialize for persistence
  function serialize() {
    return {
      completedTutorials: [...state.completedTutorials],
      skippedTutorials: [...state.skippedTutorials],
    }
  }

  // Hydrate from persistence
  function hydrate(saved) {
    if (!saved) return
    if (Array.isArray(saved.completedTutorials)) {
      state.completedTutorials = new Set(saved.completedTutorials)
    }
    if (Array.isArray(saved.skippedTutorials)) {
      state.skippedTutorials = new Set(saved.skippedTutorials)
    }
  }

  return {
    getTutorial,
    getTutorialsForRegion,
    getNextTutorial,
    startTutorial,
    validateStep,
    skipTutorial,
    requestHint,
    getState,
    isCompleted,
    isSkipped,
    reset,
    serialize,
    hydrate,
    HINT_LEVELS,
    eventBus,
  }
}