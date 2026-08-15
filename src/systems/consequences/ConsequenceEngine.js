/**
 * ConsequenceEngine.js
 * Subscribes to MockRedisEngine mutation events, evaluates consequence rules
 * mapping Redis mutations to world state reactions, and dispatches notifications
 * via EventBus / callback hooks.
 */

import { WorldStateResolver } from './WorldStateResolver.js'

export const DEFAULT_CONSEQUENCE_RULES = [
  {
    id: 'gate-lock',
    eventType: 'gate:locked',
    keyPattern: /gate/i,
    description: 'Triggers gate visual lock event when gate becomes locked',
    condition: (context, current, prev) => {
      return current.gate.isLocked && (!prev || !prev.gate.exists || !prev.gate.isLocked)
    },
    getPayload: (context, current) => ({
      entity: 'gate',
      state: 'locked',
      gate: current.gate,
      effect: 'gate_lock_effect',
      message: 'Gate has been locked',
    }),
  },
  {
    id: 'gate-unlock',
    eventType: 'gate:unlocked',
    keyPattern: /gate/i,
    description: 'Triggers gate visual unlock event when gate becomes unlocked',
    condition: (context, current, prev) => {
      return current.gate.isOpen && (!prev || !prev.gate.exists || !prev.gate.isOpen)
    },
    getPayload: (context, current) => ({
      entity: 'gate',
      state: 'unlocked',
      gate: current.gate,
      effect: 'gate_unlock_effect',
      message: 'Gate has been unlocked',
    }),
  },
  {
    id: 'shield-deactivated',
    eventType: 'shield:deactivated',
    keyPattern: /shield/i,
    description: 'Triggers shield deactivated event when shield collapses or goes inactive',
    condition: (context, current, prev) => {
      return !current.shield.active && Boolean(prev && prev.shield.active)
    },
    getPayload: (context, current) => ({
      entity: 'shield',
      state: 'deactivated',
      shield: current.shield,
      effect: 'shield_deactivate_effect',
      message: 'Shield has collapsed!',
    }),
  },
  {
    id: 'shield-activated',
    eventType: 'shield:activated',
    keyPattern: /shield/i,
    description: 'Triggers shield activated event when shield power comes online',
    condition: (context, current, prev) => {
      return current.shield.active && (!prev || !prev.shield.exists || !prev.shield.active)
    },
    getPayload: (context, current) => ({
      entity: 'shield',
      state: 'activated',
      shield: current.shield,
      effect: 'shield_activate_effect',
      message: 'Shield has been activated!',
    }),
  },
  {
    id: 'queue-updated',
    eventType: 'queue:updated',
    keyPattern: /queue/i,
    description: 'Triggers queue updated event on list mutations',
    condition: (context, current, prev) => {
      return Boolean(prev && prev.queue.length !== current.queue.length)
    },
    getPayload: (context, current, prev) => ({
      entity: 'queue',
      queue: current.queue,
      delta: current.queue.length - (prev ? prev.queue.length : 0),
    }),
  },
  {
    id: 'queue-overflow',
    eventType: 'queue:overflow',
    keyPattern: /queue/i,
    description: 'Triggers queue overflow event when items exceed threshold',
    condition: (context, current, prev) => {
      return current.queue.length >= 5 && (!prev || prev.queue.length < 5)
    },
    getPayload: (context, current) => ({
      entity: 'queue',
      state: 'overflow',
      queue: current.queue,
      effect: 'queue_overflow_warning',
      message: 'Queue overflow detected!',
    }),
  },
  {
    id: 'queue-cleared',
    eventType: 'queue:cleared',
    keyPattern: /queue/i,
    description: 'Triggers queue cleared event when queue transitions to empty',
    condition: (context, current, prev) => {
      return current.queue.isEmpty && Boolean(prev && !prev.queue.isEmpty)
    },
    getPayload: (context, current) => ({
      entity: 'queue',
      state: 'cleared',
      queue: current.queue,
      message: 'Queue has been cleared',
    }),
  },
]

export class ConsequenceEngine {
  constructor({ engine = null, eventBus = null, rules = [], autoAttachDefaults = true } = {}) {
    this.engine = null
    this.eventBus = eventBus
    this.rules = new Map()
    this.listeners = new Set()
    this.typedListeners = new Map()
    this.history = []
    this.previousWorldState = null
    this.unsubscribes = []

    if (autoAttachDefaults) {
      for (const rule of DEFAULT_CONSEQUENCE_RULES) {
        this.addRule(rule)
      }
    }

    for (const rule of rules) {
      this.addRule(rule)
    }

    if (engine) {
      this.attachEngine(engine)
    }
  }

  attachEngine(engine) {
    if (this.engine === engine) return
    this.detachEngine()

    this.engine = engine
    this.previousWorldState = WorldStateResolver.resolveWorldState(engine)

    if (engine && typeof engine.on === 'function') {
      const unsubChange = engine.on('change', (payload) => this._onMutation('change', payload))
      this.unsubscribes.push(unsubChange)
    }
  }

  detachEngine() {
    for (const unsub of this.unsubscribes) {
      if (typeof unsub === 'function') unsub()
    }
    this.unsubscribes = []
    this.engine = null
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus
  }

  addRule(rule) {
    if (!rule || !rule.id) {
      throw new Error('Consequence rule must have an id')
    }
    this.rules.set(rule.id, rule)
    return rule.id
  }

  removeRule(id) {
    return this.rules.delete(id)
  }

  getRule(id) {
    return this.rules.get(id)
  }

  getRules() {
    return Array.from(this.rules.values())
  }

  clearRules() {
    this.rules.clear()
  }

  onConsequence(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  on(eventType, fn) {
    if (eventType === '*' || eventType === 'consequence') {
      return this.onConsequence(fn)
    }
    if (!this.typedListeners.has(eventType)) {
      this.typedListeners.set(eventType, new Set())
    }
    this.typedListeners.get(eventType).add(fn)
    return () => {
      this.typedListeners.get(eventType)?.delete(fn)
    }
  }

  off(eventType, fn) {
    if (eventType === '*' || eventType === 'consequence') {
      this.listeners.delete(fn)
      return
    }
    this.typedListeners.get(eventType)?.delete(fn)
  }

  getHistory() {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }

  _onMutation(type, payload) {
    this.evaluate({ mutationType: type, payload })
  }

  evaluate(triggerContext = {}) {
    if (!this.engine) return []

    const currentWorldState = WorldStateResolver.resolveWorldState(this.engine)
    const context = {
      mutationType: triggerContext.mutationType || 'evaluation',
      payload: triggerContext.payload || {},
      command: triggerContext.command,
      args: triggerContext.args,
      reply: triggerContext.reply,
      engine: this.engine,
      worldState: currentWorldState,
      previousWorldState: this.previousWorldState,
    }

    const triggeredConsequences = []

    for (const rule of this.rules.values()) {
      try {
        if (this._matchesRule(rule, context, currentWorldState, this.previousWorldState)) {
          const consequence = this._createConsequence(rule, context, currentWorldState, this.previousWorldState)
          triggeredConsequences.push(consequence)
          this._dispatchConsequence(consequence)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error evaluating rule ${rule.id}:`, err)
      }
    }

    this.previousWorldState = currentWorldState
    return triggeredConsequences
  }

  _matchesRule(rule, context, current, prev) {
    if (rule.keyPattern) {
      const keysToCheck = []
      if (context.args && context.args.length > 0) {
        keysToCheck.push(context.args[0])
      }
      if (context.payload?.keys) {
        keysToCheck.push(...context.payload.keys)
      }
      if (context.payload?.key) {
        keysToCheck.push(context.payload.key)
      }

      if (keysToCheck.length > 0) {
        const matchesKey = keysToCheck.some((key) => {
          if (typeof rule.keyPattern === 'string') return key === rule.keyPattern
          if (rule.keyPattern instanceof RegExp) return rule.keyPattern.test(key)
          if (typeof rule.keyPattern === 'function') return rule.keyPattern(key)
          return false
        })
        if (!matchesKey && keysToCheck.length > 0 && !rule.ignoreKeyCheck) {
          return false
        }
      }
    }

    if (typeof rule.condition === 'function') {
      return Boolean(rule.condition(context, current, prev))
    }

    return true
  }

  _createConsequence(rule, context, current, prev) {
    const payload = typeof rule.getPayload === 'function'
      ? rule.getPayload(context, current, prev)
      : (rule.payload ? { ...rule.payload } : {})

    return {
      id: `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ruleId: rule.id,
      eventType: rule.eventType || 'consequence:triggered',
      description: typeof rule.description === 'function'
        ? rule.description(context, current)
        : (rule.description || `Consequence triggered by ${rule.id}`),
      payload,
      context: {
        mutationType: context.mutationType,
        command: context.command,
      },
      worldState: current,
      timestamp: Date.now(),
    }
  }

  _dispatchConsequence(consequence) {
    this.history.push(consequence)
    if (this.history.length > 100) this.history.shift()

    // 1. General listeners
    for (const listener of this.listeners) {
      try {
        listener(consequence)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error in consequence listener:', err)
      }
    }

    // 2. Typed listeners
    const typed = this.typedListeners.get(consequence.eventType)
    if (typed) {
      for (const listener of typed) {
        try {
          listener(consequence)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error in typed consequence listener:', err)
        }
      }
    }

    // 3. EventBus
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      try {
        this.eventBus.emit(consequence.eventType, consequence)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error emitting consequence to EventBus:', err)
      }
    }
  }
}
