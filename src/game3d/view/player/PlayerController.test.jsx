// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import PlayerController from './PlayerController.jsx'
import { FEEL } from '../../config/feel.js'
import fs from 'fs'
import path from 'path'

// Mock FEEL
vi.mock('../../config/feel.js', () => ({
  FEEL: {
    camera: {
      fovDefault: 75,
      fovSprint: 82,
      headBobHz: 1.2,
      headBobAmplitude: 0.035,
    },
    move: {
      walkSpeed: 4.2,
      sprintSpeed: 7.0,
      jumpVelocity: 5.2,
    },
  },
}))

let useFrameCallback = null

const mockCamera = {
  fov: 75,
  updateProjectionMatrix: vi.fn(),
  position: { set: vi.fn() },
  rotation: { set: vi.fn(), order: 'YXZ' },
}

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb) => {
    useFrameCallback = cb
  },
  useThree: () => ({
    camera: mockCamera,
  }),
}))

const mockWorld = {
  playerId: 0,
  playerHealth01: 1.0,
  grounded: new Uint8Array([1]),
  playerInputs: {},
  playerYaw: 0,
  hash: {
    queryRadius: vi.fn(() => 0),
  },
  entities: {
    alive: new Uint8Array([1]),
    flags: new Uint32Array([0]),
    health: new Float32Array([10]),
    posX: new Float32Array([10]),
    posY: new Float32Array([0]),
    posZ: new Float32Array([-5]),
    prevX: new Float32Array([10]),
    prevY: new Float32Array([0]),
    prevZ: new Float32Array([-5]),
    velY: new Float32Array([0]),
    archetype: new Uint8Array([0]),
  },
}

vi.mock('../SimProvider.jsx', () => ({
  useSim: () => ({
    world: mockWorld,
  }),
}))

describe('PlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFrameCallback = null
    mockWorld.playerInputs = {}
    mockWorld.playerYaw = 0
    mockWorld.grounded[0] = 1
    mockWorld.playerHealth01 = 1.0
    mockWorld.entities.alive[0] = 1
    mockWorld.entities.posX[0] = 10
    mockWorld.entities.posY[0] = 0
    mockWorld.entities.posZ[0] = -5
    mockWorld.entities.prevX[0] = 10
    mockWorld.entities.prevY[0] = 0
    mockWorld.entities.prevZ[0] = -5
    mockWorld.entities.velY[0] = 0
    mockCamera.fov = 75
  })

  it('1. Listens to key events and registers inputs to world.playerInputs', () => {
    const { unmount } = render(<PlayerController active={true} locked={true} />)

    // Trigger keydown Event
    const eventW = new KeyboardEvent('keydown', { code: 'KeyW' })
    window.dispatchEvent(eventW)

    const eventShift = new KeyboardEvent('keydown', { code: 'ShiftLeft' })
    window.dispatchEvent(eventShift)

    expect(useFrameCallback).toBeDefined()
    useFrameCallback({}, 0.016)

    expect(mockWorld.playerInputs.fwd).toBe(true)
    expect(mockWorld.playerInputs.sprint).toBe(true)

    // Trigger keyup Event
    const eventUpW = new KeyboardEvent('keyup', { code: 'KeyW' })
    window.dispatchEvent(eventUpW)

    useFrameCallback({}, 0.016)
    expect(mockWorld.playerInputs.fwd).toBe(false)

    unmount()
  })

  it('2. Grounded jumping sets velocity appropriately', () => {
    const { unmount } = render(<PlayerController active={true} locked={true} />)

    mockWorld.grounded[0] = 1
    const eventSpace = new KeyboardEvent('keydown', { code: 'Space' })
    window.dispatchEvent(eventSpace)

    useFrameCallback({}, 0.016)

    expect(mockWorld.entities.velY[0]).toBeCloseTo(FEEL.move.jumpVelocity, 5)

    unmount()
  })

  it('3. Computes head bobbing based on physical velocity displacement while grounded', () => {
    const { unmount } = render(<PlayerController active={true} locked={true} />)

    // Move the player physically
    mockWorld.entities.posX[0] = 10.1 // moved 0.1 meters in X
    mockWorld.entities.posZ[0] = -5.0
    mockWorld.entities.prevX[0] = 10.0
    mockWorld.entities.prevZ[0] = -5.0
    mockWorld.grounded[0] = 1 // grounded

    useFrameCallback({}, 0.016) // tick

    // Camera position should have y offset (PLAYER_EYE_HEIGHT + bob)
    // PLAYER_EYE_HEIGHT is 1.62
    expect(mockCamera.position.set).toHaveBeenCalled()
    const callArgs = mockCamera.position.set.mock.calls[0]
    expect(callArgs[0]).toBeCloseTo(10.1, 5) // posX
    expect(callArgs[1]).not.toBeCloseTo(1.62, 5) // should have bob offset added!
    expect(callArgs[2]).toBeCloseTo(-5.0, 5) // posZ

    unmount()
  })

  it('4. Does not bob when not grounded', () => {
    const { unmount } = render(<PlayerController active={true} locked={true} />)

    // Move the player physically
    mockWorld.entities.posX[0] = 10.1
    mockWorld.entities.prevX[0] = 10.0
    mockWorld.grounded[0] = 0 // airborne!

    useFrameCallback({}, 0.016)

    // With no bob, position.y should be exactly at default eye height (1.62)
    expect(mockCamera.position.set).toHaveBeenCalled()
    const callArgs = mockCamera.position.set.mock.calls[0]
    expect(callArgs[1]).toBeCloseTo(1.62, 5)

    unmount()
  })

  it('5. Generates end-to-end movement feel and head-bobbing transcript', () => {
    const logLines = []
    logLines.push('======================================================================')
    logLines.push('3D PLAYER WASD MOVEMENT & HEAD-BOBBING SIMULATION TRANSCRIPT')
    logLines.push('======================================================================\n')
    logLines.push('FEEL configurations:')
    logLines.push(`  - Walk speed: ${FEEL.move.walkSpeed} m/s`)
    logLines.push(`  - Sprint speed: ${FEEL.move.sprintSpeed} m/s`)
    logLines.push(`  - Head Bob frequency: ${FEEL.camera.headBobHz} Hz`)
    logLines.push(`  - Head Bob amplitude: ${FEEL.camera.headBobAmplitude} m\n`)

    const { unmount } = render(<PlayerController active={true} locked={true} onFire={() => {}} />)

    let elapsed = 0
    let posX = 10.0
    let posZ = -5.0
    mockWorld.entities.posX[0] = posX
    mockWorld.entities.posZ[0] = posZ
    mockWorld.entities.prevX[0] = posX
    mockWorld.entities.prevZ[0] = posZ
    mockWorld.grounded[0] = 1

    const dt = 0.016 // ~60fps

    const simulateStep = (inputsDesc, isGrounded, speed) => {
      mockCamera.position.set.mockClear()

      const prevX = posX
      const prevZ = posZ
      posZ -= speed * dt // moving in -Z (forward)

      mockWorld.entities.prevX[0] = prevX
      mockWorld.entities.prevZ[0] = prevZ
      mockWorld.entities.posX[0] = posX
      mockWorld.entities.posZ[0] = posZ
      mockWorld.grounded[0] = isGrounded ? 1 : 0

      useFrameCallback({}, dt)
      elapsed += dt

      const camSetCall = mockCamera.position.set.mock.calls[0]
      const finalCamY = camSetCall ? camSetCall[1] : 1.62
      const bobOffset = finalCamY - 1.62

      logLines.push(
        `T=${elapsed.toFixed(3)}s | Input: ${inputsDesc.padEnd(12)} | ` +
        `Pos: [${posX.toFixed(2)}, ${posZ.toFixed(2)}] | Grounded: ${isGrounded ? 'Yes' : 'No '} | ` +
        `Speed: ${speed.toFixed(2)} m/s | CamY: ${finalCamY.toFixed(4)} (Bob: ${bobOffset >= 0 ? '+' : ''}${bobOffset.toFixed(4)}m)`
      )
    }

    logLines.push('--- Phase 1: Idle (no speed) ---')
    for (let i = 0; i < 5; i++) {
      simulateStep('None', true, 0)
    }

    logLines.push('\n--- Phase 2: Walking Forward (grounded, speed = 4.2 m/s) ---')
    // Trigger W key event
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    for (let i = 0; i < 15; i++) {
      simulateStep('Walk Fwd', true, FEEL.move.walkSpeed)
    }

    logLines.push('\n--- Phase 3: Sprinting Forward (grounded, speed = 7.0 m/s) ---')
    // Trigger Sprint Shift event
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    for (let i = 0; i < 15; i++) {
      simulateStep('Sprint Fwd', true, FEEL.move.sprintSpeed)
    }

    logLines.push('\n--- Phase 4: Airborne / Jump (not grounded, speed = 7.0 m/s) ---')
    for (let i = 0; i < 10; i++) {
      simulateStep('Airborne', false, FEEL.move.sprintSpeed)
    }

    logLines.push('\n--- Phase 5: Landing & Decelerating (grounded, speed decays to 0) ---')
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))
    let currentSpeed = FEEL.move.sprintSpeed
    for (let i = 0; i < 10; i++) {
      currentSpeed = Math.max(0, currentSpeed - 12 * 7.0 * dt) // swift deceleration
      simulateStep('Decel', true, currentSpeed)
    }

    const evidenceDir = '/tmp/no-mistakes-evidence/01M111SGVA2YQB70HKHTV6ZSHV'
    fs.mkdirSync(evidenceDir, { recursive: true })
    fs.writeFileSync(path.join(evidenceDir, 'movement_evidence.txt'), logLines.join('\n'))

    unmount()
  })
})
