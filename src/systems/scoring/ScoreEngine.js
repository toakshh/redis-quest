// Incident Scoring Engine for Redis Quest
// Calculates incident performance scores (0-1000), letter ranks (S, A, B, C), and detailed score breakdowns.

/**
 * Incident Performance Rank thresholds
 */
export const RANK_THRESHOLDS = {
  S: 900,
  A: 750,
  B: 600,
  C: 0,
}

/**
 * Determine letter rank from numerical score (0 - 1000)
 * @param {number} score
 * @returns {'S' | 'A' | 'B' | 'C'}
 */
export function calculateRank(score) {
  if (score >= RANK_THRESHOLDS.S) return 'S'
  if (score >= RANK_THRESHOLDS.A) return 'A'
  if (score >= RANK_THRESHOLDS.B) return 'B'
  return 'C'
}

/**
 * Calculate incident performance score, rank, and detailed breakdown.
 *
 * @param {object} metrics
 * @param {number} [metrics.resolutionTime] - Time taken to resolve incident in seconds
 * @param {number} [metrics.targetTime] - Target optimal resolution time in seconds (default 60)
 * @param {number} [metrics.commandsUsed] - Number of commands executed during incident
 * @param {number} [metrics.optimalCommands] - Target optimal number of commands (default 5)
 * @param {number} [metrics.unnecessaryWrites] - Number of unnecessary write operations executed
 * @param {number} [metrics.hintsUsed] - Number of hints requested
 * @param {number} [metrics.systemHealth] - Final system health percentage (0-100, default 100)
 * @returns {{ score: number, rank: string, breakdown: object }}
 */
export function calculateIncidentScore(metrics = {}) {
  const m = metrics || {}

  const resolutionTime = Math.max(0, m.resolutionTime ?? m.timeSeconds ?? m.timeTaken ?? 0)
  const targetTime = Math.max(1, m.targetTime ?? m.optimalTime ?? 60)
  const commandsUsed = Math.max(0, m.commandsUsed ?? m.commandCount ?? 0)
  const optimalCommands = Math.max(0, m.optimalCommands ?? m.targetCommands ?? (commandsUsed > 0 ? commandsUsed : 5))
  const unnecessaryWrites = Math.max(0, m.unnecessaryWrites ?? m.unnecessaryWriteCount ?? 0)
  const hintsUsed = Math.max(0, m.hintsUsed ?? m.hintCount ?? 0)
  const systemHealth = Math.max(0, Math.min(100, m.systemHealth ?? m.healthPercent ?? m.healthPercentage ?? m.health ?? 100))

  // System Health Component (max 300)
  const systemHealthScore = Math.round((systemHealth / 100) * 300)

  // Resolution Time Component (max 350)
  // Full points if within target time; deducts 5 points per excess second.
  let timeScore = 350
  if (resolutionTime > targetTime) {
    const excessTime = resolutionTime - targetTime
    timeScore = Math.max(0, 350 - Math.round(excessTime * 5))
  }

  // Command Efficiency Component (max 350)
  // Full points if commands used <= optimalCommands; deducts 30 points per excess command.
  let commandScore = 350
  if (commandsUsed > optimalCommands) {
    const excessCommands = commandsUsed - optimalCommands
    commandScore = Math.max(0, 350 - Math.round(excessCommands * 30))
  }

  // Penalties (50 pts per unnecessary write / hint used)
  const unnecessaryWritePenalty = unnecessaryWrites * 50
  const hintPenalty = hintsUsed * 50

  const rawScore = systemHealthScore + timeScore + commandScore - unnecessaryWritePenalty - hintPenalty
  const score = Math.max(0, Math.min(1000, Math.round(rawScore)))
  const rank = calculateRank(score)

  const breakdown = {
    systemHealthScore,
    timeScore,
    commandScore,
    unnecessaryWritePenalty,
    hintPenalty,
    rawScore,
    finalScore: score,
    resolutionTime,
    targetTime,
    commandsUsed,
    optimalCommands,
    unnecessaryWrites,
    hintsUsed,
    systemHealth,
  }

  return {
    score,
    rank,
    breakdown,
  }
}

export class ScoreEngine {
  calculateIncidentScore(metrics) {
    return calculateIncidentScore(metrics)
  }
}
