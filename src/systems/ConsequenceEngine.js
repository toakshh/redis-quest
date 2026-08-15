// ConsequenceEngine — Event-driven engine for reacting to game commands, incident resolution,
// objective satisfaction, cache invalidation, and world changes.

import { eventBus, EVENTS } from '../engine/EventBus.js'

export const CONSEQUENCE_EVENTS = {
  OBJECTIVE_SATISFIED: 'OBJECTIVE_SATISFIED',
  PRESSURE_DROPPED: 'PRESSURE_DROPPED',
  INCIDENT_RESOLVED: 'INCIDENT_RESOLVED',
  CACHE_INVALIDATED: 'CACHE_INVALIDATED',
  GATE_STATE_CHANGED: 'GATE_STATE_CHANGED',
  SHIELD_EXPIRED: 'SHIELD_EXPIRED',
  QUEUE_UPDATED: 'QUEUE_UPDATED',
  SYSTEM_HEALTH_DEGRADED: 'SYSTEM_HEALTH_DEGRADED',
  PLAYER_DIED: 'PLAYER_DIED',
}

export class ConsequenceEngine {
  constructor() {
    this.listeners = new Map()
    this.subscribers = new Set()
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  emit(event, payload = {}) {
    const data = { type: event, payload, timestamp: Date.now() }
    
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        cb(data)
      }
    }

    for (const sub of this.subscribers) {
      sub(data)
    }

    // Forward relevant events to global EventBus as well
    if (event === CONSEQUENCE_EVENTS.OBJECTIVE_SATISFIED ||
        event === CONSEQUENCE_EVENTS.PRESSURE_DROPPED ||
        event === CONSEQUENCE_EVENTS.INCIDENT_RESOLVED) {
      eventBus.emit(event.toLowerCase(), data)
    }
  }

  processCommand(command, args = [], result = null) {
    const cmd = command.toUpperCase()

    // API Gate check: SET api:gate:mode <mode>
    if (cmd === 'SET' && args[0] === 'api:gate:mode') {
      const mode = args[1]?.toLowerCase() || 'locked'
      this.emit(CONSEQUENCE_EVENTS.GATE_STATE_CHANGED, { mode, key: args[0] })
    }

    // Cache Corruption invalidation check: DEL cache:* or SET cache:*
    if ((cmd === 'DEL' || cmd === 'SET') && args[0]?.startsWith('cache:')) {
      this.emit(CONSEQUENCE_EVENTS.CACHE_INVALIDATED, { key: args[0], command: cmd })
    }

    // Shield Expiry check: EXPIRE <key> <seconds>
    if (cmd === 'EXPIRE') {
      const key = args[0]
      const seconds = parseInt(args[1], 10) || 0
      this.emit(CONSEQUENCE_EVENTS.SHIELD_EXPIRED, { key, ttl: seconds })
    }

    // Queue Conveyor check: LPUSH / RPUSH / LPOP / RPOP
    if (cmd === 'LPUSH' || cmd === 'RPUSH') {
      this.emit(CONSEQUENCE_EVENTS.QUEUE_UPDATED, {
        command: cmd,
        key: args[0],
        item: args[1],
        action: 'push',
      })
    } else if (cmd === 'LPOP' || cmd === 'RPOP') {
      this.emit(CONSEQUENCE_EVENTS.QUEUE_UPDATED, {
        command: cmd,
        key: args[0],
        result,
        action: 'pop',
      })
    }
  }

  triggerObjectiveSatisfied(objectiveId, details = {}) {
    this.emit(CONSEQUENCE_EVENTS.OBJECTIVE_SATISFIED, { objectiveId, ...details })
  }

  triggerPressureDropped(amount, details = {}) {
    this.emit(CONSEQUENCE_EVENTS.PRESSURE_DROPPED, { amount, ...details })
  }

  triggerIncidentResolved(incidentId, details = {}) {
    this.emit(CONSEQUENCE_EVENTS.INCIDENT_RESOLVED, { incidentId, ...details })
  }
}

export const consequenceEngine = new ConsequenceEngine()
