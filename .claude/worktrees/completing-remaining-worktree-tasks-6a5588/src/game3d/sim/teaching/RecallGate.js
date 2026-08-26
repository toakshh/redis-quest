export function createRecallGate({ debriefData, timeLimitMs = 45000 } = {}) {
  let startTime = 0
  let passed = false
  let active = false

  return {
    get debriefData() {
      return debriefData
    },

    get hasHint() { // Explicitly no hints
      return false
    },

    start(clockMs) {
      startTime = clockMs
      active = true
      passed = false
    },

    pass() {
      if (active) passed = true
    },

    update(clockMs) {
      if (!active) return 'pending' // or inactive
      if (passed) {
        active = false
        return 'passed'
      }

      if (clockMs - startTime >= timeLimitMs) {
        active = false
        return 'failed'
      }

      return 'pending'
    }
  }
}
