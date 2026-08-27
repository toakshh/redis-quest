export function createStoryGraph(beatsPool) {
  const completed = []
  
  return {
    get availableBeats() {
      return beatsPool.filter(beat => !completed.includes(beat.id))
    },
    
    get completed() {
      return completed
    },

    evaluate(context) {
      const candidates = this.availableBeats.filter(beat => {
        if (!beat.requires) return true
        return beat.requires.every(req => req(context))
      })

      if (candidates.length === 0) return null

      // Sort by weight descending
      candidates.sort((a, b) => (b.weight || 1) - (a.weight || 1))
      
      return candidates[0]
    },

    markComplete(beatId) {
      if (!completed.includes(beatId)) {
        completed.push(beatId)
      }
    }
  }
}
