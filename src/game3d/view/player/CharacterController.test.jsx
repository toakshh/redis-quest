// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import CharacterController from './CharacterController.jsx'

// Mock FEEL
vi.mock('../../config/feel.js', () => ({
  FEEL: {
    move: {
      gravity: -18,
      speed: 10
    }
  }
}))

const mockController = {
  setApplyImpulsesToDynamicBodies: vi.fn(),
}

const mockWorld = {
  createCharacterController: vi.fn(() => mockController),
  removeCharacterController: vi.fn(),
}

vi.mock('@react-three/rapier', () => ({
  useRapier: () => ({ world: mockWorld }),
  RigidBody: vi.fn(({ children, type, colliders }) => (
    <div data-testid="rigidbody" data-type={type} data-colliders={String(colliders)}>
      {children}
    </div>
  )),
  CapsuleCollider: vi.fn(({ args }) => (
    <div data-testid="capsule" data-args={JSON.stringify(args)} />
  ))
}))

describe('CharacterController', () => {
  it('1. Renders a RigidBody with correct type and colliders', () => {
    const { getByTestId } = render(<CharacterController />)
    const rb = getByTestId('rigidbody')
    expect(rb.getAttribute('data-type')).toBe('kinematicPosition')
    expect(rb.getAttribute('data-colliders')).toBe('false')

    const cap = getByTestId('capsule')
    expect(cap.getAttribute('data-args')).toBe('[0.5,0.4]')
  })

  it('2. Creates character controller with correct offset', () => {
    render(<CharacterController />)
    expect(mockWorld.createCharacterController).toHaveBeenCalledWith(0.01)
  })

  it('3. Applies impulses to dynamic bodies', () => {
    render(<CharacterController />)
    expect(mockController.setApplyImpulsesToDynamicBodies).toHaveBeenCalledWith(true)
  })

  it('4. Cleans up controller on unmount', () => {
    const { unmount } = render(<CharacterController />)
    unmount()
    expect(mockWorld.removeCharacterController).toHaveBeenCalledWith(mockController)
  })
})
