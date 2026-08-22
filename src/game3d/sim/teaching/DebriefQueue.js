export function createDebriefQueue() {
  const q = []

  return {
    get queue() {
      return q
    },

    enqueue(incidentId) {
      q.push(incidentId)
    },

    tryDequeue(scareDirectorActive) {
      if (scareDirectorActive) return null
      if (q.length === 0) return null
      return q.shift()
    }
  }
}
