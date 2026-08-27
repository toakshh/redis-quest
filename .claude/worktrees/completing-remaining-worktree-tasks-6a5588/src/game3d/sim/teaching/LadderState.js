export function createLadderState({ currentChapter = 1 } = {}) {
  // Map of conceptId -> tier (0 to 3)
  const tiers = new Map()
  // Map of `${conceptId}:${tier}` -> count
  const ledger = new Map()

  return {
    get currentChapter() {
      return currentChapter
    },
    set currentChapter(val) {
      currentChapter = val
    },

    getTier(conceptId) {
      return tiers.get(conceptId) || 0
    },

    setTier(conceptId, tier) {
      const current = this.getTier(conceptId)
      if (tier > current) {
        // clamp to max 3
        tiers.set(conceptId, Math.min(tier, 3))
      }
    },

    canUseTier(tier) {
      // In this game, chapter progression unlocks higher conceptual tiers.
      // E.g., Chapter 1 allows tier 1, Chapter 2 allows tier 2.
      // So tier <= currentChapter.
      return tier <= currentChapter
    },

    recordUsage(conceptId, tier) {
      const key = `${conceptId}:${tier}`
      const current = ledger.get(key) || 0
      ledger.set(key, current + 1)
    },

    getLedger() {
      // Return a plain object or array representation of the ledger
      const entries = []
      for (const [key, count] of ledger.entries()) {
        const [conceptId, tierStr] = key.split(':')
        entries.push({ conceptId, tier: parseInt(tierStr, 10), count })
      }
      return entries
    },

    serialize() {
      return JSON.stringify({
        chapter: currentChapter,
        tiers: Array.from(tiers.entries()),
        ledger: Array.from(ledger.entries())
      })
    },

    deserialize(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      currentChapter = data.chapter || 1
      tiers.clear()
      if (data.tiers) {
        for (const [k, v] of data.tiers) tiers.set(k, v)
      }
      ledger.clear()
      if (data.ledger) {
        for (const [k, v] of data.ledger) ledger.set(k, v)
      }
      return this
    }
  }
}
