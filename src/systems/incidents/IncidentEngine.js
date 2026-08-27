import { evaluateObjectives } from './IncidentEvaluator.js'

export const INCIDENT_STATES = {
  DORMANT: 'DORMANT',
  ACTIVE: 'ACTIVE',
  ESCALATING: 'ESCALATING',
  MITIGATED: 'MITIGATED',
  RESOLVED: 'RESOLVED',
  FAILED: 'FAILED',
  RECOVERING: 'RECOVERING',
}

export class IncidentEngine {
  constructor(engine = null) {
    this.redisEngine = engine
    this.activeIncident = null
    this._listeners = new Map()

    this.onStateChange = null
    this.onObjectiveChange = null
    this.onIncidentResolved = null
    this.onIncidentFailed = null
  }

  /**
   * Attach a MockRedisEngine instance.
   * @param {MockRedisEngine} engine 
   */
  attachEngine(engine) {
    this.redisEngine = engine
  }

  /**
   * Subscribe to incident engine events.
   * @param {string} event 
   * @param {Function} listener 
   * @returns {Function} Unsubscribe function
   */
  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(listener)
    return () => this.off(event, listener)
  }

  /**
   * Unsubscribe from incident engine events.
   * @param {string} event 
   * @param {Function} listener 
   */
  off(event, listener) {
    this._listeners.get(event)?.delete(listener)
  }

  /**
   * Emit an event to registered listeners.
   * @param {string} event 
   * @param {Object} payload 
   */
  emit(event, payload) {
    const listeners = this._listeners.get(event)
    if (listeners) {
      for (const fn of listeners) {
        try {
          fn(payload)
        } catch (err) {
          console.error(`Error in IncidentEngine listener for event "${event}":`, err)
        }
      }
    }
  }

  /**
   * Returns the current state string of the active incident, or DORMANT if none.
   * @returns {string}
   */
  getState() {
    return this.activeIncident ? this.activeIncident.state : INCIDENT_STATES.DORMANT
  }

  /**
   * Explicitly set the active incident state.
   * @param {string} newState 
   */
  setState(newState) {
    if (!this.activeIncident) return
    const previousState = this.activeIncident.state
    if (previousState === newState) return

    this.activeIncident.state = newState
    this.emit('stateChange', {
      previousState,
      currentState: newState,
      activeIncident: this.activeIncident,
    })

    if (typeof this.onStateChange === 'function') {
      this.onStateChange(newState, previousState, this.activeIncident)
    }

    if (newState === INCIDENT_STATES.RESOLVED) {
      this.emit('resolved', { activeIncident: this.activeIncident })
      if (typeof this.onIncidentResolved === 'function') {
        this.onIncidentResolved(this.activeIncident)
      }
    } else if (newState === INCIDENT_STATES.FAILED) {
      this.emit('failed', { activeIncident: this.activeIncident })
      if (typeof this.onIncidentFailed === 'function') {
        this.onIncidentFailed(this.activeIncident)
      }
    }
  }

  /**
   * Adjust active incident health, clamped between 0 and 100.
   * @param {number} delta 
   */
  adjustHealth(delta) {
    if (!this.activeIncident) return
    const prev = this.activeIncident.health
    const next = Math.max(0, Math.min(100, prev + delta))
    this.activeIncident.health = next

    this.emit('healthChange', {
      health: next,
      previousHealth: prev,
      delta,
      activeIncident: this.activeIncident,
    })

    if (next <= 0 && this.activeIncident.state !== INCIDENT_STATES.FAILED && this.activeIncident.state !== INCIDENT_STATES.RESOLVED) {
      this.setState(INCIDENT_STATES.FAILED)
    }
  }

  /**
   * Adjust active incident pressure, clamped between 0 and 100.
   * @param {number} delta 
   */
  adjustPressure(delta) {
    if (!this.activeIncident) return
    const prev = this.activeIncident.pressure
    const next = Math.max(0, Math.min(100, prev + delta))
    this.activeIncident.pressure = next

    this.emit('pressureChange', {
      pressure: next,
      previousPressure: prev,
      delta,
      activeIncident: this.activeIncident,
    })

    const { state, escalationThreshold, mitigationThreshold } = this.activeIncident

    if (next >= escalationThreshold && state === INCIDENT_STATES.ACTIVE) {
      this.setState(INCIDENT_STATES.ESCALATING)
    } else if (next <= mitigationThreshold && state === INCIDENT_STATES.ESCALATING) {
      this.setState(INCIDENT_STATES.MITIGATED)
    }
  }

  /**
   * Start an incident using an incident definition.
   * @param {Object} incidentDef 
   * @param {MockRedisEngine} [engine] 
   * @returns {Object} active incident object
   */
  startIncident(incidentDef, engine = null) {
    if (engine) {
      this.redisEngine = engine
    }

    const initialHealth = incidentDef.initialHealth ?? 100
    const initialPressure = incidentDef.initialPressure ?? 0
    const escalationThreshold = incidentDef.escalationThreshold ?? 75

    let initialState = INCIDENT_STATES.ACTIVE
    if (initialPressure >= escalationThreshold) {
      initialState = INCIDENT_STATES.ESCALATING
    }

    this.activeIncident = {
      id: incidentDef.id,
      title: incidentDef.title || incidentDef.name || incidentDef.id,
      regionId: incidentDef.regionId || null,
      state: initialState,
      health: initialHealth,
      pressure: initialPressure,
      objectives: incidentDef.objectives || [],
      objectiveStatus: {},
      allPassed: false,
      escalationTriggers: incidentDef.escalationTriggers || [],
      pressureRate: incidentDef.pressureRate ?? 5,
      healthDrainRate: incidentDef.healthDrainRate ?? 5,
      escalationThreshold: escalationThreshold,
      mitigationThreshold: incidentDef.mitigationThreshold ?? 30,
      recoveryRate: incidentDef.recoveryRate ?? 10,
      definition: incidentDef,
    }

    const hasObjectives =
      this.activeIncident.objectives &&
      (Array.isArray(this.activeIncident.objectives)
        ? this.activeIncident.objectives.length > 0
        : Object.keys(this.activeIncident.objectives).length > 0)

    if (this.redisEngine && hasObjectives) {
      const { allPassed, statusMap } = evaluateObjectives(
        this.activeIncident.objectives,
        this.redisEngine
      )
      this.activeIncident.objectiveStatus = statusMap
      this.activeIncident.allPassed = allPassed
      if (allPassed) {
        this.activeIncident.state = INCIDENT_STATES.RESOLVED
      }
    }

    this.emit('incidentStarted', { activeIncident: this.activeIncident })
    this.emit('stateChange', {
      previousState: INCIDENT_STATES.DORMANT,
      currentState: this.activeIncident.state,
      activeIncident: this.activeIncident,
    })

    return this.activeIncident
  }

  /**
   * Stop/clear the active incident.
   */
  stopIncident() {
    const prev = this.activeIncident
    this.activeIncident = null
    if (prev) {
      this.emit('incidentStopped', { activeIncident: prev })
    }
  }

  /**
   * Evaluates state changes on command execution.
   */
  onCommandExecuted(cmd, args, result, engine) {
    if (!this.activeIncident) return
    if (
      this.activeIncident.state === INCIDENT_STATES.RESOLVED ||
      this.activeIncident.state === INCIDENT_STATES.FAILED
    ) {
      return
    }

    let commandName = ''
    let cmdArgs = []
    let cmdResult = result
    let redisEngine = engine || this.redisEngine

    if (cmd && typeof cmd === 'object') {
      commandName = String(cmd.command || cmd.cmd || '')
      cmdArgs = cmd.args || args || []
      cmdResult = cmd.result !== undefined ? cmd.result : result
      if (!redisEngine && args && typeof args._get === 'function') {
        redisEngine = args
      }
    } else {
      commandName = String(cmd || '')
      cmdArgs = Array.isArray(args) ? args : []
      if (!redisEngine && result && typeof result._get === 'function') {
        redisEngine = result
      }
    }

    // Process escalation triggers
    if (this.activeIncident.escalationTriggers) {
      for (const trigger of this.activeIncident.escalationTriggers) {
        if (typeof trigger === 'function') {
          trigger({ command: commandName, args: cmdArgs, result: cmdResult, engine: redisEngine }, this)
        } else if (typeof trigger.onCommand === 'function') {
          trigger.onCommand({ command: commandName, args: cmdArgs, result: cmdResult, engine: redisEngine }, this)
        } else if (
          trigger.command &&
          trigger.command.toUpperCase() === commandName.toUpperCase()
        ) {
          if (trigger.pressureDelta) this.adjustPressure(trigger.pressureDelta)
          if (trigger.healthDelta) this.adjustHealth(trigger.healthDelta)
          if (trigger.targetState) this.setState(trigger.targetState)
          if (typeof trigger.action === 'function') {
            trigger.action(this, redisEngine)
          }
        }
      }
    }

    // Evaluate objectives
    if (redisEngine) {
      const { allPassed, statusMap } = evaluateObjectives(
        this.activeIncident.objectives,
        redisEngine
      )

      for (const [objId, newPassed] of Object.entries(statusMap)) {
        const oldPassed = this.activeIncident.objectiveStatus[objId]
        if (oldPassed !== newPassed) {
          this.activeIncident.objectiveStatus[objId] = newPassed
          this.emit('objectiveChange', {
            objectiveId: objId,
            passed: newPassed,
            statusMap,
            activeIncident: this.activeIncident,
          })
          if (typeof this.onObjectiveChange === 'function') {
            this.onObjectiveChange({
              objectiveId: objId,
              passed: newPassed,
              statusMap,
              activeIncident: this.activeIncident,
            })
          }
        }
      }

      this.activeIncident.allPassed = allPassed
      this.emit('objectivesUpdated', {
        statusMap,
        allPassed,
        activeIncident: this.activeIncident,
      })

      const hasObjectives = Object.keys(statusMap).length > 0
      if (hasObjectives && allPassed && this.activeIncident.state !== INCIDENT_STATES.RESOLVED) {
        this.setState(INCIDENT_STATES.RESOLVED)
      }
    }
  }

  /**
   * Periodic tick handling time-based pressure accumulation, health drain, and recovery.
   * @param {number} deltaMs Time elapsed in milliseconds
   */
  tick(deltaMs) {
    if (!this.activeIncident) return
    const state = this.activeIncident.state
    if (
      state === INCIDENT_STATES.DORMANT ||
      state === INCIDENT_STATES.RESOLVED ||
      state === INCIDENT_STATES.FAILED
    ) {
      return
    }

    const deltaSec = deltaMs / 1000

    // Pressure adjustments
    if (state === INCIDENT_STATES.ACTIVE || state === INCIDENT_STATES.ESCALATING) {
      const rate = this.activeIncident.pressureRate ?? 5
      this.adjustPressure(rate * deltaSec)
    } else if (state === INCIDENT_STATES.RECOVERING) {
      const rate = this.activeIncident.recoveryRate ?? 10
      this.adjustPressure(-rate * deltaSec)
    }

    // High pressure health drain & state escalation
    if (this.activeIncident.pressure >= this.activeIncident.escalationThreshold) {
      if (this.activeIncident.state === INCIDENT_STATES.ACTIVE) {
        this.setState(INCIDENT_STATES.ESCALATING)
      }
      const drainRate = this.activeIncident.healthDrainRate ?? 5
      const pressureFactor = this.activeIncident.pressure / 100
      this.adjustHealth(-(drainRate * deltaSec * pressureFactor))
    } else if (
      this.activeIncident.pressure <= this.activeIncident.mitigationThreshold &&
      this.activeIncident.state === INCIDENT_STATES.ESCALATING
    ) {
      this.setState(INCIDENT_STATES.MITIGATED)
    }

    if (this.activeIncident.health <= 0) {
      if (this.activeIncident.state !== INCIDENT_STATES.FAILED) {
        this.setState(INCIDENT_STATES.FAILED)
      }
      return
    }

    // Re-evaluate objectives on tick if redisEngine attached
    if (this.redisEngine) {
      const { allPassed, statusMap } = evaluateObjectives(
        this.activeIncident.objectives,
        this.redisEngine
      )
      this.activeIncident.objectiveStatus = statusMap
      this.activeIncident.allPassed = allPassed

      const hasObjectives = Object.keys(statusMap).length > 0
      if (hasObjectives && allPassed && this.activeIncident.state !== INCIDENT_STATES.RESOLVED) {
        this.setState(INCIDENT_STATES.RESOLVED)
      }
    }

    this.emit('tick', { activeIncident: this.activeIncident, deltaMs })
  }
}

export const incidentEngine = new IncidentEngine()
export default incidentEngine
