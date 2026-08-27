// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SimProvider, useSim } from './SimProvider.jsx'

describe('SimProvider and useSim', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => cb(performance.now()), 16))
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(clearTimeout)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('1. Provides the context value to useSim', () => {
    const runtime = { id: 'rt' }
    const world = { id: 'w', step: vi.fn() }
    let ctxValue = null

    function TestChild() {
      ctxValue = useSim()
      return null
    }

    render(
      <SimProvider runtime={runtime} world={world}>
        <TestChild />
      </SimProvider>
    )

    expect(ctxValue).toEqual({ runtime, world })
  })

  it('2. Starts game loop via rAF on mount calling world.step', () => {
    const runtime = {}
    const world = { step: vi.fn() }

    render(<SimProvider runtime={runtime} world={world} />)

    expect(world.step).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20) // advance past first rAF tick
    expect(world.step).toHaveBeenCalled()
    // Verify it passed a delta time > 0
    expect(world.step.mock.calls[0][0]).toBeGreaterThan(0)
  })

  it('3. Cancels rAF on unmount', () => {
    const runtime = {}
    const world = { step: vi.fn() }

    const { unmount } = render(<SimProvider runtime={runtime} world={world} />)

    // Clear calls from mount
    world.step.mockClear()

    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()

    // Advancing timers should not cause any more step calls
    vi.advanceTimersByTime(100)
    expect(world.step).not.toHaveBeenCalled()
  })
})
