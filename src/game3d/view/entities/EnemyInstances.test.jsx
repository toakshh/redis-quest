// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import EnemyInstances from './EnemyInstances.jsx'

const mockSetMatrixAt = vi.fn()
const mockInstanceMatrix = { needsUpdate: false }
const mockMesh = {
  setMatrixAt: mockSetMatrixAt,
  instanceMatrix: mockInstanceMatrix,
  count: 0
}

let useFrameCb = null
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb) => {
    useFrameCb = cb
  },
}))

vi.mock('../SimProvider.jsx', () => ({
  useSim: () => ({
    world: {
      entities: {
        capacity: 3,
        alive: new Uint8Array([1, 1, 0]),
        flags: new Uint16Array([1, 0, 1]), // 0: ALIVE&HOSTILE, 1: ALIVE!HOSTILE, 2: !ALIVE&HOSTILE
        posX: new Float32Array([10, 20, 30]),
        posY: new Float32Array([1, 2, 3]),
        posZ: new Float32Array([100, 200, 300]),
        yaw: new Float32Array([0, 0, 0])
      }
    }
  })
}))

// Override primitive so we can use a mock ref
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useRef: (initial) => {
      // If it's a null ref, return our mock mesh so it's pre-populated
      const ref = actual.useRef(initial)
      if (ref.current === null) {
        ref.current = mockMesh
      }
      return ref
    }
  }
})

describe('EnemyInstances', () => {
  it('1. Renders instancedMesh with correct args', () => {
    const { container } = render(<EnemyInstances geometry="geo" material="mat" count={100} />)
    const el = container.querySelector('instancedmesh')
    expect(el).toBeDefined()
    expect(el.getAttribute('args')).toContain('geo')
  })

  it('2. Updates matrices in useFrame based on entities and sets needsUpdate = true', () => {
    render(<EnemyInstances geometry="geo" material="mat" count={100} />)
    mockSetMatrixAt.mockClear()
    mockInstanceMatrix.needsUpdate = false

    useFrameCb({}, 0.016)

    expect(mockSetMatrixAt).toHaveBeenCalled()
    expect(mockSetMatrixAt.mock.calls[0][0]).toBe(0) 
    expect(mockSetMatrixAt.mock.calls[1][0]).toBe(1)
    expect(mockSetMatrixAt.mock.calls[99][0]).toBe(99)
    expect(mockInstanceMatrix.needsUpdate).toBe(true)
  })
})

beforeAll(() => {
  // Hack to make the jsdom instancedmesh element mimic THREE.InstancedMesh
  window.HTMLUnknownElement.prototype.setMatrixAt = mockSetMatrixAt
  Object.defineProperty(window.HTMLUnknownElement.prototype, 'instanceMatrix', {
    get() { return mockInstanceMatrix },
    set() {}
  })
})
