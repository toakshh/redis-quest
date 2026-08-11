// Fixed-timestep game loop targeting 60 FPS (16.66ms per update tick).
//
// Separates game logic ticks from frame rendering:
//   - update(dt): advances simulation state by a fixed timestep (0.0166s)
//   - render(interpolation): draws frame, receiving alpha [0..1] for smooth interpolation
//
// Protects against the "spiral of death" (large update debt on lag spike) by capping
// accumulated time per frame tick.

export class GameLoop {
  /**
   * @param {object} [opts]
   * @param {(dt: number) => void} [opts.onUpdate] fixed-step update callback (dt in seconds)
   * @param {(alpha: number) => void} [opts.onRender] frame render callback (alpha [0..1] interpolation factor)
   * @param {number} [opts.targetFps=60] target updates per second
   * @param {number} [opts.maxAccumSeconds=0.25] max update time debt allowed per frame tick
   */
  constructor({ onUpdate, onRender, targetFps = 60, maxAccumSeconds = 0.25 } = {}) {
    this.onUpdate = onUpdate || (() => {})
    this.onRender = onRender || (() => {})
    this.dt = 1 / targetFps
    this.maxAccumSeconds = maxAccumSeconds

    this.running = false
    this.rafId = null
    this.lastTime = 0
    this.accum = 0
    this.fps = targetFps
    this.frameCount = 0
    this.fpsTimer = 0

    this._tick = this._tick.bind(this)
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.accum = 0
    this.frameCount = 0
    this.fpsTimer = this.lastTime
    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this._tick)
    }
  }

  stop() {
    if (!this.running) return
    this.running = false
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  // Manual step for testing or headless environments
  step(dtSeconds) {
    let frameTime = dtSeconds
    if (frameTime > this.maxAccumSeconds) {
      frameTime = this.maxAccumSeconds
    }
    this.accum += frameTime
    while (this.accum >= this.dt) {
      this.onUpdate(this.dt)
      this.accum -= this.dt
    }
    const alpha = this.dt > 0 ? this.accum / this.dt : 0
    this.onRender(alpha)
  }

  _tick(currentTime) {
    if (!this.running) return

    const now = currentTime ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let frameTime = (now - this.lastTime) / 1000
    this.lastTime = now

    // Clamp frame time to prevent spiral of death on window unfocus / lag spikes
    if (frameTime > this.maxAccumSeconds) {
      frameTime = this.maxAccumSeconds
    }

    this.accum += frameTime

    // Measure actual FPS over 1-second sliding windows
    this.frameCount++
    if (now - this.fpsTimer >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer))
      this.frameCount = 0
      this.fpsTimer = now
    }

    // Step physics/logic in fixed dt increments
    while (this.accum >= this.dt) {
      this.onUpdate(this.dt)
      this.accum -= this.dt
    }

    // Render with interpolation factor alpha = accum / dt
    const alpha = this.dt > 0 ? this.accum / this.dt : 0
    this.onRender(alpha)

    if (this.running && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this._tick)
    }
  }
}