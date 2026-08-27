// Command Mastery Engine for Redis Quest
// Tracks command proficiency, guided/independent usage, failure rates, and mastery score progression (0.0 - 1.0).

export class MasteryEngine {
  constructor(initialData = {}) {
    this.masteryMap = new Map()
    if (initialData && typeof initialData === 'object') {
      this.loadMasteryData(initialData)
    }
  }

  /**
   * Load or initialize mastery state from an object map.
   * @param {Object} data
   */
  loadMasteryData(data = {}) {
    for (const [cmd, info] of Object.entries(data)) {
      if (!cmd) continue
      const canonical = String(cmd).trim().toUpperCase()
      const guidedUses = Math.max(0, info.guidedUses || 0)
      const independentUses = Math.max(0, info.independentUses || 0)
      const failures = Math.max(0, info.failures || 0)
      const introduced = info.introduced !== undefined
        ? Boolean(info.introduced)
        : (guidedUses + independentUses + failures > 0)
      
      const masteryScore = info.masteryScore !== undefined
        ? Math.max(0.0, Math.min(1.0, Number(info.masteryScore)))
        : this.calculateMasteryScore(guidedUses, independentUses, failures)

      this.masteryMap.set(canonical, {
        introduced,
        guidedUses,
        independentUses,
        failures,
        masteryScore,
      })
    }
  }

  /**
   * Calculate mastery score (0.0 - 1.0) based on usage metrics.
   * - Independent (contextual) uses: +0.20 each
   * - Guided uses: +0.10 each
   * - Failures: -0.05 each
   * Clamped strictly to range [0.0, 1.0].
   */
  calculateMasteryScore(guidedUses = 0, independentUses = 0, failures = 0) {
    const raw = (guidedUses * 0.10) + (independentUses * 0.20) - (failures * 0.05)
    return Math.max(0.0, Math.min(1.0, Math.round(raw * 100) / 100))
  }

  /**
   * Get mastery status for a specific command.
   * Returns default structure `{ introduced: false, guidedUses: 0, independentUses: 0, failures: 0, masteryScore: 0.0 }` if unrecorded.
   * @param {string} cmd
   * @returns {{ introduced: boolean, guidedUses: number, independentUses: number, failures: number, masteryScore: number }}
   */
  getCommandMastery(cmd) {
    if (!cmd) {
      return { introduced: false, guidedUses: 0, independentUses: 0, failures: 0, masteryScore: 0.0 }
    }
    const canonical = String(cmd).trim().toUpperCase()
    const record = this.masteryMap.get(canonical)
    if (!record) {
      return { introduced: false, guidedUses: 0, independentUses: 0, failures: 0, masteryScore: 0.0 }
    }
    return { ...record }
  }

  /**
   * Get mastery map for all recorded commands.
   * @returns {Object<string, { introduced: boolean, guidedUses: number, independentUses: number, failures: number, masteryScore: number }>}
   */
  getAllMastery() {
    const result = {}
    for (const [cmd, record] of this.masteryMap.entries()) {
      result[cmd] = { ...record }
    }
    return result
  }

  /**
   * Record usage of a command and recalculate its mastery score.
   * @param {string} cmd - Command name (e.g. 'SET', 'GET')
   * @param {boolean} [success=true] - Whether command execution succeeded
   * @param {boolean} [contextual=false] - Whether command was used independently in context (vs guided/tutorial)
   * @returns {{ introduced: boolean, guidedUses: number, independentUses: number, failures: number, masteryScore: number }}
   */
  recordCommandUsage(cmd, success = true, contextual = false) {
    if (!cmd) return null
    const canonical = String(cmd).trim().toUpperCase()
    const current = this.masteryMap.get(canonical) || {
      introduced: false,
      guidedUses: 0,
      independentUses: 0,
      failures: 0,
      masteryScore: 0.0,
    }

    const isSuccess = Boolean(success)
    const isContextual = Boolean(contextual)

    const updated = {
      introduced: true,
      guidedUses: current.guidedUses + (isSuccess && !isContextual ? 1 : 0),
      independentUses: current.independentUses + (isSuccess && isContextual ? 1 : 0),
      failures: current.failures + (!isSuccess ? 1 : 0),
      masteryScore: 0.0,
    }

    updated.masteryScore = this.calculateMasteryScore(
      updated.guidedUses,
      updated.independentUses,
      updated.failures
    )

    this.masteryMap.set(canonical, updated)
    return { ...updated }
  }

  /**
   * Reset all mastery progression.
   */
  reset() {
    this.masteryMap.clear()
  }
}

// Singleton default instance for direct functional export usage
export const defaultMasteryEngine = new MasteryEngine()

export function recordCommandUsage(cmd, success = true, contextual = false) {
  return defaultMasteryEngine.recordCommandUsage(cmd, success, contextual)
}

export function getCommandMastery(cmd) {
  return defaultMasteryEngine.getCommandMastery(cmd)
}

export function getAllMastery() {
  return defaultMasteryEngine.getAllMastery()
}
