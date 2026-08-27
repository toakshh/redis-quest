// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import SimInspector from './SimInspector.jsx'

let useFrameCb = null
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb) => {
    useFrameCb = cb
  }
}))

vi.mock('@react-three/drei', () => ({
  Html: ({ children }) => <div data-testid="html-overlay">{children}</div>
}))

vi.mock('../SimProvider.jsx', () => ({
  useSim: () => ({
    world: { timeMs: 5, objectivesComplete: false, entities: { spawnCount: 15 } },
    runtime: { engine: {} }
  })
}))

describe('SimInspector', () => {
  it('1. Renders nothing by default', () => {
    const { queryByTestId } = render(<SimInspector />)
    expect(queryByTestId('html-overlay')).toBeNull()
  })

  it('2. Toggles with F3 key and reads data', () => {
    const { getByTestId, queryByTestId } = render(<SimInspector />)

    // Press F3
    fireEvent.keyDown(window, { key: 'F3', code: 'F3' })
    const overlay = getByTestId('html-overlay')
    expect(overlay).toBeDefined()

    // Simulate frame to update DOM
    expect(useFrameCb).toBeDefined()
    useFrameCb({ gl: { info: { render: { calls: 42 } } } })

    // Check content
    expect(overlay.innerHTML).toContain('SIM INSPECTOR')
    expect(overlay.innerHTML).toContain('Draw Calls: 42')
    expect(overlay.innerHTML).toContain('Entity Count: 15')

    // Press F3 again
    fireEvent.keyDown(window, { key: 'F3', code: 'F3' })
    expect(queryByTestId('html-overlay')).toBeNull()
  })
})
