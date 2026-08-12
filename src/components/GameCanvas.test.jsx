import { describe, it, expect, beforeEach } from 'vitest'
import { createEngine } from '../engine/engine.js'
import { drawIsoTile, drawIsoBlock, gridToIso, isoToGrid } from '../game/IsometricRenderer.js'
import { REGION_MAPS } from './GameCanvas.jsx'

describe('Isometric Math & GameCanvas logic', () => {
  it('converts grid coordinates to iso and back', () => {
    const { x, y } = gridToIso(10, 5)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(0)

    const grid = isoToGrid(x, y)
    expect(Math.round(grid.x)).toBe(10)
    expect(Math.round(grid.y)).toBe(5)
  })

  it('defines 5 game regions with tilesets, chests and enemies', () => {
    expect(Object.keys(REGION_MAPS)).toHaveLength(5)
    expect(REGION_MAPS['memory-village']).toBeDefined()
    expect(REGION_MAPS['key-value-kingdom']).toBeDefined()
    expect(REGION_MAPS['pubsub-city']).toBeDefined()
    expect(REGION_MAPS['data-structure-dungeons']).toBeDefined()
    expect(REGION_MAPS['cluster-galaxy']).toBeDefined()
  })

  it('has chests with command gems in each region', () => {
    for (const rid of Object.keys(REGION_MAPS)) {
      const region = REGION_MAPS[rid]
      expect(region.chests.length).toBeGreaterThan(0)
      expect(region.chests[0].gem).toBeDefined()
    }
  })
})
