export function createDramaLedger() {
  const events = []
  const flinchHistory = []
  
  return {
    recordEvent(type, data) {
      events.push({ type, data, timestamp: Date.now() })
    },
    
    recordFlinch(flinchValue) {
      flinchHistory.push(flinchValue)
      if (flinchHistory.length > 20) {
        flinchHistory.shift()
      }
    },
    
    get desensitisation() {
      if (flinchHistory.length === 0) return 0
      const sum = flinchHistory.reduce((a,b) => a+b, 0)
      const avg = sum / flinchHistory.length
      // If average flinch is low (< 0.2), player is desensitised
      return Math.max(0, 1 - (avg * 5))
    },

    get history() {
      return events
    }
  }
}
