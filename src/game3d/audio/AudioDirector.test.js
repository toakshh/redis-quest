import { describe, it, expect, vi } from 'vitest'
import { createAudioDirector } from './AudioDirector.js'

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
  cancelScheduledValues(time) {
    this.scheduledCalls.push(['cancel', time])
  }
  setValueAtTime(val, time) {
    this.value = val // Simplify for test
    this.scheduledCalls.push(['set', val, time])
  }
  linearRampToValueAtTime(val, time) {
    this.scheduledCalls.push(['linearRamp', val, time])
  }
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

class MockAudioContext {
  constructor() {
    this.currentTime = 0
    this.destination = new MockAudioNode()
  }
  createGain() { return new MockGainNode() }
  createBiquadFilter() { return new MockBiquadFilterNode() }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode() }
  createWaveShaper() { return new MockWaveShaperNode() }
  createConvolver() { return new MockConvolverNode() }
}

describe('AudioDirector', () => {
  it('1. Creates 6 distinct buses', () => {
    const mockCtx = new MockAudioContext()
    const dir = createAudioDirector(mockCtx)

    expect(dir.buses.music).toBeDefined()
    expect(dir.buses.combat).toBeDefined()
    expect(dir.buses.world).toBeDefined()
    expect(dir.buses.scare).toBeDefined()
    expect(dir.buses.voice).toBeDefined()
    expect(dir.buses.ui).toBeDefined()
  })

  it('2. Scare bus has 12dB headroom reserve', () => {
    const mockCtx = new MockAudioContext()
    const dir = createAudioDirector(mockCtx)

    // In our implementation, standardSubMaster is at 0.25 (-12dB) compared to scareBus directly to master
    // scare connects to master
    expect(dir.buses.scare.connectedTo[0]).toBe(dir.masterGain)

    // UI (part of standard) connects to standard submaster, which connects to master
    const standardSubMaster = dir.buses.ui.connectedTo[0]
    expect(standardSubMaster.gain.value).toBe(0.25)
    expect(standardSubMaster.connectedTo[0]).toBe(dir.masterGain)
  })

  it('3. Combat bus goes through compressor and waveshaper', () => {
    const mockCtx = new MockAudioContext()
    const dir = createAudioDirector(mockCtx)

    const compressor = dir.buses.combat.connectedTo[0]
    expect(compressor.threshold.value).toBe(-12)
    expect(compressor.ratio.value).toBe(4)

    const shaper = compressor.connectedTo[0]
    expect(shaper instanceof MockWaveShaperNode).toBe(true)
    expect(shaper.curve).not.toBeNull()
  })

  it('4. Voice bus degrades on updateVoiceDegradation', () => {
    const mockCtx = new MockAudioContext()
    const dir = createAudioDirector(mockCtx)

    const filter = dir.buses.voice.connectedTo[0]
    expect(filter.type).toBe('bandpass')

    // At 0 latency (1 latencyNorm), freq should be high (4000)
    // Wait, updateVoiceDegradation(latencyNorm) : if latencyNorm is high, 1-latencyNorm is low
    // Latency norm 1 means perfect connection.
    dir.updateVoiceDegradation(1)
    expect(filter.frequency.value).toBeCloseTo(1000) // Default bandpass in test implementation, wait, logic says 1000+0 = 1000. Wait, logic has 1000 + 3000(1-1) = 1000.

    dir.updateVoiceDegradation(0) // Worst connection
    expect(filter.frequency.value).toBeCloseTo(4000) // Higher frequency bandpass simulates degradation / tinny
  })

  it('5. duckMusic triggers ducking schedule', () => {
    const mockCtx = new MockAudioContext()
    const dir = createAudioDirector(mockCtx)

    dir.duckMusic(10)
    const calls = dir.buses.music.gain.scheduledCalls

    expect(calls.length).toBeGreaterThan(0)
    expect(calls).toEqual(expect.arrayContaining([
      ['cancel', 10],
      ['set', 0.5, 10],
      ['linearRamp', 1.0, 10 + 0.12]
    ]))
  })
})
