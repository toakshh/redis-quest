// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import Hud from './Hud.jsx'

describe('Hud component', () => {
  it('updates target metrics immediately when a new world object is supplied', () => {
    const world1 = {
      playerHealth01: 0.8,
      playerTtlMs: 8000,
      memoryPressure: 0.2,
      latencyP99Ms: 5,
      contactWeight: 0,
      objectiveStatus: {},
      objectivesComplete: false,
    }

    const level = { objectives: [] }
    const { getByTestId, rerender } = render(
      <Hud
        world={world1}
        level={level}
        nearTerminal={false}
        consoleOpen={false}
        lastResult={null}
        pointerLocked={true}
        entered={true}
      />
    )

    // Check that world1 metrics are rendered (e.g. TTL 8.0s)
    const barEl = getByTestId('ttl-bar')
    expect(barEl.textContent).toContain('8.0s')

    // Now switch the world to world2 immediately
    const world2 = {
      playerHealth01: 0.4,
      playerTtlMs: 4000,
      memoryPressure: 0.5,
      latencyP99Ms: 15,
      contactWeight: 0,
      objectiveStatus: {},
      objectivesComplete: false,
    }

    rerender(
      <Hud
        world={world2}
        level={level}
        nearTerminal={false}
        consoleOpen={false}
        lastResult={null}
        pointerLocked={true}
        entered={true}
      />
    )

    // Verify it immediately reflects the new world state
    expect(barEl.textContent).toContain('4.0s')
  })
})
