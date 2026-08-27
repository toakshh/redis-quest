// Encyclopedia — data-driven concept lookup with readability-enforced entries.
// Pure logic, no UI coupling. Returns structured data for rendering.

import encyclopediaData from '../data/encyclopedia/encyclopedia.json'
import { fleschKincaidGrade, SEVENTH_GRADE_MAX } from './readability.js'

// In-memory cache for hot lookups
const entryCache = new Map()

function validateEntry(entry) {
  const issues = []
  if (!entry.id) issues.push('missing id')
  if (!entry.title) issues.push('missing title')
  if (!entry.summary) issues.push('missing summary')
  if (!entry.category) issues.push('missing category')
  if (!entry.related || !Array.isArray(entry.related)) issues.push('missing related array')
  if (!entry.examples || !Array.isArray(entry.examples)) issues.push('missing examples array')
  if (entry.summary && fleschKincaidGrade(entry.summary) > SEVENTH_GRADE_MAX) {
    issues.push(`summary exceeds 7th grade (grade: ${fleschKincaidGrade(entry.summary).toFixed(1)})`)
  }
  for (const ex of entry.examples || []) {
    if (ex.command && fleschKincaidGrade(ex.command) > SEVENTH_GRADE_MAX) {
      issues.push(`example command exceeds 7th grade: ${ex.command}`)
    }
    if (ex.explanation && fleschKincaidGrade(ex.explanation) > SEVENTH_GRADE_MAX) {
      issues.push(`example explanation exceeds 7th grade: ${ex.explanation}`)
    }
  }
  return issues
}

function buildIndex() {
  const byId = new Map()
  const byCategory = new Map()
  const allTags = new Set()

  for (const entry of encyclopediaData) {
    byId.set(entry.id, entry)
    if (!byCategory.has(entry.category)) byCategory.set(entry.category, [])
    byCategory.get(entry.category).push(entry.id)
    for (const tag of entry.tags || []) allTags.add(tag)
  }
  return { byId, byCategory, allTags: [...allTags] }
}

const index = buildIndex()

export function getEntry(id) {
  if (entryCache.has(id)) return entryCache.get(id)
  const entry = index.byId.get(id)
  if (entry) entryCache.set(id, entry)
  return entry || null
}

export function getEntriesByCategory(category) {
  const ids = index.byCategory.get(category) || []
  return ids.map(id => getEntry(id)).filter(Boolean)
}

export function getAllCategories() {
  return [...index.byCategory.keys()].sort()
}

export function getAllTags() {
  return [...index.allTags].sort()
}

export function searchEntries(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const results = []
  for (const entry of encyclopediaData) {
    const haystack = `${entry.id} ${entry.title} ${entry.summary} ${(entry.tags || []).join(' ')}`.toLowerCase()
    if (haystack.includes(q)) {
      results.push({ entry, score: haystack.split(q).length - 1 })
    }
  }
  results.sort((a, b) => b.score - a.score)
  return results.map(r => r.entry)
}

export function getRelatedEntries(entryId, limit = 5) {
  const entry = getEntry(entryId)
  if (!entry) return []
  return (entry.related || [])
    .map(id => getEntry(id))
    .filter(Boolean)
    .slice(0, limit)
}

export function validateAllEntries() {
  const results = []
  for (const entry of encyclopediaData) {
    const issues = validateEntry(entry)
    results.push({ id: entry.id, valid: issues.length === 0, issues })
  }
  return results
}

export function getEntryCount() {
  return encyclopediaData.length
}

export function getCategoriesWithCounts() {
  const cats = []
  for (const [cat, ids] of index.byCategory) {
    cats.push({ category: cat, count: ids.length })
  }
  return cats.sort((a, b) => a.category.localeCompare(b.category))
}

// For testing / headless validation
export function __testOnly__() {
  return {
    validateEntry,
    index,
    encyclopediaData,
  }
}