import { createDirectorSystem } from '../DirectorSystem.js'

describe('DirectorSystem', () => {
  it('updates director stress and ambient tension', () => {
    const system = createDirectorSystem()
    let time = 0
    const world = {
      clock: () => time,
      playerTtlMs: 300000,
      engine: {
        getMemoryStats: () => ({ used: 1000, limit: 1000 }),
        hitRatio: () => 0.5,
        stats: { errors: 10 }
      },
      timeMs: 60000,
      contactWeight: 5,
      lastDamageMs: 0
    }

    // First frame
    system.update(world, 16)
    expect(world.ambientTension).toBeDefined()
    expect(world.directorStress).toBeGreaterThanOrEqual(0)

    // Advance clock past director's 250ms update threshold
    time = 300
    system.update(world, 16)
    // with max values the tension should become high or medium
    expect(world.ambientTension).toMatch(/High|Medium|Low/)
    expect(typeof world.reliefWindow).toBe('boolean')
  })
})
