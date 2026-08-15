// WorldStateResolver — Resolves dynamic world reaction states for API Gates,
// Cache Corruption, Shield Expiry countdowns, and Queue Conveyor belts.

import { consequenceEngine, CONSEQUENCE_EVENTS } from './ConsequenceEngine.js'

export class WorldStateResolver {
  constructor() {
    // API Gate state: 'open' | 'locked' | 'corrupted'
    this.apiGateState = 'corrupted'

    // Set of corrupted cache keys / entity IDs
    this.corruptedCacheKeys = new Set(['cache:user:1', 'cache:session', 'mv_e1'])

    // Shield expiry timers: key -> { ttl, maxTtl, startTime }
    this.shieldExpiries = new Map()

    // Queues: queueKey -> Array of item strings
    this.queues = new Map([
      ['queue:jobs', ['task1', 'task2', 'task3']],
    ])

    // Queue worker animation state: { active: boolean, action: string, item: string, timer: number }
    this.workerState = {
      active: false,
      action: 'idle',
      item: null,
      timer: 0,
    }

    this._unsubscribe = consequenceEngine.subscribe((event) => this.handleConsequenceEvent(event))
  }

  handleConsequenceEvent(event) {
    const { type, payload } = event
    switch (type) {
      case CONSEQUENCE_EVENTS.GATE_STATE_CHANGED:
        if (payload.mode) {
          this.apiGateState = payload.mode
        }
        break

      case CONSEQUENCE_EVENTS.CACHE_INVALIDATED:
        if (payload.key) {
          this.dissolveCacheCorruption(payload.key)
        }
        break

      case CONSEQUENCE_EVENTS.SHIELD_EXPIRED:
        if (payload.key && payload.ttl !== undefined) {
          this.setShieldExpiry(payload.key, payload.ttl)
        }
        break

      case CONSEQUENCE_EVENTS.QUEUE_UPDATED:
        this.updateQueueState(payload)
        break
    }
  }

  // API Gate
  setApiGateState(state) {
    this.apiGateState = state
  }

  getApiGateState() {
    return this.apiGateState
  }

  // Cache Corruption
  addCacheCorruption(key) {
    this.corruptedCacheKeys.add(key)
  }

  dissolveCacheCorruption(key) {
    this.corruptedCacheKeys.delete(key)
    // If wildcard or all cache dissolved
    if (key === 'cache:*' || key === '*') {
      this.corruptedCacheKeys.clear()
    }
  }

  isCacheCorrupted(key) {
    if (this.corruptedCacheKeys.has(key)) return true
    for (const cKey of this.corruptedCacheKeys) {
      if (cKey === '*' || cKey === 'cache:*') return true
      if (cKey === key) return true
    }
    return false
  }

  hasAnyCacheCorruption() {
    return this.corruptedCacheKeys.size > 0
  }

  // Shield Expiry
  setShieldExpiry(key, ttlSeconds) {
    this.shieldExpiries.set(key, {
      ttl: ttlSeconds,
      maxTtl: ttlSeconds,
      startTime: Date.now(),
    })
  }

  getShieldExpiry(key) {
    const data = this.shieldExpiries.get(key)
    if (!data) return null

    const elapsedSec = (Date.now() - data.startTime) / 1000
    const remaining = Math.max(0, data.ttl - elapsedSec)
    return {
      remaining: Math.ceil(remaining),
      remainingPrecise: remaining,
      maxTtl: data.maxTtl,
      progress: remaining / data.maxTtl,
      isExpired: remaining <= 0,
    }
  }

  // Queue Conveyor
  updateQueueState({ command, key = 'queue:jobs', item, result, action }) {
    if (!this.queues.has(key)) {
      this.queues.set(key, [])
    }
    const list = this.queues.get(key)

    if (action === 'push') {
      if (command === 'LPUSH') {
        list.unshift(item || `item_${list.length + 1}`)
      } else {
        list.push(item || `item_${list.length + 1}`)
      }
    } else if (action === 'pop') {
      let popped = null
      if (command === 'LPOP') {
        popped = list.shift()
      } else {
        popped = list.pop()
      }
      
      // Trigger worker animation
      this.workerState = {
        active: true,
        action: 'popping',
        item: result || popped || 'cargo',
        timer: 1.5, // 1.5 seconds animation
      }
    }
  }

  getQueue(key = 'queue:jobs') {
    return this.queues.get(key) || []
  }

  update(dt) {
    // Update shield expiries
    for (const [key, data] of this.shieldExpiries.entries()) {
      const elapsedSec = (Date.now() - data.startTime) / 1000
      if (data.ttl - elapsedSec <= 0) {
        // Shield expired
      }
    }

    // Update worker animation
    if (this.workerState.active) {
      this.workerState.timer -= dt
      if (this.workerState.timer <= 0) {
        this.workerState.active = false
        this.workerState.action = 'idle'
      }
    }
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe()
    }
  }
}

export const worldStateResolver = new WorldStateResolver()
