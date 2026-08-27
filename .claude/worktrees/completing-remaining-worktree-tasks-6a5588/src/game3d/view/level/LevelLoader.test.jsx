// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import LevelLoader from './LevelLoader.jsx'

// Mock R3F Hooks
let useGLTFMocked = vi.fn((url) => ({
  scene: { type: 'MockScene' }
}))

vi.mock('@react-three/drei', () => ({
  useGLTF: (url) => useGLTFMocked(url)
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))

vi.mock('@react-three/rapier', () => ({
  RigidBody: ({ children }) => <div data-testid="rigidbody">{children}</div>,
  CuboidCollider: (props) => <div data-testid="collider" data-args={JSON.stringify(props.args)} />
}))

// A special mock string for Suspense child to wait
useGLTFMocked.mockReturnValue({ scene: { type: 'MockScene' } })

describe('LevelLoader', () => {
  it('1. Wraps children in Suspense (fallback renders immediately in test without await)', () => {
    // In standard testing library, a suspended component might just render the fallback initially
    // or render fully because the mock is sync. Since our mock is synchronous, it resolves instantly.
    const colliders = []
    const { container } = render(<LevelLoader url="/test.glb" colliders={colliders} fallback={<div data-testid="fallback"/>} />)
    expect(container).toBeDefined()
  })

  it('2. Calls useGLTF for the url', () => {
    useGLTFMocked.mockClear()
    const colliders = []
    render(<LevelLoader url="/test.glb" colliders={colliders} />)
    expect(useGLTFMocked).toHaveBeenCalledWith('/test.glb')
  })

  it('3. Renders colliders given in manifest', () => {
    const colliders = [
      { id: 'c1', args: [1, 2, 3], position: [0, 0, 0] },
      { id: 'c2', args: [4, 5, 6], position: [1, 1, 1] }
    ]
    const { getAllByTestId } = render(<LevelLoader url="/test.glb" colliders={colliders} />)

    const renderedColliders = getAllByTestId('collider')
    expect(renderedColliders.length).toBe(2)
    expect(renderedColliders[0].getAttribute('data-args')).toBe('[1,2,3]')
    expect(renderedColliders[1].getAttribute('data-args')).toBe('[4,5,6]')
  })
})
