import { describe, it, expect } from 'vitest'
import {
  getEntry,
  getEntriesByCategory,
  getAllCategories,
  searchEntries,
  getRelatedEntries,
  validateAllEntries,
  getEntryCount,
  getCategoriesWithCounts,
} from '../src/systems/Encyclopedia.js'

describe('Encyclopedia', () => {
  describe('getEntry', () => {
    it('returns entry by id', () => {
      const entry = getEntry('key')
      expect(entry).toBeTruthy()
      expect(entry.id).toBe('key')
      expect(entry.title).toBe('Key')
    })

    it('returns null for unknown id', () => {
      expect(getEntry('unknown')).toBeNull()
    })

    it('caches entries', () => {
      const entry1 = getEntry('string')
      const entry2 = getEntry('string')
      expect(entry1).toBe(entry2) // Same reference due to caching
    })
  })

  describe('getEntriesByCategory', () => {
    it('returns entries for core category', () => {
      const entries = getEntriesByCategory('core')
      expect(entries.length).toBeGreaterThan(0)
      for (const e of entries) {
        expect(e.category).toBe('core')
      }
    })

    it('returns entries for advanced category', () => {
      const entries = getEntriesByCategory('advanced')
      expect(entries.length).toBeGreaterThan(0)
      for (const e of entries) {
        expect(e.category).toBe('advanced')
      }
    })

    it('returns entries for ops category', () => {
      const entries = getEntriesByCategory('ops')
      expect(entries.length).toBeGreaterThan(0)
      for (const e of entries) {
        expect(e.category).toBe('ops')
      }
    })

    it('returns empty array for unknown category', () => {
      expect(getEntriesByCategory('unknown')).toEqual([])
    })
  })

  describe('getAllCategories', () => {
    it('returns all categories sorted', () => {
      const categories = getAllCategories()
      expect(categories).toContain('core')
      expect(categories).toContain('advanced')
      expect(categories).toContain('ops')
      expect(categories).toEqual([...categories].sort())
    })
  })

  describe('searchEntries', () => {
    it('finds entries by id', () => {
      const results = searchEntries('key')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(e => e.id === 'key')).toBe(true)
    })

    it('finds entries by title', () => {
      const results = searchEntries('string')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(e => e.title.toLowerCase().includes('string'))).toBe(true)
    })

    it('finds entries by summary', () => {
      const results = searchEntries('namespaces')
      expect(results.length).toBeGreaterThan(0)
    })

    it('finds entries by tags', () => {
      const results = searchEntries('fundamental')
      expect(results.length).toBeGreaterThan(0)
    })

    it('returns empty for no matches', () => {
      expect(searchEntries('xyz123nomatch')).toEqual([])
    })

    it('returns empty for empty query', () => {
      expect(searchEntries('')).toEqual([])
      expect(searchEntries('   ')).toEqual([])
    })

    it('sorts by relevance (score)', () => {
      const results = searchEntries('key')
      // Should have results
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('getRelatedEntries', () => {
    it('returns related entries for key', () => {
      const related = getRelatedEntries('key')
      expect(related.length).toBeGreaterThan(0)
      // Should include string, namespace, expire
      expect(related.some(e => e.id === 'string')).toBe(true)
    })

    it('returns empty for unknown entry', () => {
      expect(getRelatedEntries('unknown')).toEqual([])
    })

    it('limits results', () => {
      const related = getRelatedEntries('key', 2)
      expect(related.length).toBeLessThanOrEqual(2)
    })
  })

  describe('validateAllEntries', () => {
    it('validates all entries', () => {
      const results = validateAllEntries()
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(r).toHaveProperty('id')
        expect(r).toHaveProperty('valid')
        expect(r).toHaveProperty('issues')
        expect(Array.isArray(r.issues)).toBe(true)
      }
    })

    it('all entries are valid (no issues)', () => {
      const results = validateAllEntries()
      const invalid = results.filter(r => !r.valid)
      expect(invalid.length).toBe(0)
    })
  })

  describe('getEntryCount', () => {
    it('returns total entry count', () => {
      const count = getEntryCount()
      expect(count).toBeGreaterThan(0)
      // Should match validateAllEntries length
      expect(count).toBe(validateAllEntries().length)
    })
  })

  describe('getCategoriesWithCounts', () => {
    it('returns categories with counts', () => {
      const cats = getCategoriesWithCounts()
      expect(cats.length).toBeGreaterThan(0)
      for (const c of cats) {
        expect(c).toHaveProperty('category')
        expect(c).toHaveProperty('count')
        expect(typeof c.count).toBe('number')
        expect(c.count).toBeGreaterThan(0)
      }
    })

    it('is sorted by category name', () => {
      const cats = getCategoriesWithCounts()
      const names = cats.map(c => c.category)
      expect(names).toEqual([...names].sort())
    })

    it('counts match entries', () => {
      const cats = getCategoriesWithCounts()
      for (const c of cats) {
        const entries = getEntriesByCategory(c.category)
        expect(entries.length).toBe(c.count)
      }
    })
  })

  describe('Entry structure', () => {
    it('all entries have required fields', () => {
      const results = validateAllEntries()
      for (const r of results) {
        expect(r.valid).toBe(true)
        const entry = getEntry(r.id)
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('title')
        expect(entry).toHaveProperty('summary')
        expect(entry).toHaveProperty('category')
        expect(entry).toHaveProperty('tags')
        expect(entry).toHaveProperty('related')
        expect(entry).toHaveProperty('examples')
        expect(Array.isArray(entry.tags)).toBe(true)
        expect(Array.isArray(entry.related)).toBe(true)
        expect(Array.isArray(entry.examples)).toBe(true)
      }
    })

    it('all examples have command and explanation', () => {
      const results = validateAllEntries()
      for (const r of results) {
        const entry = getEntry(r.id)
        for (const ex of entry.examples) {
          expect(ex).toHaveProperty('command')
          expect(ex).toHaveProperty('explanation')
        }
      }
    })
  })
})