export function createScareDirector({ rng = Math.random } = {}) {
  const fatigueMap = new Map()
  let nextScareTime = 0
  let lastTension = null

  function getCadenceBounds(tension) {
    switch (tension) {
      case 'High': return [40000, 75000]
      case 'Medium': return [60000, 120000]
      case 'Low': return [120000, 240000]
      case 'Debrief':
      default: return null
    }
  }

  function scheduleNext(clockMs, tension) {
    const bounds = getCadenceBounds(tension)
    if (!bounds) {
      nextScareTime = Infinity
      return
    }
    const [min, max] = bounds
    nextScareTime = clockMs + min + rng() * (max - min)
  }

  function getFatigue(id, clockMs) {
    const data = fatigueMap.get(id)
    if (!data) return 0
    const dt = Math.max(0, clockMs - data.lastUpdate)
    const decay = dt / 240000 // Decays by 1.0 over 240 seconds
    return Math.max(0, data.level - decay)
  }

  function setFatigue(id, clockMs, level) {
    fatigueMap.set(id, { level, lastUpdate: clockMs })
  }

  return {
    start(clockMs, initialTension = 'Medium') {
      lastTension = initialTension
      scheduleNext(clockMs, initialTension)
    },

    update(clockMs, tension, availableTypes, contextFits = {}, checkFairness = () => true) {
      // Re-evaluate schedule if tension shifted dramatically
      if (tension !== lastTension) {
        if (tension === 'Debrief') {
          nextScareTime = Infinity
        } else if (lastTension === 'Debrief' || nextScareTime === Infinity) {
          scheduleNext(clockMs, tension)
        }
        lastTension = tension
      }

      if (tension === 'Debrief') return null
      if (clockMs < nextScareTime) return null

      const candidates = []
      let totalWeight = 0

      for (const type of availableTypes) {
        // Tension gating
        if (type.minTension === 'High' && (tension === 'Medium' || tension === 'Low')) continue
        if (type.minTension === 'Medium' && tension === 'Low') continue

        if (!checkFairness(type, clockMs)) continue

        const fatigue = getFatigue(type.id, clockMs)
        let fit = contextFits[type.id] !== undefined ? contextFits[type.id] : 1.0

        // Low tension is "heavily weighted toward T3 false scares"
        if (tension === 'Low' && type.id === 'T3') fit *= 5.0

        const weight = type.baseEffectiveness * (1 - fatigue) * fit
        if (weight > 0) {
          candidates.push({ type, weight })
          totalWeight += weight
        }
      }

      if (candidates.length === 0) {
        // Nothing valid to spawn right now, retry soon
        nextScareTime = clockMs + 2000
        return null
      }

      // Weighted random selection
      let roll = rng() * totalWeight
      let selected = candidates[0].type

      for (const cand of candidates) {
        roll -= cand.weight
        if (roll <= 0) {
          selected = cand.type
          break
        }
      }

      // Spike fatigue for chosen scare
      setFatigue(selected.id, clockMs, 1.0)

      // Schedule next event
      scheduleNext(clockMs, tension)

      return selected
    },

    getFatigue,
    getNextScareTime: () => nextScareTime,
    _forceNextTime: (t) => { nextScareTime = t }
  }
}
