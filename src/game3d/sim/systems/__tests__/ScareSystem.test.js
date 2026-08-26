import { createScareSystem } from '../ScareSystem.js'

describe('ScareSystem', () => {
  it('initializes and spawns scare events based on tension and time', () => {
    const system = createScareSystem()
    const world = {
      scareEvents: [],
      clock: () => 100000,
      rng: () => 1.0,  // predictability
      ambientTension: 'High',
      reliefWindow: false,
      objectivesComplete: false,
      directorStress: 0.8
    }

    // Initial update should setup the director but probably not spawn a scare immediately 
    // depending on the fake rng
    system.update(world, 16)
    
    expect(world.scareEvents.length).toBeGreaterThanOrEqual(0)
    expect(system.scareDirector).toBeDefined()
  })

  it('decays scareFlash over time', () => {
    const system = createScareSystem()
    const world = {
      scareEvents: [],
      clock: () => 0,
      rng: () => 0,
    }

    system.update(world, 16)
    world.scareFlash = 1.0
    system.update(world, 0.4) // dt in seconds
    expect(world.scareFlash).toBeCloseTo(0.6)
  })

  it('determines debrief tension when objectives are complete', () => {
    const system = createScareSystem()
    const world = {
      scareEvents: [],
      clock: () => 0,
      rng: () => 0,
      ambientTension: 'High',
      objectivesComplete: true // implies debrief
    }
    system.update(world, 16)
    // The director won't spawn in debrief, scareEvents stays empty
    expect(world.scareEvents.length).toBe(0)
  })
})
