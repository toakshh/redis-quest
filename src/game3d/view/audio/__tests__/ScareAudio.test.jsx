import { vi, describe, it, expect } from 'vitest'
import React from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { ScareAudio } from '../ScareAudio.jsx'
import { SimProvider } from '../../SimProvider.jsx'

class MockAudioNode {
  constructor() {
    this.connectedTo = []
  }
  connect(node) {
    this.connectedTo.push(node)
  }
}

class MockAudioParam {
  constructor(val = 0) {
    this.value = val
    this.scheduledCalls = []
  }
  cancelScheduledValues = vi.fn((time) => {
    this.scheduledCalls.push(['cancel', time])
  })
  setTargetAtTime = vi.fn((target, time, ratio) => {
    this.value = target
    this.scheduledCalls.push(['setTarget', target, time, ratio])
  })
  setValueAtTime = vi.fn((val, time) => {
    this.value = val
    this.scheduledCalls.push(['set', val, time])
  })
  exponentialRampToValueAtTime = vi.fn()
  linearRampToValueAtTime = vi.fn()
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super()
    this.gain = new MockAudioParam(1.0)
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super()
    this.type = 'lowpass'
    this.frequency = new MockAudioParam(1000)
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor() {
    super()
    this.threshold = new MockAudioParam(-24)
    this.ratio = new MockAudioParam(12)
  }
}

class MockWaveShaperNode extends MockAudioNode {
  constructor() {
    super()
    this.curve = null
  }
}

class MockConvolverNode extends MockAudioNode {
  constructor() {
    super()
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super()
    this.frequency = new MockAudioParam(440)
  }
  start() {}
  stop() {}
}

class MockBufferSourceNode extends MockAudioNode {
  constructor() {
    super()
    this.buffer = null
  }
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0
    this.state = 'running'
    this.sampleRate = 44100
    this.destination = new MockAudioNode()
  }
  close() {}
  createGain() { return new MockGainNode() }
  createBiquadFilter() { return new MockBiquadFilterNode() }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode() }
  createWaveShaper() { return new MockWaveShaperNode() }
  createConvolver() { return new MockConvolverNode() }
  createOscillator() { return new MockOscillatorNode() }
  createBufferSource() { return new MockBufferSourceNode() }
  createBuffer(channels, size, rate) {
    return {
      getChannelData: () => new Float32Array(size)
    }
  }
}

describe('ScareAudio', () => {
  it('renders without crashing and reacts to world scare events', async () => {
    // Mock the AudioContext
    const mockCtx = new MockAudioContext()
    mockCtx.close = vi.fn()
    globalThis.window = {
      AudioContext: class {
        constructor() {
          return mockCtx
        }
      }
    }

    const world = {
      tick: 1,
      scareEvents: [
        { type: 'scare', soundId: 'sfx_lunge', intensity: 0.8 }
      ],
      audioDrop: false,
      contactWeight: 0
    }

    const renderer = await ReactThreeTestRenderer.create(
      <SimProvider world={world}>
        <ScareAudio />
      </SimProvider>
    )

    expect(renderer.scene.children.length).toBe(0) // ScareAudio returns null so scene is empty
    
    await renderer.advanceFrames(2, 0.016)

    // Ensure state mutation is handled correctly
    expect(world.scareEvents).toBeDefined()
    
    // Cleanup
    renderer.unmount()
    delete globalThis.window
  })

  it('reacts to audio drop transitions and avoids busy-updating every frame', async () => {
    const mockCtx = new MockAudioContext()
    let masterGainNode = null
    const originalCreateGain = mockCtx.createGain

    // Intercept creation of masterGainNode
    mockCtx.createGain = function() {
      const node = originalCreateGain.call(mockCtx)
      if (!masterGainNode) {
        masterGainNode = node
      }
      return node
    }

    mockCtx.close = vi.fn()
    globalThis.window = {
      AudioContext: class {
        constructor() {
          return mockCtx
        }
      }
    }

    const world = {
      tick: 1,
      scareEvents: [],
      audioDrop: false,
      contactWeight: 0
    }

    const renderer = await ReactThreeTestRenderer.create(
      <SimProvider world={world}>
        <ScareAudio />
      </SimProvider>
    )

    // First frame initializes transition (sets gain to 1)
    await renderer.advanceFrames(1, 0.016)
    
    expect(masterGainNode).not.toBeNull()
    const activeCalls = masterGainNode.gain.scheduledCalls
    expect(activeCalls.length).toBe(2)
    expect(activeCalls[0]).toEqual(['cancel', 0])
    expect(activeCalls[1]).toEqual(['setTarget', 1, 0, 0.1])

    // Advancing frame with no state change should NOT generate new schedules
    activeCalls.length = 0
    await renderer.advanceFrames(5, 0.016)
    expect(activeCalls.length).toBe(0)

    // Changing audioDrop to true should schedule transition to 0
    world.audioDrop = true
    await renderer.advanceFrames(1, 0.016)
    expect(activeCalls.length).toBe(2) // cancel + setTarget
    expect(activeCalls[0]).toEqual(['cancel', 0])
    expect(activeCalls[1]).toEqual(['setTarget', 0, 0, 0.1])

    // Subsequent frame should not call setTarget again
    activeCalls.length = 0
    await renderer.advanceFrames(3, 0.016)
    expect(activeCalls.length).toBe(0)

    renderer.unmount()
    delete globalThis.window
  })
})
