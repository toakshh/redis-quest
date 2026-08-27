// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import PlayerRig from './PlayerRig.jsx'

// Mock FEEL
vi.mock('../../config/feel.js', () => ({
  FEEL: {
    camera: {
      fovDefault: 75,
      fovSprint: 82,
      fovLerpMs: 180,
      headBobHz: 1.2,
      headBobAmplitude: 0.035,
      strafeRollDeg: 1.5,
    }
  }
}))

let useFrameCallback = null

const mockCamera = {
  fov: 75,
  updateProjectionMatrix: vi.fn(),
  position: { y: 0 },
  rotation: { z: 0 }
}

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mockCamera }),
  useFrame: (cb) => {
    useFrameCallback = cb
  }
}))

vi.mock('@react-three/drei', () => ({
  PointerLockControls: () => <div data-testid="pointer-lock" />
}))

describe('PlayerRig', () => {
  it('1. Renders PointerLockControls', () => {
    const { getByTestId } = render(<PlayerRig />)
    expect(getByTestId('pointer-lock')).toBeDefined()
  })

  it('2. Updates camera FOV on sprint', () => {
    render(<PlayerRig isSprinting={true} />)

    // simulate a frame
    expect(useFrameCallback).toBeDefined()
    mockCamera.fov = 75
    useFrameCallback({}, 0.016)

    // Verify FOV moved towards sprint FOV (82)
    expect(mockCamera.fov).toBeGreaterThan(75)
    expect(mockCamera.updateProjectionMatrix).toHaveBeenCalled()
  })

  it('3. Applies roll and head bob', () => {
    render(<PlayerRig isSprinting={false} velocity={{ x: 1, z: 1 }} />)

    // Reset state
    mockCamera.position.y = 0
    mockCamera.rotation.z = 0

    // Simulate motion over a larger delta to see some bob
    useFrameCallback({}, 0.2) // 200ms

    // Position y should be modified by sine wave head bob
    expect(mockCamera.position.y).not.toBe(0)
    // Rotation z should be modified by strafe roll
    expect(mockCamera.rotation.z).not.toBe(0)
  })
})
