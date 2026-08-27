import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../../engine/engine.js'
import { IncidentEngine, INCIDENT_STATES } from './IncidentEngine.js'
import { evaluateObjectives, evaluatePredicate } from './IncidentEvaluator.js'
import { IncidentRegistry } from './IncidentRegistry.js'

describe('IncidentEvaluator', () => {
  let engine

  beforeEach(() => {
    engine = new MockRedisEngine({ now: () => 1000000 })
  })

  it('evaluates keyEquals predicate', () => {
    engine.execute('SET mykey myval')
    expect(evaluatePredicate({ type: 'keyEquals', key: 'mykey', value: 'myval' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'keyEquals', key: 'mykey', value: 'wrong' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'keyEquals', key: 'nokey', value: 'myval' }, engine)).toBe(false)
  })

  it('evaluates keyExists and keyNotExists predicates', () => {
    engine.execute('SET existkey hello')
    expect(evaluatePredicate({ type: 'keyExists', key: 'existkey' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'keyExists', key: 'missingkey' }, engine)).toBe(false)

    expect(evaluatePredicate({ type: 'keyNotExists', key: 'missingkey' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'keyNotExists', key: 'existkey' }, engine)).toBe(false)
  })

  it('evaluates ttlBetween predicate', () => {
    engine.execute('SET ttlkey val EX 60')
    // TTL is 60 seconds
    expect(evaluatePredicate({ type: 'ttlBetween', key: 'ttlkey', min: 10, max: 100 }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'ttlBetween', key: 'ttlkey', min: 100, max: 200 }, engine)).toBe(false)

    engine.execute('SET persistent val')
    expect(evaluatePredicate({ type: 'ttlBetween', key: 'persistent', min: 0, max: 100 }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'ttlBetween', key: 'nokey', min: 0, max: 100 }, engine)).toBe(false)
  })

  it('evaluates listLengthBelow predicate', () => {
    engine.execute('RPUSH queue item1 item2 item3')
    expect(evaluatePredicate({ type: 'listLengthBelow', key: 'queue', max: 5 }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'listLengthBelow', key: 'queue', max: 3 }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'listLengthBelow', key: 'queue', max: 2 }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'listLengthBelow', key: 'missing', max: 1 }, engine)).toBe(true)
  })

  it('evaluates setContains and setNotContains predicates', () => {
    engine.execute('SADD myset alpha beta gamma')
    expect(evaluatePredicate({ type: 'setContains', key: 'myset', member: 'alpha' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'setContains', key: 'myset', member: 'delta' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'setContains', key: 'nokey', member: 'alpha' }, engine)).toBe(false)

    expect(evaluatePredicate({ type: 'setNotContains', key: 'myset', member: 'delta' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'setNotContains', key: 'myset', member: 'alpha' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'setNotContains', key: 'nokey', member: 'alpha' }, engine)).toBe(true)
  })

  it('evaluates hashFieldEquals and hashFieldNotExists predicates', () => {
    engine.execute('HSET myhash field1 val1 field2 val2')
    expect(evaluatePredicate({ type: 'hashFieldEquals', key: 'myhash', field: 'field1', value: 'val1' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'hashFieldEquals', key: 'myhash', field: 'field1', value: 'wrong' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'hashFieldEquals', key: 'myhash', field: 'missing', value: 'val1' }, engine)).toBe(false)

    expect(evaluatePredicate({ type: 'hashFieldNotExists', key: 'myhash', field: 'missing' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'hashFieldNotExists', key: 'myhash', field: 'field1' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'hashFieldNotExists', key: 'nokey', field: 'field1' }, engine)).toBe(true)
  })

  it('evaluates sortedSetTop predicate', () => {
    engine.execute('ZADD leaderboard 10 alice 50 bob 30 charlie')
    // Top member (highest score) is bob (50)
    expect(evaluatePredicate({ type: 'sortedSetTop', key: 'leaderboard', member: 'bob' }, engine)).toBe(true)
    expect(evaluatePredicate({ type: 'sortedSetTop', key: 'leaderboard', member: 'alice' }, engine)).toBe(false)
    expect(evaluatePredicate({ type: 'sortedSetTop', key: 'nokey', member: 'bob' }, engine)).toBe(false)
  })

  it('evaluates custom predicate', () => {
    const customTrue = { type: 'custom', check: (eng) => eng.now() > 500 }
    const customFalse = { type: 'custom', check: (eng) => eng.now() < 500 }
    expect(evaluatePredicate(customTrue, engine)).toBe(true)
    expect(evaluatePredicate(customFalse, engine)).toBe(false)
  })

  it('evaluates multiple objectives via evaluateObjectives', () => {
    engine.execute('SET k1 v1')
    engine.execute('HSET h1 f1 v1')

    const objectives = [
      { id: 'obj1', type: 'keyEquals', key: 'k1', value: 'v1' },
      { id: 'obj2', type: 'hashFieldEquals', key: 'h1', field: 'f1', value: 'v1' },
    ]

    const result = evaluateObjectives(objectives, engine)
    expect(result.allPassed).toBe(true)
    expect(result.statusMap).toEqual({ obj1: true, obj2: true })

    // Add failing objective
    const objWithFail = [
      ...objectives,
      { id: 'obj3', type: 'keyExists', key: 'missing' },
    ]
    const failResult = evaluateObjectives(objWithFail, engine)
    expect(failResult.allPassed).toBe(false)
    expect(failResult.statusMap).toEqual({ obj1: true, obj2: true, obj3: false })
  })
})

describe('IncidentRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new IncidentRegistry()
  })

  it('registers and retrieves incident definitions', () => {
    const def = { id: 'inc_1', regionId: 'region_a', name: 'Memory Pressure' }
    registry.register(def)

    expect(registry.get('inc_1')).toEqual(def)
    expect(registry.getIncident('inc_1')).toEqual(def)
    expect(registry.list()).toHaveLength(1)
    expect(registry.getByRegion('region_a')).toEqual([def])
    expect(registry.getByRegion('region_b')).toEqual([])
  })

  it('supports register with separate id argument and clear', () => {
    registry.register('inc_2', { regionId: 'region_b', name: 'High CPU' })
    expect(registry.get('inc_2')).toEqual({ id: 'inc_2', regionId: 'region_b', name: 'High CPU' })

    registry.clear()
    expect(registry.list()).toHaveLength(0)
  })
})

describe('IncidentEngine State Transitions & Lifecycle', () => {
  let incidentEngine
  let engine

  beforeEach(() => {
    engine = new MockRedisEngine({ now: () => 1000000 })
    incidentEngine = new IncidentEngine(engine)
  })

  it('starts in DORMANT state and transitions to ACTIVE on startIncident', () => {
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.DORMANT)

    const incDef = {
      id: 'inc_leak',
      title: 'Memory Leak Surge',
      objectives: [
        { id: 'drain', type: 'listLengthBelow', key: 'leak_queue', max: 2 },
      ],
      initialHealth: 100,
      initialPressure: 10,
    }

    engine.execute('RPUSH leak_queue item1 item2 item3 item4')
    const active = incidentEngine.startIncident(incDef)

    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ACTIVE)
    expect(active.health).toBe(100)
    expect(active.pressure).toBe(10)
    expect(active.objectiveStatus.drain).toBe(false)
  })

  it('evaluates command execution and resolves incident when objectives pass', () => {
    const incDef = {
      id: 'inc_flush',
      objectives: [
        { id: 'clean_keys', type: 'keyNotExists', key: 'dirty_flag' },
      ],
    }

    engine.execute('SET dirty_flag true')
    incidentEngine.startIncident(incDef)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ACTIVE)

    let objectiveEventFired = false
    let resolvedFired = false

    incidentEngine.on('objectiveChange', ({ objectiveId, passed }) => {
      if (objectiveId === 'clean_keys' && passed) objectiveEventFired = true
    })

    incidentEngine.on('resolved', () => {
      resolvedFired = true
    })

    // Player deletes key
    engine.execute('DEL dirty_flag')
    incidentEngine.onCommandExecuted('DEL', ['dirty_flag'], 1, engine)

    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.RESOLVED)
    expect(objectiveEventFired).toBe(true)
    expect(resolvedFired).toBe(true)
  })

  it('handles pressure changes and auto-escalation', () => {
    const incDef = {
      id: 'inc_pressure',
      initialPressure: 50,
      escalationThreshold: 75,
      mitigationThreshold: 30,
    }

    incidentEngine.startIncident(incDef)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ACTIVE)

    let stateChanges = []
    incidentEngine.on('stateChange', ({ currentState }) => {
      stateChanges.push(currentState)
    })

    // Raise pressure past 75
    incidentEngine.adjustPressure(30) // 50 -> 80
    expect(incidentEngine.activeIncident.pressure).toBe(80)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ESCALATING)

    // Lower pressure below 30
    incidentEngine.adjustPressure(-55) // 80 -> 25
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.MITIGATED)

    expect(stateChanges).toEqual([INCIDENT_STATES.ESCALATING, INCIDENT_STATES.MITIGATED])
  })

  it('drains health during high pressure and fails incident when health hits 0', () => {
    const incDef = {
      id: 'inc_failure',
      initialHealth: 20,
      initialPressure: 80,
      escalationThreshold: 75,
      healthDrainRate: 50,
    }

    incidentEngine.startIncident(incDef)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ESCALATING)

    let failedEvent = false
    incidentEngine.on('failed', () => {
      failedEvent = true
    })

    // Tick for 1000ms (1 sec) -> drain rate 50 * 1 * 0.8 = 40 HP drain -> health <= 0
    incidentEngine.tick(1000)

    expect(incidentEngine.activeIncident.health).toBe(0)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.FAILED)
    expect(failedEvent).toBe(true)
  })

  it('triggers escalation triggers on command execution', () => {
    const incDef = {
      id: 'inc_triggers',
      escalationTriggers: [
        {
          command: 'FLUSHALL',
          pressureDelta: 40,
        },
        ({ command }, inst) => {
          if (command === 'SPECIAL') {
            inst.adjustHealth(-10)
          }
        },
      ],
      initialPressure: 10,
    }

    incidentEngine.startIncident(incDef)
    expect(incidentEngine.activeIncident.pressure).toBe(10)

    incidentEngine.onCommandExecuted('FLUSHALL', [], 'OK', engine)
    expect(incidentEngine.activeIncident.pressure).toBe(50)

    incidentEngine.onCommandExecuted({ command: 'SPECIAL', args: [] })
    expect(incidentEngine.activeIncident.health).toBe(90)
  })

  it('handles periodic tick pressure accumulation and recovery', () => {
    const incDef = {
      id: 'inc_tick',
      initialPressure: 0,
      pressureRate: 10, // 10 per sec
      recoveryRate: 20,
    }

    incidentEngine.startIncident(incDef)

    incidentEngine.tick(2000) // 2 seconds
    expect(incidentEngine.activeIncident.pressure).toBe(20)

    // Transition to RECOVERING and tick
    incidentEngine.setState(INCIDENT_STATES.RECOVERING)
    incidentEngine.tick(1000) // -20 pressure
    expect(incidentEngine.activeIncident.pressure).toBe(0)
  })

  it('supports stopping incidents and clearing listeners', () => {
    const incDef = { id: 'inc_stop' }
    incidentEngine.startIncident(incDef)
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.ACTIVE)

    incidentEngine.stopIncident()
    expect(incidentEngine.getState()).toBe(INCIDENT_STATES.DORMANT)
    expect(incidentEngine.activeIncident).toBeNull()
  })
})
