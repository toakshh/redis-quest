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

vi.mock('../SimProvider.jsx', () => ({
  useSim: () => ({
    world: mockWorld
  })
}))

describe('CardComposer', () => {
  it('1. Renders nothing or closed state by default', () => {
    const { queryByTestId } = render(<CardComposer />)
    expect(queryByTestId('card-composer')).toBeNull()
  })

  it('2. RMB down opens the composer and slows time', () => {
    const { getByTestId } = render(<CardComposer />)

    expect(mockWorld.timeScale).toBe(1)

    // Fire RMB down
    fireEvent.mouseDown(window, { button: 2 })

    expect(getByTestId('card-composer')).toBeDefined()
    expect(mockWorld.timeScale).toBe(0.35)
  })

  it('3. Displays assembled command', () => {
    const { getByTestId } = render(<CardComposer />)
    fireEvent.mouseDown(window, { button: 2 })
    expect(getByTestId('assembled-string').textContent).toBe('SET key value')
  })

  it('4. RMB up closes, restores timeScale, calls onFire', () => {
    const onFire = vi.fn()
    const { queryByTestId } = render(<CardComposer onFire={onFire} />)

    // Open
    fireEvent.mouseDown(window, { button: 2 })
    expect(mockWorld.timeScale).toBe(0.35)

    // Close
    fireEvent.mouseUp(window, { button: 2 })
    expect(queryByTestId('card-composer')).toBeNull()

    expect(mockWorld.timeScale).toBe(1)
    expect(onFire).toHaveBeenCalledWith('SET key value')
  })
})
