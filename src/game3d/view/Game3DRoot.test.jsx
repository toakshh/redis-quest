// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Game3DRoot from './Game3DRoot.jsx'

// Mock the bootstrap logic
vi.mock('../bootstrap.js', () => {
  return {
    createRuntime: vi.fn(() => ({
      dispose: vi.fn(),
    }))
  }
})

// Mock R3F and Drei
vi.mock('@react-three/fiber', () => {
  return {
    Canvas: vi.fn((props) => {
      // Dump props into a div for simple inspection
      return (
        <div data-testid="canvas" data-dpr={JSON.stringify(props.dpr)} data-gl={JSON.stringify(props.gl)}>
          {props.children}
        </div>
      )
    })
  }
})

vi.mock('@react-three/drei', () => {
  return {
    AdaptiveDpr: vi.fn(() => <div data-testid="adaptivedpr" />)
  }
})

import { createRuntime } from '../bootstrap.js'

describe('Game3DRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Renders the Canvas with correct gl and dpr props', () => {
    render(<Game3DRoot seed="test-seed" />)
    const canvas = screen.getByTestId('canvas')
    expect(canvas).toBeDefined()
    expect(canvas.getAttribute('data-dpr')).toBe('[0.6,2]')
    expect(canvas.getAttribute('data-gl')).toBe('{"antialias":false,"powerPreference":"high-performance"}')
    expect(screen.getByTestId('adaptivedpr')).toBeDefined()
  })

  it('2. Creates the runtime once via createRuntime', () => {
    const { rerender } = render(<Game3DRoot seed="test-seed" />)
    expect(createRuntime).toHaveBeenCalledTimes(1)
    expect(createRuntime).toHaveBeenCalledWith({ seed: 'test-seed' })

    // Rerendering should not recreate
    rerender(<Game3DRoot seed="test-seed" />)
    expect(createRuntime).toHaveBeenCalledTimes(1)
  })

  it('3. Calls runtime.dispose() on unmount', () => {
    const { unmount } = render(<Game3DRoot seed="test-seed" />)
    const mockRuntime = createRuntime.mock.results[0].value

    expect(mockRuntime.dispose).not.toHaveBeenCalled()
    unmount()
    expect(mockRuntime.dispose).toHaveBeenCalledTimes(1)
  })
})
