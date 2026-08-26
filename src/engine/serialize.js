// Serialization helpers for Redis values.
//
// The mock engine stores live values as rich structures (Map-backed Dict,
// LinkedList, Set, SkipList). To emit deterministic RedisStateChanged events
// and to compare state across a replay, we need a plain, JSON-safe form of
// every value — this module is the single place that converts between them.

import { Dict } from './datatypes/Dict.js'

/**
 * Serialize a single value into a plain JSON-safe structure.
 * @param {string} type  one of: string, hash, list, set, zset
 * @param {*} value
 */
export function serializeValue(type, value) {
  switch (type) {
    case 'string':
      return String(value)
    case 'hash':
      if (value instanceof Dict) return Object.fromEntries(value.map.entries())
      if (value instanceof Map) return Object.fromEntries(value.entries())
      return Object.fromEntries(value.entries?.() ?? [])
    case 'list':
      if (value && typeof value.toArray === 'function') {
        return value.toArray().map((n) => n.value)
      }
      return Array.isArray(value) ? value.map(String) : []
    case 'set':
      if (value instanceof Set) return [...value].map(String)
      if (value && typeof value.entries === 'function') return [...value].map(String)
      return []
    case 'zset':
      if (value && typeof value.toArray === 'function') {
        return value.toArray().map((n) => ({ member: String(n.member), score: n.score }))
      }
      if (Array.isArray(value)) return value.map((n) => ({ member: String(n.member), score: n.score }))
      return []
    default:
      return value == null ? null : String(value)
  }
}

/**
 * Serialize a full key entry: { type, value, expiresAt } -> plain object.
 * @param {{ type: string, value: any, expiresAt: number|null }} entry
 */
export function serializeEntry(entry) {
  if (!entry) return null
  return {
    type: entry.type,
    value: serializeValue(entry.type, entry.value),
    expiresAt: entry.expiresAt,
    version: entry.version,
  }
}

/**
 * Deep-compare two serialized values for "did this change?" — cheap and
 * deterministic. Uses JSON.stringify for structural equality.
 */
export function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Structural hash for a serialized state (for replay comparison). */
export function stateFingerprint(store) {
  const out = {}
  for (const [key, entry] of store) {
    const s = serializeEntry(entry)
    if (s) out[key] = { type: s.type, value: s.value, expiresAt: s.expiresAt }
  }
  return JSON.stringify(out)
}
