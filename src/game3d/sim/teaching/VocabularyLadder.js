export function createVocabularyLadder(vocabularyData = []) {
  // Index vocabulary data by id for fast lookups
  const byId = new Map()
  for (const item of vocabularyData) {
    byId.set(item.id, item)
  }

  return {
    nameFor(conceptId, stage) {
      const concept = byId.get(conceptId)
      if (!concept) return conceptId

      switch (stage) {
        case 0: return concept.physical
        case 1: return concept.game
        case 2: return concept.real
        default: return concept.real
      }
    }
  }
}
