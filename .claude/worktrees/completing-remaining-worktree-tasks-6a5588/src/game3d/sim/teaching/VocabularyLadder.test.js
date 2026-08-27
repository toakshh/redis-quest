import { describe, it, expect } from 'vitest'
import { createVocabularyLadder } from './VocabularyLadder.js'

describe('VocabularyLadder', () => {
  const vocabularyData = [
    {
      id: 'tool_store',
      physical: 'Nail Gun',
      game: 'Data Injector',
      real: 'SET',
      firstSeenChapter: 1
    }
  ]

  it('1. returns physical name for stage 0', () => {
    const ladder = createVocabularyLadder(vocabularyData)
    expect(ladder.nameFor('tool_store', 0)).toBe('Nail Gun')
  })

  it('2. returns game name for stage 1', () => {
    const ladder = createVocabularyLadder(vocabularyData)
    expect(ladder.nameFor('tool_store', 1)).toBe('Data Injector')
  })

  it('3. returns real name for stage 2', () => {
    const ladder = createVocabularyLadder(vocabularyData)
    expect(ladder.nameFor('tool_store', 2)).toBe('SET')
  })

  it('4. returns fallback for missing concept', () => {
    const ladder = createVocabularyLadder(vocabularyData)
    expect(ladder.nameFor('unknown_thing', 0)).toBe('unknown_thing')
  })
})
