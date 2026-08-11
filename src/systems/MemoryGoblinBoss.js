// MemoryGoblinBoss — Boss battle state machine for Memory Village.
// Three phases with escalating mechanics:
//   Phase 1 (Hoarding): Goblin fills the well with fake memories. Player must SET
//     real memories faster than the Goblin can corrupt them.
//   Phase 2 (Pressure): TTLs drain rapidly. Player must EXPIRE/refresh keys before
//     they vanish. Golden countdown halos tick faster.
//   Phase 3 (Finale - Memory Leak): Keys proliferate uncontrollably. Player must
//     FLUSHDB to clean the corruption and win.
//
// The boss uses silentExecute to inject keys without awarding player XP.

import { SKILLS, canUnlockSkill } from './SkillTree.js'

export const GOBLIN_PHASES = {
  1: {
    name: 'Hoarding',
    title: 'THE HOARDER\'S GREED',
    description: 'The Goblin stuffs the Memory Well with false memories. Store real ones to push them out!',
    maxHealth: 100,
    damagePerPlayerAction: 15,
    goblinActionIntervalMs: 3000,
    goblinAction: 'spawnFakeMemory',
    playerGoal: 'SET 5 unique keys before Goblin fills 8 slots',
    xpReward: 30,
  },
  2: {
    name: 'Pressure',
    title: 'THE CRUSHING WEIGHT',
    description: 'Memories fade faster than you can recall. Refresh their TTLs before they vanish!',
    maxHealth: 120,
    damagePerPlayerAction: 12,
    goblinActionIntervalMs: 2000,
    goblinAction: 'drainTTL',
    playerGoal: 'Keep 3 keys alive for 30 seconds using EXPIRE/TTL',
    xpReward: 40,
  },
  3: {
    name: 'Finale - Memory Leak',
    title: 'THE MEMORY LEAK',
    description: 'Corrupted memories leak endlessly. Only a complete purge can stop it!',
    maxHealth: 150,
    damagePerPlayerAction: 20,
    goblinActionIntervalMs: 1500,
    goblinAction: 'leakMemory',
    playerGoal: 'FLUSHDB to wipe all corruption',
    xpReward: 50,
  },
}

const FAKE_MEMORY_PREFIX = 'goblin:fake:'
const PLAYER_MEMORY_PREFIX = 'player:memory:'
const LEAK_MEMORY_PREFIX = 'leak:corruption:'

export class MemoryGoblinBoss {
  constructor(engine, gameStore) {
    this.engine = engine
    this.gameStore = gameStore
    this.phase = 0 // 0 = not started, 1-3 = active phase
    this.health = 0
    this.maxHealth = 0
    this.timer = null
    this.playerKeysSet = 0
    this.goblinKeysSpawned = 0
    this.phaseStartTime = 0
    this.keysToKeepAlive = new Set()
    this.isActive = false
    this.onPhaseChange = null
    this.onHealthChange = null
    this.onMessage = null
    this.onDefeated = null
  }

  /**
   * Start the boss battle from phase 1.
   */
  start(onCallbacks = {}) {
    this.onPhaseChange = onCallbacks.onPhaseChange || (() => {})
    this.onHealthChange = onCallbacks.onHealthChange || (() => {})
    this.onMessage = onCallbacks.onMessage || (() => {})
    this.onDefeated = onCallbacks.onDefeated || (() => {})

    this.phase = 1
    this.isActive = true
    this._enterPhase(1)
    this._startGoblinTimer()
    return this._getState()
  }

  /**
   * Handle a player command. Returns { damage, phaseComplete, defeated }.
   */
  handlePlayerCommand(command, args = [], reply) {
    if (!this.isActive || this.phase === 0) return { damage: 0, phaseComplete: false, defeated: false }

    // Support both [cmdName, key, ...] and [key, ...] formats
    const isFirstArgCmd = args[0] && typeof args[0] === 'string' && args[0].toUpperCase() === command.toUpperCase()
    const key = isFirstArgCmd ? args[1] : args[0]

    const phaseDef = GOBLIN_PHASES[this.phase]
    let damage = 0
    let phaseComplete = false

    switch (this.phase) {
      case 1:
        if (command === 'SET' && reply?.type !== 'error' && key && key.startsWith(PLAYER_MEMORY_PREFIX)) {
          this.playerKeysSet++
          damage = phaseDef.damagePerPlayerAction
          this._applyDamage(damage)
          if (this.playerKeysSet >= 5) {
            phaseComplete = true
            this._completePhase({ skipDelay: true }) // skip delay for immediate transition
          }
        }
        break
      case 2:
        if ((command === 'EXPIRE' || command === 'TTL') && reply?.type !== 'error' && key && this.keysToKeepAlive.has(key)) {
          damage = phaseDef.damagePerPlayerAction
          this._applyDamage(damage)
          if (Date.now() - this.phaseStartTime >= 30000) {
            phaseComplete = true
            this._completePhase({ skipDelay: true })
          }
        }
        break
      case 3:
        if (command === 'FLUSHDB' && reply?.type !== 'error') {
          this.health = 0
          this._defeat()
          return { damage: phaseDef.damagePerPlayerAction, phaseComplete: true, defeated: true }
        }
        break
    }
    return { damage, phaseComplete, defeated: this.health <= 0 }
  }

  /**
   * Goblin's autonomous action each interval.
   */
  _goblinAct() {
    if (!this.isActive || this.phase === 0) return

    const phaseDef = GOBLIN_PHASES[this.phase]

    switch (phaseDef.goblinAction) {
      case 'spawnFakeMemory':
        this._spawnFakeMemory()
        break
      case 'drainTTL':
        this._drainTTL()
        break
      case 'leakMemory':
        this._leakMemory()
        break
    }

    // Check phase-specific lose conditions
    this._checkLoseCondition()
  }

  // Phase 1: Goblin spawns fake memories
  _spawnFakeMemory() {
    if (this.goblinKeysSpawned >= 8) return // max slots filled
    const key = `${FAKE_MEMORY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.engine.silentExecute('SET', key, 'false memory')
    this.goblinKeysSpawned++
    this.onMessage?.({
      type: 'goblin-action',
      phase: this.phase,
      text: `The Goblin stuffs a false memory into the well! (${this.goblinKeysSpawned}/8 slots)`,
    })
    this._checkLoseCondition()
  }

  // Phase 2: Goblin drains TTL on player keys
  _drainTTL() {
    // Reduce TTL on all tracked keys by 5 seconds
    for (const key of this.keysToKeepAlive) {
      this.engine.silentExecute('EXPIRE', key, '5')
    }
    this.onMessage?.({
      type: 'goblin-action',
      phase: this.phase,
      text: 'The Goblin squeezes the memories — their glow dims!',
    })
    this._checkLoseCondition()
  }

  // Phase 3: Goblin leaks corruption everywhere
  _leakMemory() {
    const key = `${LEAK_MEMORY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.engine.silentExecute('SET', key, 'corrupted data')
    this.engine.silentExecute('EXPIRE', key, '60')
    this.onMessage?.({
      type: 'goblin-action',
      phase: this.phase,
      text: 'Corrupted memories leak into the well!',
    })
    this._checkLoseCondition()
  }

  _checkLoseCondition() {
    if (this.phase === 1 && this.goblinKeysSpawned >= 8) {
      this.onMessage?.({
        type: 'phase-fail',
        phase: 1,
        text: 'The well is full of false memories! The Goblin\'s hoard wins.',
      })
      this._resetPhase()
    } else if (this.phase === 2 && this.keysToKeepAlive.size === 0) {
      this.onMessage?.({
        type: 'phase-fail',
        phase: 2,
        text: 'All memories have faded! The pressure was too great.',
      })
      this._resetPhase()
    }
    // Phase 3 has no lose condition other than player giving up
  }

  _enterPhase(phaseNum) {
    this.phase = phaseNum
    const phaseDef = GOBLIN_PHASES[phaseNum]
    this.health = phaseDef.maxHealth
    this.maxHealth = phaseDef.maxHealth
    this.phaseStartTime = Date.now()
    this.playerKeysSet = 0
    this.goblinKeysSpawned = 0
    this.keysToKeepAlive.clear()

    // Phase-specific setup
    if (phaseNum === 1) {
      // Clear any existing goblin/player keys
      this.engine.silentExecute('FLUSHDB')
      this.onMessage?.({
        type: 'phase-start',
        phase: 1,
        title: phaseDef.title,
        text: phaseDef.description,
        goal: phaseDef.playerGoal,
      })
    } else if (phaseNum === 2) {
      // Create 3 player keys with short TTLs to maintain
      for (let i = 1; i <= 3; i++) {
        const key = `${PLAYER_MEMORY_PREFIX}anchor${i}`
        this.engine.silentExecute('SET', key, `anchor memory ${i}`)
        this.engine.silentExecute('EXPIRE', key, '10')
        this.keysToKeepAlive.add(key)
      }
      this.onMessage?.({
        type: 'phase-start',
        phase: 2,
        title: phaseDef.title,
        text: phaseDef.description,
        goal: phaseDef.playerGoal,
      })
    } else if (phaseNum === 3) {
      // Spawn initial corruption
      for (let i = 0; i < 10; i++) {
        const key = `${LEAK_MEMORY_PREFIX}init${i}`
        this.engine.silentExecute('SET', key, 'corruption')
        this.engine.silentExecute('EXPIRE', key, '120')
      }
      this.onMessage?.({
        type: 'phase-start',
        phase: 3,
        title: phaseDef.title,
        text: phaseDef.description,
        goal: phaseDef.playerGoal,
      })
    }

    this.onPhaseChange?.(this._getState())
  }

  _completePhase(options = {}) {
    const phaseDef = GOBLIN_PHASES[this.phase]
    this.onMessage?.({
      type: 'phase-complete',
      phase: this.phase,
      text: `Phase ${this.phase} complete! ${phaseDef.name} overcome.`,
      xpReward: phaseDef.xpReward,
    })

    // Award XP via game store
    this.gameStore.addXp(phaseDef.xpReward)

    if (this.phase < 3) {
      // Advance to next phase after brief delay
      const delay = options.skipDelay ? 0 : 2000
      setTimeout(() => {
        this._enterPhase(this.phase + 1)
      }, delay)
    } else {
      // Boss defeated!
      this._defeat()
    }
  }

  _resetPhase() {
    this.onMessage?.({
      type: 'phase-reset',
      phase: this.phase,
      text: `Phase ${this.phase} failed. Try again!`,
    })
    // Re-enter same phase after delay
    setTimeout(() => {
      this._enterPhase(this.phase)
    }, 3000)
  }

  _defeat() {
    this.isActive = false
    this.health = 0
    this._stopGoblinTimer()
    this.onMessage?.({
      type: 'boss-defeated',
      text: 'The Memory Goblin dissolves into motes of light. The well is pure again!',
    })
    this.onDefeated?.(this._getState())
  }

  _applyDamage(damage) {
    this.health = Math.max(0, this.health - damage)
    this.onHealthChange?.({ health: this.health, maxHealth: this.maxHealth, phase: this.phase })
    if (this.health <= 0 && this.phase < 3) {
      // Phases 1-2: health reaching 0 completes the phase
      this._completePhase()
    }
  }

  _startGoblinTimer() {
    this._stopGoblinTimer()
    const tick = () => {
      if (!this.isActive) return
      this._goblinAct()
      const interval = GOBLIN_PHASES[this.phase]?.goblinActionIntervalMs || 2000
      this.timer = setTimeout(tick, interval)
    }
    this.timer = setTimeout(tick, GOBLIN_PHASES[this.phase]?.goblinActionIntervalMs || 2000)
  }

  _stopGoblinTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  _getState() {
    return {
      phase: this.phase,
      phaseName: GOBLIN_PHASES[this.phase]?.name || 'Inactive',
      health: this.health,
      maxHealth: this.maxHealth,
      isActive: this.isActive,
      playerKeysSet: this.playerKeysSet,
      goblinKeysSpawned: this.goblinKeysSpawned,
      keysToKeepAlive: Array.from(this.keysToKeepAlive),
    }
  }

  /**
   * Get current state for UI.
   */
  getState() {
    return this._getState()
  }

  /**
   * Clean up on battle end or region leave.
   */
  destroy() {
    this._stopGoblinTimer()
    this.isActive = false
    this.phase = 0
  }
}

/**
 * Factory to create and bind a Memory Goblin boss to the game store.
 */
export function createMemoryGoblinBoss(engine, gameStore) {
  return new MemoryGoblinBoss(engine, gameStore)
}