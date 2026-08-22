import { describe, it, expect, vi } from 'vitest'
import { playProceduralSfx } from './ProceduralSfx.js'

// Mock Web Audio Context
class MockGainNode {
  constructor() {
    this.gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    }
  }
  connect() {}
}

class MockBiquadFilterNode {
  constructor() {
    this.frequency = {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    }
  }
  connect() {}
}

class MockOscillatorNode {
  constructor() {
    this.frequency = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    }
  }
  connect() {}
  start() {}
  stop() {}
}

class MockBufferSourceNode {
  constructor() {
    this.buffer = null
  }
  connect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 44100
  }
  createGain() { return new MockGainNode() }
  createBiquadFilter() { return new MockBiquadFilterNode() }
  createOscillator() { return new MockOscillatorNode() }
  createBufferSource() { return new MockBufferSourceNode() }
  createBuffer(channels, size, rate) {
    return {
      getChannelData: () => new Float32Array(size)
    }
  }
}

describe('ProceduralSfx', () => {
  it('1. Connects nodes for known sound sfx_lunge', () => {
    const ctx = new MockAudioContext()
    const dest = {}

    // Test should just run without throwing, validating the integration of the pure synth functions
    expect(() => {
      playProceduralSfx(ctx, dest, 'sfx_lunge')
    }).not.toThrow()
  })

  it('2. Connects nodes for generic fallback', () => {
    const ctx = new MockAudioContext()
    const dest = {}

    expect(() => {
      playProceduralSfx(ctx, dest, 'sfx_unknown_generic')
    }).not.toThrow()
  })

  it('3. Generates UI sound', () => {
    const ctx = new MockAudioContext()
    const dest = {}

    expect(() => {
      playProceduralSfx(ctx, dest, 'sfx_ui_click')
    }).not.toThrow()
  })
})
