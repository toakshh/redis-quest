import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Camera } from './Camera.js'

describe('Camera', () => {
  let camera

  beforeEach(() => {
    camera = new Camera({
      viewportWidth: 800,
      viewportHeight: 600,
      minZoom: 0.5,
      maxZoom: 3,
      // No world bounds by default - tests that need bounds will set them
    })
  })

  it('initializes with correct defaults', () => {
    expect(camera.position).toEqual({ x: 0, y: 0 })
    expect(camera.zoom).toBe(1)
    expect(camera.viewportWidth).toBe(800)
    expect(camera.viewportHeight).toBe(600)
  })

  it('moves instantly to position', () => {
    camera.moveTo(100, 200)
    expect(camera.position).toEqual({ x: 100, y: 200 })
    expect(camera.targetPosition).toEqual({ x: 100, y: 200 })
  })

  it('clamps position to world bounds on moveTo', () => {
    camera.setWorldBounds({ x: 0, y: 0, width: 2000, height: 1500 })
    camera.moveTo(-100, -100)
    // half viewport at zoom 1 = 400x300, so min is 400,300
    expect(camera.position.x).toBe(400)
    expect(camera.position.y).toBe(300)

    camera.moveTo(2100, 1600)
    expect(camera.position.x).toBe(1600)
    expect(camera.position.y).toBe(1200)
  })

  it('follows target smoothly', () => {
    const target = { x: 500, y: 500 }
    camera.follow(target)

    // Update with dt - should move toward target
    camera.update(0.016) // ~60fps
    expect(camera.position.x).toBeGreaterThan(0)
    expect(camera.position.x).toBeLessThan(500)
  })

  it('unfollow stops at current position', () => {
    camera.moveTo(100, 100)
    camera.follow({ x: 1000, y: 1000 })
    camera.update(0.016)
    camera.unfollow()
    camera.update(0.016)
    // Should not continue moving after unfollow
    const posAfter = { ...camera.position }
    camera.update(0.016)
    expect(camera.position).toEqual(posAfter)
  })

  it('sets zoom with clamping', () => {
    camera.setZoom(5)
    expect(camera.zoom).toBe(3)

    camera.setZoom(0.1)
    expect(camera.zoom).toBe(0.5)

    camera.setZoom(2)
    expect(camera.zoom).toBe(2)
  })

  it('smoothly zooms to target', () => {
    camera.zoomTo(2)
    camera.update(0.016)
    expect(camera.zoom).toBeGreaterThan(1)
    expect(camera.zoom).toBeLessThan(2)
  })

  it('zoomBy multiplies current zoom', () => {
    camera.setZoom(1)
    camera.zoomBy(0.1) // zoom in ~10%
    expect(camera.targetZoom).toBeGreaterThan(1)
  })

  it('pans by world delta', () => {
    camera.moveTo(500, 500)
    camera.panBy(100, -50)
    expect(camera.targetPosition).toEqual({ x: 600, y: 450 })
  })

  it('shakes with intensity and duration', () => {
    camera.shake(10, 500)
    expect(camera.shakeIntensity).toBe(10)
    expect(camera.shakeDuration).toBe(500)
    expect(camera.shakeTimer).toBe(500)

    camera.update(0.1) // 100ms
    expect(camera.shakeOffset.x).not.toBe(0)
    expect(camera.shakeOffset.y).not.toBe(0)
  })

  it('shake decays and stops', () => {
    camera.shake(10, 100)
    camera.update(0.2) // 200ms > duration
    expect(camera.shakeIntensity).toBe(0)
    expect(camera.shakeOffset).toEqual({ x: 0, y: 0 })
  })

  it('worldToViewport converts correctly', () => {
    camera.moveTo(0, 0)
    camera.setZoom(1)
    const vp = camera.worldToViewport(0, 0)
    expect(vp).toEqual({ x: 400, y: 300 }) // center of 800x600

    const vp2 = camera.worldToViewport(100, 50)
    expect(vp2).toEqual({ x: 500, y: 350 })
  })

  it('viewportToWorld inverts worldToViewport', () => {
    camera.moveTo(100, 200)
    camera.setZoom(2)
    const world = { x: 150, y: 250 }
    const vp = camera.worldToViewport(world.x, world.y)
    const back = camera.viewportToWorld(vp.x, vp.y)
    expect(back.x).toBeCloseTo(world.x, 5)
    expect(back.y).toBeCloseTo(world.y, 5)
  })

  it('getVisibleWorldRect returns correct view bounds', () => {
    camera.setWorldBounds({ x: 0, y: 0, width: 5000, height: 5000 })
    camera.moveTo(500, 500)
    camera.setZoom(1)
    const rect = camera.getVisibleWorldRect()
    expect(rect.x).toBe(100) // 500 - 400
    expect(rect.y).toBe(200) // 500 - 300
    expect(rect.width).toBe(800)
    expect(rect.height).toBe(600)
  })

  it('isVisible detects visible and hidden rects', () => {
    camera.setWorldBounds({ x: 0, y: 0, width: 5000, height: 5000 })
    camera.moveTo(500, 500)
    camera.setZoom(1)
    // 100x100 at (400,400) - visible
    expect(camera.isVisible(400, 400, 100, 100)).toBe(true)
    // 100x100 at (0,0) - outside view
    expect(camera.isVisible(0, 0, 100, 100)).toBe(false)
  })

  it('applyToContext and restoreContext work', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
    }
    camera.applyToContext(ctx)
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.translate).toHaveBeenCalled()
    expect(ctx.scale).toHaveBeenCalled()
    camera.restoreContext(ctx)
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('getViewMatrix returns correct transform array', () => {
    camera.moveTo(100, 100)
    camera.setZoom(2)
    const matrix = camera.getViewMatrix()
    // [zoom, 0, 0, zoom, -pos.x*zoom + vpW/2, -pos.y*zoom + vpH/2]
    expect(matrix[0]).toBe(2)
    expect(matrix[3]).toBe(2)
    expect(matrix[4]).toBe(-100 * 2 + 400) // 200
    expect(matrix[5]).toBe(-100 * 2 + 300) // 100
  })

  it('setViewportSize updates and clamps', () => {
    camera.setViewportSize(1000, 800)
    expect(camera.viewportWidth).toBe(1000)
    expect(camera.viewportHeight).toBe(800)
  })

  it('setWorldBounds updates bounds', () => {
    camera.setWorldBounds({ x: 0, y: 0, width: 5000, height: 5000 })
    camera.moveTo(100, 100)
    // Should be clamped to new bounds
    expect(camera.position.x).toBeGreaterThanOrEqual(0)
  })
})