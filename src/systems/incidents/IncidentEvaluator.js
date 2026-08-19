/**
 * Objective evaluator that inspects live MockRedisEngine store state.
 */

import { makeGlobMatcher } from '../../engine/datatypes/glob.js'

export function evaluatePredicate(pred, engine) {
  if (!pred || typeof pred !== 'object' || !engine) return false

  const type = pred.type || pred.predicateType

  switch (type) {
    case 'keyEquals': {
      const entry = engine._get(pred.key)
      if (!entry) return false
      return String(entry.value) === String(pred.value)
    }

    case 'keyExists': {
      const entry = engine._get(pred.key)
      return entry !== null
    }

    case 'keyNotExists': {
      const entry = engine._get(pred.key)
      return entry === null
    }

    case 'ttlBetween': {
      const entry = engine._get(pred.key)
      if (!entry || entry.expiresAt === null) return false
      const now = engine.now()
      const ttlMs = entry.expiresAt - now
      const ttlSec = ttlMs / 1000
      const min = pred.min ?? 0
      const max = pred.max ?? Infinity
      return (ttlSec >= min && ttlSec <= max) || (ttlMs >= min && ttlMs <= max)
    }

    case 'listLengthBelow': {
      const entry = engine._get(pred.key)
      if (!entry) return 0 < pred.max
      if (entry.type !== 'list') return false
      const len = entry.value ? (entry.value.length ?? entry.value.len ?? 0) : 0
      return len < pred.max
    }

    case 'setContains': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'set' || !entry.value) return false
      return entry.value.has(pred.member)
    }

    case 'setNotContains': {
      const entry = engine._get(pred.key)
      if (!entry) return true
      if (entry.type !== 'set' || !entry.value) return true
      return !entry.value.has(pred.member)
    }

    case 'hashFieldEquals': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'hash' || !entry.value) return false
      const val = entry.value.get(pred.field)
      return val !== undefined && val !== null && String(val) === String(pred.value)
    }

    case 'hashFieldNotExists': {
      const entry = engine._get(pred.key)
      if (!entry) return true
      if (entry.type !== 'hash' || !entry.value) return true
      return !entry.value.has(pred.field)
    }

    case 'sortedSetTop': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'zset' || !entry.value) return false
      const tail = entry.value.tail
      return tail !== null && tail !== undefined && tail.member === pred.member
    }

    case 'custom': {
      if (typeof pred.check === 'function') {
        return Boolean(pred.check(engine))
      }
      return false
    }

    case 'streamLengthAbove': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'stream' || !entry.value) return false
      return entry.value.length > pred.min
    }

    case 'streamLengthBelow': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'stream' || !entry.value) return 0 < pred.max
      return entry.value.length < pred.max
    }

    case 'pendingCountBelow': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'stream' || !entry.value) return 0 < pred.max
      const group = entry.value.groups.get(pred.group)
      const pendingCount = group ? group.pel.size : 0
      return pendingCount < pred.max
    }

    case 'consumerGroupExists': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'stream' || !entry.value) return false
      return entry.value.groups.has(pred.group)
    }

    case 'hitRatioAbove': {
      return engine.hitRatio() > pred.min
    }

    case 'memoryBelowRatio': {
      if (!engine.memoryLimit) return false
      return engine.memoryBytes / engine.memoryLimit < pred.max
    }

    case 'keyCountBelow': {
      return engine.store.size < pred.max
    }

    case 'allKeysHaveTtl': {
      const matcher = makeGlobMatcher(pred.pattern)
      for (const [key, entry] of engine.store) {
        if (!matcher(key)) continue
        if (entry.expiresAt === null) return false
      }
      return true
    }

    case 'lockHeldWithFence': {
      const entry = engine._get(pred.key)
      if (!entry || entry.type !== 'string' || entry.value === null) return false
      const fence = Number(entry.value)
      if (!Number.isFinite(fence)) return false
      return fence >= pred.minFence
    }

    case 'evictionCountBelow': {
      return (engine.stats.keysEvicted ?? 0) < pred.max
    }

    default:
      return false
  }
}

/**
 * Evaluates a set/list/map of objectives against a MockRedisEngine instance.
 * @param {Array|Object} objectives 
 * @param {MockRedisEngine} engine 
 * @returns {{ allPassed: boolean, statusMap: Record<string, boolean> }}
 */
export function evaluateObjectives(objectives, engine) {
  const statusMap = {}
  if (!objectives) {
    return { allPassed: true, statusMap }
  }

  let list = []
  if (Array.isArray(objectives)) {
    list = objectives.map((item, idx) => {
      const id = item.id || item.name || `objective_${idx}`
      return { id, target: item }
    })
  } else if (typeof objectives === 'object') {
    list = Object.entries(objectives).map(([id, item]) => {
      return { id, target: item }
    })
  }

  if (list.length === 0) {
    return { allPassed: true, statusMap }
  }

  let allPassed = true
  for (const { id, target } of list) {
    const pred = target.predicate || target
    const passed = Boolean(evaluatePredicate(pred, engine))
    statusMap[id] = passed
    if (!passed) {
      allPassed = false
    }
  }

  return { allPassed, statusMap }
}
