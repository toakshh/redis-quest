import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameLoop } from './GameLoop.js'

describe('GameLoop', () => {
  let originalRAF, originalCAF, originalPerformance

  beforeEach(() => {
    originalRAF = global.requestAnimationFrame
    originalCAF = global.cancelAnimationFrame
    originalPerformance = global.performance

    global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 0))
    global.cancelAnimationFrame = vi.fn()
    global.performance = { now: vi.fn(() => Date.now()) }
  })

  afterEach(() => {
    global.requestAnimationFrame = originalRAF
    global.cancelAnimationFrame = originalCAF
    global.performance = originalPerformance
    vi.clearAllMocks()
  })

  it('starts and stops cleanly', () => {
    const loop = new GameLoop({ targetFps: 60 })
    expect(loop.running).toBe(false)

    loop.start()
    expect(loop.running).toBe(true)
    expect(global.requestAnimationFrame).toHaveBeenCalled()

    loop.stop()
    expect(loop.running).toBe(false)
    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('does not double-start', () => {
    const loop = new GameLoop({ targetFps: 60 })
    loop.start()
    loop.start()
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1)
    loop.stop()
  })

  it('advances update loop with fixed dt', () => {
    const onUpdate = vi.fn()
    const loop = new GameLoop({ onUpdate, targetFps: 60, maxAccumSeconds: 1 })
    loop.start()

    // Step 1 frame worth (16.66ms)
    loop.step(1/60)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(1/60)

    loop.stop()
  })

  it('accumulates and runs multiple updates per frame', () => {
    const onUpdate = vi.fn()
    const loop = new GameLoop({ onUpdate, targetFps: 60, maxAccumSeconds: 1 })
    loop.start()

    // Step 3 frames worth (3 * 16.66ms)
    loop.step(3/60)
    expect(onUpdate).toHaveBeenCalledTimes(3)

    loop.stop()
  })

  it('renders with interpolation alpha', () => {
    const onRender = vi.fn()
    const loop = new GameLoop({ onRender, targetFps: 60 })
    loop.start()

    // Step 0.5 frames worth - accum = 0.5 * dt, alpha should be 0.5
    loop.step(0.5/60)
    expect(onRender).toHaveBeenCalled()
    expect(onRender).toHaveBeenCalledWith(0.5)

    loop.stop()
  })

  it('clamps frame time to maxAccumSeconds (spiral of death protection)', () => {
    const onUpdate = vi.fn()
    const loop = new GameLoop({ onUpdate, targetFps: 60, maxAccumSeconds: 0.25 })
    loop.start()

    // Step 1 second (way over maxAccumSeconds) - should be clamped to 0.25
    loop.step(1.0)
    // 0.25 / (1/60) = 15 updates max
    expect(onUpdate).toHaveBeenCalledTimes(15)

    loop.stop()
  })

  it('calculates FPS correctly', () => {
    let time = 1000
    global.performance = { now: vi.fn(() => time) }

    const loop = new GameLoop({ targetFps: 60 })
    loop.start()

    // Simulate 60 frames over 1 second
    for (let i = 0; i < 60; i++) {
      time += 16.66
      loop.step(1/60)
    }

    expect(loop.fps).toBe(60)
    loop.stop()
  })

  it('exposes dt correctly', () => {
    const loop = new GameLoop({ targetFps: 60 })
    expect(loop.dt).toBeCloseTo(1/60, 5)

    const loop30 = new GameLoop({ targetFps: 30 })
    expect(loop30.dt).toBeCloseTo(1/30, 5)
  })

  it('manual step works without start/stop', () => {
    const onUpdate = vi.fn()
    const onRender = vi.fn()
    const loop = new GameLoop({ onUpdate, onRender, targetFps: 60 })

    loop.step(1/60)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onRender).toHaveBeenCalledTimes(1)
  })
})