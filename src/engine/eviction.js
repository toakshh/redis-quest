// Approximated-LRU eviction — the same technique real Redis uses: sample a
// handful of candidate keys rather than scanning the whole keyspace for a
// true minimum. That approximation is itself a teachable production detail
// (Protocol Zero's Evictor speaks in exactly this vocabulary), not a
// shortcut taken only for this mock engine.

import { entryMemoryBytes } from './datatypes/memory.js'

export const EVICTION_POLICIES = [
  'noeviction',
  'allkeys-lru',
  'allkeys-random',
  'volatile-lru',
  'volatile-random',
  'volatile-ttl',
]

export const EVICTION_SAMPLE_SIZE = 5

function eligibleKeys(engine, policy) {
  const store = engine.store
  if (policy.startsWith('volatile-')) {
    const keys = []
    for (const [key, entry] of store) {
      if (entry.expiresAt !== null) keys.push(key)
    }
    return keys
  }
  return [...store.keys()]
}

// Sample n distinct keys via engine.random() (seeded when the engine is
// seeded, so eviction stays deterministic under a fixed seed).
function sampleKeys(engine, keys, n) {
  if (keys.length <= n) return keys.slice()
  const sampled = []
  const usedIndexes = new Set()
  while (sampled.length < n && usedIndexes.size < keys.length) {
    const idx = Math.floor(engine.random() * keys.length)
    if (usedIndexes.has(idx)) continue
    usedIndexes.add(idx)
    sampled.push(keys[idx])
  }
  return sampled
}

// Choose ONE key to evict under the given policy, or null if nothing is
// eligible (an empty active db, or an all-volatile policy with no TTLs set).
export function pickEvictionCandidate(engine, policy) {
  if (policy === 'noeviction') return null

  const keys = eligibleKeys(engine, policy)
  if (keys.length === 0) return null

  if (policy === 'allkeys-random' || policy === 'volatile-random') {
    const sampled = sampleKeys(engine, keys, 1)
    return sampled[0] ?? null
  }

  if (policy === 'volatile-ttl') {
    const sampled = sampleKeys(engine, keys, EVICTION_SAMPLE_SIZE)
    let best = null
    let bestExpiresAt = Infinity
    for (const key of sampled) {
      const entry = engine.store.get(key)
      if (!entry) continue
      if (entry.expiresAt < bestExpiresAt) {
        bestExpiresAt = entry.expiresAt
        best = key
      }
    }
    return best
  }

  // allkeys-lru / volatile-lru: smallest lruTick among the sample.
  const sampled = sampleKeys(engine, keys, EVICTION_SAMPLE_SIZE)
  let best = null
  let bestTick = Infinity
  for (const key of sampled) {
    const entry = engine.store.get(key)
    if (!entry) continue
    if (entry.lruTick < bestTick) {
      bestTick = entry.lruTick
      best = key
    }
  }
  return best
}

// Evict under `policy` until memoryBytes <= memoryLimit, or until nothing
// eligible remains, or until maxEvictions keys have been removed (a safety
// bound — never spin forever on a pathological config).
export function runEvictionPass(engine, policy, maxEvictions = 200) {
  if (policy === 'noeviction') return { keys: [], freedBytes: 0, policy }

  const evictedKeys = []
  let freedBytes = 0
  let iterations = 0

  while (engine.memoryBytes > engine.memoryLimit && iterations < maxEvictions) {
    const key = pickEvictionCandidate(engine, policy)
    if (!key) break
    const entry = engine.store.get(key)
    if (!entry) break
    const bytes = entryMemoryBytes(key, entry)
    if (!engine._delete(key)) break
    evictedKeys.push(key)
    freedBytes += bytes
    iterations++
  }

  return { keys: evictedKeys, freedBytes, policy }
}
