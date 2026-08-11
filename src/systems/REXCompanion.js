// REXCompanion — AI hint system for Redis Quest.
// Provides progressive, context-aware hints without spoiling the solution.
// Four tiers of escalating assistance:
//   1. Gentle Nudge   — vague encouragement, no Redis terminology
//   2. Concept Pointer — names the Redis concept (keys, TTL, counters)
//   3. Syntax Clue    — shows the command shape (SET key value)
//   4. Direct Example — complete working command for the current goal

import { load, save } from '../store/persistence.js'

const HINT_STORAGE_KEY = 'rex-hints'
const REX_STORAGE_KEY = 'rex-state'

// Hint catalog keyed by situation ID.
// Each situation defines four progressive hint tiers.
export const HINT_CATALOG = {
  'memory-village:first-set': {
    context: 'first SET command',
    tier1: 'The Memory Well needs its first crystal. Try putting something in it.',
    tier2: 'Use SET to store a value under a key name.',
    tier3: 'Type: SET mykey "my value"',
    tier4: 'SET crystal1 "memory fragment"',
  },
  'memory-village:get-crystal': {
    context: 'retrieve a stored value',
    tier1: 'You placed a crystal — now see what\'s inside.',
    tier2: 'GET fetches the value stored at a key.',
    tier3: 'Type: GET keyname',
    tier4: 'GET crystal1',
  },
  'memory-village:incr-counter': {
    context: 'increment a numeric counter',
    tier1: 'The counter crystal pulses when you add to it.',
    tier2: 'INCR atomically increases a number stored at a key.',
    tier3: 'Type: INCR keyname',
    tier4: 'INCR visits',
  },
  'memory-village:expire-ttl': {
    context: 'set a TTL on a key',
    tier1: 'Memories fade unless you anchor them. Give the crystal a lifespan.',
    tier2: 'EXPIRE sets a time-to-live in seconds. TTL shows remaining time.',
    tier3: 'Type: EXPIRE keyname 60  — then check with TTL keyname',
    tier4: 'EXPIRE beacon 60',
  },
  'memory-village:first-boss-phase': {
    context: 'Memory Goblin Phase 1 - Hoarding',
    tier1: 'The Goblin hoards memories. You need to store several at once.',
    tier2: 'Use multiple SET commands to fill the well before the Goblin strikes.',
    tier3: 'SET goblin:memory1 "a" then SET goblin:memory2 "b" ...',
    tier4: 'SET goblin:loot1 "gold"  then  SET goblin:loot2 "gems"',
  },
  'memory-village:boss-pressure': {
    context: 'Memory Goblin Phase 2 - Pressure',
    tier1: 'The Goblin speeds up! Keys are expiring faster than you can replace them.',
    tier2: 'EXPIRE lets you refresh TTLs. Use it on keys that are about to vanish.',
    tier3: 'Type: TTL keyname to check, then EXPIRE keyname 30 to extend',
    tier4: 'TTL beacon  then  EXPIRE beacon 30',
  },
  'memory-village:boss-finale': {
    context: 'Memory Goblin Phase 3 - Finale (Memory Leak)',
    tier1: 'The Goblin is leaking memories everywhere! Clear the corruption.',
    tier2: 'FLUSHDB wipes the current database — a clean slate stops the leak.',
    tier3: 'Type: FLUSHDB',
    tier4: 'FLUSHDB',
  },
  'general:wrong-arity': {
    context: 'command arity error',
    tier1: 'That command needs more (or fewer) arguments.',
    tier2: 'Check the argument count — each command has a fixed syntax.',
    tier3: 'Example: SET needs a key AND a value. GET needs just a key.',
    tier4: 'SET mykey "value"  —  GET mykey',
  },
  'general:unknown-command': {
    context: 'unknown command',
    tier1: 'That spell isn\'t in the grimoire.',
    tier2: 'Try a core Redis command: SET, GET, INCR, EXPIRE, TTL.',
    tier3: 'Commands are uppercase: SET, GET, INCR, EXPIRE, TTL.',
    tier4: 'SET key value',
  },
  'general:wrong-type': {
    context: 'wrong type operation',
    tier1: 'That crystal doesn\'t work that way.',
    tier2: 'Each key holds one data type. You can\'t INCR a string that isn\'t a number.',
    tier3: 'Check the key\'s type with TYPE keyname first.',
    tier4: 'TYPE mykey  then  INCR mykey  (if it\'s an integer)',
  },
}

export const HINT_TIERS = ['tier1', 'tier2', 'tier3', 'tier4']
export const TIER_LABELS = ['Gentle Nudge', 'Concept Pointer', 'Syntax Clue', 'Direct Example']
export const TIER_COLORS = ['cyan', 'blue', 'amber', 'green']

// Persistent REX state: which hints have been shown, current tier per situation
function defaultRexState() {
  return {
    // situationId -> { tier: 0-3, shownAt: timestamp }
    hintProgress: {},
    // Global settings
    autoHintEnabled: true,
    hintCooldownMs: 8000, // minimum time between auto-hints
    lastAutoHintAt: 0,
  }
}

function loadRexState() {
  return load(REX_STORAGE_KEY, defaultRexState())
}

function saveRexState(state) {
  save(REX_STORAGE_KEY, state)
}

/**
 * Get the current hint for a situation, advancing the tier if requested.
 * @param {string} situationId - key in HINT_CATALOG
 * @param {object} opts
 * @param {boolean} opts.advance - if true, move to next tier (capped at 3)
 * @param {boolean} opts.forceTier - if set, jump to specific tier 0-3
 * @returns {object|null} { situationId, tier, text, label, color, isMaxTier } or null if unknown situation
 */
export function getHint(situationId, opts = {}) {
  const catalog = HINT_CATALOG[situationId]
  if (!catalog) return null

  const state = loadRexState()
  let progress = state.hintProgress[situationId] || { tier: 0, shownAt: 0 }

  if (opts.forceTier !== undefined) {
    progress.tier = Math.max(0, Math.min(3, opts.forceTier))
  } else if (opts.advance) {
    progress.tier = Math.min(3, progress.tier + 1)
  }

  progress.shownAt = Date.now()
  state.hintProgress[situationId] = progress
  saveRexState(state)

  const tierKey = HINT_TIERS[progress.tier]
  return {
    situationId,
    tier: progress.tier,
    text: catalog[tierKey],
    label: TIER_LABELS[progress.tier],
    color: TIER_COLORS[progress.tier],
    isMaxTier: progress.tier === 3,
    context: catalog.context,
  }
}

/**
 * Peek at the current hint without advancing.
 */
export function peekHint(situationId) {
  return getHint(situationId, { advance: false })
}

/**
 * Reset hint progress for a situation (e.g., on region reset).
 */
export function resetHint(situationId) {
  const state = loadRexState()
  delete state.hintProgress[situationId]
  saveRexState(state)
}

/**
 * Reset all hint progress.
 */
export function resetAllHints() {
  const state = defaultRexState()
  saveRexState(state)
}

/**
 * Get the auto-hint config.
 */
export function getAutoHintConfig() {
  return loadRexState()
}

/**
 * Update auto-hint config.
 */
export function setAutoHintConfig(config) {
  const state = loadRexState()
  Object.assign(state, config)
  saveRexState(state)
}

/**
 * Determine which situation is relevant based on game context.
 * This is called by the UI to decide what hint to show.
 * @param {object} context - { recentCommands, currentRegion, bossPhase, lastError, tutorialStep }
 * @returns {string|null} situationId or null
 */
export function detectSituation(context) {
  const { recentCommands, currentRegion, bossPhase, lastError, tutorialStep } = context

  // Tutorial-driven situations (highest priority)
  if (tutorialStep !== undefined) {
    if (tutorialStep === 0) return 'memory-village:first-set'
    if (tutorialStep === 1) return 'memory-village:get-crystal'
    if (tutorialStep === 2) return 'memory-village:incr-counter'
    if (tutorialStep === 3) return 'memory-village:expire-ttl'
  }

  // Error-driven situations
  if (lastError) {
    if (lastError.includes('wrong number of arguments')) return 'general:wrong-arity'
    if (lastError.includes('unknown command')) return 'general:unknown-command'
    if (lastError.includes('WRONGTYPE')) return 'general:wrong-type'
  }

  // Boss phase situations
  if (currentRegion === 'memory-village' && bossPhase) {
    if (bossPhase === 1) return 'memory-village:first-boss-phase'
    if (bossPhase === 2) return 'memory-village:boss-pressure'
    if (bossPhase === 3) return 'memory-village:boss-finale'
  }

  // Command-pattern situations (progressive learning)
  const cmds = recentCommands || []
  const lastCmd = cmds[0]?.name?.toUpperCase()
  const hasSet = cmds.some((c) => c.name === 'SET')
  const hasGet = cmds.some((c) => c.name === 'GET')
  const hasIncr = cmds.some((c) => c.name === 'INCR')
  const hasExpire = cmds.some((c) => c.name === 'EXPIRE')
  const hasTtl = cmds.some((c) => c.name === 'TTL')

  if (currentRegion === 'memory-village') {
    if (!hasSet) return 'memory-village:first-set'
    if (hasSet && !hasGet) return 'memory-village:get-crystal'
    if (hasGet && !hasIncr) return 'memory-village:incr-counter'
    if (hasIncr && !hasExpire) return 'memory-village:expire-ttl'
  }

  return null
}

/**
 * Check if an auto-hint should fire (respects cooldown).
 */
export function shouldAutoHint() {
  const state = loadRexState()
  if (!state.autoHintEnabled) return false
  const now = Date.now()
  return now - state.lastAutoHintAt >= state.hintCooldownMs
}

/**
 * Mark that an auto-hint was shown (updates cooldown).
 */
export function markAutoHintShown() {
  const state = loadRexState()
  state.lastAutoHintAt = Date.now()
  saveRexState(state)
}