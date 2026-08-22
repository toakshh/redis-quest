import { describe, it, expect } from 'vitest'
import { createFlinchMeter } from './FlinchMeter.js'

describe('FlinchMeter', () => {
  it('1. Creates meter with 400ms window', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    expect(meter.getFlinch()).toBeNull()
  })

  it('2. Returns null before window completes', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1300, { mouseX: 100, mouseY: 100, moveX: 0, moveZ: 0, dt: 16 })
    expect(meter.getFlinch()).toBeNull()
  })

  it('3. Returns flinch value after 400ms', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1400, { mouseX: 100, mouseY: 100, moveX: 0, moveZ: 0, dt: 16 })
    expect(meter.getFlinch()).not.toBeNull()
    expect(typeof meter.getFlinch()).toBe('number')
    expect(meter.getFlinch()).toBeGreaterThanOrEqual(0)
    expect(meter.getFlinch()).toBeLessThanOrEqual(1)
  })

  it('4. Mouse jerk increases flinch', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1100, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1200, { mouseX: 50, mouseY: 50, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1300, { mouseX: 100, mouseY: 100, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1400, { mouseX: 150, mouseY: 150, moveX: 0, moveZ: 0, dt: 16 })
    expect(meter.getFlinch()).toBeGreaterThan(0)
  })

  it('5. Input reversal increases flinch', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1100, { mouseX: 0, mouseY: 0, moveX: 1, moveZ: 0, dt: 16 })
    meter.update(1200, { mouseX: 0, mouseY: 0, moveX: -1, moveZ: 0, dt: 16 })
    meter.update(1300, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1400, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    expect(meter.getFlinch()).toBeGreaterThan(0)
  })

  it('6. Input freeze increases flinch', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1100, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 100 })
    meter.update(1200, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 100 })
    meter.update(1300, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 100 })
    meter.update(1400, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 100 })
    expect(meter.getFlinch()).toBeGreaterThan(0)
  })

  it('7. Normalizes flinch to 0..1 range', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    for (let i = 1100; i <= 1400; i += 16) {
      meter.update(i, { mouseX: i * 10, mouseY: i * 10, moveX: 1, moveZ: 1, dt: 16 })
    }
    // Ensure 400ms has passed
    meter.update(1410, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    const flinch = meter.getFlinch()
    expect(flinch).toBeGreaterThanOrEqual(0)
    expect(flinch).toBeLessThanOrEqual(1)
  })

  it('8. Uses weights 0.5 jerk, 0.3 reversal, 0.2 freeze', () => {
    const meter = createFlinchMeter()
    meter.startMeasurement(1000)
    meter.update(1100, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1200, { mouseX: 100, mouseY: 100, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1300, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    meter.update(1400, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    const flinchJerk = meter.getFlinch()

    const meter2 = createFlinchMeter()
    meter2.startMeasurement(1000)
    meter2.update(1100, { mouseX: 0, mouseY: 0, moveX: 1, moveZ: 0, dt: 16 })
    meter2.update(1200, { mouseX: 0, mouseY: 0, moveX: -1, moveZ: 0, dt: 16 })
    meter2.update(1300, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    meter2.update(1400, { mouseX: 0, mouseY: 0, moveX: 0, moveZ: 0, dt: 16 })
    const flinchReversal = meter2.getFlinch()

    expect(flinchJerk).toBeGreaterThan(flinchReversal * 0.5 / 0.3 * 0.9)
  })
})