import { describe, it, expect } from 'vitest'
import { createCollisionSystem, boxesFromColliders } from './CollisionSystem.js'
import { createEntityStore } from '../entity/EntityStore.js'
import { ARCHETYPE, BODY_RADIUS } from '../entity/archetypes.js'
import { SYSTEM_ORDER } from '../SimWorld.js'

// A 40×40 room: floor with its top face at y = 0.5, and a wall at x = -20.
const FLOOR = { type: 'cuboid', args: [20, 1, 20], position: [0, -0.5, 0] }
const WEST_WALL = { type: 'cuboid', args: [1, 5, 20], position: [-20, 2.5, 0] }

function makeWorld(colliders) {
  const entities = createEntityStore()
  const system = createCollisionSystem({ colliders })
  return { world: { entities }, entities, system }
}

describe('boxesFromColliders', () => {
  it('converts half-extents plus centre into flat min/max bounds', () => {
    const boxes = boxesFromColliders([FLOOR])
    // min = centre - half, max = centre + half
    expect(Array.from(boxes)).toEqual([-20, -1.5, -20, 20, 0.5, 20])
  })

  it('packs one box per six floats', () => {
    expect(boxesFromColliders([FLOOR, WEST_WALL]).length).toBe(12)
  })
})

describe('CollisionSystem', () => {
  it('runs in the PHYSICS_SYNC slot, right after movement integrates', () => {
    const { system } = makeWorld([FLOOR])
    expect(system.order).toBe(SYSTEM_ORDER.PHYSICS_SYNC)
  })

  it('rests a falling entity on the floor instead of letting it sink', () => {
    const { world, entities, system } = makeWorld([FLOOR])
    const id = entities.spawn(ARCHETYPE.PLAYER, 0, 0.3, 0)
    entities.velY[id] = -4

    system.update(world)

    expect(entities.posY[id]).toBeCloseTo(0.5, 5)
    expect(entities.velY[id]).toBe(0)
    expect(system.grounded[id]).toBe(1)
  })

  it('reports not-grounded while an entity is still in the air', () => {
    const { world, entities, system } = makeWorld([FLOOR])
    const id = entities.spawn(ARCHETYPE.PLAYER, 0, 6, 0)
    entities.velY[id] = -4

    system.update(world)

    expect(system.grounded[id]).toBe(0)
    expect(entities.posY[id]).toBe(6)
  })

  it('does not cancel an entity moving upward off the floor', () => {
    const { world, entities, system } = makeWorld([FLOOR])
    const id = entities.spawn(ARCHETYPE.PLAYER, 0, 0.6, 0)
    entities.velY[id] = 5

    system.update(world)

    expect(entities.velY[id]).toBe(5)
  })

  it('pushes an entity out of a wall it has walked into', () => {
    const { world, entities, system } = makeWorld([FLOOR, WEST_WALL])
    // Wall spans x = -21..-19. Put the body centre inside its east face.
    const id = entities.spawn(ARCHETYPE.PLAYER, -19.2, 0.5, 0)

    system.update(world)

    const r = BODY_RADIUS[ARCHETYPE.PLAYER]
    // Ejected to at least a full radius clear of the wall's east face.
    expect(entities.posX[id]).toBeGreaterThanOrEqual(-19 + r - 1e-4)
  })

  it('leaves an entity in open floor untouched on the horizontal axes', () => {
    const { world, entities, system } = makeWorld([FLOOR, WEST_WALL])
    const id = entities.spawn(ARCHETYPE.PLAYER, 5, 0.5, 5)

    system.update(world)

    expect(entities.posX[id]).toBeCloseTo(5, 5)
    expect(entities.posZ[id]).toBeCloseTo(5, 5)
  })

  it('keeps a walled room sealed against a body driven hard into the wall', () => {
    const { world, entities, system } = makeWorld([FLOOR, WEST_WALL])
    const id = entities.spawn(ARCHETYPE.PLAYER, -10, 0.5, 0)

    // Drive west for 120 ticks; the wall must stop it.
    for (let i = 0; i < 120; i++) {
      entities.posX[id] -= 0.5
      system.update(world)
    }

    expect(entities.posX[id]).toBeGreaterThan(-19)
  })

  it('is deterministic — identical inputs produce identical positions', () => {
    function run() {
      const { world, entities, system } = makeWorld([FLOOR, WEST_WALL])
      const id = entities.spawn(ARCHETYPE.CRAWLER, -18.7, 2, 3)
      entities.velY[id] = -3
      for (let i = 0; i < 30; i++) {
        entities.posX[id] -= 0.05
        system.update(world)
      }
      return [entities.posX[id], entities.posY[id], entities.posZ[id]]
    }
    expect(run()).toEqual(run())
  })

  it('uses the archetype body radius, so a wider body stops further out', () => {
    const { world, entities, system } = makeWorld([FLOOR, WEST_WALL])
    const player = entities.spawn(ARCHETYPE.PLAYER, -19.1, 0.5, 0)
    const stalker = entities.spawn(ARCHETYPE.STALKER, -19.1, 0.5, 8)

    system.update(world)

    // STALKER has the larger radius, so it is pushed further from the wall.
    expect(entities.posX[stalker]).toBeGreaterThan(entities.posX[player])
  })
})
