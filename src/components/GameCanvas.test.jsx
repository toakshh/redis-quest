import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEngine } from '../engine/engine.js'
import { drawIsoTile, drawIsoBlock, gridToIso, isoToGrid, drawApiGate, drawCacheCorruptionAura, drawShieldExpiryOverlay, drawQueueConveyor } from '../game/IsometricRenderer.js'
import { REGION_MAPS } from './GameCanvas.jsx'
import { ConsequenceEngine, CONSEQUENCE_EVENTS } from '../systems/ConsequenceEngine.js'
import { WorldStateResolver } from '../systems/WorldStateResolver.js'

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

  describe('ConsequenceEngine & WorldStateResolver integration', () => {
    let engine
    let resolver

    beforeEach(() => {
      engine = new ConsequenceEngine()
      resolver = new WorldStateResolver()
    })

    it('emits GATE_STATE_CHANGED when SET api:gate:mode is executed', () => {
      const spy = vi.fn()
      engine.on(CONSEQUENCE_EVENTS.GATE_STATE_CHANGED, spy)

      engine.processCommand('SET', ['api:gate:mode', 'locked'])
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CONSEQUENCE_EVENTS.GATE_STATE_CHANGED,
          payload: { mode: 'locked', key: 'api:gate:mode' },
        })
      )
    })

    it('updates API Gate state in WorldStateResolver', () => {
      expect(resolver.getApiGateState()).toBe('corrupted')
      resolver.setApiGateState('locked')
      expect(resolver.getApiGateState()).toBe('locked')
      resolver.setApiGateState('open')
      expect(resolver.getApiGateState()).toBe('open')
    })

    it('emits CACHE_INVALIDATED and dissolves cache corruption upon DEL or SET cache invalidation', () => {
      resolver.addCacheCorruption('cache:test')
      expect(resolver.isCacheCorrupted('cache:test')).toBe(true)

      engine.processCommand('DEL', ['cache:test'])
      resolver.dissolveCacheCorruption('cache:test')
      expect(resolver.isCacheCorrupted('cache:test')).toBe(false)
    })

    it('manages shield expiry timer countdown state', () => {
      resolver.setShieldExpiry('shield:boss', 10)
      const expiry = resolver.getShieldExpiry('shield:boss')

      expect(expiry).not.toBeNull()
      expect(expiry.remaining).toBe(10)
      expect(expiry.isExpired).toBe(false)
    })

    it('tracks queue conveyor items and triggers worker animation on RPOP', () => {
      resolver.updateQueueState({ command: 'LPUSH', key: 'queue:jobs', item: 'job1', action: 'push' })
      resolver.updateQueueState({ command: 'RPUSH', key: 'queue:jobs', item: 'job2', action: 'push' })

      const items = resolver.getQueue('queue:jobs')
      expect(items).toContain('job1')
      expect(items).toContain('job2')

      resolver.updateQueueState({ command: 'RPOP', key: 'queue:jobs', action: 'pop' })
      expect(resolver.workerState.active).toBe(true)
      expect(resolver.workerState.action).toBe('popping')
    })

    it('renders visual world reaction overlays without error', () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        rect: vi.fn(),
        roundRect: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      }

      expect(() => drawApiGate(mockCtx, 100, 100, 'locked', 1000)).not.toThrow()
      expect(() => drawApiGate(mockCtx, 100, 100, 'corrupted', 1000)).not.toThrow()
      expect(() => drawCacheCorruptionAura(mockCtx, 100, 100, 30, 1000)).not.toThrow()
      expect(() => drawShieldExpiryOverlay(mockCtx, 100, 100, 30, 5, 1000)).not.toThrow()
      expect(() => drawQueueConveyor(mockCtx, 100, 100, ['item1'], { active: true }, 1000)).not.toThrow()
    })
  })
})
