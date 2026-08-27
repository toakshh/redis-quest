export function createFlinchMeter() {
  let startTime = 0
  let isMeasuring = false
  let finalFlinch = null

  let maxJerk = 0
  let reversed = 0
  let freezeTime = 0

  let lastX = 0
  let lastY = 0
  let lastDirX = 0
  let lastDirY = 0

  return {
    startMeasurement(clockMs) {
      startTime = clockMs
      isMeasuring = true
      finalFlinch = null

      maxJerk = 0
      reversed = 0
      freezeTime = 0
    },

    update(clockMs, inputData = { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 }) {
      if (!isMeasuring) return

      if (clockMs >= startTime + 400) {
        isMeasuring = false

        // Normalize metrics 0..1 for scoring
        // Assume jerk values > 50 are max.
        const jNorm = Math.min(maxJerk / 50, 1)
        // Assume reversed > 0 is full reversal score
        const rNorm = reversed > 0 ? 1 : 0
        // Assume freezeTime > 100ms is full freeze score
        const fNorm = Math.min(freezeTime / 100, 1)

        const raw = (0.5 * jNorm) + (0.3 * rNorm) + (0.2 * fNorm)
        finalFlinch = Math.max(0, Math.min(1, raw))
        return
      }

      // Mouse jerk
      const dx = inputData.mouseX - lastX
      const dy = inputData.mouseY - lastY
      const jerk = Math.sqrt(dx * dx + dy * dy)
      if (jerk > maxJerk) maxJerk = jerk

      lastX = inputData.mouseX
      lastY = inputData.mouseY

      // Movement reversal
      const dirX = Math.sign(inputData.moveX)
      const dirZ = Math.sign(inputData.moveZ)
      if (lastDirX !== 0 && dirX !== 0 && dirX !== lastDirX) reversed++
      if (lastDirY !== 0 && dirZ !== 0 && dirZ !== lastDirY) reversed++
      lastDirX = dirX
      lastDirY = dirZ

      // Input freeze
      if (jerk < 1 && inputData.moveX === 0 && inputData.moveZ === 0) {
        freezeTime += inputData.dt
      }
    },

    getFlinch() {
      return finalFlinch
    }
  }
}
