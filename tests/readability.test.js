import { describe, it, expect } from 'vitest'
import {
  countSyllables,
  fleschReadingEase,
  fleschKincaidGrade,
  readabilityReport,
  checkAllReadability,
  SEVENTH_GRADE_MAX,
  isSeventhGrade,
} from '../src/systems/readability.js'

describe('readability.js', () => {
  describe('countSyllables', () => {
    it('counts simple words', () => {
      expect(countSyllables('cat')).toBe(1)
      expect(countSyllables('dog')).toBe(1)
      expect(countSyllables('the')).toBe(1)
    })

    it('counts multi-syllable words', () => {
      expect(countSyllables('hello')).toBe(2)
      expect(countSyllables('beautiful')).toBe(3)
      expect(countSyllables('redis')).toBe(2)
    })

    it('handles silent e', () => {
      expect(countSyllables('make')).toBe(1)
      expect(countSyllables('name')).toBe(1)
      expect(countSyllables('game')).toBe(1)
    })

    it('handles le endings', () => {
      expect(countSyllables('table')).toBe(2)
      expect(countSyllables('little')).toBe(2)
    })

    it('handles y as vowel', () => {
      expect(countSyllables('happy')).toBe(2)
      expect(countSyllables('sky')).toBe(1)
      expect(countSyllables('system')).toBe(2)
    })

    it('returns at least 1', () => {
      expect(countSyllables('a')).toBe(1)
      expect(countSyllables('i')).toBe(1)
    })

    it('handles empty string', () => {
      expect(countSyllables('')).toBe(0)
      expect(countSyllables('123')).toBe(0)
    })
  })

  describe('fleschReadingEase', () => {
    it('returns high score for simple text', () => {
      const text = 'This is simple. It has short words. Easy to read.'
      const score = fleschReadingEase(text)
      expect(score).toBeGreaterThan(80)
    })

    it('returns low score for complex text', () => {
      const text = 'The implementation demonstrates sophisticated algorithmic complexity. Multifarious methodologies necessitate comprehensive understanding.'
      const score = fleschReadingEase(text)
      expect(score).toBeLessThan(50)
    })

    it('handles empty text', () => {
      expect(fleschReadingEase('')).toBe(100)
      expect(fleschReadingEase('   ')).toBe(100)
    })
  })

  describe('fleschKincaidGrade', () => {
    it('returns low grade for simple text', () => {
      const text = 'This is simple. Short words. Easy read.'
      const grade = fleschKincaidGrade(text)
      expect(grade).toBeLessThan(7)
    })

    it('returns high grade for complex text', () => {
      const text = 'The implementation demonstrates sophisticated algorithmic complexity. Multifarious methodologies necessitate comprehensive understanding.'
      const grade = fleschKincaidGrade(text)
      expect(grade).toBeGreaterThan(10)
    })

    it('handles empty text', () => {
      expect(fleschKincaidGrade('')).toBe(0)
    })
  })

  describe('readabilityReport', () => {
    it('returns complete report', () => {
      const text = 'This is a test. It has multiple sentences. Count them.'
      const report = readabilityReport(text)
      expect(report).toHaveProperty('grade')
      expect(report).toHaveProperty('ease')
      expect(report).toHaveProperty('words')
      expect(report).toHaveProperty('sentences')
      expect(report).toHaveProperty('syllables')
      expect(report).toHaveProperty('passed')
    })

    it('passes for 7th grade text', () => {
      const text = 'You store a value under a key. Think of it as labeling a box.'
      const report = readabilityReport(text)
      expect(report.passed).toBe(true)
      expect(report.grade).toBeLessThanOrEqual(SEVENTH_GRADE_MAX)
    })

    it('fails for complex text', () => {
      const text = 'The implementation demonstrates sophisticated algorithmic complexity requiring comprehensive understanding.'
      const report = readabilityReport(text)
      expect(report.passed).toBe(false)
      expect(report.grade).toBeGreaterThan(SEVENTH_GRADE_MAX)
    })
  })

  describe('checkAllReadability', () => {
    it('validates multiple texts', () => {
      const texts = {
        simple: 'This is simple. Easy to read.',
        complex: 'The implementation demonstrates sophisticated algorithmic complexity requiring comprehensive understanding.',
      }
      const result = checkAllReadability(texts)
      expect(result.results.length).toBe(2)
      expect(result.allPassed).toBe(false)
      expect(result.results[0].passed).toBe(true)
      expect(result.results[1].passed).toBe(false)
    })

    it('returns allPassed true when all pass', () => {
      const texts = {
        a: 'Simple text. Easy read.',
        b: 'Another simple one. Good.',
      }
      const result = checkAllReadability(texts)
      expect(result.allPassed).toBe(true)
    })

    it('allows custom threshold', () => {
      const texts = {
        text: 'This is moderately complex. It has some bigger words.',
      }
      const result = checkAllReadability(texts, 10)
      expect(result.allPassed).toBe(true)
      const result2 = checkAllReadability(texts, 5)
      expect(result2.allPassed).toBe(false)
    })
  })

  describe('isSeventhGrade', () => {
    it('returns true for simple text', () => {
      expect(isSeventhGrade('Simple text. Easy to read.')).toBe(true)
    })

    it('returns false for complex text', () => {
      expect(isSeventhGrade('The implementation demonstrates sophisticated algorithmic complexity.')).toBe(false)
    })

    it('allows custom max', () => {
      expect(isSeventhGrade('Moderate text here.', 5)).toBe(false)
      expect(isSeventhGrade('Moderate text here.', 10)).toBe(true)
    })
  })

  describe('Tutorial text readability', () => {
    const tutorialTexts = [
      'SET stores a value under a key. Think of it as labeling a box.',
      'GET opens the labeled box and shows what is inside.',
      'INCR adds one to a number value.',
      'DECR removes one. Numbers go down the same way they go up.',
      'EXPIRE sets a countdown. When it hits zero, the key goes away.',
      'TTL shows the seconds left. It counts down in real time.',
      'EXISTS returns 1 if the key is there, 0 if it is not.',
      'DEL removes a key for good. Gone forever.',
      'HSET stores fields under one key.',
      'HGET reads one field from the hash.',
      'HGETALL shows every field and value at once.',
      'LPUSH adds to the left end of a list.',
      'RPUSH adds to the right end. Two sides, one list.',
      'LRANGE shows items in order. 0 to -1 means all.',
      'SADD adds unique members to a set. No duplicates.',
      'SMEMBERS shows everything in the set.',
      'ZADD adds a member with a score. The score decides rank.',
      'ZRANGE shows members from lowest to highest score.',
    ]

    for (const text of tutorialTexts) {
      it(`passes 7th grade: "${text.substring(0, 30)}..."`, () => {
        const report = readabilityReport(text)
        expect(report.passed).toBe(true)
        expect(report.grade).toBeLessThanOrEqual(SEVENTH_GRADE_MAX)
      })
    }
  })

  describe('Encyclopedia text readability', () => {
    const encyclopediaTexts = [
      'A key is a name you give to a piece of data. Every value in Redis lives under a key. Keys are strings, up to 512 MB.',
      'Strings are the simplest Redis type. They hold text or numbers, up to 512 MB. Use SET, GET, INCR, DECR.',
      'A hash maps field names to values under one key. Perfect for objects like user profiles. Use HSET, HGET, HGETALL.',
      'A list is an ordered collection of strings. Push to left or right, pop from either end. Use LPUSH, RPUSH, LRANGE, LPOP, RPOP.',
      'A set holds unique strings. No duplicates. Fast membership checks. Use SADD, SMEMBERS, SISMEMBER, SREM.',
      'A sorted set stores members with a numeric score. Members are unique, ordered by score. Use ZADD, ZRANGE, ZRANK, ZSCORE.',
      'EXPIRE sets a timer on a key. When it hits zero, the key is deleted. TTL shows seconds left. Use for caches and sessions.',
      'Use colons to group keys: user:1:name, user:1:email. Patterns like user:* let you scan or delete groups.',
    ]

    for (const text of encyclopediaTexts) {
      it(`passes 7th grade: "${text.substring(0, 30)}..."`, () => {
        const report = readabilityReport(text)
        expect(report.passed).toBe(true)
        expect(report.grade).toBeLessThanOrEqual(SEVENTH_GRADE_MAX)
      })
    }
  })
})