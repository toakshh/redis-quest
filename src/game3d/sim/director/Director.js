export function createDirector() {
  let lastUpdateMs = 0
  let currentStress = 0

  let ambientTension = 'Low'
  let targetIntensity = 0
  let spawnBudget = 0
  let reliefWindow = false

  let timeSincePeak = 0
  let isRespite = false
  let respiteTimer = 0

  return {
    update(clockMs, context) {
      if (clockMs - lastUpdateMs < 250) return // every 250ms

      const dt = clockMs - lastUpdateMs
      lastUpdateMs = clockMs

      if (isRespite) {
        respiteTimer -= dt
        if (respiteTimer <= 0) {
          isRespite = false
        }
        else {
          ambientTension = 'Low'
          targetIntensity = 0
          spawnBudget = 0
          reliefWindow = true
          currentStress = 0
          return
        }
      }

      const pttlScore = Math.max(0, 1 - (context.pttl / 300000)) // 5 mins max
      const memScore = Math.min(1, context.memoryBytes / context.memoryLimit)
      const hitScore = Math.max(0, 1 - context.hitRatio) // lower is worse
      const hostilesScore = Math.min(1, context.hostilesNear / 5) // max 5 hostiles
      const damageScore = Math.max(0, 1 - (context.timeSinceDamage / 10000)) // 10s window
      const errorScore = Math.min(1, context.errorRate / 5) // 5 errors/min is max stress

      currentStress =
        (pttlScore * 0.30) +
        (memScore * 0.20) +
        (hitScore * 0.15) +
        (hostilesScore * 0.15) +
        (damageScore * 0.10) +
        (errorScore * 0.10)

      targetIntensity = currentStress

      if (currentStress > 0.8) {
        ambientTension = 'High'
        spawnBudget = 100
        timeSincePeak += dt
      } else if (currentStress > 0.4) {
        ambientTension = 'Medium'
        spawnBudget = 40
        timeSincePeak = 0
      } else {
        ambientTension = 'Low'
        spawnBudget = 10
        timeSincePeak = 0
      }

      // Hard-coded anti-frustration: 20s respite after peak > 45s
      if (timeSincePeak > 45000) {
        isRespite = true
        respiteTimer = 20000
        timeSincePeak = 0
      }

      reliefWindow = false
    },

    getState() {
      return {
        stress: currentStress,
        targetIntensity,
        spawnBudget,
        ambientTension,
        reliefWindow
      }
    }
  }
}
