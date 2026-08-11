// Survival Mode System - manages the 6 survival challenges

import { survivalChallenges } from '../data/survival/challenges.js'

export class SurvivalMode {
  constructor(gameStore) {
    this.gameStore = gameStore
    this.activeChallenge = null
    this.challengeState = {
      startTime: 0,
      stats: {},
      completed: false,
      failed: false,
      seed: null,
    }
    this.tickInterval = null
  }

  // Get all available challenges
  getChallenges() {
    return survivalChallenges
  }

  // Get a specific challenge by ID
  getChallenge(id) {
    return survivalChallenges.find(c => c.id === id)
  }

  // Start a challenge
  startChallenge(challengeId) {
    const challenge = this.getChallenge(challengeId)
    if (!challenge) return { success: false, error: 'Challenge not found' }

    const state = this.gameStore.getState()

    // Check if unlocked (must complete Region 14 first)
    if (!state.bossHistory.some(b => b.id === 'redis-core' && b.won)) {
      return { success: false, error: 'Complete Redis Core region first to unlock Survival Mode' }
    }

    this.activeChallenge = challenge
    this.challengeState = {
      startTime: Date.now(),
      stats: this.getInitialStats(challenge),
      completed: false,
      failed: false,
      seed: challenge.seed,
    }

    // Setup challenge (run setup commands)
    this.runSetup(challenge)

    // Start tick loop for time-based challenges
    this.startTickLoop(challenge)

    this.gameStore.getState().addSurvivalChallenge?.(challengeId, this.challengeState)

    return { success: true, challenge, state: this.challengeState }
  }

  getInitialStats(challenge) {
    const baseStats = {
      opsPerSecond: 0,
      totalCommands: 0,
      slowlogCount: 0,
      sessionLoss: 0,
      replicationLag: 0,
      eventsProcessed: 0,
      dashboardLatency: 0,
      jobsProcessed: 0,
      failureRate: 0,
      driversIndexed: 0,
      ridesDispatched: 0,
      intrusionsDetected: 0,
      alertLatency: 0,
    }

    // Challenge-specific initial stats
    switch (challenge.id) {
      case 'black-friday-surge':
        return { ...baseStats, targetOpsPerSec: challenge.targetOpsPerSec }
      case 'global-session-sync':
        return { ...baseStats, regionsConnected: 0 }
      case 'realtime-analytics':
        return { ...baseStats, targetEventsPerSec: challenge.targetEventsPerSec }
      case 'job-queue-resilience':
        return { ...baseStats, targetJobs: challenge.targetJobs, maxFailureRate: challenge.maxFailureRate }
      case 'geospatial-services':
        return { ...baseStats }
      case 'security-audit-trail':
        return { ...baseStats }
      default:
        return baseStats
    }
  }

  runSetup(challenge) {
    const engine = this.gameStore.getState().engine
    if (!engine) return

    // Execute setup commands from challenge definition
    if (challenge.setup) {
      const lines = challenge.setup.trim().split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('--')) {
          try {
            engine.execute(trimmed)
          } catch (e) {
            console.warn('Setup command failed:', trimmed, e)
          }
        }
      }
    }
  }

  startTickLoop(challenge) {
    if (this.tickInterval) clearInterval(this.tickInterval)

    this.tickInterval = setInterval(() => {
      this.updateChallenge(challenge)
    }, 1000) // Update every second
  }

  updateChallenge(challenge) {
    const elapsed = Date.now() - this.challengeState.startTime
    const remaining = challenge.duration - elapsed

    if (remaining <= 0) {
      this.endChallenge(false, 'Time expired')
      return
    }

    // Update stats based on engine activity
    this.collectStats(challenge)

    // Check completion criteria
    if (this.checkCompletion(challenge)) {
      this.endChallenge(true, 'Challenge completed!')
      return
    }

    // Check failure criteria
    if (this.checkFailure(challenge)) {
      this.endChallenge(false, 'Challenge failed')
      return
    }

    // Notify UI of progress
    this.gameStore.getState().updateSurvivalProgress?.({
      challengeId: challenge.id,
      elapsed,
      remaining,
      stats: this.challengeState.stats,
      progress: this.calculateProgress(challenge),
    })
  }

  collectStats(challenge) {
    const engine = this.gameStore.getState().engine
    if (!engine) return

    const stats = engine.stats

    // Update common stats
    this.challengeState.stats.opsPerSecond = Math.round(stats.opsPerSecond)
    this.challengeState.stats.totalCommands = stats.totalCommands
    this.challengeState.stats.slowlogCount = (window.__slowlog?.length || 0)

    // Challenge-specific stats collection
    switch (challenge.id) {
      case 'black-friday-surge':
        this.collectBlackFridayStats(engine)
        break
      case 'global-session-sync':
        this.collectGlobalSyncStats(engine)
        break
      case 'realtime-analytics':
        this.collectAnalyticsStats(engine)
        break
      case 'job-queue-resilience':
        this.collectJobQueueStats(engine)
        break
      case 'geospatial-services':
        this.collectGeoStats(engine)
        break
      case 'security-audit-trail':
        this.collectSecurityStats(engine)
        break
    }
  }

  collectBlackFridayStats(engine) {
    // Simulate pipeline usage detection
    const pipelinedCommands = Math.floor(engine.stats.totalCommands * 0.95)
    this.challengeState.stats.pipelineUsage = pipelinedCommands / Math.max(engine.stats.totalCommands, 1)
  }

  collectGlobalSyncStats(engine) {
    // Check cluster nodes
    const clusterInfo = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'INFO'])
    if (clusterInfo && clusterInfo.value) {
      const lines = clusterInfo.value.split('\r\n')
      for (const line of lines) {
        if (line.startsWith('cluster_known_nodes:')) {
          this.challengeState.stats.regionsConnected = parseInt(line.split(':')[1]) || 0
        }
      }
    }
  }

  collectAnalyticsStats(engine) {
    // Track stream entries
    const store = engine.store
    let streamCount = 0
    for (const entry of store.values()) {
      if (entry.type === 'stream') {
        streamCount += entry.value?.length || 0
      }
    }
    this.challengeState.stats.eventsProcessed = streamCount
  }

  collectJobQueueStats(engine) {
    // Count list lengths for job queues
    let jobsProcessed = 0
    for (const entry of engine.store.values()) {
      if (entry.type === 'list') {
        jobsProcessed += entry.value?.length || 0
      }
    }
    this.challengeState.stats.jobsProcessed = jobsProcessed
  }

  collectGeoStats(engine) {
    // Count geo entries
    let geoCount = 0
    for (const entry of engine.store.values()) {
      if (entry.type === 'geo') {
        geoCount += entry.value?.size || 0
      }
    }
    this.challengeState.stats.driversIndexed = geoCount
  }

  collectSecurityStats(engine) {
    // Count audit stream entries
    let auditCount = 0
    for (const entry of engine.store.values()) {
      if (entry.type === 'stream' && entry.key?.startsWith('audit:')) {
        auditCount += entry.value?.length || 0
      }
    }
    this.challengeState.stats.intrusionsDetected = auditCount
  }

  checkCompletion(challenge) {
    const stats = this.challengeState.stats
    const validation = challenge.validation

    if (validation) {
      return validation(this.gameStore.getState().engine, stats)
    }

    // Default: check all objectives
    return challenge.objectives.every(obj => {
      const value = stats[obj.id] || 0
      return value >= obj.target
    })
  }

  checkFailure(challenge) {
    const stats = this.challengeState.stats

    // Challenge-specific failure conditions
    switch (challenge.id) {
      case 'black-friday-surge':
        return stats.slowlogCount > 10 || stats.opsPerSecond < challenge.targetOpsPerSec * 0.5
      case 'global-session-sync':
        return stats.sessionLoss > 0
      case 'realtime-analytics':
        return stats.dashboardLatency > 500
      case 'job-queue-resilience':
        return stats.failureRate > challenge.maxFailureRate
      case 'geospatial-services':
        return stats.driversIndexed < 1000 // Minimum threshold
      case 'security-audit-trail':
        return stats.alertLatency > 1000
      default:
        return false
    }
  }

  calculateProgress(challenge) {
    const stats = this.challengeState.stats
    let totalProgress = 0

    for (const obj of challenge.objectives) {
      const value = stats[obj.id] || 0
      const progress = Math.min(value / obj.target, 1)
      totalProgress += progress
    }

    return Math.round((totalProgress / challenge.objectives.length) * 100)
  }

  endChallenge(success, message) {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }

    this.challengeState.completed = success
    this.challengeState.failed = !success
    this.challengeState.endTime = Date.now()
    this.challengeState.duration = this.challengeState.endTime - this.challengeState.startTime

    if (success) {
      this.grantRewards(this.activeChallenge)
    }

    this.gameStore.getState().completeSurvivalChallenge?.(
      this.activeChallenge.id,
      success,
      this.challengeState
    )

    this.activeChallenge = null
  }

  grantRewards(challenge) {
    const state = this.gameStore.getState()

    // Grant XP
    state.addXp?.(challenge.rewards.xp)

    // Unlock cosmetic
    // state.unlockCosmetic?.(challenge.rewards.cosmetic)

    // Grant title
    // state.unlockTitle?.(challenge.rewards.title)

    // Add to leaderboard
    this.updateLeaderboard(challenge)

    // Record in boss history as a special survival win
    state.bossHistory.push({
      id: `survival-${challenge.id}`,
      name: `Survival: ${challenge.name}`,
      won: true,
      at: Date.now(),
      xp: challenge.rewards.xp,
    })
  }

  updateLeaderboard(challenge) {
    const state = this.gameStore.getState()
    const entry = {
      player: 'Player', // Would be actual player name
      score: this.challengeState.stats.totalCommands || 0,
      time: this.challengeState.duration,
      date: Date.now(),
    }

    challenge.leaderboard.global.push(entry)
    challenge.leaderboard.global.sort((a, b) => b.score - a.score)
    challenge.leaderboard.global = challenge.leaderboard.global.slice(0, 100)

    // Personal best
    const personal = challenge.leaderboard.personal
    if (!personal.length || entry.score > personal[0].score) {
      personal.unshift(entry)
      challenge.leaderboard.personal = personal.slice(0, 10)
    }
  }

  // Get current challenge state
  getState() {
    return {
      activeChallenge: this.activeChallenge,
      ...this.challengeState,
    }
  }

  // Pause/resume
  pause() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }

  resume(challenge) {
    if (this.activeChallenge && !this.tickInterval) {
      this.startTickLoop(challenge)
    }
  }

  // Abandon current challenge
  abandon() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    this.activeChallenge = null
    this.challengeState = {
      startTime: 0,
      stats: {},
      completed: false,
      failed: false,
      seed: null,
    }
  }
}

// Export singleton creator
export function createSurvivalMode(gameStore) {
  return new SurvivalMode(gameStore)
}