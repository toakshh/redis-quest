// Tests for ObjectiveSystem: throttled evaluation, transition-only events,
// and completion tracking.

import { describe, it, expect } from 'vitest'
import { createObjectiveSystem } from './ObjectiveSystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'

const DT = 1 / 60

function makeWorld(objectives) {
  const runtime = createRuntime({ seed: 'obj', now: () => 0 })
  const w = createSimWorld({ runtime, seed: 'obj', clock: () => 0 })
  const sys = createObjectiveSystem({ objectives, intervalTicks: 12 })
  w.addSystem(sys)
  return { w, sys }
}

function stepN(w, n) {
  for (let i = 0; i < n; i++) w.step(DT)
}

const OBJECTIVES = [
  { id: 'stored', predicate: { type: 'keyExists', key: 'k' } },
]

describe('ObjectiveSystem', () => {
  it('registers at the OBJECTIVE order', () => {
    expect(createObjectiveSystem().order).toBe(100)
  })

  it('does not evaluate before the interval elapses', () => {
    const { w } = makeWorld(OBJECTIVES)
    stepN(w, 11)
    expect(w.objectiveStatus).toBeUndefined()
  })

  it('evaluates on the interval tick', () => {
    const { w } = makeWorld(OBJECTIVES)
    stepN(w, 12)
    expect(w.objectiveStatus).toEqual({ stored: false })
    expect(w.objectivesComplete).toBe(false)
  })

  it('marks complete once the predicate holds', () => {
    const { w } = makeWorld(OBJECTIVES)
    w.engine.execute('SET k 1')
    stepN(w, 12)
    expect(w.objectiveStatus).toEqual({ stored: true })
    expect(w.objectivesComplete).toBe(true)
  })

  it('publishes sim:objectiveChanged only on transitions', () => {
    const { w } = makeWorld(OBJECTIVES)
    const events = []
    w.bus.on('sim:objectiveChanged', (p) => events.push(p))
    stepN(w, 12) // false (first observation is a transition from unknown)
    stepN(w, 12) // still false → no event
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: 'stored', passed: false })

    w.engine.execute('SET k 1')
    stepN(w, 12) // now true → one more event
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ id: 'stored', passed: true, allPassed: true })
  })

  it('setObjectives swaps the set and re-announces', () => {
    const { w, sys } = makeWorld(OBJECTIVES)
    const events = []
    w.bus.on('sim:objectiveChanged', (p) => events.push(p))
    stepN(w, 12)
    sys.setObjectives([{ id: 'other', predicate: { type: 'keyExists', key: 'z' } }])
    stepN(w, 12)
    expect(events.map((e) => e.id)).toContain('other')
  })
})
