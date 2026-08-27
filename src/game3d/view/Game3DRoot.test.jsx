// @vitest-environment jsdom
//
// Lifecycle unit test for the 3D root. It owns one game instance for its
// whole lifetime and must dispose it exactly once — a leak here means an
// orphaned rAF loop and a second Redis engine running forever behind the
// launcher.
//
// The root's contract changed when the mode was wired up: it used to call
// createRuntime directly, and now delegates to createGameWorld (which builds
// the runtime, the SimWorld and every system). This mocks that boundary.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const disposeSpy = vi.fn()
const submitSpy = vi.fn()

function makeFakeGame() {
  return {
    runtime: {
      bus: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
      engine: {},
    },
    world: {
      playerHealth01: 1,
      playerTtlMs: 90_000,
      memoryPressure: 0,
      latencyP99Ms: 0,
      contactWeight: 0,
      objectiveStatus: {},
      objectivesComplete: false,
      timeScale: 1,
      entities: {},
    },
    level: { objectives: [], terminals: [], colliders: [], lights: [], racks: [], ambient: {} },
    playerId: 0,
    enemyIds: [],
    submitCommand: submitSpy,
    dispose: disposeSpy,
  }
}

vi.mock('../sim/createGameWorld.js', () => ({
  createGameWorld: vi.fn(() => makeFakeGame()),
  PLAYER_KEY: 'session:7742',
  START_TTL_SECONDS: 90,
  MAX_TTL_MS: 90_000,
}))

vi.mock('@react-three/fiber', async () => {
  const React = await import('react')
  return {
    Canvas: (props) =>
      React.createElement(
        'div',
        {
          'data-testid': 'canvas',
          'data-dpr': JSON.stringify(props.dpr),
          'data-gl': JSON.stringify(props.gl),
        },
        props.children,
      ),
    useFrame: () => {},
    useThree: () => ({ gl: { domElement: document.createElement('canvas') } }),
  }
})

vi.mock('@react-three/drei', async () => {
  const React = await import('react')
  return { AdaptiveDpr: () => React.createElement('div', { 'data-testid': 'adaptivedpr' }) }
})

import Game3DRoot from './Game3DRoot.jsx'
import { createGameWorld } from '../sim/createGameWorld.js'

describe('Game3DRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('1. Renders the Canvas with correct gl and dpr props', () => {
    render(<Game3DRoot seed="test-seed" />)
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-dpr')).toBe('[0.6,2]')
    expect(canvas.getAttribute('data-gl')).toBe(
      '{"antialias":false,"powerPreference":"high-performance"}',
    )
    expect(screen.getByTestId('adaptivedpr')).toBeDefined()
  })

  it('2. Builds the game exactly once, and not again on re-render', () => {
    const { rerender } = render(<Game3DRoot seed="test-seed" />)
    expect(createGameWorld).toHaveBeenCalledTimes(1)
    expect(createGameWorld).toHaveBeenCalledWith({ seed: 'test-seed' })

    rerender(<Game3DRoot seed="test-seed" />)
    expect(createGameWorld).toHaveBeenCalledTimes(1)
  })

  it('3. Disposes the game on unmount', () => {
    const { unmount } = render(<Game3DRoot seed="test-seed" />)
    expect(disposeSpy).not.toHaveBeenCalled()
    unmount()
    expect(disposeSpy).toHaveBeenCalledTimes(1)
  })

  it('4. Shows the click-to-play veil until the pointer is locked', () => {
    render(<Game3DRoot seed="test-seed" />)
    expect(screen.getByText(/CLICK TO ENTER/i)).toBeTruthy()
  })

  it('5. Offers an exit back to the launcher', () => {
    const onExit = vi.fn()
    render(<Game3DRoot seed="test-seed" onExit={onExit} />)
    expect(screen.getByText('EXIT')).toBeTruthy()
  })
})
