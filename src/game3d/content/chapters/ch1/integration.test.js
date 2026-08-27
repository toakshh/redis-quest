import { describe, it, expect } from 'vitest'
import { BEATS } from './beats/index.js'
import { createStoryGraph } from '../../../sim/story/StoryGraph.js'
import { createDirector } from '../../../sim/director/Director.js'
import { createEncounterBuilder } from '../../../sim/director/EncounterBuilder.js'

describe('Chapter 1 Integration (T-077)', () => {
  it('Simulates a 30-minute headless run reaching ch1_complete flag', () => {
    const graph = createStoryGraph(BEATS)
    const director = createDirector()
    const builder = createEncounterBuilder()

    const context = {
      playerZone: 'ZoneA',
      memoryBytes: 1024,
      memoryLimit: 2048,
      pttl: 300000,
      hitRatio: 0.9,
      hostilesNear: 0,
      timeSinceDamage: 20000,
      errorRate: 1,
      stats: {
        timeAlive: 0
      },
      memory: {
        fullness: 0
      },
      storyGraph: graph,
      objectives: {
        completed: 0
      }
    }

    const world = {
      flags: []
    }

    let clockMs = 0
    const timeStep = 1000 // 1s per tick
    const endTime = 30 * 60 * 1000 // 30 mins

    while (clockMs < endTime) {
      clockMs += timeStep
      context.stats.timeAlive = clockMs
      
      // Evolve simulation parameters
      if (clockMs > 60000) context.memory.fullness = 0.4
      if (clockMs > 150000) context.memory.fullness = 0.6
      if (clockMs > 300000) context.objectives.completed = 3 // Trigger end condition

      director.update(clockMs, context)
      const directorState = director.getState()

      const nextBeat = graph.evaluate(context)
      if (nextBeat) {
        builder.build(nextBeat, world, directorState)
        graph.markComplete(nextBeat.id)
      }

      if (world.flags.includes('ch1_complete')) {
        break
      }
    }

    expect(world.flags).toContain('ch1_complete')
    expect(graph.completed).toContain('ch1.b8_chapter_end')
  })
})
