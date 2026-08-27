// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import CardComposer from './CardComposer.jsx'

vi.mock('../../config/feel.js', () => ({
  FEEL: {
    ui: {
      cardComposerSlowFactor: 0.35
    }
  }
}))

const mockWorld = { timeScale: 1 }

describe('CardComposer', () => {
  let originalTimeScale = 1
  beforeEach(() => {
    mockWorld.timeScale = 1
    originalTimeScale = 1
  })

  it('1. Renders nothing or closed state by default', () => {
    const { queryByTestId } = render(<CardComposer world={mockWorld} />)
    expect(queryByTestId('card-composer')).toBeNull()
  })

  it('2. RMB down opens the composer and slows time', () => {
    const { getByTestId } = render(<CardComposer world={mockWorld} />)

    expect(mockWorld.timeScale).toBe(1)

    // Fire RMB down
    fireEvent.mouseDown(window, { button: 2 })

    expect(getByTestId('card-composer')).toBeDefined()
    expect(mockWorld.timeScale).toBe(0.35)
  })

  it('3. Displays assembled command', () => {
    const { getByTestId } = render(<CardComposer world={mockWorld} />)
    fireEvent.mouseDown(window, { button: 2 })
    expect(getByTestId('assembled-string').textContent).toBe('SET key value')
  })

  it('4. RMB up closes, restores timeScale, calls onFire', () => {
    const onFire = vi.fn()
    const { queryByTestId } = render(<CardComposer world={mockWorld} onFire={onFire} />)

    // Open
    fireEvent.mouseDown(window, { button: 2 })
    expect(mockWorld.timeScale).toBe(0.35)

    // Close
    fireEvent.mouseUp(window, { button: 2 })
    expect(queryByTestId('card-composer')).toBeNull()

    expect(mockWorld.timeScale).toBe(1)
    expect(onFire).toHaveBeenCalledWith('SET key value')
  })

  it('5. Updating onFire callback does not reset timescale while open', () => {
    const onFire1 = vi.fn()
    const { rerender } = render(<CardComposer world={mockWorld} onFire={onFire1} />)

    // Open
    fireEvent.mouseDown(window, { button: 2 })
    expect(mockWorld.timeScale).toBe(0.35)

    // Rerender with a different callback
    const onFire2 = vi.fn()
    rerender(<CardComposer world={mockWorld} onFire={onFire2} />)

    // Timescale should remain slowed
    expect(mockWorld.timeScale).toBe(0.35)

    // Close
    fireEvent.mouseUp(window, { button: 2 })
    expect(mockWorld.timeScale).toBe(1)
    expect(onFire2).toHaveBeenCalledWith('SET key value')
    expect(onFire1).not.toHaveBeenCalled()
  })
})
